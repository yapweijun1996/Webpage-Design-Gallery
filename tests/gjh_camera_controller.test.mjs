import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createPlayer} from '../demos/corporate/gjh/v11/assets/player.js';
import {createSeatAnchor} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {
  chaseDistance, clampCameraPitch, clampZoom, createCameraController, easeCameraValue, firstPersonFov,
  limitCameraByFloor, limitCameraByObstacles, neutralFramingWeight
} from '../demos/corporate/gjh/v11/assets/camera-controller.js';

const radians = degrees => degrees * Math.PI / 180;

test('chase reaches an upward −30° and downward 75° with neutral framing only between the extremes', () => {
  const low = clampCameraPitch(-Math.PI, 'third-person');
  const high = clampCameraPitch(Math.PI, 'third-person');
  assert.equal(low, radians(-30));
  assert.equal(high, radians(75));
  assert.equal(clampCameraPitch(.1, 'third-person'), .1);
  assert.equal(neutralFramingWeight(.1), 1);
  assert.equal(neutralFramingWeight(low), 0);
  assert.equal(neutralFramingWeight(high), 0);
  assert.ok(neutralFramingWeight(-.1) < 1 && neutralFramingWeight(-.1) > 0);
  assert.equal(clampCameraPitch(-Math.PI, 'first-person'), radians(-85));
  assert.equal(clampCameraPitch(Math.PI, 'first-person'), radians(85));
});

test('pitch survives view changes and forced chase without overwriting either requested angle', () => {
  const camera = createCameraController(() => null);
  camera.setPitch(-Math.PI);
  camera.toggle();
  camera.setPitch(Math.PI);
  assert.equal(camera.pitch(), radians(85));
  assert.equal(camera.pitch(true), radians(-30));
  camera.setPitch(Math.PI, true);
  assert.equal(camera.pitch(), radians(85));
  camera.toggle();
  assert.equal(camera.pitch(), radians(75));
});

test('a low arm retracts to keep the camera sphere above the floor or upper-level void', () => {
  const directionY = Math.sin(radians(-30)), radius = .22, gap = .04;
  for (const floor of [0, 7.2]) {
    const originY = floor + 1.24, minimumY = floor + radius + gap;
    const distance = limitCameraByFloor(originY, directionY, 11, minimumY);
    assert.ok(distance > 1.9 && distance < 2);
    assert.ok(Math.abs(originY + distance * directionY - minimumY) < 1e-12);
    assert.equal(limitCameraByFloor(originY, directionY, 1, minimumY), 1);
    assert.equal(limitCameraByFloor(originY, Math.sin(radians(75)), 11, minimumY), 11);
  }
});

test('sweeps stop the sphere short of a ceiling, shop wall, bench and glass railing', () => {
  const box = (x, y, z, w, h, d) => ({
    min: {x, y, z}, max: {x: x + w, y: y + h, z: z + d}
  });
  const ceiling = box(-5, 3.8, -5, 10, .2, 10);
  const shopWall = box(-2, 0, 2.25, 4, 4, .1);
  const bench = box(-1, 0, 1, 2, .9, .5);
  const railing = box(-2, 7.2, 1.5, 4, 1.1, .1);
  const radius = .22;
  for (const [obstacle, origin, direction, distance] of [
    [ceiling, {x:0, y:1.24, z:0}, {x:0, y:1, z:0}, 2.32],
    [shopWall, {x:0, y:1.24, z:0}, {x:0, y:0, z:1}, 2.01],
    [bench, {x:0, y:1.24, z:0}, {x:0, y:-.5, z:Math.sqrt(.75)}, .78 / Math.sqrt(.75) - .02],
    [railing, {x:0, y:7.8, z:0}, {x:0, y:0, z:1}, 1.26]
  ]) {
    assert.ok(Math.abs(limitCameraByObstacles(origin, direction, 5, radius, [obstacle]) - distance) < 1e-12);
    assert.equal(limitCameraByObstacles({...origin, x: 10}, direction, 5, radius, [obstacle]), 5);
  }
});

