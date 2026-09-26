"use strict";

function alive() {
  return state ? state.people.filter((person) => person.alive) : [];
}

function adults() {
  return alive().filter((person) => person.level >= 5 && isAdultAge(person));
}

function onMission(person) {
  return Boolean(person.capturedBy) || Boolean(state?.battle?.active && state.battle.party.includes(person.id)) || (typeof Warfare !== 'undefined' && Warfare.deployed(person.id));
}

function workers(job) {
  return adults().filter((person) => {
    const royal = typeof isRoyalFamilyMember === "function" ? isRoyalFamilyMember(person) : person.id === state.king;
    const liege = getDirectLiege(person);
    return !royal && (!liege || liege.id === state.king) && person.job === job && !onMission(person);
  });
}

function capacity() {
  if (!state) return 4;
  const feudalVillages = new Set(alive().filter(p=>p.social>=2 && p.id!==state.king).flatMap(p=>p.tiles||[]));
  return 4 + state.buildings.home * 6 + feudalVillages.size * 4;
}

function mentor() {
  return adults().some((person) => person.age >= 55);
}

function getTileBiome(index) {
  const seed = (index * 137 + 41) % 100;
  if (seed < 28) return "floresta";
  if (seed < 54) return "lago";
  if (seed < 76) return "mina";
  return "planicie";
}

function getWorkerBiomeMod(person, job) {
  const head = typeof byId === "function" ? byId(person.houseHead) : null;
  const target = head || person;
  const tiles = target.tiles || [target.territory];
  if (!tiles.length || tiles[0] === null || tiles[0] === undefined) return 1;
  const biome = getTileBiome(tiles[0]);
  if (job === "wood" && biome === "floresta") return 1.35;
  if (job === "food" && biome === "lago") return 1.35;
  if (job === "iron" && biome === "mina") return 1.4;
  return 1;
}

function getYield(person, job) {
  if (!person) return 1;
  let bonus = 1;
  if (job === "food") bonus += (person.attrs.agilidade || 7) / 25;
  if (job === "wood") bonus += (person.attrs.força || 8) / 30;
  if (job === "iron") bonus += (person.attrs.vigor || 8) / 30;
  return bonus * getWorkerBiomeMod(person, job) * (1 + (person.level - 5) * 0.05);
}

function getDirectLiege(person) {
  if (!person || !state || person.id === state.king) return null;
  const findPerson = (id) => state.people.find((candidate) => candidate.id === id);
  if (person.liege) return findPerson(person.liege) || findPerson(state.king);
  const head = person.houseHead ? findPerson(person.houseHead) : null;
  if (head && head.id !== person.id) {
    if (head.social >= 2) return head;
    if (head.liege) return findPerson(head.liege) || findPerson(state.king);
  }
  return findPerson(state.king);
}

function processEconomyAndTaxes() { return AnnualEconomy.tick(); }

function rates() {
  return Object.fromEntries(["wood", "iron", "food", "gold"].map(key => [key,
    Number.isFinite(state?.economyBalance?.[key]) ? state.economyBalance[key] : 0,
  ]));
}
