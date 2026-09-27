"use strict";
document.addEventListener("click", (e) => {

  const b = e.target.closest("button");
  if (!b) return;

  if (b.dataset.familyChronicle) {
    FamilyChronicle.open(b.dataset.familyChronicle,b.dataset.id,Number(b.dataset.page),b.dataset.kind);
    return;
  }
  if (b.dataset.view) {
    view = b.dataset.view;
    render();
    return;
  }
  if (b.dataset.speed !== undefined) {
    speed = +b.dataset.speed;
    tickClock = 0;
    render();
    return;
  }
  if (b.dataset.build) {
    build(b.dataset.build);
    return;
  }
  if (b.dataset.person) {
    openPerson(b.dataset.person);
    return;
  }
  if (b.dataset.marry) {
    marry(b.dataset.marry, $("#spouse-" + b.dataset.marry)?.value);
    return;
  }
  if (b.dataset.promote) {
    if (typeof promotionDialog === "function") promotionDialog(b.dataset.promote);
    return;
  }
  if (b.dataset.worker) {
    const k = b.dataset.worker,
      delta = +b.dataset.delta,
      p = (delta > 0 ? workers("idle") : workers(k))[0];
    if (!p)
      return toast(
        delta > 0
          ? "Nenhum adulto disponível. Libere alguém de outra função."
          : "Nenhum trabalhador para remover.",
      );
    setJob(p, delta > 0 ? k : "idle");
    return;
  }
  const action = b.dataset.action;
  if (action === "close") {
    if (isMandatoryModal) return;
    $("#modal").close();
    modalPerson = null;
  }
  if (action === "clear-selection") {
    selected = { kind: "building", key: "pioneer" };
    render();
  }
  if (action === "day") advance();
  if (action === "call") {
    callRecruitment();
    if ($("#modal").open) recruitmentInfo();
  }
  if (action === "admit") {
    admitGuests();
    if ($("#modal").open) recruitmentInfo();
  }
  if (action === "recruit-info") recruitmentInfo();
  if (action === "dismiss-legacy") {
    if (state) state.legacy = false;
    save();
    render();
  }
  if (action === "mercenary") recruitMercenary();
  if (action === "battle") startBattle();
  if (action === "round") {
    battleRound();
    save();
    render();
  }
  if (action === "retreat" && state?.battle?.active) {
    state.battle.active = false;
    state.battle.logs.unshift(
      "A patrulha recuou. Sobreviventes retornaram sem recompensas.",
    );
    log("A patrulha recuou.");
    save();
    render();
  }
  if (action === "chronicle")
    modal(
      "Crônicas do império",
      '<div class="chronicles">' +
        (state?.logs || [])
          .map(
            (l) => "<p><time>Dia " + l.day + "</time>" + esc(l.text) + "</p>",
          )
          .join("") +
        "</div>",
    );
  if (action === "menu")
    modal(
      "Sua campanha",
      '<div class="menu-actions"><button data-action="save">Salvar progresso</button><button data-action="export">Exportar progresso</button><button data-action="import">Importar progresso</button><button data-action="recruit-info">Chamado de recrutamento</button><button data-action="reset">Nova campanha</button><button data-action="help">Como jogar</button></div><p class="hint">O jogo é local. O progresso fica neste navegador; exporte uma cópia para guardar ou trocar de dispositivo.</p>',
    );
  if (action === "save")
    toast(
      save()
        ? "Campanha salva."
        : "Não foi possível salvar. Exporte o progresso.",
    );
  if (action === "export") exportProgress();
  if (action === "import") importProgress();
  if (action === "reset")
    modal(
      "Uma nova linhagem",
      '<p>Comece com um pioneiro solteiro e apenas sua cabana. O progresso atual será substituído; você pode exportá-lo antes.</p><button data-action="export">Exportar campanha atual</button><button class="primary" data-action="confirm-reset">Escolher Região e Começar</button>',
    );
  if (action === "confirm-reset") {
    promptRegionSelection(false);
    return;
  }
  if (action === "reroll-monarch-names") {
    const inputName = $("#setup-monarch-name");
    const inputFam = $("#setup-monarch-family");
    if (inputName && typeof getRandomPresetName === "function") inputName.value = getRandomPresetName("M");
    if (inputFam && typeof getRandomPresetFamily === "function") inputFam.value = getRandomPresetFamily();
    return;
  }
  if (action === "confirm-founding") {
    const regionKey = $("#setup-region")?.value || "north";
    const monarchName = $("#setup-monarch-name")?.value || "Aldric";
    const monarchFamily = $("#setup-monarch-family")?.value || "Valen";

    state = initial(regionKey, monarchName, monarchFamily);
    isMandatoryModal = false;
    if (typeof upgradeKingdom === "function") upgradeKingdom();
    seedNames([...state.people, ...state.guests]);
    speed = 0;
    selection = [];
    view = "map";
    selected = { kind: "building", key: "pioneer" };
    if (typeof artCache !== "undefined" && artCache.clear) artCache.clear();
    save();
    $("#modal").close();
    render();
    toast("Casa " + esc(state.people[0].family) + " fundada em " + (REGIONS[regionKey]?.name || "Norte") + "!");
    return;
  }
  if (action === "help") {
    speed = 0;
    render();
    modal(
      "Como Jogar — Guia do Império",
      "<ol>" +
        "<li><b>Regiões e Fundação:</b> Ao iniciar, escolha sua província (Norte Gélido, Planícies Centrais ou Sul Temperado). A escolha afeta o clima, a demografia (cabelo e pele) e a produtividade de madeira, minério e caça.</li>" +
        "<li><b>Capital e Expansão Territorial:</b> Sua vila inicial é a <i>Capital Real</i> e está protegida de apropriação. Compre novas terras no mapa mundi por 45 de ouro para expandir o domínio da Coroa e conceder novos feudos.</li>" +
        "<li><b>Biomas Naturais:</b> Cada território possui bônus específicos: 🌲 Florestas (+35% lenha), 🌊 Lagos (+35% caça/pesca), ⛰️ Minas (+40% ferro) e 🌾 Planícies (equilibradas).</li>" +
        "<li><b>Economia e Tributação Feudal:</b> Os recursos no topo da tela pertencem à Coroa. Cada lorde administra os plebeus em suas terras e cobra taxas; cada nível da pirâmide feudal repassa 25% dos ganhos ao seu suserano até chegar ao Rei.</li>" +
        "<li><b>Hierarquia e Promoções:</b>" +
          "<ul>" +
            "<li>Dois soldados casados podem ser promovidos até Cavaleiro. O primeiro a virar Barão torna-se o líder perpétuo da casa nobre.</li>" +
            "<li>Cavaleiros promovem até 4 soldados com prioridade para seu próprio gênero. Barões promovem até 4 cavaleiros. Se houver baixas ou vagas abertas, novas convocações ocorrem de forma contínua.</li>" +
            "<li>Feudos exigem vilas conectadas dentro do domínio da Coroa, podendo ter formatos livres (I, L ou blocos). As terras que o nobre já possui contam na expansão.</li>" +
          "</ul>" +
        "</li>" +
        "<li><b>Sucessão Dinástica e Complôs:</b> O herdeiro da casa é definido por <i>1º Raridade</i>, <i>2º Sexo Masculino</i> e <i>3º Idade</i>. Se um filho mais raro nascer e desbancar o herdeiro anterior, há 35% de chance de um complô de assassinato, cuja sobrevivência depende da raridade do novo sucessor.</li>" +
        "<li><b>Aposentadoria:</b> Nobres com 60+ anos podem abdicar e passam a se chamar <i>Nobres Aposentados</i>, mantendo suas consortes e concubinas vinculadas.</li>" +
        "<li><b>População e Memorial:</b> Moradores casados exibem o retrato do cônjuge e o contador de concubinas no card. Cidadãos falecidos são movidos para o Memorial dos Falecidos com a causa exata da morte.</li>" +
      "</ol>" +
      "<p class='hint'>▶ Velocidade normal (1 dia / 5s) · 3× Acelerar · Ⅱ Pausar · ↦ Avançar um dia. Crianças atingem maioridade aos 16 dias. Trabalhadores fora do abrigo precisam de fogueiras acesas para sobreviver ao frio.</p>",
    );
  }
});

window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape" && isMandatoryModal) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);

const modalEl = $("#modal");
if (modalEl) {
  modalEl.addEventListener("cancel", (e) => {
    if (isMandatoryModal) {
      e.preventDefault();
    }
  });
}

document.addEventListener("change", (e) => {
  if (e.target.dataset.job && state)
    setJob(
      state.people.find((p) => p.id === e.target.dataset.job),
      e.target.value,
    );
  if (e.target.id === "people-filter") {
    filter = e.target.value;
    render();
  }
  if (e.target.dataset.party) {
    const id = e.target.dataset.party;
    if (e.target.checked) {
      if (selection.length >= 4) {
        e.target.checked = false;
        return toast("Selecione apenas quatro integrantes.");
      }
      selection.push(id);
    } else selection = selection.filter((x) => x !== id);
    render();
  }
});

