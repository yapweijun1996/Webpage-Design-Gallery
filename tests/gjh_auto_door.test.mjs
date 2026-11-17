import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldOpenStoreDoor} from '../demos/corporate/gjh/v11/assets/auto-door.js';

test('automatic doors open from either side and retain hysteresis', () => {
  const door = {x:10, targetOpen:false};
  for (const z of [-4.7, 4.7]) assert.equal(shouldOpenStoreDoor(door,{x:10,y:0,z}),true);
  for (const z of [-5, 5]) assert.equal(shouldOpenStoreDoor(door,{x:10,y:0,z}),false);
  door.targetOpen=true;
  for (const z of [-5, 5]) assert.equal(shouldOpenStoreDoor(door,{x:10,y:0,z}),true);
  for (const z of [-5.3, 5.3]) assert.equal(shouldOpenStoreDoor(door,{x:10,y:0,z}),false);
  assert.equal(shouldOpenStoreDoor(door,{x:10,y:2,z:0}),false);
  assert.equal(shouldOpenStoreDoor(door,{x:16,y:0,z:0}),false);
});
