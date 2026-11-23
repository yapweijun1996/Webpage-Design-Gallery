import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {westShopPlacements} from '../demos/corporate/gjh/v11/assets/gallery-west-shops.js';

const assets = new URL('../demos/corporate/gjh/v11/assets/', import.meta.url);
function glb(path) {
  const data = readFileSync(new URL(path, assets));
  return JSON.parse(data.subarray(20, 20 + data.readUint32LE(12)));
}

test('the Gu Long window keeps two stock courses on the source plinth and the central pyramid keeps six', () => {
  const [window] = westShopPlacements[7];
  assert.equal(window.file, 'gallery-assets/gulong-window-stock.glb');
  assert.deepEqual(window.position, [-1.56, .081, 2.65]);
  const stock = glb(window.file);
  const original = glb('gallery-assets/stacked-can-pyramid.glb');
  assert.deepEqual(stock.materials, original.materials);
  assert.equal(stock.textures, undefined);
  const bounds = (g, mesh) => g.accessors[mesh.primitives[0].attributes.POSITION];
  const [plinth, tins] = stock.meshes;
  assert.deepEqual(bounds(stock, plinth).min, bounds(original, original.meshes[0]).min);
  assert.deepEqual(bounds(stock, plinth).max, bounds(original, original.meshes[0]).max);
  assert.ok(Math.abs(bounds(stock, tins).max[1] - .68) < .00001);
  for (const tier of ['low', 'balanced']) {
    const central = glb('interiors/s07-stacked-can-pyramid-' + tier + '.glb');
    const courses = central.meshes.find(m => m.name === 'Six stepped tin courses');
    assert.ok(Math.abs(bounds(central, courses).max[1] - 2.45) < .00001);
  }
});
