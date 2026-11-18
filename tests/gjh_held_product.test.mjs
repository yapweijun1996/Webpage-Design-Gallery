import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createBagStore} from '../demos/corporate/gjh/v11/assets/demo-bag.js';
import {createMallHud} from '../demos/corporate/gjh/v11/assets/hud-coordinator.js';
import {createInteractionRegistry} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';
import {createProductTransfer} from '../demos/corporate/gjh/v11/assets/visitor-v2-contact.js';
import {installPhysicalProductControl} from '../demos/corporate/gjh/v11/assets/visitor-v2-product-ui.js';

const nz = 'new-moon-nz-425g-front', au = 'new-moon-au-425g-front';
const names = {[nz]: 'New Zealand Abalone 425g', [au]: 'Australia Abalone 425g'};

function element() {
  const attributes = new Map(), classes = new Set();
  return {
    children: [], listeners: {}, dataset: {}, hidden: true,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }
    },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    focus() {},
    append(...children) { this.children.push(...children); },
    prepend(...children) { this.children.unshift(...children); },
    addEventListener(event, listener) { this.listeners[event] = listener; },
    click() { this.listeners.click(); }
  };
}

function setup(t, reduced = false) {
  const elements = new Map();
  const select = key => {
    if (!elements.has(key)) elements.set(key, element());
    return elements.get(key);
  };
  globalThis.document = {
    querySelector: select,
    querySelectorAll: () => [element(), element(), element()],
    getElementById: id => select(`#${id}`),
    createElement: element,
    addEventListener() {}
  };
  t.after(() => { delete globalThis.document; });

  const scene = new T.Scene(), facing = new T.Group(), avatar = new T.Group(), hand = new T.Group();
  hand.name = 'RightHand';
  hand.position.set(.3, 1, 0);
  scene.add(facing); facing.add(avatar); avatar.add(hand);
  const transfer = createProductTransfer(T, avatar);
  const shelves = [{id:nz,pickup:{x:0,z:0,radius:1}}, {id:au,pickup:{x:4,z:0,radius:1}}];
  let prop, releases = 0;
  const world = {shelves, reserveProduct(id) {
    prop = new T.Group();
    prop.position.set(shelves.find(shelf => shelf.id === id).pickup.x, 1, -1);
    scene.add(prop);
    return {id, prop, origin: prop.position.clone(), release() { releases++; this.prop.removeFromParent(); }};
  }};
  const position = {x:0,y:0,z:0};
  const restrictions = {};
  const store = createBagStore([nz, au]);
  const registry = createInteractionRegistry([]);
  let paused = false, bagStatus;
  const player = {
    get state() { return {...position, ...restrictions, character:{physicalProduct:transfer.state}}; },
    pickProduct: transfer.pick,
    returnProduct: transfer.putBack,
    bagProduct: id => transfer.putInBag(id, reduced)
  };
  const controls = installPhysicalProductControl(player, world, () => paused, registry, {
    productName: id => names[id],
    addHeldProductToBag(id, prepare, message) {
      if (!store.add(id, prepare)) return false;
      bagStatus = message;
      return true;
    }
  }, () => controls.update(player.state, nearby));
  const buttons = Object.fromEntries(select('#inspect-prompt').children.map(child => [child.textContent, child]));
  let nearby;
  function move(id, x, y=0) {
    nearby = id;
    Object.assign(position, {x,y});
    controls.update(player.state, id);
  }
  function pick() {
    move(nz, 0);
    buttons['Pick up product'].click();
    transfer.update(.9, reduced);
    controls.update(player.state, nearby);
    assert.equal(transfer.state.id, nz);
    assert.equal(transfer.phase, 'held');
  }
  return {transfer, store, controls, buttons, restrictions, move, pick, select,
    setPaused(value) { paused = value; },
    get prop() { return prop; }, get releases() { return releases; },
    get bagStatus() { return bagStatus; },
    get heldStatus() { return select('#held-product-status').textContent; }};
}

test('pickup uses the selected shelf and return requires the original shelf in reach', t => {
  const mall = setup(t);
  const pickup = mall.buttons['Pick up product'], putBack = mall.buttons['Return to shelf'];
  mall.move(nz, 1.1);
  assert.equal(pickup.disabled, true);
  mall.move(nz, 0, 7.2);
  assert.equal(pickup.disabled, true);
  mall.pick();
  mall.move(au, 4);
  assert.equal(putBack.disabled, true);
  putBack.click();
  assert.equal(mall.transfer.phase, 'held');
  assert.match(mall.heldStatus, /Holding New Zealand Abalone 425g.*original New Moon shelf/);
  mall.move(nz, 0, 7.2);
  assert.equal(putBack.disabled, true);
  mall.move(nz, 0);
  assert.equal(putBack.disabled, false);
  putBack.click();
  assert.equal(mall.transfer.phase, 'return');
  mall.transfer.update(.9, false);
  assert.equal(mall.transfer.phase, 'empty');
  assert.equal(mall.releases, 1);
  assert.deepEqual(mall.store.snapshot(), {});
});