test('Tripo chase damps toward both pitches, clears the floor and roof, and retains pitch while walking', async t => {
  const noop = () => {};
  const joystick = {width: 75, height: 75, left: 305, right: 380, top: 540, bottom: 615};
  const control = {addEventListener: noop, setAttribute: noop, querySelector: () => control,
    getBoundingClientRect: () => joystick, classList: {remove: noop}, style: {}};
  const keyboard = new Map(), runButtonHandlers = new Map(), runButtonAttributes = new Map();
  const runButton = {...control, addEventListener: (type, handler) => runButtonHandlers.set(type, handler),
    setAttribute: (name, value) => runButtonAttributes.set(name, value)};
  const browserGlobals = {
    document: {addEventListener: (type, handler) => keyboard.set(type, handler), querySelector: selector => selector === '#run-toggle' ? runButton : control},
    window: {addEventListener: noop},
    location: {search: ''},
    matchMedia: () => ({matches: false}),
    self: globalThis,
    createImageBitmap: async () => ({width: 1, height: 1})
  };
  const previous = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, browserGlobals);
  t.after(() => {
    for (const key of Object.keys(browserGlobals)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else delete globalThis[key];
    }
  });
  const fetchAsset = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async input => {
    const path = new URL(input instanceof Request ? input.url : input);
    if (path.protocol !== 'file:') return fetchAsset(input);
    const contentType = path.pathname.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    return new Response(await readFile(path), {headers: {'Content-Type': contentType}});
  });
  await R.init();
  const physics = new R.World({x: 0, y: -9.81, z: 0});
  physics.createCollider(R.ColliderDesc.cuboid(20, .2, 20).setTranslation(0, -.22, 0));
  const pointer = new Map();
  const canvas = {clientWidth: 393, clientHeight: 648, addEventListener: (type, handler) => pointer.set(type, handler),
    setPointerCapture: noop, focus: noop, dataset: {}};
  const obstacles = [], seats = [];
  const player = await createPlayer(T, R, physics, new T.Scene(), canvas, new T.MeshBasicMaterial(),
    new T.PlaneGeometry(), seats, obstacles, true);
  t.after(() => { player.dispose(); physics.free(); });
  assert.equal(player.state.character.model, 'gjh-tripo-visitor');
  const lookPitch = () => -Math.asin(player.camera.getWorldDirection(new T.Vector3()).y);
  const settle = () => { for (let i = 0; i < 90; i++) player.updateCamera(1 / 60); };
  const drag = (pointerType, clientX, fromY, toY) => {
    const start = {pointerType, clientX, pointerId: 1, button: 0, clientY: fromY};
    pointer.get('pointerdown')(start);
    pointer.get('pointermove')({...start, clientY: toY});
    pointer.get('pointerup')({...start, type: 'pointerup', clientY: toY});
  };

  await t.test('the east gallery Map arrivals keep the visitor visible beyond the restroom roof', () => {
    const roof = new T.Box3(new T.Vector3(21, 2.85, 6), new T.Vector3(29, 2.95, 14));
    const hit = new T.Vector3();
    const reach = [];
    for (const number of [12, 13, 14]) {
      assert.ok(player.teleport(`planned-space-${number}`));
      const position = player.camera.position;
      const {x,y,z} = player.state;
      reach.push(Math.hypot(x - position.x, z - position.z));
      for (const height of [.3, .95, 1.55]) {
        const target = new T.Vector3(x, y + height, z);
        const ray = new T.Ray(position, target.clone().sub(position).normalize());
        assert.ok(!ray.intersectBox(roof, hit) || position.distanceTo(hit) > position.distanceTo(target),
          `The restroom roof blocks the visitor at S${number}, height ${height}`);
      }
    }
    assert.ok(Math.max(...reach) - Math.min(...reach) < .1, 'A clear elevated orbit keeps the usual horizontal framing');
    player.teleport('atrium');
  });

  player.resizeCamera(393, 648);
  player.teleport('atrium');
  const neutral = lookPitch();
  drag('touch', 342, 580, 550);
  assert.equal(player.state.pitch, .1);
  drag('touch', 150, 500, 150);
  assert.equal(player.state.pitch, radians(-30));
  player.updateCamera(1 / 60);
  assert.ok(lookPitch() < neutral && lookPitch() > radians(-20));
  settle();
  assert.ok(Math.abs(lookPitch() - radians(-30)) < .005);
  assert.ok(player.camera.position.y >= player.state.cameraObstruction.radius + .039);
  assert.ok(player.state.cameraObstruction.avatarVisible);
  const lowPitch = player.state.pitch;
  player.setInput({forward: 1});
  for (let i = 0; i < 12; i++) {
    player.update(1 / 60);
    physics.step();
    player.updateCamera(1 / 60);
  }
  assert.ok(player.state.z < 11.9);
  assert.equal(player.state.pitch, lowPitch);
  player.teleport('mili');
  assert.equal(player.state.pitch, lowPitch);

  drag('mouse', 150, 150, 500);
  settle();
  assert.ok(Math.abs(lookPitch() - radians(75)) < .005);
  assert.equal(player.state.cameraDistance, 5);
  keyboard.get('keydown')({code: 'PageUp', target: canvas, preventDefault: noop});
  assert.ok(player.state.pitch < radians(75));
  keyboard.get('keydown')({code: 'PageDown', target: canvas, preventDefault: noop});
  obstacles.push({min:{x:-3, y:3.8, z:0}, max:{x:3, y:4, z:5}});
  settle();
  assert.ok(player.camera.position.y <= 3.8 - player.state.cameraObstruction.radius);
  assert.equal(player.state.pitch, radians(75));

  player.body.setTranslation({x:0, y:8.09, z:0}, true);
  player.setInput({pitch: -Math.PI});
  settle();
  assert.ok(player.camera.position.y >= 7.2 + player.state.cameraObstruction.radius + .039);
  assert.ok(Math.abs(lookPitch() - radians(-30)) < .005);

  await t.test('upper lift arrival keeps the chase lens on the directory side of the portal', () => {
    player.body.setTranslation({x:-6.4,y:8.075,z:10},true);
    player.setInput({yaw:Math.PI/2,pitch:.12});
    settle();
    assert(player.camera.position.x < -5-player.state.cameraObstruction.radius);
    assert(player.camera.getWorldDirection(new T.Vector3()).x < 0);
  });

  await t.test('sit, stand and teleport preserve the fixed physics clock', () => {
    const bench = physics.createCollider(R.ColliderDesc.cuboid(1.25,.32,.4).setTranslation(0,.32,0));
    seats.push(createSeatAnchor({id:'test-seat',x:0,z:0,floor:0,exit:{x:0,z:-1.2},
      pose:{angle:0,facing:1},clearance:{interactionRadius:1.65}},bench.handle));
    const position = {x:0,y:.91,z:-1.2};
    player.body.setTranslation(position,true);
    player.body.setNextKinematicTranslation(position);
    physics.step();
    const tick = physics.step.bind(physics);
    const step = t.mock.method(physics, 'step', tick);
    assert(player.sit('test-seat'));
    assert.equal(player.state.capsuleEnabled,false);
    assert.equal(step.mock.callCount(),0);
    for (let i = 0; i < 80; i++) { player.update(1 / 60); physics.step(); }
    assert.equal(player.state.seatPhase,'seated');
    assert(player.stand());
    assert.equal(step.mock.callCount(),80);
    for (let i = 0; i < 55; i++) { player.update(1 / 60); physics.step(); }
    assert.equal(player.state.seated,false);
    assert.equal(player.state.capsuleEnabled,true);
    assert(player.sit('test-seat'));
    assert(player.stand(true));
    assert.equal(player.state.capsuleEnabled,true);
    assert(player.teleport('atrium'));
    assert.equal(step.mock.callCount(),135);
    player.updateCamera(1 / 120, false, .5);
    assert.equal(player.visual.position.z,player.state.z);
  });

  await t.test('joystick full push walks until Run is toggled, then uses touch run speed', () => {
    assert.equal(runButtonAttributes.get('aria-pressed'),'false');
    function fullPush() {
      const point = {pointerType:'touch',clientX:342.5,clientY:577.5,pointerId:1,button:0};
      pointer.get('pointerdown')(point);
      pointer.get('pointermove')({...point,clientY:540});
      for (let i = 0; i < 60; i++) { player.update(1 / 60); physics.step(); }
      const start = player.state.z;
      for (let i = 0; i < 12; i++) { player.update(1 / 60); physics.step(); }
      const speed = (start - player.state.z) * 5;
      pointer.get('pointerup')({...point,type:'pointerup'});
      return speed;
    }
    assert.ok(Math.abs(fullPush() - 3.1) < .02);
    runButtonHandlers.get('click')();
    assert.equal(runButtonAttributes.get('aria-pressed'),'true');
    assert.ok(Math.abs(fullPush() - 4.5) < .02);
  });
});

