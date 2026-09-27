// Keep the shell manifest synchronized when adding entry points or assets.
const CACHE_NAME = 'imperio-pixels-v30-campaign-paper-doll';
const ASSETS_TO_CACHE = [
  "./js/paper-doll/campaign-identity.js",
  "./js/paper-doll/campaign-renderer.mjs",
  "./js/kingdom/vassal-aid.js",
  "./js/kingdom/marriage-council.js",
  "./js/kingdom/court-ui.js",
  "./js/war/community-life.js",
  "./js/war/local-recruitment.js",
  "./js/kingdom/family-chronicle.js",
  "./js/war/warfare.js",
  "./js/war/dragons.js",
  "./js/war/combatants.js",
  "./js/war/world-societies.js",
  "./js/war/frontier-ai.js",
  "./js/war/world-ui.js",
  "./js/map-3d/world-tokens.mjs",
  "./js/map-3d/race-icons.mjs",
  "./js/war/war-ui.js",
  "./js/war/war-validation.js",
  "./js/map-3d/war-tokens.mjs",
  "./js/map-3d/settlements.mjs",
  "./js/kingdom/peerage.js",
  "./js/kingdom/noble-development.js",
  "./js/kingdom/domain-autonomy.js",
  "./js/war/conscription.js",
  "./js/kingdom/feudal-actions.js",
  "./js/kingdom/betrothals.js",
  "./js/kingdom/betrothal-ui.js",
  "./js/map-3d/campaign-runtime.mjs",
  "./js/territory/territory-selection.js",
  "./styles/campaign-map.css",
  "./js/territory/provinces.js",
  "./map-3d.html",
  "./styles/map-3d.css",
  "./js/map-3d/studio.mjs",
  "./js/map-3d/viewer.mjs",
  "./js/map-3d/terrain.mjs",
  "./js/map-3d/world-data.mjs",
  "./vendor/three/three.module.js",
  "./vendor/three/three.core.js",
  "./vendor/three/OrbitControls.js",
  "./js/engine/reproduction.js",
  "./js/engine/calendar.js",
  "./js/engine/daily-cycle.js",
  "./js/paper-doll/rig.mjs",
  "./",
  "./index.html",
  "./paper-doll.html",
  "./style.css",
  "./styles/paper-doll.css",
  "./manifest.json",
  "./js/art/art-palette.js",
  "./js/art/art-state.js",
  "./js/art/art.js",
  "./js/art/atlas-preparation.js",
  "./js/art/legacy-composition.js",
  "./js/art/rank-atlas.js",
  "./js/combat/battle-system.js",
  "./js/config/config.js",
  "./js/config/names.js",
  "./js/config/race-assets.js",
  "./js/config/races.js",
  "./js/core/save-validation.js",
  "./js/core/utils.js",
  "./js/economy/annual-economy.js",
  "./js/economy/state-economy.js",
  "./js/engine/race-genetics.js",
  "./js/kingdom/kingdom.js",
  "./js/model/people-model.js",
  "./js/model/people-relations.js",
  "./js/paper-doll/appearance.mjs",
  "./js/paper-doll/catalog.mjs",
  "./js/paper-doll/controls.mjs",
  "./js/paper-doll/renderer.mjs",
  "./js/paper-doll/storage.mjs",
  "./js/paper-doll/studio.mjs",
  "./js/recruitment/recruitment-system.js",
  "./js/territory/realm-territory.js",
  "./js/village/game-state.js",
  "./js/village/game.js",
  "./js/village/village-dialogs.js",
  "./js/village/village-events.js",
  "./js/village/village-loop.js",
  "./js/map-3d/campaign-map.js",
  "./js/village/village-render.js",
  "./js/village/village-views.js",
  "./assets/anime-character-atlas-bunny.png",
  "./assets/anime-character-atlas-cat.png",
  "./assets/anime-character-atlas-dark-elf.png",
  "./assets/anime-character-atlas-dwarf.png",
  "./assets/anime-character-atlas-elf.png",
  "./assets/anime-character-atlas-half-bunny.png",
  "./assets/anime-character-atlas-half-cat.png",
  "./assets/anime-character-atlas-half-dragon.png",
  "./assets/anime-character-atlas-half-wolf.png",
  "./assets/anime-character-atlas-harpy.png",
  "./assets/anime-character-atlas-kobold.png",
  "./assets/anime-character-atlas-lamia.png",
  "./assets/anime-character-atlas-wolf.png",
  "./assets/anime-character-atlas.png",
  "./assets/anime-ranks.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/medieval-map.png",
  "./assets/paper-doll/human-pilot.png"
];
const assetURLs = new Set(ASSETS_TO_CACHE.map(asset => new URL(asset, self.location.href).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('imperio-pixels-') && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !assetURLs.has(event.request.url)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(event.request)) || Response.error()));
});
