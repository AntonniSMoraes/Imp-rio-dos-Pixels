import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

function engine(){
 const math=Object.create(Math);let seed=1837;math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const c=vm.createContext({Math:math,crypto:webcrypto,structuredClone,window:{addEventListener(){}},document:{addEventListener(){},querySelector(){return null;}},localStorage:{getItem(){return null;},setItem(){}},render(){},dynastyView(){return '';},traitRows(){return '';},jobSelect(){return '';},refreshPersonModal(){},setTimeout(){},clearTimeout(){}});
 for(const f of ['config/names','config/config','config/races','core/utils','engine/race-genetics','engine/calendar','engine/reproduction','model/people-model','model/people-relations','economy/annual-economy','economy/state-economy','war/war-validation','core/save-validation','recruitment/recruitment-system','combat/battle-system','village/game-state','village/game','territory/provinces','territory/realm-territory','kingdom/peerage','kingdom/noble-development','kingdom/domain-autonomy','war/conscription','kingdom/feudal-actions','war/dragons','war/combatants','war/world-societies','war/frontier-ai','war/warfare','kingdom/betrothals','kingdom/kingdom','engine/daily-cycle']){
  vm.runInContext(readFileSync(new URL('../js/'+f+'.js',import.meta.url),'utf8'),c,{filename:f});
 }
 vm.runInContext(`render=()=>{};refreshPersonModal=()=>{};state=initial('central','Teste','Integração');state.food=10000;state.gold=10000;state.wood=10000;state.buildings.fire=1;state.buildings.home=20;upgradeKingdom();`,c);
 c.run=s=>vm.runInContext(s,c);return c;
}
test('complete campaign survives five annual settlements and save reloads',()=>{
 const c=engine();
 c.run(`const king=byId(state.king);const worker=makePerson({age:24});worker.job='food';worker.liege=state.king;worker.houseHead=worker.id;state.people.push(worker);`);
 for(let i=0;i<240;i++){
  c.run('advance()');
  if(i%24===23)c.run('{const snapshot=JSON.parse(JSON.stringify(state));validateSave(snapshot);state=snapshot;}');
 }
 assert.equal(c.run('state.day'),241);assert.equal(c.run('state.lastAnnualTribute.day'),240);
 assert.ok(c.run('state.dragons.length>=1 && state.dragons.length<=4'));
 assert.ok(c.run('state.warfare.realms.every(r=>Number.isFinite(r.treasury.gold))'));
});

test('landed household merges spouses, pays annual tribute and keeps a pending fee across reload',()=>{
 const c=engine();
 c.run(`state.royalLands=[...new Set([...state.royalLands,...TerritoryGeometry.all().provinces.filter(p=>p.price!==null&&!Warfare.owner(p.index)).map(p=>p.index)])];
 const lord=makePerson({age:30});lord.houseHead=lord.id;state.people.push(lord);
 const cluster=getAvailableConnectedClusters(4,lord)[0];
 if(!Peerage.grant(lord,cluster,3))throw Error('Grant failed');
 const spouse=makePerson({age:28,sex:lord.sex==='M'?'F':'M'});spouse.social=2;spouse.tiles=[];spouse.treasury={wood:4,iron:3,food:200,gold:50};spouse.unionHead=lord.id;spouse.houseHead=lord.id;spouse.liege=state.king;spouse.partners=[{id:lord.id,role:'consorte'}];lord.partners=[{id:spouse.id,role:'consorte'}];state.people.push(spouse);
 upgradeKingdom();lord.order='food';lord.job='food';spouse.job='food';
 Peerage.request(lord,4,getAvailableConnectedClusters(8,lord)[0],{gold:99999});`);
 for(let i=0;i<48;i++)c.run('advance()');
 c.run('{const snapshot=JSON.parse(JSON.stringify(state));validateSave(snapshot);state=snapshot;}');
 assert.equal(c.run('state.people.find(p=>p.id===spouse.id).liege'),null);
 assert.equal(c.run('state.people.find(p=>p.id===lord.id).promotionRequest.fee.gold'),99999);
 assert.equal(c.run('state.people.find(p=>p.id===lord.id).lastTribute.day'),48);
 assert.equal(c.run('direct(byId(state.king)).filter(p=>p.id===spouse.id).length'),0);
});

test('knightly domain recruits and provisions hidden squads without royal orders',()=>{
 const c=engine();c.run(`state.royalLands=[...new Set([...state.royalLands,...TerritoryGeometry.all().provinces.filter(p=>p.price!==null&&!Warfare.owner(p.index)).map(p=>p.index)])];
 const knight=makePerson({age:25});knight.houseHead=knight.id;state.people.push(knight);Peerage.grant(knight,getAvailableConnectedClusters(1,knight)[0],2);knight.treasury={wood:100,iron:100,food:2000,gold:1000};knight.order='idle';`);
 for(let i=0;i<48;i++)c.run('advance()');
 assert.ok(c.run('direct(knight).length>0'));
 assert.ok(c.run('direct(knight).some(p=>Conscription.count(p)>0)'));
 assert.ok(c.run('direct(knight).every(p=>Conscription.count(p)<=10&&!DomainAutonomy.visible(p))'));
 assert.ok(c.run("knight.job!=='idle'"));
 c.run('validateSave(JSON.parse(JSON.stringify(state)))');
});
