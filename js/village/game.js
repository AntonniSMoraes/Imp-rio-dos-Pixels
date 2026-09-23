"use strict";
const FEMALE = NAME_BANK.female;
const MALE = NAME_BANK.male;
const FAMILIES = NAME_BANK.family;

let view = "map",
  speed = 0,
  selected = { kind: "building", key: "pioneer" },
  selection = [],
  filter = "all";
let tickClock = 0,
  lastTime = 0,
  anim = 0,
  toastTimer,
  saveFailed = false,
  modalPerson = null,
  isMandatoryModal = false,
  mapHits = [];

function migrate(old) {
  const s = structuredClone(old);
  s.version = 2;
  s.region = s.region || "north";
  s.royalTaxRate = s.royalTaxRate || 0.25;
  s.nextRecruitDay = s.day;
  s.guests = [];
  s.lastRecruit = null;
  s.legacy = true;
  s.placed = [];
  for (const p of s.people) {
    p.sex = FEMALE.includes(p.name) ? "F" : "M";
    p.genes = randomGenes();
    p.origins = {};
    p.debut = false;
    p.lastBirth = p.born ?? -32;
    p.treasury = p.treasury || { wood: 0, iron: 0, food: 0, gold: 0 };
  }
  for (const p of s.people) {
    const spouse = s.people.find((x) => x.id === p.spouse);
    if (spouse) spouse.sex = p.sex === "M" ? "F" : "M";
  }
  for (const p of s.people) {
    const parents = p.parents
      .map((id) => s.people.find((x) => x.id === id))
      .filter(Boolean);
    if (parents.length === 2) Object.assign(p, inheritGenes(...parents));
  }
  return s;
}

let state = null;
try {
  let data = localStorage.getItem(KEY);
  if (data) {
    state = JSON.parse(data);
    validateSave(state);
  } else if (localStorage.getItem(LEGACY_KEY)) {
    state = migrate(JSON.parse(localStorage.getItem(LEGACY_KEY)));
    validateSave(state);
  }
} catch {
  state = null;
}

if (state) {
  seedNames([...state.people, ...state.guests]);
}

function log(text) {
  if (!state) return;
  state.logs.unshift({ day: state.day, text });
  state.logs = state.logs.slice(0, 80);
}
function toast(text) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3800);
}
function save() {
  if (!state) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
    return true;
  } catch {
    saveFailed = true;
    return false;
  }
}
function date() {
  if (!state) return "Dia 1 · Ano 1";
  return (
    "Dia " +
    (((state.day - 1) % 48) + 1) +
    " · Ano " +
    (Math.floor((state.day - 1) / 48) + 1)
  );
}

function temperature() {
  if (!state) return 0;
  const baseTemp = [-8, -3, -15, -26][Math.floor((state.day - 1) / 12) % 4];
  const regOffset = REGIONS[state.region]?.tempOffset || 0;
  return baseTemp + regOffset;
}

function season() {
  if (!state) return "Degelo";
  return ["Degelo", "Sol pálido", "Geada", "Inverno profundo"][
    Math.floor((state.day - 1) / 12) % 4
  ];
}
function price(k) {
  const b = BUILD[k],
    f = 1 + (state?.buildings?.[k] || 0) * 0.35;
  return { wood: Math.round(b.wood * f), iron: Math.round(b.iron * f) };
}
function afford(p) {
  if (!state) return false;
  return state.wood >= p.wood && state.iron >= p.iron;
}
function death(p, reason) {
  if (!p.alive || !state) return;
  p.alive = false;
  p.hp = 0;
  p.deathReason = reason;
  log(p.name + " " + p.family + " morreu " + reason + ".");
  if (p.id === state.king) {
    const heir =
      alive()
        .filter((person) => person.parents.includes(p.id))
        .sort((first, second) => second.age - first.age)[0] ||
      alive()
        .filter((person) => person.family === p.family)
        .sort((first, second) => second.age - first.age)[0] ||
      adults()[0] ||
      alive()[0];
    if (heir) {
      state.king = heir.id;
      heir.social = 3;
      log(heir.name + " assume a Casa " + heir.family + ".");
    } else {
      speed = 0;
      log("A linhagem terminou. Inicie uma nova campanha.");
    }
  }
}

