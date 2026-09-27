import test from 'node:test';
import assert from 'node:assert/strict';
import {setupWorld,geometry} from './helpers/world-engine.mjs';
import {describeWorld} from '../js/map-3d/world-data.mjs';
function prepare(c,tile=240){
 const race=['elf','darkElf','beastfolk'].find(r=>c.Societies.allowed(r,tile));
 const group=c.CommunityLife.create(race,tile);assert.ok(group);
 const extra=c.Societies.create(race,null,tile);extra.communityId=group.id;
 c.state.day=49;c.state.warfare.nextCommunityDay=1000;group.treasury.food=100;group.treasury.gold=100;
 return group;
}
function reload(c){const copy=JSON.parse(JSON.stringify(c.state));c.validateWarfare(copy);Object.assign(c.state,copy);c.CommunityLife.ensure();return c.state.warfare.communities[0];}

test('communities appear during time progression, grow and survive reload without reseeding',()=>{
 const c=setupWorld();assert.equal(c.CommunityLife.list().length,0);
 for(let day=2;day<=25;day++){c.state.day=day;c.CommunityLife.tick();}
 assert.equal(c.CommunityLife.list().length,1);const group=c.CommunityLife.list()[0];
 assert.ok(c.Societies.allowed(group.race,group.tile));assert.equal(c.CommunityLife.members(group).length,3);
 const count=c.Societies.all().length;c.CommunityLife.tick();assert.equal(c.Societies.all().length,count);
 c.state.day=49;c.CommunityLife.tick();assert.equal(c.CommunityLife.members(group).length,4);
 reload(c);assert.equal(c.CommunityLife.list().length,2);
});

test('settlement permits owned and titled land, keeps sovereignty and weights untitled sites higher',()=>{
 const c=setupWorld(),realm=c.state.warfare.realms[0],tile=realm.tiles[0];
 const race=['elf','darkElf','beastfolk'].find(r=>c.Societies.allowed(r,tile));
 assert.ok(c.CommunityLife.create(race,tile));assert.equal(c.Warfare.owner(tile).id,realm.id);
 c.state.people.push({...c.makePerson(),id:'lord',social:2,tiles:[240]});
 assert.ok(c.CommunityLife.create(['elf','darkElf','beastfolk'].find(r=>c.Societies.allowed(r,240)),240));
 assert.equal(c.state.people.find(p=>p.id==='lord').tiles[0],240);
 assert.equal(c.CommunityLife.create(race,tile),null);
 const communityMarker=describeWorld(c.state).habitats.find(h=>h.tile===240);assert.ok(communityMarker.name);
 const d=setupWorld();d.pick=a=>a.includes('beastfolk')?'beastfolk':a[0];
 const pool=geometry.all().provinces.filter(p=>p.price!==null&&p.landArea>2&&d.Societies.allowed('beastfolk',p.index));
 d.state.people.push({...d.makePerson(),id:'lord',social:2,tiles:[pool[0].index]});
 const total=1+(pool.length-1)*6;d.Math.random=()=>1.5/total;
 assert.equal(d.CommunityLife.spawn().tile,pool[1].index);
});

test('winning a warned claim founds a real nation with original people, treasury and exclusive land',()=>{
 const c=setupWorld(),group=prepare(c);c.state.people.forEach(p=>p.hp=1);
 const members=c.CommunityLife.members(group).map(p=>p.id),before=c.Societies.all().length;
 assert.equal(c.CommunityLife.claim(group),true);assert.equal(group.claim.ready,53);assert.ok(c.Warfare.owned().has(240));
 c.state.day=52;c.CommunityLife.tick();assert.equal(group.status,'claiming');reload(c);
 c.state.day=53;c.CommunityLife.tick();const saved=c.CommunityLife.list()[0],realm=c.Warfare.owner(240);
 assert.equal(saved.status,'nation');assert.equal(realm.id,saved.realm);assert.equal(realm.atWar,true);assert.equal(realm.capital,240);
 assert.equal(realm.treasury.gold,80);assert.ok(members.every(id=>c.Societies.by(id).realm===realm.id));assert.equal(c.Societies.all().length,before);
 assert.ok(!c.state.royalLands.includes(240));assert.ok(c.state.people.every(p=>p.capturedBy===realm.id));reload(c);
 c.state.day=54;c.CommunityLife.tick();assert.equal(c.state.warfare.realms.filter(r=>r.communityId===group.id).length,1);
});

