'use strict';
const FrontierAI = (() => {
  function defenders(index){
    const owner=Warfare.owner(index);
    if(owner)return WorldSocieties.garrison(owner.id,index);
    if(!Warfare.owned().has(index))return [];
    const lord=alive().find(p=>p.id!==state.king&&p.social>=2&&(p.tiles||[]).includes(index));
    return (lord?domainPeople(lord):alive().filter(p=>!p.liege||p.liege===state.king||p.id===state.king)).filter(p=>p.alive&&adult(p)&&!onMission(p)).slice(0,12);
  }
  function tick(){
    const w=state.warfare;
    for(const raid of w.raids){
      if(raid.status==='done')continue;
      const realm=w.realms.find(r=>r.id===raid.realm),attackers=raid.men.map(WorldSocieties.by).filter(WarCombat.fit);
      if(!realm?.tiles.includes(raid.origin)||!attackers.length){raid.status='done';continue;}
      if(raid.status==='march'){raid.status='battle';continue;}
      const targetOwner=Warfare.owner(raid.target);
      if(targetOwner?.id===realm.id||(!targetOwner&&Warfare.owned().has(raid.target)&&!realm.atWar)){raid.status='done';continue;}
      const defenderRealm=targetOwner?.id||'crown';
      if(!raid.defenders||raid.defenderRealm!==defenderRealm){raid.defenders=defenders(raid.target).map(p=>p.id);raid.defenderRealm=defenderRealm;}
      const defense=raid.defenders.map(WorldSocieties.by).filter(p=>p?.alive&&!p.capturedBy),winner=WarCombat.round(attackers,defense);raid.round++;
      if(winner==='left'){
        raid.status='done';
        if(typeof LocalRecruitment==='undefined')WarCombat.capture(defense,realm.id);else WarCombat.capture(defense.filter(p=>state.people.includes(p)),realm.id);Warfare.conquer(raid.target,realm.id);
        for(const p of attackers.filter(p=>p.alive&&!p.capturedBy))p.location=raid.target;
        raid.status='done';Warfare.report(realm.name+' conquistou a Vila '+(raid.target+1)+'.');
      }else if(winner==='right'){
        WarCombat.capture(raid.men.map(WorldSocieties.by).filter(Boolean),targetOwner?.id||'crown');
        raid.status='done';Warfare.report('Ataque de '+realm.name+' repelido na Vila '+(raid.target+1)+'.');
      }else if(raid.round>=10){raid.status='done';Warfare.report(realm.name+' interrompeu uma incursão após resistência prolongada.');}
    }
    w.raids=w.raids.filter(r=>r.status!=='done');
    if(state.day%12)return;
    for(const realm of w.realms){
      if(w.raids.some(r=>r.realm===realm.id)||!realm.tiles.length)continue;
      const choices=[];
      for(const origin of realm.tiles){const men=WorldSocieties.guards(realm.id,origin);if(men.length<2)continue;
        for(const target of TerritoryGeometry.get(origin).neighbors){
          if(typeof CommunityLife!=='undefined'&&CommunityLife.list().some(c=>c.claim&&c.tile===target))continue;
          if(TerritoryGeometry.get(target).price===null||!WorldSocieties.allowed(realm.race,target)||realm.tiles.includes(target)||w.raids.some(r=>r.target===target))continue;
          const enemy=Warfare.owner(target),player=Warfare.owned().has(target);
          if(player&&!realm.atWar)continue;
          if(enemy?.ally&&realm.ally)continue;
          if(!Warfare.route([origin],target,enemy?.id))continue;
          choices.push({origin,target,men:men.slice(0,8).map(p=>p.id),priority:player?0:enemy?1:2});
        }
      }
      choices.sort((a,b)=>a.priority-b.priority);const choice=choices[0];if(!choice)continue;
      w.raids.push({...choice,id:'raid-'+w.nextId++,realm:realm.id,status:'march',round:0});
      Warfare.report(realm.name+' iniciou uma incursão contra a Vila '+(choice.target+1)+'.');
    }
  }
  return {tick,defenders};
})();
