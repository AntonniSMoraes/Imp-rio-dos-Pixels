import { createAppearance, changeAppearance } from './appearance.mjs';
import { loadAtlas, renderCharacter, renderPortrait } from './renderer.mjs';
import { loadAppearance, saveAppearance } from './storage.mjs';
import { mountControls, updateControls } from './controls.mjs';
import { getGalleryAppearances } from './catalog.mjs';

const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
const hiddenLayers = new Set();
let current = createAppearance('primeiro-humano');
let atlas;

function status(message, error = false) {
  ui.status.textContent = message;
  ui.status.dataset.error = String(error);
}

function redraw() {
  updateControls(ui.controls, current);
  ui.seed.value = current.seed;
  ui.recipe.textContent = JSON.stringify(current, null, 2);
  if (!atlas) return;
  renderCharacter(ui.character, atlas, current, hiddenLayers);
  renderPortrait(ui.portrait, ui.character, current);
}

function generateGallery() {
  ui.gallery.replaceChildren();
  for (const [index, appearance] of getGalleryAppearances().entries()) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'gallery-card';
    card.setAttribute('aria-label', `Selecionar personagem ${index + 1}`);
    const canvas = document.createElement('canvas');
    renderCharacter(canvas, atlas, appearance);
    const label = document.createElement('span');
    label.textContent = `Estudo ${String(index + 1).padStart(2, '0')}`;
    card.append(canvas, label);
    card.addEventListener('click', () => { current = appearance; redraw(); status('Combinação selecionada.'); });
    ui.gallery.append(card);
  }
}

mountControls(ui.controls, (key, value) => {
  current = changeAppearance(current, key, value);
  redraw();
  status('Aparência alterada. Salve para guardar esta combinação.');
});
ui.generate.addEventListener('click', () => {
  try { current = createAppearance(ui.seed.value.trim()); redraw(); status('Personagem gerado pela semente.'); }
  catch (error) { status(error.message, true); }
});
ui.randomize.addEventListener('click', () => {
  current = createAppearance(crypto.randomUUID()); redraw(); status('Nova combinação gerada.');
});
ui.save.addEventListener('click', () => {
  try { saveAppearance(localStorage, current); status('Aparência salva neste navegador.'); }
  catch { status('Não foi possível salvar. Verifique o armazenamento do navegador.', true); }
});
ui.restore.addEventListener('click', () => {
  try {
    const saved = loadAppearance(localStorage);
    if (!saved) return status('Ainda não existe uma aparência salva.');
    current = saved; redraw(); status('Aparência salva restaurada.');
  } catch (error) { status(`Não foi possível restaurar: ${error.message}`, true); }
});
ui.export.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'humano-paper-doll.png';
  link.href = ui.character.toDataURL('image/png');
  link.click();
});
for (const checkbox of document.querySelectorAll('[data-layer]')) {
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) hiddenLayers.delete(checkbox.dataset.layer);
    else hiddenLayers.add(checkbox.dataset.layer);
    redraw();
  });
}

try {
  try { current = loadAppearance(localStorage) ?? current; }
  catch (error) { status(`Usando aparência inicial: ${error.message}`, true); }
  redraw();
  atlas = await loadAtlas();
  redraw();
  generateGallery();
  ui.export.disabled = false;
  if (ui.status.dataset.error !== 'true') status('Pronto. Explore as peças ou escolha um estudo da galeria.');
} catch (error) {
  status('Não foi possível carregar a arte. Reabra pelo servidor local e tente novamente.', true);
  console.error(error);
}
