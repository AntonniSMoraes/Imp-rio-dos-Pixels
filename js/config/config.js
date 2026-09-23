"use strict";

// Shared game data. Runtime behavior stays in game.js and kingdom.js.
const KEY = "imperio-pixels-v2";
const LEGACY_KEY = "imperio-pixels-v1";
const RANKS = ["Comum", "Raro", "Épico", "Lendário", "Místico"];
const MULT = [1, 2, 4, 8, 16];
const CLASSES = [
  "Guerreiro",
  "Arqueiro",
  "Assassino",
  "Berserker",
  "Mago",
  "Clérigo",
  "Paladino",
  "Santo",
];
const SOCIAL = [
  "Plebeu",
  "Soldado",
  "Cavaleiro",
  "Barão",
  "Visconde",
  "Conde",
  "Marquês",
  "Duque",
  "Rei",
];
const JOBS = {
  idle: "Disponível",
  wood: "Lenhador",
  iron: "Mineiro",
  food: "Caçador",
  train: "Recruta",
};
const BUILD = {
  home: {
    name: "Moradia",
    short: "Moradia",
    icon: "⌂",
    desc: "Mais 6 vagas para famílias e novos moradores.",
    wood: 40,
    iron: 4,
  },
  hunt: {
    name: "Cabana de caça",
    short: "Caça",
    icon: "⌁",
    desc: "Permite caçar e pescar. Cada nível melhora o rendimento da caça.",
    wood: 35,
    iron: 5,
  },
  fire: {
    name: "Fogueira central",
    short: "Fogueira",
    icon: "♨",
    desc: "Protege trabalhadores do frio. Cada nível amplia o raio e consome 2 madeiras por dia.",
    wood: 25,
    iron: 0,
  },
  barracks: {
    name: "Quartel",
    short: "Quartel",
    icon: "⚑",
    desc: "Libera treinamento e expedições de quatro cidadãos.",
    wood: 80,
    iron: 25,
  },
  tavern: {
    name: "Taverna",
    short: "Taverna",
    icon: "♜",
    desc: "Permite contratar bárbaros raros por 90 ouros.",
    wood: 90,
    iron: 20,
  },
};
const NAV = [
  ["map", "◈", "Império"],
  ["people", "♙", "População"],
  ["build", "⌂", "Construir"],
  ["economy", "⚒", "Trabalho"],
  ["dynasty", "♜", "Dinastia"],
  ["army", "⚔", "Expedições"],
];
const HAIR = [
  ["Preto", "#302e3d", "#4c4350"],
  ["Castanho", "#624136", "#916044"],
  ["Loiro", "#b28b49", "#e4c577"],
  ["Ruivo", "#914b35", "#c77a45"],
  ["Prateado", "#9aabb3", "#d5dee1"],
  ["Acaju", "#61372f", "#a25d49"],
  ["Castanho-claro", "#8e6746", "#c7a37a"],
  ["Loiro-acinzentado", "#90816c", "#d6c7a8"],
];
const SKIN = [
  ["Clara", "#e6b795", "#f7d1ac", "#b77e69"],
  ["Dourada", "#c78c60", "#e0ac7a", "#955e47"],
  ["Morena", "#9d654c", "#bd8463", "#704737"],
  ["Escura", "#704a3e", "#926452", "#4b3430"],
  ["Oliva", "#b58d68", "#d4b18a", "#855f47"],
  ["Ébano", "#503b35", "#715447", "#372823"],
];
const EYES = [
  ["Azuis", "#609bd6"],
  ["Verdes", "#77a56c"],
  ["Castanhos", "#9b703d"],
  ["Cinza", "#aabcc2"],
  ["Âmbar", "#bd963d"],
  ["Avelã", "#8c9152"],
  ["Violeta", "#8b79ad"],
];
const STYLES = ["Curto", "Ondulado", "Trançado", "Longo"];
const REGIONS = {
  north: {
    name: "Norte Gélido",
    desc: "Terras árticas e montanhosas. Muito frio, abundância de minérios, mas escassez de caça.",
    seat: 0,
    tempOffset: -12,
    skinPool: [0, 0, 1],
    hairPool: [2, 4, 7],
    stylePool: [0, 1],
    modifiers: { wood: 0.8, iron: 1.35, food: 0.75 },
  },
  central: {
    name: "Planícies Centrais",
    desc: "Florestas e vales temperados. Clima equilibrado com distribuição balanceada.",
    seat: 240,
    tempOffset: 0,
    skinPool: [0, 1, 2, 4],
    hairPool: [0, 1, 2, 3, 5, 6],
    stylePool: [0, 1, 2, 3],
    modifiers: { wood: 1.0, iron: 1.0, food: 1.0 },
  },
  south: {
    name: "Sul Temperado",
    desc: "Bosques costeiros mais quentes. Caça farta e madeira abundante, porém ferro escasso.",
    seat: 480,
    tempOffset: 9,
    skinPool: [1, 2, 3, 5],
    hairPool: [0, 1, 3, 5],
    stylePool: [1, 2, 3],
    modifiers: { wood: 1.25, iron: 0.75, food: 1.3 },
  },
};
const LORD_CAP = { 2: 4, 3: 4, 4: 2, 5: 2, 6: 2, 7: 4, 8: Infinity };
const LAND_SIZE = { 2: 1, 3: 4, 4: 8, 5: 16, 6: 32, 7: 128, 8: 512 };
const LAND_NAME = { 2: "Vila", 3: "Baronato", 4: "Viscondado", 5: "Condado", 6: "Marquesado", 7: "Ducado", 8: "Capital" };
const FEMALE_TITLES = { 0: "Plebeia", 1: "Soldada", 2: "Cavaleira", 3: "Baronesa", 4: "Viscondessa", 5: "Condessa", 6: "Marquesa", 7: "Duquesa", 8: "Rainha" };
const MALE_TITLES = { 0: "Plebeu", 1: "Soldado", 2: "Cavaleiro", 3: "Barão", 4: "Visconde", 5: "Conde", 6: "Marquês", 7: "Duque", 8: "Rei" };
const ORDERS = { idle: "Aguardar ordens", balance: "Equilibrar estoques", wood: "Coletar lenha", iron: "Minerar", food: "Caçar / pescar", raid: "Fazer raids" };
const TEXTURES = ["Liso", "Ondulado", "Cacheado", "Crespo"];
