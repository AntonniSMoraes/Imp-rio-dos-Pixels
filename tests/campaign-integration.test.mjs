import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

function engine(){
 const math=Object.create(Math);let seed=1837;math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const c=vm.createContext({Math:math,crypto:webcrypto,structuredClone,window:{addEventListener(){}},document:{addEventListener(){},querySelector(){return null;}},localStorage:{getItem(){return null;},setItem(){}},render(){},dynastyView(){return '';},traitRows(){return '';},jobSelect(){return '';},refreshPersonModal(){},setTimeout(){},clearTimeout(){}});
 for(const f of ['config/names','config/config','config/races','core/utils','engine/race-genetics','engine/calendar','engine/reproduction','paper-doll/campaign-identity','model/people-model','model/people-relations','economy/annual-economy','economy/state-economy','war/war-validation','kingdom/family-chronicle','core/save-validation','recruitment/recruitment-system','combat/battle-system','village/game-state','village/game','territory/provinces','territory/realm-territory','kingdom/peerage','kingdom/noble-development','kingdom/domain-autonomy','war/conscription','kingdom/feudal-actions','war/dragons','war/combatants','war/world-societies','war/community-life','war/local-recruitment','war/frontier-ai','war/warfare','kingdom/betrothals','kingdom/vassal-aid','kingdom/marriage-council','kingdom/court-ui','kingdom/kingdom','engine/daily-cycle']){
  vm.runInContext(readFileSync(new URL('../js/'+f+'.js',import.meta.url),'utf8'),c,{filename:f});
 }
 vm.runInContext(`render=()=>{};refreshPersonModal=()=>{};state=initial('central','Teste','Integração');state.food=10000;state.gold=10000;state.wood=10000;state.buildings.fire=1;state.buildings.home=20;upgradeKingdom();`,c);
 c.run=s=>vm.runInContext(s,c);return c;
}
test('complete campaign survives five annual settlements and save reloads',()=>{
 const c=engine();
 c.run(`const king=byId(state.king);for(const key in king.attrs)king.attrs[key]=1000;const worker=makePerson({age:24});worker.job='food';worker.liege=state.king;worker.houseHead=worker.id;state.people.push(worker);`);
 for(let i=0;i<240;i++){
  c.run('advance()');
  if(i%24===23)c.run('{const snapshot=JSON.parse(JSON.stringify(state));validateSave(snapshot);state=snapshot;}');
 }
 assert.equal(c.run('state.day'),241,c.run('JSON.stringify(state.logs.slice(0,12))'));assert.equal(c.run('state.lastAnnualTribute.day'),240);
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

test('family chronicle records real unions, births, succession, deaths and territory changes across reload',()=>{
 const c=engine();
 c.run(`const founder=byId(state.king);founder.age=30;founder.level=5;
 const mate=makePerson({age:25,sex:founder.sex==='M'?'F':'M'});mate.level=5;state.people.push(mate);ensurePerson(mate);
 if(!unite(founder,mate))throw Error('union failed');
 const mother=founder.sex==='F'?founder:mate, father=founder.sex==='M'?founder:mate;
 mother.reproduction={version:1,pregnancy:{fatherId:father.id,babies:1,recoveryDays:24},nextAttemptDay:1,recoveryUntil:0};
 deliverPregnancy(mother);
 const child=state.people.at(-1);child.age=25;child.level=5;founder.heir=child.id;
 succession(founder);death(founder,'de velhice');death(founder,'de velhice');
 const target=state.warfare.realms[0].tiles[0];Warfare.conquer(target,'crown',child);Warfare.conquer(target,'crown',child);Warfare.conquer(target,state.warfare.realms[0].id);
 const snapshot=JSON.parse(JSON.stringify(state));validateSave(snapshot);state=snapshot;`);
 assert.equal(c.run("FamilyChronicle.events('all','','union').length"),1);
 for(const kind of ['birth','succession','death','conquest','loss'])assert.equal(c.run(`FamilyChronicle.events('all','','${kind}').length`),1,kind);
 assert.equal(c.run("FamilyChronicle.events('house',state.king).length"),6);
 assert.equal(c.run("FamilyChronicle.events('person',mate.id,'birth').length"),1);
 c.run("byId(mate.id).name='Mudou';");
 assert.equal(c.run("FamilyChronicle.events('person',mate.id,'union')[0].people.some(p=>p.name==='Mudou')"),false);
});

test('chronicle migration does not invent history and rejects corrupt imported events',()=>{
 const c=engine();c.run('delete state.familyChronicle;FamilyChronicle.ensure();FamilyChronicle.ensure();');
 assert.equal(c.run('state.familyChronicle.events.length'),0);
 c.run("FamilyChronicle.record('death',[byId(state.king)],'Texto <script>');");
 for(const mutation of ["events[0].day=999999","events[0].type='__proto__'","events[0].people[0].house=null","nextId=1","events[0].tile=512"]){
  assert.throws(()=>c.run(`{const bad=JSON.parse(JSON.stringify(state));bad.familyChronicle.${mutation};validateSave(bad);}`));
 }
 c.run('state=JSON.parse(JSON.stringify(state));FamilyChronicle.ensure();');
 assert.equal(c.run('state.familyChronicle.events.length'),1);
});

test('marriage refusal identifies both sides and cannot be rerolled or reversed after reload',()=>{
 const c=engine();c.run(`const a=makePerson({age:25,sex:'M'}),b=makePerson({age:25,sex:'F'});state.people.push(a,b);ensurePerson(a);ensurePerson(b);a.houseHead=a.id;b.houseHead=b.id;Math.random=()=>.99;MarriageCouncil.propose(a,b);`);
 assert.equal(c.run('MarriageCouncil.find(a,b).rejected.length'),2);
 c.run('const beforePeople=state.people.length;state=JSON.parse(JSON.stringify(state));Math.random=()=>0;MarriageCouncil.propose(byId(b.id),byId(a.id));');
 assert.equal(c.run('MarriageCouncil.find(a,b).insistence'),1);assert.equal(c.run('partners(byId(a.id)).length'),0);
 assert.equal(c.run('byId(a.id).loyalty'),90);c.run('validateSave(JSON.parse(JSON.stringify(state)))');
});

test('dowry is paid once, preserves refusal on insufficient funds and needs actual family knighthood',()=>{
 const c=engine();c.run(`const a=byId(state.king),b=makePerson({age:25,sex:a.sex==='M'?'F':'M'}),relative=makePerson({age:23});state.people.push(b,relative);ensurePerson(b);ensurePerson(relative);
 const n=MarriageCouncil.refuse(a,b,[b]);n.rejected[0].demand={type:'gold',amount:60};state.gold=59;`);
 assert.equal(c.run('MarriageCouncil.settle(n)'),false);assert.equal(c.run('state.gold'),59);
 c.run('state.gold=100;');assert.equal(c.run('MarriageCouncil.settle(n)'),true);assert.equal(c.run('state.gold'),40);assert.equal(c.run('MarriageCouncil.settle(n)'),false);
 c.run('validateSave(JSON.parse(JSON.stringify(state)))');
 const d=engine();d.run(`const a=byId(state.king),b=makePerson({age:25,sex:a.sex==='M'?'F':'M'}),relative=makePerson({age:23});state.people.push(b,relative);ensurePerson(b);ensurePerson(relative);const n=MarriageCouncil.refuse(a,b,[b]);n.rejected[0].demand={type:'title',relative:relative.id,tier:2};`);
 assert.equal(d.run('MarriageCouncil.settle(n)'),false);d.run('relative.social=2;');assert.equal(d.run('MarriageCouncil.settle(n)'),true);
});

test('persistent insistence can cause actual emigration, preserving genealogy and foreign combatants',()=>{
 const c=engine();c.run(`const a=byId(state.king),b=makePerson({age:25,sex:a.sex==='M'?'F':'M'});state.people.push(b);ensurePerson(b);const n=MarriageCouncil.refuse(a,b,[b]);for(const r of state.warfare.realms)r.treasury={food:500,gold:100,wood:100,iron:100};Math.random=()=>0;MarriageCouncil.propose(a,b);MarriageCouncil.propose(a,b);MarriageCouncil.propose(a,b);`);
 assert.equal(c.run('b.away'),true);assert.equal(c.run('b.alive'),true);assert.equal(c.run('alive().includes(b)'),false);assert.equal(c.run('WorldSocieties.all().filter(p=>p.id===b.id).length'),1);
 assert.equal(c.run("VassalAid.defect(a,'teste')"),false);
 c.run('validateSave(JSON.parse(JSON.stringify(state)));state=JSON.parse(JSON.stringify(state));upgradeKingdom();');
 assert.equal(c.run('byId(b.id).away'),true);assert.equal(c.run('adult(byId(b.id))'),false);
 c.run(`const p=byId(b.id);p.capturedBy='crown';p.location=state.capitalIndex??240;WorldSocieties.join(p);validateSave(JSON.parse(JSON.stringify(state)));`);
 assert.equal(c.run('alive().some(p=>p.id===b.id)'),true);assert.equal(c.run('state.people.filter(p=>p.id===b.id).length'),1);
});

test('vassal aid moves actual resources, escalates to crown and expires into supported desertion',()=>{
 const c=engine();c.run(`const lord=makePerson({age:25}),superior=makePerson({age:35});state.people.push(lord,superior);ensurePerson(lord);ensurePerson(superior);lord.social=2;lord.tiles=[1];lord.houseHead=lord.id;lord.liege=superior.id;lord.treasury={food:0,wood:0,iron:0,gold:0};superior.social=3;superior.houseHead=superior.id;superior.treasury={food:200,wood:50,iron:50,gold:50};superior.liege=state.king;const request=VassalAid.request(lord);`);
 assert.equal(c.run('VassalAid.respond(request.id,true,true)'),true);assert.equal(c.run('lord.treasury.food'),15);assert.equal(c.run('superior.treasury.food'),185);assert.equal(c.run('VassalAid.respond(request.id,true,true)'),false);
 c.run(`state.day=25;lord.treasury.food=0;superior.treasury.food=0;const second=VassalAid.request(lord);state.day=29;VassalAid.tick();`);
 assert.equal(c.run('second.recipient===state.king'),true);
 c.run(`lord.loyalty=0;Math.random=()=>0;for(const r of state.warfare.realms)r.treasury={food:500,gold:100,wood:100,iron:100};state.day=second.deadline;VassalAid.tick();`);
 assert.equal(c.run('second.status'),'refused');assert.equal(c.run('lord.away'),true);assert.equal(c.run('lord.tiles.length'),0);assert.ok(c.run('state.royalLands.includes(1)'));
 c.run('validateSave(JSON.parse(JSON.stringify(state)))');
});

test('court saves reject duplicate requests, invented rejectors and a deserting king',()=>{
 const c=engine();c.run(`const a=byId(state.king),b=makePerson({age:25,sex:a.sex==='M'?'F':'M'});state.people.push(b);ensurePerson(b);MarriageCouncil.refuse(a,b,[b]);VassalAid.ensure();`);
 for(const mutation of ["marriageNegotiations[0].rejected[0].id='missing'","marriageNegotiations[0].rejected[0].demand={type:'gold',amount:-1}","people[0].away=true"]){assert.throws(()=>c.run(`{const bad=JSON.parse(JSON.stringify(state));bad.${mutation};validateSave(bad);}`));}
});

test('emigration requires actual aid and preserves the adult without duplicate identities',()=>{
 const c=engine();c.run(`const migrant=makePerson({age:25});state.people.push(migrant);ensurePerson(migrant);for(const r of state.warfare.realms)r.treasury={food:0,gold:0,wood:0,iron:0};`);
 assert.equal(c.run("VassalAid.defect(migrant,'teste')"),false);
 c.run('state.warfare.realms[0].treasury={food:100,gold:100,wood:0,iron:0};');
 assert.equal(c.run("VassalAid.defect(migrant,'teste')"),true);
 c.run('validateSave(JSON.parse(JSON.stringify(state)))');
 assert.throws(()=>c.run('{const bad=JSON.parse(JSON.stringify(state));bad.warfare.people.push({...bad.people.find(p=>p.id===migrant.id)});validateSave(bad);}'));
});

test('paper doll inherits the same parents as color genes and survives adulthood, titles and reload',()=>{
 const c=engine();c.run(`const father=byId(state.king),mother=makePerson({age:25,sex:'F'});father.genes.skin=0;father.genes.hair=2;delete father.paperDoll;mother.genes.skin=2;mother.genes.hair=1;state.people.push(mother);ensurePerson(mother);CampaignAppearance.ensure(father);CampaignAppearance.ensure(mother);const child=childOf(father,mother);state.people.push(child);ensurePerson(child);`);
 for(const key of ['skin','hair'])assert.equal(c.run('child.paperDoll.'+key),c.run('byId(child.origins.'+key+').paperDoll.'+key));
 assert.equal(c.run('CampaignAppearance.appearance(child)'),null);
 c.run('child.age=18;child.level=5;child.hairstyle=0;');assert.equal(c.run('CampaignAppearance.appearance(child).outfit'),'commoner');
 const identity=c.run('JSON.stringify(child.paperDoll)');c.run('child.social=2;child.hairstyle=3;');assert.equal(c.run('CampaignAppearance.appearance(child).outfit'),'noble');assert.ok(c.run('CampaignAppearance.appearance(child).hair').startsWith('long-'));
 c.run('validateSave(JSON.parse(JSON.stringify(state)));state=JSON.parse(JSON.stringify(state));upgradeKingdom();');assert.equal(c.run('JSON.stringify(byId(child.id).paperDoll)'),identity);
 assert.throws(()=>c.run("{const bad=JSON.parse(JSON.stringify(state));bad.people[0].paperDoll.version=99;validateSave(bad);}"));
});
test('paper doll migration is stable and unsupported colors and mixed ancestry retain racial art',()=>{
 const c=engine();c.run(`const p=byId(state.king);p.genes.skin=5;p.genes.hair=0;delete p.paperDoll;const originalGenes=JSON.stringify(p.genes);CampaignAppearance.ensure(p);`);
 assert.equal(c.run('CampaignAppearance.appearance(p)'),null);assert.equal(c.run('JSON.stringify(p.genes)'),c.run('originalGenes'));
 c.run("p.paperDoll={version:1,skin:'ivory',hair:'blond'};p.ancestry={human:.875,wolf:.125};");assert.equal(c.run('CampaignAppearance.appearance(p)'),null);
});

test('feudal capture uses the defended territory and house resources, not royal funds',()=>{
 const c=engine();c.run(`const lord=makePerson({age:30});state.people.push(lord);ensurePerson(lord);lord.social=2;lord.tiles=[state.royalLands.pop()];lord.houseHead=lord.id;lord.treasury={gold:20,food:30,wood:0,iron:0};const captive=WorldSocieties.all().find(p=>p.realm);WarCombat.capture([captive],'crown',lord.tiles[0]);const royalGold=state.gold,royalFood=state.food;`);
 assert.equal(c.run('captive.custodianId===lord.id'),true);
 assert.equal(c.run('LocalRecruitment.offer(captive.id)'),false);
 c.run('Math.random=()=>0;');assert.equal(c.run('LocalRecruitment.offer(captive.id,lord)'),true);
 assert.equal(c.run('state.gold===royalGold&&state.food===royalFood'),true);
 assert.equal(c.run('lord.treasury.gold'),18);assert.equal(c.run('lord.treasury.food'),25);
 assert.equal(c.run('captive.liege===lord.id'),true);assert.equal(c.run('captive.custodianId'),undefined);
 c.run('validateSave(JSON.parse(JSON.stringify(state)))');
});
test('custody survives saves, transfers after the guardian loses authority and release clears captivity',()=>{
 const c=engine();c.run(`const lord=makePerson({age:30});state.people.push(lord);ensurePerson(lord);lord.social=2;lord.tiles=[state.royalLands.pop()];const captive=WorldSocieties.all().find(p=>p.realm);WarCombat.capture([captive],'crown',lord.tiles[0]);validateSave(JSON.parse(JSON.stringify(state)));state=JSON.parse(JSON.stringify(state));const prisoner=WorldSocieties.by(captive.id);`);
 assert.equal(c.run('LocalRecruitment.custodian(prisoner).id===lord.id'),true);
 assert.equal(c.run('LocalRecruitment.release(prisoner.id)'),false);
 c.run('byId(lord.id).alive=false;LocalRecruitment.custodyTick();');assert.equal(c.run('prisoner.custodianId'),undefined);
 assert.equal(c.run('LocalRecruitment.release(prisoner.id)'),true);assert.equal(c.run('prisoner.capturedBy'),null);
 assert.equal(c.run('LocalRecruitment.release(prisoner.id)'),false);
 c.run('validateSave(JSON.parse(JSON.stringify(state)))');
});
test('house custody cannot spend royal reserves when the house is bankrupt or negotiate twice per day',()=>{
 const c=engine();c.run(`const lord=makePerson({age:30});state.people.push(lord);ensurePerson(lord);lord.social=2;lord.tiles=[state.royalLands.pop()];lord.treasury={food:0,gold:0};const captive=WorldSocieties.all().find(p=>p.realm);WarCombat.capture([captive],'crown',lord.tiles[0]);`);
 assert.equal(c.run('LocalRecruitment.offer(captive.id,lord)'),false);
 c.run('lord.treasury={gold:20,food:30};state.day=12;Math.random=()=>.99;LocalRecruitment.custodyTick();LocalRecruitment.custodyTick();');
 assert.equal(c.run('lord.treasury.gold'),18);assert.equal(c.run('lord.treasury.food'),25);assert.equal(c.run('captive.lastOfferResult'),'refused');
 assert.throws(()=>c.run("{const bad=JSON.parse(JSON.stringify(state));bad.warfare.people.find(p=>p.id===captive.id).custodianId='missing';validateSave(bad);}"));
});

test('custody agreements conserve gold, preserve prisoner consent and reject stale or repeated purchases',()=>{
 const c=engine();c.run(`const seller=makePerson({age:30});state.people.push(seller);ensurePerson(seller);seller.social=2;seller.tiles=[state.royalLands[0]];seller.treasury={gold:20,food:30};state.royalLands.push(1);const captive=WorldSocieties.all().find(p=>p.realm);WarCombat.capture([captive],'crown',seller.tiles[0]);captive.nextOfferDay=10;captive.persuasion=20;const total=state.gold+seller.treasury.gold;const custodyPrice=LocalRecruitment.quote(captive,byId(state.king)).price;`);
 assert.equal(c.run("LocalRecruitment.negotiate(captive.id,state.king,'transfer','stale')"),false);
 assert.equal(c.run("LocalRecruitment.negotiate(captive.id,state.king,'transfer',seller.id)"),true);
 assert.equal(c.run('state.gold+seller.treasury.gold'),c.run('total'));assert.equal(c.run('seller.treasury.gold'),20+c.run('custodyPrice'));
 assert.equal(c.run('captive.capturedBy'),'crown');assert.equal(c.run('captive.custodianId'),undefined);assert.equal(c.run('captive.nextOfferDay'),10);assert.equal(c.run('captive.persuasion'),20);
 assert.equal(c.run("LocalRecruitment.negotiate(captive.id,seller.id,'transfer',state.king)"),false);
 c.run('validateSave(JSON.parse(JSON.stringify(state)));state=JSON.parse(JSON.stringify(state));');assert.equal(c.run('WorldSocieties.by(captive.id).nextCustodyDay'),5);
});
test('ransom between houses releases without recruiting and pays the previous custodian',()=>{
 const c=engine();c.run(`const buyer=makePerson({age:30});state.people.push(buyer);ensurePerson(buyer);buyer.social=2;buyer.tiles=[1];buyer.treasury={gold:200,food:30};const captive=WorldSocieties.all().find(p=>p.realm);WarCombat.capture([captive],'crown',state.royalLands[0]);const before=state.gold;const custodyPrice=LocalRecruitment.quote(captive,buyer).price;`);
 assert.equal(c.run("LocalRecruitment.negotiate(captive.id,buyer.id,'ransom',state.king)"),true);
 assert.equal(c.run('captive.capturedBy'),null);assert.equal(c.run('captive.residentStatus'),'wanderer');assert.equal(c.run('state.people.includes(captive)'),false);
 assert.equal(c.run('state.gold'),c.run('before+custodyPrice'));assert.equal(c.run('buyer.treasury.gold'),200-c.run('custodyPrice'));
 assert.equal(c.run("LocalRecruitment.negotiate(captive.id,buyer.id,'ransom',state.king)"),false);
});
test('hostile relations and insolvency block custody agreements without charging either house',()=>{
 const c=engine();c.run(`const buyer=makePerson({age:30});state.people.push(buyer);ensurePerson(buyer);buyer.social=2;buyer.tiles=[1];buyer.treasury={gold:0,food:30};const captive=WorldSocieties.all().find(p=>p.realm);WarCombat.capture([captive],'crown',state.royalLands[0]);const before=state.gold;`);
 assert.equal(c.run("LocalRecruitment.negotiate(captive.id,buyer.id,'transfer',state.king)"),false);
 c.run("buyer.treasury.gold=200;state.houseRelations ||= {};state.houseRelations[[state.king,buyer.id].sort().join(':')]=-25;");assert.equal(c.run("LocalRecruitment.negotiate(captive.id,buyer.id,'transfer',state.king)"),false);
 assert.equal(c.run('state.gold'),c.run('before'));assert.equal(c.run('buyer.treasury.gold'),200);
});
