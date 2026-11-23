import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {buildEscalator} from '../demos/corporate/gjh/v11/assets/escalator.js';
import {escalatorLayout as layout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';

function assemble() {
  const scene = new THREE.Scene();
  const fixed = [];
  const glass = [];
  const body = {setTranslation() { return this; }, setRotation() { return this; }};
  const geometry = (_, x, y, z, w, h, d) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const escalator = buildEscalator(THREE, {ColliderDesc:{cuboid:() => body}},
    {createCollider() {}}, scene, fixed, glass, geometry);
  const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  scene.add(...fixed.map(part => new THREE.Mesh(part, material)));
  scene.updateMatrixWorld(true);
  return {scene, escalator, treads:scene.getObjectByName('Ascending escalator treads')};
}

test('every inclined front nosing is visible looking down from the deck and up from the entrance', () => {
  const {scene, treads} = assemble();
  const pitch = (layout.lowerEdge-layout.upperEdge)/layout.stepCount;
  const step = new THREE.Matrix4();
  const color = treads.geometry.getAttribute('color');
  const brass = new THREE.Color(0xe4bc6c);
  const bright = new THREE.Color();
  const target = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  // Bracket the elevated third-person eye and the lower walking approach.
  const eyes = [[.5,10.35], [.75,10.65], [1,10.8], [20.1,1.8]];
  for (const [x,y] of eyes) {
    const eye = new THREE.Vector3(x,y,layout.z);
    let count = 0;
    for (let i=0; i<treads.count; i++) {
      treads.getMatrixAt(i, step);
      target.setFromMatrixPosition(step);
      if (target.x < layout.upperFlat || target.x > layout.lowerFlat) continue;
      target.x += pitch/2-.020;
      target.y += .025;
      ray.set(eye, target.sub(eye).normalize());
      const [hit] = ray.intersectObjects(scene.children, false);
      assert.equal(hit?.object, treads, 'A static surface hides the tread');
      assert.equal(hit.instanceId, i, 'An adjacent tread hides its nosing');
      bright.fromBufferAttribute(color, hit.face.a);
      assert(Math.abs(bright.r-brass.r)<1e-5 && Math.abs(bright.g-brass.g)<1e-5 && Math.abs(bright.b-brass.b)<1e-5,
        'The ray must reach the contrasting edge');
      count++;
    }
    assert.equal(count, 43);
  }
});

test('the single tread draw stops updating when distant or reduced-motion is selected', () => {
  const {escalator, treads} = assemble();
  const near = {x:14,z:9}, far = {x:49,z:30};
  assert.equal(treads.count, 50);
  assert(!Array.isArray(treads.material));
  escalator.advance(.05, false, near);
  const revision = treads.instanceMatrix.version;
  escalator.advance(.05, true, near);
  assert.equal(treads.instanceMatrix.version, revision);
  escalator.advance(.05, false, far);
  assert.equal(treads.visible, false);
  assert.equal(treads.instanceMatrix.version, revision);
  escalator.advance(.05, false, near);
  assert(treads.visible && treads.instanceMatrix.version > revision);
});
