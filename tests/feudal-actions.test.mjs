import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(){
 const people=[{id:'king',social:8,tiles:[],parents:[],name:'Rei'},{id:'lord',social:4,tiles:[0,1,2,3,4,5,6,7],territory:0,heir:'first',treasury:{gold:500},name:'Visconde',parents:[],liege:'king'},{id:'first',parents:['lord'],social:0},{id:'child',parents:['lord'],social:0,tiles:[],partners:[],name:'Filho'},{id:'royal1',parents:['king'],social:0},{id:'royal2',parents:['king'],social:0},{id:'worker',parents:[],social:0,houseHead:'worker',name:'Aldeão'},{id:'family',parents:['worker'],social:0,houseHead:'worker'}].map(p=>({alive:true,age:25,...p}));
 const state={people,king:'king',day:1,region:'test',royalLands:[0,1,2,3,4,5,6,7,20],gold:500,promotionSequence:1};
 const ctx=vm.createContext({state,document:{addEventListener(){}},TerritoryGeometry:{get:i=>Number.isInteger(i)&&i>=0&&i<512?{price:20}:null},REGIONS:{test:{seat:20}},LAND_SIZE:{2:1,3:4,4:8},LORD_CAP:{2:4,3:4,4:2,8:Infinity},SOCIAL:['Plebeu','Soldado','Cavaleiro','Barão'],byId:id=>state.people.find(p=>p.id===id),alive:()=>state.people.filter(p=>p.alive),adult:p=>p.age>=18,adults:()=>state.people.filter(p=>p.alive&&p.age>=18),onMission:()=>false,isRoyalFamilyMember:p=>p.id==='king'||p.parents.includes('king'),direct:p=>state.people.filter(x=>x.liege===p.id&&x.social>0),chooseHeir:p=>state.people.find(x=>x.id===p.heir),promotionCost:r=>[0,20,80,180][r],areTilesConnected:tiles=>[...tiles].sort((a,b)=>a-b).every((v,i,a)=>!i||v===a[i-1]+1),updateHouseholdLeadership(){},save(){},render(){},log(){},capacity:()=>100,rand:()=>0,makePerson:()=>({id:'new',name:'Novo',social:0,alive:true,parents:[],age:22}),recruitRacialTraveler:p=>p,Math:Object.create(Math)});
 vm.runInContext(readFileSync(new URL('../js/kingdom/feudal-actions.js',import.meta.url),'utf8'),ctx);return ctx;
}
test('viscount grants connected barony to non-heir using only personal land and treasury',()=>{
 const c=setup();assert.equal(c.grantDescendantLand('lord','child',3,[4,5,6,7]).ok,true);
 assert.deepEqual([...c.byId('lord').tiles],[0,1,2,3]);assert.deepEqual([...c.byId('child').tiles],[4,5,6,7]);assert.equal(c.byId('child').liege,'lord');assert.equal(c.byId('lord').treasury.gold,500);assert.equal(c.state.gold,500);
 assert.equal(c.grantDescendantLand('lord','child',3,[4,5,6,7]).ok,false);
});
test('grants reject heir, capital, insufficient land, superior title atomically',()=>{
 for(const [child,rank,tiles,gold] of [['first',2,[7],500],['child',3,[0,1,2,3],500],['child',3,[7],500],['child',4,[4,5,6,7],500]]){
 const c=setup();c.byId('lord').treasury.gold=gold;const before=JSON.stringify(c.state);assert.equal(c.grantDescendantLand('lord',child,rank,tiles).ok,false);assert.equal(JSON.stringify(c.state),before);
 }
});
test('king can repeatedly designate adult descendant; manual selection survives serialization',()=>{
 const c=setup();assert.equal(c.nominateRoyalHeir('royal1'),true);assert.equal(c.nominateRoyalHeir('royal2'),true);assert.equal(c.nominateRoyalHeir('worker'),false);assert.equal(c.manualHeirOf(c.byId('king')).id,'royal2');
 const saved=JSON.parse(JSON.stringify(c.state));assert.equal(saved.people[0].manualHeir,true);assert.equal(saved.people[0].heir,'royal2');c.byId('royal2').alive=false;assert.equal(c.manualHeirOf(c.byId('king')),null);
});
test('internal recruitment transfers a family once per day without creating people',()=>{
 const c=setup(),count=c.state.people.length;assert.equal(c.nobleRecruit('lord','worker').ok,true);assert.equal(c.byId('worker').liege,'lord');assert.equal(c.byId('family').liege,'lord');assert.equal(c.state.people.length,count);assert.equal(c.nobleRecruit('lord','worker').ok,false);
});
test('external recruitment spends noble funds, observes cooldown and capacity',()=>{
 const c=setup();c.Math.random=()=>.8;assert.equal(c.nobleRecruit('lord',null).ok,true);assert.equal(c.byId('new').liege,'lord');assert.equal(c.byId('lord').treasury.gold,490);assert.equal(c.state.gold,500);assert.equal(c.nobleRecruit('lord',null).ok,false);
 const d=setup();d.capacity=()=>0;assert.equal(d.nobleRecruit('lord',null).ok,false);assert.equal(d.byId('lord').treasury.gold,500);
});

