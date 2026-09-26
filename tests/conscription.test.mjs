import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(){
 const people=[{id:'king',social:8},{id:'knight',social:2,liege:'king',tiles:[1],treasury:{gold:100,food:100}},{id:'soldier',social:1,liege:'knight',conscripts:{count:3,wounds:0,losses:0,merit:0,recommended:false}}].map(p=>({alive:true,age:25,hp:100,level:5,xp:0,attrs:{força:8,vigor:8,magia:8,agilidade:8},race:'human',ancestry:{human:1},tiles:[],...p}));
 const state={people,day:4,king:'king',promotionSequence:1};let serial=0;
 const c=vm.createContext({state,document:{addEventListener(){}},alive:()=>people.filter(p=>p.alive),byId:id=>people.find(p=>p.id===id),Peerage:{consort:()=>false},direct:p=>people.filter(x=>x.liege===p.id),LORD_CAP:{2:4},capacity:()=>100,onMission:()=>false,makePerson:()=>({id:'recruit-'+(++serial),alive:true,attrs:{},age:22}),log(){},death:p=>{p.alive=false;},TerritoryGeometry:{get:i=>({neighbors:[i-1,i+1]})},adult:p=>p.age>=18,isRoyalFamilyMember:()=>false,AnnualEconomy:{owner:p=>people.find(x=>x.id===p.liege)||people[0]}});
 for(const f of ['war/conscription','war/combatants','kingdom/domain-autonomy'])vm.runInContext(readFileSync(new URL('../js/'+f+'.js',import.meta.url),'utf8'),c);
 c.run=s=>vm.runInContext(s,c);return c;
}
test('squad multiplies strength but losses remove units and overflow reaches its soldier',()=>{
 const c=setup(),soldier=c.state.people[2];const strength=c.run('WarCombat.strength(byId("soldier"))');soldier.conscripts.count=0;assert.equal(strength,c.run('WarCombat.strength(byId("soldier"))')*4);soldier.conscripts.count=3;
 assert.equal(c.run('Conscription.absorb(byId("soldier"),250)'),0);assert.equal(soldier.conscripts.count,1);assert.equal(soldier.conscripts.losses,2);assert.equal(soldier.conscripts.wounds,50);
 assert.equal(c.run('Conscription.absorb(byId("soldier"),80)'),30);assert.equal(soldier.conscripts.count,0);
});
test('capture disbands the squad and recruitment spends knight funds once a day',()=>{
 const c=setup();c.run('Conscription.tick()');assert.equal(c.state.people[2].conscripts.count,4);const gold=c.state.people[1].treasury.gold;c.run('Conscription.tick()');assert.equal(c.state.people[1].treasury.gold,gold);
 c.run('WarCombat.capture([byId("soldier")],"realm-0")');assert.equal(c.state.people[2].conscripts.count,0);assert.equal(c.state.people[2].conscripts.captured,4);
});
test('distinction creates one named soldier only and consumes one conscript',()=>{
 const c=setup();c.state.people[2].conscripts.recommended=true;assert.equal(c.run('Conscription.promote("soldier",true)'),true);assert.equal(c.state.people.length,4);assert.equal(c.state.people[3].liege,'king');assert.equal(c.state.people[2].conscripts.count,2);assert.equal(c.run('Conscription.promote("soldier",true)'),false);
});
test('landed recruiting requires adjacency and a strictly lower title',()=>{
 const c=setup();c.state.people[1].social=4;
 const p={id:'candidate',alive:true,age:25,social:2,tiles:[3]};c.candidate=p;
 assert.equal(c.run('DomainAutonomy.eligible(byId("knight"),candidate)'),false);p.tiles=[2];assert.equal(c.run('DomainAutonomy.eligible(byId("knight"),candidate)'),true);p.social=4;assert.equal(c.run('DomainAutonomy.eligible(byId("knight"),candidate)'),false);
});
