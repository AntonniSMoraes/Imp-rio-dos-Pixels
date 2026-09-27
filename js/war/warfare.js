'use strict';
// Territorial warfare is independent of the old four-person wolf expedition.
globalThis.Warfare = (() => {
  const tile = i => TerritoryGeometry.get(i);
  const owned = () => new Set([...(state.royalLands||[]),...alive().filter(p=>p.social>=2).flatMap(p=>p.tiles||[])].filter(i=>tile(i)));
  function ensure() {
    if(!state)return;
    if(state.warfare){WorldSocieties.ensure();return;}
    const claimed=owned(), seeds=[];
    const realms=[];
    for(const [name,color,ideal] of [['Reino de Âmbar','#d16b54',150],['Reino de Vesper','#b574dc',350],['Reino de Cedro','#49bdae',450]]){
      const free=TerritoryGeometry.all().provinces.filter(p=>p.landArea>3&&!claimed.has(p.index)&&![...claimed].some(i=>tile(i).neighbors.includes(p.index)));
      free.sort((a,b)=>Math.abs(a.index-ideal)-Math.abs(b.index-ideal));
      const seed=free.find(p=>seeds.every(i=>Math.hypot(p.center[0]-tile(i).center[0],p.center[1]-tile(i).center[1])>12));if(!seed)continue;
      const tiles=[],queue=[seed.index],seen=new Set(queue);
      while(queue.length&&tiles.length<10){const i=queue.shift();if(claimed.has(i)||tile(i).landArea<1)continue;tiles.push(i);claimed.add(i);for(const n of tile(i).neighbors)if(!seen.has(n)){seen.add(n);queue.push(n);}}
      seeds.push(seed.index);realms.push({id:'realm-'+realms.length,name,color,tiles,capital:seed.index,atWar:false,garrisons:Object.fromEntries(tiles.map(i=>[i,12]))});
    }
    state.warfare={version:1,realms,armies:[],nextId:1,reports:[]};
    WorldSocieties.ensure();
  }
  function owner(index){return state?.warfare?.realms.find(r=>r.tiles.includes(index));}
  function report(message){state.warfare.reports.unshift({day:state.day,text:message});state.warfare.reports=state.warfare.reports.slice(0,40);log(message);}
  function route(starts,target,enemyId){
    const queue=starts.filter(i=>tile(i)?.price!==null&&tile(i)),parents=new Map(queue.map(i=>[i,null]));
    while(queue.length){const i=queue.shift();if(i===target){const path=[];for(let p=i;p!==null;p=parents.get(p))path.unshift(p);return path;}
      for(const n of tile(i).neighbors){const realm=owner(n);if(parents.has(n)||tile(n).price===null||(realm&&realm.id!==enemyId))continue;
        const edge=tile(i).edges.find(edge=>edge.owners.includes(n));
        if(!edge?.points.some(([x,z])=>TerritoryGeometry.height(x,z)>.17))continue;parents.set(n,i);queue.push(n);}
    }return null;
  }
  function deployed(id){return Boolean(state?.warfare?.movements?.some(m=>m.person===id) || (typeof CommunityLife!=='undefined'&&CommunityLife.deployed(id)) || state?.warfare?.armies.some(a=>a.status!=='done'&&a.men.includes(id)) || state?.warfare?.raids?.some(a=>a.status!=='done'&&a.defenders?.includes(id)));}
  function position(p){
    if(Number.isInteger(p?.location))return p.location;
    const lord=typeof AnnualEconomy!=='undefined'?AnnualEconomy.owner(p):byId(p?.liege||p?.houseHead);
    return p?.tiles?.[0]??lord?.tiles?.[0]??state.capitalIndex??({north:0,central:240,south:480}[state.region]??240);
  }
  function friendly(index){return owned().has(index)||Boolean(owner(index)?.ally&&!owner(index)?.atWar);}
  function adjacent(from,to){return tile(from)?.neighbors.includes(to)&&route([from],to,owner(to)?.id)?.length===2;}
  function atFrontier(p,target){return friendly(position(p))&&adjacent(position(p),target);}
  function candidates(lord,target){return domainPeople(lord).filter(p=>adult(p)&&p.hp>=30&&!onMission(p)&&(target===undefined||atFrontier(p,target)));}
  function dispatch(id,target){
    const p=byId(id),start=position(p),fail=message=>({ok:false,message});
    if(!p||!adult(p)||onMission(p)||!friendly(start)||!friendly(target)||start===target)return fail('Escolha um adulto disponível e um destino aliado diferente.');
    const queue=[start],parents=new Map([[start,null]]);
    while(queue.length){const here=queue.shift();if(here===target)break;for(const next of tile(here).neighbors)if(friendly(next)&&!parents.has(next)&&adjacent(here,next)){parents.set(next,here);queue.push(next);}}
    if(!parents.has(target))return fail('Não existe caminho terrestre contínuo por terras aliadas.');
    const path=[];for(let i=target;i!==null;i=parents.get(i))path.unshift(i);
    state.warfare.movements ||= [];state.warfare.movements.push({person:id,path,step:0});p.location=start;
    report(p.name+' partiu para a Vila '+(target+1)+'; viagem de '+(path.length-1)+' dias.');return {ok:true,message:'Deslocamento iniciado.'};
  }
  function moveTroops(){
    const remaining=[];
    for(const m of state.warfare.movements||[]){
      const p=byId(m.person);if(!p?.alive||p.away||p.capturedBy)continue;
      const next=m.path[m.step+1];
      if(!friendly(next)||!adjacent(m.path[m.step],next)){report('Deslocamento de '+p.name+' interrompido por mudança na rota.');continue;}
      m.step++;p.location=next;
      if(m.step===m.path.length-1)report(p.name+' chegou à Vila '+(next+1)+'.');else remaining.push(m);
    }
    state.warfare.movements=remaining;
  }
  function declare(id){ensure();const realm=state.warfare.realms.find(r=>r.id===id);if(!realm||!realm.tiles.length)return false;realm.atWar=true;realm.ally=false;realm.relation=-60;report('A Coroa declarou guerra ao '+realm.name+'.');return true;}
  function mobilize(commanderId,target,men){
    ensure();const lord=byId(commanderId),enemy=owner(target),fail=message=>({ok:false,message});
    if(!lord?.alive||!adult(lord)||(lord.id!==state.king&&lord.social<2)||onMission(lord))return fail('Escolha um regente ou nobre adulto disponível.');
    if(typeof CommunityLife!=='undefined'&&CommunityLife.list().some(c=>c.claim&&c.tile===target))return fail('Há uma reivindicação em andamento nesta província.');
    if(!enemy?.atWar)return fail('Declare guerra ao reino antes de mobilizar.');
    if(state.warfare.armies.filter(a=>a.status!=='done').length>=12)return fail('O limite desta versão é de 12 exércitos simultâneos.');
    if(!state.buildings.barracks)return fail('Construa um quartel antes de mobilizar.');
    if(state.warfare.armies.some(a=>a.status!=='done'&&a.target===target))return fail('Já existe um exército destinado a esta província.');
    const allowed=new Set(candidates(lord,target).map(p=>p.id));
    if(!Array.isArray(men)||men.length<2||men.length>12||new Set(men).size!==men.length||!men.includes(lord.id)||men.some(id=>!allowed.has(id)))return fail('Selecione de 2 a 12 adultos do domínio em terras aliadas vizinhas ao alvo, incluindo o comandante.');
    const path=[position(lord),target];
    if(!path)return fail('Não há rota terrestre até esse território. Expanda suas terras ou escolha outro alvo.');
    const food=10+men.length*2;if(state.gold<10||state.food<food)return fail('Mobilização exige 10 ouro e '+food+' alimentos da Coroa.');
    state.gold-=10;state.food-=food;
    const army={id:state.warfare.nextId++,commander:lord.id,men:[...men],realm:enemy.id,target,path,origins:Object.fromEntries(men.map(id=>[id,position(byId(id))])),step:0,status:'march',round:0,enemy:enemy.garrisons[target]||12};
    state.warfare.armies.push(army);report(lord.name+' mobilizou '+men.length+' combatentes rumo à Vila '+(target+1)+'.');return {ok:true,message:'Exército mobilizado. A marcha avança com os dias.'};
  }
  function recall(id){const a=state.warfare?.armies.find(a=>a.id===id&&a.status!=='done');if(!a||a.status==='return')return false;a.path=a.path.slice(0,a.step+1).reverse();a.step=0;a.status='return';report('O exército de '+(byId(a.commander)?.name||'um nobre')+' iniciou o retorno.');return true;}
  function tick(){
    ensure();
    moveTroops();
    for(const a of state.warfare.armies){
      if(a.status==='done')continue;
      const men=a.men.map(byId).filter(p=>p?.alive&&!p.capturedBy);if(!men.length){a.status='done';report('Um exército foi destruído.');continue;}
      if(a.status==='return'){a.step++;if(a.step>=a.path.length-1){a.step=Math.max(0,a.path.length-1);a.status='done';for(const p of men)p.location=a.origins?.[p.id]??a.path[a.step];report('As tropas sobreviventes retornaram ao domínio.');}continue;}
      const ration=Math.ceil(men.length/4);if(state.food<ration){recall(a.id);report('Falta de provisões: marcha interrompida.');continue;}state.food-=ration;
      if(!byId(a.commander)?.alive){recall(a.id);continue;}
      const enemy=owner(a.target);if(!enemy||enemy.id!==a.realm){recall(a.id);continue;}
      if(a.status==='march'){a.step=Math.min(a.step+1,a.path.length-1);if(a.step===a.path.length-1){a.status='battle';for(const p of men)p.location=a.target;a.enemy=enemy.garrisons[a.target]??12;}continue;}
      const defenders=WorldSocieties.garrison(enemy.id,a.target);
      const result=WarCombat.round(men,defenders);a.round++;
      a.enemy=defenders.filter(WarCombat.fit).reduce((n,p)=>n+WarCombat.strength(p),0);
      enemy.garrisons[a.target]=a.enemy;
      if(result==='right'){
        WarCombat.capture(men,enemy.id);a.status='done';report('Derrota na Vila '+(a.target+1)+'. Sobreviventes foram capturados.');
      }else if(result==='left'){
        if(typeof LocalRecruitment==='undefined')WarCombat.capture(defenders,'crown');conquer(a.target,'crown',byId(a.commander));
        report('Vitória! Vila '+(a.target+1)+' conquistada para a Coroa.');recall(a.id);
      }else if(a.round>=10||!byId(a.commander)?.alive){report('O exército recuou após o combate.');recall(a.id);}
    }
    state.warfare.armies=state.warfare.armies.filter(a=>a.status!=='done'||state.warfare.armies.indexOf(a)>=state.warfare.armies.length-10);
    FrontierAI.tick();
    WorldSocieties.tick();
    if(typeof CommunityLife!=="undefined")CommunityLife.tick();
  }
  function conquer(index,winner,commander){
    if(!tile(index)||!(winner==='crown'||state.warfare.realms.some(r=>r.id===winner)))return;
    const previous=owner(index);
    if(previous?.id===winner || (winner==='crown' && owned().has(index)))return;
    const formerLord=state.people.find(p=>p.alive&&(p.tiles||[]).includes(index)) || ((state.royalLands||[]).includes(index)?byId(state.king):null);
    if(typeof FamilyChronicle!=='undefined') {
      if(winner==='crown')FamilyChronicle.record('conquest',[byId(state.king),commander], 'Vila '+(index+1)+' conquistada para a Coroa'+(commander?' sob comando de '+commander.name:'')+'.',{tile:index});
      else if(formerLord)FamilyChronicle.record('loss',[formerLord,byId(state.king)],'A Casa '+formerLord.family+' perdeu a Vila '+(index+1)+' para '+(state.warfare.realms.find(r=>r.id===winner)?.name||winner)+'.',{tile:index});
    }
    if(previous){previous.tiles=previous.tiles.filter(i=>i!==index);delete previous.garrisons[index];if(previous.capital===index)previous.capital=previous.tiles[0]??null;}
    if(winner==='crown')state.royalLands=[...new Set([...(state.royalLands||[]),index])];
    else {
      state.royalLands=(state.royalLands||[]).filter(i=>i!==index);
      for(const p of state.people)if((p.tiles||[]).includes(index)){p.tiles=p.tiles.filter(i=>i!==index);p.territory=p.tiles[0]??null;}
      const realm=state.warfare.realms.find(r=>r.id===winner);if(realm){realm.tiles=[...new Set([...realm.tiles,index])];realm.capital??=index;realm.garrisons[index]=0;}
      const seat=state.capitalIndex??({north:0,central:240,south:480}[state.region]??240);
      if(seat===index){const replacement=(state.royalLands||[]).find(WorldSocieties.own);if(replacement!==undefined)state.capitalIndex=replacement;else delete state.capitalIndex;report('A capital caiu. '+(replacement!==undefined?'A corte se refugiou na Vila '+(replacement+1)+'.':'A Coroa está sem sede e precisa reconquistar terras.'));}
    }
    if(typeof LocalRecruitment!=='undefined')LocalRecruitment.settle(index,winner,previous?.id);
  }
  return {ensure,owner,owned,route,deployed,candidates,declare,mobilize,recall,tick,report,conquer,position,friendly,atFrontier,dispatch};
})();