function reveal(p) {
  p.level = 5;
  p.age = Math.max(18, p.age);
  p.vocation = pick(CLASSES);
  p.debut = true;
  log("DEBUT: " + p.name + " chegou à maioridade. Abra sua ficha para conhecer sua bênção.");
}

function advance() {
  if (!state || !alive().length) {
    speed = 0;
    return;
  }
  state.day++;
  const royalPopulation = alive().filter((person) => !getDirectLiege(person) || getDirectLiege(person).id === state.king).length;
  const tributes = processEconomyAndTaxes();
  state.woodRate = tributes.wood;
  state.ironRate = tributes.iron;
  state.foodRate = tributes.food;
  state.wood = Math.max(0, state.wood - state.buildings.fire * 2);
  state.food = Math.max(0, state.food - royalPopulation * 0.45);
  state.gold += adults().length * 0.35;

  if (state.day % 12 === 0) {
    const region = REGIONS[state.region] || REGIONS.north;
    const scale = Math.max(1, alive().length / 7);
    state.nodes.wood += Math.round(250 * scale * (region.modifiers?.wood || 1));
    state.nodes.iron += Math.round(150 * scale * (region.modifiers?.iron || 1));
    state.nodes.food += Math.round(350 * scale * (region.modifiers?.food || 1));
    log("Respawn rúnico: novos recursos e tributos prosperam pelo território.");
  }

  for (const person of alive()) {
    person.age += 1 / 24;
    const outside = ["wood", "iron", "food"].includes(person.job) && !onMission(person);
    const sheltered = !outside || (state.buildings.fire >= 1 && state.wood > 0) || person.barbarian;
    if (state.food <= 0 && (!getDirectLiege(person) || getDirectLiege(person).id === state.king)) person.hp -= 3;
    else if (!sheltered) person.hp -= temperature() < -20 ? 4 : 2;
    else person.hp = Math.min(100, person.hp + 2.5);
    if (person.level < 5) {
      person.xp += 8;
      person.level = Math.min(4, 1 + Math.floor(person.xp / 32));
      if (person.xp >= 128) reveal(person);
    } else if (person.job !== "idle" && !onMission(person)) {
      person.xp += person.job === "train" ? (mentor() ? 12.5 : 10) : 5;
      if (person.xp >= 100) {
        person.level++;
        person.xp -= 100;
      }
    }
    if (person.age >= 72) person.hp -= 10;
    if (person.hp <= 0) death(person, state.food <= 0 ? "pela fome" : !sheltered ? "pelo frio" : "de velhice");
  }
  if (state.battle?.active) battleRound();
  save();
  render();
  refreshPersonModal();
}

