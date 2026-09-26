import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../js/territory/provinces.js';
function setup() {
 const calls=[];
 const ctx=vm.createContext({state:{king:'king',region:'central',royalLands:[240,241],gold:100},TerritoryGeometry:globalThis.TerritoryGeometry,REGIONS:{central:{seat:240}},pendingLand:null,editBorderMode:false,selectedBorderNoble:null,selected:null,alive:()=>[],render:()=>calls.push('render'),toast:()=>{},byId:()=>null,LAND_SIZE:{2:1},promotionDialog:(id,tiles)=>calls.push([id,tiles]),getClusterFromTile:()=>[241],save:()=>{},log:()=>{},areTilesConnected:()=>true});
 vm.runInContext(readFileSync(new URL('../js/territory/territory-selection.js',import.meta.url),'utf8'),ctx);return {ctx,calls};
}
test('3D selection opens territory inspector without mutating campaign',()=>{
 const {ctx,calls}=setup(),before=JSON.stringify(ctx.state);ctx.selectTerritory(219);assert.equal(ctx.selected.index,219);assert.equal(calls.length,1);assert.equal(JSON.stringify(ctx.state),before);ctx.selectTerritory(-1);assert.equal(calls.length,1);
});
test('3D promotion clicks are routed to the pending multi-selection',()=>{
 const {ctx,calls}=setup();ctx.pendingLand='noble';ctx.byId=()=>({id:'noble',alive:true,social:1,tiles:[]});ctx.Peerage={chooseMapTile:i=>calls.push(i)};ctx.selectTerritory(241);assert.equal(ctx.pendingLand,'noble');assert.equal(calls[0],241);
});
test('border editing protects the capital and does not charge for existing tiles',()=>{
 const {ctx}=setup();const noble={id:'noble',tiles:[241],social:2};ctx.editBorderMode=true;ctx.selectedBorderNoble='noble';ctx.byId=()=>noble;ctx.selectTerritory(240);ctx.selectTerritory(241);assert.equal(ctx.state.gold,100);assert.deepEqual(noble.tiles,[241]);
});
