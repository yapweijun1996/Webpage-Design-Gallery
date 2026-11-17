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
