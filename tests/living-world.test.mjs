import test from 'node:test';
import assert from 'node:assert/strict';
import {setupWorld,geometry} from './helpers/world-engine.mjs';
import {describeWorld} from '../js/map-3d/world-data.mjs';
test('racial factions and wilderness habitats obey biome rules without monster nations',()=>{
 const c=setupWorld();for(const r of c.state.warfare.realms){for(const i of r.tiles)assert.ok(c.Societies.allowed(r.race,i));if(r.race==='beastfolk')assert.equal(r.tiles.length,1);assert.ok(!['lamia','harpy','kobold'].includes(r.race));}
 assert.equal(c.state.warfare.habitats.length,6);for(const h of c.state.warfare.habitats)assert.ok(c.Societies.allowed(h.race,h.tile));
 const world=describeWorld(c.state);assert.equal(world.habitats.length,6);assert.ok(world.people.length>50);assert.ok(world.cities.some(c=>c.race==='elf'));
});
test('individual attributes determine outcomes and enemies die permanently; survivors gain XP',()=>{
 const c=setupWorld(),enemy=c.Societies.all()[0],soldier=c.state.people[1];for(const k in soldier.attrs)soldier.attrs[k]=1000;
 const result=c.Combat.round([soldier],[enemy]);assert.equal(result,'left');assert.equal(enemy.alive,false);assert.ok(soldier.xp>0);const id=enemy.id;c.state.day=2;c.Societies.tick();assert.equal(c.Societies.by(id).alive,false);
 const d=setupWorld(),strong=d.Societies.all()[0],weak=d.state.people[1];for(const k in strong.attrs)strong.attrs[k]=1000;for(const k in weak.attrs)weak.attrs[k]=1;assert.equal(d.Combat.round([weak],[strong]),'right');assert.equal(weak.alive,false);
});
test('both sides can capture surviving defeated people and captured citizens are unavailable',()=>{
 const c=setupWorld(),p=c.Societies.all()[0],king=c.state.people[0];c.Math.random=()=>.1;
 for(const k in king.attrs)king.attrs[k]=1000;assert.equal(c.Combat.round([king],[p]),'left');assert.equal(p.alive,true);c.Combat.capture([p],'crown');assert.equal(p.capturedBy,'crown');
 c.Combat.capture([king],'realm-0');assert.equal(c.onMission(king),true);const gold=c.state.gold;assert.equal(c.Societies.ransom(king.id),true);assert.equal(king.capturedBy,null);assert.equal(c.state.gold,gold-30);
});
test('offers respect capacity, use resources once, persist cooldown and transfer the actual prisoner',()=>{
 const c=setupWorld(),p=c.Societies.all()[0],id=p.id;p.capturedBy='crown';c.capacity=()=>2;
 const gold=c.state.gold;assert.equal(c.Societies.persuade(id),false);assert.equal(c.state.gold,gold);
 c.capacity=()=>20;c.Math.random=()=>.99;assert.equal(c.Societies.persuade(id),true);assert.equal(c.state.gold,gold-2);assert.equal(p.lastOfferResult,'refused');
 assert.equal(c.Societies.persuade(id),false);c.state.day+=4;c.Math.random=()=>0;
 assert.equal(c.Societies.persuade(id),true);assert.ok(c.state.people.includes(p));assert.ok(!c.Societies.all().includes(p));assert.equal(p.capturedBy,null);assert.doesNotThrow(()=>c.validateWarfare(c.state));
});

