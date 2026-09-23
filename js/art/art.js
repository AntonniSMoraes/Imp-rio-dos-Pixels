// Anime source illustrations are recolored locally from persisted hereditary traits.
// A portrait is cropped from the same composed figure used by the character sheet.
const artCache = new Map(),
  animeTiles = new Map();
let animeAtlas = null,
  rankAtlas = null,
  animeLoadError = false;
const ANIME_ROWS = [
  [0, 420],
  [420, 865],
  [865, 1195],
  [1195, 1536],
];
function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function blend(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
function pixelHSV(r, g, b) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max ? d / max : 0, max / 255];
}
function prepareAnimeTile(row, col) {
  const key = row + ":" + col;
  if (animeTiles.has(key)) return animeTiles.get(key);
  const [start, end] = ANIME_ROWS[row],
    w = 256,
    h = end - start,
    c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(animeAtlas, col * 256, start, w, h, 0, 0, w, h);
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
function composedAnime(p) {
  const row = p.level < 5 ? (p.sex === "M" ? 2 : 3) : p.sex === "M" ? 0 : 1,
    tile =
      p.level >= 5 && rankAtlas
        ? prepareRankTile(p)
        : prepareAnimeTile(row, p.hairstyle ?? p.genes.style);
  const c = document.createElement("canvas");
  c.width = tile.w;
  c.height = tile.h;
  const g = c.getContext("2d", { willReadFrequently: true }),
    image = g.createImageData(tile.w, tile.h);
  image.data.set(tile.data);
  const d = image.data;
  const base = rgb(HAIR[p.genes.hair][1]),
    light = rgb(HAIR[p.genes.hair][2]),
    dark = base.map((v) => Math.round(v * 0.28));
  for (const i of tile.hair) {
    const intensity = Math.max(
      0,
      Math.min(1, ((tile.data[i] + tile.data[i + 2]) / 2 - 25) / 190),
    );
    let color =
      intensity < 0.6
        ? blend(dark, base, intensity / 0.6)
        : blend(base, light, (intensity - 0.6) / 0.4);
    if (
      p.age >= 55 &&
      ((i / 4) % tile.w < tile.face.x + 5 ||
        (i / 4) % tile.w > tile.face.x + tile.face.w - 5)
    )
      color = blend(color, [174, 177, 173], 0.6);
    for (let k = 0; k < 3; k++) d[i + k] = color[k];
  }
  const skinColor = rgb(SKIN[p.genes.skin][2]);
  for (const i of tile.skin)
    for (let k = 0; k < 3; k++)
      d[i + k] = Math.min(
        255,
        Math.round((tile.data[i + k] * skinColor[k]) / [247, 209, 177][k]),
      );
  const eye = rgb(EYES[p.genes.eyes][1]);
  for (const i of tile.eyes) {
    const lightness = Math.max(
      0.3,
      Math.min(
        1.2,
        Math.max(tile.data[i], tile.data[i + 1], tile.data[i + 2]) / 200,
      ),
    );
    for (let k = 0; k < 3; k++)
      d[i + k] = Math.min(255, Math.round(eye[k] * lightness));
  }
  g.putImageData(image, 0, 0);
  const f = tile.face,
    cx = f.x + f.w / 2;
  if (p.level >= 5 && p.appearance?.face === 3) {
    g.strokeStyle = "#78564a88";
    g.lineWidth = 0.65;
    g.beginPath();
    g.moveTo(cx + 11, f.eyeY + 2);
    g.lineTo(cx + 13, f.eyeY + 10);
    g.stroke();
  }
  if (p.genes.freckles) {
    g.fillStyle = p.genes.skin >= 2 ? "#613b2eb3" : "#a06449a6";
    for (const [dx, dy, r] of [
      [-10, 6, 0.7],
      [-7, 7, 0.55],
      [-12, 8, 0.6],
      [-5, 6, 0.5],
      [7, 6, 0.65],
      [10, 8, 0.7],
      [13, 6, 0.5],
      [5, 8, 0.45],
    ]) {
      g.beginPath();
      g.arc(cx + dx, f.eyeY + dy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  if ((p.genes.texture ?? 0) >= 2) {
    g.save();
    g.globalAlpha = 0.25;
    g.strokeStyle = HAIR[p.genes.hair][2];
    g.lineWidth = 0.5;
    for (let y = f.y - 9; y < f.y + 5; y += 2) {
      for (let x = f.x; x < f.x + f.w; x += 3) {
        const idx = (Math.floor(y) * tile.w + Math.floor(x)) * 4;
        if (y >= 0 && tile.hair.includes(idx)) {
          g.beginPath();
          g.arc(x, y, p.genes.texture === 3 ? 1 : 1.8, 0, Math.PI * 1.7);
          g.stroke();
        }
      }
    }
    g.restore();
  }
  return { canvas: c, face: f, row };
}
function characterCanvas(p) {
  const out = document.createElement("canvas");
  out.width = 384;
  out.height = 576;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const gradient = ctx.createLinearGradient(0, 0, 384, 576);
  gradient.addColorStop(0, "#566b79");
  gradient.addColorStop(0.55, "#30495b");
  gradient.addColorStop(1, "#182c3e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 384, 576);
  if (!animeAtlas) return out;
  const figure = composedAnime(p),
    scale = Math.min(350 / figure.canvas.width, 552 / figure.canvas.height),
    w = figure.canvas.width * scale * [0.94, 1, 1.06][p.appearance?.build ?? 1],
    h = figure.canvas.height * scale;
  ctx.drawImage(figure.canvas, (384 - w) / 2, 576 - h - 8, w, h);
  return out;
}
function artURL(p, portrait = false) {
  if (!animeAtlas)
    return "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const key = JSON.stringify([
    p.genes,
    p.hairstyle,
    p.appearance,
    p.rank,
    p.sex,
    p.level < 5,
    p.age >= 55,
    p.social,
    p.vocation,
    portrait,
  ]);
  if (artCache.has(key)) return artCache.get(key);
  let out;
  if (portrait) {
    const composed = composedAnime(p),
      f = composed.face;
    out = document.createElement("canvas");
    out.width = 192;
    out.height = 192;
    const g = out.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const gradient = g.createLinearGradient(0, 0, 192, 192);
    gradient.addColorStop(0, "#617c8e");
    gradient.addColorStop(1, "#263e50");
    g.fillStyle = gradient;
    g.fillRect(0, 0, 192, 192);
    const size = Math.max(88, f.w * 1.85, f.h * 1.7),
      sx = Math.max(0, Math.min(256 - size, f.x + f.w / 2 - size / 2)),
      sy = Math.max(0, f.eyeY - size * 0.42);
    g.drawImage(composed.canvas, sx, sy, size, size, 0, 0, 192, 192);
  } else out = characterCanvas(p);
  const url = out.toDataURL("image/png");
  if (artCache.size > 350) artCache.clear();
  artCache.set(key, url);
  return url;
}
function portrait(p, cls = "portrait") {
  if (!animeAtlas)
    return `<span class="${cls} art-loading" role="img" aria-label="${animeLoadError ? "Arte indisponível" : "Carregando retrato"}">${animeLoadError ? "!" : "…"}</span>`;
  return `<img class="${cls}" src="${artURL(p, true)}" alt="Retrato anime medieval de ${esc(p.name)}" width="80" height="80">`;
}
function fullPortrait(p) {
  if (!animeAtlas)
    return `<div class="full-character art-loading">${animeLoadError ? "Não foi possível carregar a arte." : "Carregando arte…"}</div>`;
  return `<img class="full-character" src="${artURL(p)}" alt="${esc(p.name)} de corpo inteiro em estilo anime medieval" width="192" height="288">`;
}
function loadAnimeArt() {
  const rankImage = new Image();
  rankImage.onload = () => {
    rankAtlas = rankImage;
    animeTiles.clear();
    artCache.clear();
    render();
    refreshPersonModal();
  };
  rankImage.src = "assets/anime-ranks.png";
  const image = new Image();
  image.onload = () => {
    animeAtlas = image;
    animeLoadError = false;
    artCache.clear();
    render();
    refreshPersonModal();
  };
  image.onerror = () => {
    animeLoadError = true;
    render();
    refreshPersonModal();
  };
  image.src = "assets/anime-character-atlas.png";
}
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
