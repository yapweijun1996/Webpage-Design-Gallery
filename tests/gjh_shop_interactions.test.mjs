import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createInteractionRegistry, createInteractionState} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';
import {buildShopInteractionTargets, installShopInteractions} from '../demos/corporate/gjh/v11/assets/interiors/shop-interactions.js';
import {interiorStores} from '../demos/corporate/gjh/v11/assets/interiors/config.js';
import {gogoStoolSeat} from '../demos/corporate/gjh/v11/assets/interiors/gogo-seats.js';
import {isInFrontOfSeat} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {addOriginalShopDetails} from '../demos/corporate/gjh/v11/assets/shop-anchor-details-first.js';
import {installPhysicalProductControl} from '../demos/corporate/gjh/v11/assets/visitor-v2-product-ui.js';
import {audit, auditStandingInteractions, capsule, floorGrid, obstacles, programme, studioBoxes} from '../scripts/gjh_interiors/sweep.mjs';

const slots = ['S01','S02','S03'];
const plan = JSON.parse(readFileSync(programme));
const builds = await buildShopInteractionTargets();

function seatEntry(seat) {
  return {id:seat.id, kind:'sit', x:seat.exitX, z:seat.exitZ, floor:seat.floor,
    radius:seat.clearance.interactionRadius, seat, handler:() => true};
}

function storyEntry(shop, id, standing, radius) {
  const [x,,z] = shop.frame.world_origin_m;
  return {id, kind:'inspect', x:x+standing[0], z:z+standing[1], radius, handler:() => true};
}

test('MILI, GOGO and New Moon offer their standing actions within two Next presses', async () => {
  const {S01, S02, S03} = interiorStores;
  const moonSeats = [];
  addOriginalShopDetails('newmoon',S01.frame.world_origin_m[0],{
    box() {}, cylinder() {}, collider:() => ({handle:1}), seats:moonSeats
  });
  const entries = [
    storyEntry(S02,'mili-sauce-story',S02.cookbase.standing,1.12),
    storyEntry(S03,'gogo-potong-story',S03.anchor.standing,1),
    ...S01.storyPanels.map(panel => storyEntry(S01,panel.id,panel.interactionXZ,panel.radius)),
    ...S03.gogoStools.map(stool => seatEntry(gogoStoolSeat(S03.frame,stool,1,true))),
    ...moonSeats.map(seatEntry),
    ...builds.filter(target => target.shopAction.productId).map(target =>
      ({id:target.shopAction.productId,...target.standing,radius:1.9}))
  ];
  const registry = createInteractionRegistry(entries);
  const targets = await installShopInteractions(T,{add() {}},registry);

  const expected = {
    'S02-plate': [.5,-3.5,'S02-plate'],
    'S03-drink': [11,-2.5,'S03-drink'],
    'S03-focal': [7.7,-2.7,'gogo-potong-story'],
    'S01-kettle': [-8.8,-5.5,'S01-kettle'],
    'S01-cups1': [-8.8,-2.4,'S01-cups1']
  };
  assert(Object.keys(expected).every(id => targets.some(target => target.id === id)));
  for (const target of targets) {
    const {id} = target;
    const position = {...target.standing, y:target.floor};
    const context = {zone:target.shopAction.zone};
    let {item} = registry.nearest(position,context);
    if (expected[id]) {
      const [x,z,first] = expected[id];
      assert(Math.hypot(x-position.x,z-position.z) < 1e-8,id);
      assert.equal(item?.id,first,id);
    }
    for (let i = 0; i < 2 && item?.id !== id; i++) {
      assert(registry.canCycle(),id);
      assert(registry.cycle(1),id);
      ({item} = registry.nearest(position,context));
    }
    assert.equal(item?.id,id);
    assert(registry.dispatch(item),id);
    registry.advanceShopActions(context.zone,1,true);
    registry.nearest({x:0,z:0},{zone:'atrium'});
  }

  for (const [entry, zone, alternative] of [
    [entries.find(e => e.id === 'mili-sauce-story'),'mili','S02-cookbase'],
    [entries.find(e => e.id === 'S03-stools31'),'gogo','S03-drink'],
    [seatEntry(moonSeats[1]),'newmoon','S01-cups3']
  ]) {
    const context = {zone};
    const position = {x:entry.x, z:entry.z, y:entry.floor ?? 0};
    const {item} = registry.nearest(position,context);
    assert.equal(item.id,entry.id);
    assert(registry.dispatch(item));
    const offered = new Set();
    for (let i = 0; i < 2 && registry.cycle(1); i++) offered.add(registry.nearest(position,context).item.id);
    assert(offered.has(alternative),entry.id);
    registry.nearest({x:0,z:0},{zone:'atrium'});
  }
});

test('all 17 layouts offer every action from its own standing position', () => {
  assert.equal(plan.stores.length,17);
  for (const shop of plan.stores) assert.deepEqual(auditStandingInteractions(shop),[],shop.slot);
});

