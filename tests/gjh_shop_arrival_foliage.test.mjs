import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';
import {expandedLayout, shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {interiorStores, worldInteriorBox} from '../demos/corporate/gjh/v11/assets/interiors/config.js';
import {createPlayer} from '../demos/corporate/gjh/v11/assets/player.js';
import {buildPublicArchitecture} from '../demos/corporate/gjh/v11/assets/public-architecture.js';
import {fasciaBand} from '../demos/corporate/gjh/v11/assets/signage/config.js';
import {spatial} from '../demos/corporate/gjh/v11/assets/spatial.js';

const noop = () => {};

function stubBrowser(t) {
  const context = {fillRect: noop, fillText: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    closePath: noop, fill: noop, stroke: noop};
  const control = {addEventListener: noop, setAttribute: noop};
  const matchMedia = () => ({matches: false});
  const globals = {
    document: {createElement: () => ({getContext: () => context}), addEventListener: noop,
      querySelector: () => ({...control, querySelector: () => control})},
    window: {addEventListener: noop, requestIdleCallback: noop},
    location: {search: ''}, matchMedia, self: globalThis,
    createImageBitmap: async () => ({width: 1, height: 1})
  };
  const saved = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, globals);
  t.after(() => {
    for (const key of Object.keys(globals)) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
  });
  t.mock.method(T.TextureLoader.prototype, 'load', noop);
  t.mock.method(globalThis, 'fetch', async url => {
    const path = new URL(url);
    if (path.pathname.endsWith('/rapier_bg.wasm')) {
      return new Response(await readFile(path), {headers: {'Content-Type': 'application/wasm'}});
    }
    if (path.pathname.endsWith('/gjh-tripo-visitor.glb')) return new Response(await readFile(path));
    return new Response(null, {status: 404});
  });
}

function publicFoliage(scene, physics) {
  const foliage = [], matrix = new T.Matrix4(), transform = new T.Object3D();
  const geometry = {box: new T.BoxGeometry(), plane: new T.PlaneGeometry()};
  const materials = Object.fromEntries(['oak', 'courtStone', 'ivory'].map(name => [name, new T.MeshStandardMaterial()]));
  buildPublicArchitecture(T, {
    scene, geometry, materials, garden: atriumLayout.garden, lightPool: noop,
    box(_material, x, y, z, width, height, depth, collision) {
      if (collision) physics.createCollider(R.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(x, y, z));
    },
    solid(type, _material, x, y, z, sx, sy, sz, ry, rx, order) {
      if (type !== 'publicLeaf') return;
      if (!geometry.publicLeaf.boundingBox) geometry.publicLeaf.computeBoundingBox();
      transform.position.set(x, y, z);
      transform.scale.set(sx, sy, sz);
      transform.rotation.set(rx, ry, 0, order);
      matrix.compose(transform.position, transform.quaternion, transform.scale);
      foliage.push(geometry.publicLeaf.boundingBox.clone().applyMatrix4(matrix));
    }
  });
  return foliage;
}

test('shop arrivals keep public foliage out of the third-person view', async t => {
  stubBrowser(t);
  await R.init();
  const physics = new R.World({x: 0, y: -9.81, z: 0});
  const scene = new T.Scene();
  const foliage = publicFoliage(scene, physics);
  assert.ok(foliage.length > 0, 'public foliage is present');
  const canvas = {clientWidth: 393, clientHeight: 560, addEventListener: noop, dataset: {}};
  const player = await createPlayer(T, R, physics, scene, canvas, new T.MeshBasicMaterial(), new T.PlaneGeometry(), [], [], true);
  t.after(() => { player.dispose(); physics.free(); });
  assert.equal(player.state.character.model, 'gjh-tripo-visitor');
  const view = new T.PerspectiveCamera(), frustum = new T.Frustum(), projection = new T.Matrix4();
  const blocked = [];

  for (const [width, height] of [[393, 612], [1440, 900]]) {
    // The 3D canvas starts below the 52 CSS-pixel header (zero safe-area inset).
    player.resizeCamera(width, height - 52);
    for (const [index, slot] of expandedLayout.slots.entries()) {
      const id = spatial.stores[index]?.id ?? `planned-space-${slot.number}`;
      assert.equal(player.teleport(id), true, id);
      player.camera.updateMatrixWorld(true);
      view.copy(player.camera);
      view.far = 1.5;
      if (slot.number === '09') {
        // Clear the entire image up to the interior anchor at the SPAM arrival.
        const {x, z} = shopEntrance(slot), {bottom, top} = fasciaBand(slot);
        const store = interiorStores.S09;
        const [ax, ay, az] = store.anchor.position_m;
        const {center} = worldInteriorBox(store, {center: [ax, ay + store.anchor.envelope_whd_m[1] / 2, az], size: [1, 1, 1], yaw: 0});
        const anchor = new T.Vector3(...center);
        for (const point of [new T.Vector3(x, (bottom + top) / 2, z), new T.Vector3(x, 2, z), anchor]) {
          const ndc = point.clone().project(player.camera);
          assert.ok(Math.max(Math.abs(ndc.x), Math.abs(ndc.y), Math.abs(ndc.z)) < 1, `S09 target outside ${width}x${height}`);
        }
        view.far = -anchor.applyMatrix4(player.camera.matrixWorldInverse).z;
      }
      view.updateProjectionMatrix();
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(view.projectionMatrix, view.matrixWorldInverse));
      if (foliage.some(box => frustum.intersectsBox(box))) blocked.push(`S${slot.number} at ${width}x${height}`);
    }
  }
  assert.deepEqual(blocked, [], 'public foliage intersects an arrival view');
});
