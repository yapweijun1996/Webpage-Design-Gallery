import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {resolveQuality} from '../demos/corporate/gjh/v11/assets/graphics-quality.js';
import {createMallAtmosphere, createMallSurfaceAtmosphere} from '../demos/corporate/gjh/v11/assets/mall-atmosphere.js';

function sceneBudget(scene, {shadows}) {
  const budget = {draws:0, lights:0, casters:0, textures:new Set()};
  scene.traverse(node => {
    if (node.isLight) budget.lights++;
    if (node.isMesh && node.castShadow) budget.casters++;
    for (const value of Object.values(node.material ?? {})) {
      if (value?.isTexture) budget.textures.add(value);
    }
  });
  if (scene.environment) budget.textures.add(scene.environment);
  scene.traverseVisible(node => {
    if (!node.isMesh || !node.material.visible) return;
    // An instanced mesh with a single front-side material submits one draw
    // per participating pass before frustum culling.
    if (node.layers.isEnabled(0)) budget.draws++;
    if (shadows && node.layers.isEnabled(1)) budget.draws++;
  });
  return budget;
}

test('surface atmosphere batches Low coves and desktop washes separately and disables broad wash on integrated GPUs', () => {
  const scene = new T.Scene();
  const plane = new T.PlaneGeometry();
  const poolMaterial = new T.MeshBasicMaterial({
    map:new T.Texture({width:64,height:64}), transparent:true, depthWrite:false, blending:T.AdditiveBlending
  });
  scene.add(new T.Mesh(plane,poolMaterial));
  const fixture = new T.Mesh(plane,new T.MeshStandardMaterial({emissive:0xffd08a,emissiveIntensity:1.2}));
  fixture.layers.enable(1);
  scene.add(fixture);
  const light = new T.DirectionalLight();
  light.castShadow = true;
  scene.add(light);
  createMallAtmosphere(T,null,scene,[{minX:0,maxX:2,minZ:0,maxZ:2}]);

  const profiles = [
    resolveQuality({width:390,deviceClass:'phone',preference:'low'}),
    resolveQuality({width:1440,preference:'balanced'}),
    resolveQuality({width:1440,preference:'detailed'}),
    resolveQuality({width:1440,preference:'detailed',recovered:true})
  ];
  const baseline = profiles.map(profile => sceneBudget(scene,profile));
  const floor = new T.MeshStandardMaterial({roughness:.39});
  const vault = new T.MeshStandardMaterial({emissiveIntensity:.32});
  const surfaces = createMallSurfaceAtmosphere(T,scene,{
    plane,poolMaterial,floors:[floor],fixtures:fixture.material,vault,
    washes:[[0,8,0,6,.42,0,Math.PI/2,true],[0,.03,2,4,2,0,-Math.PI/2]]
  });
  const wash = scene.getObjectByName('Mall cove and storefront light wash');
  assert.ok(wash.isInstancedMesh);
  assert.equal(wash.count,1);
  assert.equal(wash.geometry,plane);
  assert.equal(wash.material.map,poolMaterial.map);
  assert.equal(wash.material.side,T.FrontSide);
  assert.equal(wash.material.depthWrite,false);
  assert.equal(wash.layers.mask,1);

  const expectedDraws = [1,1,1,1];
  const observed = profiles.map((profile,index) => {
    surfaces.setTier(profile.tier);
    const budget = sceneBudget(scene,profile);
    assert.equal(budget.draws-baseline[index].draws,expectedDraws[index],profile.tier);
    assert.equal(budget.lights,baseline[index].lights,profile.tier);
    assert.equal(budget.casters,baseline[index].casters,profile.tier);
    assert.deepEqual(budget.textures,baseline[index].textures,profile.tier);
    return {roughness:floor.roughness, emission:fixture.material.emissiveIntensity, opacity:wash.material.opacity};
  });
  const [low, balanced, detailed, recovered] = observed;
  assert.deepEqual(low,{roughness:.39,emission:1.2*1.12,opacity:.22});
  assert.deepEqual(recovered,low);
  assert.ok(detailed.roughness < balanced.roughness && balanced.roughness < low.roughness);
  assert.ok(detailed.emission > balanced.emission && balanced.emission > low.emission);
  assert.ok(detailed.opacity > balanced.opacity && balanced.opacity > low.opacity);

  surfaces.setTier('detailed',false);
  assert.equal(wash.visible,false);
  surfaces.setTier('balanced',false);
  assert.equal(wash.visible,false);
  surfaces.setTier('detailed');
  assert.equal(wash.visible,true);
  surfaces.setFixtureEmission(.8);
  assert.ok(fixture.material.emissiveIntensity > .8);
  surfaces.setTier('low',false);
  assert.equal(wash.visible,true);
  assert.equal(wash.count,1);
  assert.equal(fixture.material.emissiveIntensity,.8*1.12);
  assert.equal(vault.emissiveIntensity,.32*1.12);
});
