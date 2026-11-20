import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {prepareChristmasDecor} from '../demos/corporate/gjh/v11/assets/christmas.js';
import {createShopVisibility} from '../demos/corporate/gjh/v11/assets/shop-visibility.js';
import {createProductDisplayLod} from '../demos/corporate/gjh/v11/assets/product-display-lod.js';

function draws(scene) {
  const meshes = [];
  scene.traverseVisible(mesh => {
    if (mesh.isMesh && (!mesh.isInstancedMesh || mesh.count > 0)) meshes.push(mesh);
  });
  return meshes;
}

test('Low Christmas decorations use four draws and restore the desktop scene on tier change', t => {
  globalThis.document = {createElement: () => ({
    getContext: () => ({fillRect() {}, strokeRect() {}, fillText() {}})
  })};
  t.after(() => { delete globalThis.document; });
  const scene = new T.Scene();
  const stage = prepareChristmasDecor(T,scene,{id:'christmas'});
  stage.mount();
  const high = draws(scene);
  assert.equal(high.length,14);
  stage.setTier('low');
  const low = draws(scene);
  assert.equal(low.length,4);
  assert.equal(low.filter(mesh => high.includes(mesh)).length,3,'keep lights, star and banner');
  assert.equal(low[0].parent,stage.group);
  stage.setTier('detailed');
  assert.deepEqual(draws(scene),high);
  stage.dispose();
  assert.equal(draws(scene).length,0);
});

test('Low retains stock near the camera, ground-floor stock and grazing views past roof edges', () => {
  const box = (x,y,z,w,h,d) => new T.Box3().setFromCenterAndSize(new T.Vector3(x,y,z),new T.Vector3(w,h,d));
  const visibility = createShopVisibility(T);
  visibility.addCeiling(1,0,5.8,-5.2,9.7,10.4);
  visibility.setEye(new T.Vector3(0,9,-4));
  const tin = box(0,1,-5,.08,.12,.08);
  const exposed = box(0,1,8,.08,.12,.08);
  assert.equal(visibility.occluded(1,tin),false);
  visibility.setOverheadCulling(true);
  assert.equal(visibility.occluded(1,tin),true);
  assert.equal(visibility.occluded(1,exposed),false);
  visibility.setEye(new T.Vector3(0,2,-4));
  assert.equal(visibility.occluded(1,tin),false);

  const mesh = new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),1);
  const lod = createProductDisplayLod(T,[mesh],[{x:0,z:-5,alwaysVisible:true,smallStock:true,bounds:tin}]);
  const visitor = {x:0,y:7.2,z:5};
  const view = {low:true,deckVisible:true,pixelScale:400,frustum:{intersectsBox:()=>true},eye:new T.Vector3(0,9,5)};
  lod.update(visitor,view);
  assert.equal(mesh.count,0);
  lod.update(visitor,{...view,low:false});
  assert.equal(mesh.count,1);
  lod.update(visitor,{...view,deckVisible:false});
  assert.equal(mesh.count,1);
  lod.update(visitor,{...view,eye:new T.Vector3(0,1,-4)});
  assert.equal(mesh.count,1);
});