test('layout rejects standing positions closer than 0.45 m without shared Next cycling', () => {
  const shop = structuredClone(plan.stores[1]);
  const plate = shop.items.find(item => item.id === 'S02-plate');
  const cookbase = shop.items.find(item => item.id === 'S02-cookbase');
  plate.standing = [cookbase.standing[0]+.4,cookbase.standing[1]];
  plate.reachDistance = .3;
  assert(auditStandingInteractions(shop).some(([id,issue]) =>
    id === cookbase.id && issue === 'standing position < 0.45 m from S02-plate without shared Next cycling'));
  plate.standing[0] += .05;
  assert.deepEqual(auditStandingInteractions(shop),[]);
});

test('interaction lifecycle covers focus, completion, interruption, retry and sleeping', () => {
  const [action, other] = ['S03-focal','S03-drink'].map(id => builds.find(item => item.id === id));
  const messages = [], frames = [];
  const state = createInteractionState({
    announce: message => messages.push(message),
    present: (item, progress) => frames.push([item?.id,progress])
  });
  assert.equal(state.read(action.id).phase,'idle');
  state.focus(action);
  assert.equal(state.read(action.id).phase,'focused');
  assert(state.start(action));
  assert.equal(state.read(action.id).phase,'executing');
  assert(!state.start(other));
  assert(!state.advance('gogo',.25));
  assert(frames.at(-1)[1] > 0 && frames.at(-1)[1] < 1);
  assert(state.advance('mili',.1));
  assert.equal(state.read(action.id).phase,'cancelled');
  assert.equal(frames.at(-1)[0],undefined);
  assert(!state.needsFrame);
  assert(state.start(action));
  assert(state.start(action)); // The touch/keyboard action becomes Cancel.
  assert.equal(state.read(action.id).phase,'cancelled');
  assert(state.start(action));
  assert(state.advance('gogo',0,true));
  assert.equal(state.read(action.id).phase,'done');
  assert.equal(messages.at(-1),'Popsicle ready.');
  assert.deepEqual(frames.at(-1),[action.id,1]);
  assert(!state.needsFrame);
  state.focus(other);
  assert.equal(state.read(other.id).phase,'focused');
  state.focus(null);
  assert.equal(state.read(other.id).phase,'idle');
  assert.equal(state.read(action.id).phase,'done');
});

test('all three GOGO bar stools use the native seat contract and clear the sit/stand segment', () => {
  const shop = plan.stores[2], {frame,gogoStools:stools} = interiorStores.S03;
  assert.equal(stools.length,3);
  for (const [index,stool] of stools.entries()) {
    const item = shop.items.find(item => item.id === stool.id);
    const seat = gogoStoolSeat(frame,stool,index+1,true);
    const {floor,standing} = builds.find(target => target.id === stool.id);
    assert.deepEqual([seat.exitX,seat.exitZ],[standing.x,standing.z]);
    assert(Math.abs(seat.floor-floor) < .03);
    assert.equal(seat.collider,index+1);
    assert(isInFrontOfSeat(seat,standing));
    const grid = floorGrid(shop, obstacles(shop).filter(obstacle => obstacle.id !== stool.id));
    assert(grid.edge(item.standing,[item.xyz[0],item.xyz[2]],capsule),stool.id);
  }
});

test('no-browser target build covers all 17 layouts and the pilot actions have clear routes', async () => {
  assert.equal(new Set(builds.map(target => target.shopAction.slot)).size,17);
  assert.equal(new Set(builds.map(target => target.id)).size,builds.length);
  assert.deepEqual(builds.map(target => target.id),plan.stores.flatMap(shop => shop.items.map(item => item.id)));
  const studio = await studioBoxes();
  for (const shop of plan.stores.filter(store => slots.includes(store.slot))) {
    assert.deepEqual(audit(shop,studio),[],shop.slot);
    for (const target of builds.filter(item => item.shopAction.slot === shop.slot)) {
      const author = shop.items.find(item => item.id === target.id);
      assert(author.action.length && target.shopAction.label && target.shopAction.name,target.id);
      assert.deepEqual(target.shopAction.item.action,author.action,target.id);
      assert.deepEqual([target.standing.x,target.standing.z],
        [shop.frame.world_origin_m[0]+author.standing[0],shop.frame.world_origin_m[2]+author.standing[1]],target.id);
    }
  }
});

