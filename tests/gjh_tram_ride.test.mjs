import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createInteractionRegistry} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';
import {chaseDistance, tramRoute, seatEyeHeight} from '../demos/corporate/gjh/v11/assets/tram-layout.js';
import {
  atTramLanding, createTramRide, tramBoardReason, tramCaptionIndex, tramCaptions, tramEnabled, tramLanding, tramTrackBlocked
} from '../demos/corporate/gjh/v11/assets/tram-ride.js';

const near = (actual, expected, tolerance = 1e-5) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);

test('captions follow all 17 surveyed shop positions and use the programme copy', async () => {
  const program = JSON.parse(await readFile(new URL('../docs/gjh-v11-interior-program.json', import.meta.url)));
  assert.deepEqual(tramCaptions.map(card => card.id), [
    'S11','S10','S09','S08','S07','S06','S01','S02','S03','S04','S05','S12','S13','S14','S15','S16','S17'
  ]);
  const report = await readFile(new URL('../docs/gjh-v11-tram-route-report.md', import.meta.url), 'utf8');
  const distances = new Map([...report.matchAll(/^\| (S\d\d) \| ([\d.]+) \|/gm)]
    .map(([, id, distance]) => [id, Number(distance)]));
  tramCaptions.forEach((card, i) => {
    const store = program.stores.find(store => store.id === card.id);
    assert.equal(card.name, store.brand);
    assert.equal(card.feature, store.concept);
    assert.equal(card.direction, 'On your left');
    assert.equal(card.distance, distances.get(card.id));
    assert.equal(tramCaptionIndex(card.distance - .001), i - 1);
    assert.equal(tramCaptionIndex(card.distance), i);
    assert.equal(tramCaptionIndex(card.distance + .001), i);
  });
  assert.equal(tramCaptionIndex(-1), -1);
  assert.equal(tramCaptionIndex(0), -1);
  assert.equal(tramCaptionIndex(tramRoute.length - .001), 16);
  assert.equal(tramCaptionIndex(tramRoute.length), -1);
});

test('single-station ride boards after docking, pauses, skips a caption and returns before exiting', () => {
  let blocked = true, boardClear = false, exitClear = false;
  let enters = 0, exits = 0;
  const ride = createTramRide({
    blocked: () => blocked, canBoard: () => boardClear, canExit: () => exitClear,
    onBoard: () => enters++, onExit: () => exits++
  });
  assert.equal(ride.end(), false);
  assert.equal(ride.board(), true);
  assert.equal(ride.board(), false);
  ride.step(1);
  assert.equal(ride.state.blocked, true);
  assert.equal(ride.distance, -3);
  blocked = false;
  ride.step(2);
  ride.step(1);
  assert.equal(ride.state.phase, 'boarding');
  assert.equal(enters, 0);
  assert.equal(ride.end(), true);
  assert.equal(ride.state.phase, 'idle');
  ride.board();
  ride.step(2);
  boardClear = true;
  ride.step(1);
  assert.equal(enters, 1);
  assert.equal(ride.state.phase, 'ride');
  ride.step(tramCaptions[0].distance / 1.5 + .001);
  assert.equal(ride.state.caption, 0);
  assert.equal(ride.togglePause(), true);
  const distance = ride.distance;
  ride.step(10);
  assert.equal(ride.distance, distance);
  assert.equal(ride.skipShop(), true);
  assert.equal(ride.skipShop(), false);
  assert.equal(ride.state.caption, -1);
  assert.equal(ride.distance, distance);
  ride.togglePause();
  blocked = true;
  ride.step(1);
  assert.equal(ride.state.blocked, true);
  assert.equal(ride.distance, distance);
  blocked = false;
  ride.step(4);
  assert.equal(ride.state.caption, 1);
  near(ride.distance - distance, 6);
  assert.equal(ride.state.blocked, false);
  ride.togglePause();
  assert.equal(ride.end(), true);
  assert.equal(ride.togglePause(), false);
  assert.equal(ride.state.ending, true);
  assert.equal(exits, 0);
  ride.step(tramRoute.length / 1.5);
  assert.equal(ride.state.phase, 'arrival');
  assert.equal(ride.distance, tramRoute.length);
  ride.step(.4);
  assert.equal(ride.state.blocked, false);
  ride.step(.5);
  assert.equal(ride.state.blocked, true);
  assert.equal(ride.seated, true);
  assert.equal(exits, 0);
  exitClear = true;
  ride.step(.1);
  assert.equal(ride.state.phase, 'idle');
  assert.equal(exits, 1);
  assert.equal(ride.board(), true);
});

