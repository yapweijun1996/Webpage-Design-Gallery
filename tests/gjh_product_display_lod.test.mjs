import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
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
    return matrix.elements.slice(12, 15);
  }));
  return {lod, meshes, positions};
}

test('far New Moon stock submits only the in-range and always-visible instances', () => {
  const {lod, meshes, positions} = display([
    {x:0, z:0}, {x:20, z:0}, {x:22, z:1}, {x:42, z:2, alwaysVisible:true}
  ]);
  lod.update({x:40, z:0});
  assert.deepEqual(positions(), [[[42,0,2]], [[42,1,2]]]);
  assert.ok(meshes.every(mesh => mesh.boundingSphere.center.x === 42));
  for (const mesh of meshes) assert.deepEqual(mesh.instanceMatrix.updateRanges,[{start:0,count:16}]);
});

test('The display submits zero instances outside the range and restores the same logical placements on approach', () => {
  const {lod, meshes, positions} = display([{x:0, z:0}, {x:6, z:0}]);
  lod.update({x:24, z:0});
  assert.deepEqual(positions(), [[], []]);
  lod.update({x:23.99, z:0});
  assert.deepEqual(positions(), [[[6,0,0]], [[6,1,0]]]);
  lod.update({x:0, z:0});
  assert.deepEqual(positions(), [[[0,0,0], [6,0,0]], [[0,1,0], [6,1,0]]]);
  assert.ok(meshes.every(mesh => mesh.boundingSphere.center.x === 3));
  const before = meshes.map(mesh => mesh.instanceMatrix.version);
  lod.update({x:2, z:0});
  assert.deepEqual(meshes.map(mesh => mesh.instanceMatrix.version), before);
  lod.update({x:36, z:0});
  assert.deepEqual(positions(), [[], []]);
});

test('a reserved product stays absent across distance changes and returns to its authored slot', () => {
  const {lod, positions} = display([{x:0, z:0}, {x:6, z:0}, {x:40, z:0, alwaysVisible:true}]);
  const near = {x:0, z:0}, far = {x:40, z:0};
  lod.update(near);
  lod.setReserved(0);
  assert.deepEqual(positions()[0], [[6,0,0], [40,0,0]]);
  lod.update(far);
  lod.update(near);
  assert.deepEqual(positions()[0], [[6,0,0], [40,0,0]]);
  lod.update(far);
  lod.setReserved(-1);
  assert.deepEqual(positions()[0], [[40,0,0]]);
  lod.update(near);
  assert.deepEqual(positions()[0], [[0,0,0], [6,0,0], [40,0,0]]);
});
