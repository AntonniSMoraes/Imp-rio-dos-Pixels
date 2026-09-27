"use strict";

const ACTIVE_RACES = Object.freeze(['human', 'elf', 'darkElf', 'kobold', 'harpy', 'lamia', 'wolf', 'cat', 'bunny']);

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
    const mean = (geneticAttributes(firstParent)[key] + geneticAttributes(secondParent)[key]) / 2;
    return [key, mean * (0.85 + random() * 0.3)];
  }));
}

function ancestryLabel(person) {
  return Object.entries(normalizedAncestry(person)).sort((a, b) => b[1] - a[1]).map(([race, share]) =>
    RACES[race].name + ' ' + (share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%').join(' · ');
}

// Birth records preserve the parental values when the character is born.
// Later training must never rewrite the history of an existing descendant.
function inheritanceRecord(first, second, attributes) {
  return {
    version: 1,
    parents: [first, second].map(p => ({ id: p.id, ancestry: normalizedAncestry(p), attributes: geneticAttributes(p) })),
    attributes: { ...attributes }
  };
}
function validInheritanceRecord(record) {
  const keys = ['força', 'vigor', 'magia', 'agilidade'];
  const validAttributes = attrs => attrs && keys.every(k => Number.isFinite(attrs[k]) && attrs[k] > 0);
  const validAncestry = ancestry => ancestry && Object.entries(ancestry).length > 0 &&
    Object.entries(ancestry).every(([race, share]) => RACES[race] && !race.startsWith('half-') && Number.isFinite(share) && share > 0 && share <= 1) &&
    Math.abs(Object.values(ancestry).reduce((a,b) => a+b,0)-1) < 1e-8;
  return !!record && record.version === 1 && Array.isArray(record.parents) && record.parents.length === 2 &&
    record.parents.every(p => p && typeof p.id === 'string' && validAttributes(p.attributes) && validAncestry(p.ancestry)) &&
    record.parents[0].id !== record.parents[1].id && validAttributes(record.attributes) && keys.every(k => {
      const mean = (record.parents[0].attributes[k] + record.parents[1].attributes[k]) / 2;
      return record.attributes[k] >= mean * .85 - 1e-8 && record.attributes[k] <= mean * 1.15 + 1e-8;
    });
}
function inheritedAttributeRows(person) {
  if (!validInheritanceRecord(person.inheritance)) return [];
  return Object.entries(person.inheritance.attributes).filter(([key]) => ['força','vigor','magia','agilidade'].includes(key)).map(([key, birth]) => {
    const mean = person.inheritance.parents.reduce((sum,p) => sum+p.attributes[key]/2,0);
    return { key, mean, birth, variation: (birth / mean - 1) * 100 };
  });
}

// Caste effects are fixed additions, never a multiplier inherited repeatedly.
function geneticAttributes(person) {
  return Object.fromEntries(['força','vigor','magia','agilidade'].map(key => [key, Math.max(.001, person.attrs[key] - (person.casteBonus?.[key] || 0))]));
}
const PHYSICAL_LINEAGES = Object.freeze({
  human: ['orelhas humanas', 'pele sem pelagem'],
  elf: ['orelhas élficas alongadas'], darkElf: ['orelhas élficas alongadas'],
  wolf: ['orelhas de lobo', 'cauda lupina', 'pelagem'],
  cat: ['orelhas felinas', 'cauda felina', 'pelagem'],
  bunny: ['orelhas longas de coelho', 'cauda curta', 'pelagem'],
  beastfolk: ['orelhas animais', 'pelagem'],
  kobold: ['focinho canino', 'pelagem', 'anatomia bípede'],
  harpy: ['asas', 'penas', 'pés de ave'], lamia: ['corpo serpentino', 'escamas']
});
function physicalExpression(person) {
  const ancestry=normalizedAncestry(person);
  const dominant=Object.entries(ancestry).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
  const animal=['wolf','cat','bunny'].find(race=>ancestry[race]);
  const intermediate=Object.keys(ancestry).length===2 && ancestry.human && animal && ancestry[animal]>=.25 && ancestry[animal]<=.75;
  const atlasRace=intermediate ? 'half-'+animal : dominant;
  const features=intermediate ? ['rosto humano', ...(PHYSICAL_LINEAGES[animal]||[]).filter(feature=>feature!=='pelagem'), 'pelagem parcial'] : [...(PHYSICAL_LINEAGES[dominant]||[])];
  return { version:2, lineage:dominant, atlasRace, features, mixed:Object.keys(ancestry).length>1 };

}
function expressBirthBiology(person, parents=[], random=Math.random) {
  if(person.biologyVersion===1)return person;
  const ancestry=normalizedAncestry(person);
  person.physical=physicalExpression(person);
  person.biologicalCaste=null;
  person.casteBonus={};
  // Only the active elf lineage has a biological caste in this release.
  if(ancestry.elf > .999999 && random() < CASTES.highElf.chance) {
    person.biologicalCaste='highElf';
    for(const [key,multiplier] of Object.entries(CASTES.highElf.bonuses)) {
      person.casteBonus[key]=person.attrs[key]*(multiplier-1);
      person.attrs[key]+=person.casteBonus[key];
    }
  }
  if(person.genes) {
    const setGene=(key,value)=>{
      if(person.genes[key]!==value) {person.genes[key]=value;if(person.origins)delete person.origins[key];}
    };
    if(ancestry.elf > .999999) {setGene('skin',0);setGene('hair',person.biologicalCaste==='highElf'?4:2);}
    if(ancestry.darkElf > .999999 && ![3,5].includes(person.genes.skin))setGene('skin',3);
  }
  person.biologyVersion=1;
  return person;
}
function validBiology(person) {
  if(person.biologyVersion===undefined)return person.biologicalCaste===undefined && person.casteBonus===undefined;
  if(person.biologyVersion!==1 || ![null,'highElf'].includes(person.biologicalCaste))return false;
  const bonus=person.casteBonus;
  if(!bonus||typeof bonus!=='object'||Array.isArray(bonus))return false;
  const expected=person.biologicalCaste==='highElf'?CASTES.highElf.bonuses:{};
  if(Object.keys(bonus).length!==Object.keys(expected).length)return false;
  return (!person.biologicalCaste||normalizedAncestry(person).elf>.999999) &&
    Object.entries(bonus).every(([key,value])=>key in expected&&Number.isFinite(value)&&value>=0&&value<person.attrs[key]);
}
