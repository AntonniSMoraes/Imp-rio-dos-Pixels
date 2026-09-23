"use strict";

function rankRoll() {
  const roll = Math.random() * 100;
  return roll < 70 ? 0 : roll < 90 ? 1 : roll < 96 ? 2 : roll < 99.8 ? 3 : 4;
}

function randomGenes() {
  const regionKey =
    typeof state !== "undefined" && state && state.region
      ? state.region
      : "north";
  const region = REGIONS[regionKey] || REGIONS.north;
  return {
    hair: pick(region.hairPool),
    style: pick(region.stylePool),
    skin: pick(region.skinPool),
    eyes: rand(EYES.length),
    freckles: Math.random() < 0.25,
    brow: rand(2),
  };
}

function inheritGenes(firstParent, secondParent) {
  const genes = {};
  const origins = {};
  for (const key of Object.keys(randomGenes())) {
    const parent = Math.random() < 0.5 ? firstParent : secondParent;
    genes[key] = parent.genes[key];
    origins[key] = parent.id;
  }
  return { genes, origins };
}

function makePerson({
  name,
  age = 22,
  family = null,
  sex = pick(["M", "F"]),
  rank = null,
  parents = [],
} = {}) {
  const identity = allocateIdentity(name, sex, family);
  const resolvedRank = rank ?? rankRoll();
  const attrs = {
    força: 8 * MULT[resolvedRank],
    vigor: 8 * MULT[resolvedRank],
    magia: 6 * MULT[resolvedRank],
    agilidade: 7 * MULT[resolvedRank],
  };
  const high = [];

  if (resolvedRank === 0) {
    const roll = Math.random();
    const count = roll < 0.02 ? 2 : roll < 0.22 ? 1 : 0;
    const keys = Object.keys(attrs);
    for (let index = 0; index < count; index++) {
      const key = keys.splice(rand(keys.length), 1)[0];
      const probability = Math.random();
      const multiplier = probability < 0.65 ? 2 : probability < 0.85 ? 4 : probability < 0.95 ? 8 : 16;
      attrs[key] *= multiplier;
      high.push(key);
    }
  }

  return {
    id: crypto.randomUUID(),
    name: identity.name,
    family: identity.family,
    sex,
    race: "human",
    caste: null,
    racialTraits: [],
    age,
    rank: resolvedRank,
    attrs,
    high,
    level: age < 16 ? 1 : 5,
    xp: 0,
    vocation: age < 16 ? null : pick(CLASSES),
    social: 0,
    job: "idle",
    hp: 100,
    spouse: null,
    parents,
    alive: true,
    barbarian: false,
    loyalty: 100,
    lastBirth: -32,
    genes: randomGenes(),
    origins: {},
    debut: false,
    treasury: { wood: 0, iron: 0, food: 0, gold: 0 },
  };
}

function childOf(firstParent, secondParent) {
  const child = makePerson({
    age: 0,
    family: firstParent.family,
    parents: [firstParent.id, secondParent.id],
  });
  Object.assign(child, inheritGenes(firstParent, secondParent));
  Object.assign(child, inheritRaceData(firstParent, secondParent));

  if (Math.random() < 0.5) {
    const bestAttributes = Object.keys(child.attrs)
      .sort(
        (firstKey, secondKey) =>
          Math.max(firstParent.attrs[secondKey], secondParent.attrs[secondKey]) -
          Math.max(firstParent.attrs[firstKey], secondParent.attrs[firstKey]),
      )
      .slice(0, 2);
    for (const key of bestAttributes) {
      const value = Math.max(firstParent.attrs[key], secondParent.attrs[key]);
      if (value > child.attrs[key]) {
        child.attrs[key] = value;
        child.high.push(key);
      }
    }
  }
  return child;
}

function initial(regionKey = "north", customName = null, customFamily = null) {
  seedNames([]);
  const chosenName = customName && customName.trim() ? customName.trim() : "Aldric";
  const chosenFamily = customFamily && customFamily.trim() ? customFamily.trim() : "Valen";
  const monarch = makePerson({
    name: chosenName,
    family: chosenFamily,
    age: 24,
    sex: "M",
    rank: 0,
  });
  monarch.social = 3;
  monarch.vocation = "Guerreiro";

  const region = REGIONS[regionKey] || REGIONS.north;
  monarch.genes = {
    hair: pick(region.hairPool),
    style: pick(region.stylePool),
    skin: pick(region.skinPool),
    eyes: 1,
    freckles: true,
    brow: 1,
  };

  return {
    version: 2,
    day: 1,
    region: regionKey,
    wood: 120,
    iron: 35,
    food: 80,
    gold: 75,
    royalTaxRate: 0.25,
    people: [monarch],
    buildings: { home: 0, hunt: 0, fire: 0, barracks: 0, tavern: 0 },
    nodes: { wood: 700, iron: 400, food: 700 },
    logs: [
      {
        day: 1,
        text: monarch.name + " estabeleceu o domínio real da Coroa em " + region.name + ".",
      },
    ],
    battle: null,
    wins: 0,
    births: 0,
    king: monarch.id,
    placed: [],
    nextRecruitDay: 1,
    guests: [],
    lastRecruit: null,
    legacy: false,
  };
}
