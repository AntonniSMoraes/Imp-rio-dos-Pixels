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
  if (canvasReadBlocked) return EMPTY_ART_URL;
  try {
    return renderArtURL(p, portrait);
  } catch (error) {
    // Local-file images may taint the canvas. Art must never stop navigation,
    // controls or saving; don't keep retrying the forbidden read every render.
    if (error.name !== 'SecurityError') throw error;
    canvasReadBlocked = true;
    console.warn('O navegador bloqueou a leitura dos retratos. Abra pelo servidor local para carregar a arte completa.', error);
    return EMPTY_ART_URL;
  }
}
function renderArtURL(p, portrait = false) {
  const layered=globalThis.CampaignPaperDoll?.url(p,portrait);
  if(layered)return layered;
  if (!animeAtlas)
    return "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const key = JSON.stringify([
    p.genes,
    characterArtProfile(p).race,
    p.caste,
    p.biologicalCaste,
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
    const size = Math.max(72, f.w * 1.7, f.h * 1.55),
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
  if (!animeAtlas && !globalThis.CampaignPaperDoll?.ready(p))
    return `<span class="${cls} art-loading" role="img" aria-label="${animeLoadError ? "Arte indisponível" : "Carregando retrato"}">${animeLoadError ? "!" : "…"}</span>`;
  const url = artURL(p, true);
  if (canvasReadBlocked) return `<span class="${cls} art-loading" role="img" aria-label="Retrato bloqueado pelo navegador">${esc(p.name?.slice(0, 1) || '?')}</span>`;
  return `<img class="${cls}" src="${url}" alt="Retrato anime medieval de ${esc(p.name)}" width="80" height="80">`;
}
function fullPortrait(p) {
  if (!animeAtlas && !globalThis.CampaignPaperDoll?.ready(p))
    return `<div class="full-character art-loading">${animeLoadError ? "Não foi possível carregar a arte." : "Carregando arte…"}</div>`;
  const url = artURL(p);
  if (canvasReadBlocked) return '<div class="full-character art-loading">Retrato bloqueado neste modo. Abra pelo servidor local para carregar a arte.</div>';
  return `<img class="full-character" src="${url}" alt="${esc(p.name)} de corpo inteiro em estilo anime medieval" width="192" height="288">`;
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
    raceAtlases.set("human", image);
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

  for (const [race, source] of Object.entries(RACE_ATLAS_ASSETS)) {
    if (race === "human") continue;
    const raceImage = new Image();
    raceImage.onload = () => {
      raceAtlases.set(race, raceImage);
      animeTiles.clear();
      artCache.clear();
      render();
      refreshPersonModal();
    };
    raceImage.src = source;
  }
}