function build(k) {
  if (!state) return;
  const cost = price(k);
  if (!afford(cost)) return toast("Faltam recursos para construir.");
  state.wood -= cost.wood;
  state.iron -= cost.iron;
  state.buildings[k]++;
  log(
    BUILD[k].name +
      " " +
      (state.buildings[k] === 1 ? "construída" : "ampliada") +
      ".",
  );
  save();
  render();
  toast(BUILD[k].name + " pronta.");
}
{
function peopleView() {
  const list = state.people.filter((p) =>
    filter === "dead"
      ? !p.alive
      : filter === "children"
        ? p.alive && p.level < 5
        : filter === "debut"
          ? p.alive && p.debut
          : p.alive,
  );
  return (
    '<div class="view-tools"><select id="people-filter" aria-label="Filtrar população"><option value="all" ' +
    (filter === "all" ? "selected" : "") +
    ">Todos os moradores (" +
    alive().length +
    ')</option><option value="debut" ' +
    (filter === "debut" ? "selected" : "") +
    '>Debut · novos adultos</option><option value="children" ' +
    (filter === "children" ? "selected" : "") +
    '>Crianças</option><option value="dead" ' +
    (filter === "dead" ? "selected" : "") +
    '>Memorial</option></select><button class="primary" data-action="recruit-info">⚑ Recrutar</button></div><div class="people-grid">' +
    (list
      .map(
        (p) =>
          '<button class="citizen-card" data-person="' +
          p.id +
          '">' +
          (typeof portrait === "function" ? portrait(p) : "") +
          '<div class="citizen-info"><div><h2>' +
          esc(p.name) +
          " " +
          esc(p.family) +
          "</h2>" +
          (p.debut ? '<span class="badge debut">DEBUT</span>' : "") +
          "</div><p>" +
          sexLabel(p) +
          " · " +
          stage(p) +
          " · " +
          Math.floor(p.age) +
          ' anos</p><span class="rank rank-' +
          p.rank +
          '">' +
          (p.level < 5 ? "Rank não revelado" : RANKS[p.rank]) +
          '</span><span class="citizen-class">' +
          (p.vocation || "Em formação") +
          " · " +
          SOCIAL[p.social] +
          '</span><div class="card-footer"><span>' +
          (p.alive ? JOBS[p.job] : "Memorial") +
          "</span><span>" +
          Math.round(p.hp) +
          "% PV</span></div></div></button>",
      )
      .join("") || '<p class="empty">Nenhum cidadão nesta categoria.</p>') +
    "</div>"
  );
}
function buildView() {
  return (
    '<div class="section-intro">A cabana do pioneiro é seu único abrigo inicial. As demais construções só aparecem no mapa depois de prontas.</div><div class="build-grid">' +
    Object.entries(BUILD)
      .map(([k, b]) => {
        const cost = price(k);
        return (
          '<article class="build-card"><div class="build-heading"><div class="building-symbol">' +
          b.icon +
          "</div><div><h2>" +
          b.name +
          '</h2><span class="muted">' +
          (state.buildings[k]
            ? "Nível " + state.buildings[k]
            : "Não construída") +
          "</span></div></div><p>" +
          b.desc +
          '</p><div class="build-action"><span>' +
          cost.wood +
          " madeira<br>" +
          cost.iron +
          ' ferro</span><button class="primary" data-build="' +
          k +
          '" ' +
          (!afford(cost) ? "disabled" : "") +
          ">" +
          (state.buildings[k] ? "Ampliar" : "Construir") +
          "</button></div>" +
          (k === "tavern" && state.buildings.tavern
            ? '<button class="full" data-action="mercenary">Contratar bárbaro · 90 ouro</button>'
            : "") +
          "</article>"
        );
      })
      .join("") +
    "</div>"
  );
}

function economyView() {
  return (
    '<div class="economy-layout"><section class="panel"><div class="panel-title"><h2>Distribuir trabalho (Território da Coroa)</h2><span class="tag">' +
    workers("idle").length +
    ' disponíveis</span></div><div class="panel-body">' +
    [
      ["wood", "Lenha"],
      ["iron", "Mineração"],
      ["food", "Caça e pesca"],
      ["train", "Treinamento"],
    ]
      .map(
        ([k, n]) =>
          '<div class="work-row"><div><h3>' +
          n +
          "</h3><p>" +
          (k === "train" ? "Requer quartel" : "Tributo estimado para o Rei") +
          "</p>" +
          (k === "food"
            ? "<small>Caçadores reais: " + workers(k).length + "</small>"
            : "") +
          '</div><div class="stepper"><button data-worker="' +
          k +
          '" data-delta="-1" aria-label="Remover trabalhador de ' +
          n +
          '">−</button><b>' +
          workers(k).length +
          '</b><button data-worker="' +
          k +
          '" data-delta="1" aria-label="Adicionar trabalhador a ' +
          n +
          '">+</button></div></div>',
      )
      .join("") +
    '</div></section><section class="panel"><div class="panel-title"><h2>Cofres Reais & Sustento da Vila</h2></div><div class="panel-body">' +
    [
      ["wood", "Madeira Real"],
      ["iron", "Ferro Real"],
      ["food", "Alimento Real"],
    ]
      .map(
        ([k, n]) =>
          '<div class="kv"><span>' +
          n +
          " acumulado na Coroa</span><b>" +
          Math.floor(state[k] || 0) +
          "</b></div>",
      )
      .join("") +
    '<div class="kv"><span>Consumo real de comida</span><b>' +
    (
      alive().filter(
        (p) => !getDirectLiege(p) || getDirectLiege(p).id === state.king,
      ).length * 0.45
    ).toFixed(1) +
    ' / dia</b></div><div class="kv"><span>Taxa Feudal de Repasse</span><b>' +
    (state.royalTaxRate || 0.25) * 100 +
    '% por nível</b></div><p class="description">' +
    (state.buildings.fire && state.wood > 0
      ? "A fogueira protege os trabalhadores."
      : "Sem fogueira acesa, trabalhadores fora do abrigo perdem vida pelo frio.") +
    '</p><p class="hint">Região atual: ' +
    (REGIONS[state.region]?.name || "Norte") +
    ". Cada vassalo gerencia seu feudo e repassa tributos subindo na cadeia feudal até o Rei.</p></div></section></div>"
  );
}

function dynastyView() {
  const king = state.people.find((p) => p.id === state.king),
    couples = alive().filter((p) => p.sex === "F" && hasSpouse(p));
  return (
    '<div class="dynasty-layout"><section class="panel"><div class="panel-title"><h2>Casa ' +
    esc(king?.family || "Valen") +
    '</h2></div><div class="panel-body">' +
    (king
      ? '<button class="relative royal" data-person="' +
        king.id +
        '">' +
        (typeof portrait === "function" ? portrait(king) : "") +
        "<span><strong>" +
        esc(king.name) +
        " " +
        esc(king.family) +
        "</strong><small>Regente · " +
        sexLabel(king) +
        "</small><small>" +
        (hasSpouse(king)
          ? "Ver aliança e descendentes"
          : "Escolher uma consorte na ficha") +
        "</small></span><b>›</b></button>"
      : "") +
    '<p class="description">Escolha os casamentos nas fichas dos personagens. Não há casamentos automáticos.</p><div class="kv"><span>Crianças</span><b>' +
    alive().filter((p) => p.level < 5).length +
    '</b></div><div class="kv"><span>Veteranos</span><b>' +
    adults().filter((p) => p.age >= 55).length +
    '</b></div><div class="kv"><span>Espaço para novos moradores</span><b>' +
    Math.max(0, capacity() - alive().length) +
    '</b></div><p class="hint">Casais com menos de 55 anos podem ter filhos a cada 32 dias. Nascimentos são verificados a cada 16 dias e precisam de comida e espaço.</p></div></section><section class="panel"><div class="panel-title"><h2>Famílias da vila</h2></div><div class="panel-body">' +
    (couples
      .map((p) => {
        const s = state.people.find((x) => x.id === p.spouse);
        return (
          '<button class="relative" data-person="' +
          p.id +
          '">' +
          (typeof portrait === "function" ? portrait(p, "mini-portrait") : "") +
          (typeof portrait === "function" ? portrait(s, "mini-portrait") : "") +
          "<span>" +
          esc(p.name) +
          " & " +
          esc(s.name) +
          "<small>" +
          state.people.filter((c) => c.parents.includes(p.id)).length +
          " filhos · ver família</small></span></button>"
        );
      })
      .join("") ||
      '<p class="empty">Ainda não há casais na vila. Novas histórias começarão com os próximos chamados.</p>') +
    "</div></section></div>"
  );
}
function armyView() {
  const b = state.battle;
  return (
    '<div class="army-layout"><section class="panel"><div class="panel-title"><h2>Sua patrulha</h2><span class="tag">' +
    selection.length +
    ' / 4</span></div><div class="panel-body"><p class="description">Quatro adultos · 15 alimentos · mortes permanentes.</p>' +
    (!state.buildings.barracks
      ? '<p class="notice">Construa um quartel para liberar expedições.</p>'
      : "") +
    '<div class="army-list">' +
    adults()
      .map(
        (p) =>
          '<label><input type="checkbox" data-party="' +
          p.id +
          '" ' +
          (selection.includes(p.id) ? "checked" : "") +
          " " +
          (b?.active ? "disabled" : "") +
          ">" +
          (typeof portrait === "function" ? portrait(p, "mini-portrait") : "") +
          "<span>" +
          esc(p.name) +
          "<small>" +
          p.vocation +
          " · " +
          Math.round(p.hp) +
          "% PV · poder " +
          Math.round(power(p)) +
          "</small></span></label>",
      )
      .join("") +
    '</div><button class="primary full" data-action="battle" ' +
    (selection.length !== 4 || !state.buildings.barracks || b?.active
      ? "disabled"
      : "") +
    '>Enviar ao Vale dos Lobos</button></div></section><section class="panel"><div class="panel-title"><h2>Vale dos lobos</h2><span class="tag">' +
    (b?.active ? "Em combate" : b?.won ? "Vitória" : "Fronteira") +
    '</span></div><div class="panel-body"><div class="battle-pixels">⚔</div><div class="kv"><span>Alcateia gélida</span><b>' +
    Math.ceil(b ? b.enemyHP : 200 + state.wins * 60) +
    ' PV</b></div><div class="health enemy"><span style="width:' +
    (b ? (b.enemyHP / b.maxHP) * 100 : 100) +
    '%"></span></div><p class="hint">Recompensa: 45 ouro · 30 alimento · 12 ferro</p>' +
    (b?.active
      ? '<button class="primary" data-action="round">Próxima rodada</button> <button data-action="retreat">Recuar</button>'
      : "") +
    '<div class="battle-log">' +
    (b
      ? b.logs.map((l) => "<p>" + esc(l) + "</p>").join("")
      : "<p>Prepare sua patrulha. Uma rodada é resolvida a cada dia ou ao clicar em Próxima rodada.</p>") +
    "</div></div></section></div>"
  );
}

}

