import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';
import {expandedLayout, plannedSpaces, shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
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

function publicPlanting(scene, physics) {
  const leaves = [], trunksAndBranches = [], matrix = new T.Matrix4(), transform = new T.Object3D();
  const geometry = {box: new T.BoxGeometry(), plane: new T.PlaneGeometry(), cylinder: new T.CylinderGeometry(1, 1, 1, 32)};
  const materials = Object.fromEntries(['oak', 'courtStone', 'ivory'].map(name => [name, new T.MeshStandardMaterial()]));
  const garden = atriumLayout.garden;
  physics.createCollider(R.ColliderDesc.cuboid(garden.width / 2, garden.height / 2, garden.depth / 2)
    .setTranslation(garden.x, garden.height / 2, garden.z));
  buildPublicArchitecture(T, {
    scene, geometry, materials, garden, lightPool: noop,
    box(_material, x, y, z, width, height, depth, collision) {
      if (collision) physics.createCollider(R.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(x, y, z));
    },
    solid(type, material, x, y, z, sx, sy, sz, ry = 0, rx = 0, order = 'XYZ', rz = 0) {
      // The tree builder uses YXZ for its angled timber cylinders.
      const treeWood = type === 'cylinder' && material === 'wood' && order === 'YXZ';
      if (!treeWood && type !== 'publicLeaf') return;
      const shape = geometry[type];
      if (!shape.boundingBox) shape.computeBoundingBox();
      transform.position.set(x, y, z);
      transform.scale.set(sx, sy, sz);
      transform.rotation.set(rx, ry, rz, order);
      matrix.compose(transform.position, transform.quaternion, transform.scale);
      (treeWood ? trunksAndBranches : leaves).push(shape.boundingBox.clone().applyMatrix4(matrix));
    }
  });
  assert.ok(leaves.length > 0 && trunksAndBranches.length > 0, 'public leaves and tree trunks are present');
  return [...leaves, ...trunksAndBranches];
}

test('all expanded teleport arrivals keep public planting out of the third-person foreground', async t => {
  stubBrowser(t);
  await R.init();
  const physics = new R.World({x: 0, y: -9.81, z: 0});
  const scene = new T.Scene();
  const planting = publicPlanting(scene, physics);
  const canvas = {clientWidth: 393, clientHeight: 560, addEventListener: noop, dataset: {}};
  const player = await createPlayer(T, R, physics, scene, canvas, new T.MeshBasicMaterial(), new T.PlaneGeometry(), [], [], true);
  t.after(() => { player.dispose(); physics.free(); });
  assert.equal(player.state.character.model, 'gjh-tripo-visitor');
  const view = new T.PerspectiveCamera(), frustum = new T.Frustum(), projection = new T.Matrix4();
  const zones = ['atrium', 'entry', ...[...spatial.stores, ...plannedSpaces].map(store => store.id)];
  const blocked = [];

  for (const [width, height] of [[393, 612], [1440, 900]]) {
    // The 3D canvas starts below the 52 CSS-pixel header (zero safe-area inset).
    player.resizeCamera(width, height - 52);
    for (const id of zones) {
      const arrival = `${id} at ${width}x${height}`;
      assert.equal(player.teleport(id), true, arrival);
      assert.equal(canvas.dataset.cameraView, 'third-person', arrival);
      player.camera.updateMatrixWorld(true);
      view.copy(player.camera);
      view.far = 1.5;
      if (id === 'planned-space-09') {
        // Clear the entire image up to the interior anchor at the SPAM arrival.
        const slot = expandedLayout.slots.find(slot => slot.number === '09');
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
      if (planting.some(box => box.containsPoint(view.position) || frustum.intersectsBox(box))) {
        blocked.push(arrival);
      }
    }
  }
  assert.deepEqual(blocked, [], 'public planting intersects an arrival camera or view');
});
