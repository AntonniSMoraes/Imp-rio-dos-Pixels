'use strict';

function getTileCoords(index) {
  const coordinates = morton(index);
  return { x: coordinates.x, y: coordinates.y };
}

function mortonFromCoord(x, y) {
  if (x < 0 || x > 31 || y < 0 || y > 15) return -1;
  for (let index = 0; index < 512; index++) {
    const coordinates = morton(index);
    if (coordinates.x === x && coordinates.y === y) return index;
  }
  return -1;
}

function pangeaNoise(x, y) {
  const dx = (x - 15) / 13;
  const dy = (y - 7.5) / 6.5;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const first = Math.sin(x * 0.42 + y * 0.28) * 0.35 + Math.cos(x * 0.22 - y * 0.48) * 0.35;
  const second = Math.sin(x * 0.85 - y * 0.65) * 0.18 + Math.cos(x * 0.62 + y * 0.92) * 0.18;
  const third = Math.sin(x * 1.5 + y * 1.3) * 0.08;
  return 1.1 - distance + first + second + third;
}

function getTileBiome(index) {
  const coordinates = getTileCoords(index);
  const elevation = pangeaNoise(coordinates.x, coordinates.y);
  if (elevation < 0.28) return 'lago';
  if (elevation > 0.92) return 'mina';
  const vegetation = Math.sin(coordinates.x * 0.7 + coordinates.y * 0.5) + Math.cos(coordinates.x * 0.3 - coordinates.y * 0.8);
  return vegetation > 0.45 ? 'floresta' : 'planicie';
}

function areTilesConnected(tiles) {
  if (!tiles || tiles.length === 0) return false;
  if (tiles.length === 1) return true;
  const tileSet = new Set(tiles);
  const visited = new Set([tiles[0]]);
  const queue = [tiles[0]];
  while (queue.length) {
    const current = queue.shift();
    const neighbors = TerritoryGeometry.get(current)?.neighbors || [];
    for (const neighbor of neighbors) {
      if (tileSet.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited.size === tiles.length;
}

function getClusterFromTile(startTile, size, currentPersonTiles = []) {
  if (!state) return null;
  const royalLands = new Set(state.royalLands || []);
  const currentLands = new Set(currentPersonTiles);
  const occupied = new Set();
  alive().forEach((person) => {
    if (person.social >= 2 && person.id !== state.king) {
      (person.tiles || [person.territory]).forEach((tile) => {
        if (tile !== null && tile !== undefined && !currentLands.has(tile)) occupied.add(tile);
      });
    }
  });
  const seat = REGIONS[state.region]?.seat ?? 240;
  if ((!royalLands.has(startTile) && !currentLands.has(startTile)) || occupied.has(startTile) || startTile === seat) return null;
  if (size === 1) return [startTile];

  const cluster = currentLands.has(startTile) ? [...currentPersonTiles] : [startTile];
  const queue = [...cluster];
  const visited = new Set(cluster);
  while (queue.length && cluster.length < size) {
    const current = queue.shift();
    const neighbors = TerritoryGeometry.get(current)?.neighbors || [];
    for (const neighbor of neighbors) {
      if (neighbor >= 0 && neighbor !== seat && (royalLands.has(neighbor) || currentLands.has(neighbor)) && !occupied.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        cluster.push(neighbor);
        queue.push(neighbor);
        if (cluster.length === size) break;
      }
    }
  }
  return cluster.length === size && areTilesConnected(cluster) ? cluster : null;
}

function getAvailableConnectedClusters(size, targetPerson = null) {
  if (!state) return [];
  const royalLands = new Set(state.royalLands || []);
  const seat = REGIONS[state.region]?.seat ?? 240;
  const currentLands = targetPerson
    ? (targetPerson.tiles || [targetPerson.territory]).filter((tile) => tile !== null && tile !== undefined)
    : [];
  const occupiedByOthers = new Set();
  alive().forEach((person) => {
    if (person.social >= 2 && person.id !== state.king && (!targetPerson || person.id !== targetPerson.id)) {
      (person.tiles || [person.territory]).forEach((tile) => {
        if (tile !== null && tile !== undefined) occupiedByOthers.add(tile);
      });
    }
  });
  const available = Array.from(royalLands).concat(currentLands).filter((tile) => tile !== seat && !occupiedByOthers.has(tile));
  if (available.length < size) return [];
  if (size === 1) return available.map((tile) => [tile]);

  const clusters = [];
  const starts = currentLands.length ? currentLands.concat(available) : available;
  for (const start of starts) {
    const cluster = getClusterFromTile(start, size, currentLands);
    if (!cluster) continue;
    const key = cluster.slice().sort().join(',');
    if (!clusters.some((candidate) => candidate.slice().sort().join(',') === key)) clusters.push(cluster);
    if (clusters.length >= 8) break;
  }
  return clusters;
}

function buyLand(index) {
  if (!state) return;
  const province = TerritoryGeometry.get(index);
  if (!province || province.price === null) return toast('Este território não possui área terrestre suficiente para anexação.');
  state.royalLands = state.royalLands || [];
  if (state.royalLands.includes(index)) return toast('Este território já faz parte do seu domínio.');
  if (alive().some(person => person.id !== state.king && person.social >= 2 && (person.tiles || [person.territory]).includes(index))) return toast('Este território já pertence a um feudo.');
  const price = province.price;
  if (state.gold < price) return toast('Ouro insuficiente. Custo: ' + price + ' ouro.');
  state.gold -= price;
  state.royalLands.push(index);
  log('Expansão territorial: A Coroa anexou a Vila ' + (index + 1) + ' por ' + price + ' ouro.');
  save();
  render();
  toast('Território adquirido! Domínio expandido.');
}
