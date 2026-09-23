function mapView() {
  const kingPerson = state.people.find(p => p.id === state.king);
  return (
    '<section class="map-panel"><canvas id="map" width="640" height="400" aria-label="Mapa interativo. Clique em um cidadão para abrir sua ficha lateral." tabindex="0"></canvas><div class="map-top"><span>' +
    (REGIONS[state.region]?.name?.toUpperCase() || "NORTE GÉLIDO") +
    '</span><span class="map-coordinate">I · VALE DE ' + esc(kingPerson?.family?.toUpperCase() || "VALEN") + '</span></div><div class="map-bottom"><span><i class="dot gold-dot"></i>Moradores <i class="dot green-dot"></i>Recursos <i class="dot red-dot"></i>Lobos</span><span>N ↑</span></div></section><aside class="inspector">' +
    (selected.kind === "person" ? personPanel(state.people.find((p) => p.id === selected.id)) : locationPanel()) +
    "</aside>"
  );
}
function callButton() {
  return '<button class="primary full" data-action="call" ' +
    (!state || state.day < state.nextRecruitDay || state.guests.length || !alive().length ? "disabled" : "") +
    '>⚑ Chamado de recrutamento</button><p class="hint">' +
    (!state || state.day < state.nextRecruitDay ? "Novo chamado no próximo dia." : "Grátis · 1 chamado por dia · 50% de encontrar moradores.") +
    "</p>" +
    (state?.guests?.length ? '<div class="notice">' + state.guests.length + ' viajantes aguardam abrigo.<button data-action="admit">Acolher grupo</button></div>' : "");
}
function locationPanel() {
  const key = selected.key || "pioneer";
  let title, description, rows = [];
  if (key === "pioneer") {
    title = "Cabana do pioneiro";
    description = "Seu primeiro abrigo em " + (REGIONS[state.region]?.name || "Norte") + ". Protege quem está na vila e oferece 4 vagas iniciais.";
    rows = [["Moradores", alive().length + " / " + capacity()], ["Regente", state.people.find((p) => p.id === state.king)?.name || "Nenhum"]];
  } else if (BUILD[key]) {
    title = BUILD[key].name;
    description = BUILD[key].desc;
    rows = [["Nível", state.buildings[key]], ["Estado", "Em funcionamento"]];
  } else if (key === "wolves") {
    title = "Vale dos lobos";
    description = "Uma alcateia ronda a fronteira. Envie uma patrulha de quatro adultos.";
    rows = [["Vida inimiga", 200 + state.wins * 60], ["Recompensa", "45 ouro · 30 comida"]];
  } else {
    title = { wood: "Bosque", iron: "Mina de ferro", food: "Lago da vigília" }[key];
    description = { wood: "Lenha para abrigos e fogueiras.", iron: "Ferro para fortalecer sua vila.", food: "Caça e pesca." }[key];
    rows = [["Reserva", Math.floor(state.nodes[key])], ["Trabalhadores", workers(key).length]];
  }
  return '<div class="inspector-head"><span class="eyebrow">LOCAL SELECIONADO</span><h2>' + title + '</h2></div><div class="inspector-scroll"><div class="location-icon">' +
    (key === "pioneer" ? "⌂" : BUILD[key]?.icon || { wolves: "⚔", wood: "♧", iron: "◆", food: "≈" }[key]) +
    '</div><p class="description">' + description + "</p>" +
    rows.map(([label, value]) => '<div class="kv"><span>' + label + "</span><b>" + esc(value) + "</b></div>").join("") +
    (key === "pioneer" ? '<div class="section-space">' + callButton() + '</div><button class="full" data-view="build">Construir na vila</button><div class="next-step"><span class="eyebrow">PRÓXIMO PASSO</span><p>' + (!state.buildings.hunt ? "Construa uma cabana de caça para produzir alimento." : !state.buildings.fire ? "Acenda uma fogueira para proteger quem trabalha fora." : "Designe moradores para manter os estoques positivos.") + "</p></div>" : '<button class="primary full section-space" data-view="' + (key === "wolves" ? "army" : BUILD[key] ? "build" : "economy") + '">' + (key === "wolves" ? "Preparar patrulha" : BUILD[key] ? "Gerenciar construção" : "Designar trabalhadores") + "</button>") + "</div>";
}
function jobSelect(person) {
  if (person.level < 5) return '<span class="muted">Aprendizado passivo</span>';
  if (!person.alive) return '<span class="muted">Memorial</span>';
  if (onMission(person)) return '<span class="muted">Em expedição</span>';
  return '<select data-job="' + person.id + '" aria-label="Trabalho de ' + esc(person.name) + '">' + Object.entries(JOBS).map(([key, name]) => '<option value="' + key + '" ' + (person.job === key ? "selected" : "") + " " + (key === "train" && !state.buildings.barracks ? "disabled" : "") + ">" + name + "</option>").join("") + "</select>";
}
function stage(person) { return !person.alive ? "Falecido" : person.level < 5 ? "Criança" : person.age >= 55 ? "Veterano" : "Adulto"; }
function sexLabel(person) { return person.sex === "M" ? "Masculino" : "Feminino"; }
function familyControls(person) {
  const spouse = state.people.find((candidate) => candidate.id === person.spouse);
  const children = state.people.filter((candidate) => candidate.parents.includes(person.id));
  const parents = person.parents.map((id) => state.people.find((candidate) => candidate.id === id)).filter(Boolean);
  const candidates = person.alive && person.level >= 5 && !hasSpouse(person) ? marriageCandidates(person) : [];
  return '<section class="family-section"><h3>Aliança de família</h3><div class="kv"><span>Estado civil</span><b>' + (spouse?.alive ? "Casado" : spouse || person.widowed ? person.sex === "F" ? "Viúva" : "Viúvo" : person.sex === "F" ? "Solteira" : "Solteiro") + "</b></div>" +
    (spouse ? '<button class="relative" data-person="' + spouse.id + '">' + (typeof portrait === "function" ? portrait(spouse, "mini-portrait") : "") + "<span>" + esc(spouse.name) + " " + esc(spouse.family) + "<small>" + (spouse.alive ? "Cônjuge · +15% em combate juntos" : "Cônjuge falecido") + "</small></span><b>›</b></button>" : "") +
    (person.level < 5 ? '<p class="hint">Casamentos disponíveis após a maioridade.</p>' : !hasSpouse(person) && person.alive ? candidates.length ? '<label class="field-label" for="spouse-' + person.id + '">' + (person.id === state.king ? "Escolher consorte" : "Propor aliança") + '</label><select id="spouse-' + person.id + '">' + candidates.map((candidate) => '<option value="' + candidate.id + '">' + esc(candidate.name) + " " + esc(candidate.family) + " · " + RANKS[candidate.rank] + "</option>").join("") + '</select><button class="primary full" data-marry="' + person.id + '">Celebrar casamento</button>' : '<p class="hint">Nenhum cônjuge elegível. Faça um chamado para encontrar moradores adultos.</p>' : "") +
    (parents.length ? "<h4>Pais</h4>" + parents.map((parent) => '<button class="text-button" data-person="' + parent.id + '">' + esc(parent.name) + " " + esc(parent.family) + " " + (parent.alive ? "" : "†") + "</button>").join("") : "") +
    (children.length ? "<h4>Filhos</h4>" + children.map((child) => '<button class="text-button" data-person="' + child.id + '">' + esc(child.name) + " · " + stage(child) + " " + (child.debut ? '<span class="badge">DEBUT</span>' : "") + "</button>").join("") : "") + "</section>";
}
function traitRows(person) {
  const genes = person.genes;
  return [["hair", "Cabelo", HAIR[genes.hair][0]], ["style", "Tipo", STYLES[genes.style]], ["eyes", "Olhos", EYES[genes.eyes][0]], ["skin", "Pele", SKIN[genes.skin][0]], ["freckles", "Sardas", genes.freckles ? "Sim" : "Não"]].map(([key, name, value]) => {
    const parent = state.people.find((candidate) => candidate.id === person.origins[key]);
    return '<div class="trait"><span>' + name + "</span><b>" + value + "</b>" + (parent ? "<small>de " + esc(parent.name) + "</small>" : "") + "</div>";
  }).join("");
}
function racialRows(person) {
  const caste = person.caste && CASTES[person.caste] ? CASTES[person.caste].name : "Nenhuma";
  const traits = person.racialTraits?.length ? person.racialTraits.join(", ") : "Nenhum";
  return '<div class="trait"><span>Raça</span><b>' + esc(raceLabel(person)) + '</b></div><div class="trait"><span>Casta</span><b>' + esc(caste) + '</b></div><div class="trait"><span>Traços raciais</span><b>' + esc(traits) + '</b></div>';
}
function personPanel(person, full = false) {
  if (!person) return "<p>Cidadão não encontrado.</p>";
  return '<div class="inspector-head"><div class="eyebrow">' + (person.id === state.king ? "REGENTE DA VILA" : "FICHA DO CIDADÃO") + '<button class="close-panel" data-action="' + (full ? "close" : "clear-selection") + '" aria-label="Fechar ficha">×</button></div><h2>' + esc(person.name) + " " + esc(person.family) + '</h2><span class="muted">' + sexLabel(person) + " · " + stage(person) + " · " + Math.floor(person.age) + ' anos · ' + raceLabel(person) + '</span></div><div class="inspector-scroll"><div class="character-hero">' + (typeof fullPortrait === "function" ? fullPortrait(person) : "") + '<div class="character-summary"><span class="rank rank-' + person.rank + '">' + (person.level < 5 ? "Potencial oculto" : RANKS[person.rank] + " ×" + MULT[person.rank]) + "</span><h3>" + (person.vocation || "Bênção não revelada") + "</h3><span>" + SOCIAL[person.social] + " · Nível " + person.level + '</span><div class="health"><span style="width:' + person.hp + '%"></span></div><small>' + Math.round(person.hp) + " / 100 PV</small>" + (person.barbarian ? '<span class="badge">Imune ao frio</span>' : "") + '</div></div><div class="attributes">' + Object.entries(person.attrs).map(([key, value]) => "<div><b>" + (person.level < 5 ? "?" : value) + "</b><span>" + key + (person.high.includes(key) && person.level >= 5 ? " ✦" : "") + "</span></div>").join("") + '</div><div class="kv"><span>Trabalho</span>' + jobSelect(person) + "</div>" + (person.age >= 55 ? '<p class="hint good">Mentor: +25% de XP para recrutas.</p>' : "") + (person.alive && person.age >= 18 && person.level >= 5 && person.social < 7 && person.id !== state.king ? '<button class="full" data-promote="' + person.id + '">Promover a ' + SOCIAL[person.social + 1] + " · " + (typeof promotionCost === "function" ? promotionCost(person.social + 1) : 50) + " ouro</button>" : "") + familyControls(person) + '<details class="traits"><summary>Raça, casta e herança visual</summary><div class="traits-grid">' + racialRows(person) + traitRows(person) + '</div><p class="hint">Cada traço é herdado de um dos pais, independentemente dos demais.</p></details></div>';
}
function peopleView() {
  const list = state.people.filter((person) => filter === "dead" ? !person.alive : filter === "children" ? person.alive && person.level < 5 : filter === "debut" ? person.alive && person.debut : person.alive);
  return '<div class="view-tools"><select id="people-filter" aria-label="Filtrar população"><option value="all" ' + (filter === "all" ? "selected" : "") + ">Todos os moradores (" + alive().length + ')</option><option value="debut" ' + (filter === "debut" ? "selected" : '') + '>Debut · novos adultos</option><option value="children" ' + (filter === "children" ? "selected" : '') + '>Crianças</option><option value="dead" ' + (filter === "dead" ? "selected" : '') + '>Memorial</option></select><button class="primary" data-action="recruit-info">⚑ Recrutar</button></div><div class="people-grid">' + (list.map((person) => '<button class="citizen-card" data-person="' + person.id + '">' + (typeof portrait === "function" ? portrait(person) : "") + '<div class="citizen-info"><div><h2>' + esc(person.name) + " " + esc(person.family) + "</h2>" + (person.debut ? '<span class="badge debut">DEBUT</span>' : "") + "</div><p>" + sexLabel(person) + " · " + stage(person) + " · " + Math.floor(person.age) + ' anos · ' + raceLabel(person) + '</p><span class="rank rank-' + person.rank + '">' + (person.level < 5 ? "Rank não revelado" : RANKS[person.rank]) + '</span><span class="citizen-class">' + (person.vocation || "Em formação") + " · " + SOCIAL[person.social] + '</span><div class="card-footer"><span>' + (person.alive ? JOBS[person.job] : "Memorial") + "</span><span>" + Math.round(person.hp) + "% PV</span></div></div></button>").join("") || '<p class="empty">Nenhum cidadão nesta categoria.</p>') + "</div>";
}
function buildView() {
  return '<div class="section-intro">A cabana do pioneiro é seu único abrigo inicial. As demais construções só aparecem no mapa depois de prontas.</div><div class="build-grid">' + Object.entries(BUILD).map(([key, building]) => { const cost = price(key); return '<article class="build-card"><div class="build-heading"><div class="building-symbol">' + building.icon + "</div><div><h2>" + building.name + '</h2><span class="muted">' + (state.buildings[key] ? "Nível " + state.buildings[key] : "Não construída") + "</span></div></div><p>" + building.desc + '</p><div class="build-action"><span>' + cost.wood + " madeira<br>" + cost.iron + ' ferro</span><button class="primary" data-build="' + key + '" ' + (!afford(cost) ? "disabled" : "") + ">" + (state.buildings[key] ? "Ampliar" : "Construir") + "</button></div>" + (key === "tavern" && state.buildings.tavern ? '<button class="full" data-action="mercenary">Contratar bárbaro · 90 ouro</button>' : "") + "</article>"; }).join("") + "</div>";
}
function economyView() {
  return '<div class="economy-layout"><section class="panel"><div class="panel-title"><h2>Distribuir trabalho (Território da Coroa)</h2><span class="tag">' + workers("idle").length + ' disponíveis</span></div><div class="panel-body">' + [["wood", "Lenha"], ["iron", "Mineração"], ["food", "Caça e pesca"], ["train", "Treinamento"]].map(([key, name]) => '<div class="work-row"><div><h3>' + name + "</h3><p>" + (key === "train" ? "Requer quartel" : "Tributo estimado para o Rei") + "</p>" + (key === "food" ? "<small>Caçadores reais: " + workers(key).length + "</small>" : "") + '</div><div class="stepper"><button data-worker="' + key + '" data-delta="-1" aria-label="Remover trabalhador de ' + name + '">−</button><b>' + workers(key).length + '</b><button data-worker="' + key + '" data-delta="1" aria-label="Adicionar trabalhador a ' + name + '">+</button></div></div>').join("") + '</div></section><section class="panel"><div class="panel-title"><h2>Cofres Reais & Sustento da Vila</h2></div><div class="panel-body">' + [["wood", "Madeira Real"], ["iron", "Ferro Real"], ["food", "Alimento Real"]].map(([key, name]) => '<div class="kv"><span>' + name + " acumulado na Coroa</span><b>" + Math.floor(state[key] || 0) + "</b></div>").join("") + '<div class="kv"><span>Consumo real de comida</span><b>' + (alive().filter((person) => !getDirectLiege(person) || getDirectLiege(person).id === state.king).length * 0.45).toFixed(1) + ' / dia</b></div><div class="kv"><span>Taxa Feudal de Repasse</span><b>' + (state.royalTaxRate || 0.25) * 100 + '% por nível</b></div><p class="description">' + (state.buildings.fire && state.wood > 0 ? "A fogueira protege os trabalhadores." : "Sem fogueira acesa, trabalhadores fora do abrigo perdem vida pelo frio.") + '</p><p class="hint">Região atual: ' + (REGIONS[state.region]?.name || "Norte") + ". Cada vassalo gerencia seu feudo e repassa tributos subindo na cadeia feudal até o Rei.</p></div></section></div>";
}
function dynastyView() {
  const king = state.people.find((person) => person.id === state.king);
  const couples = alive().filter((person) => person.sex === "F" && hasSpouse(person));
  return '<div class="dynasty-layout"><section class="panel"><div class="panel-title"><h2>Casa ' + esc(king?.family || "Valen") + '</h2></div><div class="panel-body">' + (king ? '<button class="relative royal" data-person="' + king.id + '">' + (typeof portrait === "function" ? portrait(king) : "") + "<span><strong>" + esc(king.name) + " " + esc(king.family) + "</strong><small>Regente · " + sexLabel(king) + "</small><small>" + (hasSpouse(king) ? "Ver aliança e descendentes" : "Escolher uma consorte na ficha") + "</small></span><b>›</b></button>" : "") + '<p class="description">Escolha os casamentos nas fichas dos personagens. Não há casamentos automáticos.</p><div class="kv"><span>Crianças</span><b>' + alive().filter((person) => person.level < 5).length + '</b></div><div class="kv"><span>Veteranos</span><b>' + adults().filter((person) => person.age >= 55).length + '</b></div><div class="kv"><span>Espaço para novos moradores</span><b>' + Math.max(0, capacity() - alive().length) + '</b></div><p class="hint">Casais com menos de 55 anos podem ter filhos a cada 32 dias. Nascimentos são verificados a cada 16 dias e precisam de comida e espaço.</p></div></section><section class="panel"><div class="panel-title"><h2>Famílias da vila</h2></div><div class="panel-body">' + (couples.map((person) => { const spouse = state.people.find((candidate) => candidate.id === person.spouse); return '<button class="relative" data-person="' + person.id + '">' + (typeof portrait === "function" ? portrait(person, "mini-portrait") : "") + (typeof portrait === "function" ? portrait(spouse, "mini-portrait") : "") + "<span>" + esc(person.name) + " & " + esc(spouse.name) + "<small>" + state.people.filter((child) => child.parents.includes(person.id)).length + " filhos · ver família</small></span></button>"; }).join("") || '<p class="empty">Ainda não há casais na vila. Novas histórias começarão com os próximos chamados.</p>') + "</div></section></div>";
}
function armyView() {
  const battle = state.battle;
  return '<div class="army-layout"><section class="panel"><div class="panel-title"><h2>Sua patrulha</h2><span class="tag">' + selection.length + ' / 4</span></div><div class="panel-body"><p class="description">Quatro adultos · 15 alimentos · mortes permanentes.</p>' + (!state.buildings.barracks ? '<p class="notice">Construa um quartel para liberar expedições.</p>' : '') + '<div class="army-list">' + adults().map((person) => '<label><input type="checkbox" data-party="' + person.id + '" ' + (selection.includes(person.id) ? "checked" : "") + " " + (battle?.active ? "disabled" : "") + ">" + (typeof portrait === "function" ? portrait(person, "mini-portrait") : "") + "<span>" + esc(person.name) + "<small>" + person.vocation + " · " + Math.round(person.hp) + "% PV · poder " + Math.round(power(person)) + "</small></span></label>").join("") + '</div><button class="primary full" data-action="battle" ' + (selection.length !== 4 || !state.buildings.barracks || battle?.active ? "disabled" : '') + '>Enviar ao Vale dos Lobos</button></div></section><section class="panel"><div class="panel-title"><h2>Vale dos lobos</h2><span class="tag">' + (battle?.active ? "Em combate" : battle?.won ? "Vitória" : "Fronteira") + '</span></div><div class="panel-body"><div class="battle-pixels">⚔</div><div class="kv"><span>Alcateia gélida</span><b>' + Math.ceil(battle ? battle.enemyHP : 200 + state.wins * 60) + ' PV</b></div><div class="health enemy"><span style="width:' + (battle ? battle.enemyHP / battle.maxHP * 100 : 100) + '%"></span></div><p class="hint">Recompensa: 45 ouro · 30 alimento · 12 ferro</p>' + (battle?.active ? '<button class="primary" data-action="round">Próxima rodada</button> <button data-action="retreat">Recuar</button>' : '') + '<div class="battle-log">' + (battle ? battle.logs.map((entry) => "<p>" + esc(entry) + "</p>").join("") : "<p>Prepare sua patrulha. Uma rodada é resolvida a cada dia ou ao clicar em Próxima rodada.</p>") + "</div></div></section></div>";
}