test('travelers reveal on crown and vassal land; active foreign cards require allied access or espionage',()=>{
 const c=setupWorld(),p=c.Societies.create('kobold',null,240);assert.equal(c.Societies.visible(p),true);
 c.state.people.push({...c.makePerson(),social:2,tiles:[240]});assert.equal(c.Societies.visible(p),true);assert.equal(c.Societies.recruit(p.id),true);
 const enemy=c.Societies.all().find(p=>p.realm);assert.equal(c.Societies.visible(enemy),false);assert.equal(c.Societies.spy(enemy.realm),true);assert.equal(c.Societies.visible(enemy),false);c.state.day+=3;c.Societies.tick();assert.equal(c.Societies.visible(enemy),true);c.state.day+=49;assert.equal(c.Societies.visible(enemy),false);
});
test('claiming a habitat permits recruitment without creating a duplicate',()=>{
 const c=setupWorld(),h=c.state.warfare.habitats[0],p=c.Societies.all().find(p=>p.location===h.tile&&!p.realm);assert.equal(c.Societies.recruit(p.id),false);c.state.royalLands.push(h.tile);assert.equal(c.Societies.recruit(p.id),true);assert.equal(c.Societies.recruit(p.id),false);assert.equal(c.state.people.filter(x=>x.id===p.id).length,1);
});
test('autonomous raids expand factions, preserve exclusive ownership and can capture crown land',()=>{
 const c=setupWorld(),r=c.state.warfare.realms[0];let target;
 for(const i of r.tiles){target=geometry.get(i).neighbors.find(n=>geometry.get(n).price!==null&&!c.Warfare.owner(n)&&c.Warfare.route([i],n));if(target!==undefined)break;}
 assert.notEqual(target,undefined);c.state.royalLands.push(target);r.atWar=true;c.state.people.forEach(p=>p.hp=1);
 c.state.day=12;c.AI.tick();assert.ok(c.state.warfare.raids.some(a=>a.target===target));c.AI.tick();c.AI.tick();
 assert.equal(c.Warfare.owner(target)?.id,r.id);assert.ok(!c.state.royalLands.includes(target));assert.ok(c.state.people.some(p=>p.capturedBy===r.id));c.Societies.sync();assert.doesNotThrow(()=>c.validateWarfare(c.state));
});
test('disputes can turn an alliance hostile; foreign troops train over time',()=>{
 const c=setupWorld(),r=c.state.warfare.realms[0],p=c.Societies.all()[0];assert.equal(c.Societies.treaty(r.id,'alliance'),true);assert.equal(r.ally,true);c.Societies.treaty(r.id,'dispute');c.Societies.treaty(r.id,'dispute');assert.equal(r.ally,false);assert.equal(r.atWar,true);
 p.xp=99;c.state.day=12;c.Societies.tick();assert.equal(p.level,6);
});
test('extended world validation rejects invalid actors, duplicate IDs, bogus raids and broken captivity',()=>{
 const c=setupWorld();assert.doesNotThrow(()=>c.validateWarfare(c.state));
 for(const mutate of [s=>s.warfare.people[0].hp=101,s=>s.warfare.people[0].id=s.people[0].id,s=>s.warfare.raids.push({realm:'realm-0',origin:0,target:1,status:'march',round:0,men:['missing','missing']}),s=>s.people[0].capturedBy='unknown']){const copy=JSON.parse(JSON.stringify(c.state));mutate(copy);assert.throws(()=>c.validateWarfare(copy));}
});

// Full expedition engine uses the same mortal individual combatants.
test('wolf expeditions persist individual opponents and can lose their patrol',async()=>{
 const {readFileSync}=await import('node:fs'),vm=await import('node:vm');const c=setupWorld();
 c.state.wins=0;c.state.iron=0;c.state.battle={active:true,party:c.state.people.map(p=>p.id),enemyHP:200,maxHP:200,round:0,logs:[],won:false};
 vm.runInContext(readFileSync(new URL('../js/combat/battle-system.js',import.meta.url),'utf8'),c);
 c.battleRound();assert.equal(c.state.battle.enemies.length,4);assert.ok(c.state.battle.enemies.some(p=>!p.alive||p.hp<100));
 for(const p of c.state.people){p.hp=20;for(const k in p.attrs)p.attrs[k]=1;}
 for(const p of c.state.battle.enemies){p.alive=true;p.hp=100;for(const k in p.attrs)p.attrs[k]=1000;}
 c.state.battle.active=true;c.battleRound();assert.equal(c.state.battle.active,false);assert.ok(c.state.people.some(p=>!p.alive));
});
test('capturing the capital relocates it to retained direct land and survives serialization',()=>{
 const c=setupWorld();c.state.capitalIndex=240;const backup=geometry.all().provinces.find(p=>p.price!==null&&!c.Warfare.owner(p.index)&&p.index!==240).index;c.state.royalLands.push(backup);
 c.Warfare.conquer(240,'realm-0');assert.equal(c.state.capitalIndex,backup);c.Societies.sync();assert.doesNotThrow(()=>c.validateWarfare(JSON.parse(JSON.stringify(c.state))));assert.equal(describeWorld(c.state).seat,backup);
});

test('automatic defense reserves people and prevents simultaneous deployment across provinces',()=>{
 const c=setupWorld(),r1=c.state.warfare.realms[0],r2=c.state.warfare.realms[1];const backup=geometry.all().provinces.find(p=>p.price!==null&&!c.Warfare.owner(p.index)&&p.index!==240).index;c.state.royalLands.push(backup);
 c.state.warfare.raids=[r1,r2].map((r,i)=>({id:'test-'+i,realm:r.id,origin:r.capital,target:i?backup:240,status:'battle',round:0,men:c.Societies.guards(r.id,r.capital).slice(0,2).map(p=>p.id)}));r1.atWar=r2.atWar=true;
 c.Combat.round=()=>null;c.AI.tick();assert.equal(c.state.warfare.raids[0].defenders.length,2);assert.equal(c.state.warfare.raids[1].defenders.length,0);assert.equal(c.Warfare.deployed('king'),true);assert.equal(c.Warfare.mobilize('king',r1.capital,['king','soldier']).ok,false);assert.doesNotThrow(()=>c.validateWarfare(c.state));
});

test('inspection magnifier covers local travelers and crown prisoners',()=>{
 const c=setupWorld(),p=c.Societies.create('kobold',null,240);
 const marker=()=>describeWorld(c.state).people.find(x=>x.id===p.id);
 assert.equal(marker().inspectable,true);
 c.state.people.push({...c.makePerson(),social:2,tiles:[240]});
 assert.equal(marker().inspectable,true);
 p.capturedBy='crown';assert.equal(marker().inspectable,true);
});
