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
  state.people.forEach(ensureRaceData);
  state.guests.forEach(ensureRaceData);
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
