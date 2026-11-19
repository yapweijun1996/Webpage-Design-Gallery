import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createMallAtmosphere} from '../demos/corporate/gjh/v11/assets/mall-atmosphere.js';

test('shop lighting tracks the nearest bays and theme with stable ground-floor shader slots', () => {
  const slots = Array.from({length: 8}, (_, i) => ({minX:i*5, maxX:i*5, minZ:0, maxZ:0}));
  const scene = new T.Scene();
  const atmosphere = createMallAtmosphere(T, null, scene, slots);
  const lights = scene.children.filter(object => object.isPointLight);
  const litBays = () => lights.filter(light => light.visible && light.intensity > 0).map(light => light.position.x);
  atmosphere.update({x:0,y:0,z:0});
  assert.deepEqual(litBays(), [0,5,10,15,20]);
  const variants=atmosphere.lightVariants(lights);
  assert.deepEqual(variants.map(set=>set.length),[0,6]);
  assert.equal(lights.filter(light=>light.visible).length,6);
  const original = lights[0].color.clone();
  atmosphere.applyTheme({lighting:{key:0x4466cc}});
  assert.notDeepEqual(lights[0].color.toArray(), original.toArray());
  atmosphere.update({x:20,y:0,z:0});
  assert.deepEqual(litBays(), [20,15,25,10,30,5]);
  atmosphere.update({x:20,y:0,z:25});
  assert.deepEqual(litBays(), []);
  assert.equal(lights.filter(light=>light.visible).length,6);
  atmosphere.update({x:20,y:7,z:0});
  assert.ok(lights.every(light => !light.visible));
});
