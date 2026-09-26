'use strict';

function bloodDescendant(person, ancestor, seen = new Set()) {
  if (typeof ancestor === 'string') ancestor=byId(ancestor);
  if (!person || !ancestor || seen.has(person.id)) return false;
  seen.add(person.id);
  return (person.parents || []).some(id => id === ancestor.id || bloodDescendant(byId(id), ancestor, seen));
}
function manualHeirOf(person) {
  const heir = person?.manualHeir ? byId(person.heir) : null;
  return heir?.alive && heir.social < person.social && bloodDescendant(heir, person) ? heir : null;
}
function nominateRoyalHeir(id) {
  const king = byId(state?.king), heir = byId(id);
  if (!king || !heir?.alive || heir.social >= king.social || !bloodDescendant(heir, king)) return false;
  king.heir = heir.id; king.manualHeir = true;
  log('Sucessão real: ' + heir.name + ' foi designado(a) herdeiro(a) por ' + king.name + '.');
  save(); render(); return true;
}
function personalLands(lord) {
  if (!lord) return [];
  const land = lord.id === state.king ? state.royalLands || [] : lord.tiles || [];
  const other = new Set(alive().filter(p=>p.id!==lord.id && p.id!==state.king && p.social>=2).flatMap(p=>p.tiles||[]));
  return [...new Set(land)].filter(i=>TerritoryGeometry.get(i) && !other.has(i));
}
function grantDescendantLand(donorId, childId, rank, donated, silent = false) {
  const donor=byId(donorId),child=byId(childId);
  const reject=message=>({ok:false,message});
  if(!donor?.alive || (typeof Peerage !== 'undefined' && Peerage.consort(donor)) || donor.social<2 || !child?.alive || !adult(child) || (typeof Peerage !== 'undefined' && Peerage.consort(child)) || !(bloodDescendant(child,donor) || donor.partners?.some(r=>r.id===child.id&&r.role!=='consorte') || child.liege===donor.id || donor.id===state.king)) return reject('Escolha um descendente, concubino ou subordinado adulto elegível.');
  const heir=manualHeirOf(donor)||byId(donor.heir)||chooseHeir(donor);
  if(heir?.id===child.id) return reject('Reserve o herdeiro principal; conceda terras aos demais descendentes.');
  if(!Number.isInteger(rank)||rank<2||rank>=donor.social||rank<child.social) return reject('O título deve ser inferior ao do concedente e não pode rebaixar o descendente.');
  if(child.social>=2 && child.liege!==donor.id) return reject('Este descendente já governa sob outro senhor.');
  if(!Array.isArray(donated)||!donated.length||new Set(donated).size!==donated.length) return reject('Selecione as vilas a conceder.');
  const lands=personalLands(donor),seat=donor.id===state.king?(state.capitalIndex??REGIONS[state.region]?.seat??240):donor.territory??donor.tiles?.[0];
  if(donated.some(i=>!lands.includes(i)||i===seat||TerritoryGeometry.get(i).price===null)) return reject('Use apenas terras próprias terrestres, sem a sede ou terras de outros vassalos.');
  const kept=lands.filter(i=>!donated.includes(i));
  if(!kept.length || (kept.length>1 && !areTilesConnected(kept))) return reject('O concedente deve conservar um domínio conectado e sua sede.');
  const tiles=[...new Set([...(child.tiles||[]),...donated])];
  if(tiles.length<(LAND_SIZE[rank]||1)||!areTilesConnected(tiles)) return reject('O título requer pelo menos '+LAND_SIZE[rank]+' vilas conectadas.');
  if(child.liege!==donor.id && direct(donor).length>=(LORD_CAP[donor.social]??0)) return reject('O limite de vassalos diretos foi atingido.');
  if(donor.id!==state.king) donor.tiles=(donor.tiles||[]).filter(i=>!donated.includes(i));
  child.social=rank;child.tiles=tiles;child.territory=tiles[0];child.liege=donor.id;child.feudalGrantor=donor.id;
  child.houseHead=child.id;child.unionHead=null;child.retired=false;child.order=child.order&&child.order!=='idle'?child.order:'balance';child.promotedAt=state.promotionSequence++;
  for(const relation of child.partners||[]){const partner=byId(relation.id);if(partner?.alive)updateHouseholdLeadership(child,partner);}
  log(donor.name+' concedeu '+donated.length+' vila(s) e o título de '+SOCIAL[rank]+' a '+child.name+'.');
  if(!silent){save();render();}return {ok:true,message:'Terras e título concedidos.'};
}
function nobleRecruitCandidates(lord) {
  return adults().filter(p=>p.id!==state.king&&p.id!==lord.id&&p.social===0&&!onMission(p)&&!isRoyalFamilyMember(p)&&
    (!p.unionHead||!byId(p.unionHead)?.alive)&&(!p.houseHead||p.houseHead===p.id)&&(!p.liege||p.liege===state.king));
}
function nobleRecruit(lordId, personId) {
  const lord=byId(lordId), reject=message=>({ok:false,message});
  if(!lord?.alive||lord.social<2||!personalLands(lord).length) return reject('O nobre precisa de terras próprias.');
  if(state.day<(lord.nextNobleRecruitDay||0)) return reject('Este domínio já recrutou hoje.');
  let group;
  if(personId){
    const candidate=nobleRecruitCandidates(lord).find(p=>p.id===personId);
    if(!candidate)return reject('Este aldeão não está disponível para transferência.');
    group=alive().filter(p=>p.id===candidate.id||p.houseHead===candidate.id);
    if(group.some(p=>p.social>0||onMission(p)||isRoyalFamilyMember(p)))return reject('Esta família não pode ser transferida.');
  } else {
    if(alive().length>=capacity()) return reject('Construa moradias ou amplie o domínio antes de recrutar.');
    const purse=lord.id===state.king?state:lord.treasury;
    if(!purse||(purse.gold||0)<10)return reject('O chamado externo custa 10 ouro do cofre do nobre.');
    purse.gold-=10;lord.nextNobleRecruitDay=state.day+1;
    if(Math.random()<.5){log('O chamado de '+lord.name+' não atraiu viajantes.');save();render();return {ok:true,message:'Ninguém respondeu. Novo chamado amanhã.'};}
    group=[recruitRacialTraveler(makePerson({age:18+rand(24)}))];state.people.push(...group);
  }
  for(const p of group){p.liege=lord.id;p.job='food';p.jobMode='auto';}
  lord.nextNobleRecruitDay=state.day+1;
  log(lord.name+' acolheu '+group.length+' aldeão(ões) em seu domínio.');save();render();return {ok:true,message:'Aldeões incorporados ao domínio.'};
}
function feudalControls(p) {
  if(!p?.alive||p.social<2)return '';
  if(typeof Peerage !== 'undefined' && Peerage.consort(p))return '';
  let html='<h4>Administração do domínio</h4><button data-feudal-dialog="'+p.id+'">Terras, descendentes e recrutamento</button>';
  if(p.id===state.king){
    if(p.age>=50&&adult(chooseHeir(p)))html+='<button data-retire="'+p.id+'">Abdicar em favor do herdeiro</button>';
    const heirs=alive().filter(x=>x.social<p.social&&bloodDescendant(x,p));
    html+='<h4>Sucessão da Coroa</h4><p>Herdeiro: '+esc(byId(p.heir)?.name||'não definido')+(manualHeirOf(p)?' · escolha manual':' · escolha automática')+'</p>';
    if(heirs.length)html+='<select id="royal-heir">'+heirs.map(x=>'<option value="'+x.id+'" '+(p.heir===x.id?'selected':'')+'>'+esc(x.name+' '+x.family)+'</option>').join('')+'</select><button data-nominate-heir="true">Designar herdeiro</button>';
    else html+='<p class="hint">A designação ficará disponível quando houver descendentes vivos.</p>';
  }
  return html + (typeof AnnualEconomy !== 'undefined' ? AnnualEconomy.summary(p) : '');
}
function feudalDialog(id) {
  const lord=byId(id);if(!lord?.alive||lord.social<2||(typeof Peerage !== 'undefined'&&Peerage.consort(lord)))return;
  const heir=manualHeirOf(lord)||byId(lord.heir)||chooseHeir(lord);
  const children=alive().filter(x=>adult(x)&&!(typeof Peerage !== 'undefined'&&Peerage.consort(x))&&(bloodDescendant(x,lord)||lord.partners?.some(r=>r.id===x.id&&r.role!=='consorte')||x.liege===lord.id||lord.id===state.king)&&x.id!==heir?.id&&x.social<lord.social);
  const seat=lord.id===state.king?(state.capitalIndex??REGIONS[state.region]?.seat??240):lord.territory??lord.tiles?.[0];
  const lands=personalLands(lord).filter(i=>i!==seat&&TerritoryGeometry.get(i).price!==null);
  let body='<p>Cofre do concedente: '+Math.floor((lord.id===state.king?state:lord.treasury)?.gold||0)+' ouro. A sede é protegida; o domínio restante deve continuar conectado.</p>';
  if(typeof AnnualEconomy !== 'undefined')body+=AnnualEconomy.summary(lord);
  if(children.length&&lands.length&&lord.social>2){
    body+='<h3>Conceder terras e título</h3><label>Destinatário adulto<select id="grant-child">'+children.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' · '+title(p)+'</option>').join('')+'</select></label><label>Título<select id="grant-rank">';
    for(let rank=2;rank<lord.social;rank++)body+='<option value="'+rank+'">'+SOCIAL[rank]+' · '+LAND_SIZE[rank]+' vilas · gratuito</option>';
    body+='</select></label><fieldset><legend>Vilas a transferir</legend>'+lands.map(i=>'<label style="display:inline-flex;gap:5px;margin:6px"><input type="checkbox" name="grant-tile" value="'+i+'">Vila '+(i+1)+'</label>').join('')+'</fieldset><button data-family-grant="'+id+'">Conceder terras e título</button>';
  } else body+='<p>Para conceder terras, tenha um destinatário adulto elegível fora da sucessão principal, terras disponíveis e título superior a cavaleiro.</p>';
  const candidates=nobleRecruitCandidates(lord),disabled=state.day<(lord.nextNobleRecruitDay||0);
  body+='<h3>Recrutar para este domínio</h3><p>Uma ação por dia. Transferências internas preservam a família; chamados externos custam 10 ouro e têm 50% de chance de trazer um adulto.</p>';
  if(candidates.length)body+='<select id="noble-recruit-person">'+candidates.map(p=>'<option value="'+p.id+'">'+esc(p.name+' '+p.family)+'</option>').join('')+'</select><button data-noble-internal="'+id+'" '+(disabled?'disabled':'')+'>Transferir família de aldeões</button>';
  else body+='<p>Nenhuma família de aldeões livres disponível.</p>';
  body+='<button data-noble-external="'+id+'" '+(disabled?'disabled':'')+'>Chamar aldeão externo · 10 ouro</button>';
  modal('Domínio de '+esc(lord.name),body);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||!state)return;
  if(button.dataset.feudalDialog)feudalDialog(button.dataset.feudalDialog);
  if(button.dataset.nominateHeir){if(nominateRoyalHeir(button.parentElement.querySelector('#royal-heir')?.value)){toast('Herdeiro designado. Você pode trocá-lo a qualquer momento.');refreshPersonModal();}}
  const donor=button.dataset.familyGrant;
  if(donor){const result=grantDescendantLand(donor,document.querySelector('#grant-child')?.value,Number(document.querySelector('#grant-rank')?.value),[...document.querySelectorAll('[name="grant-tile"]:checked')].map(input=>Number(input.value)));toast(result.message);if(result.ok)feudalDialog(donor);}
  const lord=button.dataset.nobleInternal||button.dataset.nobleExternal;
  if(lord){const result=nobleRecruit(lord,button.dataset.nobleInternal?document.querySelector('#noble-recruit-person')?.value:null);toast(result.message);if(result.ok)feudalDialog(lord);}
});
