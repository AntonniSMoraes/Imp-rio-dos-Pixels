'use strict';
globalThis.MarriageCouncil = (() => {
  const key=(a,b)=>[a.id,b.id].sort().join(':');
  function ensure(){state.marriageNegotiations ||= [];}
  function find(a,b){if(!a||!b)return null;return state.marriageNegotiations?.find(n=>n.key===key(a,b));}
  function demand(p,other){
    // Some refusals are final. A demand is a voluntary conditional acceptance.
    if(p.id===state.king||Math.random()<.25)return null;
    const relative=alive().find(x=>x.id!==p.id&&x.id!==other.id&&adult(x)&&x.social<2&&!Peerage.consort(x)&&!onMission(x)&&related(x,p));
    if(relative&&Math.random()<.35)return {type:'title',relative:relative.id,tier:2};
    return {type:Math.random()<.5?'gold':'food',amount:40+20*(p.rank||0)};
  }
  function refuse(a,b,rejected){
    ensure();const existing=find(a,b);if(existing)return existing;
    const n={key:key(a,b),a:a.id,b:b.id,day:state.day,status:'refused',insistence:0,rejected:rejected.map(p=>({id:p.id,demand:demand(p,p.id===a.id?b:a)}))};
    state.marriageNegotiations.push(n);log('Casamento de '+a.name+' e '+b.name+': recusado por '+rejected.map(p=>p.name).join(' e ')+'.');return n;
  }
  function propose(a,b,manual=true){
    if(!canUnion(a,b))return false;
    ensure();const old=find(a,b);
    if(old?.status==='refused'){
      if(manual){old.insistence++;state.houseRelations ||= {};const relationKey=[headOf(a).id,headOf(b).id].sort().join(':');state.houseRelations[relationKey]=Math.max(-100,(state.houseRelations[relationKey]||0)-10);
        for(const refusal of old.rejected){const p=byId(refusal.id);p.loyalty=Math.max(0,(p.loyalty??100)-10);if(old.insistence>=3&&p.id!==state.king&&Math.random()<.25)VassalAid.defect(p,'insistência após recusa de casamento');}
        log('Insistência na proposta de '+a.name+' e '+b.name+': desavença entre as casas (-10) e perda de lealdade dos recusantes (-10).');
      }
      return false;
    }
    const rejected=[a,b].filter(p=>p.id!==state.king&&Math.random()>=acceptance(p,p===a?b:a));
    if(rejected.length){refuse(a,b,rejected);return false;}
    return unite(a,b);
  }
  function settle(n){
    const a=byId(n?.a),b=byId(n?.b);
    if(!n||n.status!=='refused'||!canUnion(a,b)||n.rejected.some(r=>!r.demand))return false;
    const totals={gold:0,food:0};
    for(const r of n.rejected){const d=r.demand;if(d.type==='title'){const p=byId(d.relative);if(!adult(p)||p.social<d.tier)return false;}else totals[d.type]+=d.amount;}
    if(state.gold<totals.gold||state.food<totals.food)return false;
    n.status='agreed';if(!unite(a,b)){n.status='refused';return false;}
    state.gold-=totals.gold;state.food-=totals.food;
    n.status='married';log('Dote cumprido; '+a.name+' e '+b.name+' aceitaram a união.');return true;
  }
  function view(person){
    ensure();const rows=state.marriageNegotiations.filter(n=>n.status==='refused'&&(!person||n.a===person.id||n.b===person.id));
    return '<section class="panel section-space"><div class="panel-title"><h2>Recusas e dotes</h2></div><div class="panel-body">'+(rows.map(n=>'<div class="proposal-card"><strong>'+esc(byId(n.a)?.name)+' e '+esc(byId(n.b)?.name)+'</strong>'+n.rejected.map(r=>{const d=r.demand;return '<p>'+esc(byId(r.id)?.name)+' recusou. '+(!d?'Não deseja negociar esta união.':d.type==='title'?'Solicita o título de cavaleiro para '+esc(byId(d.relative)?.name)+'. A concessão de título e terras é permanente. <button data-promote="'+d.relative+'">Examinar concessão</button>':'Aceita mediante dote de '+d.amount+' '+VassalAid.labels[d.type]+'.')+'</p>';}).join('')+'<p>Insistências: '+n.insistence+'. Repetir a proposta não sorteia outra resposta e pode causar deserção.</p>'+(n.rejected.every(r=>r.demand)?'<button data-dowry="'+esc(n.key)+'">Cumprir dote pela Coroa e celebrar</button>':'')+'</div>').join('')||'<p>Nenhuma recusa registrada.</p>')+'</div></section>';
  }
  return {ensure,find,refuse,propose,settle,view};
})();
