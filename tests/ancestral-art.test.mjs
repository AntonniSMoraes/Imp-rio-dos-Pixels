import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
function setup(){
 const c=vm.createContext({});
 for(const f of ['config/config','config/races','engine/race-genetics','config/race-assets','art/art-state','art/art-palette','art/legacy-composition','art/art'])vm.runInContext(read('js/'+f+'.js'),c);
 return c;
}
test('human-beast ancestry selects full, intermediate and human bodies at explicit thresholds',()=>{
 const c=setup();
 for(const race of ['wolf','cat','bunny'])for(const [share,expected] of [[.125,'human'],[.249,'human'],[.25,'half-'+race],[.5,'half-'+race],[.75,'half-'+race],[.751,race],[1,race]]){
  const p={race:'half-'+race,ancestry:{human:1-share,[race]:share},genes:{hair:3,skin:2,eyes:4}};
  const before=JSON.stringify(p),profile=c.characterArtProfile(p);
  assert.equal(profile.race,expected);assert.ok(existsSync(new URL('../'+profile.asset,import.meta.url)));assert.equal(JSON.stringify(p),before);
 }
});
test('multiple origins use one reproducible anatomical model, independent of ancestry key order',()=>{
 const c=setup();
 const a=c.characterArtProfile({ancestry:{lamia:.5,harpy:.25,human:.25}});
 const b=c.characterArtProfile({ancestry:{human:.25,harpy:.25,lamia:.5}});
 assert.equal(a.race,'lamia');assert.equal(a.race,b.race);assert.ok(!a.physical.features.includes('asas'));
});
test('body and portrait compose the same ancestral atlas, with safe loading fallback and cache separation',()=>{
 const c=setup(),calls=[];let urls=0;
 const tile={w:1,h:1,data:new Uint8ClampedArray([255,0,255,255]),hair:[0],skin:[],eyes:[],face:{x:0,y:0,w:1,h:1,eyeY:0}};
 c.document={createElement:()=>({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){},createLinearGradient:()=>({addColorStop(){}}),fillRect(){},drawImage(){}}),toDataURL:()=>String(++urls)})};
 c.prepareAnimeTile=(row,col,atlas,key)=>{calls.push({row,key});return tile;};
 c.prepareRankTile=()=>{calls.push({key:'rank'});return tile;};
 vm.runInContext("animeAtlas={};raceAtlases.set('human',animeAtlas);raceAtlases.set('half-wolf',{});rankAtlas={};",c);
 const p={race:'half-wolf',ancestry:{human:.5,wolf:.5},genes:{hair:2,skin:0,eyes:0,style:0},sex:'F',level:5,age:25,rank:0};
 c.renderArtURL(p);c.renderArtURL(p,true);assert.deepEqual(calls.map(x=>x.key),['half-wolf','half-wolf']);assert.equal(calls[0].row,1);
 p.ancestry={human:.875,wolf:.125};c.renderArtURL(p,true);assert.equal(calls.at(-1).key,'rank');
 p.ancestry={elf:1};c.composedAnime(p);assert.equal(calls.at(-1).key,'rank');
 vm.runInContext("raceAtlases.set('elf',{});",c);c.composedAnime(p);assert.equal(calls.at(-1).key,'elf');
});

test('complexion normalizes source shading without double-darkening or touching other pixels',()=>{
 const c=setup();
 function run(offset,palette){
  const data=new Uint8ClampedArray([100+offset,80+offset,60+offset,255,120+offset,100+offset,80+offset,255,140+offset,120+offset,100+offset,255,12,15,18,190]);
  const destination=new Uint8ClampedArray(data);c.recolorComplexion({w:4,h:1,data,skin:[0,4,8]},destination,palette);
  assert.deepEqual(Array.from(destination.slice(12)),[12,15,18,190]);assert.equal(destination[3],255);
  assert.ok(destination[0]<destination[4] && destination[4]<destination[8]);return destination;
 }
 const palette=['Escura','#704a3e','#926452','#4b3430'];
 const dark=run(0,palette),light=run(60,palette);
 // Internal pixels have identical local shading despite a different source complexion.
 assert.deepEqual(Array.from(dark.slice(4,8)),Array.from(light.slice(4,8)));
 const pale=run(60,['Clara','#e6b795','#f7d1ac','#b77e69']);assert.ok(pale[4]>dark[4]);assert.ok(pale[0]<pale[8]);
});
