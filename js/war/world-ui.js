'use strict';
function worldPersonCard(id){
  const p=WorldSocieties.by(id);if(!p?.alive)return toast('Este personagem não está mais no mapa.');
  if(!WorldSocieties.visible(p))return modal('Figura desconhecida','<p>Informações indisponíveis. Envie espiões à facção ou aguarde um viajante entrar nas terras sob posse direta da Coroa.</p>');
  const realm=state.warfare.realms.find(r=>r.id===p.realm);
  let html='<p>'+esc(p.name+' '+p.family)+' · '+esc(RACES[p.race]?.name||p.race)+' · '+Math.floor(p.age)+' anos</p>';
  html+='<p>'+esc(state.people.includes(p)?'Morador do reino':realm?.name||'Sem feudo')+' · Nível '+p.level+' · '+Math.round(p.hp)+'% de vida</p>';
  html+=Object.entries(p.attrs).map(([k,v])=>'<div class="kv"><span>'+esc(k)+'</span><b>'+Math.round(v)+'</b></div>').join('');
  if(p.capturedBy==='crown')html+='<p>Convencimento: '+Math.floor(p.persuasion||0)+'%. Cada conversa custa 2 ouro e 5 alimentos, uma vez por dia. Precisa haver moradia disponível para ingressar.</p><button data-world-persuade="'+p.id+'" '+(p.lastPersuasion===state.day?'disabled':'')+'>Conversar e oferecer integração</button>';
  else if(state.people.includes(p)&&p.capturedBy)html+='<button data-world-ransom="'+p.id+'">Negociar resgate · 30 ouro</button>';
  else if(!p.realm&&!state.people.includes(p)&&WorldSocieties.own(p.location))html+='<button data-world-recruit="'+p.id+'">Convidar para o reino</button>';
  if(p.capturedBy)html+='<p class="hint">Cativeiro não permite casamento, trabalho ou participação em exércitos. A integração exige concluir o convencimento.</p>';
  modal('Ficha do personagem',html);
}
function worldCouncil(){
  const w=state.warfare;
  let html='<section class="panel section-space"><div class="panel-title"><h2>Diplomacia, espionagem e prisioneiros</h2></div><div class="panel-body">';
  for(const r of w.realms.filter(r=>r.tiles.length)){
    const intel=w.intel[r.id];
    html+='<div class="proposal-card"><strong>'+esc(r.name)+'</strong> · '+esc(RACES[r.race]?.name||'Humano')+' · relação '+r.relation+' · '+(r.ally?'Aliado':r.atWar?'Inimigo':'Independente')+'<p>'+(intel?.pending?'Espiões em missão até o dia '+intel.ready:intel?.until>=state.day?'Informações disponíveis até o dia '+intel.until:'Fichas ainda desconhecidas')+'</p><button data-world-spy="'+r.id+'" '+(intel?.pending?'disabled':'')+'>Enviar espiões · 15 ouro</button> <button data-world-alliance="'+r.id+'" '+(r.atWar||r.ally||r.relation<0?'disabled':'')+'>Firmar aliança · 25 ouro</button> <button data-world-dispute="'+r.id+'">Fazer exigência hostil · −30 relação</button>';
    if(r.race==='elf'&&r.ally)html+='<button data-world-elf="'+r.id+'">Negociar casamento de aliança</button>';
    html+='</div>';
  }
  const prisoners=[...WorldSocieties.all().filter(p=>p.alive&&p.capturedBy==='crown'),...state.people.filter(p=>p.alive&&p.capturedBy)];
  html+='<h3>Prisioneiros</h3>'+(prisoners.map(p=>'<button data-world-person="'+p.id+'">'+esc(p.name)+' · '+(p.capturedBy==='crown'?'sob custódia da Coroa':'capturado pelo inimigo')+'</button>').join('')||'<p>Nenhum prisioneiro.</p>');
  html+='<h3>Movimentações hostis</h3>'+(w.raids.map(r=>'<p>'+esc(w.realms.find(x=>x.id===r.realm)?.name||'Incursão')+' → Vila '+(r.target+1)+' · '+(r.status==='march'?'aproximando-se':'em combate')+'</p>').join('')||'<p>Nenhuma incursão em andamento.</p>');
  return html+'</div></section>';
}
function worldTerritory(index){
  const persons=WorldSocieties.all().filter(p=>p.alive&&!p.capturedBy&&p.location===index);
  return persons.length?'<h3>Habitantes e viajantes</h3>'+persons.map(p=>'<button data-world-person="'+p.id+'">'+(WorldSocieties.visible(p)?'🔎 '+esc(p.name)+' · '+esc(RACES[p.race]?.name||p.race):'Figura desconhecida')+'</button>').join(''):'';
}
function elfAllianceDialog(id){
  const realm=state.warfare.realms.find(r=>r.id===id);if(!realm?.ally)return;
  const elves=WorldSocieties.all().filter(p=>p.realm===id&&p.caste==='baixa'&&WarCombat.fit(p)&&!p.partners.length);
  const candidates=adults().filter(p=>!p.capturedBy&&(p.id===state.king||bloodDescendant(p,state.king)));
  modal('Casamento de aliança élfica','<p>A casa élfica oferece uma união diplomática entre adultos de baixa casta. O pretendente pode recusar. Cativeiro nunca dá acesso a esta negociação.</p><label>Descendente real<select id="elf-royal">'+candidates.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+'</select></label><label>Pretendente élfico<select id="elf-candidate">'+elves.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' · '+(p.sex==='F'?'Mulher':'Homem')+'</option>').join('')+'</select></label><button data-world-elf-propose="'+id+'" '+(!elves.length||!candidates.length?'disabled':'')+'>Propor união</button>');
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||!state)return;
  if(b.dataset.worldPerson)return worldPersonCard(b.dataset.worldPerson);
  if(b.dataset.worldElf)return elfAllianceDialog(b.dataset.worldElf);
  let ok=false,handled=true;
  if(b.dataset.worldRecruit)ok=WorldSocieties.recruit(b.dataset.worldRecruit);
  else if(b.dataset.worldPersuade)ok=WorldSocieties.persuade(b.dataset.worldPersuade);
  else if(b.dataset.worldRansom)ok=WorldSocieties.ransom(b.dataset.worldRansom);
  else if(b.dataset.worldSpy)ok=WorldSocieties.spy(b.dataset.worldSpy);
  else if(b.dataset.worldAlliance)ok=WorldSocieties.treaty(b.dataset.worldAlliance,'alliance');
  else if(b.dataset.worldDispute)ok=WorldSocieties.treaty(b.dataset.worldDispute,'dispute');
  else if(b.dataset.worldElfPropose)ok=WorldSocieties.elfMarriage(b.dataset.worldElfPropose,document.querySelector('#elf-royal')?.value,document.querySelector('#elf-candidate')?.value);
  else handled=false;
  if(handled){toast(ok?'Ação concluída.':'Ação indisponível: verifique elegibilidade, moradia, recursos ou a espera diária.');if(ok){document.querySelector('#modal')?.close();save();render();}}
});
