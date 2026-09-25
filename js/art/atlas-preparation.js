function prepareAnimeTile(row, col, atlas = animeAtlas, atlasKey = "human") {
  const key = atlasKey + ":" + row + ":" + col;
  if (animeTiles.has(key)) return animeTiles.get(key);
  const [start, end] = ANIME_ROWS[row],
    w = 256,
    h = end - start,
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(atlas, col * 256, start, w, h, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h),
    data = img.data,
    hair = [],
    skin = [],
    eyes = [];
  // Only near-white pixels connected to the tile edge become transparent.
  // This keeps white eye highlights and the wool collar intact.
  const visited = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let head = 0,
    tail = 0;
  function add(n) {
    if (n < 0 || n >= w * h || visited[n]) return;
    visited[n] = 1;
    const i = n * 4,
      r = data[i],
      gg = data[i + 1],
      b = data[i + 2];
    if (
      Math.min(r, gg, b) > 235 &&
      Math.max(r, gg, b) - Math.min(r, gg, b) < 17
    )
      queue[tail++] = n;
  }
  for (let x = 0; x < w; x++) {
    add(x);
    add((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    add(y * w);
    add(y * w + w - 1);
  }
  while (head < tail) {
    const n = queue[head++];
    data[n * 4 + 3] = 0;
    if (n % w) add(n - 1);
    if (n % w < w - 1) add(n + 1);
    add(n - w);
    add(n + w);
  }
  let minX = 256,
    maxX = 0,
    minY = h,
    maxY = 0,
    eyeY = 0,
    eyeCount = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!data[i + 3]) continue;
      const r = data[i],
        gg = data[i + 1],
        b = data[i + 2],
        [hue, sat, val] = pixelHSV(r, gg, b);
      if (
        hue >= 275 &&
        hue <= 354 &&
        sat > 0.2 &&
        r > gg * 1.15 &&
        b > gg * 1.09
      ) {
        hair.push(i);
        continue;
      }
      if (y < [73, 78, 92, 89][row] && x > 96 && x < 163) {
        if (
          hue >= 12 &&
          hue <= 43 &&
          r > gg * 1.055 &&
          gg > b * 1.06 &&
          r > 120
        ) {
          skin.push(i);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        if (
          hue >= 165 &&
          hue <= 245 &&
          sat > 0.12 &&
          val > 0.16 &&
          Math.abs(y - [42, 50, 62, 59][row]) < 7 &&
          x > 108 &&
          x < 146
        ) {
          eyes.push(i);
          eyeY += y;
          eyeCount++;
        }
      }
    }
  // Keep the connected face region, excluding warm-colored wool and straps.
  const skinSet = new Set(skin.map((i) => i / 4)),
    seenSkin = new Set();
  let biggest = [];
  for (const start of skinSet) {
    if (seenSkin.has(start)) continue;
    const part = [start];
    seenSkin.add(start);
    for (let j = 0; j < part.length; j++) {
      const n = part[j];
      for (const next of [n - 1, n + 1, n - w, n + w])
        if (skinSet.has(next) && !seenSkin.has(next)) {
          seenSkin.add(next);
          part.push(next);
        }
    }
    if (part.length > biggest.length) biggest = part;
  }
  if (biggest.length) {
    minX = 256;
    maxX = 0;
    minY = h;
    maxY = 0;
    for (const n of biggest) {
      minX = Math.min(minX, n % w);
      maxX = Math.max(maxX, n % w);
      minY = Math.min(minY, Math.floor(n / w));
      maxY = Math.max(maxY, Math.floor(n / w));
    }
    const allowed = skin.filter(
      (i) =>
        (i / 4) % w >= minX - 2 &&
        (i / 4) % w <= maxX + 2 &&
        Math.floor(i / 4 / w) >= minY &&
        Math.floor(i / 4 / w) <= maxY,
    );
    skin.length = 0;
    skin.push(...allowed);
  }
  const face = {
    x: minX === 256 ? 104 : minX,
    y: minY === h ? 25 : minY,
    w: maxX ? maxX - minX + 1 : 48,
    h: maxY ? maxY - minY + 1 : 50,
    eyeY: eyeCount ? eyeY / eyeCount : [42, 50, 62, 59][row],
  };
  // Include pale face highlights in the complexion mask, without tinting sclera.
  const hairSet = new Set(hair),
    eyeSet = new Set(eyes),
    skinPixels = new Set(skin),
    cx = face.x + face.w / 2;
  for (let y = face.y; y < face.y + face.h; y++) {
    const rowPixels = skin.filter((i) => Math.floor(i / 4 / w) === y);
    if (!rowPixels.length) continue;
    const lo = Math.min(...rowPixels.map((i) => (i / 4) % w)),
      hi = Math.max(...rowPixels.map((i) => (i / 4) % w));
    for (let x = lo; x <= hi; x++) {
      const i = (y * w + x) * 4;
      if (hairSet.has(i) || eyeSet.has(i) || skinPixels.has(i)) continue;
      const r = data[i],
        gg = data[i + 1],
        b = data[i + 2];
      const eyeWhite =
        Math.abs(y - face.eyeY) < 4 &&
        (Math.abs(x - (cx - 8)) < 6 || Math.abs(x - (cx + 8)) < 6);
      if (
        !eyeWhite &&
        r > 170 &&
        gg > 150 &&
        r >= b &&
        Math.max(r, gg, b) - Math.min(r, gg, b) < 55
      ) {
        skin.push(i);
        skinPixels.add(i);
      }
    }
  }

  // Blend warm antialiased face-edge pixels into the same inherited complexion.
  const expandedSkin = [...skin];
  for (const i of expandedSkin) {
    const n = i / 4;
    for (const nn of [
      n - 1,
      n + 1,
      n - w,
      n + w,
      n - w - 1,
      n - w + 1,
      n + w - 1,
      n + w + 1,
    ]) {
      if (nn < 0 || nn >= w * h) continue;
      const j = nn * 4,
        x = nn % w,
        y = Math.floor(nn / w);
      if (skinPixels.has(j) || hairSet.has(j) || eyeSet.has(j) || !data[j + 3])
        continue;
      const r = data[j],
        gg = data[j + 1],
        b = data[j + 2];
      const eyeWhite =
        Math.abs(y - face.eyeY) < 4 &&
        (Math.abs(x - (cx - 8)) < 6 || Math.abs(x - (cx + 8)) < 6);
      if (
        !eyeWhite &&
        r > 125 &&
        r >= gg &&
        r >= b &&
        r - gg < 100 &&
        r - b < 120
      ) {
        skin.push(j);
        skinPixels.add(j);
      }
    }
  }
  for (let n = 0; n < w * h; n++) {
    const i = n * 4;
    if (!data[i + 3]) continue;
    const edge = [n - 1, n + 1, n - w, n + w].some(
      (k) => k >= 0 && k < w * h && data[k * 4 + 3] === 0,
    );
    if (edge) {
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      if (min > 175) {
        const alpha = Math.max(0.05, (255 - min) / 80);
        data[i + 3] = Math.round(255 * alpha);
        for (let k = 0; k < 3; k++)
          data[i + k] = Math.max(
            0,
            Math.round((data[i + k] - 255 * (1 - alpha)) / alpha),
          );
      }
    }
  }
  const tile = {
    w,
    h,
    data: new Uint8ClampedArray(data),
    hair,
    skin,
    eyes,
    face,
  };
  animeTiles.set(key, tile);
  return tile;
}