test('feature gating and blocking checks distinguish landing, track, and upper-floor visitors', () => {
  assert.deepEqual([tramLanding.x, tramLanding.z], [10,39]);
  assert.equal(atTramLanding({x:10,z:39}), true);
  assert.equal(atTramLanding({x:10,z:40}), false);
  assert.equal(tramEnabled(true, ''), false);
  assert.equal(tramEnabled(true, '?tram=debug'), false);
  assert.equal(tramEnabled(false, '?tram=1'), false);
  assert.equal(tramEnabled(true, '?tram=1'), true);
  assert.match(tramBoardReason({pushing:true}), /cart/);
  assert.match(tramBoardReason({character:{physicalProduct:{phase:'held'}}}), /held product/);
  assert.equal(tramBoardReason({character:{physicalProduct:{phase:'empty'}}}), '');
  const scene = new T.Scene(), npc = new T.Group();
  npc.layers.set(2);
  scene.add(npc);
  npc.position.set(8, 0, 40.5);
  assert.equal(tramTrackBlocked(scene, null, 0, .35), true);
  npc.position.y = 7.2;
  assert.equal(tramTrackBlocked(scene, null, 0, .35), false);
  npc.position.set(tramLanding.x, 0, tramLanding.z);
  assert.equal(tramTrackBlocked(scene, null, 0, .35), false);
  assert.equal(tramTrackBlocked(scene, {x:8, y:.89, z:40.5}, 0, .35), true);
});

function stubDocument() {
  const noop = () => {};
  const listeners = new Map();
  const makeNode = () => ({
    children:[], style:{}, dataset:{}, classList:{remove:noop}, attributes:{},
    append(...children) { this.children.push(...children); },
    contains(node) { return this === node || this.children.some(child => child.contains(node)); },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { document.activeElement = this; },
    addEventListener:noop
  });
  const body = makeNode();
  const controls = new Map();
  function querySelector(selector) {
    if (!controls.has(selector)) controls.set(selector, {...makeNode(), querySelector:makeNode});
    return controls.get(selector);
  }
  return {
    body, createElement:makeNode, querySelector,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    key(code, target) {
      const event = {code, target, defaultPrevented:false, preventDefault() { this.defaultPrevented = true; }};
      for (const handler of listeners.get('keydown') ?? []) handler(event);
      return event.defaultPrevented;
    }
  };
}

