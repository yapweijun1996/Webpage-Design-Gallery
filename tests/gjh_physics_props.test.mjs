import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {createWorld} from '../demos/corporate/gjh/v11/assets/world.js';
import {createPhysicsPropPool, registerPhysicsProps} from '../demos/corporate/gjh/v11/assets/physics-props.js';
import {createInteractionRegistry} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';
import {createProductTransfer} from '../demos/corporate/gjh/v11/assets/visitor-v2-contact.js';
import {installPhysicalProductControl} from '../demos/corporate/gjh/v11/assets/visitor-v2-product-ui.js';

const STEP = 1 / 60;
const sku = 'new-moon-nz-425g-front';

function fakePhysics() {
  const bodies = new Set(), colliders = [];
  let steps = 0;
  return {
    bodies, timestep: STEP,
    get steps() { return steps; },
    step() { assert.equal(this.bodies, bodies); steps++; },
    createRigidBody(desc) {
      const point = {...desc.translation};
      const body = {
        desc, point, sleeping: false, reads: 0, impulse: null,
        translation() { assert.ok(bodies.has(body)); this.reads++; return point; },
        rotation: () => ({x: 0, y: 0, z: 0, w: 1}),
        linvel: () => ({x: 0, y: 0, z: 0}),
        isSleeping() { assert.ok(bodies.has(body)); return this.sleeping; },
        sleep() { this.sleeping = true; },
        applyImpulse(value) { this.impulse = {...value}; this.sleeping = false; }
      };
      bodies.add(body);
      return body;
    },
    removeRigidBody(body) { assert.ok(bodies.delete(body)); },
    createCollider(desc, body) { colliders.push({desc, body, shapeType: () => desc.shape.type}); },
    forEachCollider(callback) { colliders.forEach(callback); }
  };
}

function fixtureProp(world) {
  return {
    mesh: new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()),
    radius: .16, halfHeight: .16, mass: .55, floor: 0, removals: 0,
    createBody(x, y, z) {
      return this.body = world.createRigidBody({translation: {x,y,z}});
    },
    onRemove() { this.removals++; }
  };
}

test('Low builds nearby props on demand and detaches distant meshes without dropping their bodies', () => {
  const world = fakePhysics(), scene = new T.Scene(), interactables = [];
  let warmed = 0;
  registerPhysicsProps(T,R,world,{scene,interactables,expanded:true,phone:true,initialTier:'low',
    prepareModel:async () => { warmed++; }});
  const props = interactables.physicsProps;
  props.visit('atrium',{x:10,y:0,z:44});
  assert.equal(scene.children.length,0);
  assert.equal(warmed,0);
  props.visit('atrium',{x:10,y:0,z:26});
  assert.deepEqual(scene.children.map(mesh => mesh.name),['Atrium ball','Atrium basket']);
  const ball = scene.children[0];
  props.visit('atrium',{x:10,y:0,z:44});
  assert.equal(ball.parent,null);
  assert.equal(ball.visible,false);
  assert.equal(props.sample().activeBodies,2);
  props.visit('atrium',{x:10,y:0,z:26});
  assert.equal(ball.parent,scene);
  assert.equal(ball.visible,true);
  props.setTier('balanced');
  assert.equal(warmed,1);
  assert.equal(scene.getObjectByName('Dropped can').visible,false);
  props.setTier('low');
  assert.equal(scene.getObjectByName('Dropped can'),undefined);
});

for (const [phone, capacity] of [[true, 6], [false, 12]]) {
  test(`prop pool enforces ${capacity} admissions and reuses slots across zones`, () => {
    const world = fakePhysics(), pool = createPhysicsPropPool(world, {phone});
    pool.setZone('atrium');
    const original = Array.from({length: capacity}, () => fixtureProp(world));
    for (const prop of original) assert.ok(pool.spawn(prop, 1, .2, 2));
    assert.equal(pool.activeBodies, capacity);
    assert.equal(pool.spawn(fixtureProp(world), 1, .2, 2), false);
    pool.setZone('newmoon');
    assert.equal(world.bodies.size, 0);
    assert.equal(pool.activeBodies, 0);
    assert.ok(original.every(prop => prop.mesh.visible && prop.removals === 1));
    pool.afterStep(STEP);
    assert.ok(original.every(prop => prop.mesh.material.opacity < 1));
    assert.ok(pool.spawn(fixtureProp(world), 1, .2, 2));
    assert.equal(original[0].mesh.visible, false);
    for (let i = 0; i < 15; i++) pool.afterStep(STEP);
    assert.equal(pool.occupied, 1);
    assert.ok(original.every(prop => !prop.mesh.visible && prop.mesh.material.opacity === 1));
  });
}

