'use strict';
// Territorial warfare is independent of the old four-person wolf expedition.
globalThis.Warfare = (() => {
  const tile = i => TerritoryGeometry.get(i);
  const owned = () => new Set([...(state.royalLands||[]),...alive().filter(p=>p.social>=2).flatMap(p=>p.tiles||[])].filter(i=>tile(i)));
  function ensure() {
    if(!state || state.warfare)return;
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
  function deployed(id){return Boolean(state?.warfare?.armies.some(a=>a.status!=='done'&&a.men.includes(id)));}
  function candidates(lord){return domainPeople(lord).filter(p=>adult(p)&&p.hp>=30&&!onMission(p));}
  function declare(id){ensure();const realm=state.warfare.realms.find(r=>r.id===id);if(!realm||!realm.tiles.length)return false;realm.atWar=true;report('A Coroa declarou guerra ao '+realm.name+'.');return true;}
  function mobilize(commanderId,target,men){
    ensure();const lord=byId(commanderId),enemy=owner(target),fail=message=>({ok:false,message});
    if(!lord?.alive||!adult(lord)||(lord.id!==state.king&&lord.social<2)||onMission(lord))return fail('Escolha um regente ou nobre adulto disponível.');
    if(!enemy?.atWar)return fail('Declare guerra ao reino antes de mobilizar.');
    if(state.warfare.armies.filter(a=>a.status!=='done').length>=12)return fail('O limite desta versão é de 12 exércitos simultâneos.');
    if(!state.buildings.barracks)return fail('Construa um quartel antes de mobilizar.');
    if(state.warfare.armies.some(a=>a.status!=='done'&&a.target===target))return fail('Já existe um exército destinado a esta província.');
    const allowed=new Set(candidates(lord).map(p=>p.id));
    if(!Array.isArray(men)||men.length<2||men.length>12||new Set(men).size!==men.length||!men.includes(lord.id)||men.some(id=>!allowed.has(id)))return fail('Selecione de 2 a 12 adultos do domínio, incluindo o comandante.');
    const origins=lord.id===state.king?[...owned()]:personalLands(lord),path=route(origins,target,enemy.id);
    if(!path)return fail('Não há rota terrestre até esse território. Expanda suas terras ou escolha outro alvo.');
    const food=10+men.length*2;if(state.gold<10||state.food<food)return fail('Mobilização exige 10 ouro e '+food+' alimentos da Coroa.');
    state.gold-=10;state.food-=food;
    const army={id:state.warfare.nextId++,commander:lord.id,men:[...men],realm:enemy.id,target,path,step:0,status:'march',round:0,enemy:enemy.garrisons[target]||12};
    state.warfare.armies.push(army);report(lord.name+' mobilizou '+men.length+' combatentes rumo à Vila '+(target+1)+'.');return {ok:true,message:'Exército mobilizado. A marcha avança com os dias.'};
  }
  function recall(id){const a=state.warfare?.armies.find(a=>a.id===id&&a.status!=='done');if(!a||a.status==='return')return false;a.path=a.path.slice(0,a.step+1).reverse();a.step=0;a.status='return';report('O exército de '+(byId(a.commander)?.name||'um nobre')+' iniciou o retorno.');return true;}
  function tick(){
    ensure();
    for(const a of state.warfare.armies){
      if(a.status==='done')continue;
      const men=a.men.map(byId).filter(p=>p?.alive);if(!men.length){a.status='done';report('Um exército foi destruído.');continue;}
      if(a.status==='return'){a.step++;if(a.step>=a.path.length-1){a.step=Math.max(0,a.path.length-1);a.status='done';report('As tropas sobreviventes retornaram ao domínio.');}continue;}
      const ration=Math.ceil(men.length/4);if(state.food<ration){recall(a.id);report('Falta de provisões: marcha interrompida.');continue;}state.food-=ration;
      if(!byId(a.commander)?.alive){recall(a.id);continue;}
      const enemy=owner(a.target);if(!enemy||enemy.id!==a.realm){recall(a.id);continue;}
      if(a.status==='march'){a.step=Math.min(a.step+1,a.path.length-1);if(a.step===a.path.length-1){a.status='battle';a.enemy=enemy.garrisons[a.target]??12;}continue;}
      const strength=men.reduce((sum,p)=>sum+Math.sqrt(Math.max(1,power(p))),0),defense=a.enemy;
      a.enemy=Math.max(0,a.enemy-strength*.24);a.round++;
      const damage=Math.max(3,Math.min(28,defense/strength*12));
      for(const p of men){p.hp=Math.max(0,p.hp-damage);if(p.hp===0)death(p,'na guerra pela Vila '+(a.target+1));}
      enemy.garrisons[a.target]=a.enemy;
      if(!men.some(p=>p.alive)){a.status='done';report('Derrota na Vila '+(a.target+1)+'.');continue;}
      if(a.enemy<=0){
        enemy.tiles=enemy.tiles.filter(i=>i!==a.target);delete enemy.garrisons[a.target];
        state.royalLands=[...new Set([...(state.royalLands||[]),a.target])];
        if(enemy.capital===a.target)enemy.capital=enemy.tiles[0]??null;
        report('Vitória! Vila '+(a.target+1)+' conquistada para a Coroa.'+(enemy.tiles.length?'':' '+enemy.name+' foi derrotado.'));
        recall(a.id);
      }else if(a.round>=10||!byId(a.commander)?.alive||men.every(p=>!p.alive||p.hp<25)){report('O exército recuou após o combate.');recall(a.id);}
    }
    state.warfare.armies=state.warfare.armies.filter(a=>a.status!=='done'||state.warfare.armies.indexOf(a)>=state.warfare.armies.length-10);
    for(const realm of state.warfare.realms)for(const i of realm.tiles)if(!state.warfare.armies.some(a=>a.target===i&&a.status==='battle'))realm.garrisons[i]=Math.min(12,(realm.garrisons[i]||0)+.3);
  }
  return {ensure,owner,route,deployed,candidates,declare,mobilize,recall,tick};
})();
