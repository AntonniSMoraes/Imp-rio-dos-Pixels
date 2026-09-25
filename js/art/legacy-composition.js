function composedAnime(p) {
  const row = p.level < 5 ? (p.sex === "M" ? 2 : 3) : p.sex === "M" ? 0 : 1;
  const race = p.race || "human";
  const atlas = raceAtlases.get(race) || animeAtlas;
  const tile =
    p.level >= 5 && rankAtlas && race === "human"
      ? prepareRankTile(p)
      : prepareAnimeTile(row, p.hairstyle ?? p.genes.style, atlas, race);
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
