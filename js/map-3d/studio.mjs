import { readCampaign, describeWorld, biomeAt, BIOMES, SAVE_KEY, provinces } from './world-data.mjs';

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
let world, viewer, selected;
function select(index, focus = false) {
  if (!Number.isInteger(index) || index < 0 || index >= 512) return;
  selected = index;
  const biome = biomeAt(index), city = world.cities.find(city => city.index === index);
  ui['territory-name'].textContent = city?.name || 'Vila ' + (index + 1);
  ui['territory-description'].textContent = 'Território ' + (index + 1) + ' · ' + (city ? 'Sede do domínio' : 'Parcela territorial da campanha');
  ui.biome.textContent = BIOMES[biome];
  ui.owner.textContent = world.owners[index].label;
  const province = provinces.get(index);
  ui.area.textContent = province.area.toFixed(1) + ' km²';
  ui['land-area'].textContent = province.landArea.toFixed(1) + ' km²';
  ui.price.textContent = province.price === null ? 'Não anexável' : province.price + ' ouro';
  ui.condition.textContent = province.price === null ? 'Sem área terrestre suficiente' : 'Valor pela área terrestre e dificuldade do relevo';
  ui['tile-number'].value = index + 1;
  viewer?.select(index);
  if (focus) viewer?.focus(index);
}
function loadWorld() {
  const next = describeWorld(readCampaign(localStorage));
  world = next;
  ui['campaign-status'].textContent = world.demo ? 'Modo demonstração · nenhum save nesta origem' : 'Casa ' + (world.king?.family || 'sem regente') + ' · dia ' + world.day + ' · consulta do save';
  ui.settlements.replaceChildren();
  for (const city of world.cities) {
    const button = document.createElement('button');
    button.textContent = city.name + ' · ' + (city.index + 1);
    button.onclick = () => select(city.index, true);
    ui.settlements.append(button);
  }
  return world;
}
function reportError(error) {
  ui.status.textContent = error.message || String(error);
  ui.loading.textContent = 'Não foi possível abrir o 3D. Use o servidor local e um navegador com WebGL2. A gestão da campanha continua disponível nas outras abas.';
  ui.loading.hidden = false;
  for (const id of ['home', 'capital', 'zoom-in', 'zoom-out', 'focus', 'borders', 'forests']) ui[id].disabled = true;
  console.error(error);
}
try {
  loadWorld();
  const { createViewer } = await import('./viewer.mjs');
  viewer = createViewer(ui.viewport, ui.labels, world, index => select(index), angle => {
    document.querySelector('.compass').style.transform = `rotate(${angle}rad)`;
  });
  ui.loading.hidden = true;
  select(world.seat);
  ui.status.textContent = 'Pronto. Clique no terreno ou escolha uma sede.';
  ui.home.onclick = () => viewer.home();
  ui.capital.onclick = () => select(world.seat, true);
  ui['zoom-in'].onclick = () => viewer.zoom(.8);
  ui['zoom-out'].onclick = () => viewer.zoom(1.25);
  ui.focus.onclick = () => viewer.focus(selected);
  ui.borders.onchange = () => viewer.borders(ui.borders.checked);
  ui.forests.onchange = () => viewer.forests(ui.forests.checked);
  ui.find.onsubmit = event => { event.preventDefault(); select(Number(ui['tile-number'].value) - 1, true); };
  const refresh = () => {
    try { viewer.update(loadWorld()); select(selected ?? world.seat); ui.status.textContent = 'Dados atualizados. Nenhuma alteração foi feita no save.'; }
    catch (error) { ui.status.textContent = 'Não foi possível atualizar: ' + error.message; }
  };
  ui.refresh.onclick = refresh;
  window.addEventListener('storage', event => { if (event.key === SAVE_KEY) refresh(); });
  ui.viewport.addEventListener('map-error', event => reportError(new Error(event.detail)));
  window.addEventListener('pagehide', () => { viewer.dispose(); viewer = null; });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
} catch (error) { reportError(error); }
