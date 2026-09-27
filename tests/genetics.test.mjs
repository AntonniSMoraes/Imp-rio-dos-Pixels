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

test('birth record survives training and save/load without sharing parental attribute objects',()=>{
 const a={id:'a',race:'human',attrs:{força:20,vigor:30,magia:40,agilidade:50}};
 const b={id:'b',race:'elf',attrs:{força:40,vigor:50,magia:60,agilidade:70}};
 const attrs=ctx.inheritAttributes(a,b,()=>.5),record=ctx.inheritanceRecord(a,b,attrs);
 a.attrs.força=999;attrs.força=500;
 const loaded=JSON.parse(JSON.stringify(record));assert.equal(ctx.validInheritanceRecord(loaded),true);
 const rows=ctx.inheritedAttributeRows({inheritance:loaded});assert.equal(rows[0].birth,30);assert.equal(rows[0].mean,30);assert.equal(rows[0].variation,0);
 loaded.attributes.força=999;assert.equal(ctx.validInheritanceRecord(loaded),false);
});

test('invalid historical records are rejected rather than inventing ancestral evidence',()=>{
 assert.equal(ctx.validInheritanceRecord(undefined),false);
 const p={id:'p',race:'human',attrs:{força:10,vigor:10,magia:10,agilidade:10}};
 const record=ctx.inheritanceRecord(p,{...p,id:'q'},p.attrs);
 for(const mutate of [r=>r.parents[0].ancestry.human=-1,r=>r.parents[0].attributes.magia=NaN,r=>r.parents[1].id='p',r=>r.version=9]) {
  const copy=plain(record);mutate(copy);assert.equal(ctx.validInheritanceRecord(copy),false);
 }
 assert.deepEqual(plain(ctx.inheritedAttributeRows({attrs:p.attrs})),[]);
});

test('heritage panel preserves hidden potential and reports parent contributions',()=>{
 const ui=vm.createContext({state:{people:[{id:'a',name:'A',family:'Casa'},{id:'b',name:'B',family:'Casa'}]},esc:s=>String(s)});
 for(const file of ['js/config/races.js','js/engine/race-genetics.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ui);
 const source=readFileSync(new URL('../js/village/village-views.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('function inheritanceRows('),source.indexOf('function personPanel(')),ui);
 const a={id:'a',race:'elf',attrs:{força:20,vigor:20,magia:20,agilidade:20}},b={...a,id:'b',race:'human'};
 const person={level:1,inheritance:ui.inheritanceRecord(a,b,a.attrs)};
 let html=ui.inheritanceRows(person);assert.match(html,/50%/);assert.match(html,/ocultos/);assert.ok(!html.includes('Média parental'));
 person.level=5;html=ui.inheritanceRows(person);assert.match(html,/Média parental: 20.0/);assert.match(html,/Registro permanente/);
 assert.match(ui.inheritanceRows({}),/Sem registro/);
});

test('pure elf caste uses the two percent boundary and applies bonuses exactly once',()=>{
 const fresh=()=>({race:'elf',attrs:{força:20,vigor:20,magia:20,agilidade:20},genes:{skin:3,hair:0},origins:{skin:'a',hair:'b'}});
 const high=fresh();ctx.expressBirthBiology(high,[],()=>.01999);
 assert.equal(high.biologicalCaste,'highElf');assert.equal(high.attrs.magia,30);assert.equal(high.attrs.agilidade,24);
 assert.equal(high.genes.hair,4);assert.equal(high.genes.skin,0);assert.equal(high.origins.hair,undefined);
 const saved=plain(high);ctx.expressBirthBiology(saved,[],()=>0);assert.deepEqual(saved,plain(high));assert.equal(ctx.validBiology(saved),true);
 const common=fresh();ctx.expressBirthBiology(common,[],()=>.02);assert.equal(common.biologicalCaste,null);assert.equal(common.genes.hair,2);
 const mixed=fresh();mixed.ancestry={elf:.5,human:.5};ctx.expressBirthBiology(mixed,[],()=>0);assert.equal(mixed.biologicalCaste,null);assert.equal(mixed.genes.hair,0);
});

test('caste does not compound across fifty generations and training remains inheritable',()=>{
 let parent={id:'a',race:'elf',attrs:{força:20,vigor:20,magia:20,agilidade:20}};
 ctx.expressBirthBiology(parent,[],()=>0);
 for(let i=0;i<50;i++) {
  const mate={...plain(parent),id:'mate-'+i};
  const child={id:'child-'+i,...ctx.inheritRaceData(parent,mate),attrs:ctx.inheritAttributes(parent,mate,()=>.5)};
  child.inheritance=ctx.inheritanceRecord(parent,mate,child.attrs);
  ctx.expressBirthBiology(child,[],()=>0);
  assert.equal(child.attrs.magia,30);assert.equal(child.attrs.agilidade,24);assert.equal(ctx.validInheritanceRecord(child.inheritance),true);
  parent=plain(child);
 }
 parent.attrs.magia+=4;assert.equal(ctx.geneticAttributes(parent).magia,24);
});

test('physical expression is deterministic for hybrids and pure dark elves keep dark skin',()=>{
 const p={race:'human',ancestry:{harpy:.25,lamia:.75}};
 assert.equal(ctx.physicalExpression(p).lineage,'lamia');assert.ok(!ctx.physicalExpression(p).features.includes('asas'));
 assert.deepEqual(plain(ctx.physicalExpression(p)),plain(ctx.physicalExpression(JSON.parse(JSON.stringify(p)))));
 const dark={race:'darkElf',attrs:{força:20,vigor:20,magia:20,agilidade:20},genes:{skin:0,hair:0},origins:{skin:'a'}};
 ctx.expressBirthBiology(dark,[],()=>0);assert.equal(dark.genes.skin,3);assert.equal(dark.biologicalCaste,null);
 assert.equal(ctx.physicalExpression({race:'kobold'}).features.includes('anatomia bípede'),true);
});

test('biology validation rejects malformed bonuses and preserves legacy people',()=>{
 assert.equal(ctx.validBiology({race:'human'}),true);
 const p={race:'elf',attrs:{força:20,vigor:20,magia:20,agilidade:20}};ctx.expressBirthBiology(p,[],()=>0);
 for(const mutate of [x=>x.casteBonus.magia=Infinity,x=>x.casteBonus.força=5,x=>x.race='human',x=>x.biologicalCaste='grandDuke',x=>x.biologyVersion=2]) {
  const copy=plain(p);mutate(copy);assert.equal(ctx.validBiology(copy),false);
 }
});
