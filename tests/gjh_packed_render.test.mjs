import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {mergeStaticGeometries} from '../demos/corporate/gjh/v11/assets/merge-static-geometries.js';
import {boxFrontFaces, createPackedDraw, createInstanceVisibility, createProjectedBatch, distantDetail, projectedError} from '../demos/corporate/gjh/v11/assets/packed-draw.js';
import {canDetail, makeCanLods, createCanDisplay} from '../demos/corporate/gjh/v11/assets/product-display-lod.js';
import {simplifyBench} from '../demos/corporate/gjh/v11/assets/furnishings.js';

function cameraView(x = 0, aspect = 1, height = 700) {
  const camera = new T.PerspectiveCamera(64, aspect, .1, 200);
  camera.position.x = x;
  camera.updateMatrixWorld();
  return {
    camera, eye:camera.position, pixelScale:height * camera.projectionMatrix.elements[5] / 2,
    frustum:new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  };
}

function modelParts(name) {
  const file = readFileSync(new URL('../demos/corporate/gjh/v11/assets/'+name+'.glb', import.meta.url));
  const headerSize = file.readUInt32LE(12), json = JSON.parse(file.toString('utf8', 20, 20 + headerSize));
  const data = file.subarray(28 + headerSize);
  function attribute(i) {
    const {bufferView, byteOffset = 0, count, componentType, type} = json.accessors[i];
    const view = json.bufferViews[bufferView], offset = (view.byteOffset ?? 0) + byteOffset;
    const Typed = {5121:Uint8Array, 5123:Uint16Array, 5125:Uint32Array, 5126:Float32Array}[componentType];
    const components = {SCALAR:1, VEC2:2, VEC3:3}[type];
    const length = count * components * Typed.BYTES_PER_ELEMENT;
    assert.ok(!view.byteStride || view.byteStride === components * Typed.BYTES_PER_ELEMENT);
    return new T.BufferAttribute(new Typed(Uint8Array.from(data.subarray(offset, offset + length)).buffer), components);
  }
  return json.meshes.flatMap(mesh => mesh.primitives.map(primitive => {
    const geometry = new T.BufferGeometry();
    geometry.setIndex(attribute(primitive.indices));
    for (const [key, value] of Object.entries(primitive.attributes))
      geometry.setAttribute({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}[key], attribute(value));
    const surface = json.materials[primitive.material], pbr = surface.pbrMetallicRoughness;
    const material = new T.MeshStandardMaterial({name:surface.name, map:pbr.baseColorTexture ? new T.Texture() : null,
      color:new T.Color().fromArray(pbr.baseColorFactor ?? [1,1,1]),
      metalness:pbr.metallicFactor, roughness:pbr.roughnessFactor});
    return {geometry, material, matrix:new T.Matrix4()};
  }));
}

test('static merging keeps normalized interleaved values and offsets wide indices', () => {
  const makeGeometry = (count, colour) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(count * 3), 3));
    const array = new Uint8Array(count * 4);
    array.set([255, ...colour], (count - 1) * 4);
    geometry.setAttribute('color', new T.InterleavedBufferAttribute(new T.InterleavedBuffer(array, 4), 3, 1, true));
    geometry.setIndex([0, 1, count - 1]);
    return geometry;
  };
  const first = makeGeometry(65533, [1, 2, 3]);
  const second = makeGeometry(3, [4, 5, 6]);
  const merged = mergeStaticGeometries(T, [first, second]);
  assert.ok(merged.index.array instanceof Uint32Array);
  assert.deepEqual([...merged.index.array], [0, 1, 65532, 65533, 65534, 65535]);
  assert.equal(merged.attributes.color.normalized, true);
  assert.deepEqual([...merged.attributes.color.array.subarray(65532 * 3)], [1, 2, 3, 0, 0, 0, 0, 0, 0, 4, 5, 6]);
  second.deleteAttribute('color');
  assert.equal(mergeStaticGeometries(T, [first, second]), null);
});

test('instance culling packs matching transforms, finishes and refreshes bounds as the camera turns', () => {
  const mesh = new T.InstancedMesh(new T.BoxGeometry(), new T.MeshStandardMaterial(), 4);
  const colours = [0xff0000,0x00ff00,0x0000ff,0x555555].map(rgb => new T.Color(rgb));
  const surface = new T.InstancedBufferAttribute(new Float32Array([1,2,3,4]),1);
  [18,-1,1,0].forEach((x,i) => {
    mesh.setMatrixAt(i,new T.Matrix4().makeTranslation(x,0,i === 3 ? 5 : -5));
    mesh.setColorAt(i,colours[i]);
  });
  const compact = createInstanceVisibility(T, mesh, {colours, slots:[1,null,2,null], attributes:[surface]});
  const view = cameraView();
  compact.update(view.frustum, slot => slot !== 2);
  assert.equal(mesh.count, 1);
  assert.equal(mesh.boundingSphere.center.x, -1);
  assert.equal(surface.getX(0), 2);
  assert.equal(mesh.instanceColor.getY(0), 1);
  const version = mesh.instanceMatrix.version;
  compact.update(view.frustum, slot => slot !== 2);
  assert.equal(mesh.instanceMatrix.version, version);
  colours[1].set(0xffffff);
  compact.refreshColours();
  assert.equal(mesh.instanceColor.getX(0), 1);
  compact.update(cameraView(100).frustum);
  assert.equal(mesh.count, 0);
  assert.ok(mesh.boundingBox.isEmpty());
  compact.update(cameraView(18).frustum);
  assert.equal(mesh.count, 1);
  assert.equal(mesh.boundingSphere.center.x, 18);
  assert.equal(surface.getX(0), 1);
});

