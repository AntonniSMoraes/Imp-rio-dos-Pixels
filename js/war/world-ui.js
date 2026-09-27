'use strict';
function worldPersonCard(id){
  const p=WorldSocieties.by(id);if(!p?.alive)return toast('Este personagem não está mais no mapa.');
  if(!WorldSocieties.visible(p))return modal('Figura desconhecida','<p>Informações indisponíveis. Envie espiões à facção ou aguarde um viajante entrar nas terras do reino.</p>');
  const realm=state.warfare.realms.find(r=>r.id===p.realm);
  let html='<p>'+esc(p.name+' '+p.family)+' · '+esc(RACES[p.race]?.name||p.race)+' · '+Math.floor(p.age)+' anos</p>';
  html+='<p>'+esc((state.people.includes(p)&&!p.away)?'Morador do reino':realm?.name||'Sem feudo')+' · Nível '+p.level+' · '+Math.round(p.hp)+'% de vida</p>';
  html+=Object.entries(p.attrs).map(([k,v])=>'<div class="kv"><span>'+esc(k)+'</span><b>'+Math.round(v)+'</b></div>').join('');
  const community=state.warfare.communities?.find(c=>c.id===p.communityId);
  html+='<p>Situação: '+esc(p.capturedBy?'Prisioneiro':LocalRecruitment.deployed(p)?'Mobilizado em conflito':community?community.name:p.residentStatus==='wanderer'?'Errante · sobrevivente ou viajante':realm?'Integrante de facção':'Viajante')+'</p>';
  if((!state.people.includes(p)||p.away)&&(p.capturedBy==='crown'||LocalRecruitment.local(p))){
    const reason=LocalRecruitment.blocked(p);
    html+='<p>Chance de aceite: <strong>'+LocalRecruitment.chance(p)+'%</strong>. Nova tentativa após quatro dias. '+(p.capturedBy?'Custo: 2 ouro e 5 alimentos. Em caso de recusa, pode permanecer preso ou ser libertado para partir.':'Pode recusar e partir para outra província.')+'</p>';
    html+='<button data-world-recruit="'+p.id+'" '+(reason?'disabled':'')+'>Propor recrutamento</button>'+(reason?'<p class="hint">'+esc(reason)+'</p>':'');
  }else if(state.people.includes(p)&&!p.away&&p.capturedBy)html+='<button data-world-ransom="'+p.id+'">Negociar resgate · 30 ouro</button>';
  if(p.capturedBy)html+='<p class="hint">Cativeiro bloqueia casamento, trabalho e mobilização. Recrutamento exige aceitação.</p>';
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
  const prisoners=[...WorldSocieties.all().filter(p=>p.alive&&p.capturedBy==='crown'),...state.people.filter(p=>p.alive&&!p.away&&p.capturedBy)];
  html+='<h3>Prisioneiros</h3>'+(prisoners.map(p=>'<button data-world-person="'+p.id+'">'+esc(p.name)+' · '+(p.capturedBy==='crown'?'sob custódia da Coroa':'capturado pelo inimigo')+'</button>').join('')||'<p>Nenhum prisioneiro.</p>');
  html+='<h3>Movimentações hostis</h3>'+(w.raids.map(r=>'<p>'+esc(w.realms.find(x=>x.id===r.realm)?.name||'Incursão')+' → Vila '+(r.target+1)+' · '+(r.status==='march'?'aproximando-se':'em combate')+'</p>').join('')||'<p>Nenhuma incursão em andamento.</p>');
  html+=communitySummary();
  return html+'</div></section>';
}
function communitySummary(index){
  const communities=(state.warfare.communities||[]).filter(c=>['settled','claiming'].includes(c.status)&&(index===undefined||c.tile===index));
  return '<h3>Comunidades e reivindicações</h3>'+(communities.map(c=>'<div class="proposal-card"><strong>'+esc(c.name)+'</strong><p>'+CommunityLife.members(c).length+' moradores · '+(c.claim?(state.day<c.claim.ready?'Reivindicação: combate a partir do dia '+c.claim.ready:'Guerra de reivindicação · rodada '+c.claim.round):'Assentamento independente · novos moradores a cada 24 dias')+'</p><button data-war-locate="'+c.tile+'">Ver território</button></div>').join('')||'<p>Nenhuma comunidade ativa'+(index===undefined?' conhecida.':' nesta província.')+'</p>');
}
function worldTerritory(index){
  const persons=WorldSocieties.all().filter(p=>p.alive&&p.location===index&&(!p.capturedBy||p.capturedBy==='crown'));
  return communitySummary(index)+(persons.length?'<h3>Habitantes, errantes e prisioneiros</h3>'+persons.map(p=>'<button data-world-person="'+p.id+'">'+(WorldSocieties.visible(p)?'🔎 '+esc(p.name)+' · '+(p.capturedBy?'Prisioneiro':p.residentStatus==='wanderer'?'Errante':esc(RACES[p.race]?.name||p.race)):'Figura desconhecida')+'</button>').join(''):'');
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
  if(handled){toast(ok?((b.dataset.worldRecruit||b.dataset.worldPersuade)?state.warfare.reports[0]?.text||'Proposta avaliada.':'Ação concluída.'):'Ação indisponível: verifique elegibilidade, moradia, recursos ou a espera diária.');if(ok){document.querySelector('#modal')?.close();save();render();}}
});
