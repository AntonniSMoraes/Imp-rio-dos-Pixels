"use strict";
function date() {
  if (!state) return "Dia 1 · Ano 1";
  const current = calendarDate(state.day);
  return "Dia " + current.day + " · Ano " + current.year;
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
  if (!isAdultAge(p) || p.level >= 5) return;
  p.level = 5;
  p.xp = 0;
  p.vocation = pick(CLASSES);
  p.debut = true;
  log("DEBUT: " + p.name + " chegou à maioridade. Abra sua ficha para conhecer sua bênção.");
}

function advanceVillageDay() {
  if (!state || !alive().length) {
    speed = 0;
    return;
  }
  state.day++;
  const beforeEconomy = { wood: state.wood, iron: state.iron, food: state.food, gold: state.gold };
  const royalPopulation = alive().filter((person) => !getDirectLiege(person) || getDirectLiege(person).id === state.king).length;
  const tributes = processEconomyAndTaxes();
  state.woodRate = tributes.wood;
  state.ironRate = tributes.iron;
  state.foodRate = tributes.food;
  state.wood = Math.max(0, state.wood - state.buildings.fire * 2);
  state.food = Math.max(0, state.food - royalPopulation * 0.45);
  state.gold += adults().length * 0.35;
  state.economyBalance = Object.fromEntries(Object.keys(beforeEconomy).map(key => [key, state[key] - beforeEconomy[key]]));

  if (state.day % 12 === 0) {
    const region = REGIONS[state.region] || REGIONS.north;
    const scale = Math.max(1, alive().length / 7);
    state.nodes.wood += Math.round(250 * scale * (region.modifiers?.wood || 1));
    state.nodes.iron += Math.round(150 * scale * (region.modifiers?.iron || 1));
    state.nodes.food += Math.round(350 * scale * (region.modifiers?.food || 1));
    log("Respawn rúnico: novos recursos e tributos prosperam pelo território.");
  }

  for (const person of alive()) {
    ageOneDay(person);
    const outside = ["wood", "iron", "food"].includes(person.job) && !onMission(person);
    const sheltered = !outside || (state.buildings.fire >= 1 && state.wood > 0) || person.barbarian;
    if (state.food <= 0 && (!getDirectLiege(person) || getDirectLiege(person).id === state.king)) person.hp -= 3;
    else if (!sheltered) person.hp -= temperature() < -20 ? 4 : 2;
    else person.hp = Math.min(100, person.hp + 2.5);
    if (person.level < 5) {
      person.xp += 8;
      person.level = Math.min(4, 1 + Math.floor(person.xp / 32));
      if (isAdultAge(person)) reveal(person);
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
