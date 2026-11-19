import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {createLocomotionContinuity, createSelectedVisitor} from '../demos/corporate/gjh/v11/assets/character.js';
import {createCharacterTripo, mapTripoClips, normalizeTripoHeight} from '../demos/corporate/gjh/v11/assets/character-tripo.js';
import {createCharacterV2} from '../demos/corporate/gjh/v11/assets/character-v2.js';
import {playerCameraFraming} from '../demos/corporate/gjh/v11/assets/player.js';
import {createSeatAnchor, createSeatPlacements} from '../demos/corporate/gjh/v11/assets/seat-placements.js';

const names = ['idle', 'walk', 'run', 'wave', 'nod', 'jump', 'dance'];
const hips = {name: 'mixamorigHips', position: new T.Vector3(.02, .37, .08)};
function sourceClips() {
  return names.map(name => new T.AnimationClip(name, 1, [
    new T.VectorKeyframeTrack('mixamorigHips.position', [0, 1], [.02, .37, .08, -.1, .62, 1.1]),
    new T.QuaternionKeyframeTrack('mixamorigHead.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])
  ]));
}

const tripoAssets = new URL('../demos/corporate/gjh/v11/assets/', import.meta.url);

async function withVisitorAssets(run, factory = createCharacterTripo) {
  const files = factory === createCharacterV2 ? ['gjh-mall-visitor-v2.glb', 'gjh-mall-visitor-v2-lod1.glb'] : ['gjh-tripo-visitor.glb', 'gjh-tripo-visitor-lod1.glb'];
  files.push('visitor-carry-hand.glb');
  const data = new Map(await Promise.all(files.map(async file => [file, await readFile(new URL(file, tripoAssets))])));
  const globals = {
    location: {search: ''},
    ProgressEvent: globalThis.ProgressEvent ?? class extends Event {},
    fetch: async url => {
      const file = new URL(url.url ?? url).pathname.split('/').at(-1);
      const bytes = file === 'startup-assets.pack' ? await readFile(new URL(file, tripoAssets)) : data.get(file);
      return bytes ? new Response(bytes) : new Response(null, {status: 404});
    },
    matchMedia: () => ({matches: false}),
    self: globalThis,
    // The actual GLB geometry, rig and tracks are decoded. Node needs only an image placeholder.
    createImageBitmap: async () => ({width: 1, height: 1})
  };
  const original = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  let character;
  try {
    character = await factory(T, createLocomotionContinuity);
    await run(character, data);
  } finally {
    character?.dispose?.();
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

function meshVertices(visual, mesh, visit) {
  visual.updateMatrixWorld(true);
  const vertex = new T.Vector3();
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
    visit(vertex);
  }
}

function parseGLB(bytes) {
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

test('Tripo entrance framing clears the idle visitor at desktop and portrait sizes', async t => {
  await withVisitorAssets(async character => {
    const mesh = character.visual.getObjectByProperty('isSkinnedMesh', true);
    character.visual.position.y = .015;
    for (const [width, height, header, maxHeight] of [[1440, 900, 83, 38], [390, 844, 56, 45]]) {
      const canvasHeight = height - header;
      const framing = playerCameraFraming(character.state.model, true, width, canvasHeight);
      const camera = new T.PerspectiveCamera(framing.fov, width / canvasHeight, .08, 100);
      // At the expanded entrance, the glass wall and its mullion leave 2.5 m behind the visitor.
      const back = Math.min(framing.distance * Math.cos(.1), 2.5);
      const targetY = character.visual.position.y + 1.24;
      camera.position.set(0, targetY + framing.height + back * Math.tan(.1), back);
      camera.lookAt(0, targetY, -framing.lookAhead);
      camera.updateMatrixWorld(true);
      let minY = Infinity, maxY = -Infinity;
      meshVertices(character.visual, mesh, vertex => {
        const {y} = vertex.project(camera);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
      const fraction = (maxY - minY) / 2;
      const percent = fraction * canvasHeight * 100 / height;
      t.diagnostic(`${width}x${height}: ${percent.toFixed(2)}% of viewport height`);
      assert.ok(fraction * 100 <= maxHeight, `projected height ${percent.toFixed(2)}%`);
      assert.ok(minY > -1 && maxY < 0, 'the entire visitor fits below the camera centre');
      const corridor = new T.Vector3(0, 0, -12).project(camera);
      assert.ok(corridor.y > maxY && corridor.y < 1, 'the walkway centre projects above the visitor');
    }
  });
});

test('visitor v2 keeps its existing expanded and classic camera settings', () => {
  for (const [expanded, width, height, fov, distance] of [
    [true, 1440, 817, 58, 5.2], [true, 390, 788, 98.79143857586944, 5],
    [false, 1440, 817, 58, 6.5], [false, 390, 788, 68, 5.5]
  ]) {
    const framing = playerCameraFraming('gjh-mall-visitor-v2', expanded, width, height);
    assert.ok(Math.abs(framing.fov - fov) < 1e-10);
    assert.equal(framing.distance, distance);
    assert.equal(framing.height, 0);
    assert.equal(framing.lookAhead, 0);
  }
});

test('the authored sit reaches a stable seated pose with both boots on the floor', async t => {
  await withVisitorAssets(async character => {
    const {scene: bench} = await parseGLB(await readFile(new URL('gjh-lounge-bench.glb', tripoAssets)));
    bench.scale.y = .8;
    bench.position.z = .23;
    bench.updateMatrixWorld(true);
    const ray = new T.Raycaster(new T.Vector3(0, 2, 0), new T.Vector3(0, -1, 0));
    const panY = ray.intersectObject(bench, true)[0].point.y;
    const mesh = character.visual.getObjectByProperty('isSkinnedMesh', true);
    const hips = mesh.skeleton.bones.find(bone => bone.name.endsWith('Hips'));
    const knee = mesh.skeleton.bones.find(bone => bone.name.endsWith('RightLeg'));
    const hand = mesh.skeleton.bones.find(bone => bone.name.endsWith('RightHand'));
    const point = bone => bone.getWorldPosition(new T.Vector3());
    const upright = point(knee);
    character.visual.position.y = .015; // the existing seat anchor stands 15 mm above the floor
    character.setSeatProgress(.4);
    character.update('idle', 1 / 60);
    const entering = point(hand);
    character.setSeated(true);
    character.update('idle', 1 / 60);
    assert.ok(point(hand).distanceTo(entering) > .02, 'the authored reach should animate');
    assert.ok(point(knee).z < upright.z - .06, 'the knee should be forward of standing');
    const soles = [Infinity, Infinity];
    let deepestContact = 0, closestContact = Infinity;
    meshVertices(character.visual, mesh, vertex => {
      const side = Number(vertex.x >= 0);
      soles[side] = Math.min(soles[side], vertex.y);
      // The seat is supported by clothing at the rounded front of the cushion.
      if (Math.abs(vertex.x) > .27 || vertex.z < -.24 || vertex.z > .1 ||
          vertex.y < .33 || vertex.y > .57) return;
      ray.ray.origin.set(vertex.x, 2, vertex.z);
      const cushionY = ray.intersectObject(bench, true)[0]?.point.y;
      if (!(cushionY > .4)) return;
      const gap = vertex.y - cushionY;
      deepestContact = Math.min(deepestContact, gap);
      closestContact = Math.min(closestContact, Math.abs(gap));
    });
    assert.ok(soles.every(y => Math.abs(y) < .01), `sole heights: ${soles}`);
    assert.ok(closestContact < .006 && deepestContact > -.03, 'the clothing meets the cushion lip');
    t.diagnostic(`pan: ${panY.toFixed(4)} m; pelvis relative to seat anchor: ${point(hips).sub(character.visual.position)
      .toArray().map(value => value.toFixed(4)).join(', ')} m; soles: ${soles.map(y => y.toFixed(4)).join(', ')} m; closest cushion gap: ${closestContact.toFixed(4)} m; maximum penetration: ${(-deepestContact).toFixed(4)} m`);
    const held = point(hand);
    for (let i = 0; i < 300; i++) character.update('idle', 1 / 60);
    assert.ok(point(hand).distanceTo(held) < 1e-5, 'the hold should clamp');
    character.setSeatProgress(.4);
    character.update('idle', 1 / 60);
    assert.ok(point(hand).distanceTo(entering) < .004, 'standing retraces the seated motion');
    character.setSeated(false);
    character.update('idle', 0);
    assert.ok(Math.abs(point(knee).z - upright.z) < .005);
  });
});

test('the runtime seat pose fits the actual visitor to ground and upper benches in both directions', async () => {
  await withVisitorAssets(async character => {
    const skin = character.visual.getObjectByProperty('isSkinnedMesh', true);
    const hips = skin.skeleton.bones.find(bone => bone.name.endsWith('Hips'));
    const foot = skin.skeleton.bones.find(bone => bone.name.endsWith('LeftFoot'));
    const toe = skin.skeleton.bones.find(bone => bone.name.endsWith('LeftToeBase'));
    const placements = createSeatPlacements(true);
    for (const placement of placements) {
      const footY = placement.floor + (placement.group === 'atrium' ? .016 : placement.floor ? 0 : .0245);
      const seat = createSeatAnchor(placement, 1, undefined, undefined, footY);
      character.visual.position.set(seat.x, seat.floor+.015, seat.z);
      character.visual.rotation.y = seat.angle;
      character.setSeated(true);
      character.update('idle', 1/60, 'idle', 1, seat);
      const pelvis = hips.getWorldPosition(new T.Vector3());
      assert.ok(Math.abs(pelvis.x - seat.x) < .01, seat.name);
      assert.ok(pelvis.y > seat.y && pelvis.y < seat.y+.17, seat.name);
      assert.ok((pelvis.z-seat.z)*seat.facing > -seat.frontEdge, seat.name);
      const footForward = toe.getWorldPosition(new T.Vector3()).sub(foot.getWorldPosition(new T.Vector3()));
      assert.ok(footForward.z*seat.facing < -.10, seat.name);
      const soles = [Infinity, Infinity];
      meshVertices(character.visual, skin, vertex => {
        const side = Number(vertex.x >= seat.x);
        soles[side] = Math.min(soles[side], vertex.y);
      });
      assert.ok(soles.every(y => Math.abs(y-footY) < .012), `${seat.name} soles ${soles}`);
    }
    character.setSeated(false);
    character.update('idle', 0);
    const restored = foot.getWorldPosition(new T.Vector3());
    assert.ok(Math.abs(restored.y-character.visual.position.y-.122) < .02);
  });
});

// Use the shipped can and animated skin. The product pivot is at its base.
async function shelfCan(character, knuckle = 'RightHandMiddle1') {
  const {addProducts} = await import('../demos/corporate/gjh/v11/assets/products.js');
  const scene = new T.Scene(), shelf = new T.Group();
  scene.add(character.visual, shelf);
  const display = await addProducts(T, shelf, new Map(), new T.MeshStandardMaterial());
  const id = 'new-moon-nz-425g-front', token = display.reserveProduct(id);
  const {prop, origin} = token;
  // Rotate the owner about the facing's home position to exercise world/local conversion.
  shelf.rotation.y = .6;
  shelf.position.copy(origin).sub(origin.clone().applyQuaternion(shelf.quaternion));
  const home = prop.getWorldPosition(new T.Vector3());
  const center = prop.worldToLocal(new T.Box3().setFromObject(prop).getCenter(new T.Vector3()));
  const releasedAt = new T.Vector3();
  const release = token.release;
  token.release = () => { prop.getWorldPosition(releasedAt); release(); };
  assert.equal(character.pickProduct(token), true);
  for (let frame = 0; frame < 60; frame++) character.update('idle', 1 / 60);
  assert.equal(character.productPhase, 'held');
  const skin = character.visual.getObjectByProperty('isSkinnedMesh', true);
  const bone = suffix => skin.skeleton.bones.find(joint => joint.name.endsWith(suffix));
  const pos = object => object.getWorldPosition(new T.Vector3());
  const palm = () => pos(bone('RightHand')).lerp(pos(bone(knuckle)), .65);
  const canCenter = () => prop.localToWorld(center.clone());
  function checkGrip() {
    const gap = palm().distanceTo(canCenter());
    assert.ok(gap < .065, `can centre is ${gap.toFixed(4)} m from the palm`);
    const up = new T.Vector3(0, 1, 0).applyQuaternion(prop.getWorldQuaternion(new T.Quaternion()));
    assert.ok(up.y > .9999, 'can stays upright');
  }
  return {checkGrip, canCenter, home, releasedAt, id, prop, skin};
}

test('the carried can follows the rendered palm through locomotion, LOD switches and a wave', async () => {
  await withVisitorAssets(async character => {
    const {checkGrip, canCenter, skin, prop} = await shelfCan(character);
    // At the normal rear camera bearing, the can must be visible past the hair and arm.
    const framing = playerCameraFraming(character.state.model, true, 393, 611);
    const rear = new T.Vector3(0, 1.24 + framing.height + framing.distance * Math.sin(.1), framing.distance * Math.cos(.1));
    character.visual.updateMatrixWorld(true);
    skin.computeBoundingSphere();
    const ray = new T.Raycaster(rear, canCenter().sub(rear).normalize());
    assert.ok(prop.children.includes(ray.intersectObjects([skin, prop], true)[0]?.object));
    const camera = new T.PerspectiveCamera();
    camera.position.z = 15;
    character.updateLOD(camera);
    for (let i = 0; i < 100 && !character.state.lod.available; i++) await new Promise(r => setTimeout(r, 10));
    for (const [motion, level] of [['walk', 1], ['run', 0]]) {
      camera.position.z = character.visual.position.z + (level ? 15 : 4);
      character.updateLOD(camera);
      assert.equal(character.state.lod.level, level);
      for (let i = 0; i < 12; i++) {
        character.update(motion, 1 / 60);
        // Player turning and Rapier position sync happen after the character update.
        character.visual.rotation.y += .12;
        character.visual.translateZ(motion === 'run' ? -.125 : -.044);
        checkGrip();
      }
    }
    character.update('idle', .25);
    assert.equal(character.emote('wave'), true);
    const before = canCenter();
    for (let i = 0; i < 50; i++) {
      character.update('idle', 1 / 60);
      checkGrip();
    }
    assert.ok(canCenter().y > before.y + .12, 'the can rose with the waving hand');
  });
});

test('the shipped modular grip and cuff are static closed surfaces within 600 triangles', async () => {
  const {scene, animations} = await parseGLB(await readFile(new URL('visitor-carry-hand.glb', tripoAssets)));
  const meshes = [];
  scene.traverse(node => { if (node.isMesh) meshes.push(node); });
  assert.deepEqual(meshes.map(node => node.name).sort(), ['ChibiGrip', 'SleeveCuff']);
  assert.equal(animations.length, 0);
  let triangles = 0;
  for (const mesh of meshes) {
    assert.ok(!mesh.isSkinnedMesh && !Array.isArray(mesh.material));
    const {geometry} = mesh, {position, normal} = geometry.attributes;
    assert.equal(normal.count, position.count);
    for (let i = 0; i < normal.count; i++) {
      assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(normal, i).length() - 1) < .0001);
    }
    const edges = new Map();
    function vertex(index) {
      return new T.Vector3().fromBufferAttribute(position, geometry.index.getX(index));
    }
    for (let i = 0; i < geometry.index.count; i += 3) {
      const a = vertex(i), b = vertex(i+1), c = vertex(i+2);
      assert.ok(new T.Triangle(a, b, c).getArea() > 1e-12, 'nondegenerate face');
      for (const [v, w] of [[a,b], [b,c], [c,a]]) {
        const key = [v.toArray().join(','), w.toArray().join(',')].sort().join('/');
        edges.set(key, (edges.get(key) || 0) + 1);
      }
      triangles++;
    }
    assert.ok([...edges.values()].every(count => count === 2), mesh.name + ' contains an open or nonmanifold edge');
  }
  assert.ok(triangles > 0 && triangles <= 600, triangles + ' triangles');
});

for (const [model, factory, knuckle] of [
  ['Tripo', createCharacterTripo, 'RightHandMiddle1'], ['v2', createCharacterV2, 'RightFinger1']
]) {
  test(model + ' carries a steady camera-space grip, then restores the physical shelf prop', async () => {
    await withVisitorAssets(async character => {
      const {canCenter, checkGrip, id, prop} = await shelfCan(character, knuckle);
      const root = character.visual.getObjectByName('FirstPersonCarryHand');
      assert.equal(root.visible, false);
      character.setCameraOccluded(true, true);
      for (let i = 0; i < 100 && !root.getObjectByName('ChibiGrip'); i++) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      const skin = root.getObjectByName('ChibiGrip');
      assert.ok(skin && root.visible && root.getObjectById(prop.id) === prop);
      // Compare pads to the actual reserved cylinder in the grip's initial frame.
      const bounds = new T.Box3().setFromObject(prop);
      const centre = bounds.getCenter(new T.Vector3()), radius = bounds.getSize(new T.Vector3()).x / 2;
      const contacts = [];
      meshVertices(character.visual, skin, point => {
        const p = point.clone().sub(centre);
        if (Math.abs(Math.hypot(p.x, p.z) - radius) < .004) contacts.push(p);
      });
      assert.ok(contacts.some(p => p.x > 0 && p.z > radius / 2), 'thumb touches the front');
      const halfHeight = (bounds.max.y - bounds.min.y) / 2;
      const sideRows = contacts.filter(p => p.x < 0 && Math.abs(p.y) < halfHeight)
        .map(p => p.y).sort((a, b) => a - b);
      const separated = [];
      for (const y of sideRows) {
        if (!separated.length || y - separated.at(-1) >= .012) separated.push(y);
      }
      assert.ok(separated.length >= 4, 'four separated finger pads contact the barrel');
      const visible = [];
      character.visual.traverseVisible(n => { if (n.isSkinnedMesh) visible.push(n); });
      assert.equal(visible.length, 0);
      if (model === 'v2') {
        character.customize({skin:'dark', outfit:'hoodie'});
        assert.equal(skin.material.color.getHex(), 0x75472f);
        const hoodie = character.visual.getObjectByName('V2_outfit_alt_Hoodie_slate');
        assert.ok(root.getObjectByName('SleeveCuff').material.color.equals(hoodie.material.color));
      }
      const camera = new T.PerspectiveCamera(57.5, 1, .08, 100);
      for (const [width, height] of [[393,700], [1440,900]]) {
        camera.aspect = width / height;
        for (const fov of [40, 57.5, 75]) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
          let previous;
          for (const [motion, pitch] of [['idle', .1], ['walk', -.9], ['run', 1.35]]) {
            character.update(motion, 1 / 60);
            character.visual.translateZ(-.12);
            character.visual.rotation.y += .38;
            camera.position.copy(character.visual.position);
            camera.position.y += 1.55;
            camera.rotation.set(pitch, .7 + pitch, 0, 'YXZ');
            character.frameCarry(camera);
            character.visual.updateMatrixWorld(true);
            const projected = canCenter().project(camera);
            assert.ok(projected.x > 1/3 && projected.x < .9 && projected.y < -1/3 && projected.y > -.85);
            if (previous) assert.ok(projected.distanceTo(previous) < 1e-8, 'walking or looking moved the grip');
            previous = projected;
            const orientation = prop.getWorldQuaternion(new T.Quaternion()).premultiply(camera.quaternion.clone().invert());
            assert.ok(new T.Vector3(0,1,0).applyQuaternion(orientation).y > .99999);
            root.traverse(n => {
              if (!n.isMesh) return;
              const point = new T.Vector3();
              for (let i = 0; i < n.geometry.attributes.position.count; i++) {
                n.localToWorld(n.getVertexPosition(i, point));
                assert.ok(camera.worldToLocal(point).z < -camera.near, n.name + ' crossed the near plane');
              }
            });
          }
        }
      }
      character.setCameraOccluded(false, false);
      assert.equal(root.visible, false);
      checkGrip();
      character.setCameraOccluded(true, true);
      character.frameCarry(camera);
      assert.equal(character.bagProduct(id, false), true);
      character.update('idle', .28);
      assert.ok(root.visible && prop.scale.x < 1);
      character.update('idle', .2);
      assert.equal(character.productPhase, 'empty');
      assert.equal(prop.parent, null);
      assert.equal(root.visible, false);
    }, factory);
  });
}

test('return reaches with the can and releases at the original shelf position', async () => {
  await withVisitorAssets(async character => {
    character.visual.position.set(-13.42, .035, -8.635);
    const {checkGrip, releasedAt, home} = await shelfCan(character);
    assert.equal(character.returnProduct(), true);
    for (let i = 0; i < 25; i++) {
      character.update('idle', 1 / 60);
      checkGrip();
    }
    for (let i = 0; i < 32; i++) character.update('idle', 1 / 60);
    assert.equal(character.productPhase, 'empty');
    assert.ok(releasedAt.distanceTo(home) < 1e-6);
  });
});

test('the real animation-free LOD1 follows the LOD0 skeleton and switches back', async () => {
  await withVisitorAssets(async (character, data) => {
    const mesh = character.visual.getObjectByProperty('isSkinnedMesh', true);
    const skeleton = mesh.skeleton, highGeometry = mesh.geometry, highMaterial = mesh.material;
    const {scene, animations} = await parseGLB(data.get('gjh-tripo-visitor-lod1.glb'));
    const low = scene.getObjectByProperty('isSkinnedMesh', true);
    assert.equal(animations.length, 0);
    const boneNames = rig => rig.bones.map(bone => bone.name).sort();
    assert.deepEqual(boneNames(low.skeleton), boneNames(skeleton));

    const camera = new T.PerspectiveCamera();
    camera.position.z = 12;
    character.updateLOD(camera);
    for (let i = 0; i < 100 && !character.state.lod.available && !character.state.lod.failed; i++)
      await new Promise(resolve => setTimeout(resolve, 10));
    character.updateLOD(camera);
    assert.equal(character.state.lod.level, 1);
    assert.equal(mesh.geometry.attributes.position.count, low.geometry.attributes.position.count);
    assert.notEqual(mesh.geometry, highGeometry);
    assert.notEqual(mesh.material, highMaterial);
    assert.equal(mesh.skeleton, skeleton);
    assert.equal(mesh.material.customProgramCacheKey(), 'gjh-tripo-portrait-v1');
    assert.equal(mesh.material.customProgramCacheKey(), highMaterial.customProgramCacheKey());
    // Same camera distance, two CSS heights. Only the smaller projection drops detail.
    character.updateLOD(camera, 1600);
    assert.equal(character.state.lod.level, 0);
    character.updateLOD(camera, 300);
    assert.equal(character.state.lod.level, 1);
    const knee = skeleton.bones.find(bone => bone.name.endsWith('LeftLeg'));
    const upright = knee.quaternion.clone();
    for (let i = 0; i < 30; i++) character.update('walk', 1 / 60);
    assert.ok(knee.quaternion.angleTo(upright) > .1, 'the LOD0 mixer animates LOD1');
    const walkPose = knee.quaternion.clone();

    camera.position.z = 10;
    character.updateLOD(camera);
    assert.equal(character.state.lod.level, 1, 'retain LOD1 within the hysteresis band');
    camera.position.z = 8;
    character.updateLOD(camera);
    assert.equal(character.state.lod.level, 0);
    assert.equal(mesh.geometry, highGeometry);
    assert.equal(mesh.material, highMaterial);
    assert.equal(mesh.skeleton, skeleton);
    assert.deepEqual(knee.quaternion.toArray(), walkPose.toArray());
    low.geometry.dispose();
    low.material.map.dispose();
    low.material.dispose();
    low.skeleton.dispose();
  });
});

test('a manual emote can queue while the camera-facing arrival wave plays', async () => {
  await withVisitorAssets(async character => {
    const placement = character.visual.children[0];
    const mesh = character.visual.getObjectByProperty('isSkinnedMesh', true);
    const hand = mesh.skeleton.bones.find(bone => bone.name.endsWith('RightHand'));
    const arm = mesh.skeleton.bones.find(bone => bone.name.endsWith('RightArm'));
    assert.equal(character.emote('wave', {arrival: true}), true);
    assert.equal(character.emote('nod'), true);
    assert.equal(character.emote('dance'), false);
    for (let i = 0; i < 60; i++) character.update('idle', 1 / 60);
    assert.equal(character.state.emote, 'wave');
    assert.ok(Math.cos(placement.rotation.y) > .99, 'the arrival wave should face the rear camera');
    assert.ok(hand.getWorldPosition(new T.Vector3()).y - arm.getWorldPosition(new T.Vector3()).y > .1);
    for (let i = 0; i < 105; i++) character.update('idle', 1 / 60);
    assert.equal(character.state.emote, 'nod');
    assert.equal(placement.rotation.y, Math.PI);
    character.update('walk', 1 / 60);
    assert.equal(character.state.emote, null);
  });
});

test('Tripo maps the engine run state to sprint and preserves vertical motion', () => {
  const raw = sourceClips(), clips = mapTripoClips(T, raw, hips);
  assert.deepEqual(Object.keys(clips), names);
  assert.deepEqual(Object.values(clips).map(clip => clip.name),
    ['idle', 'walk', 'sprint', 'wave', 'nod', 'jump', 'dance']);
  const source = raw[1].tracks[0].values;
  const walk = clips.walk.tracks[0].values;
  assert.equal(walk[0], walk[3]);
  assert.equal(walk[2], walk[5]);
  assert.equal(walk[4], source[4]);
  assert.notEqual(source[2], source[5]);
});

test('Tripo normalization puts the feet at zero and the top at 1.7 metres', () => {
  for (const [min, max] of [[0, .98], [-.02, .96], [.03, 1.01]]) {
    const {nativeHeight, scale, floorOffset} = normalizeTripoHeight(min, max);
    assert.ok(Math.abs(nativeHeight - .98) < 1e-8);
    assert.ok(Math.abs(min * scale + floorOffset) < 1e-8);
    assert.ok(Math.abs(max * scale + floorOffset - 1.7) < 1e-8);
  }
  for (const max of [0, -1, NaN, Infinity]) assert.throws(() => normalizeTripoHeight(0, max));
});

test('visitor selection tries Tripo by default and preserves explicit V1 and V2', async () => {
  const calls = [];
  const factories = Object.fromEntries(['v1', 'v2', 'tripo'].map(name => [name, () => {
    calls.push(name);
    return name;
  }]));
  assert.equal(await createSelectedVisitor(null, factories), 'tripo');
  assert.equal(await createSelectedVisitor('v1', factories), 'v1');
  assert.equal(await createSelectedVisitor('v2', factories), 'v2');
  assert.deepEqual(calls, ['tripo', 'v1', 'v2']);
});

test('missing/empty clips and failed Tripo requests select V2', async () => {
  const missing = sourceClips().slice(0, -1);
  const empty = sourceClips();
  empty[2].tracks.length = 0;
  assert.throws(() => mapTripoClips(T, missing, hips), /dance/);
  assert.throws(() => mapTripoClips(T, empty, hips), /run/);
  for (const tripo of [async () => { throw new Error('HTTP 404'); },
    () => mapTripoClips(T, missing, hips), () => mapTripoClips(T, empty, hips)]) {
    const result = await createSelectedVisitor(null, {tripo, v2: () => 'v2', v1: () => assert.fail()});
    assert.equal(result, 'v2');
  }
});

test('procedural sitting restores constant mixer samples on standing', async () => {
  const root = new T.Group(), joints = [];
  function bone(name, parent, x, y, z) {
    const joint = new T.Bone();
    joint.name = 'mixamorig' + name;
    joint.position.set(x, y, z);
    parent.add(joint);
    joints.push(joint);
    return joint;
  }
  const pelvis = bone('Hips', root, .02, .37, .08);
  bone('Head', pelvis, 0, .38, 0);
  for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
    const thigh = bone(side + 'UpLeg', pelvis, sign * .06, -.02, 0);
    const shin = bone(side + 'Leg', thigh, 0, -.12, 0);
    bone(side + 'Foot', shin, 0, -.15, 0);
    const upper = bone(side + 'Arm', pelvis, sign * .08, .17, -.02);
    const lower = bone(side + 'ForeArm', upper, sign * .03, -.10, 0);
    const wrist = bone(side + 'Hand', lower, sign * .04, -.10, .03);
    bone(side + 'HandMiddle1', wrist, 0, -.045, 0);
  }
  const geometry = new T.BoxGeometry(.4, .98, .3).translate(0, .49, 0);
  const vertices = geometry.attributes.position.count;
  const indices = new Uint16Array(vertices * 4), weights = new Float32Array(vertices * 4);
  for (let i = 0; i < vertices; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinIndex', new T.BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new T.BufferAttribute(weights, 4));
  const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial({map: new T.Texture()}));
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(joints));
  const clips = sourceClips();
  clips[0].tracks[0].values.set([.02, .37, .08, .02, .37, .08]);

  const previousFetch = globalThis.fetch, previousMotion = globalThis.matchMedia;
  const previousParse = GLTFLoader.prototype.parseAsync;
  globalThis.fetch = async url => new Response(new Uint8Array(1),
    {status: url.pathname.endsWith('/gjh-tripo-visitor.glb') ? 200 : 404});
  globalThis.matchMedia = () => ({matches: true});
  GLTFLoader.prototype.parseAsync = async () => ({scene: root, animations: clips});
  let character;
  try {
    character = await createCharacterTripo(T, createLocomotionContinuity);
    assert.equal(character.state.model, 'gjh-tripo-visitor');
    assert.equal(character.emote('wave'), false);
    const standingHeight = pelvis.getWorldPosition(new T.Vector3()).y;
    character.setSeated(true);
    character.update('idle', 0);
    assert.ok(standingHeight - pelvis.getWorldPosition(new T.Vector3()).y > .1);
    character.update('idle', 1 / 60);
    assert.ok(Math.abs(pelvis.getWorldPosition(new T.Vector3()).y - .49) < 1e-6);
    character.setSeated(false);
    character.update('idle', 0);
    assert.ok(Math.abs(pelvis.getWorldPosition(new T.Vector3()).y - standingHeight) < 1e-6);
    assert.equal(character.setCart(true), false);
  } finally {
    character?.dispose();
    globalThis.fetch = previousFetch;
    if (previousMotion) globalThis.matchMedia = previousMotion;
    else delete globalThis.matchMedia;
    GLTFLoader.prototype.parseAsync = previousParse;
  }
});
