"use strict";

function alive() {
  return state ? state.people.filter((person) => person.alive) : [];
}

function adults() {
  return alive().filter((person) => person.level >= 5 && isAdultAge(person));
}

function onMission(person) {
  return Boolean(state?.battle?.active && state.battle.party.includes(person.id));
}

function workers(job) {
  return adults().filter((person) => {
    const royal = typeof isRoyalFamilyMember === "function" ? isRoyalFamilyMember(person) : person.id === state.king;
    const liege = getDirectLiege(person);
    return !royal && (!liege || liege.id === state.king) && person.job === job && !onMission(person);
  });
}

function capacity() {
  return state ? 4 + state.buildings.home * 6 : 4;
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

function processEconomyAndTaxes() {
  if (!state) return { wood: 0, iron: 0, food: 0, gold: 0 };
  const taxRate = state.royalTaxRate || 0.25;
  const region = REGIONS[state.region] || REGIONS.north;
  const baseYields = {
    wood: 7 * (region.modifiers?.wood || 1),
    iron: 4 * (region.modifiers?.iron || 1),
    food: (7.5 + state.buildings.hunt * 1.2) * (region.modifiers?.food || 1),
  };
  const kingTributes = { wood: 0, iron: 0, food: 0, gold: 0 };

  for (const person of adults()) {
    if (onMission(person) || person.job === "idle" || person.job === "train") continue;
    person.treasury = person.treasury || { wood: 0, iron: 0, food: 0, gold: 0 };
    const production = baseYields[person.job] * getYield(person, person.job);
    const directLord = getDirectLiege(person);
    if (!directLord || directLord.id === state.king) {
      state[person.job] = (state[person.job] || 0) + production;
    } else {
      directLord.treasury = directLord.treasury || { wood: 0, iron: 0, food: 0, gold: 0 };
      directLord.treasury[person.job] += production;
    }
  }

  const lords = alive()
    .filter((person) => person.social >= 2 && person.id !== state.king)
    .sort((first, second) => first.social - second.social);
  for (const lord of lords) {
    lord.treasury = lord.treasury || { wood: 0, iron: 0, food: 0, gold: 0 };
    const liege = getDirectLiege(lord);
    for (const resource of ["wood", "iron", "food", "gold"]) {
      const taxAmount = lord.treasury[resource] * taxRate;
      lord.treasury[resource] -= taxAmount;
      if (!liege || liege.id === state.king) {
        state[resource] = (state[resource] || 0) + taxAmount;
        kingTributes[resource] += taxAmount;
      } else {
        liege.treasury = liege.treasury || { wood: 0, iron: 0, food: 0, gold: 0 };
        liege.treasury[resource] += taxAmount;
      }
    }
  }
  return kingTributes;
}

function rates() {
  return Object.fromEntries(["wood", "iron", "food", "gold"].map(key => [key,
    Number.isFinite(state?.economyBalance?.[key]) ? state.economyBalance[key] : 0,
  ]));
}
