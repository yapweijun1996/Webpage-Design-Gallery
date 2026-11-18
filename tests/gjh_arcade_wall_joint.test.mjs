import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {expandedLayout, shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {buildPublicArchitecture} from '../demos/corporate/gjh/v11/assets/public-architecture.js';
import {buildWindowStudio} from '../demos/corporate/gjh/v11/assets/window-studios.js';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';

const noop = () => {};
const tolerance = .0005;

function boxBounds(x, y, z, width, height, depth) {
  return new T.Box3().setFromCenterAndSize(new T.Vector3(x,y,z), new T.Vector3(width,height,depth));
}

function arcadeBoxes(t) {
  const boxes = [];
  // Only the solid placements matter here. Skip canvas artwork and optional assets.
  globalThis.document = {createElement: () => ({getContext: () => null})};
  globalThis.window = {requestIdleCallback: noop};
  t.after(() => { delete globalThis.document; delete globalThis.window; });
  t.mock.method(T.TextureLoader.prototype, 'load', noop);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, {status:404}));
  buildPublicArchitecture(T, {
    scene: new T.Scene(), geometry: {box: new T.BoxGeometry()},
    materials: {oak:new T.MeshStandardMaterial(), courtStone:new T.MeshStandardMaterial(), ivory:new T.MeshStandardMaterial()},
    garden: atriumLayout.garden, solid: noop, lightPool: noop,
    box(material, ...dimensions) { if (material === 'ivory') boxes.push(boxBounds(...dimensions)); }
  });
  return boxes;
}

function studioBoxes(slot) {
  const entrance = shopEntrance(slot);
  const transform = new T.Matrix4().makeRotationY(entrance.yaw)
    .setPosition((slot.minX+slot.maxX)/2, 0, (slot.minZ+slot.maxZ)/2);
  const boxes = [];
  const tools = {
    block:noop, column:noop, disc:noop, bar:noop, arch:noop, ring:noop, ellipse:noop, tapered:noop,
    box(...dimensions) { boxes.push(boxBounds(...dimensions).applyMatrix4(transform)); }
  };
  buildWindowStudio(Number(slot.number), tools, slot.maxZ-slot.minZ, slot.maxX-slot.minX);
  return boxes;
}

test('side shop walls meet the arcade pilasters without overlapping their visible faces', t => {
  const arcade = arcadeBoxes(t);
  const joints = [];
  for (const slot of expandedLayout.slots.filter(slot => slot.side !== 'north')) {
    const entrance = shopEntrance(slot);
    const throughPier = new T.Vector3(entrance.x, 2, slot.minZ+.12);
    const piers = arcade.filter(box => box.containsPoint(throughPier));
    assert.equal(piers.length, 1, `S${slot.number} pilaster`);
    const pier = piers[0];
    // Slice the eye-level wall just inside the shop, on the side facing the promenade.
    const throughWall = new T.Vector3(entrance.x-entrance.normalX, 2, pier.max.z-.01);
    const walls = studioBoxes(slot).filter(box => box.containsPoint(throughWall));
    assert.equal(walls.length, 1, `S${slot.number} side wall`);
    const wall = walls[0];
    const gap = entrance.normalX > 0 ? pier.min.x-wall.max.x : wall.min.x-pier.max.x;
    if (gap > tolerance || (gap < -tolerance && Math.abs(pier.max.z-wall.max.z) <= tolerance)) {
      joints.push(`S${slot.number} at z=${pier.max.z.toFixed(3)}: ${(gap*1000).toFixed(1)} mm gap`);
    }
  }
  assert.deepEqual(joints, []);
});
