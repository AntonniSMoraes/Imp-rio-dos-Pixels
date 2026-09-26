'use strict';

function betrothalView() {
  const entries=Betrothals.active();
  let html='<section class="panel section-space"><div class="panel-title"><h2>Promessas de casamento</h2></div><div class="panel-body"><p class="hint">A união acontece quando ambos atingem a maioridade. Nobres também combinam promessas entre suas famílias. Romper reduz a relação entre as famílias em 25 pontos; se a Coroa romper, o responsável da outra família perde 15 de lealdade.</p><button data-betrothal-open="true">Combinar promessa</button>';
  html+=entries.map(p=>'<div class="proposal-card">'+personLink(byId(p.a))+' & '+personLink(byId(p.b))+'<p>Relação entre famílias: '+Betrothals.relation(p.houseA,p.houseB)+'</p><button data-betrothal-break="'+p.id+'">Romper promessa</button></div>').join('') || '<p class="hint">Nenhuma promessa ativa.</p>';
  const history=(state.betrothals||[]).filter(p=>p.status!=='promised').slice(-10).reverse();
  if(history.length) html+='<h3>Acordos anteriores</h3>'+history.map(p=>'<p>'+esc(byId(p.a)?.name||'Falecido')+' & '+esc(byId(p.b)?.name||'Falecido')+' · '+({married:'Casamento celebrado',broken:'Promessa rompida',cancelled:'Encerrada sem penalidade'}[p.status])+' · relação entre famílias: '+Betrothals.relation(p.houseA,p.houseB)+'</p>').join('');
  return html+'</div></section>';
}
function betrothalDialog(selectedId) {
  const candidates=alive().filter(p=>!partners(p).length && !Betrothals.forPerson(p.id) && (p.parents||[]).length);
  const a=candidates.find(p=>p.id===selectedId)||candidates[0];
  const options=items=>items.map(p=>'<option value="'+esc(p.id)+'" '+(p===a?'selected':'')+'>'+esc(p.name+' '+p.family)+' · '+Math.floor(p.age)+' anos · '+(adult(p)?RANKS[p.rank]:'potencial ainda oculto')+'</option>').join('');
  const targets=a?alive().filter(b=>Betrothals.eligible(a,b)):[];
  modal('Combinar promessa de casamento','<p>Escolha descendentes de famílias nobres ou plebeias. Pelo menos um deve ser menor de idade; a diferença máxima é de 5 anos. Parentes e pessoas já comprometidas não são elegíveis.</p>'+(a?'<label>Descendente<select id="betrothal-first">'+options(candidates)+'</select></label><label>Futuro cônjuge<select id="betrothal-second">'+options(targets)+'</select></label><button data-betrothal-create="true" '+(!targets.length?'disabled':'')+'>Firmar promessa</button>'+(!targets.length?'<p>Nenhum candidato elegível para este descendente.</p>':''):'<p>Nenhum descendente disponível.</p>'));
}
document.addEventListener('change',event=>{
  if(event.target.id==='betrothal-first')betrothalDialog(event.target.value);
});
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||!state)return;
  if(b.dataset.betrothalOpen)betrothalDialog();
  if(b.dataset.betrothalCreate){
    if(!Betrothals.arrange(document.querySelector('#betrothal-first')?.value,document.querySelector('#betrothal-second')?.value))return toast('A promessa não está mais disponível.');
    document.querySelector('#modal').close();save();render();toast('Promessa firmada.');
  }
  if(b.dataset.betrothalBreak){
    const p=Betrothals.active().find(p=>p.id===b.dataset.betrothalBreak);if(!p)return;
    const initiator=p.houseB===state.king?p.houseB:p.houseA;
    if(Betrothals.breakPromise(p.id,initiator)){save();render();refreshPersonModal();toast('Promessa rompida. As famílias ficaram insatisfeitas.');}
  }
});
