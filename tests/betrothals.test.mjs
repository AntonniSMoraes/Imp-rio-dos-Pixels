import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
function setup(){
 const state={day:1,king:'king',people:[{id:'king',social:8,age:40},{id:'lord',social:3,age:40},{id:'other',social:2,age:40},{id:'a',sex:'M',age:16,parents:['king']},{id:'b',sex:'F',age:17,parents:['lord']},{id:'c',sex:'M',age:16,parents:['other']},{id:'d',sex:'F',age:16,parents:['other']}].map(p=>({name:p.id,family:p.id,social:0,alive:true,rank:2,partners:[],parents:[],houseHead:p.parents?.[0]||p.id,...p}))};
 let seq=0;const c=vm.createContext({state,crypto:{randomUUID:()=>String(++seq)},log(){},adult:p=>p?.alive&&p.age>=18,alive:()=>state.people.filter(p=>p.alive),byId:id=>state.people.find(p=>p.id===id),related:(a,b)=>a.parents.some(id=>b.parents.includes(id)),partners:p=>p.partners.map(r=>state.people.find(p=>p.id===r.id)).filter(p=>p?.alive),headOf:p=>state.people.find(x=>x.id===p.houseHead)||p,isHead:p=>p.houseHead===p.id,getEffectiveTier:p=>p.social,bloodDescendant:(p,id)=>p.parents.includes(id),pruneProposals(){},absorbHouse(a,b){b.unionHead=a.id;b.houseHead=a.id;}});
 vm.runInContext(read('js/kingdom/betrothals.js')+'\nglobalThis.api=Betrothals;',c);
 const kingdom=read('js/kingdom/kingdom.js');
 vm.runInContext(kingdom.slice(kingdom.indexOf('function canUnion('),kingdom.indexOf('marriageCandidates =')),c);
 vm.runInContext(kingdom.slice(kingdom.indexOf('function unite('),kingdom.indexOf('function repairRelationships')),c);
 return c;
}
test('promises reserve partners, wait for both adults and create exactly one marriage after reload',()=>{
 const c=setup();assert.equal(c.api.arrange('a','b'),true);assert.equal(c.api.arrange('c','b'),false);
 assert.equal(c.canUnion(c.byId('a'),c.byId('c')),false);assert.equal(c.canUnion(c.byId('a'),c.byId('a')),false);
 c.api.tick();assert.equal(c.byId('a').partners.length,0);
 c.byId('a').age=18;c.api.tick();assert.equal(c.byId('a').partners.length,0);
 const saved=JSON.parse(JSON.stringify(c.state));assert.equal(saved.betrothals[0].status,'promised');
 c.state.betrothals=saved.betrothals;c.byId('b').age=18;c.api.tick();c.api.tick();
 assert.equal(c.byId('a').spouse,'b');assert.equal(c.byId('b').spouse,'a');assert.equal(c.byId('a').partners.length,1);assert.equal(c.state.betrothals[0].status,'married');assert.equal(c.byId('a').houseHead,'a');
});
test('breaking is repeat-safe, frees both partners and penalizes relations and loyalty',()=>{
 const c=setup();c.api.arrange('a','b');const p=c.api.active()[0];assert.equal(c.api.breakPromise(p.id,'king'),true);assert.equal(c.api.breakPromise(p.id,'king'),false);
 assert.equal(c.api.relation('king','lord'),-25);assert.equal(c.byId('lord').loyalty,85);assert.equal(c.api.forPerson('a'),undefined);assert.equal(c.api.arrange('c','b'),true);
});
test('death cancels without penalties; invalid kin, age gaps and existing marriages are rejected',()=>{
 const c=setup();assert.equal(c.api.arrange('c','d'),false);c.byId('b').age=30;assert.equal(c.api.arrange('a','b'),false);c.byId('b').age=17;
 c.byId('b').partners=[{id:'lord'}];assert.equal(c.api.arrange('a','b'),false);c.byId('b').partners=[];
 c.api.arrange('a','b');c.byId('b').alive=false;c.api.tick();assert.equal(c.state.betrothals[0].status,'cancelled');assert.equal(c.api.relation('king','lord'),0);
});
test('nobles autonomously promise children, leaving royal descendants to the player',()=>{
 const c=setup();c.state.day=48;c.api.tick();assert.equal(c.api.active().length,1);assert.equal(c.api.forPerson('a'),undefined);const p=c.api.active()[0];assert.ok([p.a,p.b].includes('b'));
 c.state.houseRelations={['lord:other']:-60};c.state.day=96;c.api.tick();assert.equal(c.state.betrothals[0].status,'broken');
});
test('population all renders children in a separate grid after adults',()=>{
 const c=setup();Object.assign(c,{peopleTab:'all',jobFilter:'all',JOBS:{},peopleCard:p=>'<i>'+p.id+'</i>'});
 const source=read('js/kingdom/kingdom.js');const start=source.indexOf('peopleView = function()');const end=source.indexOf("  if (peopleTab === 'families')",start);
 vm.runInContext(source.slice(start,end)+'};',c);c.DomainAutonomy={visible:()=>true};const html=c.peopleView();assert.ok(html.indexOf('<i>king</i>')<html.indexOf('Crianças (4)'));assert.ok(html.indexOf('<i>a</i>')>html.indexOf('Crianças (4)'));
});

test('daily politics celebrates promised unions even outside negotiation days',()=>{
 const c=setup();c.api.arrange('a','b');c.byId('a').age=c.byId('b').age=18;
 const source=read('js/kingdom/kingdom.js');vm.runInContext(source.slice(source.indexOf('function politicalCycle()'),source.indexOf('function chooseHeir(')),c);
 c.politicalCycle();assert.equal(c.byId('a').spouse,'b');assert.equal(c.state.betrothals[0].status,'married');
});
test('broken promises reduce future acceptance between sponsoring families',()=>{
 const c=setup();c.byId('king').traits=[];c.byId('lord').traits=[];c.clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const source=read('js/kingdom/kingdom.js');vm.runInContext(source.slice(source.indexOf('function acceptance('),source.indexOf('function canUnion(')),c);
 const before=c.acceptance(c.byId('king'),c.byId('lord'));c.api.arrange('a','b');c.api.breakPromise(c.api.active()[0].id,'king');assert.ok(c.acceptance(c.byId('king'),c.byId('lord'))<before);
});
