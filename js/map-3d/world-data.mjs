import '../territory/provinces.js';
export const provinces = globalThis.TerritoryGeometry;
export const SAVE_KEY = 'imperio-pixels-v2';
export const BIOMES = { lago: 'Águas costeiras', mina: 'Cordilheira mineral', floresta: 'Bosques', planicie: 'Planície' };
export function tileCoords(index) {
  let x = 0, y = 0;
  for (let bit = 0; bit < 5; bit++) {
    x |= ((index >> (2 * bit)) & 1) << bit;
    if (bit < 4) y |= ((index >> (2 * bit + 1)) & 1) << bit;
  }
  return { x, y };
}
export function tileAt(x, y) {
  if (x < 0 || x >= 32 || y < 0 || y >= 16) return -1;
  let index = 0;
  for (let bit = 0; bit < 5; bit++) {
    index |= ((x >> bit) & 1) << (2 * bit);
    if (bit < 4) index |= ((y >> bit) & 1) << (2 * bit + 1);
  }
  return index;
}
// Same elevation function as realm-territory.js; rendering adds no new terrain rules.
export function elevation(x, y) {
  const distance = Math.hypot((x - 15) / 13, (y - 7.5) / 6.5);
  return 1.1 - distance + Math.sin(x * .42 + y * .28) * .35 + Math.cos(x * .22 - y * .48) * .35
    + Math.sin(x * .85 - y * .65) * .18 + Math.cos(x * .62 + y * .92) * .18 + Math.sin(x * 1.5 + y * 1.3) * .08;
}
export function heightAt(x, z) { return (elevation(x / 4 + 15.5, z / 4 + 7.5) - .28) * 9; }
export function biomeAt(index) {
  const { x, y } = tileCoords(index), height = elevation(x, y);
  if (height < .28) return 'lago';
  if (height > .92) return 'mina';
  return Math.sin(x * .7 + y * .5) + Math.cos(x * .3 - y * .8) > .45 ? 'floresta' : 'planicie';
}
export function worldPoint(index) {
  const [x, z] = provinces.get(index).center;
  return { x, z };
}
export function readCampaign(storage) {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  const save = JSON.parse(raw);
  if (save.version !== 2 || !Array.isArray(save.people) || !Number.isFinite(save.day)) throw Error('Save de campanha inválido.');
  return save;
}
export function describeWorld(save) {
  const people = save?.people.filter(person => person.alive) || [];
  const king = people.find(person => person.id === save?.king);
  const seat = { north: 0, central: 240, south: 480 }[save?.region] ?? 240;
  const royal = new Set((save?.royalLands || [seat]).filter(index => Number.isInteger(index) && index >= 0 && index < 512));
  const lords = people.filter(person => person.social >= 2 && person.id !== save.king);
  const owners = Array.from({ length: 512 }, (_, index) => {
    const lord = lords.find(person => (person.tiles || [person.territory]).includes(index));
    return lord ? { id: lord.id, label: 'Casa ' + lord.family, color: '#b798d9' }
      : royal.has(index) ? { id: 'crown', label: king ? 'Coroa · ' + king.family : 'Coroa demonstrativa', color: '#dbb56e' }
      : { id: 'free', label: 'Terras livres', color: '#83aaa5' };
  });
  const cities = [{ index: seat, name: king ? 'Capital · ' + king.family : 'Capital demonstrativa', capital: true }];
  for (const lord of lords) {
    const index = lord.tiles?.[0] ?? lord.territory;
    if (Number.isInteger(index) && index >= 0 && index < 512 && !cities.some(city => city.index === index)) cities.push({ index, name: 'Casa ' + lord.family, capital: false });
  }
  return { owners, cities, seat, king, day: save?.day, demo: !save };
}
