'use strict';
// Communities reside inside provinces; sovereignty changes only after a claim wins.
globalThis.CommunityLife = (() => {
  const active = c => c.status === 'settled' || c.status === 'claiming';
  const members = c => WorldSocieties.all().filter(p => p.alive && !p.capturedBy && !p.realm && p.communityId === c.id && p.location === c.tile);
  const owner = i => Warfare.owner(i)?.id || (Warfare.owned().has(i) ? 'crown' : 'free');
  const list = () => state.warfare.communities || [];
  function ensure() {
    const w = state.warfare;
    if (w.communityVersion === 1) return;
    w.communities = []; w.nextCommunityId = 1; w.communityVersion = 1;
    w.lastCommunityDay = state.day; w.nextCommunityDay = state.day + 24;
  }
  function deployed(id) {
    return list().some(c => c.claim && [...c.claim.men,...c.claim.defenders].includes(id));
  }
  function contested(tile) {
    return list().some(c => c.claim && c.tile === tile) || state.warfare.raids.some(r => r.status !== 'done' && r.target === tile) || state.warfare.armies.some(a => a.status !== 'done' && a.target === tile);
  }
  function create(race, tile) {
    ensure();
    const w = state.warfare;
    if (!RACES[race] || !WorldSocieties.allowed(race,tile) || TerritoryGeometry.get(tile)?.price == null || list().some(c => active(c) && c.tile === tile) || list().filter(active).length >= 16 || list().length >= 128 || WorldSocieties.all().length > 8996 || contested(tile)) return null;
    const id = 'community-' + w.nextCommunityId++;
    const c = {id,name:'Comunidade ' + (RACES[race].name || race) + ' da Vila ' + (tile+1),race,tile,created:state.day,lastGrowth:state.day,nextClaimDay:state.day+48,status:'settled',realm:null,claim:null,treasury:{wood:0,iron:0,food:20,gold:10}};
    w.communities.push(c);
    for (let n=0;n<3;n++) { const p=WorldSocieties.create(race,null,tile); p.communityId=id; }
    Warfare.report(c.name + ' se estabeleceu no território.');
    return c;
  }
  function spawn() {
    const races=ACTIVE_RACES.filter(r => r!=='human' && RACES[r]);
    const race=pick(races);
    const candidates=TerritoryGeometry.all().provinces.filter(p => p.price !== null && p.landArea>2 && WorldSocieties.allowed(race,p.index) && !list().some(c=>active(c)&&c.tile===p.index) && !contested(p.index));
    const titled=new Set(alive().filter(p=>p.id!==state.king&&p.social>=2).flatMap(p=>p.tiles||[]));
    // A kingdom's unassigned provinces remain eligible. Feudal occupancy lowers weight.
    const weight=p=>titled.has(p.index)?1:6;
    let ticket=Math.random()*candidates.reduce((n,p)=>n+weight(p),0);
    for(const p of candidates){ticket-=weight(p);if(ticket<0)return create(race,p.index);}
    return null;
  }
  function chronicle(c,type,message) {
    if(owner(c.tile)!=='crown'||typeof FamilyChronicle==='undefined')return;
    const lord=alive().find(p=>p.id!==state.king&&p.social>=2&&(p.tiles||[]).includes(c.tile));
    FamilyChronicle.record(type,[byId(state.king),lord],message,{tile:c.tile});
  }
  function claim(c) {
    if (!c || c.status!=='settled' || state.day<c.nextClaimDay || state.warfare.realms.length>=64 || contested(c.tile) || c.treasury.food<30 || c.treasury.gold<20) return false;
    const men=members(c).filter(p=>WarCombat.fit(p)&&!Warfare.deployed(p.id));
    if(men.length<4)return false;
    c.treasury.food-=30;c.treasury.gold-=20;c.status='claiming';
    c.claim={owner:owner(c.tile),ready:state.day+4,round:0,men:men.slice(0,8).map(p=>p.id),defenders:[]};
    chronicle(c,'claim',c.name+' reivindicou a Vila '+(c.tile+1)+'. A mobilização termina em quatro dias.');
    Warfare.report(c.name+' reivindicou a Vila '+(c.tile+1)+'. Mobilização em quatro dias.');
    return true;
  }
  function finish(c,status='settled') { c.claim=null;c.status=status;c.nextClaimDay=state.day+48; }
  function nation(c, defense) {
    const w=state.warfare,old=c.claim.owner;
    const id='realm-'+(Math.max(-1,...w.realms.map(r=>Number(r.id.slice(6))))+1);
    const population=members(c),leader=[...population].sort((a,b)=>WarCombat.strength(b)-WarCombat.strength(a))[0];
    const realm={id,name:'Nação '+(leader?.family||c.race)+' da Vila '+(c.tile+1),color:'#62bda6',race:c.race,kind:'nation',tiles:[],capital:null,atWar:old==='crown',ally:false,relation:old==='crown'?-60:0,garrisons:{},leader:leader.id,communityId:c.id,founded:state.day,treasury:{...c.treasury}};
    w.realms.push(realm);
    for(const p of population){p.realm=id;delete p.communityId;}
    WarCombat.capture(defense,id);
    Warfare.conquer(c.tile,id);
    c.realm=id;c.treasury={wood:0,iron:0,food:0,gold:0};finish(c,'nation');
    WorldSocieties.sync();
    Warfare.report(realm.name+' foi fundada após vencer a reivindicação territorial.');
    if(old==='crown'&&typeof FamilyChronicle!=='undefined')FamilyChronicle.record('foundation',[byId(state.king)],realm.name+' se tornou independente na Vila '+(c.tile+1)+'.',{tile:c.tile});
  }
  function battle(c) {
    const q=c.claim;
    if(owner(c.tile)!==q.owner){Warfare.report(c.name+' suspendeu a reivindicação após a mudança de soberania.');finish(c);return;}
    if(state.day<q.ready)return;
    const attackers=q.men.map(WorldSocieties.by).filter(WarCombat.fit);
    if(!q.round)q.defenders=FrontierAI.defenders(c.tile).slice(0,12).map(p=>p.id);
    const defense=q.defenders.map(WorldSocieties.by).filter(p=>p?.alive&&!p.capturedBy);
    const result=WarCombat.round(attackers,defense);q.round++;
    if(result==='left'&&state.warfare.realms.length<64){chronicle(c,'conflict',c.name+' venceu a guerra de reivindicação.');nation(c,defense);return;}
    if(result==='right'){
      chronicle(c,'conflict',c.name+' foi derrotada na guerra de reivindicação.');
      if(q.owner!=='free')WarCombat.capture(q.men.map(WorldSocieties.by).filter(Boolean),q.owner);
      Warfare.report(c.name+' perdeu a guerra de reivindicação.');finish(c,members(c).length?'settled':'dispersed');
    }else if(q.round>=10){chronicle(c,'conflict',c.name+' recuou após a resistência local.');Warfare.report(c.name+' recuou após dez rodadas de combate.');finish(c);}
  }
  function tick() {
    ensure();const w=state.warfare;
    if(w.lastCommunityDay===state.day)return;
    w.lastCommunityDay=state.day;
    for(const c of list().filter(active)){
      if(c.claim){battle(c);continue;}
      const residents=members(c);
      if(!residents.length){finish(c,'dispersed');continue;}
      c.treasury.food=Math.min(200,c.treasury.food+residents.length*.6);
      c.treasury.gold=Math.min(100,c.treasury.gold+residents.length*.12);
      if(state.day-c.lastGrowth>=24){
        c.lastGrowth=state.day;
        if(residents.length<8&&WorldSocieties.all().length<9000){const p=WorldSocieties.create(c.race,null,c.tile);p.communityId=c.id;Warfare.report('Um novo morador chegou à '+c.name+'.');}
      }
      if(state.day>=c.nextClaimDay&&state.day%12===0&&Math.random()<.15)claim(c);
      // Local lords may recruit residents, using the same acceptance and cooldown rules.
      if(c.status==='settled'&&state.day%12===0&&typeof LocalRecruitment!=='undefined'){
        const lord=alive().find(p=>p.id!==state.king&&p.social>=2&&(p.tiles||[]).includes(c.tile));
        const p=residents.find(p=>(p.nextOfferDay||0)<=state.day);
        if(lord&&p)LocalRecruitment.offer(p.id,lord);
      }
    }
    if(state.day>=w.nextCommunityDay){w.nextCommunityDay=state.day+24;if(Math.random()<.6)spawn();}
  }
  return {ensure,tick,create,spawn,claim,members,list,active,deployed,contested};
})();
