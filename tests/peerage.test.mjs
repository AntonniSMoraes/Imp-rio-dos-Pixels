import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function setup(){
 const people=[{id:'king',social:8},{id:'lord',social:4,tiles:[1,2,3,4,5,6,7,8],territory:1,liege:'king'},{id:'spouse',social:3,unionHead:'lord',tiles:[9],liege:'king',treasury:{gold:100},partners:[{id:'lord',role:'consorte'}]},{id:'concubine',social:0,unionHead:'lord',liege:'lord',partners:[{id:'lord',role:'concubina'}]},{id:'soldier',social:1,liege:'lord',job:'train'}].map(p=>({alive:true,age:25,level:5,tiles:[],parents:[],partners:[],job:'idle',treasury:{wood:0,iron:0,food:0,gold:0},...p}));
 people[1].partners=[{id:'spouse',role:'consorte'},{id:'concubine',role:'concubina'}];
 const state={day:1,people,king:'king',royalLands:Array.from({length:20},(_,i)=>i),capitalIndex:0,region:'test',wood:100,iron:100,food:100,gold:100,promotionSequence:1};
 const c=vm.createContext({state,document:{addEventListener(){}},REGIONS:{test:{seat:0}},LAND_SIZE:{2:1,3:4,4:8,5:16,6:32,7:128},LORD_CAP:{4:4,8:100},SOCIAL:[],adult:p=>p?.alive&&p.age>=18,alive:()=>people.filter(p=>p.alive),adults:()=>people.filter(p=>p.alive&&p.age>=18),byId:id=>people.find(p=>p.id===id),TerritoryGeometry:{get:i=>({price:10,neighbors:[i-1,i+1].filter(n=>n>=0&&n<20)})},areTilesConnected:a=>[...a].sort((a,b)=>a-b).every((v,i,a)=>!i||v===a[i-1]+1),direct:p=>people.filter(x=>x.liege===p.id),chooseHeir:()=>null,onMission:()=>false,log(){},save(){},render(){},updateHouseholdLeadership(){},Math:Object.create(Math)});
 for(const f of ['peerage','feudal-actions','noble-development'])vm.runInContext(readFileSync(new URL('../js/kingdom/'+f+'.js',import.meta.url),'utf8'),c);
 c.run=s=>vm.runInContext(s,c);return c;
}
test('main consort merges estate and savings once; concubine stays eligible',()=>{
 const c=setup();c.run('Peerage.reconcile()');assert.equal(c.byId('lord').treasury.gold,100);assert.equal(c.byId('spouse').liege,null);assert.equal(c.byId('spouse').tiles.length,0);
 c.run('Peerage.reconcile()');assert.equal(c.byId('lord').treasury.gold,100);
 assert.equal(c.run("Peerage.grant(byId('spouse'),[10,11,12,13],4)"),false);
 assert.equal(c.grantDescendantLand('lord','concubine',2,[9]).ok,true);assert.equal(c.byId('concubine').unionHead,null);assert.equal(c.byId('concubine').liege,'lord');
});
test('promotion charges recipient only and rejects occupied land atomically',()=>{
 const c=setup();c.byId('soldier').treasury.gold=20;
 assert.equal(c.run("Peerage.grant(byId('soldier'),[2],2,{gold:10})"),false);assert.equal(c.state.gold,100);
 assert.equal(c.run("Peerage.grant(byId('soldier'),[10],2,{gold:10})"),true);assert.equal(c.state.gold,110);assert.equal(c.byId('soldier').treasury.gold,10);
});
test('pending promotion waits for savings then collects fee exactly once',()=>{
 const c=setup();assert.equal(c.run("Peerage.request(byId('soldier'),2,[10],{gold:10})"),true);c.run('Peerage.tick()');assert.equal(c.byId('soldier').social,1);
 c.byId('soldier').treasury.gold=10;c.state.day++;c.run('Peerage.tick()');assert.equal(c.byId('soldier').social,2);assert.equal(c.state.gold,110);assert.equal(c.byId('soldier').promotionRequest,undefined);
});
test('knighthood requires 48 training days and a low chance; idle days do not count',()=>{
 const c=setup();c.Math.random=()=>0;c.byId('soldier').job='idle';for(let i=1;i<=48;i++){c.state.day=i;c.run('Peerage.tick()');}assert.equal(c.byId('soldier').social,1);
 c.byId('soldier').job='train';for(let i=49;i<=95;i++){c.state.day=i;c.run('Peerage.tick()');}assert.equal(c.byId('soldier').social,1);c.state.day=96;c.run('Peerage.tick()');assert.equal(c.byId('soldier').social,2);assert.equal(c.byId('soldier').tiles.length,0);
});
test('automatic grant preserves seat and connected retained domain',()=>{
 const c=setup();const tiles=c.run("NobleDevelopment.allocate(byId('lord'),byId('soldier'),3)");assert.deepEqual([...tiles].sort((a,b)=>a-b),[5,6,7,8]);
 assert.equal(c.grantDescendantLand('lord','soldier',3,[...tiles]).ok,true);assert.deepEqual([...c.byId('lord').tiles],[1,2,3,4]);
});

test('map selection preserves chosen title and charges, protects capital and requires connected land',()=>{
 const c=setup();c.pendingLand=null;c.editBorderMode=true;c.modalPerson='soldier';c.view='people';c.toast=()=>{};
 const fields={'#peerage-tier':{value:'3'},'#promotion-land-cluster':{value:'10,11,12,13'},'#modal':{close(){}}};
 for(const k of ['wood','iron','food','gold'])fields['#peerage-fee-'+k]={value:k==='gold'?'25':'0'};
 c.document.querySelector=id=>fields[id];c.getAvailableConnectedClusters=()=>[[10,11,12,13]];c.modal=(title,html)=>{c.html=html;};
 c.run("Peerage.startMap('soldier')");assert.equal(c.pendingLand,'soldier');assert.equal(c.editBorderMode,false);
 c.run('Peerage.chooseMapTile(0);Peerage.chooseMapTile(1)');assert.equal(c.run('Peerage.mapSelection()'),'');
 c.run('Peerage.chooseMapTile(10);Peerage.chooseMapTile(11);Peerage.chooseMapTile(12);Peerage.chooseMapTile(14);Peerage.finishMap()');assert.equal(c.pendingLand,'soldier');
 c.run('Peerage.chooseMapTile(14);Peerage.chooseMapTile(13);Peerage.finishMap()');assert.equal(c.pendingLand,null);
 assert.match(c.html,/value="3" selected/);assert.match(c.html,/id="peerage-fee-gold"[^>]*value="25"/);assert.match(c.html,/value="10,11,12,13"/);
});