const LOCATIONS = {
  pioneer: { x: 285, y: 195, label: "Cabana" },
  home: { x: 246, y: 240, label: "Moradia" },
  hunt: { x: 416, y: 260, label: "Caça" },
  fire: { x: 323, y: 228, label: "Fogueira" },
  barracks: { x: 360, y: 180, label: "Quartel" },
  tavern: { x: 309, y: 279, label: "Taverna" },
  wood: { x: 141, y: 194, label: "Bosque" },
  iron: { x: 176, y: 109, label: "Mina" },
  food: { x: 471, y: 283, label: "Lago" },
  wolves: { x: 562, y: 150, label: "Lobos" },
};
function citizenPosition(p, index) {
  let dest = LOCATIONS.pioneer;
  if (p.job === "wood") dest = LOCATIONS.wood;
  if (p.job === "iron") dest = LOCATIONS.iron;
  if (p.job === "food") dest = LOCATIONS.hunt;
  if (p.job === "train") dest = LOCATIONS.barracks;
  if (onMission(p)) dest = { x: 520, y: 168 };
  const peers = alive().filter(
    (x) => x.job === p.job && Boolean(onMission(x)) === Boolean(onMission(p)),
  );
  const i = Math.max(
    0,
    peers.findIndex((x) => x.id === p.id),
  );
  return {
    x: dest.x - 12 + (i % 7) * 8,
    y:
      dest.y +
      23 +
      Math.floor(i / 7) * 8 +
      (speed ? Math.round(Math.sin(anim * 0.0007 + index) * 2) : 0),
  };
}

