import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppearance, changeAppearance, validateAppearance } from '../js/paper-doll/appearance.mjs';
import { OPTIONS, STAGE, getLayers, getGalleryAppearances, getPortraitFrame } from '../js/paper-doll/catalog.mjs';
import { BODIES, HEADS, HAIR, pointOnPart } from '../js/paper-doll/rig.mjs';
import { loadAppearance, saveAppearance, STORAGE_KEY } from '../js/paper-doll/storage.mjs';

test('stable identity survives changes, serialization and reload', () => {
  const first = createAppearance('dinastia-valen');
  assert.deepEqual(first, createAppearance('dinastia-valen'));
  const edited = changeAppearance(first, 'hair', 'long-brown');
  assert.equal(first.hair, createAppearance('dinastia-valen').hair);
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  assert.equal(loadAppearance(storage), null);
  saveAppearance(storage, edited);
  assert.deepEqual(loadAppearance(storage), edited);
  assert.equal(entries.size, 1);
  assert.ok(entries.has(STORAGE_KEY));
});

test('every supported combination maps to contained atlas regions', () => {
  let count = 0;
  for (const body of OPTIONS.body) for (const skin of OPTIONS.skin) {
    for (const outfit of OPTIONS.outfit) for (const hair of OPTIONS.hair) {
      const appearance = validateAppearance({ ...createAppearance('test'), body: body.id, skin: skin.id, outfit: outfit.id, hair: hair.id });
      const layers = getLayers(appearance);
      assert.deepEqual(layers.map(layer => layer.id), ['head', 'body', 'hair']);
      for (const { source, box } of layers) {
        assert.ok(source.x >= 0 && source.y >= 0 && source.width > 0 && source.height > 0);
        assert.ok(source.x + source.width <= 1 && source.y + source.height <= 1);
        assert.ok(box.every(Number.isFinite));
      }
      count++;
    }
  }
  assert.equal(count, 32);
});

test('unsupported identities and broken saves do not silently mutate appearance', () => {
  const valid = createAppearance('adulto');
  for (const patch of [{ version: 99 }, { ageGroup: 'child' }, { race: 'elf' }, { hair: 'missing' }, { seed: '' }]) {
    assert.throws(() => validateAppearance({ ...valid, ...patch }));
  }
  assert.throws(() => changeAppearance(valid, 'race', 'elf'));
  assert.throws(() => loadAppearance({ getItem: () => '{broken' }));
  assert.throws(() => saveAppearance({ setItem: () => { throw new Error('quota'); } }, valid), /quota/);
});

test('gallery covers all 32 distinct combinations', () => {
  const gallery = getGalleryAppearances();
  assert.equal(gallery.length, 32);
  assert.equal(new Set(gallery.map(({ body, skin, outfit, hair }) => [body, skin, outfit, hair].join('/'))).size, 32);
  gallery.forEach(appearance => assert.deepEqual(validateAppearance(appearance), appearance));
});

test('composition preserves aspect ratios, joins anchors and stays inside the stage', () => {
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  for (const appearance of getGalleryAppearances()) {
    const female = Number(appearance.body === 'female');
    const body = BODIES[(appearance.outfit === 'noble' ? 2 : 0) + female];
    const head = HEADS[(appearance.skin === 'brown' ? 2 : 0) + female];
    const hair = HAIR[OPTIONS.hair.findIndex(option => option.id === appearance.hair)];
    const [headLayer, bodyLayer, hairLayer] = getLayers(appearance);
    for (const layer of [headLayer, bodyLayer, hairLayer]) {
      const [x, y, width, height] = layer.box;
      near(width / height, layer.source.width / layer.source.height);
      assert.ok(x >= 0 && y >= 0 && x + width <= STAGE.width && y + height <= STAGE.height);
    }
    near(bodyLayer.box[1] + bodyLayer.box[3], 610);
    const bodyNeck = pointOnPart(bodyLayer, body.crop, body.neck);
    const headNeck = pointOnPart(headLayer, head.crop, head.neck);
    const crown = pointOnPart(headLayer, head.crop, head.crown);
    const hairCrown = pointOnPart(hairLayer, hair.crop, hair.crown);
    for (let axis = 0; axis < 2; axis++) {
      near(bodyNeck[axis], headNeck[axis]);
      near(crown[axis], hairCrown[axis]);
    }
    const chin = pointOnPart(headLayer, head.crop, head.chin);
    const headUnits = (610 - crown[1]) / (chin[1] - crown[1]);
    assert.ok(headUnits >= 7 && headUnits <= 8.5, `Adult proportion: ${headUnits}`);
    const [px, py, pw, ph] = getPortraitFrame(appearance);
    near(pw, ph);
    assert.ok(px <= headLayer.box[0] && py <= hairLayer.box[1]);
    assert.ok(px + pw >= headLayer.box[0] + headLayer.box[2]);
    assert.ok(py + ph >= chin[1]);
  }
});
