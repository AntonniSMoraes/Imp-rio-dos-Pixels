"use strict";

function canBreed(firstRace, secondRace) {
  return Boolean(RACES[firstRace]?.canInterbreed && RACES[secondRace]?.canInterbreed);
}

function hybridRace(firstRace, secondRace) {
  if (firstRace === secondRace) return firstRace;
  if (!canBreed(firstRace, secondRace)) return null;

  const nonHumanRace = firstRace === "human" ? secondRace : secondRace === "human" ? firstRace : null;
  if (nonHumanRace) return "half-" + nonHumanRace;

  return Math.random() < 0.5 ? firstRace : secondRace;
}

function inheritRaceData(firstParent, secondParent) {
  const firstRace = firstParent.race || "human";
  const secondRace = secondParent.race || "human";
  const race = hybridRace(firstRace, secondRace) || firstRace;
  return {
    race,
    caste: null,
    racialTraits: [],
    raceOrigins: [firstParent.id, secondParent.id],
  };
}
