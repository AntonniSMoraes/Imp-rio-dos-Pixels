"use strict";

const RACE_ATLAS_ASSETS = {
  human: "assets/anime-character-atlas.png",
  elf: "assets/anime-character-atlas-elf.png",
  dwarf: "assets/anime-character-atlas-dwarf.png",
  darkElf: "assets/anime-character-atlas-dark-elf.png",
  beastfolk: "assets/anime-character-atlas-wolf.png",
  wolf: "assets/anime-character-atlas-wolf.png",
  bunny: "assets/anime-character-atlas-bunny.png",
  cat: "assets/anime-character-atlas-cat.png",
  kobold: "assets/anime-character-atlas-kobold.png",
  lamia: "assets/anime-character-atlas-lamia.png",
  harpy: "assets/anime-character-atlas-harpy.png",
  "half-bunny": "assets/anime-character-atlas-half-bunny.png",
  "half-cat": "assets/anime-character-atlas-half-cat.png",
  "half-wolf": "assets/anime-character-atlas-half-wolf.png",
  "half-dragon": "assets/anime-character-atlas-half-dragon.png",
};

function getRaceAtlasAsset(race) {
  return RACE_ATLAS_ASSETS[race] || RACE_ATLAS_ASSETS.human;
}
