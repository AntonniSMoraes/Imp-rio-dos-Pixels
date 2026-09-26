import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function simulation(race = 'human') {
  let serial = 0;
  const mother = { id: 'mother', name: 'Mãe', race, sex: 'F', age: 25, level: 5, alive: true, lastBirth: -32 };
  const father = { ...mother, id: 'father', name: 'Pai', sex: 'M', race: 'human' };
  const ctx = vm.createContext({
    state: { day: 1, people: [mother, father], food: 500, births: 0, logs: [] },
    capacity: () => 10,
    alive: () => ctx.state.people.filter(person => person.alive),
    adult: person => person.alive && person.age >= 18 && person.level >= 5,
    adults: () => ctx.alive().filter(ctx.adult),
    partners: () => [ctx.state.people.find(person => person.id === 'father')],
    byId: id => ctx.state.people.find(person => person.id === id),
    onMission: () => false,
    log: text => ctx.state.logs.push(text),
    childOf: (a, b) => ({ id: 'child-' + ++serial, name: 'Filho ' + serial, age: 0, level: 1, alive: true, sex: serial % 2 ? 'F' : 'M', race: 'human', parents: [a.id, b.id], lastBirth: -32 }),
  });
  for (const file of ['js/config/races.js', 'js/engine/race-genetics.js', 'js/engine/calendar.js', 'js/engine/reproduction.js']) {
    vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), ctx);
  }
  ctx.birthCycle(() => 0.99); // Migrate without an immediate conception.
  return { ctx, mother, father, day: (value, random = () => 0) => { ctx.state.day = value; ctx.birthCycle(random); } };
}

test('racial gestation, recovery and twin probabilities follow the chosen rules', () => {
  const { ctx } = simulation();
  for (const [race, gestation, recovery, twins] of [
    ['human', 36, 96, 0], ['elf', 63, 48, 0], ['darkElf', 63, 48, 0],
    ['wolf', 36, 12, 0.4], ['cat', 36, 12, 0.4], ['bunny', 36, 12, 0.4], ['half-wolf', 36, 24, 0.2],
  ]) {
    const profile = ctx.reproductionProfile({ race });
    assert.equal(profile.gestationDays, gestation);
    assert.equal(profile.recoveryDays, recovery);
    assert.equal(profile.twinChance, twins);
  }
  assert.ok(Math.abs(ctx.reproductionProfile({ race: 'elf' }).conceptionChance - 0.08) < 1e-10);
});

test('failed attempts wait four days; conception does not create a baby', () => {
  const { ctx, mother, day } = simulation();
  day(5, () => 0.99);
  assert.equal(mother.reproduction.pregnancy, null);
  day(6);
  assert.equal(mother.reproduction.pregnancy, null);
  day(9);
  assert.equal(mother.reproduction.pregnancy.dueDay, 45);
  assert.equal(ctx.state.births, 0);
  day(44);
  assert.equal(ctx.state.births, 0);
  day(45);
  assert.equal(ctx.state.births, 1);
  assert.equal(mother.reproduction.recoveryUntil, 141);
  for (let date = 46; date < 145; date++) day(date);
  assert.equal(mother.reproduction.pregnancy, null);
  day(145);
  assert.ok(mother.reproduction.pregnancy);
});

test('gestation persists after reload and father death; food or housing cannot postpone delivery', () => {
  const { ctx, day } = simulation();
  day(5);
  ctx.state = JSON.parse(JSON.stringify(ctx.state));
  for (const person of ctx.state.people) ctx.validateReproduction(person, ctx.state);
  const mother = ctx.byId('mother');
  const due = mother.reproduction.pregnancy.dueDay;
  ctx.byId('father').alive = false;
  ctx.state.food = 0;
  ctx.capacity = () => 1;
  day(due, () => { throw Error('Delivery must not reroll conception'); });
  assert.equal(ctx.state.births, 1);
  assert.equal(ctx.state.food, 0);
  assert.equal(ctx.state.people.at(-1).parents[0], 'father');
  day(due);
  assert.equal(ctx.state.births, 1);
  ctx.state = JSON.parse(JSON.stringify(ctx.state));
  day(due);
  assert.equal(ctx.state.births, 1);
});

