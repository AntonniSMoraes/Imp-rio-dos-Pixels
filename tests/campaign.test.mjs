import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function engine(files, globals = {}) {
  const context = vm.createContext(globals);
  for (const file of files) vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
  return context;
}

test('48 daily steps equal one calendar year, including the adult birthday', () => {
  const ctx = engine(['js/engine/calendar.js']);
  const person = { age: 17 };
  for (let day = 0; day < 47; day++) ctx.ageOneDay(person);
  assert.equal(ctx.isAdultAge(person), false);
  ctx.ageOneDay(person);
  assert.equal(person.age, 18);
  assert.equal(ctx.isAdultAge(person), true);
  assert.equal(ctx.calendarDate(49).year, 2);
  assert.equal(ctx.calendarDate(49).day, 1);
});

test('XP cannot turn a child into an adult; debut preserves chronological age', () => {
  const messages = [];
  const ctx = engine(['js/engine/calendar.js', 'js/village/game.js'], {
    log: text => messages.push(text), CLASSES: ['Guerreiro'], pick: items => items[0],
  });
  const child = { age: 7, level: 4, xp: 10000 };
  ctx.reveal(child);
  assert.equal(child.age, 7);
  assert.equal(child.level, 4);
  child.age = 18;
  ctx.reveal(child);
  ctx.reveal(child);
  assert.equal(child.age, 18);
  assert.equal(child.level, 5);
  assert.equal(child.xp, 0);
  assert.equal(messages.length, 1);
});

test('older saves normalize underage workers without rewriting ages', () => {
  const ctx = engine(['js/engine/calendar.js']);
  const child = { age: 16, level: 5, job: 'wood', vocation: 'Guerreiro', debut: true };
  ctx.normalizeLifeStage(child);
  assert.equal(child.age, 16);
  assert.equal(child.level, 4);
  assert.equal(child.job, 'idle');
  assert.equal(child.vocation, null);
});

test('daily cycle completes all systems before one save and one render', () => {
  const calls = [];
  const functions = Object.fromEntries(['upgradeKingdom', 'advanceVillageDay', 'birthCycle', 'politicalCycle', 'governmentCycle', 'save', 'render', 'refreshPersonModal'].map(name => [name, () => calls.push(name)]));
  const ctx = engine(['js/engine/daily-cycle.js'], { ...functions, state: {}, alive: () => [{}], speed: 1 });
  ctx.advance();
  assert.deepEqual(calls, Object.keys(functions));
  calls.length = 0;
  ctx.state = null;
  ctx.advance();
  assert.equal(calls.length, 0);
  assert.equal(ctx.speed, 0);
});

test('first recruitment guarantees adult workers and persists its one-time status', () => {
  const state = { day: 1, nextRecruitDay: 1, people: [{ age: 24 }], guests: [], lastRecruit: null, logs: [] };
  const ctx = engine(['js/recruitment/recruitment-system.js'], {
    state, alive: () => state.people, capacity: () => 4,
    makePerson: options => ({ ...options }), save() {}, render() {}, log() {}, toast() {},
  });
  ctx.callRecruitment();
  assert.equal(state.people.length, 3);
  assert.ok(state.people.every(person => person.age >= 18));
  assert.equal(state.lastRecruit.count, 2);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(restored.lastRecruit.day, 1);
  ctx.callRecruitment();
  assert.equal(state.people.length, 3);
});

test('work controls exclude the ruler, minors and another domain; balances keep deficits', () => {
  const state = { king: 'king', people: [
    { id: 'king', alive: true, age: 24, level: 5, job: 'idle' },
    { id: 'worker', alive: true, age: 22, level: 5, job: 'idle' },
    { id: 'child', alive: true, age: 16, level: 5, job: 'idle' },
    { id: 'lord', alive: true, age: 30, level: 5, job: 'food' },
    { id: 'vassal', liege: 'lord', alive: true, age: 22, level: 5, job: 'idle' },
  ] };
  const ctx = engine(['js/engine/calendar.js', 'js/economy/state-economy.js'], { state });
  assert.equal(ctx.workers('idle').length, 1);
  assert.equal(ctx.workers('idle')[0].id, 'worker');
  assert.equal(ctx.rates().iron, 0);
  state.economyBalance = { wood: -2, iron: 0, food: -1.35, gold: 0.7 };
  assert.equal(ctx.rates().food, -1.35);
});