test('adding at a different shelf consumes only the held SKU and runs one short transfer', t => {
  const mall = setup(t);
  mall.store.change(au, 2);
  mall.pick();
  mall.move(au, 4);
  const add = mall.buttons['Add to bag'];
  assert.equal(add.hidden, false);
  assert.equal(add.disabled, false);
  const heldHeight = mall.prop.position.y;
  add.click();
  add.click();
  assert.deepEqual(mall.store.snapshot(), {[nz]:1,[au]:2});
  assert.equal(mall.bagStatus, 'Added New Zealand Abalone 425g to bag');
  assert.equal(mall.heldStatus, mall.bagStatus);
  assert.equal(mall.transfer.phase, 'bag');
  assert.equal(mall.transfer.state.active, true);
  assert.equal(mall.releases, 0);
  mall.transfer.update(.35, false);
  assert.ok(mall.prop.position.y < heldHeight);
  assert.ok(mall.prop.scale.x < 1);
  mall.transfer.update(.12, false);
  assert.deepEqual(mall.transfer.state, {id:null,phase:'empty',active:false,held:false});
  assert.equal(mall.prop.parent, null);
  assert.equal(mall.releases, 1);
});

for (const nearby of [null, 'mili']) {
  test(`reduced motion adds immediately with nearby target ${nearby ?? 'absent'}`, t => {
    const mall = setup(t, true);
    mall.pick();
    mall.move(nearby, 15);
    assert.equal(mall.buttons['Return to shelf'].hidden, true);
    mall.buttons['Add to bag'].click();
    assert.equal(mall.transfer.phase, 'empty');
    assert.equal(mall.releases, 1);
    assert.deepEqual(mall.store.snapshot(), {[nz]:1});
  });
}

test('paused and incompatible visitor states block dispatch even with a held item', t => {
  const mall = setup(t);
  mall.pick();
  const add = mall.buttons['Add to bag'];
  mall.setPaused(true);
  add.click();
  mall.setPaused(false);
  for (const state of ['seated','pushing','elevatorTravel','productApproaching']) {
    mall.restrictions[state] = true;
    add.click();
    delete mall.restrictions[state];
  }
  assert.deepEqual(mall.store.snapshot(), {});
  assert.equal(mall.transfer.phase, 'held');
});

test('a full bag preserves the held item and accepts it after a slot is freed', t => {
  const mall = setup(t);
  mall.pick();
  mall.move(null, 15);
  mall.store.change(nz, 9);
  mall.buttons['Add to bag'].click();
  assert.equal(mall.transfer.phase, 'held');
  assert.equal(mall.releases, 0);
  assert.deepEqual(mall.store.snapshot(), {[nz]:9});
  mall.store.change(nz, -1);
  mall.buttons['Add to bag'].click();
  mall.transfer.cancel();
  assert.equal(mall.transfer.phase, 'empty');
  assert.equal(mall.releases, 1);
  assert.deepEqual(mall.store.snapshot(), {[nz]:9});
});

test('HUD connects pickup, bag and return and restores exploration after confirmation', t => {
  let now = 100;
  t.mock.method(performance, 'now', () => now);
  const mall = setup(t, true);
  const announcements = [];
  const hud = createMallHud({
    scene: mall.select('#scene'),
    destinations: [],
    announce: message => announcements.push(message),
    subscribeBag: mall.store.subscribe,
    subscribeInspect() {}
  });
  hud.connectProductActions(mall.controls.actions);

  const prompt = mall.select('#inspect-prompt'), inspect = mall.select('#inspect');
  const context = mall.select('#hud-context'), more = mall.select('#hud-more-actions');
  const {pickup, add, putBack} = mall.controls.actions;
  function update() {
    hud.update({position:{x:0,z:0}, zone:'atrium', enabled:true, now, forward:{x:0,z:-1}});
  }

  mall.move(nz, 0);
  prompt.hidden = inspect.hidden = false;
  update();
  assert.equal(context.dataset.context, 'interaction');
  assert.ok(pickup.classList.contains('hud-pickup-action'));
  assert.equal(more.hidden, false);

  mall.pick();
  update();
  assert.equal(context.dataset.context, 'held');
  assert.equal(more.hidden, true);
  assert.ok(add.classList.contains('hud-held-action'));
  assert.ok(putBack.classList.contains('hud-held-action'));
  assert.equal(putBack.disabled, false);
  assert.match(announcements.at(-1), /^Holding New Zealand Abalone/);

  mall.move(null, 15);
  inspect.hidden = true;
  update();
  assert.equal(context.dataset.context, 'held');
  assert.equal(add.hidden, false);
  assert.equal(putBack.hidden, true);
  add.click();
  prompt.hidden = true;
  update();
  assert.equal(context.dataset.context, 'held');
  assert.equal(announcements.at(-1), 'Added New Zealand Abalone 425g to bag');
  assert.equal(add.hidden, true);

  now += 3001;
  mall.move(null, 15);
  update();
  assert.equal(context.dataset.context, 'quest');
});