test('indexed parts keep one draw, update active bounds and only upload after membership changes', () => {
  const parts = [0,5].map(x => {
    const geom = new T.BoxGeometry().translate(x,0,-5);
    const low = new T.PlaneGeometry().translate(x,0,-5);
    geom.computeBoundingBox();
    return {geometries:[geom,low], bounds:geom.boundingBox};
  });
  const {mesh,update} = createPackedDraw(T,parts,new T.MeshStandardMaterial());
  mesh.layers.enable(1);
  update((_,i) => i === 0 ? 0 : 1);
  assert.equal(mesh.geometry.drawRange.count / 3,14);
  const version = mesh.geometry.index.version;
  update((_,i) => i === 0 ? 0 : 1);
  assert.equal(mesh.geometry.index.version,version);
  update((_,i) => i === 0 ? -1 : 1);
  assert.equal(mesh.geometry.boundingSphere.center.x,5);
  assert.equal(mesh.geometry.drawRange.count / 3,2);
  update(() => -1);
  assert.equal(mesh.visible,false);
  update(() => 0);
  assert.equal(mesh.geometry.drawRange.count / 3,24);
  assert.equal(mesh.layers.mask,3);
});

test('the exact cans retain UVs and materials while distant variants submit at most 400 triangles', () => {
  for (const sku of ['nz-425g','au-425g','sa-425g','mx-454g']) {
    const parts = modelParts('new-moon-can-'+sku+'-lod1');
    const counts = [0,0,0];
    for (const part of parts) {
      const levels = makeCanLods(T, part);
      assert.equal(levels[0],part.geometry);
      if (part.material.map) {
        assert.equal(levels[1],part.geometry);
        assert.deepEqual(levels[2].attributes.uv.array,part.geometry.attributes.uv.array);
      }
      levels.forEach((geometry,i) => { counts[i] += geometry.index.count / 3; });
    }
    assert.equal(counts[0],3044);
    assert.ok(counts[1] < 1500, counts);
    assert.ok(counts[2] <= 400, counts);
  }
  assert.equal(canDetail(0,3.3),0);
  assert.equal(canDetail(1,3.3),1);
  assert.equal(canDetail(1,6.2),1);
  assert.equal(canDetail(2,6.2),2);
  assert.equal(canDetail(2,5.5),1);
  assert.equal(canDetail(2,8,true),0);
});

test('metal finishes merge across SKUs and reservations survive culling, warm layers and LOD changes', () => {
  const scene = new T.Scene();
  const makeSlot = (x,z) => ({x,y:0,z,bounds:new T.Box3(),alwaysVisible:false,visible:true,detail:0});
  const first = makeSlot(0,-2), second = makeSlot(0,-8);
  const display = createCanDisplay(T,scene,[
    {primitives:modelParts('new-moon-can-nz-425g-lod1'), placements:[first]},
    {primitives:modelParts('new-moon-can-au-425g-lod1'), placements:[second]}
  ]);
  assert.equal(scene.children.length,4);
  const total = () => scene.children.reduce((sum,mesh) => sum + mesh.geometry.drawRange.count / 3,0);
  const visitor = {x:0,y:0,z:0}, view = cameraView();
  for (const mesh of scene.children) mesh.layers.mask = 0;
  display.update(visitor,view);
  assert.equal(total(),3044+360);
  assert.ok(scene.children.every(mesh => mesh.layers.mask === 0));
  display.reserve(first,true);
  assert.equal(total(),360);
  display.update(visitor,cameraView(100));
  assert.equal(total(),0);
  display.update(visitor,view);
  assert.equal(total(),360);
  display.reserve(first,false);
  assert.equal(total(),3044+360);
  assert.ok(first.bounds.containsPoint(new T.Vector3(0,.1,-2)));
});

test('projected primitives keep near geometry and hysteresis without a second draw', () => {
  const mesh = new T.InstancedMesh(new T.CylinderGeometry(1,1,1,32), new T.MeshStandardMaterial(), 2);
  mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,0,-2));
  mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(0,0,-100));
  const batch = createProjectedBatch(T, mesh, new T.CylinderGeometry(1,1,1,12), () => .03);
  batch.update(cameraView());
  assert.equal(batch.mesh.geometry.drawRange.count / 3,128+48);
  assert.equal(distantDetail(false,.28),false);
  assert.equal(distantDetail(true,.28),true);
  assert.equal(distantDetail(true,.32),false);
  const sphere = new T.Sphere(new T.Vector3(0,0,1),1);
  assert.equal(projectedError(cameraView(),sphere,.01),Infinity);
});

test('bench simplification removes authored triangles with a bounded vertex displacement', t => {
  let before = 0, after = 0, maxError = 0;
  for (const {geometry} of modelParts('gjh-lounge-bench')) {
    const simplified = simplifyBench(T,geometry);
    before += geometry.index.count / 3;
    after += simplified.geometry.index.count / 3;
    maxError = Math.max(maxError,simplified.error);
    assert.ok(simplified.error <= Math.sqrt(3)*.012);
  }
  assert.equal(before,5640);
  assert.ok(after < before*.85,after);
  t.diagnostic(`Original ${before} tris, distant ${after} tris, max displacement ${maxError.toFixed(3)} m`);
});

test('convex doors select the entry faces independently of which side the camera is on', () => {
  const centre = new T.Vector3(4,2,5), size = new T.Vector3(2,4,.06);
  assert.equal(boxFrontFaces(new T.Vector3(4,2,6),centre,size),16);
  assert.equal(boxFrontFaces(new T.Vector3(6,9,4),centre,size),1|4|32);
  assert.equal(boxFrontFaces(new T.Vector3(1,2,5),centre,size),2);
  assert.equal(boxFrontFaces(centre,centre,size),0);
});
