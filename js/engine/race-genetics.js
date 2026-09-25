"use strict";

const ACTIVE_RACES = Object.freeze(['human', 'elf', 'darkElf', 'kobold', 'harpy', 'wolf', 'cat', 'bunny']);

function ancestryFromRace(race = 'human') {
  const depth = (race.match(/^(?:half-)+/) || [''])[0].length / 5;
  const base = race.replace(/^(?:half-)+/, '');
  if (!RACES[base]) return { human: 1 };
  if (!depth || base === 'human') return { [base]: 1 };
  const share = 0.5 ** depth;
  return { human: 1 - share, [base]: share };
}

function normalizedAncestry(person) {
  const entries = Object.entries(person.ancestry || {}).filter(([race, value]) =>
    RACES[race] && !race.startsWith('half-') && Number.isFinite(value) && value > 0);
  const sum = entries.reduce((total, [, value]) => total + value, 0);
  if (!entries.length || !Number.isFinite(sum)) return ancestryFromRace(person.race);
  return Object.fromEntries(entries.map(([race, value]) => [race, value / sum]));
}

function mergeAncestry(first, second) {
  const result = {};
  for (const parent of [first, second]) {
    for (const [race, share] of Object.entries(normalizedAncestry(parent))) result[race] = (result[race] || 0) + share / 2;
  }
  return result;
}

// Deterministic presentation only. Full ancestry remains independent of this ID.
function expressedRace(ancestry) {
  const entries = Object.entries(ancestry).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length === 2 && ancestry.human) {
    const other = entries.find(([race]) => race !== 'human')[0];
    if (['wolf', 'cat', 'bunny'].includes(other)) return 'half-' + other;
  }
  return entries[0][0];
}

function canBreed(firstRace, secondRace) {
  return [firstRace, secondRace].every(race => typeof race === 'string' && RACES[race.replace(/^(?:half-)+/, '')]?.canInterbreed);
}

function hybridRace(firstRace, secondRace) {
  return canBreed(firstRace, secondRace) ? expressedRace(mergeAncestry({ race: firstRace }, { race: secondRace })) : null;
}

function inheritRaceData(firstParent, secondParent) {
  const ancestry = mergeAncestry(firstParent, secondParent);
  return { race: expressedRace(ancestry), ancestry, ancestryVersion: 1, caste: null, racialTraits: [], raceOrigins: [firstParent.id, secondParent.id] };
}

function inheritAttributes(firstParent, secondParent, random = Math.random) {
  return Object.fromEntries(['força', 'vigor', 'magia', 'agilidade'].map(key => {
    const mean = (firstParent.attrs[key] + secondParent.attrs[key]) / 2;
    return [key, mean * (0.85 + random() * 0.3)];
  }));
}

function ancestryLabel(person) {
  return Object.entries(normalizedAncestry(person)).sort((a, b) => b[1] - a[1]).map(([race, share]) =>
    RACES[race].name + ' ' + (share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%').join(' · ');
}