test('zoom clamps numeric inputs and rejects invalid storage values', () => {
  assert.equal(clampZoom(2), 1);
  assert.equal(clampZoom(-2), -1);
  assert.equal(clampZoom(.35), .35);
  for (const value of [null, undefined, NaN, Infinity, '-.5']) assert.equal(clampZoom(value), 0);
});

test('third-person zoom preserves neutral viewport framing and reaches both limits', () => {
  for (const neutral of [5, 5.2, 5.5, 6.5]) {
    assert.equal(chaseDistance(neutral, 0), neutral);
    assert.equal(chaseDistance(neutral, 2), 1);
    assert.equal(chaseDistance(neutral, -2), 11);
    assert.ok(chaseDistance(neutral, .5) < neutral);
    assert.ok(chaseDistance(neutral, -.5) > neutral);
  }
});

test('first-person zoom maps from a wide 75° to a narrow 40° field of view', () => {
  assert.equal(firstPersonFov(-1), 75);
  assert.equal(firstPersonFov(0), 57.5);
  assert.equal(firstPersonFov(1), 40);
  assert.equal(firstPersonFov(2), 40);
  assert.equal(firstPersonFov(-2), 75);
});

test('zoom easing is monotonic, frame-rate independent and settles exactly', () => {
  const halfway = easeCameraValue(11, 1, 1 / 30);
  const split = easeCameraValue(easeCameraValue(11, 1, 1 / 60), 1, 1 / 60);
  assert.ok(1 < halfway && halfway < 11);
  assert.ok(Math.abs(split - halfway) < 1e-12);
  assert.equal(easeCameraValue(11, 1, 0), 11);
  assert.equal(easeCameraValue(40.00001, 40, 1 / 60), 40);
  assert.equal(easeCameraValue(75, 40, 0, true), 40);
  assert.equal(easeCameraValue(1, 11, 0, true), 11);
});

