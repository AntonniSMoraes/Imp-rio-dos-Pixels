'use strict';
globalThis.VassalAid = (() => {
  const resources=['wood','iron','food','gold'];
  const labels={wood:'madeira',iron:'ferro',food:'alimentos',gold:'ouro'};
  function ensure(){state.aidRequests ||= [];state.aidSequence ||= 1;}
  const purse=p=>p.id===state.king?state:(p.treasury ||= {wood:0,iron:0,food:0,gold:0});
  const population=p=>Math.max(1,alive().filter(x=>AnnualEconomy.owner(x)?.id===p.id).length);
  function defect(p,reason,aid={food:15,gold:5}) {
    if(!adult(p)||p.id===state.king||onMission(p)||p.reproduction?.pregnancy)return false;
    const sponsor=state.warfare.realms.filter(r=>r.tiles.length&&resources.every(k=>(r.treasury?.[k]||0)>=(aid[k]||0))).sort((a,b)=>(b.treasury.food||0)-(a.treasury.food||0))[0];
    if(!sponsor)return false;
    for(const k of resources){sponsor.treasury[k]=(sponsor.treasury[k]||0)-(aid[k]||0);purse(p)[k]=(purse(p)[k]||0)+(aid[k]||0);}
    state.royalLands=[...new Set([...(state.royalLands||[]),...(p.tiles||[])])];
    for(const x of state.people){if(x.liege===p.id)x.liege=state.king;if(x.houseHead===p.id&&x.id!==p.id){x.houseHead=x.id;x.unionHead=null;}}
    p.away=true;p.realm=sponsor.id;p.location=sponsor.capital;p.defection={day:state.day,reason,realm:sponsor.id};
    p.tiles=[];p.territory=null;p.social=0;p.liege=null;p.houseHead=p.id;p.unionHead=null;p.job='idle';delete p.promotionRequest;
    state.proposals=(state.proposals||[]).filter(x=>x.person!==p.id&&x.recipient!==p.id);
    log(p.name+' desertou para '+sponsor.name+', que forneceu auxílio. Motivo: '+reason+'. Suas terras voltaram à Coroa.');
    if(typeof FamilyChronicle!=='undefined')FamilyChronicle.record('defection',[p,byId(state.king)],p.name+' desertou para '+sponsor.name+': '+reason+'.');
    return true;
  }
  function shortage(p){const stock=purse(p);return ['food','wood','iron'].find(k=>(stock[k]||0)<(k==='food'?population(p)*.45*4:k==='wood'?5:2));}
  function request(p){
    ensure();if(!adult(p)||p.id===state.king||p.social<2||!p.tiles?.length||state.aidRequests.some(r=>r.person===p.id&&r.status==='pending')||(p.nextAidDay||0)>state.day)return null;
    const resource=shortage(p);if(!resource)return null;
    const superior=byId(p.liege),recipient=superior?.alive&&!superior.away?superior.id:state.king;
    const r={id:state.aidSequence++,person:p.id,recipient,resource,amount:resource==='food'?Math.max(15,Math.ceil(population(p)*.45*12)):resource==='wood'?20:10,day:state.day,deadline:state.day+8,status:'pending'};
    state.aidRequests.push(r);p.nextAidDay=state.day+24;
    log('Pedido de provisões: '+p.name+' solicita '+r.amount+' '+labels[resource]+' a '+byId(recipient)?.name+'. Prazo: dia '+r.deadline+'.');return r;
  }
  function respond(id,accept,automatic=false){
    const r=state.aidRequests?.find(r=>r.id===id&&r.status==='pending'),p=byId(r?.person),provider=byId(r?.recipient);
    if(!r||!adult(p)||!provider?.alive||provider.away||(!automatic&&r.recipient!==state.king))return false;
    if(accept){
      const stock=purse(provider),reserve=automatic&&r.resource==='food'?population(provider)*.45*12:0;
      if((stock[r.resource]||0)<r.amount+reserve)return false;
      stock[r.resource]-=r.amount;purse(p)[r.resource]=(purse(p)[r.resource]||0)+r.amount;p.loyalty=Math.min(100,(p.loyalty??100)+10);r.status='fulfilled';
      log(provider.name+' enviou '+r.amount+' '+labels[r.resource]+' a '+p.name+'.');
    }else {r.status='refused';r.ended=state.day;p.loyalty=Math.max(0,(p.loyalty??100)-25);log('Pedido de '+p.name+' não atendido; lealdade -25.');
      if(Math.random()<(100-p.loyalty)/100)defect(p,'provisões negadas',{[r.resource]:r.amount,food:Math.max(15,r.resource==='food'?r.amount:0),gold:5});
    }
    return true;
  }
  function tick(){
    ensure();if(state.lastAidDay===state.day)return;state.lastAidDay=state.day;
    for(const r of state.aidRequests.filter(r=>r.status==='pending')){
      const p=byId(r.person);
      if(!adult(p)||!p.tiles?.length){r.status='cancelled';continue;}
      if((purse(p)[r.resource]||0)>=r.amount){r.status='resolved';continue;}
      if(r.recipient!==state.king){if(respond(r.id,true,true))continue;if(state.day-r.day>=4||!byId(r.recipient)?.alive){r.recipient=state.king;r.deadline=state.day+8;log(p.name+' recorreu à Coroa por falta de provisões.');}}
      if(state.day>=r.deadline)respond(r.id,false,true);
    }
    if(state.day%4===0)for(const p of alive())request(p);
  }
  function view(){ensure();return '<section class="panel section-space"><div class="panel-title"><h2>Pedidos de provisões</h2></div><div class="panel-body">'+(state.aidRequests.filter(r=>r.status==='pending').map(r=>'<div class="proposal-card"><strong>'+esc(byId(r.person)?.name)+'</strong><p>'+r.amount+' '+labels[r.resource]+' · destinatário: '+esc(byId(r.recipient)?.name)+' · prazo: dia '+r.deadline+'</p>'+(r.recipient===state.king?'<button data-aid-accept="'+r.id+'">Enviar provisões</button> <button data-aid-refuse="'+r.id+'">Recusar auxílio</button>':'O superior direto está avaliando o pedido.')+'</div>').join('')||'<p>Nenhum pedido pendente.</p>')+'<p class="hint">Pedidos ignorados até o prazo reduzem a lealdade. Um reino que disponha de recursos pode acolher o vassalo descontente. O rei nunca deserta.</p></div></section>';}
  return {ensure,tick,request,respond,defect,view,purse,labels};
})();
