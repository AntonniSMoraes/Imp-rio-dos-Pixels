import { settlementSite, domainColor } from './settlements.mjs';
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
  const seat = save?.capitalIndex ?? { north: 0, central: 240, south: 480 }[save?.region] ?? 240;
  const royal = new Set((save?.royalLands || [seat]).filter(index => Number.isInteger(index) && index >= 0 && index < 512));
  const lords = people.filter(person => person.social >= 2 && person.id !== save.king).sort((a,b)=>a.social-b.social);
  const owners = Array.from({ length: 512 }, (_, index) => {
    const lord = lords.find(person => (person.tiles || [person.territory]).includes(index));
    const enemy = save?.warfare?.realms.find(realm=>realm.tiles.includes(index));
    return lord ? { id: lord.id, label: 'Casa ' + lord.family, color: domainColor(lord.id) }
      : royal.has(index) ? { id: 'crown', label: king ? 'Coroa · ' + king.family : 'Coroa demonstrativa', color: '#dbb56e' }
      : enemy ? {id:enemy.id,label:enemy.name,color:enemy.color,foreign:true} : { id: 'free', label: 'Terras livres', color: '#83aaa5' };
  });
  const cities = [{ index: seat, name: king ? 'Capital · ' + king.family : 'Capital demonstrativa', capital: true }];
  for (const lord of lords) {
    const index = lord.tiles?.[0] ?? lord.territory;
    if (Number.isInteger(index) && index >= 0 && index < 512 && !cities.some(city => city.index === index)) cities.push({ index, name: 'Casa ' + lord.family, capital: false, lordId: lord.id });
  }
  for (const realm of save?.warfare?.realms || []) if (realm.tiles.length) cities.push({index:realm.capital,name:realm.name,capital:false,foreign:true});
  for (const city of cities) {
    const domain = city.capital ? [...royal].filter(i=>owners[i].id==='crown') : owners.map((owner,index)=>owner.id===owners[city.index].id?index:-1).filter(i=>i>=0);
    const houseIds = new Set([city.lordId]);
    for(let pass=0;pass<lords.length;pass++)for(const lord of lords)if(houseIds.has(lord.liege))houseIds.add(lord.id);
    const governed = city.capital ? [...new Set([...royal,...lords.flatMap(p=>p.tiles||[])])] : city.foreign ? domain : lords.filter(p=>houseIds.has(p.id)).flatMap(p=>p.tiles||[]);
    const size = new Set(governed.filter(i=>provinces.get(i)?.price!==null)).size;
    city.point = settlementSite(domain.length ? domain.includes(city.index) ? [city.index,...domain.filter(i=>i!==city.index)] : domain : [city.index], size);
    city.color = city.capital ? '#dbb56e' : owners[city.index].color;
  }
  const armies = (save?.warfare?.armies || []).filter(a=>a.status!=='done').map(a=>({...a,count:a.men.filter(id=>people.some(p=>p.id===id)).length}));
  return { owners, cities, armies, seat, king, day: save?.day, demo: !save };
}
