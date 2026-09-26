import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {setupWorld as setup,geometry} from './helpers/world-engine.mjs';
function frontier(c){for(const r of c.state.warfare.realms)for(const target of r.tiles){const free=geometry.get(target).neighbors.find(i=>geometry.get(i).price!==null&&!c.Warfare.owner(i));if(free!==undefined){c.state.royalLands.push(free);return{r,target};}}throw Error('frontier');}
test('rival initialization is deterministic, connected and never overwrites existing land',()=>{
 const c=setup(),snapshot=JSON.stringify(c.state.warfare);c.Warfare.ensure();assert.equal(JSON.stringify(c.state.warfare),snapshot);assert.equal(c.state.warfare.realms.length,7);const used=new Set([240]);for(const r of c.state.warfare.realms)for(const i of r.tiles){assert.ok(!used.has(i));used.add(i);}assert.equal(JSON.stringify(setup().state.warfare),snapshot);
});
test('war must be declared, troops cannot deploy twice, victory transfers land and releases returning troops',()=>{
 const c=setup(),{r,target}=frontier(c);assert.equal(c.Warfare.mobilize('king',target,['king','soldier']).ok,false);c.Warfare.declare(r.id);assert.equal(c.Warfare.mobilize('king',target,['king','soldier']).ok,true);assert.equal(c.Warfare.deployed('soldier'),true);assert.equal(c.Warfare.mobilize('king',target,['king','soldier']).ok,false);
 for(let day=0;day<20;day++){c.state.day++;c.Warfare.tick();}
 assert.ok(c.state.royalLands.includes(target));assert.ok(!r.tiles.includes(target));assert.equal(c.Warfare.deployed('soldier'),false);assert.ok(c.state.warfare.reports.some(r=>r.text.includes('Vitória')));
});
test('retreat and insufficient supplies never award a province',()=>{
 const c=setup(),{r,target}=frontier(c);c.Warfare.declare(r.id);c.Warfare.mobilize('king',target,['king','soldier']);c.state.food=0;c.Warfare.tick();assert.equal(c.state.warfare.armies[0].status,'return');c.Warfare.tick();assert.equal(c.Warfare.deployed('king'),false);assert.ok(r.tiles.includes(target));
});
test('invalid or unaffordable mobilization is atomic, expedition soldiers are unavailable',()=>{
 const c=setup(),{r,target}=frontier(c);c.Warfare.declare(r.id);c.state.gold=0;let before=JSON.stringify(c.state);assert.equal(c.Warfare.mobilize('king',target,['king','soldier']).ok,false);assert.equal(JSON.stringify(c.state),before);c.state.gold=100;c.state.battle={active:true,party:['soldier']};assert.equal(c.Warfare.mobilize('king',target,['king','soldier']).ok,false);
});
test('war save reload resumes exactly and validation rejects duplicate deployment',()=>{
 const c=setup(),{r,target}=frontier(c);c.Warfare.declare(r.id);c.Warfare.mobilize('king',target,['king','soldier']);vm.runInContext(readFileSync(new URL('../js/war/war-validation.js',import.meta.url),'utf8'),c);const copy=JSON.parse(JSON.stringify(c.state));assert.doesNotThrow(()=>c.validateWarfare(copy));copy.warfare.armies.push({...copy.warfare.armies[0],id:copy.warfare.nextId++});assert.throws(()=>c.validateWarfare(copy));
 const d=setup();d.state.warfare=JSON.parse(JSON.stringify(c.state.warfare));d.state.royalLands=[...c.state.royalLands];for(let i=0;i<4;i++){c.Warfare.tick();d.Warfare.tick();}assert.equal(JSON.stringify(c.state.warfare),JSON.stringify(d.state.warfare));
});

test('starting central realm can reach a rival over land',()=>{
 const c=setup();assert.ok(c.state.warfare.realms.some(r=>c.Warfare.route([240],r.capital,r.id)));
});
test('defeat preserves enemy ownership and cannot claim a province twice',()=>{
 const c=setup(),{r,target}=frontier(c);c.Warfare.declare(r.id);for(const p of c.Societies.garrison(r.id,target))for(const k of Object.keys(p.attrs))p.attrs[k]=1000;for(const p of c.state.people)for(const k of Object.keys(p.attrs))p.attrs[k]=1;c.Warfare.mobilize('king',target,['king','soldier']);for(let i=0;i<15;i++)c.Warfare.tick();assert.ok(r.tiles.includes(target));assert.ok(!c.state.royalLands.includes(target));assert.equal(c.Warfare.deployed('soldier'),false);
});
