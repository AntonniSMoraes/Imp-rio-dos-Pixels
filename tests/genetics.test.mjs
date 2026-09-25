import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ctx = vm.createContext({});
for (const file of ['js/config/races.js', 'js/engine/race-genetics.js']) {
  vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), ctx);
}
const races = vm.runInContext('RACES', ctx);
const active = vm.runInContext('ACTIVE_RACES', ctx);
const plain = value => JSON.parse(JSON.stringify(value));

test('all supported pairs and successive generations keep valid IDs and normalized ancestry', () => {
  for (const first of active) for (const second of active) {
    let child = ctx.inheritRaceData({ id: 'a', race: first }, { id: 'b', race: second });
    for (let generation = 0; generation < 30; generation++) {
      assert.ok(races[child.race]);
      assert.ok(Math.abs(Object.values(child.ancestry).reduce((a, b) => a + b, 0) - 1) < 1e-10);
      assert.deepEqual(plain(ctx.inheritRaceData(child, { race: 'human' }).ancestry), plain(ctx.inheritRaceData({ race: 'human' }, child).ancestry));
      child = ctx.inheritRaceData(child, { id: 'c', race: active[generation % active.length] });
    }
  }
});

test('three generations retain their origins through save/load normalization', () => {
  const first = ctx.inheritRaceData({ race: 'human' }, { race: 'elf' });
  const second = ctx.inheritRaceData(first, { race: 'wolf' });
  const third = ctx.inheritRaceData(second, { race: 'cat' });
  assert.deepEqual(plain(third.ancestry), { human: 0.125, elf: 0.125, wolf: 0.25, cat: 0.5 });
  const loaded = JSON.parse(JSON.stringify(third));
  ctx.ensureRaceData(loaded);
  assert.deepEqual(loaded.ancestry, third.ancestry);
  assert.match(ctx.ancestryLabel(loaded), /50%/);
});

test('legacy half IDs migrate without losing origins; unknown IDs remain recorded', () => {
  const person = { race: 'half-half-wolf' };
  ctx.ensureRaceData(person);
  assert.equal(person.race, 'half-wolf');
  assert.deepEqual(plain(person.ancestry), { human: 0.75, wolf: 0.25 });
  assert.equal(person.legacyRace, 'half-half-wolf');
  const unknown = { race: 'missing-race' };
  ctx.ensureRaceData(unknown);
  assert.equal(unknown.race, 'human');
  assert.equal(unknown.legacyRace, 'missing-race');
  assert.equal(ctx.canBreed('missing', 'human'), false);
  assert.equal(ctx.hybridRace('dragon', 'human'), null);
});

test('attribute inheritance uses both parents and stays within the exact variance bounds', () => {
  const a = { attrs: { força: 10, vigor: 20, magia: 30, agilidade: 40 } };
  const b = { attrs: { força: 30, vigor: 40, magia: 50, agilidade: 60 } };
  for (const roll of [0, 0.5, 0.999999]) {
    const result = ctx.inheritAttributes(a, b, () => roll);
    for (const key in result) {
      const mean = (a.attrs[key] + b.attrs[key]) / 2;
      assert.ok(result[key] >= mean * 0.85 && result[key] <= mean * 1.15);
      if (roll === 0.5) assert.equal(result[key], mean);
    }
  }
});

test('the birth factory applies ancestry and mean-based attributes to the actual child', () => {
  const birth = vm.createContext({ pick: items => items[0] });
  for (const file of ['js/config/races.js', 'js/engine/race-genetics.js', 'js/model/people-model.js']) {
    vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), birth);
  }
  birth.makePerson = options => ({ ...options, attrs: {}, high: ['magia'] });
  birth.inheritGenes = () => ({ genes: {}, origins: {} });
  const parent = { id: 'a', family: 'Teste', race: 'harpy', attrs: { força: 20, vigor: 20, magia: 20, agilidade: 20 } };
  const child = birth.childOf(parent, { ...parent, id: 'b' });
  assert.equal(child.sex, 'F');
  assert.equal(child.age, 0);
  assert.equal(child.ancestry.harpy, 1);
  assert.equal(child.high.length, 0);
  for (const value of Object.values(child.attrs)) assert.ok(value >= 17 && value <= 23);
});