test('beast twin roll has a 40% boundary and one postpartum recovery', () => {
  for (const [roll, babies] of [[0.399999, 2], [0.4, 1]]) {
    const { ctx, mother, day } = simulation('wolf');
    const rolls = [0, 0, roll];
    day(5, () => rolls.shift());
    assert.equal(mother.reproduction.pregnancy.babies, babies);
    day(41);
    assert.equal(ctx.state.births, babies);
    assert.equal(mother.reproduction.recoveryUntil, 53);
    if (babies === 2) assert.notEqual(ctx.state.people[2].sex, ctx.state.people[3].sex);
  }
});

test('mother death ends the pregnancy; minors and insufficient housing block conception', () => {
  const { ctx, mother, day } = simulation('wolf');
  ctx.capacity = () => 3; // Two available places are required for possible twins.
  day(5);
  assert.equal(mother.reproduction.pregnancy, null);
  ctx.capacity = () => 10;
  mother.age = 17;
  day(9);
  assert.equal(mother.reproduction.pregnancy, null);
  mother.age = 25;
  day(13);
  mother.alive = false;
  day(49);
  assert.equal(ctx.state.births, 0);
  assert.equal(mother.reproduction.pregnancy, null);
});

test('legacy births retain racial recovery and malformed pregnancy saves are rejected', () => {
  const { ctx, mother } = simulation('elf');
  delete mother.reproduction;
  mother.lastBirth = 0;
  ctx.validateReproduction(mother, ctx.state);
  assert.equal(mother.reproduction.recoveryUntil, 48);
  mother.reproduction.pregnancy = { fatherId: 'missing', conceivedDay: 1, dueDay: 64, babies: 2, recoveryDays: 48 };
  assert.throws(() => ctx.validateReproduction(mother, ctx.state), /pregnancy/);
});

test('even guaranteed conception cannot skip pregnancy and recovery across many years', () => {
  for (const [race, minimumInterval] of [['human', 64], ['elf', 115], ['wolf', 52]]) {
    const { ctx, day } = simulation(race);
    ctx.capacity = () => 10000;
    ctx.state.food = 100000;
    let previousBirth = null;
    let births = 0;
    for (let date = 2; date <= 1200; date++) {
      day(date);
      if (ctx.state.births !== births) {
        if (previousBirth !== null) assert.ok(date - previousBirth >= minimumInterval);
        previousBirth = date;
        births = ctx.state.births;
      }
    }
    assert.ok(births > 0);
  }
});

test('existing pregnancies reserve housing before other couples try conceiving', () => {
  const { ctx, mother, day } = simulation();
  ctx.state.people.push({ ...mother, id: 'second-mother', reproduction: undefined });
  ctx.capacity = () => 4;
  day(5);
  day(9);
  assert.equal(ctx.reservedBirths(), 1);
  assert.equal(ctx.state.people.filter(person => person.reproduction?.pregnancy).length, 1);
});

test('human waiting grows per mother including deceased children; nonhumans keep racial interval',()=>{
 const {ctx,mother}=simulation();
 for(let i=0;i<3;i++)ctx.state.people.push({id:'old'+i,parents:[mother.id],alive:false});
 assert.equal(ctx.reproductionProfile(mother).recoveryDays,144);
 const other={...mother,id:'other'};assert.equal(ctx.reproductionProfile(other).recoveryDays,96);
 for(let i=0;i<12;i++)ctx.state.people.push({id:'more'+i,parents:[mother.id]});
 assert.equal(ctx.reproductionProfile(mother).recoveryDays,240);
 mother.race='elf';delete mother.ancestry;assert.equal(ctx.reproductionProfile(mother).recoveryDays,48);
});

test('imported pregnancy spacing uses the imported genealogy rather than the open campaign',()=>{
 const {ctx,mother}=simulation();const imported=JSON.parse(JSON.stringify(mother));imported.lastBirth=10;delete imported.reproduction;
 const save={day:20,people:[imported,...Array.from({length:4},(_,i)=>({id:'import'+i,parents:[imported.id]}))]};
 ctx.validateReproduction(imported,save);assert.equal(imported.reproduction.recoveryUntil,178);
});
