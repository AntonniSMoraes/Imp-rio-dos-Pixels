import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../js/territory/provinces.js';
const g=globalThis.TerritoryGeometry, {provinces,edges}=g.all();
test('irregular provinces partition the map and share symmetric edges',()=>{
 assert.ok(Math.abs(provinces.reduce((n,p)=>n+p.area,0)-8192)<1e-6);
 assert.ok(Math.max(...provinces.map(p=>p.area))/Math.min(...provinces.map(p=>p.area))>3);
 for(const p of provinces){assert.equal(g.locate(...p.center),p.index);for(const n of p.neighbors)assert.ok(g.get(n).neighbors.includes(p.index));}
 assert.ok(edges.every(e=>e.owners.length===1||e.owners.length===2));
 for(let x=-63.83;x<64;x+=2.17)for(let z=-31.79;z<32;z+=2.13)assert.equal(provinces.filter(p=>g.contains(p.polygon,x,z)).length,1);
});
test('valuation uses actual land, with no purchase of open sea',()=>{
 for(const p of provinces){assert.ok(p.landArea>=0&&p.landArea<=p.area+1e-9);assert.equal(p.price,p.landArea<.5?null:Math.max(5,Math.round(p.landArea*3*p.valuePerArea)));}
 assert.ok(new Set(provinces.map(p=>p.price)).size>20);
});
test('annexation charges quoted price once and rejects invalid, occupied and unaffordable land',()=>{
 const p=provinces.find(p=>p.price>5),sea=provinces.find(p=>p.price===null);
 const ctx=vm.createContext({TerritoryGeometry:g,state:{gold:100,royalLands:[],king:'king'},alive:()=>[],toast:()=>{},log:()=>{},save:()=>{},render:()=>{}});
 vm.runInContext(readFileSync(new URL('../js/territory/realm-territory.js',import.meta.url),'utf8'),ctx);
 ctx.buyLand(p.index);assert.equal(ctx.state.gold,100-p.price);assert.deepEqual([...ctx.state.royalLands],[p.index]);
 ctx.buyLand(p.index);ctx.buyLand(-1);ctx.buyLand(sea.index);assert.equal(ctx.state.gold,100-p.price);
 const other=provinces.find(q=>q.price&&q.index!==p.index);ctx.state.gold=0;ctx.buyLand(other.index);assert.equal(ctx.state.royalLands.length,1);
 ctx.state.gold=100;ctx.alive=()=>[{id:'lord',social:2,tiles:[other.index]}];ctx.buyLand(other.index);assert.equal(ctx.state.gold,100);
});
