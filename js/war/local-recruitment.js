'use strict';
globalThis.LocalRecruitment = (() => {
  const all=()=>WorldSocieties.all();
  function deployed(p) { return Warfare.deployed(p.id) || state.warfare.raids.some(r=>r.status!=='done'&&[...r.men,...(r.defenders||[])].includes(p.id)); }
  function local(p) { return p?.alive && Warfare.owned().has(p.location) && !deployed(p) && (!p.realm || p.capturedBy==='crown'); }
  function settle(tile,winner,previous) {
    for(const p of all().filter(p=>p.alive&&p.location===tile&&p.realm&&p.realm!==winner&&!p.capturedBy&&!deployed(p))){
      if(previous&&p.realm!==previous)continue;
      p.formerRealm=p.realm;p.realm=null;delete p.communityId;
      if(Math.random()<.5){p.capturedBy=winner;p.persuasion=0;p.capturedDay=state.day;assignCustody(p);}
      else {p.capturedBy=null;p.residentStatus='wanderer';}
    }
  }
  function reconcile() {
    for(const p of all())if(p.alive&&p.realm&&!p.capturedBy&&!deployed(p)&&!state.warfare.realms.find(r=>r.id===p.realm)?.tiles.includes(p.location)){
      // Resolve stranded foreign troops from old campaigns without relocating active armies.
      p.formerRealm=p.realm;p.realm=null;p.residentStatus='wanderer';
    }
  }
  function custodian(p) {
    if(p?.capturedBy!=='crown')return null;
    const lord=state.people.find(x=>x.id===p.custodianId);
    return lord?.alive&&!lord.away&&lord.social>=2&&lord.tiles?.length?lord:null;
  }
  function assignCustody(p) {
    delete p.custodianId;
    if(p.capturedBy!=='crown')return;
    const lord=alive().find(x=>x.id!==state.king&&x.social>=2&&(x.tiles||[]).includes(p.location));
    if(lord)p.custodianId=lord.id;
  }
  function custodyLabel(p){const lord=custodian(p);return lord?'Casa '+lord.family+' · '+lord.name:'Coroa';}
  function custodyTick() {
    for(const p of all()){
      if(p.capturedBy!=='crown'){delete p.custodianId;continue;}
      if(p.custodianId&&!custodian(p)){delete p.custodianId;Warfare.report('A Coroa assumiu a custódia de '+p.name+' após o fim da autoridade do guardião.');}
    }
    if(state.day%12!==0||state.lastCustodyDay===state.day)return;
    state.lastCustodyDay=state.day;
    const acted=new Set();
    for(const p of all()) {const lord=custodian(p);if(!lord||acted.has(lord.id)||blocked(p,lord))continue;acted.add(lord.id);offer(p.id,lord);}
  }
  function release(id,lord=null){
    const p=all().find(x=>x.id===id);
    if(!p?.alive||p.capturedBy!=='crown'||deployed(p)||(custodian(p)?.id||null)!==(lord?.id||null))return false;
    p.formerRealm ||= p.realm;p.realm=null;p.capturedBy=null;delete p.custodianId;p.residentStatus='wanderer';p.nextOfferDay=state.day+4;
    Warfare.report(p.name+' foi libertado por '+(lord?'Casa '+lord.family:'Coroa')+'.');return true;
  }
  const account=lord=>lord.id===state.king?state:lord.treasury;
  function negotiators(){return alive().filter(p=>!p.capturedBy&&(p.id===state.king||p.social>=2&&p.tiles?.length));}
  function quote(p,buyer){
    const seller=custodian(p)||WorldSocieties.by(state.king),price=20+10*(p?.rank||0);
    let reason='';
    if(!p?.alive||!all().includes(p)||p.capturedBy!=='crown'||deployed(p))reason='Prisioneiro indisponível.';
    else if(!negotiators().includes(buyer)||!negotiators().includes(seller))reason='Casa indisponível.';
    else if(buyer.id===seller.id)reason='A casa já é responsável pela custódia.';
    else if((p.nextCustodyDay||0)>state.day)reason='Nova negociação no dia '+p.nextCustodyDay+'.';
    else if(typeof Betrothals!=='undefined'&&Betrothals.relation(seller.id,buyer.id)<=-25)reason='O guardião recusa negociar enquanto houver desavença entre as casas.';
    else if((account(buyer)?.gold||0)<price)reason='O cofre comprador não dispõe de '+price+' ouro.';
    else if(buyer.id===state.king&&!(state.royalLands||[]).length)reason='A Coroa precisa de terras para receber o prisioneiro.';
    return {price,seller:seller?.id,buyer:buyer?.id,reason};
  }
  function negotiate(id,buyerId,mode,expectedSeller){
    if(!['transfer','ransom'].includes(mode))return false;
    const p=all().find(p=>p.id===id),buyer=WorldSocieties.by(buyerId),q=quote(p,buyer);
    if(q.reason||q.seller!==expectedSeller)return false;
    const seller=WorldSocieties.by(q.seller),from=account(buyer),to=account(seller);
    if(!to)return false;
    from.gold-=q.price;to.gold=(to.gold||0)+q.price;
    if(buyer.id===state.king)delete p.custodianId;else p.custodianId=buyer.id;
    p.location=buyer.id===state.king?state.royalLands[0]:buyer.tiles[0];
    p.nextCustodyDay=state.day+4;
    if(mode==='ransom')release(p.id,buyer.id===state.king?null:buyer);
    Warfare.report(buyer.name+' pagou '+q.price+' ouro a '+seller.name+' por '+(mode==='ransom'?'resgate e libertação':'transferência de custódia')+' de '+p.name+'.');
    return true;
  }
  function chance(p,lord=null) {
    const ruler=lord||WorldSocieties.by(state.king),bonus=ruler?.alive&&!ruler.capturedBy?Math.min(.12,Math.sqrt(WarCombat.strength(ruler))/100):0;
    return Math.round(Math.max(.1,Math.min(.9,(p.capturedBy ? .25 : .60)+bonus-(p.rank||0)*.07+(p.persuasion||0)*.004))*100);
  }
  function blocked(p,lord) {
    if(!p?.alive||!all().includes(p)||deployed(p))return 'Personagem indisponível ou mobilizado.';
    if(p.capturedBy&&p.capturedBy!=='crown')return 'Sob custódia de outra facção.';
    if(p.realm&&!p.capturedBy)return 'Ainda integra um exército estrangeiro.';
    if(lord){if(!alive().includes(lord)||lord.id===state.king||lord.social<2||lord.capturedBy||!(lord.tiles||[]).length||(p.capturedBy?custodian(p)?.id!==lord.id:!(lord.tiles||[]).includes(p.location)))return 'Fora da autoridade desta casa.';}
    else if(custodian(p))return 'A negociação compete à casa guardiã.';
    else if(p.capturedBy!=='crown'&&!local(p))return 'Fora das terras do reino.';
    if((p.nextOfferDay||0)>state.day)return 'Nova proposta no dia '+p.nextOfferDay+'.';
    if(alive().length>=capacity())return 'É necessário espaço de moradia.';
    const funds=lord?(lord.treasury||{}):state;
    if(p.capturedBy==='crown'&&((funds.gold||0)<2||(funds.food||0)<5))return 'A negociação exige 2 ouro e 5 alimentos.';
    return '';
  }
  function depart(p) {
    const destinations=TerritoryGeometry.get(p.location).neighbors.filter(i=>TerritoryGeometry.get(i).price!==null);
    if(!destinations.length)return false;
    p.location=pick(destinations);p.formerRealm ||= p.realm;p.realm=null;p.capturedBy=null;delete p.custodianId;delete p.communityId;p.residentStatus='wanderer';p.departedDay=state.day;
    return true;
  }
  function offer(id,lord=null) {
    const p=all().find(p=>p.id===id);if(blocked(p,lord))return false;
    const odds=chance(p,lord),prisoner=p.capturedBy==='crown';
    p.nextOfferDay=state.day+4;p.lastPersuasion=state.day;
    if(prisoner){const funds=lord?lord.treasury:state;funds.gold-=2;funds.food-=5;}
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
  return {local,settle,reconcile,chance,blocked,offer,deployed,custodian,assignCustody,custodyLabel,custodyTick,release,negotiators,quote,negotiate};
})();
