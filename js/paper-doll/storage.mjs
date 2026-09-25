import { validateAppearance } from './appearance.mjs';

export const STORAGE_KEY = 'imperio-paper-doll-pilot-v1';

export function saveAppearance(storage, appearance) {
  const validated = validateAppearance(appearance);
  storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

export function loadAppearance(storage) {
  const json = storage.getItem(STORAGE_KEY);
  return json === null ? null : validateAppearance(JSON.parse(json));
}
