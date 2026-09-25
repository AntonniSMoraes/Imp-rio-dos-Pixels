import { ART_VERSION, OPTIONS } from './catalog.mjs';

/** Stable seeded choices, independent of DOM, saves and game globals. */
function randomFromSeed(seed) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => {
    hash += 0x6D2B79F5;
    let value = Math.imul(hash ^ hash >>> 15, 1 | hash);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function createAppearance(seed) {
  if (typeof seed !== 'string' || !seed.length || seed.length > 120) throw new Error('Semente inválida.');
  const random = randomFromSeed(seed);
  const result = { version: ART_VERSION, seed, race: 'human', ageGroup: 'adult' };
  for (const [key, options] of Object.entries(OPTIONS)) {
    result[key] = options[Math.floor(random() * options.length)].id;
  }
  return result;
}

/** Reject unknown versions and combinations rather than silently changing identity. */
export function validateAppearance(input) {
  if (!input || input.version !== ART_VERSION || input.race !== 'human' || input.ageGroup !== 'adult') {
    throw new Error('Este piloto aceita apenas aparências humanas adultas da versão 1.');
  }
  if (typeof input.seed !== 'string' || !input.seed.length || input.seed.length > 120) {
    throw new Error('Semente inválida.');
  }
  const result = { version: ART_VERSION, seed: input.seed, race: 'human', ageGroup: 'adult' };
  for (const [key, options] of Object.entries(OPTIONS)) {
    if (!options.some(option => option.id === input[key])) throw new Error(`Opção inválida: ${key}.`);
    result[key] = input[key];
  }
  return result;
}

export function changeAppearance(current, key, value) {
  if (!Object.hasOwn(OPTIONS, key)) throw new Error('Característica desconhecida.');
  return validateAppearance({ ...current, [key]: value });
}