test('no-browser smoke tests the bundled player, station registry and ride HUD with the flag off and on', async t => {
  const matchMedia = () => ({matches:true});
  const globals = {
    document:stubDocument(), window:{matchMedia,addEventListener() {}},
    matchMedia, location:{search:''}, self:globalThis,
    createImageBitmap:async () => ({width:1, height:1}),
    ProgressEvent:globalThis.ProgressEvent ?? class extends Event {}
  };
  const previous = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, globals);
  t.after(() => {
    for (const key of Object.keys(globals)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else delete globalThis[key];
    }
  });
  const fetchAsset = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.protocol === 'blob:') return fetchAsset(input);
    assert.equal(url.protocol, 'file:');
    return new Response(await readFile(url), {headers:{
      'Content-Type':url.pathname.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'
    }});
  });
  await R.init();
  const {createPlayer} = await import('../demos/corporate/gjh/v11/assets/player.bundle.js');
  const {createTramHud} = await import('../demos/corporate/gjh/v11/assets/ui.js');

  for (const search of ['', '?tram=1']) {
    globalThis.document = stubDocument();
    globalThis.location.search = search;
    const physics = new R.World({x:0, y:-24, z:0});
    physics.createCollider(R.ColliderDesc.cuboid(60,.2,60).setTranslation(0,-.2,0));
    const scene = new T.Scene(), canvas = Object.assign(document.createElement('canvas'), {clientWidth:393,clientHeight:650});
    const material = new T.MeshStandardMaterial();
    const sharedBox = new T.InstancedMesh(new T.BoxGeometry(), material, 1);
    sharedBox.name = 'box plain';
    scene.add(sharedBox);
    const player = await createPlayer(T, R, physics, scene, canvas, new T.MeshBasicMaterial(),
      new T.PlaneGeometry(), [], [], true);
    t.after(() => { player.dispose(); physics.free(); });
    player.body.setTranslation({x:tramLanding.x,y:.89,z:tramLanding.z}, true);
    player.body.setNextKinematicTranslation(player.body.translation());
    physics.step();
    const registry = createInteractionRegistry([]);
    const select = () => {
      const position = player.state;
      return registry.nearest(position, {player:position, zone:'atrium'}).item;
    };
    let item = select();
    if (!search) {
      assert.equal(item, null);
      assert.equal(registry.tram, undefined);
      assert.equal(scene.getObjectByName('Mall tram'), undefined);
      continue;
    }

    assert.equal(item.prompt, 'Ride the tram');
    for (let i = 0; i < 100 && !player.state.character.cart.available; i++) await delay(10);
    assert.equal(player.setCart(true), true);
    select();
    assert.match(registry.tram.reason, /cart/);
    assert.equal(registry.dispatch(item), false);
    player.setCart(false);
    item = select();
    assert.equal(registry.dispatch(item), true);
    assert.equal(select(), null);
    const controls = registry.tram;
    const root = document.createElement('div');
    const hud = createTramHud(root, canvas, () => true);
    hud.show(controls);
    const [card] = root.children;
    const [caption, progress, buttons] = card.children;
    assert.equal(card.hidden, false);
    assert.equal(progress.children.length, 17);
    assert.equal(buttons.children.length, 3);
    assert.ok(buttons.children.every(button => button.style.minHeight === '44px'));
    const step = (frames, alpha = 1) => {
      for (let i = 0; i < frames; i++) {
        player.update(1/60);
        physics.step();
      }
      player.updateCamera(1/60, false, alpha);
      hud.show(controls);
    };

    step(200);
    assert.equal(controls.state.phase, 'ride');
    assert.equal(player.state.character.seated, true);
    assert.equal(player.capsule.isEnabled(), false);
    assert.equal(player.stand(true), false);
    assert.equal(player.teleport('entry'), false);
    assert.equal(player.cameraState().mode, 'third-person');
    const car = scene.getObjectByName('Mall tram');
    assert.equal(car.isInstancedMesh, true);
    assert.equal(car.material, material);
    assert.equal(car.geometry.index.count / 3 * car.count, 168);
    assert.equal(car.geometry.getAttribute('instanceSurface').count, car.count);
    assert.equal(car.castShadow, false);
    assert.equal(car.layers.mask, 1);

    assert.equal(document.key('KeyV', canvas), true);
    assert.equal(player.cameraState().mode, 'first-person');
    near(player.camera.position.y, seatEyeHeight);
    assert.equal(document.key('Space', canvas), true);
    const stopped = player.body.translation();
    player.setInput({forward:1, right:1});
    step(30);
    assert.deepEqual(player.body.translation(), stopped);
    assert.equal(document.key('Space', canvas), true);

    const npc = new T.Group();
    npc.layers.set(2);
    const obstacle = tramRoute.sample(controls.state.distance + 2);
    npc.position.set(obstacle.x, 0, obstacle.z);
    scene.add(npc);
    step(30);
    assert.equal(controls.state.blocked, true);
    npc.position.set(tramLanding.x, 0, tramLanding.z);

    step(910, .5);
    assert.equal(controls.state.blocked, false);
    near(player.visual.position.x, car.position.x, .0001);
    near(player.visual.position.z, car.position.z, .0001);
    assert.equal(controls.state.caption, 0);
    assert.match(caption.children[0].textContent, /On your left/);
    assert.equal(document.key('KeyN', canvas), true);
    assert.equal(controls.state.caption, -1);
    assert.equal(document.key('KeyV', canvas), true);
    step(1);
    const chase = tramRoute.sample(controls.state.distance - chaseDistance);
    near(player.camera.position.x, chase.x);
    near(player.camera.position.z, chase.z);
    // Leave this ride in first person so the restored walking mode is observable.
    assert.equal(document.key('KeyV', canvas), true);
    assert.equal(document.key('Escape', canvas), true);
    assert.equal(controls.state.ending, true);
    step(Math.ceil(tramRoute.length / .025) + 60);
    assert.equal(controls.state.phase, 'arrival');
    assert.equal(controls.state.blocked, true);
    assert.equal(player.capsule.isEnabled(), false);
    const landingObstacle = physics.createCollider(R.ColliderDesc.cuboid(.25,.5,.25)
      .setTranslation(tramLanding.x,.5,tramLanding.z));
    physics.step();
    scene.remove(npc);
    step(1);
    assert.equal(controls.state.phase, 'arrival');
    assert.equal(controls.state.blocked, true);
    physics.removeCollider(landingObstacle, true);
    step(1);
    assert.equal(controls.state.phase, 'idle');
    assert.equal(player.capsule.isEnabled(), true);
    assert.equal(player.state.character.seated, false);
    assert.equal(player.cameraState().mode, 'third-person');
    assert.equal(car.visible, false);
    near(player.state.z, tramLanding.z);
    assert.equal(card.hidden, true);
    assert.equal(select().prompt, 'Ride the tram');
  }
});
