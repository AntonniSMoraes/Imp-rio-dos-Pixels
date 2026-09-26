import { buildWarTokens } from './war-tokens.mjs';
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { heightAt, worldPoint, provinces } from './world-data.mjs';
import { buildTerrain, buildDomains, buildCities, selectionPatch, disposeGroup } from './terrain.mjs';

export function createViewer(container, labels, world, onSelect, onBearing = () => {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor('#527687');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', 'Mapa tridimensional de Pangeia');
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#527687', 130, 270);
  scene.add(new THREE.HemisphereLight('#e8f1ff', '#687149', 2.1));
  const sun = new THREE.DirectionalLight('#ffe8b9', 2);
  sun.position.set(-40, 60, -20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 65, bottom: -65, near: .5, far: 180 });
  sun.shadow.normalBias = .12;
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(42, 1, .2, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 9;
  controls.maxDistance = 180;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI / 2.25;
  controls.target.set(0, 1, 0);
  camera.position.set(62, 75, 88);
  controls.update();
  const { terrain, water, trees } = buildTerrain(scene);
  let domains, cities, tokens, selected, dirty = true, frame, closed = false;
  let labelItems = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down;
  function update(nextWorld) {
    world = nextWorld;
    for (const group of [domains, cities, tokens]) if (group) { scene.remove(group); disposeGroup(group); }
    const visible = domains?.visible ?? true;
    domains = buildDomains(world);
    domains.visible = visible;
    cities = buildCities(world);
    tokens = buildWarTokens(world);
    scene.add(domains, cities, tokens);
    labels.replaceChildren();
    labelItems = world.cities.filter(city => city.point).map(city => {
      const button = document.createElement('button');
      button.className = 'city-label';
      button.textContent = (city.capital ? '♜ ' : '⌂ ') + city.name;
      button.onclick = () => onSelect(city.point.province ?? city.index);
      labels.append(button);
      button.style.borderColor = city.color;
      button.title = city.point?.relocated ? "Sede em terreno edificável do próprio domínio." : city.name;
      const p = city.point || worldPoint(city.index);
      return { button, point: new THREE.Vector3(p.x, (p.base ?? Math.max(.1, heightAt(p.x, p.z))) + (p.kind === 'castle' ? 2.3 : p.kind === 'manor' ? 1.8 : p.kind === 'house' ? .9 : .4), p.z) };
    });
    dirty = true;
  }
  update(world);
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const onChange = () => { dirty = true; };
  controls.addEventListener('change', onChange);
  const onDown = event => { down = { x: event.clientX, y: event.clientY, button: event.button }; };
  const onUp = event => {
    if (!down || down.button !== 0 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([terrain, water, cities, tokens], true)[0];
    if (!hit) return;
    let object = hit.object;
    while (object && object.userData.tile === undefined) object = object.parent;
    const index = object?.userData.tile ?? provinces.locate(hit.point.x, hit.point.z);
    if (index >= 0) onSelect(index);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    container.dispatchEvent(new CustomEvent('map-error', { detail: 'A conexão com a placa gráfica foi interrompida. Recarregue a página para restaurar o mapa 3D.' }));
  });
  function animate() {
    if (closed) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden || !container.isConnected) return;
    controls.update();
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
    const center = controls.target.clone().project(camera);
    const north = controls.target.clone().add(new THREE.Vector3(0, 0, -10)).project(camera);
    onBearing(Math.atan2((north.x - center.x) * container.clientWidth, (north.y - center.y) * container.clientHeight));
    for (const { button, point } of labelItems) {
      const projected = point.clone().project(camera);
      button.hidden = projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1;
      button.style.left = (projected.x + 1) * container.clientWidth / 2 + 'px';
      button.style.top = (1 - projected.y) * container.clientHeight / 2 + 'px';
    }
  }
  resize();
  animate();
  return {
    update,
    select(index) {
      if (selected) { scene.remove(selected); disposeGroup(selected); }
      selected = new THREE.Group();
      for (const tile of (Array.isArray(index) ? index : [index])) if (provinces.get(tile)) selected.add(selectionPatch(tile));
      scene.add(selected); dirty = true;
    },
    focus(index) {
      const p = world.cities.find(city=>city.index===index)?.point || worldPoint(index), height = Math.max(0, heightAt(p.x, p.z));
      controls.target.set(p.x, height, p.z);
      camera.position.set(p.x + 14, height + 22, p.z + 24);
      controls.update(); dirty = true;
    },
    home() { camera.position.set(62, 75, 88); controls.target.set(0, 1, 0); controls.update(); dirty = true; },
    zoom(factor) { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); dirty = true; },
    borders(visible) { domains.visible = visible; dirty = true; },
    forests(visible) { trees.visible = visible; dirty = true; },
    dispose() { closed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); disposeGroup(scene); renderer.dispose(); renderer.domElement.remove(); labels.replaceChildren(); },
  };
}
