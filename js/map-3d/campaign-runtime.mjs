import { createViewer } from './viewer.mjs';
import { describeWorld } from './world-data.mjs';

export function createCampaignMap(onSelect, onPerson) {
  const host = document.createElement('div');
  host.className = 'campaign-atlas';
  host.innerHTML = `<div class="campaign-viewport"></div><div class="campaign-labels"></div>
    <div class="campaign-map-tools"><button data-camera="home">Visão geral</button><button data-camera="capital">Capital</button><button data-camera="in" aria-label="Aproximar mapa">＋</button><button data-camera="out" aria-label="Afastar mapa">−</button><label><input type="checkbox" data-layer="borders" checked> Fronteiras</label><label><input type="checkbox" data-layer="forests" checked> Florestas</label></div>
    <div class="campaign-domain-legend"><span style="color:#f4cb6d">■ Coroa</span><span style="color:#95cafa">■ Vassalos · cores por casa</span><span>□ Terras livres</span></div><form class="campaign-find"><label>Território <input name="territory" type="number" min="1" max="512" value="1" required aria-label="Número do território"></label><button>Localizar</button></form><p class="campaign-map-help">Arraste para girar · roda para aproximar · clique para inspecionar</p><p class="campaign-map-error" role="status" hidden></p>`;
  const viewport = host.querySelector('.campaign-viewport');
  let viewer, world, worldKey, selectionKey;
  host.addEventListener('click', event => {
    const action = event.target.closest('[data-camera]')?.dataset.camera;
    if (!viewer || !action) return;
    if (action === 'home') viewer.home();
    if (action === 'capital') { onSelect(world.seat); viewer.focus(world.seat); }
    if (action === 'in') viewer.zoom(.8);
    if (action === 'out') viewer.zoom(1.25);
  });
  host.addEventListener('change', event => {
    if (event.target.dataset.layer) viewer?.[event.target.dataset.layer](event.target.checked);
  });
  host.querySelector('form').onsubmit = event => {
    event.preventDefault();
    const index = Number(host.querySelector('input[name="territory"]').value) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= 512) return;
    onSelect(index); viewer?.focus(index);
  };
  viewport.addEventListener('map-error', event => {
    const error = host.querySelector('.campaign-map-error'); error.hidden = false; error.textContent = event.detail;
  });
  return {
    detach() { host.remove(); },
    focus(index) { viewer?.focus(index); },
    mount(state, selection, preview) {
      const slot = document.querySelector('#campaign-map-slot');
      if (!slot) return;
      if (host.parentNode !== slot) slot.replaceChildren(host);
      const next = describeWorld(state);
      const key = JSON.stringify([next.owners, next.cities, next.armies, next.people, next.habitats, next.dragons]);
      world = next;
      host.querySelector('[data-camera="capital"]').disabled = !world.cities.some(city=>city.capital);
      if (!viewer) viewer = createViewer(viewport, host.querySelector('.campaign-labels'), world, onSelect, undefined, onPerson);
      else if (key !== worldKey) viewer.update(world);
      if (key !== worldKey) {
        const legend = host.querySelector('.campaign-domain-legend'); legend.replaceChildren();
        const entries = new Map(world.owners.filter(owner=>owner.id!=='free').map(owner=>[owner.id,owner]));
        for (const owner of entries.values()) { const item=document.createElement('span');item.style.color=owner.color;item.textContent='■ '+(owner.id==='crown'?'Coroa':(owner.foreign?'':'Vassalo · ')+owner.label);legend.append(item); }
        const free=document.createElement('span');free.textContent='□ Terras livres';legend.append(free);
      }
      worldKey = key;
      const tiles = preview ? preview.split(',').map(Number) : selection.kind === 'region' ? [selection.index] : [];
      const selected = JSON.stringify(tiles);
      if (selected !== selectionKey) { viewer.select(tiles); selectionKey = selected; if(selection.kind==='region')host.querySelector('input[name="territory"]').value=selection.index+1; }
    },
  };
}
