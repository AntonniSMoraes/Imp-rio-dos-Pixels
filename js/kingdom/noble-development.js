'use strict';

const NobleDevelopment = (() => {
  function allocate(lord, person, rank) {
    const lands=personalLands(lord), seat=lord.territory??lord.tiles?.[0];
    const available=lands.filter(i=>i!==seat&&TerritoryGeometry.get(i)?.price!==null);
    const existing=person.tiles||[], needed=Math.max(0,(LAND_SIZE[rank]||1)-existing.length);
    if(!needed)return null;
    for(const start of available) {
      const selected=[],queue=existing.length?[...existing]:[start],seen=new Set(queue);
      while(queue.length&&selected.length<needed) {
        const tile=queue.shift();
        if(available.includes(tile))selected.push(tile);
        for(const i of TerritoryGeometry.get(tile)?.neighbors||[])if(available.includes(i)&&!seen.has(i)){seen.add(i);queue.push(i);}
      }
      if(selected.length===needed&&areTilesConnected([...existing,...selected])&&areTilesConnected(lands.filter(i=>!selected.includes(i))))return selected;
    }
    return null;
  }
  function shortage(lord) {
    const purse=lord.treasury||{};
    return ['food','wood','iron'].sort((a,b)=>(purse[a]||0)-(purse[b]||0))[0];
  }
  function tick() {
    if(state.day%12 || state.lastNobleDevelopmentDay===state.day)return;
    state.lastNobleDevelopmentDay=state.day;
    for(const lord of alive().filter(p=>p.id!==state.king&&p.social>=2&&!Peerage.consort(p)&&p.tiles?.length)) {
      const candidate=direct(lord).filter(p=>adult(p)&&!Peerage.consort(p)&&!onMission(p)&&p.social<lord.social-1).sort((a,b)=>(b.level||0)-(a.level||0))[0];
      if(!candidate)continue;
      const rank=Math.max(2,candidate.social+1), grant=allocate(lord,candidate,rank);
      if(grant) {
        const result=grantDescendantLand(lord.id,candidate.id,rank,grant,true);
        if(result.ok){candidate.order=shortage(lord);for(const worker of alive().filter(p=>p.liege===candidate.id&&p.jobMode!=='manual'))worker.job=candidate.order;}
        continue;
      }
      const owned=Warfare.owned();
      const border=[...new Set(personalLands(lord).flatMap(i=>TerritoryGeometry.get(i)?.neighbors||[]))];
      const options=border.filter(i=>!owned.has(i)&&!Warfare.owner(i)&&TerritoryGeometry.get(i)?.price!==null).sort((a,b)=>TerritoryGeometry.get(a).price-TerritoryGeometry.get(b).price);
      const tile=options.find(i=>(lord.treasury?.gold||0)>=TerritoryGeometry.get(i).price);
      if(tile===undefined)continue;
      lord.treasury.gold-=TerritoryGeometry.get(tile).price;lord.tiles.push(tile);
      state.royalLands=[...new Set([...(state.royalLands||[]),tile])];
      log(lord.name+' comprou a Vila '+(tile+1)+' com recursos de sua casa para ampliar seu domínio.');
    }
  }
  return {tick,allocate,shortage};
})();
