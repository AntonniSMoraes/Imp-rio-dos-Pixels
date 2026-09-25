'use strict';
// The renderer survives campaign UI refreshes; only its mount point is replaced.
let campaignMapRuntime, campaignMapLoading, campaignMapError;
function detachCampaignMap() { campaignMapRuntime?.detach(); }
function drawMap() {
  if (!state || !document.querySelector('#campaign-map-slot')) return;
  if (campaignMapError) { document.querySelector('#campaign-map-slot').textContent = campaignMapError; return; }
  if (campaignMapRuntime) {
    try { campaignMapRuntime.mount(state, selected, document.querySelector('#promotion-land-cluster')?.value); }
    catch (error) { failCampaignMap(error); }
    return;
  }
  if (campaignMapLoading) return;
  campaignMapLoading = import('./campaign-runtime.mjs').then(module => {
    campaignMapRuntime = module.createCampaignMap(selectTerritory);
    drawMap();
  }).catch(failCampaignMap);
}
function failCampaignMap(error) {
  campaignMapError = 'Não foi possível abrir o mapa 3D. Use o servidor local e um navegador com WebGL2. As outras abas continuam disponíveis.';
  const slot = document.querySelector('#campaign-map-slot');
  if (slot) slot.textContent = campaignMapError;
  console.error(error);
}
function mapView() {
  const panel = selected.kind === 'person' ? personPanel(byId(selected.id)) : selected.kind === 'region' ? regionPanel(selected.index) : locationPanel();
  return '<section class="realm-surface"><div class="realm-toolbar"><span>' + (pendingLand ? 'ESCOLHA TERRAS PARA A PROMOÇÃO' : 'PANGEIA · ' + (state.royalLands || []).length + ' vilas reais') + '</span><button data-toggle-border-edit="true" class="' + (editBorderMode ? 'primary' : '') + '">' + (editBorderMode ? 'Sair da edição' : 'Editar fronteiras') + '</button><button data-action="clear-selection">Vila pioneira</button><button data-view="people">Moradores</button><button data-view="build">Construções</button></div><div id="campaign-map-slot"><p>Preparando mapa 3D…</p></div></section><aside class="inspector">' + panel + '</aside>';
}
