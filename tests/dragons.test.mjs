import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(){
 const state={day:1,king:'king',capitalIndex:1,region:'test',wood:100,iron:100,food:100,gold:100,people:[]};
 const math=Object.create(Math);math.random=()=>0;
 const c=vm.createContext({state,Math:math,REGIONS:{test:{seat:1}},TerritoryGeometry:{all:()=>({provinces:[{index:1,price:10}]}),get:()=>({price:10,neighbors:[2]})},getTileBiome:()=> 'mina',Warfare:{owner:()=>null},alive:()=>state.people,log(){}});
 vm.runInContext(readFileSync(new URL('../js/war/dragons.js',import.meta.url),'utf8'),c);c.tick=()=>vm.runInContext('Dragons.tick()',c);return c;
}
test('dragon warns before localized damage and cannot devastate repeatedly in one stay',()=>{
 const c=setup();c.tick();c.state.day=17;c.tick();assert.equal(c.state.dragons[0].warning,21);assert.equal(c.state.gold,100);
 c.state.day=21;c.tick();assert.equal(c.state.gold,50);assert.equal(c.state.dragonRuins[1],69);c.state.day=22;c.tick();assert.equal(c.state.gold,50);
 c.state.day=69;c.tick();assert.equal(c.state.dragonRuins[1],undefined);
});
test('broods respect four-dragon cap and never enter character population',()=>{
 const c=setup();c.tick();c.Math.random=()=>.05;c.state.day=17;c.tick();assert.equal(c.state.dragons.length,2);
 c.state.dragons.push({...c.state.dragons[0],id:3},{...c.state.dragons[0],id:4});c.state.dragons[0].brood=false;c.state.day=18;c.tick();assert.equal(c.state.dragons.length,4);assert.equal(c.state.people.length,0);
});
