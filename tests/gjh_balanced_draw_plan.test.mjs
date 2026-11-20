import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {addExpandedStorefronts} from '../demos/corporate/gjh/v11/assets/expanded-storefronts.js';
import {expandedLayout, shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';

test('Balanced facades submit two batches and keep all sliding leaf transforms and finishes', () => {
  const scene = new T.Scene();
  const signs = new Map(expandedLayout.slots.map(bay => ['S'+bay.number,{palette:{accent:'#e6d7c1'}}]));
  const slide = addExpandedStorefronts(T,expandedLayout,scene,signs);
  assert.deepEqual(scene.children.map(mesh => mesh.name),['Expanded storefront glass','Expanded storefront trim']);

  const [glass,trim] = scene.children;
  const surfaces = trim.geometry.getAttribute('instanceSurface');
  const tint = new T.Color();
  const matrix = new T.Matrix4();
  const finishes = new Set();
  for (let i = 0; i < trim.count; i++) {
    trim.getColorAt(i,tint);
    finishes.add([tint.getHexString(),surfaces.getX(i).toFixed(2),surfaces.getY(i).toFixed(2)].join('/'));
  }
  assert.deepEqual([...finishes].sort(), ['102a22/0.29/0.16','92806a/0.58/0.00','c9a55e/0.28/0.78','e6d7c1/0.58/0.00']);

  const closed = scene.children.map(mesh => mesh.instanceMatrix.array.slice());
  const {alongX, alongZ} = shopEntrance(expandedLayout.slots[3]);
  slide('04',1.3);
  for (const [batch,expected] of [[glass,2],[trim,6]]) {
    const source = closed[scene.children.indexOf(batch)];
    let moved = 0;
    for (let i=0;i<batch.count;i++) {
      batch.getMatrixAt(i,matrix);
      const before = source.subarray(i*16,(i+1)*16);
      const delta = new T.Vector3(matrix.elements[12]-before[12],0,matrix.elements[14]-before[14]);
      if (delta.length() < 1e-6) continue;
      moved++;
      assert.ok(Math.abs(Math.abs(delta.dot(new T.Vector3(alongX,0,alongZ)))-1.3)<.00001);
    }
    assert.equal(moved,expected);
  }
  slide('04',0);
  for (const [i,batch] of scene.children.entries()) assert.deepEqual(batch.instanceMatrix.array,closed[i]);
});
