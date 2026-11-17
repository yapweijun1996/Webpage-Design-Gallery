import test from 'node:test';
import assert from 'node:assert/strict';
import {createInteractionRegistry} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';

const position = {x:0, y:0, z:0};

test('selects the nearest in-range entry and preserves authored IDs', () => {
  const entries = [
    {id:'far', x:1.5, z:0, radius:2},
    {id:'near', anchor:{x:.5,y:0,z:0}, radius:1},
    {id:'outside', x:.2, z:0, radius:.2},
  ];
  const registry = createInteractionRegistry(entries);
  const result = registry.nearest(position);
  assert.equal(result.item.id, 'near');
  assert.equal(result.distance, .5);
  assert.equal(entries[1].id, 'near');
  entries.push({id:'later',x:.1,z:0,radius:1});
  assert.equal(registry.nearest(position).item.id, 'later');
});

test('only selects the current floor and excludes elevator travel', () => {
  const registry = createInteractionRegistry([
    {id:'upper', x:0, y:7.2, z:0, floor:7.2, radius:2},
    {id:'ground', x:1, z:0, floor:0, radius:2},
  ]);
  assert.equal(registry.nearest(position).item.id, 'ground');
  assert.equal(registry.nearest({...position,y:7.2}).item.id, 'upper');
  assert.equal(registry.nearest(position,{travelling:true}).item, null);
  assert.equal(registry.nearest({...position,y:3}).distance, Infinity);
});

test('availability and seat approach determine selection and dispatch', () => {
  let available = false, calls = 0;
  const registry = createInteractionRegistry([
    {id:'restricted',x:.1,z:0,radius:1,availability:()=>available,handler:()=>++calls},
    {id:'seat',x:.2,z:0,radius:1,seat:{z:1,facing:1}},
  ]);
  assert.equal(registry.nearest(position).item.id, 'seat');
  const restricted = registry.normalize({id:'restricted',x:0,z:0,radius:1,availability:()=>available,handler:()=>++calls});
  assert.equal(registry.dispatch(restricted), false);
  available = true;
  assert.equal(registry.nearest(position).item.id, 'restricted');
  assert.equal(registry.dispatch(restricted), 1);
  assert.equal(registry.nearest({x:0,y:0,z:1}).item, null);
});

test('all interaction kinds carry prompts and dispatch through the registry', () => {
  for (const kind of ['sit', 'inspect', 'open', 'pickup', 'travel']) {
    let enabled = true, calls = 0;
    const source = {id:kind, kind, x:0, z:0, radius:1,
      prompt:() => `${kind} action`, availability:() => enabled,
      handler:(item, context) => { assert.equal(item.kind, kind); assert.equal(context.input, 'hud'); calls++; return true; }};
    const registry = createInteractionRegistry([source]);
    const item = registry.nearest(position, {input:'hud'}).item;
    assert.equal(item.prompt(), `${kind} action`);
    assert.equal(registry.dispatch(item), true);
    enabled = false;
    assert.equal(registry.dispatch(item), false);
    assert.equal(calls, 1);
  }
});

test('registered auxiliary pickup and map travel do not replace nearby inspection', () => {
  const registry = createInteractionRegistry([{id:'shelf',kind:'inspect',x:0,z:0,radius:2}]);
  let held = false, destination = null, reachable = true;
  const pickup = registry.register({id:'shelf',kind:'pickup',anchor:{x:.5,y:0,z:0},floor:0,radius:1,
    prompt:()=>held?'Return to shelf':'Pick up product',
    availability:()=>reachable, handler:()=>{held=!held;return true;}});
  registry.register({id:'store',kind:'travel',prompt:'Visit store',handler:()=>{destination='store';return true;}});
  assert.equal(registry.nearest(position).item.kind, 'inspect');
  assert.equal(registry.get('pickup','shelf'), pickup);
  assert.deepEqual(pickup.anchor, {x:.5,y:0,z:0});
  assert.equal(pickup.floor, 0);
  assert.equal(pickup.radius, 1);
  assert.equal(pickup.prompt(), 'Pick up product');
  assert.equal(registry.dispatch(registry.get('pickup','shelf')), true);
  assert.equal(pickup.prompt(), 'Return to shelf');
  reachable = false;
  assert.equal(registry.dispatch(pickup), false);
  assert.equal(held, true);
  assert.equal(registry.dispatch(registry.get('travel','store')), true);
  assert.equal(destination, 'store');
  assert.equal(registry.get('pickup','missing'), null);
});

test('success subscribers cover later registered kinds, ignore failures and unsubscribe', () => {
  const registry = createInteractionRegistry([]);
  const events = [];
  const unsubscribe = registry.subscribe((item, context) => events.push([item.kind, context.input]));
  const context = {input: 'keyboard'};
  for (const kind of ['sit', 'inspect', 'open', 'pickup', 'travel']) {
    const item = registry.register({id: kind, kind, handler: () => true});
    assert.equal(registry.dispatch(item, context), true);
  }
  assert.deepEqual(events, ['sit', 'inspect', 'open', 'pickup', 'travel'].map(kind => [kind, 'keyboard']));
  for (const result of [false, undefined, null, 0]) {
    registry.dispatch(registry.register({id: 'failed', kind: 'inspect', handler: () => result}), context);
  }
  registry.dispatch(registry.register({id: 'blocked', kind: 'open', availability: () => false,
    handler: () => { throw new Error('Unavailable actions must not run'); }}), context);
  registry.dispatch(null, context);
  assert.equal(events.length, 5);
  unsubscribe();
  registry.dispatch(registry.register({id: 'later', kind: 'pickup', handler: () => true}), context);
  assert.equal(events.length, 5);
});
