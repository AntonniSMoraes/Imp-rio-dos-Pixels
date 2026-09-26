import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function setup(){
 const people=[{id:'king',social:8},{id:'lord',social:3,tiles:[1],liege:'king'},{id:'worker',social:0,liege:'lord',job:'wood'}].map(p=>({alive:true,age:25,level:5,job:'idle',attrs:{força:30},...p}));
 const state={day:47,people,king:'king',region:'test',wood:0,iron:0,food:100,gold:0,buildings:{hunt:0}};
 const c=vm.createContext({state,REGIONS:{test:{}},isAdultAge:p=>p.age>=18,log(){}});
 for(const file of ['annual-economy','state-economy'])vm.runInContext(readFileSync(new URL('../js/economy/'+file+'.js',import.meta.url),'utf8'),c);
 c.owner=p=>vm.runInContext(`AnnualEconomy.owner(state.people.find(p=>p.id==='${p}'))`,c);
 return c;
}
test('local production reaches crown only on annual settlement; duplicate day cannot collect twice',()=>{
 const c=setup();c.processEconomyAndTaxes();assert.equal(c.state.wood,0);assert.equal(c.state.people[1].treasury.wood,14);
 c.state.day=48;c.processEconomyAndTaxes();assert.equal(c.state.wood,7);assert.equal(c.state.people[1].treasury.wood,21);
 const snapshot=JSON.stringify(c.state);c.processEconomyAndTaxes();assert.equal(JSON.stringify(c.state),snapshot);
 c.state.day=49;c.processEconomyAndTaxes();assert.equal(c.state.wood,7);
});
test('saved capital is excluded from tribute and food reserve stays local',()=>{
 const c=setup(),lord=c.state.people[1];lord.treasury={wood:100,iron:30,food:5,gold:80};c.processEconomyAndTaxes();
 c.state.day=48;c.processEconomyAndTaxes();assert.equal(c.state.wood,7);assert.equal(lord.treasury.wood,121);assert.equal(lord.lastTribute.food,0);
});
test('landed head feeds from own treasury; landless knight belongs to superior economy',()=>{
 const c=setup();assert.equal(c.owner('lord').id,'lord');c.state.people[1].tiles=[];assert.equal(c.owner('lord').id,'king');
});
test('foreign villages maintain reserves and remit annually to their capital',()=>{
 const c=setup();c.state.warfare={realms:[{id:'realm-0',tiles:[2,3],capital:2}],people:[{id:'foreign',alive:true,age:25,realm:'realm-0',location:3,attrs:{vigor:30}}],raids:[]};
 c.processEconomyAndTaxes();const r=c.state.warfare.realms[0];assert.equal(r.treasury.gold,0);assert.equal(r.villageAccounts[3].treasury.gold,.35);
 c.state.day=48;c.processEconomyAndTaxes();assert.equal(r.treasury.gold,.175);assert.ok(Math.abs(r.villageAccounts[3].treasury.gold-.525)<1e-9);
});
