import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {describeWorld,provinces} from '../js/map-3d/world-data.mjs';
function setup(){
 const state={version:2,day:1,king:'king',region:'central',royalLands:[240,126],people:[{id:'king',alive:true,social:8,family:'Teste'}]};
 const c=vm.createContext({state,TerritoryGeometry:provinces,REGIONS:{central:{seat:240}},alive:()=>state.people,toast(){},log(){},save(){},render(){}});
 vm.runInContext(readFileSync(new URL('../js/territory/realm-territory.js',import.meta.url),'utf8'),c);
 c.capitalSite=async()=>({province:126});return c;
}
test('capital moves and persists without transferring land or people; map follows new seat',async()=>{
 const c=setup(),before=JSON.stringify(c.state);await c.moveCapital(126);
 const restored=JSON.parse(JSON.stringify(c.state));assert.equal(restored.capitalIndex,126);
 delete restored.capitalIndex;assert.equal(JSON.stringify(restored),before);
 const world=describeWorld(c.state);assert.equal(world.seat,126);assert.equal(world.cities[0].point.province,126);
 assert.equal(c.getClusterFromTile(126,1),null);assert.deepEqual([...c.getClusterFromTile(240,1)],[240]);
 assert.equal(describeWorld(restored).seat,240);
});
test('capital rejects unowned, vassal, sea, invalid and unsafe land without mutation',async()=>{
 for(const kind of ['unowned','vassal','sea','invalid','unsafe']){
 const c=setup();let index=126;
 if(kind==='unowned')c.state.royalLands=[240];
 if(kind==='vassal')c.state.people.push({id:'lord',alive:true,social:2,tiles:[126]});
 if(kind==='sea'){index=provinces.all().provinces.find(p=>p.price===null).index;c.state.royalLands.push(index);}
 if(kind==='invalid')index=-1;
 if(kind==='unsafe')c.capitalSite=async()=>null;
 const before=JSON.stringify(c.state);await c.moveCapital(index);assert.equal(JSON.stringify(c.state),before,kind);
 }
});
test('capital transfer rechecks ownership after asynchronous terrain lookup',async()=>{
 const c=setup();c.capitalSite=async()=>{c.state.royalLands=[240];return {province:126};};await c.moveCapital(126);assert.equal(c.state.capitalIndex,undefined);
});
