"use strict";
function openPerson(id, side = view === "map") {
  if (!state) return;
  const p = state.people.find((x) => x.id === id);
  if (!p) return;
  p.debut = false;
  save();
  if (side) {
    modalPerson = null;
    if ($("#modal").open) $("#modal").close();
    selected = { kind: "person", id };
    render();
  } else {
    modalPerson = id;
    render();
    $("#modal").className = "character-modal";
    $("#modal").innerHTML = personPanel(p, true);
    if (!$("#modal").open) $("#modal").showModal();
  }
}
function refreshPersonModal() {
  if (modalPerson && $("#modal")?.open && state) {
    const p = state.people.find((x) => x.id === modalPerson);
    if (p) $("#modal").innerHTML = personPanel(p, true);
  }
}
function modal(title, html, mandatory = false) {
  modalPerson = null;
  isMandatoryModal = mandatory;
  const m = $("#modal");
  if (!m) return;
  m.className = "";
  const closeBtn = mandatory
    ? ""
    : '<button data-action="close" aria-label="Fechar">×</button>';
  m.innerHTML =
    '<div class="modal-title"><h2>' +
    title +
    "</h2>" +
    closeBtn +
    '</div><div class="modal-content">' +
    html +
    "</div>";
  if (!m.open) m.showModal();
}
function recruitmentInfo() {
  if (!state) return;
  modal(
    "Chamado de recrutamento",
    '<p>O primeiro chamado de uma vila com apenas o fundador garante dois adultos. Depois, faça um chamado gratuito por dia com as chances abaixo. Cada grupo chega junto; uma família nunca é separada por falta de vagas.</p><div class="odds"><div><b>50%</b><span>Ninguém</span></div><div><b>35%</b><span>1 pessoa</span></div><div><b>12%</b><span>2 pessoas</span></div><div><b>3%</b><span>3 pessoas</span></div></div><ul><li><b>1:</b> homem, mulher ou criança órfã.</li><li><b>2:</b> casal, viúva e filho ou viúvo e filho.</li><li><b>3:</b> pai, mãe e filho ou três crianças órfãs.</li></ul><p>Ranks individuais: Comum 70% · Raro 20% · Épico 6% · Lendário 3,8% · Místico 0,2%.</p>' +
      callButton() +
      (state.lastRecruit
        ? '<p class="hint">Último chamado: dia ' +
          state.lastRecruit.day +
          " · " +
          state.lastRecruit.count +
          " encontrados.</p>"
        : ""),
  );
}
function exportProgress() {
  if (!state) return toast("Não há campanha ativa para exportar.");
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "imperio-dos-pixels-progresso.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Progresso exportado.");
}
function importProgress() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async () => {
    try {
      let s = JSON.parse(await input.files[0].text());
      if (s.version === 1) s = migrate(s);
      validateSave(s);
      state = s;
      isMandatoryModal = false;
      if (typeof upgradeKingdom === "function") upgradeKingdom();
      seedNames([...state.people, ...state.guests]);
      speed = 0;
      selection = [];
      selected = { kind: "building", key: "pioneer" };
      if (typeof artCache !== "undefined" && artCache.clear) artCache.clear();
      save();
      $("#modal").close();
      render();
      toast("Campanha restaurada.");
    } catch {
      toast("Arquivo de progresso inválido.");
    }
  };
  input.click();
}

function promptRegionSelection(mandatory = false) {
  let regionsOptions = "";
  for (const [k, reg] of Object.entries(REGIONS)) {
    regionsOptions +=
      '<option value="' + k + '">' + reg.name + " (" + reg.desc.slice(0, 45) + "...)</option>";
  }

  const defaultFirstName = typeof getRandomPresetName === "function" ? getRandomPresetName("M") : "Aldric";
  const defaultFamilyName = typeof getRandomPresetFamily === "function" ? getRandomPresetFamily() : "Valen";

  const html =
    '<div class="monarch-setup" style="display:flex;flex-direction:column;gap:12px;">' +
      '<div>' +
        '<label style="display:block;margin-bottom:4px;font-weight:bold;">Região de Início:</label>' +
        '<select id="setup-region" style="width:100%;padding:8px;background:#1e3446;color:#dfebdf;border:1px solid #4b667a;">' + regionsOptions + '</select>' +
      '</div>' +
      '<div>' +
        '<label style="display:block;margin-bottom:4px;font-weight:bold;">Primeiro Nome do Monarca:</label>' +
        '<input type="text" id="setup-monarch-name" value="' + defaultFirstName + '" maxlength="20" style="width:100%;padding:8px;box-sizing:border-box;background:#1e3446;color:#dfebdf;border:1px solid #4b667a;">' +
      '</div>' +
      '<div>' +
        '<label style="display:block;margin-bottom:4px;font-weight:bold;">Sobrenome / Dinastia Real:</label>' +
        '<input type="text" id="setup-monarch-family" value="' + defaultFamilyName + '" maxlength="20" style="width:100%;padding:8px;box-sizing:border-box;background:#1e3446;color:#dfebdf;border:1px solid #4b667a;">' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;">' +
        '<button type="button" data-action="reroll-monarch-names" style="flex:1;">Sortear Nomes</button>' +
        '<button type="button" class="primary" data-action="confirm-founding" style="flex:2;">Fundar Reino</button>' +
      '</div>' +
    '</div>';

  modal("Fundação da Dinastia", html, mandatory);
}

