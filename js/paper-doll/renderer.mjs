import { SHEET_URL, STAGE, getLayers, getPortraitFrame } from './catalog.mjs';
import { validateAppearance } from './appearance.mjs';

/** Image loading and geometry are isolated from character rules and persistence. */
export async function loadAtlas(url = SHEET_URL) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export function renderCharacter(canvas, atlas, appearance, hiddenLayers = new Set()) {
  validateAppearance(appearance);
  canvas.width = STAGE.width;
  canvas.height = STAGE.height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const layer of getLayers(appearance)) {
    if (hiddenLayers.has(layer.id)) continue;
    const source = layer.source;
    context.drawImage(atlas,
      source.x * atlas.width, source.y * atlas.height,
      source.width * atlas.width, source.height * atlas.height,
      ...layer.box);
  }
}

export function renderPortrait(canvas, fullBody, appearance) {
  canvas.width = 160;
  canvas.height = 160;
  canvas.getContext('2d').drawImage(fullBody, ...getPortraitFrame(appearance), 0, 0, 160, 160);
}
