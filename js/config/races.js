"use strict";

// GDD race data. This catalog is intentionally passive until the simulation consumes it.
const RACES = {
  human: {
    name: "Humano",
    type: "civilized",
    agingRate: 1,
    fertilityRate: 1,
    traits: ["adaptável", "diplomacia flexível"],
    canInterbreed: true,
  },
  elf: {
    name: "Elfo",
    type: "civilized",
    agingRate: 0.2,
    fertilityRate: 0.4,
    traits: ["xenófobo", "rival dos anões"],
    canInterbreed: true,
  },
  dwarf: {
    name: "Anão",
    type: "civilized",
    agingRate: 0.5,
    fertilityRate: 0.8,
    traits: ["teimoso", "artesão", "rival dos elfos"],
    canInterbreed: true,
  },
  orc: {
    name: "Orc",
    type: "civilized",
    agingRate: 1.2,
    fertilityRate: 1.3,
    traits: ["territorialista", "guerreiro"],
    canInterbreed: true,
  },
  beastfolk: {
    name: "Homem-Fera",
    type: "demihuman",
    agingRate: 1.5,
    fertilityRate: 2.5,
    traits: ["obsesso", "vida curta", "matilha"],
    canInterbreed: true,
  },
  wolf: {
    name: "Homem-Fera Lobo",
    type: "demihuman",
    agingRate: 1.5,
    fertilityRate: 2.5,
    traits: ["obsesso", "matilha"],
    canInterbreed: true,
  },
  cat: {
    name: "Homem-Fera Gato",
    type: "demihuman",
    agingRate: 1.5,
    fertilityRate: 2.5,
    traits: ["obsesso", "matilha"],
    canInterbreed: true,
  },
  bunny: {
    name: "Homem-Fera Coelho",
    type: "demihuman",
    agingRate: 1.5,
    fertilityRate: 2.5,
    traits: ["obsesso", "matilha"],
    canInterbreed: true,
  },
  kobold: {
    name: "Kobold",
    type: "monster",
    agingRate: 1.1,
    fertilityRate: 1.8,
    traits: ["astuto", "marginalizado"],
    canInterbreed: true,
  },
  lamia: {
    name: "Lâmia",
    type: "monster",
    agingRate: 0.8,
    fertilityRate: 1.2,
    traits: ["mágico", "vive em ruínas"],
    canInterbreed: true,
  },
  harpy: {
    name: "Harpia",
    type: "monster",
    agingRate: 1,
    fertilityRate: 1.5,
    traits: ["aviário", "vive em penhascos"],
    canInterbreed: true,
  },
  dragon: {
    name: "Dragão",
    type: "force-of-nature",
    agingRate: 0.01,
    fertilityRate: 0,
    traits: ["incontrolável", "solitário", "montanhoso"],
    canInterbreed: false,
  },
  "half-wolf": {
    name: "Meio-Fera Lobo",
    type: "hybrid",
    agingRate: 1.25,
    fertilityRate: 1.75,
    traits: ["híbrido", "visão aguçada"],
    canInterbreed: true,
  },
  "half-cat": {
    name: "Meio-Fera Gato",
    type: "hybrid",
    agingRate: 1.25,
    fertilityRate: 1.75,
    traits: ["híbrido", "agilidade"],
    canInterbreed: true,
  },
  "half-bunny": {
    name: "Meio-Fera Coelho",
    type: "hybrid",
    agingRate: 1.25,
    fertilityRate: 1.75,
    traits: ["híbrido", "fertilidade"],
    canInterbreed: true,
  },
  "half-dragon": {
    name: "Meio-Dragão",
    type: "heroic",
    agingRate: 0.5,
    fertilityRate: 0.05,
    traits: ["heróico", "escamas", "resistência ao fogo"],
    canInterbreed: true,
  },
};

const CASTES = {
  highElf: {
    name: "Alto-Elfo",
    race: "elf",
    chance: 0.02,
    trigger: "silver-hair",
    bonuses: { magia: 1.5, agilidade: 1.2 },
  },
  highDwarf: {
    name: "Alto-Anão",
    race: "dwarf",
    chance: 0.03,
    trigger: "earth-red-hair",
    bonuses: { vigor: 1.4, força: 1.2 },
  },
  highOrc: {
    name: "Alto-Orc",
    race: "orc",
    chance: 0.015,
    trigger: "blue-green-skin",
    bonuses: { força: 1.6, vigor: 1.5 },
  },
  grandDuke: {
    name: "Grão-Duque",
    race: "human",
    chance: null,
    trigger: "duke-direct-royal-blood",
    bonuses: { diplomacia: 40 },
  },
};

const RACIAL_TRAITS = [
  "supremacista",
  "xenófobo",
  "tolerante",
  "obsesso",
  "territorialista",
  "artesão",
];

function ensureRaceData(person) {
  person.race = person.race || "human";
  person.caste = person.caste || null;
  person.racialTraits = Array.isArray(person.racialTraits) ? person.racialTraits : [];
  return person;
}

function raceLabel(person) {
  const race = person?.race || "human";
  return RACES[race]?.name || race;
}
