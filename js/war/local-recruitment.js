'use strict';
globalThis.LocalRecruitment = (() => {
  const all=()=>WorldSocieties.all();
  function deployed(p) { return Warfare.deployed(p.id) || state.warfare.raids.some(r=>r.status!=='done'&&[...r.men,...(r.defenders||[])].includes(p.id)); }
  function local(p) { return p?.alive && Warfare.owned().has(p.location) && !deployed(p) && (!p.realm || p.capturedBy==='crown'); }
  function settle(tile,winner,previous) {
    for(const p of all().filter(p=>p.alive&&p.location===tile&&p.realm&&p.realm!==winner&&!p.capturedBy&&!deployed(p))){
      if(previous&&p.realm!==previous)continue;
      p.formerRealm=p.realm;p.realm=null;delete p.communityId;
      if(Math.random()<.5){p.capturedBy=winner;p.persuasion=0;p.capturedDay=state.day;}
      else {p.capturedBy=null;p.residentStatus='wanderer';}
    }
  }
  function reconcile() {
    for(const p of all())if(p.alive&&p.realm&&!p.capturedBy&&!deployed(p)&&!state.warfare.realms.find(r=>r.id===p.realm)?.tiles.includes(p.location)){
      // Resolve stranded foreign troops from old campaigns without relocating active armies.
      p.formerRealm=p.realm;p.realm=null;p.residentStatus='wanderer';
    }
  }
  function chance(p) {
    const ruler=WorldSocieties.by(state.king),bonus=ruler?.alive&&!ruler.capturedBy?Math.min(.12,Math.sqrt(WarCombat.strength(ruler))/100):0;
    return Math.round(Math.max(.1,Math.min(.9,(p.capturedBy ? .25 : .60)+bonus-(p.rank||0)*.07+(p.persuasion||0)*.004))*100);
  }
  function blocked(p,lord) {
    if(!p?.alive||!all().includes(p)||deployed(p))return 'Personagem indisponível ou mobilizado.';
    if(p.capturedBy&&p.capturedBy!=='crown')return 'Sob custódia de outra facção.';
    if(p.realm&&!p.capturedBy)return 'Ainda integra um exército estrangeiro.';
    if(lord){if(p.capturedBy||!(lord.tiles||[]).includes(p.location))return 'Fora da autoridade desta casa.';}
    else if(p.capturedBy!=='crown'&&!local(p))return 'Fora das terras do reino.';
    if((p.nextOfferDay||0)>state.day)return 'Nova proposta no dia '+p.nextOfferDay+'.';
    if(alive().length>=capacity())return 'É necessário espaço de moradia.';
    if(p.capturedBy==='crown'&&(state.gold<2||state.food<5))return 'A negociação exige 2 ouro e 5 alimentos.';
    return '';
  }
  function depart(p) {
    const destinations=TerritoryGeometry.get(p.location).neighbors.filter(i=>TerritoryGeometry.get(i).price!==null);
    if(!destinations.length)return false;
    p.location=pick(destinations);p.formerRealm ||= p.realm;p.realm=null;p.capturedBy=null;delete p.communityId;p.residentStatus='wanderer';p.departedDay=state.day;
    return true;
  }
  function offer(id,lord=null) {
    const p=all().find(p=>p.id===id);if(blocked(p,lord))return false;
    const odds=chance(p),prisoner=p.capturedBy==='crown';
    p.nextOfferDay=state.day+4;p.lastPersuasion=state.day;
    if(prisoner){state.gold-=2;state.food-=5;}
    if(Math.random()*100<odds){
      WorldSocieties.join(p);if(lord)p.liege=lord.id;
      p.lastOfferResult='accepted';Warfare.report(p.name+' aceitou o recrutamento'+(lord?' pela Casa '+lord.family:' pela Coroa')+'.');
    }else {
      const left=Math.random()<.5&&depart(p);
      p.lastOfferResult=left?'departed':'refused';
      if(prisoner&&!left)p.persuasion=Math.min(100,(p.persuasion||0)+10);
      Warfare.report(p.name+(left?(prisoner?' recusou a proposta, foi libertado e deixou a província.':' recusou a proposta e deixou a província.'):' recusou a proposta e permaneceu '+(prisoner?'sob custódia.':'no local.')));
    }
    return true;
  }
  return {local,settle,reconcile,chance,blocked,offer,deployed};
})();
