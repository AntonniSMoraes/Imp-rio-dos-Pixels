import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../js/territory/provinces.js';
const geometry=globalThis.TerritoryGeometry;
function setup(){
 const state={day:1,region:'central',king:'king',royalLands:[240],people:[{id:'king',name:'Rei',social:8,age:24,hp:100,alive:true,tiles:[]},{id:'soldier',name:'Guarda',social:1,age:24,hp:100,alive:true,tiles:[]}],buildings:{barracks:1},gold:500,food:500};
 const c=vm.createContext({state,TerritoryGeometry:geometry,alive:()=>state.people.filter(p=>p.alive),adult:p=>p.age>=18,byId:id=>state.people.find(p=>p.id===id),domainPeople:()=>state.people,personalLands:p=>p.tiles,log(){},power:()=>100,death:p=>{p.alive=false;}});
 vm.runInContext(readFileSync(new URL('../js/war/warfare.js',import.meta.url),'utf8'),c);c.onMission=p=>c.Warfare.deployed(p.id)||Boolean(state.battle?.active&&state.battle.party.includes(p.id));c.Warfare.ensure();return c;
}
function frontier(c){for(const r of c.state.warfare.realms)for(const target of r.tiles){const free=geometry.get(target).neighbors.find(i=>geometry.get(i).price!==null&&!c.Warfare.owner(i));if(free!==undefined){c.state.royalLands.push(free);return{r,target};}}throw Error('frontier');}
test('rival initialization is deterministic, connected and never overwrites existing land',()=>{
 const c=setup(),snapshot=JSON.stringify(c.state.warfare);c.Warfare.ensure();assert.equal(JSON.stringify(c.state.warfare),snapshot);assert.equal(c.state.warfare.realms.length,3);const used=new Set([240]);for(const r of c.state.warfare.realms)for(const i of r.tiles){assert.ok(!used.has(i));used.add(i);}assert.equal(JSON.stringify(setup().state.warfare),snapshot);
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
 const c=setup(),{r,target}=frontier(c);c.Warfare.declare(r.id);r.garrisons[target]=1000;c.power=()=>1;c.Warfare.mobilize('king',target,['king','soldier']);for(let i=0;i<15;i++)c.Warfare.tick();assert.ok(r.tiles.includes(target));assert.ok(!c.state.royalLands.includes(target));assert.equal(c.Warfare.deployed('soldier'),false);
});
