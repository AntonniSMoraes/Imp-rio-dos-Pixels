'use strict';
// External people live outside state.people until they join the player's realm.
const WorldSocieties = (() => {
  const all=()=>state.warfare.people||[];
  const by=id=>state.people.find(p=>p.id===id)||all().find(p=>p.id===id);
  const own=i=>(state.royalLands||[]).includes(i)&&!alive().some(p=>p.id!==state.king&&p.social>=2&&(p.tiles||[p.territory]).includes(i));
  const occupied=i=>Warfare.owner(i)||(state.royalLands||[]).includes(i)||alive().some(p=>(p.tiles||[]).includes(i));
  const biome=i=>getTileBiome(i);
  const allowed=(race,i)=>race==='elf'?biome(i)==='floresta':race==='darkElf'||['lamia','harpy','kobold'].includes(race)?biome(i)==='mina':race==='beastfolk'?['floresta','planicie'].includes(biome(i)):true;
  function create(race,realm,index) {
    const p=makePerson({age:18+rand(24),rank:rand(3),sex:race==='harpy'?'F':pick(['M','F'])});
    p.race=race;p.ancestry=ancestryFromRace(race);p.racialTraits=[...(RACES[race]?.traits||[])];
    p.realm=realm;p.location=index;p.caste=race==='elf'?'baixa':null;p.partners||=[];
    for(const key of Object.keys(p.attrs))p.attrs[key]*=.75+Math.random()*.6;
    all().push(p);return p;
  }
  function ensure() {
    const w=state.warfare;if(w.societyVersion===1)return;
    w.people||=[];w.habitats||=[];w.raids||=[];w.intel||={};
    const free=race=>TerritoryGeometry.all().provinces.filter(p=>p.landArea>2&&!occupied(p.index)&&allowed(race,p.index));
    for(const [race,name,color,size] of [['elf','Reino Silvestre','#5eae71',4],['darkElf','Domínio da Obsidiana','#9864c9',4],['beastfolk','Vila da Garra','#cc9b62',1],['beastfolk','Vila da Presa','#b87b56',1]]){
      const pool=free(race),seed=pool[Math.floor(pool.length*.5)];if(!seed)continue;
      const tiles=[seed.index],queue=[seed.index];
      while(queue.length&&tiles.length<size){for(const i of TerritoryGeometry.get(queue.shift()).neighbors)if(!tiles.includes(i)&&!occupied(i)&&TerritoryGeometry.get(i).landArea>1&&allowed(race,i)){tiles.push(i);queue.push(i);if(tiles.length===size)break;}}
      w.realms.push({id:'realm-'+w.realms.length,name,color,tiles,capital:tiles[0],race,kind:race==='beastfolk'?'tribe':'kingdom',atWar:false,garrisons:Object.fromEntries(tiles.map(i=>[i,0])),relation:0});
    }
    for(const r of w.realms){r.race||='human';r.relation??=0;for(const i of r.tiles)for(let n=0;n<3;n++)create(r.race,r.id,i);}
    for(const race of ['lamia','harpy','kobold'])for(let n=0;n<2;n++){
      const pool=free(race).filter(p=>!w.habitats.some(h=>h.tile===p.index)),p=pool[Math.floor(pool.length*(.2+n*.45))];if(!p)continue;
      w.habitats.push({race,tile:p.index});for(let j=0;j<2;j++)create(race,null,p.index);
    }
    w.societyVersion=1;sync();
  }
  function garrison(realm,index){return all().filter(p=>p.realm===realm&&p.location===index&&p.alive&&!p.capturedBy&&!state.warfare.raids.some(a=>a.status!=='done'&&a.men.includes(p.id)));}
  function guards(realm,index){if(state.warfare.armies.some(a=>a.status==='battle'&&a.target===index))return [];return garrison(realm,index).filter(p=>WarCombat.fit(p)&&!state.warfare.raids.some(a=>a.status!=='done'&&a.defenders?.includes(p.id)));}
  function sync(){for(const r of state.warfare.realms)for(const i of r.tiles)r.garrisons[i]=garrison(r.id,i).filter(WarCombat.fit).reduce((n,p)=>n+WarCombat.strength(p),0);}
  function join(p,realm='crown'){
    if(realm==='crown'){
      if(alive().length>=capacity())return false;
      state.warfare.people=all().filter(x=>x.id!==p.id);p.realm=null;p.capturedBy=null;p.job='idle';p.houseHead=p.id;p.liege=state.king;p.social=0;p.loyalty=60;p.source={type:'adult',day:state.day};p.location=undefined;
      state.people.push(p);if(typeof ensurePerson==='function')ensurePerson(p);
    }else {p.realm=realm;p.capturedBy=null;}
    return true;
  }
  function recruit(id){const p=all().find(p=>p.id===id);if(!p?.alive||p.realm||p.capturedBy||!own(p.location))return false;return join(p);}
  function persuade(id){
    const p=all().find(p=>p.id===id);if(!p?.alive||p.capturedBy!=='crown'||p.lastPersuasion===state.day||state.gold<2||state.food<5)return false;
    p.lastPersuasion=state.day;state.gold-=2;state.food-=5;
    const king=by(state.king),skill=king?.alive&&!king.capturedBy?Math.sqrt(WarCombat.strength(king)):1;
    p.persuasion=Math.min(100,(p.persuasion||0)+Math.max(4,Math.min(20,8+skill-(p.rank||0)*2)));
    if(p.persuasion>=100&&join(p))Warfare.report(p.name+' aceitou integrar o reino após as negociações.');
    return true;
  }
  function ransom(id){const p=state.people.find(p=>p.id===id);if(!p?.capturedBy||state.gold<30)return false;state.gold-=30;p.capturedBy=null;p.hp=Math.max(30,p.hp);return true;}
  function visible(p){return state.people.includes(p)||p.capturedBy==='crown'||(!p.realm?own(p.location):state.warfare.realms.find(r=>r.id===p.realm)?.ally||state.warfare.intel[p.realm]?.until>=state.day);}
  function spy(id){const r=state.warfare.realms.find(r=>r.id===id);if(!r||state.gold<15||state.warfare.intel[id]?.pending)return false;state.gold-=15;state.warfare.intel[id]={pending:true,ready:state.day+3,until:0};return true;}
  function treaty(id,action){const r=state.warfare.realms.find(r=>r.id===id);if(!r)return false;
    if(action==='alliance'){if(r.atWar||r.relation<0||state.gold<25)return false;state.gold-=25;r.ally=true;r.relation=Math.min(100,r.relation+30);}
    else {r.relation=Math.max(-100,r.relation-30);if(r.relation<=-25){r.ally=false;r.atWar=true;}}
    Warfare.report(r.name+': relação '+r.relation+(r.atWar?' · hostil':r.ally?' · aliado':' · neutro')+'.');return true;
  }
  function tick(){
    ensure();const w=state.warfare;
    for(const info of Object.values(w.intel))if(info.pending&&state.day>=info.ready){info.pending=false;info.until=state.day+48;Warfare.report('Espiões retornaram: fichas inimigas disponíveis por um ano.');}
    for(const p of all())if(p.alive&&!p.capturedBy){
      p.age+=1/48;
      if(!w.raids.some(a=>a.status!=='done'&&a.men.includes(p.id))&&!w.armies.some(a=>a.status==='battle'&&a.target===p.location)&&!w.raids.some(a=>a.status==='battle'&&a.target===p.location))p.hp=Math.min(100,p.hp+1);
      if(p.realm&&state.day%12===0)WarCombat.train(p,12);
      if(!p.realm&&state.day%4===0&&!w.habitats.some(h=>h.tile===p.location&&h.race===p.race)){
        const neighbors=TerritoryGeometry.get(p.location).neighbors.filter(i=>TerritoryGeometry.get(i).price!==null);if(neighbors.length)p.location=pick(neighbors);
        const r=Warfare.owner(p.location);if(r&&Math.random()<.3){join(p,r.id);Warfare.report(r.name+' recrutou um viajante.');}
        else {const lord=alive().find(x=>x.id!==state.king&&x.social>=2&&(x.tiles||[]).includes(p.location));if(lord&&Math.random()<.3&&join(p)){p.liege=lord.id;p.houseHead=p.id;}}
      }
    }
    if(state.day%24===0&&all().filter(p=>p.alive&&!p.realm&&!p.capturedBy).length<24){
      const land=TerritoryGeometry.all().provinces.filter(p=>p.price!==null);const p=pick(land);create(pick(ACTIVE_RACES),null,p.index);
    }
    if(state.day%48===0)for(const r of w.realms){
      const border=r.tiles.some(i=>TerritoryGeometry.get(i).neighbors.some(n=>Warfare.owned().has(n)));
      if(border&&!r.atWar&&Math.random()<.25){r.relation=Math.max(-100,r.relation-(r.ally?10:15));if(r.relation<=-25){r.ally=false;r.atWar=true;}Warfare.report('Disputa de fronteira com '+r.name+': relação '+r.relation+(r.atWar?' · guerra declarada.':'.'));}
    }
    if(state.day%48===0)for(const r of w.realms)if(r.tiles.length&&all().filter(p=>p.alive&&p.realm===r.id).length<r.tiles.length*3)create(r.race,r.id,r.capital);
    sync();
  }
  function elfMarriage(realmId,royalId,elfId){
    const r=state.warfare.realms.find(r=>r.id===realmId),a=by(royalId),b=all().find(p=>p.id===elfId);
    if(!r?.ally||!a||!adult(a)||a.capturedBy||!(a.id===state.king||bloodDescendant(a,state.king))||!b||b.realm!==r.id||b.caste!=='baixa'||!WarCombat.fit(b)||b.partners.length||a.sex===b.sex||Betrothals.forPerson(a.id)||related(a,b)||alive().length>=capacity()||r.lastMarriageProposal===state.day)return false;
    if(!isHead(a)&&partners(a).length)return false;
    r.lastMarriageProposal=state.day;
    if(Math.random()>.7){Warfare.report('O pretendente élfico recusou a proposta de união.');return true;}
    const former={houseHead:b.houseHead,liege:b.liege,social:b.social,realm:b.realm,location:b.location};
    if(!join(b))return false;
    const oldHead=a.houseHead;
    if(!partners(a).length)a.houseHead=a.id;
    if(!unite(a,b)){a.houseHead=oldHead;state.people=state.people.filter(p=>p.id!==b.id);Object.assign(b,former);all().push(b);return false;}
    r.relation=Math.min(100,r.relation+10);return true;
  }
  return {all,by,own,allowed,ensure,create,garrison,guards,sync,join,recruit,persuade,ransom,visible,spy,treaty,tick,elfMarriage};
})();
