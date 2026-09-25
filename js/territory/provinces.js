"use strict";

// Shared deterministic geometry for the classic campaign and the ESM atlas.
// IDs remain unchanged; ownership is never regenerated from position.
globalThis.TerritoryGeometry = (() => {
  let cached;
  const hash = n => { const value = Math.sin(n * 127.1 + 91.7) * 43758.5453; return value - Math.floor(value); };
  function coords(index) {
    let x = 0, y = 0;
    for (let bit = 0; bit < 5; bit++) {
      x |= ((index >> (2 * bit)) & 1) << bit;
      if (bit < 4) y |= ((index >> (2 * bit + 1)) & 1) << bit;
    }
    return { x, y };
  }
  function height(x, z) {
    x = x / 4 + 15.5; const y = z / 4 + 7.5;
    const elevation = 1.1 - Math.hypot((x - 15) / 13, (y - 7.5) / 6.5)
      + Math.sin(x * .42 + y * .28) * .35 + Math.cos(x * .22 - y * .48) * .35
      + Math.sin(x * .85 - y * .65) * .18 + Math.cos(x * .62 + y * .92) * .18 + Math.sin(x * 1.5 + y * 1.3) * .08;
    return (elevation - .28) * 9;
  }
  // Low-amplitude common deformation gives shared, gently winding boundaries.
  // The fixed outer boundary and common transform keep the partition gap-free.
  function warp([x, z]) {
    const fade = Math.max(0, 1 - (x / 64) ** 8) * Math.max(0, 1 - (z / 32) ** 8);
    return [x + fade * (.65 * Math.sin(z * .4) + .25 * Math.sin(x * .7 + z * .2)),
      z + fade * (.65 * Math.sin(x * .32) + .22 * Math.cos(z * .7 - x * .3))];
  }
  function clip(poly, nx, nz, limit) {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = a[0] * nx + a[1] * nz - limit, db = b[0] * nx + b[1] * nz - limit;
      if (da <= 1e-9) result.push(a);
      if ((da < 0) !== (db < 0)) { const t = da / (da - db); result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return result;
  }
  function area(poly) {
    return Math.abs(poly.reduce((sum, a, i) => { const b = poly[(i + 1) % poly.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
  }
  function contains(poly, x, z) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function all() {
    if (cached) return cached;
    const sites = Array.from({ length: 512 }, (_, index) => {
      const { x, y } = coords(index);
      return [(x - 15.5) * 4 + (hash(index + 1) - .5) * 3.6, (y - 7.5) * 4 + (hash(index + 983) - .5) * 3.6];
    });
    const edgeMap = new Map();
    const provinces = sites.map((site, index) => {
      let polygon = [[-64, -32], [64, -32], [64, 32], [-64, 32]];
      for (let j = 0; j < sites.length; j++) {
        if (index === j) continue;
        const other = sites[j], nx = other[0] - site[0], nz = other[1] - site[1];
        polygon = clip(polygon, nx, nz, (other[0] ** 2 + other[1] ** 2 - site[0] ** 2 - site[1] ** 2) / 2);
      }
      const edges = [], boundary = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) continue;
        const keys = [a.map(v => v.toFixed(5)).join(','), b.map(v => v.toFixed(5)).join(',')].sort();
        const key = keys.join('/');
        let edge = edgeMap.get(key);
        if (!edge) {
          const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .35));
          edge = { owners: [], points: Array.from({ length: count + 1 }, (_, n) => warp([a[0] + (b[0] - a[0]) * n / count, a[1] + (b[1] - a[1]) * n / count])) };
          edgeMap.set(key, edge);
        }
        edge.owners.push(index);
        const start = warp(a);
        const forward = Math.hypot(start[0] - edge.points[0][0], start[1] - edge.points[0][1]) < .001;
        boundary.push(...(forward ? edge.points : [...edge.points].reverse()).slice(0, -1));
        edges.push(edge);
      }
      const center = warp(site), bounds = [Math.min(...boundary.map(p => p[0])), Math.min(...boundary.map(p => p[1])), Math.max(...boundary.map(p => p[0])), Math.max(...boundary.map(p => p[1]))];
      return { index, center, polygon: boundary, edges, bounds, area: area(boundary), neighbors: [] };
    });
    for (const province of provinces) {
      province.neighbors = [...new Set(province.edges.flatMap(edge => edge.owners.filter(id => id !== province.index)))];
      // Equal-area samples price only usable land; steep ground costs less,
      // lowlands and coastal ground add value per km².
      let land = 0, total = 0, value = 0;
      for (let x = province.bounds[0] + .125; x < province.bounds[2]; x += .25) {
        for (let z = province.bounds[1] + .125; z < province.bounds[3]; z += .25) {
          if (!contains(province.polygon, x, z)) continue;
          total++;
          const h = height(x, z);
          if (h <= .12) continue;
          land++;
          const slope = Math.hypot(height(x + .2, z) - h, height(x, z + .2) - h) / .2;
          value += (h < 1 ? 1.2 : h < 5 ? 1.15 : .85) / (1 + slope * .32);
        }
      }
      province.landArea = total ? province.area * land / total : 0;
      province.valuePerArea = land ? value / land : 0;
      province.price = province.landArea >= .5 ? Math.max(5, Math.round(province.landArea * 3 * province.valuePerArea)) : null;
    }
    cached = { version: 1, provinces, edges: [...edgeMap.values()] };
    return cached;
  }
  function get(index) { return Number.isInteger(index) && index >= 0 && index < 512 ? all().provinces[index] : null; }
  function locate(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return -1;
    return all().provinces.find(province => x >= province.bounds[0] && x <= province.bounds[2] && z >= province.bounds[1] && z <= province.bounds[3] && contains(province.polygon, x, z))?.index ?? -1;
  }
  return { all, get, locate, height, contains };
})();