test('quiet props sleep after 1.5 s and a nearby capsule sweep wakes them with a capped impulse', () => {
  const world = fakePhysics(), pool = createPhysicsPropPool(world);
  const prop = fixtureProp(world);
  pool.setZone('atrium');
  pool.spawn(prop, 0, .16, 0);
  for (let i = 0; i < 89; i++) pool.afterStep(STEP);
  assert.equal(prop.body.isSleeping(), false);
  pool.afterStep(STEP);
  assert.equal(pool.activeBodies, 0);
  const reads = prop.body.reads;
  pool.afterStep(STEP);
  assert.equal(prop.body.reads, reads);
  const capsule = {radius: () => .3};
  const near = {x: -.46, y: .89, z: 0}, far = {x: -.58, y: .89, z: 0};
  pool.push(capsule, near, far);
  assert.equal(prop.body.impulse, null);
  pool.push(capsule, far, near);
  assert.ok(prop.body.impulse.x > 0 && prop.body.impulse.x <= .18);
  assert.equal(prop.body.impulse.y, 0);
  pool.afterStep(STEP);
  assert.equal(pool.activeBodies, 1);
  prop.body.point.y = .35;
  pool.afterStep(STEP);
  assert.equal(prop.mesh.position.y, .35);
  for (let i = 0; i < 89; i++) pool.afterStep(STEP);
  assert.equal(prop.body.isSleeping(), false);
});

function stubDocument(t) {
  const nodes = new Map(), listeners = {};
  function element() {
    return {
      children: [], hidden: true, listeners: {},
      append(...children) { this.children.push(...children); },
      prepend(...children) { this.children.unshift(...children); },
      setAttribute() {}, focus() {},
      addEventListener(name, handler) { this.listeners[name] = handler; }
    };
  }
  function select(id) {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  }
  globalThis.document = {
    getElementById: id => select('#' + id), querySelector: select, createElement: element,
    addEventListener(name, handler) { listeners[name] = handler; },
    body: element()
  };
  t.after(() => { delete globalThis.document; });
  return {select, listeners};
}

test('no-browser startup wiring covers the Drop button, G, floor pickup, shelf return and bag', t => {
  assert.equal(typeof createWorld, 'function');
  const {select, listeners} = stubDocument(t);
  const scene = new T.Scene(), avatar = new T.Group(), hand = new T.Group(), facing = new T.Group();
  scene.add(facing); facing.add(avatar); avatar.add(hand);
  hand.position.set(.4, 1, 0);
  const transfer = createProductTransfer(T, avatar, hand, facing);
  const world = fakePhysics(), interactables = [];
  const interiors = {report: () => ({tier: 'low'})};
  const shelf = {id: sku, pickup: {x: 0, z: 0, radius: 1}};
  let token, releases = 0, paused = false, bagged = null;
  const original = () => {
    if (token) return null;
    const prop = new T.Group(), origin = new T.Vector3(0, .8, -.7);
    prop.position.copy(origin);
    scene.add(prop);
    token = {id: sku, prop, origin, centerY: .062, approach: shelf.pickup,
      release() { prop.removeFromParent(); token = null; releases++; this.onReleased?.(); }};
    return token;
  };
  const reserveProduct = registerPhysicsProps(T, R, world, {scene, interactables, reserveProduct: original,
    phone: true, expanded: true, prepareModel: meshes => {
      assert.equal(meshes.length, 3);
      assert.ok(meshes.every(mesh => !mesh.visible && mesh.parent === scene));
      return Promise.resolve();
    }, interiors});
  const registry = createInteractionRegistry(interactables);
  const player = {
    get state() { return {x: facing.position.x, y: 0, z: 0, character: {physicalProduct: transfer.state}}; },
    pickProduct: transfer.pick, returnProduct: transfer.putBack, bagProduct: id => transfer.putInBag(id, false)
  };
  const control = installPhysicalProductControl(player, {shelves: [shelf], reserveProduct}, () => paused, registry, {
    productName: id => id,
    addHeldProductToBag(id, putInBag) { if (!putInBag(id)) return false; bagged = id; return true; }
  }, () => {});
  const {pickup, putBack, add} = control.actions;
  function update(zone = 'newmoon') {
    const state = player.state;
    const {item} = registry.nearest(state, {zone, player: state});
    control.update(state, item?.id ?? sku);
    return item;
  }
  function pick() {
    update();
    pickup.listeners.click();
    transfer.update(.9, false);
    update();
    assert.equal(transfer.phase, 'held');
    assert.equal(drop.hidden, false);
  }
  function key() {
    let handled = false;
    listeners.keydown({code: 'KeyG', target: select('#scene'), preventDefault() { handled = true; }});
    return handled;
  }
  const drop = select('#inspect-prompt').children.find(node => node.id === 'held-product-drop');
  assert.equal(drop.textContent, 'Drop');
  const droppedMesh = scene.getObjectByName('Dropped can');
  pick();
  paused = true;
  assert.equal(key(), false);
  paused = false;
  assert.equal(key(), true);
  assert.equal(releases, 0);
  assert.equal(transfer.phase, 'empty');
  assert.equal(token.prop.parent, null);
  assert.ok(droppedMesh.visible && droppedMesh.isMesh);
  const [body] = world.bodies;
  assert.equal(body.desc.ccdEnabled, true);
  body.point.y = .062;
  world.step();
  assert.equal(world.steps, 1);
  assert.equal(interiors.report().activeBodies, 1);
  assert.ok(interiors.report().bodyStepMs >= 0);
  const floor = update();
  assert.equal(floor.shopAction.label, 'Pick up');
  assert.equal(registry.dispatch(floor), true);
  assert.equal(droppedMesh.visible, false);
  assert.equal(releases, 0);
  transfer.update(.9, false);
  update();
  putBack.listeners.click();
  transfer.update(.9, false);
  assert.equal(releases, 1);
  pick();
  add.listeners.click();
  transfer.update(.45, false);
  assert.equal(bagged, sku);
  assert.equal(releases, 2);
  pick();
  drop.listeners.click();
  assert.equal(transfer.phase, 'empty');
  update('upper');
  assert.equal(releases, 3);
  assert.equal(world.bodies.size, 0);
});

