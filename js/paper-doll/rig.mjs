/** Measured atlas-space geometry. Anchors are relative to each crop, in pixels. */
export const ATLAS_SIZE = 1254;

export const BODIES = [
  { crop: [45, 7, 240, 502], neck: [117, 29], height: 480, headScale: 0.265 },
  { crop: [346, 22, 254, 488], neck: [130, 12], height: 480, headScale: 0.275 },
  { crop: [655, 4, 252, 505], neck: [128, 29], height: 480, headScale: 0.265 },
  { crop: [939, 7, 304, 499], neck: [158, 29], height: 480, headScale: 0.275 },
];

export const HEADS = [
  { crop: [49, 512, 227, 325], neck: [111, 304], crown: [111, 4], chin: [111, 269] },
  { crop: [359, 524, 223, 312], neck: [112, 291], crown: [112, 5], chin: [112, 254] },
  { crop: [667, 512, 232, 324], neck: [117, 303], crown: [117, 4], chin: [117, 269] },
  { crop: [987, 522, 223, 314], neck: [113, 293], crown: [113, 5], chin: [113, 256] },
];

// Crown anchors place each wig around the skull rather than in a fixed screen box.
export const HAIR = [
  { crop: [24, 846, 267, 276], crown: [137, 48], scale: 1 },
  { crop: [326, 844, 289, 278], crown: [149, 48], scale: 1 },
  { crop: [623, 839, 313, 414], crown: [160, 30], scale: 1 },
  { crop: [946, 838, 296, 415], crown: [150, 30], scale: 1 },
];

/** Uniform scaling preserves anatomy; the anchor maps exactly onto its target. */
export function placePart(crop, scale, anchor, target) {
  const [x, y, width, height] = crop;
  return {
    source: { x: x / ATLAS_SIZE, y: y / ATLAS_SIZE, width: width / ATLAS_SIZE, height: height / ATLAS_SIZE },
    box: [target[0] - anchor[0] * scale, target[1] - anchor[1] * scale, width * scale, height * scale],
  };
}

export function pointOnPart(layer, crop, point) {
  const scale = layer.box[2] / crop[2];
  return [layer.box[0] + point[0] * scale, layer.box[1] + point[1] * scale];
}