test('manual designation overrides automatic candidate ranking and can designate a minor',()=>{
 const c=setup();c.byId('royal2').age=5;assert.equal(c.nominateRoyalHeir('royal2'),true);
 const source=readFileSync(new URL('../js/kingdom/kingdom.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('function chooseHeir(p)'),source.indexOf('function succession(p)')),c);
 c.byId('royal1').rank=4;c.byId('royal2').rank=0;
 assert.equal(c.chooseHeir(c.byId('king')).id,'royal2');c.evaluateHeirReplacement(c.byId('king'),c.byId('royal1'));assert.equal(c.byId('king').heir,'royal2');
});
test('succession retains previous land and treasury and never chooses a dead designated heir',()=>{
 const c=setup();const source=readFileSync(new URL('../js/kingdom/kingdom.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('function chooseHeir(p)'),source.indexOf('const oldDeath = death;')),c);
 c.title=()=> 'Visconde';c.byId('first').tiles=[8];c.byId('first').treasury={gold:20};
 assert.equal(c.succession(c.byId('lord')),true);assert.equal(c.byId('first').treasury.gold,520);assert.equal(c.byId('lord').treasury.gold,0);assert.equal(c.byId('first').tiles.length,9);
});

 test('king grants a knightly estate to a secondary heir without spending vassal funds',()=>{
 const c=setup();c.state.royalLands.push(21,22);c.nominateRoyalHeir('royal1');const result=c.grantDescendantLand('king','royal2',2,[22]);assert.equal(result.ok,true);assert.equal(c.byId('royal2').liege,'king');assert.equal(c.state.gold,500);assert.equal(c.byId('lord').treasury.gold,500);
 });
 test('dead designated heir is replaced by a living descendant on succession',()=>{
 const c=setup();const source=readFileSync(new URL('../js/kingdom/kingdom.js',import.meta.url),'utf8');vm.runInContext(source.slice(source.indexOf('function chooseHeir(p)'),source.indexOf('const oldDeath = death;')),c);c.title=()=> 'Visconde';c.byId('first').alive=false;assert.equal(c.succession(c.byId('lord')),true);assert.equal(c.byId('child').social,4);assert.equal(c.byId('first').social,0);
 });
 test('feudal income is conserved and daily taxation does not drain saved reserves',()=>{
 const c=setup();c.isAdultAge=p=>p.age>=18;for(const p of c.state.people){p.level=5;p.job='idle';}c.state.buildings={home:0,hunt:0};c.state.wood=0;c.state.iron=0;c.state.food=0;c.byId('worker').liege='lord';c.byId('family').liege='lord';
 vm.runInContext(readFileSync(new URL('../js/economy/annual-economy.js',import.meta.url),'utf8'),c);
 vm.runInContext(readFileSync(new URL('../js/economy/state-economy.js',import.meta.url),'utf8'),c);
 const total=()=>c.state.gold+c.state.people.reduce((sum,p)=>sum+(p.treasury?.gold||0),0),before=total();
 c.processEconomyAndTaxes();assert.ok(c.byId('lord').treasury.gold>500);assert.ok(Math.abs(total()-before-c.adults().length*.35)<1e-8);
 });