test('vendored Rapier settles the dropped can, pushes both atrium props and respawns them', async t => {
  t.mock.method(globalThis, 'fetch', async url => new Response(await readFile(url), {
    headers: {'content-type': 'application/wasm'}
  }));
  await R.init();
  const world = new R.World({x: 0, y: -24, z: 0});
  world.timestep = STEP;
  t.after(() => world.free());
  world.createCollider(R.ColliderDesc.cuboid(35, .2, 35).setTranslation(10, -.22, 18));
  world.createCollider(R.ColliderDesc.cuboid(.4, .1, .4).setTranslation(.4, .2, 0));
  const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, .89, 0));
  const capsule = world.createCollider(R.ColliderDesc.capsule(.55, .3), body);

  const scene = new T.Scene(), interactables = [];
  const reserve = registerPhysicsProps(T, R, world, {
    scene, interactables, expanded: true, phone: true, reserveProduct: () => ({id: sku, release() {}})
  });
  const props = interactables.physicsProps;
  const visitor = {x: 0, y: 0, z: 0};
  props.visit('newmoon', visitor);
  const token = reserve(sku);
  token.onHeld({id: sku, releaseToFloor: spawn => spawn(token, {x: .4, y: 1, z: 0}, () => true)});
  assert.ok(props.drop(visitor));
  const can = scene.getObjectByName('Dropped can');
  let previous = can.position.y, rising = false, bounces = 0;
  for (let i = 0; i < 150; i++) {
    world.step();
    const y = can.position.y;
    if (y - previous > .006 && !rising) { bounces++; rising = true; }
    if (previous - y > .006) rising = false;
    previous = y;
  }
  assert.equal(bounces, 1);
  assert.ok(can.position.y >= .33 && can.position.y <= .375, JSON.stringify(can.position));
  for (let i = 0; i < 100; i++) world.step();
  assert.equal(props.sample().can.sleeping, true);
  assert.equal(props.sample().activeBodies, 0);
  assert.ok(props.sample().bodyStepMs > 0);
  props.visit('atrium', {x: 11, y: 0, z: 26});
  const ball = scene.getObjectByName('Atrium ball'), basket = scene.getObjectByName('Atrium basket');
  assert.ok(ball.visible && basket.visible);
  for (let i = 0; i < 100; i++) world.step();
  assert.equal(can.visible, false);
  const controller = world.createCharacterController(.025);
  controller.enableAutostep(.18, .28, true);
  controller.enableSnapToGround(.25);
  const spawns = {ball: props.sample().ball, basket: props.sample().basket};
  for (const [name, before] of Object.entries(spawns)) {
    assert.equal(before.sleeping, true);
    body.setTranslation({x: before.x, y: .89, z: before.z + 1.4}, true);
    world.step();
    for (let i = 0; i < 64; i++) {
      const point = body.translation();
      controller.computeColliderMovement(capsule, {x: 0, y: -.5 * STEP, z: -1.5 * STEP});
      const movement = controller.computedMovement();
      body.setNextKinematicTranslation({x: point.x + movement.x, y: point.y + movement.y, z: point.z + movement.z});
      world.step();
    }
    const after = props.sample();
    assert.ok(after[name].z < before.z - .1, JSON.stringify({name, before, after: after[name]}));
    assert.ok(after.activeBodies > 0 && after.bodyStepMs > 0);
  }
  props.visit('gogo', visitor);
  for (let i = 0; i < 15; i++) world.step();
  assert.ok(!ball.visible && !basket.visible);
  props.visit('atrium', {x: 11, y: 0, z: 26});
  assert.ok(ball.visible && basket.visible);
  for (const [name, spawnX] of [['ball', 11.4], ['basket', 13]]) {
    const {x, z} = props.sample()[name];
    assert.ok(Math.hypot(x - spawnX, z - 26) < 1e-5, name);
  }
});
