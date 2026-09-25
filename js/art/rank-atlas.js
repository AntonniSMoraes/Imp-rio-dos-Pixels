function prepareRankTile(p) {
  const row = p.sex === "M" ? 0 : 1,
    col = Math.min(3, p.rank),
    key = `rank:${row}:${col}:${p.hairstyle}:${p.appearance?.face || 0}`;
  if (animeTiles.has(key)) return animeTiles.get(key);
  const w = 256,
    h = 420,
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(rankAtlas, col * 362, row * 543, 362, 543, 0, 0, w, h);
  const image = g.getImageData(0, 0, w, h),
    d = image.data,
    hair = [],
    skin = [],
    eyes = [];
  const seen = new Uint8Array(w * h),
    queue = [];
  const add = (n) => {
    if (n < 0 || n >= w * h || seen[n]) return;
    seen[n] = 1;
    const i = n * 4;
    if (
      Math.min(d[i], d[i + 1], d[i + 2]) > 236 &&
      Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) <
        18
    )
      queue.push(n);
  };
  for (let x = 0; x < w; x++) {
    add(x);
    add((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    add(y * w);
    add(y * w + w - 1);
  }
  for (let j = 0; j < queue.length; j++) {
    const n = queue[j];
    d[n * 4 + 3] = 0;
    if (n % w) add(n - 1);
    if (n % w < w - 1) add(n + 1);
    add(n - w);
    add(n + w);
  }
  let ex = 0,
    ey = 0,
    en = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3]) continue;
      const r = d[i],
        gg = d[i + 1],
        b = d[i + 2],
        [hue, sat, val] = pixelHSV(r, gg, b);
      if (
        hue > 280 &&
        hue < 360 &&
        sat > 0.12 &&
        r > gg * 1.12 &&
        b > gg * 0.91 &&
        y < 180
      ) {
        hair.push(i);
        continue;
      }
      const face =
          x > 102 && x < 152 && y > (row ? 27 : 18) && y < (row ? 81 : 65),
        arms =
          col === 0 &&
          y > 150 &&
          y < 224 &&
          ((x > 61 && x < 83) || (x > 174 && x < 194));
      if ((face || arms) && hue < 56 && r >= gg && r > b && r > 100)
        skin.push(i);
      if (
        face &&
        hue > 150 &&
        hue < 250 &&
        sat > 0.15 &&
        val > 0.25 &&
        y < (row ? 56 : 43)
      ) {
        eyes.push(i);
        ex += x;
        ey += y;
        en++;
      }
    }
  const face = {
    x: row ? 110 : 111,
    y: row ? 30 : 21,
    w: 36,
    h: row ? 49 : 44,
    eyeY: en ? ey / en : row ? 47 : 34,
  };
  // Remove isolated white background holes between arms and clothing.
  for (let n = 0; n < w * h; n++) {
    const i = n * 4;
    if (!d[i + 3] || seen[n]) continue;
    if (Math.min(d[i], d[i + 1], d[i + 2]) < 243) continue;
    const piece = [n];
    seen[n] = 1;
    for (let j = 0; j < piece.length; j++) {
      const at = piece[j];
      for (const next of [at - 1, at + 1, at - w, at + w]) {
        if (next < 0 || next >= w * h || seen[next]) continue;
        const k = next * 4;
        if (Math.min(d[k], d[k + 1], d[k + 2]) > 243) {
          seen[next] = 1;
          piece.push(next);
        }
      }
    }
    if (piece.length > 30) for (const k of piece) d[k * 4 + 3] = 0;
  }
  for (let n = 0; n < w * h; n++) {
    const i = n * 4;
    if (!d[i + 3]) continue;
    const edge = [n - 1, n + 1, n - w, n + w].some(
      (k) => k >= 0 && k < w * h && d[k * 4 + 3] === 0,
    );
    if (edge) {
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      if (min > 180) {
        const alpha = Math.max(0.08, (255 - min) / 75);
        d[i + 3] = Math.round(255 * alpha);
        for (let k = 0; k < 3; k++)
          d[i + k] = Math.max(
            0,
            Math.round((d[i + k] - 255 * (1 - alpha)) / alpha),
          );
      }
    }
  }

  // Adult illustrations use rank-specific hair silhouettes; orientation is cosmetic.
  if ((p.hairstyle ?? 0) % 2 === 1) {
    const temp = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4,
          j = (y * w + (w - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) d[i + k] = temp[j + k];
      }
    for (const arr of [hair, skin, eyes])
      for (let j = 0; j < arr.length; j++) {
        const n = arr[j] / 4;
        arr[j] = (Math.floor(n / w) * w + (w - 1 - (n % w))) * 4;
      }
    face.x = w - face.x - face.w;
  }
  const tile = { w, h, data: new Uint8ClampedArray(d), hair, skin, eyes, face };
  animeTiles.set(key, tile);
  return tile;
}
