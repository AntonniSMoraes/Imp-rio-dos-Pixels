'use strict';
function warCouncil() {
  Warfare.ensure();
  const war=state.warfare;
  let html='<section class="panel"><div class="panel-title"><h2>Guerra e conquista</h2></div><div class="panel-body"><p>Declare guerra, escolha uma província rival e mobilize um nobre e 2–12 combatentes. Marchas e combates avançam a cada dia. Tropas mobilizadas deixam de trabalhar; mortes são permanentes.</p><p class="hint">Combatentes de ambos os lados têm atributos, progressão e morte permanente. Facções independentes atacam e conquistam terras; derrotas podem resultar em cativeiro.</p>';
  if(!state.buildings.barracks)html+='<p class="notice">Construa um quartel na aba Construir para liberar a mobilização.</p>';
  for(const realm of war.realms)html+='<div class="kv"><span style="color:'+realm.color+'">■ '+esc(realm.name)+' · '+realm.tiles.length+' vilas · '+(realm.tiles.length?realm.atWar?'Em guerra':'Em paz':'Derrotado')+'</span><span>'+(realm.tiles.length?'<button data-war-locate="'+realm.capital+'">Ver sede</button> '+(!realm.atWar?'<button data-war-declare="'+realm.id+'">Declarar guerra</button>':'<button data-war-muster="'+realm.capital+'">Mobilizar</button>'):'')+'</span></div>';
  html+='<h3>Exércitos mobilizados</h3>';
  const active=war.armies.filter(a=>a.status!=='done');
  html+=active.length?active.map(a=>'<div class="kv"><span>'+esc(byId(a.commander)?.name||'Comandante caído')+' · '+a.men.map(byId).filter(p=>p?.alive).reduce((n,p)=>n+Conscription.size(p),0)+' combatentes · '+({march:'Marchando',battle:'Em combate',return:'Retornando'}[a.status])+' · Vila '+(a.target+1)+'</span><span><button data-war-locate="'+a.path[a.step]+'">Ver tropas</button><button data-war-recall="'+a.id+'" '+(a.status==='return'?'disabled':'')+'>Recuar</button></span></div>').join(''):'<p>Nenhum exército mobilizado.</p>';
  html+='<h3>Recomendações dos cavaleiros</h3>'+Conscription.recommendations();
  html+='<h3>Relatórios</h3>'+war.reports.slice(0,8).map(r=>'<p>Dia '+r.day+' · '+esc(r.text)+'</p>').join('')+'</div></section>';
  return html;
}
function warMuster(target,commanderId) {
  const enemy=Warfare.owner(target);if(!enemy?.atWar)return toast('Declare guerra na aba Expedições.');
  const lords=adults().filter(p=>(p.id===state.king||p.social>=2)&&!onMission(p));
  const lord=lords.find(p=>p.id===commanderId)||lords.find(p=>p.id===state.king)||lords[0];
  if(!lord)return toast('Nenhum comandante disponível.');
  const troops=Warfare.candidates(lord).sort((a,b)=>(b.id===lord.id)-(a.id===lord.id));
  const html='<p>Alvo: Vila '+(target+1)+' · '+esc(enemy.name)+'. Guarnição: '+(state.warfare.intel[enemy.id]?.until>=state.day?Math.ceil(enemy.garrisons[target]||0)+' de força':'desconhecida — envie espiões')+'.</p><label>Comandante<select id="war-commander" data-war-target="'+target+'">'+lords.map(p=>'<option value="'+p.id+'" '+(p.id===lord.id?'selected':'')+'>'+esc(p.name)+' · '+title(p)+'</option>').join('')+'</select></label><p>Selecione 2–12 adultos, incluindo o comandante. Custo: 10 ouro + 10 alimentos + 2 por combatente. Consumo diário: 1 alimento por grupo de 4 combatentes.</p><div class="army-list">'+troops.map((p,i)=>'<label><input type="checkbox" name="war-troop" value="'+p.id+'" '+(i<8?'checked':'')+'>'+esc(p.name)+' + '+Conscription.count(p)+' conscritos · '+Math.round(p.hp)+'% PV · força '+WarCombat.strength(p).toFixed(1)+'</label>').join('')+'</div><button data-war-launch="'+target+'">Mobilizar exército</button>';
  modal('Mobilização para conquista',html);
}
const expeditionView = armyView;
armyView = function() { return warCouncil()+worldCouncil()+expeditionView(); };
document.addEventListener('change',event=>{if(event.target.id==='war-commander')warMuster(Number(event.target.dataset.warTarget),event.target.value);});
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||!state)return;
  if(b.dataset.warDeclare){Warfare.declare(b.dataset.warDeclare);save();render();}
  if(b.dataset.warMuster!==undefined)warMuster(Number(b.dataset.warMuster));
  if(b.dataset.warLocate!==undefined){view='map';selectTerritory(Number(b.dataset.warLocate));campaignMapRuntime?.focus(Number(b.dataset.warLocate));}
  if(b.dataset.warLaunch!==undefined){const result=Warfare.mobilize(document.querySelector('#war-commander')?.value,Number(b.dataset.warLaunch),[...document.querySelectorAll('[name="war-troop"]:checked')].map(input=>input.value));toast(result.message);if(result.ok){document.querySelector('#modal').close();save();render();}}
  if(b.dataset.warRecall){Warfare.recall(Number(b.dataset.warRecall));save();render();}
});