test('view switching restores independent zoom settings after temporary chase framing', () => {
  const camera = createCameraController(() => null);
  assert.equal(camera.mode(), 'third-person');
  assert.equal(camera.adjust(-.5), true);
  assert.equal(camera.toggle(), true);
  assert.equal(camera.mode(), 'first-person');
  assert.equal(camera.zoom(), 0);
  assert.equal(camera.adjust(.75), true);
  assert.equal(camera.mode(true), 'third-person');
  assert.equal(camera.zoom(true), 0);
  assert.equal(camera.toggle(true), false);
  assert.equal(camera.adjust(-1, true), false);
  assert.equal(camera.mode(), 'first-person');
  assert.equal(camera.zoom(), .75);
  camera.toggle();
  assert.equal(camera.mode(), 'third-person');
  assert.equal(camera.zoom(), -.5);
  camera.toggle();
  assert.equal(camera.zoom(), .75);
});

test('session reload retains both zoom settings and starts in third person', () => {
  const saved = new Map();
  const storage = {getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value)};
  const before = createCameraController(() => storage);
  assert.equal(before.adjust(-10), true);
  assert.equal(before.adjust(-1), false);
  assert.equal(before.adjust(Infinity), false);
  before.toggle();
  before.adjust(.5);
  const after = createCameraController(() => storage);
  assert.equal(after.mode(), 'third-person');
  assert.equal(after.zoom(), -1);
  after.toggle();
  assert.equal(after.zoom(), .5);
});

test('invalid session data falls back independently by view', () => {
  const camera = createCameraController(() => ({getItem: () => '{"chase":"-.5","eye":4}'}));
  assert.equal(camera.zoom(), 0);
  camera.toggle();
  assert.equal(camera.zoom(), 1);
  assert.equal(createCameraController(() => ({getItem: () => '{'})).zoom(), 0);
});