test('no-browser installation exercises selection, cycling and the single procedural prop', async () => {
  const added = [], announcements = [], scene = {add: mesh => added.push(mesh)};
  const story = {id:'gogo-potong-story', ...builds.find(t => t.id === 'S03-focal').standing, radius:1};
  const registry = createInteractionRegistry([story]);
  const installed = await installShopInteractions(T,scene,registry,message => announcements.push(message));
  assert.equal(added.length,0);
  assert(installed.every(target => !target.shopAction.seat));

  function focus(id, context = {}) {
    const t = installed.find(target => target.id === id);
    const p = {...t.standing, y:t.floor};
    const options = {zone:t.shopAction.zone,...context};
    let selection = registry.nearest(p,options).item;
    assert(registry.nearest(p,{...options,camera:'first-person'}).item === selection);
    for (let i = 0; i < installed.length && selection?.id !== id && registry.cycle(1); i++) {
      selection = registry.nearest(p,options).item;
    }
    assert.equal(selection?.id,id);
    return selection;
  }

  const cart = focus('S03-focal');
  assert(registry.dispatch(cart));
  registry.advanceShopActions('gogo',.2,false);
  const [prop] = added;
  assert(prop.visible && !prop.castShadow);
  const initial = prop.geometry;
  assert(registry.advanceShopActions('gogo',1,false));
  assert.notEqual(prop.geometry,initial);
  assert.equal(announcements.at(-1),'Popsicle ready.');
  assert.equal(registry.nearest(story,{zone:'atrium'}).item.id,story.id);
  registry.advanceShopActions('atrium',.1,false);
  assert(!prop.visible);
  assert.equal(registry.shopState(cart.id).phase,'done');

  for (const [id, message] of [
    ['S03-drink','Drink served.'], ['S02-cookbase','Sample ready.'],
    ['S02-plant2','Herbs watered.'], ['S01-kettle','Tea served.']
  ]) {
    const target = focus(id);
    assert(registry.dispatch(target));
    registry.advanceShopActions(target.shopAction.zone,.2,false);
    assert(prop.visible && prop.geometry.index.count/3 < 300,id);
    assert(registry.advanceShopActions(target.shopAction.zone,1,false));
    assert.equal(announcements.at(-1),message);
  }
  assert.equal(added.length,1);
  const seated = {seated:true,seatPhase:'seated',seatId:'newmoon-tasting-stool-1'};
  assert.equal(registry.nearest({x:-8.51,y:.04,z:-3.29},{zone:'newmoon',player:seated}).item.id,'S01-kettle');
  assert.equal(registry.nearest({x:-8.51,y:.04,z:-3.29},{zone:'newmoon',player:{...seated,seatId:'courtyard-seat'}}).item,null);
});

test('drawer pickup uses all four native shelf IDs and preserves return and bag controls', async t => {
  const elements = new Map();
  const element = () => ({focus() {}, append() {}, prepend() {}, setAttribute() {},
    addEventListener(event, listener) { this[event] = listener; }});
  const previous = globalThis.document;
  globalThis.document = {
    createElement: element,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector,element());
      return elements.get(selector);
    }
  };
  t.after(() => { if (previous) globalThis.document = previous; else delete globalThis.document; });
  const drawers = builds.filter(item => item.shopAction.productId);
  assert.equal(drawers.length,4);
  const entries = drawers.map(target => ({id:target.shopAction.productId,...target.standing,radius:1.9}));
  const registry = createInteractionRegistry(entries);
  await installShopInteractions(T,{add() {}},registry);
  const physical = {phase:'empty'};
  const state = {y:0,character:{physicalProduct:physical}};
  const calls = [];
  const clear = () => { physical.held = false; physical.phase = 'empty'; };
  const player = {state,
    pickProduct(token) { calls.push(token.id); Object.assign(physical,{held:true,phase:'held',id:token.id}); return true; },
    returnProduct() { calls.push('return'); clear(); return true; },
    bagProduct() { calls.push('bag'); clear(); return true; }};
  const world = {
    shelves: drawers.map(target => ({id:target.shopAction.productId,pickup:{...target.standing,radius:1.65}})),
    reserveProduct: id => ({id, release() { assert.fail('Unexpected release'); }})
  };
  const controls = installPhysicalProductControl(player,world,() => false,registry,{
    productName: id => id,
    addHeldProductToBag: (_id, bagProduct) => bagProduct()
  }, () => {});
  for (const [i, drawer] of drawers.entries()) {
    Object.assign(state,drawer.standing);
    const context = {zone:'newmoon',player:state};
    assert.equal(registry.nearest(state,context).item.id,drawer.shopAction.productId);
    assert(registry.cycle(1));
    const {item} = registry.nearest(state,context);
    assert.equal(item.id,drawer.id);
    assert.equal(registry.productTarget(item),drawer.id);
    assert(registry.dispatch(item));
    assert(registry.advanceShopActions('newmoon',1,false));
    controls.update(state,registry.productTarget(item));
    assert.equal(controls.actions.pickup.disabled,false);
    assert(registry.dispatch(item));
    assert.equal(physical.id,drawer.shopAction.productId);
    const originalShelf = registry.nearest(state,context).item;
    controls.update(state,registry.productTarget(originalShelf));
    assert.equal(controls.actions.putBack.disabled,false);
    assert.equal(controls.actions.add.disabled,false);
    if (i % 2) controls.actions.putBack.click();
    else controls.actions.add.click();
    assert.equal(calls.at(-1),i % 2 ? 'return' : 'bag');
  }
  assert.deepEqual(calls.filter(call => call.startsWith('new-moon-')),drawers.map(item => item.shopAction.productId));
});
