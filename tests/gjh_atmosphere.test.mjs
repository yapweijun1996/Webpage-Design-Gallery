import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createMallAtmosphere} from '../demos/corporate/gjh/v11/assets/mall-atmosphere.js';

test('shop lighting tracks the nearest bays, floor and theme', () => {
  const slots = Array.from({length: 8}, (_, i) => ({minX:i*3, maxX:i*3, minZ:0, maxZ:0}));
  const scene = new T.Scene();
  const atmosphere = createMallAtmosphere(T, null, scene, slots);
  const lights = scene.children.filter(object => object.isPointLight);
  atmosphere.update({x:0,y:0,z:0});
  assert.deepEqual(lights.map(light => light.visible), [true,true,true,true,true,true,false,false]);
  const original = lights[0].color.clone();
  atmosphere.applyTheme({lighting:{key:0x4466cc}});
  assert.notDeepEqual(lights[0].color.toArray(), original.toArray());
  atmosphere.update({x:21,y:0,z:0});
  assert.deepEqual(lights.map(light => light.visible), [false,false,true,true,true,true,true,true]);
  atmosphere.update({x:21,y:7,z:0});
  assert.ok(lights.every(light => !light.visible));
});
