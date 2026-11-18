import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {resolveQuality} from '../demos/corporate/gjh/v11/assets/graphics-quality.js';
import {createProductDisplayLod} from '../demos/corporate/gjh/v11/assets/product-display-lod.js';

function display(placements) {
  const meshes = [0, 1].map(y => {
    const mesh = new T.InstancedMesh(new T.BoxGeometry(), new T.MeshStandardMaterial(), placements.length);
    placements.forEach(({x, z}, index) => mesh.setMatrixAt(index, new T.Matrix4().makeTranslation(x, y, z)));
    return mesh;
  });
  const lod = createProductDisplayLod(T, meshes, placements);
  const positions = () => meshes.map(mesh => Array.from({length: mesh.count}, (_, index) => {
    const matrix = new T.Matrix4();
    mesh.getMatrixAt(index, matrix);
    return matrix.elements[0] === 0 ? null : matrix.elements.slice(12, 15);
  }));
  return {lod, meshes, positions};
}

test('effective Low compacts the display, including Auto and graphics recovery', () => {
  const {lod, meshes, positions} = display([
    {x:0, z:0}, {x:20, z:0}, {x:22, z:1}, {x:42, z:2, alwaysVisible:true}
  ]);
  const far = {x:40, z:0};
  const options = {width:1440, dpr:2};
  for (const preference of ['balanced', 'detailed', 'auto']) {
    lod.update(far, resolveQuality({...options, preference}).tier);
    assert.deepEqual(positions()[0], [null, null, null, [42,0,2]]);
  }
  const originalBounds = meshes.map(mesh => {
    mesh.computeBoundingSphere();
    return mesh.boundingSphere;
  });
  for (const profile of [{preference:'low'}, {autoTier:'low'}, {preference:'detailed', recovered:true}]) {
    lod.update(far, resolveQuality({...options, ...profile}).tier);
    assert.deepEqual(positions(), [[[42,0,2]], [[42,1,2]]]);
    assert.ok(meshes.every(mesh => mesh.boundingSphere.center.x === 42));
    lod.update(far, resolveQuality({...options, preference:'balanced'}).tier);
    assert.deepEqual(positions()[0], [null, null, null, [42,0,2]]);
    meshes.forEach((mesh, index) => assert.equal(mesh.boundingSphere, originalBounds[index]));
  }
});

test('Low submits zero instances outside the range and restores the same logical placements on approach', () => {
  const {lod, meshes, positions} = display([{x:0, z:0}, {x:6, z:0}]);
  lod.update({x:24, z:0}, 'low');
  assert.deepEqual(positions(), [[], []]);
  lod.update({x:23.99, z:0}, 'low');
  assert.deepEqual(positions(), [[[6,0,0]], [[6,1,0]]]);
  lod.update({x:0, z:0}, 'low');
  assert.deepEqual(positions(), [[[0,0,0], [6,0,0]], [[0,1,0], [6,1,0]]]);
  assert.ok(meshes.every(mesh => mesh.boundingSphere.center.x === 3));
  const before = meshes.map(mesh => mesh.instanceMatrix.version);
  lod.update({x:2, z:0}, 'low');
  assert.deepEqual(meshes.map(mesh => mesh.instanceMatrix.version), before);
  lod.update({x:36, z:0}, 'detailed');
  assert.deepEqual(positions(), [[null,null], [null,null]]);
});

test('a reserved product stays absent across tier and distance changes and returns to its authored slot', () => {
  const {lod, positions} = display([{x:0, z:0}, {x:6, z:0}, {x:40, z:0, alwaysVisible:true}]);
  const near = {x:0, z:0}, far = {x:40, z:0};
  lod.update(near, 'low');
  lod.setReserved(0);
  assert.deepEqual(positions()[0], [[6,0,0], [40,0,0]]);
  lod.update(far, 'low');
  lod.update(near, 'balanced');
  assert.deepEqual(positions()[0], [null, [6,0,0], [40,0,0]]);
  lod.update(far, 'balanced');
  lod.setReserved(-1);
  assert.deepEqual(positions()[0], [null, null, [40,0,0]]);
  lod.update(near, 'low');
  assert.deepEqual(positions()[0], [[0,0,0], [6,0,0], [40,0,0]]);
});