test('defeat and changed ownership prevent free nation creation; claims reserve fighters',()=>{
 const c=setupWorld(),group=prepare(c),n=c.state.warfare.realms.length;
 assert.equal(c.CommunityLife.claim(group),true);for(const id of group.claim.men)assert.equal(c.Warfare.deployed(id),true);
 for(let day=53;day<=62&&group.claim;day++){c.state.day=day;c.CommunityLife.tick();}assert.equal(group.status,'dispersed');assert.equal(c.state.warfare.realms.length,n);assert.ok(c.Warfare.owned().has(240));reload(c);
 const d=setupWorld(),other=prepare(d);d.CommunityLife.claim(other);d.state.royalLands=[];d.state.day=50;d.CommunityLife.tick();assert.equal(other.claim,null);assert.equal(other.status,'settled');assert.equal(d.state.warfare.realms.length,n);
});

test('claim combat reserves defenders across reload and prevents rival simultaneous attacks',()=>{
 const c=setupWorld(),group=prepare(c);c.CommunityLife.claim(group);c.Combat.round=()=>null;
 c.state.day=53;c.CommunityLife.tick();assert.equal(group.claim.defenders.length,2);assert.equal(c.Warfare.deployed('king'),true);reload(c);
 assert.equal(c.Warfare.deployed('king'),true);
 const realm=c.state.warfare.realms[0];realm.atWar=true;assert.equal(c.Warfare.mobilize('king',realm.capital,['king','soldier']).ok,false);
 const copy=JSON.parse(JSON.stringify(c.state));copy.warfare.communities[0].claim.defenders.push('king');assert.throws(()=>c.validateWarfare(copy));
});

test('conquest resolves foreign survivors, reveals locals and keeps active raiders foreign',()=>{
 const c=setupWorld(),realm=c.state.warfare.realms[0],tile=realm.capital,people=c.Societies.garrison(realm.id,tile);
 c.Math.random=()=>.2;c.Warfare.conquer(tile,'crown');assert.ok(people.every(p=>p.capturedBy==='crown'));assert.ok(people.every(p=>c.Societies.visible(p)));
 const another=realm.tiles[0],stranded=c.Societies.create('human',realm.id,tile);c.Societies.tick();assert.equal(stranded.realm,null);assert.equal(stranded.residentStatus,'wanderer');
 const troops=c.Societies.garrison(realm.id,another).slice(0,2);c.state.warfare.raids.push({id:'x',realm:realm.id,origin:another,target:tile,status:'march',round:0,men:troops.map(p=>p.id)});
 troops[0].location=tile;c.LocalRecruitment.reconcile();assert.equal(troops[0].realm,realm.id);assert.equal(c.LocalRecruitment.local(troops[0]),false);reload(c);
});

test('refusal can release prisoners or send residents away, with persisted cooldown and no duplicate recruits',()=>{
 for(const prisoner of [false,true]){
  const c=setupWorld(),p=c.Societies.create('kobold',null,240);if(prisoner)p.capturedBy='crown';
  let rolls=[.99,0];c.Math.random=()=>rolls.shift()??.5;
  assert.equal(c.LocalRecruitment.offer(p.id),true);assert.equal(p.lastOfferResult,'departed');assert.notEqual(p.location,240);assert.equal(p.capturedBy,null);
  assert.equal(c.LocalRecruitment.offer(p.id),false);reload(c);const loaded=c.Societies.by(p.id);assert.equal(loaded.nextOfferDay,5);
  c.state.day=5;loaded.location=240;c.Math.random=()=>0;assert.equal(c.LocalRecruitment.offer(p.id),true);assert.equal(c.state.people.filter(x=>x.id===p.id).length,1);assert.equal(c.LocalRecruitment.offer(p.id),false);
 }
});

test('malformed community saves and negotiation fields are rejected',()=>{
 const c=setupWorld();prepare(c);reload(c);
 for(const change of [s=>s.warfare.communities[0].tile=512,s=>s.warfare.communities[0].treasury.gold=-1,s=>s.warfare.communities[0].status='nation',s=>s.warfare.people[0].communityId='missing',s=>s.warfare.people[0].nextOfferDay=-1,s=>s.warfare.communities.push(s.warfare.communities[0])]){
 const copy=JSON.parse(JSON.stringify(c.state));change(copy);assert.throws(()=>c.validateWarfare(copy));}
});

test('twenty years of living-world simulation retain valid communities, new nations and saves',()=>{
 const c=setupWorld();let seed=19;c.Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 c.state.food=c.state.gold=100000;
 for(let day=2;day<=961;day++){
  c.state.day=day;c.Warfare.tick();
  if(day%24===0){const copy=JSON.parse(JSON.stringify(c.state));c.validateWarfare(copy);Object.assign(c.state,copy);}
 }
 assert.ok(c.CommunityLife.list().length>5);assert.ok(c.state.warfare.realms.some(r=>r.communityId));
 assert.ok(c.CommunityLife.list().filter(c.CommunityLife.active).length<=16);
 assert.equal(new Set([...c.state.people,...c.Societies.all()].map(p=>p.id)).size,c.state.people.length+c.Societies.all().length);
});