function drawMap() {
  const c = $("#map");
  if (!c || !state) return;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const W = 640,
    H = 400;
  const rect = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const noise = (x, y) => {
    const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return a - Math.floor(a);
  };
  rect(0, 0, W, H, "#aac2cb");
  for (let y = 0; y < H; y += 4)
    for (let x = 0; x < W; x += 4) {
      const n = noise(x, y);
      rect(x, y, 4, 4, n > 0.84 ? "#cedbdd" : n < 0.2 ? "#9fb8c4" : "#b6cbd0");
      if (n > 0.96) rect(x, y, 2, 1, "#e7e9dd");
    }
  for (let y = 0; y < H; y += 4) {
    const center = 490 + Math.round(Math.sin(y / 55) * 22);
    rect(center - 30, y, 76, 4, "#d6e2df");
    rect(center - 24, y, 64, 4, "#638fa7");
    rect(center - 20, y, 54, 4, "#729fb4");
    if (y % 12 === 0) rect(center - 10, y, 29, 1, "#afd0d9");
    if (y % 28 === 0) rect(center - 16, y, 10, 2, "#c9dfe2");
  }
  function mountain(x, y, size) {
    for (let row = 0; row < size; row += 2) {
      const half = Math.floor(row * 0.68);
      rect(x - half, y + row, half, 2, "#70899e");
      rect(x, y + row, half + 2, 2, "#526b83");
      if (row < size * 0.35) {
        rect(x - half, y + row, half + 2, 2, "#e2e8df");
        rect(x, y + row, half, 2, "#becdd2");
      }
    }
    for (let i = 0; i < 4; i++)
      rect(x - 5 + i * 5, y + size - 6 - i * 2, 6, 2, "#8ea4af");
  }
  for (let i = 0; i < 13; i++)
    mountain(
      20 + i * 49,
      28 + noise(i, 4) * 15,
      40 + Math.floor(noise(i, 8) * 35),
    );
  for (let i = 0; i < 4; i++)
    mountain(
      63 + i * 29,
      75 + noise(i, 5) * 22,
      33 + Math.floor(noise(i, 1) * 22),
    );
  function tree(x, y, size = 1) {
    x = Math.round(x);
    y = Math.round(y);
    rect(x - 5, y + 7, 14, 3, "#79969e");
    rect(x - 1, y + 2, 3, 8, "#6a605e");
    for (let row = 0; row < 3; row++) {
      let yy = y - 16 + row * 7,
        ww = 5 + row * 4;
      rect(x - Math.floor(ww / 2), yy, ww, 3, "#254b50");
      rect(x - Math.floor(ww / 2) - 2, yy + 3, ww + 4, 3, "#356364");
      rect(x - Math.floor(ww / 2), yy, ww - 1, 2, "#d1dcd3");
      rect(x - 1, yy - 3, 3, 3, "#719394");
    }
  }
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(noise(i, 2) * W),
      y = 100 + Math.floor(noise(i, 3) * 280),
      river = 490 + Math.round(Math.sin(y / 55) * 22);
    if (
      Math.abs(x - river) > 52 &&
      Math.hypot((x - 312) * 1.1, y - 220) > 112 &&
      !(x > 145 && x < 207 && y < 143)
    )
      tree(x, y);
  }
  function path(a, b) {
    const dist = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let i = 0; i <= dist; i += 3) {
      const x = Math.round((a.x + ((b.x - a.x) * i) / dist) / 3) * 3,
        y = Math.round((a.y + ((b.y - a.y) * i) / dist) / 3) * 3;
      rect(x - 3, y - 3, 8, 6, "#a6a797");
      rect(x - 2, y - 2, 5, 4, "#b7b6a2");
    }
  }
  for (const k of Object.keys(BUILD))
    if (state.buildings[k]) path(LOCATIONS.pioneer, LOCATIONS[k]);
  path(LOCATIONS.pioneer, { x: 285, y: 218 });
  function house(x, y, type, level) {
    const large = type === "pioneer",
      w = large ? 32 : 26,
      hh = large ? 24 : 20,
      left = x - w / 2;
    rect(left - 3, y + hh / 2, w + 9, 4, "#82958f");
    rect(left, y - 3, w, hh, "#493f43");
    rect(left + 2, y - 1, w - 4, hh - 3, "#85654f");
    rect(left + 2, y + 3, w - 4, 2, "#6c4f41");
    rect(left + 2, y + 10, w - 4, 2, "#6c4f41");
    rect(x + 2, y + 5, 7, hh - 8, "#35414c");
    rect(x + 3, y + 6, 4, hh - 10, "#4a4a4e");
    rect(left + 5, y + 3, 6, 6, "#3c4149");
    rect(left + 6, y + 4, 4, 4, "#ebc87a");
    rect(left + 7, y + 4, 1, 4, "#917344");
    for (let r = 0; r < 12; r += 2) {
      const half = Math.round(r * (large ? 1.5 : 1.3));
      rect(x - half, y - 15 + r, half * 2 + 2, 2, "#43596a");
      rect(x - half, y - 16 + r, half + 2, 2, "#e1e6db");
      if (r > 4) rect(x + 2, y - 16 + r, half - 2, 1, "#b4c9ce");
    }
    rect(x + 10, y - 19, 4, 10, "#62636a");
    rect(x + 10, y - 20, 5, 2, "#d7ddd7");
    if (type === "barracks") {
      rect(x - 15, y - 23, 1, 16, "#786758");
      rect(x - 14, y - 23, 8, 5, "#8c4b52");
    }
    if (type === "tavern") {
      rect(x + 18, y, 2, 15, "#66554c");
      rect(x + 15, y + 1, 8, 6, "#ae8b58");
    }
    if (level > 1) {
      rect(left - 6, y + 6, 5, 11, "#775b4d");
      rect(left - 8, y + 4, 9, 3, "#d5ded7");
    }
  }
  house(285, 195, "pioneer", 1);
  for (const k of Object.keys(BUILD)) {
    if (!state.buildings[k]) continue;
    const l = LOCATIONS[k];
    if (k === "fire") {
      rect(l.x - 6, l.y + 3, 13, 3, "#736860");
      rect(l.x - 8, l.y + 1, 4, 3, "#899493");
      rect(l.x + 6, l.y + 1, 4, 3, "#899493");
      rect(l.x - 4, l.y, 8, 4, "#604d48");
      if (state.wood > 0) {
        rect(l.x - 3, l.y - 6, 7, 8, "#cb763d");
        rect(l.x - 1, l.y - 11, 3, 9, "#e4aa54");
        rect(l.x, l.y - 6, 2, 6, "#f5d88c");
      }
    } else house(l.x, l.y, k, state.buildings[k]);
  }
  for (let i = 0; i < 6; i++) {
    let x = 161 + i * 5,
      y = 112 - (i % 3) * 4;
    rect(x, y, 7, 5, "#647c8b");
    rect(x + 1, y, 5, 2, "#b4c8ce");
    rect(x + 2, y + 3, 2, 2, "#d7c49d");
  }
  for (let i = 0; i < 3; i++) {
    const x = 554 + i * 9,
      y = 149 + (i % 2) * 8;
    rect(x, y, 7, 4, "#596278");
    rect(x + 5, y - 2, 4, 4, "#394459");
    rect(x + 6, y - 4, 1, 3, "#394459");
    rect(x + 1, y + 4, 1, 3, "#394459");
    rect(x + 5, y + 4, 1, 3, "#394459");
    rect(x + 8, y - 1, 1, 1, "#d69486");
  }
  mapHits = [];
  for (const [key, l] of Object.entries(LOCATIONS)) {
    if (BUILD[key] && !state.buildings[key]) continue;
    g.font = "8px monospace";
    let width = g.measureText(l.label).width + 8,
      x = l.x - width / 2,
      y =
        l.y +
        (key === "pioneer" ? -31 : BUILD[key] && key !== "fire" ? -27 : 14);
    const active = selected.kind === "building" && selected.key === key;
    rect(x, y, width, 12, active ? "#253b48" : "#314b59cf");
    g.fillStyle = active ? "#f0cf84" : key === "wolves" ? "#e5a7a1" : "#dfebdf";
    g.fillText(l.label, Math.round(x + 4), Math.round(y + 9));
    mapHits.push({
      kind: "building",
      key,
      x: l.x,
      y: l.y,
      w: 24,
      h: 23,
      label: { x, y, w: width, h: 12 },
    });
  }
  alive().forEach((p, i) => {
    const pos = citizenPosition(p, i),
      active = selected.kind === "person" && selected.id === p.id;
    if (active) {
      rect(pos.x - 3, pos.y - 3, 9, 10, "#ebcd7a");
      rect(pos.x - 2, pos.y - 2, 7, 8, "#344a59");
    }
    rect(pos.x, pos.y, 3, 3, SKIN[p.genes.skin][1]);
    rect(pos.x, pos.y, 3, 1, HAIR[p.genes.hair][1]);
    rect(
      pos.x,
      pos.y + 3,
      3,
      p.level < 5 ? 2 : 3,
      p.social === 3 ? "#e3bc66" : p.sex === "F" ? "#d9a191" : "#85bac5",
    );
    if (p.debut) rect(pos.x + 1, pos.y - 4, 1, 2, "#eaca71");
    mapHits.push({
      kind: "person",
      id: p.id,
      x: pos.x + 1,
      y: pos.y + 2,
      w: 5,
      h: 6,
    });
  });
}

