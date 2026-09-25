import { BODIES, HEADS, HAIR, placePart, pointOnPart } from './rig.mjs';

/** Pre-colored assets. No runtime hue replacement or skin pixel classification. */
export const ART_VERSION = 1;
export const SHEET_URL = new URL('../../assets/paper-doll/human-pilot.png', import.meta.url).href;
export const OPTIONS = Object.freeze({
  body: [{ id: 'male', label: 'Masculina' }, { id: 'female', label: 'Feminina' }],
  skin: [{ id: 'ivory', label: 'Marfim quente' }, { id: 'brown', label: 'Castanha' }],
  outfit: [{ id: 'commoner', label: 'Vestuário plebeu' }, { id: 'noble', label: 'Vestuário nobre' }],
  hair: [
    { id: 'short-blond', label: 'Curto · dourado' },
    { id: 'short-brown', label: 'Curto · castanho' },
    { id: 'long-blond', label: 'Longo · dourado' },
    { id: 'long-brown', label: 'Longo · castanho' },
  ],
});
export const STAGE = Object.freeze({ width: 384, height: 640 });

export function getLayers(appearance) {
  const female = appearance.body === 'female';
  const bodyColumn = (appearance.outfit === 'noble' ? 2 : 0) + Number(female);
  const headColumn = (appearance.skin === 'brown' ? 2 : 0) + Number(female);
  const hairColumn = OPTIONS.hair.findIndex(option => option.id === appearance.hair);
  const body = BODIES[bodyColumn];
  const head = HEADS[headColumn];
  const hair = HAIR[hairColumn];
  const bodyScale = body.height / body.crop[3];
  const bodyLayer = placePart(body.crop, bodyScale, [body.neck[0], body.crop[3]], [STAGE.width / 2, 610]);
  const neck = pointOnPart(bodyLayer, body.crop, body.neck);
  const headLayer = placePart(head.crop, body.headScale, head.neck, neck);
  const crown = pointOnPart(headLayer, head.crop, head.crown);
  const hairLayer = placePart(hair.crop, body.headScale * hair.scale, hair.crown, crown);
  return [
    { id: 'head', label: 'Cabeça e pescoço', ...headLayer },
    { id: 'body', label: 'Corpo vestido', ...bodyLayer },
    { id: 'hair', label: 'Cabelo', ...hairLayer },
  ];
}

/** A portrait follows the selected head, including its hairstyle and shoulders. */
export function getPortraitFrame(appearance) {
  const head = getLayers(appearance).find(layer => layer.id === 'head').box;
  const size = head[2] * 2.25;
  return [head[0] + head[2] / 2 - size / 2, head[1] - head[3] * 0.22, size, size];
}

export function getGalleryAppearances() {
  return OPTIONS.body.flatMap(body => OPTIONS.outfit.flatMap(outfit =>
    OPTIONS.skin.flatMap(skin => OPTIONS.hair.map(hair => ({
      version: ART_VERSION, seed: `estudo-${body.id}-${outfit.id}-${skin.id}-${hair.id}`,
      race: 'human', ageGroup: 'adult', body: body.id, outfit: outfit.id, skin: skin.id, hair: hair.id,
    }))),
  ));
}
