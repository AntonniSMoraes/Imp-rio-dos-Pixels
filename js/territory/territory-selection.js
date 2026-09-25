'use strict';
function selectTerritory(index) {
  if (!state || !TerritoryGeometry.get(index)) return;
    if (pendingLand) {
      const p = byId(pendingLand);
      if (!p || !p.alive) { pendingLand = null; return toast('O personagem não está disponível.'); }
      const nextRank = p.social + 1;
      const targetSize = LAND_SIZE[nextRank] || 1;
      const currentPersonTiles = (p.tiles || [p.territory]).filter(t => t !== null && t !== undefined);
      const cluster = getClusterFromTile(index, targetSize, currentPersonTiles);
      if (!cluster) {
        return toast('O território precisa ter ' + targetSize + ' vilas conectadas livres pertencentes à Coroa (a Capital Real está protegida).');
      }
      const chosenPersonId = pendingLand;
      pendingLand = null;
      promotionDialog(chosenPersonId, cluster);
      return;
    }

    if (editBorderMode) {
      const clickedNoble = alive().find(function(p) {
        return p.social >= 2 && p.id !== state.king && (p.tiles || []).includes(index);
      });
      if (clickedNoble) {
        selectedBorderNoble = clickedNoble.id;
        toast('Casa ' + clickedNoble.family + ' selecionada. Clique em um bloco real livre vizinho para transferir.');
      } else if (selectedBorderNoble) {
        const noble = byId(selectedBorderNoble);
        if (index === (REGIONS[state.region]?.seat ?? 240)) return toast('A Capital Real está protegida.');
        if (noble && !(noble.tiles || []).includes(index) && (state.royalLands || []).includes(index)) {
          if (state.gold < 15) return toast('Ouro insuficiente para alterar fronteiras (Custo: 15 ouro).');
          const oldTiles = [...(noble.tiles || [])];
          const removeIdx = oldTiles[oldTiles.length - 1];
          const newTiles = oldTiles.filter(function(t) { return t !== removeIdx; });
          newTiles.push(index);
          if (!areTilesConnected(newTiles)) {
            return toast('A nova fronteira deve manter todos os blocos do feudo conectados!');
          }
          state.gold -= 15;
          noble.tiles = newTiles;
          noble.territory = newTiles[0];
          log('Fronteira ajustada: A Casa ' + noble.family + ' remanejou suas terras.');
          save();
          render();
          toast('Fronteira alterada com sucesso.');
        }
      }
      return;
    }

    selected = { kind: 'region', index: index };
    render();

}