function mapClick(e) {
  const c = $("#map");
  if (!c) return;
  const r = c.getBoundingClientRect(),
    scale = Math.min(r.width / 640, r.height / 400),
    offsetX = (r.width - 640 * scale) / 2,
    offsetY = (r.height - 400 * scale) / 2;
  const x = (e.clientX - r.left - offsetX) / scale,
    y = (e.clientY - r.top - offsetY) / scale;
  const person = mapHits
    .filter(
      (t) =>
        t.kind === "person" && Math.abs(t.x - x) <= 5 && Math.abs(t.y - y) <= 6,
    )
    .sort(
      (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
    )[0];
  if (person) return openPerson(person.id, true);
  const location = mapHits.find(
    (t) =>
      t.kind === "building" &&
      ((Math.abs(t.x - x) < t.w / 2 && Math.abs(t.y - y) < t.h / 2) ||
        (t.label &&
          x >= t.label.x &&
          x <= t.label.x + t.label.w &&
          y >= t.label.y &&
          y <= t.label.y + t.label.h)),
  );
  if (location) {
    selected = { kind: "building", key: location.key };
    render();
  }
}
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
    '<p>Faça um chamado gratuito por dia. Cada grupo chega junto; uma família nunca é separada por falta de vagas.</p><div class="odds"><div><b>50%</b><span>Ninguém</span></div><div><b>35%</b><span>1 pessoa</span></div><div><b>12%</b><span>2 pessoas</span></div><div><b>3%</b><span>3 pessoas</span></div></div><ul><li><b>1:</b> homem, mulher ou criança órfã.</li><li><b>2:</b> casal, viúva e filho ou viúvo e filho.</li><li><b>3:</b> pai, mãe e filho ou três crianças órfãs.</li></ul><p>Ranks individuais: Comum 70% · Raro 20% · Épico 6% · Lendário 3,8% · Místico 0,2%.</p>' +
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

document.addEventListener("click", (e) => {
  if (e.target.id === "map") return mapClick(e);
  const b = e.target.closest("button");
  if (!b) return;

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

function loop(time) {
  const delta = Math.min(time - lastTime, 1000);
  lastTime = time;
  anim = time;
  if (!document.hidden && !$("#modal")?.open && state) {
    if (speed) {
      tickClock += delta * speed;
      if (tickClock >= 5000) {
        tickClock = 0;
        advance();
      }
    }
    if (
      view === "map" &&
      speed &&
      Math.floor(time / 180) !== Math.floor((time - delta) / 180)
    )
      drawMap();
  }
  requestAnimationFrame(loop);
}

// Inicia loop
requestAnimationFrame(loop);

// Dispara tela inicial se não houver jogo salvo
if (!state) {
  render();
  setTimeout(() => promptRegionSelection(true), 10);
}