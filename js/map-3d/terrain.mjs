import * as THREE from 'three';
import { heightAt, worldPoint, provinces } from './world-data.mjs';

export function buildTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(128, 64, 192, 96);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), height = heightAt(x, z);
    positions.setY(i, height);
    const slope = Math.hypot(heightAt(x + .4, z) - height, heightAt(x, z + .4) - height);
    color.set('#6f8a4c');
    color.lerp(new THREE.Color('#c3b989'), 1 - THREE.MathUtils.smoothstep(height, .15, 1.1));
    color.lerp(new THREE.Color('#7e8273'), Math.max(THREE.MathUtils.smoothstep(height, 4, 7), THREE.MathUtils.smoothstep(slope, .55, 1.1)));
    color.lerp(new THREE.Color('#e0dfcf'), THREE.MathUtils.smoothstep(height, 7.5, 10));
    color.multiplyScalar(.94 + .06 * Math.sin(x * 3.1 + z * 7.8));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
  scene.add(terrain);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: '#397c91', roughness: .6, metalness: .05 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = .08;
  scene.add(water);
  // A deterministic, instanced forest avoids thousands of separate draw calls.
  const forestPoints = [];
  for (let i = 0; i < 2600; i++) {
    const x = ((Math.sin(i * 127.1) * 43758.5453) % 1) * 60;
    const z = ((Math.sin(i * 311.7) * 19341.123) % 1) * 29;
    const h = heightAt(x, z);
    if (h > .7 && h < 5 && Math.sin(x * .175 + z * .125) + Math.cos(x * .075 - z * .2) > .25) forestPoints.push([x, h, z]);
  }
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(.43, 1.6, 5), new THREE.MeshStandardMaterial({ color: '#254e3a', roughness: 1 }), forestPoints.length);
  const dummy = new THREE.Object3D();
  forestPoints.forEach(([x, h, z], index) => {
    dummy.position.set(x, h + .65, z);
    dummy.scale.setScalar(.65 + (index % 7) / 12);
    dummy.updateMatrix();
    trees.setMatrixAt(index, dummy.matrix);
  });
  scene.add(trees);
  terrain.castShadow = terrain.receiveShadow = true;
  trees.castShadow = true;
  water.receiveShadow = true;
  return { terrain, water, trees };
}

// Triangulate the exact shared boundary, then refine to follow the terrain.
function surfacePatch(index, color, opacity) {
  const polygon = provinces.get(index).polygon;
  const contour = polygon.map(([x,z]) => new THREE.Vector2(x,z));
  const vertices = [];
  function triangle(a,b,c,depth=0) {
    if (depth < 5 && Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1])) > .55) {
      const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;
    }
    if (heightAt((a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3) < .1) return;
    for(const [x,z] of [a,b,c]) vertices.push(x,Math.max(.1,heightAt(x,z))+.13,z);
  }
  for(const face of THREE.ShapeUtils.triangulateShape(contour,[])) triangle(...face.map(i=>polygon[i]));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
}
export function buildDomains(world) {
  const group=new THREE.Group(), internal=[], political=[];
  for(const province of provinces.all().provinces) {
    const owner=world.owners[province.index];
    if(owner.id!=='free') group.add(surfacePatch(province.index,owner.color,.16));
  }
  for(const edge of provinces.all().edges) {
    const owners=edge.owners.map(i=>world.owners[i].id);
    const points=owners.some(id=>id!=='free') && (owners.length===1 || owners[0]!==owners[1]) ? political : internal;
    for(let i=1;i<edge.points.length;i++) {
      const a=edge.points[i-1],b=edge.points[i];
      if(heightAt(...a)<.15 || heightAt(...b)<.15) continue;
      for(const [x,z] of [a,b]) points.push(x,heightAt(x,z)+.19,z);
    }
  }
  for(const [points,color,opacity] of [[internal,'#ded2ae',.38],[political,'#ffe0a0',.95]]) {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity})));
  }
  return group;
}
export function selectionPatch(index) { return surfacePatch(index,'#fff1a6',.43); }

export function buildCities(world) {
  const group = new THREE.Group();
  for (const city of world.cities) {
    const point = worldPoint(city.index), base = Math.max(.16, heightAt(point.x, point.z));
    const castle = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#d0c5a8', roughness: .85 });
    const roof = new THREE.MeshStandardMaterial({ color: city.capital ? '#485969' : '#714e49', roughness: .85 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, .9, 1.2), stone);
    block.position.y = .45;
    castle.add(block);
    for (const [x, z] of [[-.8, -.6], [.8, -.6], [-.8, .6], [.8, .6]]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(.27, .3, 1.4, 8), stone);
      tower.position.set(x, .7, z);
      const top = new THREE.Mesh(new THREE.ConeGeometry(.4, .65, 8), roof);
      top.position.set(x, 1.7, z);
      castle.add(tower, top);
    }
    castle.position.set(point.x, base, point.z);
    castle.userData.tile = city.index;
    group.add(castle);
  }
  return group;
}

export function disposeGroup(group) {
  const materials = new Set();
  group.traverse(object => {
    object.geometry?.dispose();
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  materials.forEach(material => material.dispose());
}
