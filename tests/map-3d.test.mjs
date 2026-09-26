import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { tileCoords, tileAt, biomeAt, elevation, heightAt, worldPoint, readCampaign, describeWorld, SAVE_KEY } from '../js/map-3d/world-data.mjs';

test('3D territory coordinates and biomes match all 512 legacy territories', () => {
  const ctx = vm.createContext({ morton: tileCoords });
  vm.runInContext(readFileSync(new URL('../js/territory/realm-territory.js', import.meta.url), 'utf8'), ctx);
  for (let index = 0; index < 512; index++) {
    const { x, y } = tileCoords(index), point = worldPoint(index);
    assert.equal(tileAt(x, y), index);
    assert.ok(Math.abs(elevation(x, y) - ctx.pangeaNoise(x, y)) < 1e-10);
    assert.equal(biomeAt(index), ctx.getTileBiome(index));
    assert.ok(Number.isFinite(heightAt(point.x, point.z)));
  }
  assert.equal(tileAt(-1, 0), -1);
  assert.equal(tileAt(32, 0), -1);
  assert.equal(tileAt(0, 16), -1);
});

test('atlas reads owners and seats without mutating a campaign or storage', () => {
  const save = { version: 2, day: 1181, region: 'north', king: 'king', royalLands: [0, 1, 2], people: [
    { id: 'king', family: 'Coroa', alive: true, social: 8 },
    { id: 'lord', family: '<Casa>', alive: true, social: 3, tiles: [1, 2] },
  ] };
  const original = JSON.stringify(save);
  let reads = 0;
  const loaded = readCampaign({ getItem(key) { assert.equal(key, SAVE_KEY); reads++; return original; } });
  const world = describeWorld(loaded);
  assert.equal(reads, 1);
  assert.equal(world.owners[0].id, 'crown');
  assert.equal(world.owners[1].id, 'lord');
  assert.equal(world.owners[3].id, 'free');
  assert.equal(world.cities[0].index, 0);
  assert.equal(world.cities[1].name, 'Casa <Casa>');
  assert.equal(JSON.stringify(loaded), original);
  assert.equal(describeWorld(null).demo, true);
  assert.equal(readCampaign({ getItem: () => null }), null);
  assert.throws(() => readCampaign({ getItem: () => '{invalid' }));
});

import {settlementSite,SETTLEMENTS,surfaceHeight} from '../js/map-3d/settlements.mjs';
import '../js/territory/provinces.js';
test('single-province settlements are houses with dry footprints inside their own land',()=>{
 for(const index of [0,240,480,489]){
 const site=settlementSite([index]);if(!site)continue;
 assert.ok(['house','cottage','hut'].includes(site.kind));const size=SETTLEMENTS[site.kind];
 for(const dx of [-size.x,0,size.x])for(const dz of [-size.z,0,size.z]){
 assert.ok(surfaceHeight(site.x+dx,site.z+dz)>=.17);
 assert.ok(globalThis.TerritoryGeometry.contains(globalThis.TerritoryGeometry.get(index).polygon,site.x+dx,site.z+dz));
 }
 }
 assert.ok(settlementSite([240]));
 assert.equal(settlementSite([489]),null);
});
test('crown and individual vassals have distinct domain colors',()=>{
 const world=describeWorld({region:'central',king:'king',royalLands:[240,241,242],people:[{id:'king',alive:true,social:8},{id:'lordA',alive:true,social:3,tiles:[241]},{id:'lordB',alive:true,social:3,tiles:[242]}]});
 assert.notEqual(world.owners[240].color,world.owners[241].color);assert.notEqual(world.owners[241].color,world.owners[242].color);
});

test('building tiers grow with land while coastal constraints can require a smaller house',()=>{
 assert.equal(settlementSite([126],1).kind,'house');
 assert.equal(settlementSite([126],4).kind,'manor');
 assert.equal(settlementSite([126],8).kind,'castle');
 const coast=settlementSite([241],1);assert.ok(coast);assert.equal(coast.kind,'cottage');assert.equal(coast.province,241);
});
