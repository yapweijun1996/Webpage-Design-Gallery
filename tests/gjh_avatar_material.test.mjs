import assert from 'node:assert/strict';
import test from 'node:test';
import {ShaderLib} from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {prepareCrowdMaterial, prepareTripoMaterial} from '../demos/corporate/gjh/v11/assets/character-tripo-material.js';
import {projectedVisitorLevel} from '../demos/corporate/gjh/v11/assets/visitor-v2-lod.js';

test('portrait material startup composes with the shipped standard shader on each device', () => {
  const keys = new Set();
  for (const [device, anisotropy] of [['phone', 2], ['tablet', 4], ['desktop', 4]]) {
    const material = {isMeshStandardMaterial:true, roughness:.9, map:{}};
    prepareTripoMaterial(material, device);
    assert.equal(material.map.anisotropy, anisotropy);
    assert.equal(material.roughness, .9);
    assert.equal(material.map.needsUpdate, true);
    keys.add(material.customProgramCacheKey());
    const shader = {...ShaderLib.standard};
    material.onBeforeCompile(shader, {});
    assert.match(shader.vertexShader, /vAvatarRest = position;/);
    assert.match(shader.fragmentShader, /varying vec3 vAvatarRest;/);
    assert.match(shader.fragmentShader, /roughnessFactor = mix/);
    assert.match(shader.fragmentShader, /outgoingLight \+=/);
    assert.ok(shader.fragmentShader.indexOf('outgoingLight +=') < shader.fragmentShader.indexOf('#include <opaque_fragment>'));
    assert.ok(shader.fragmentShader.includes('#include <map_fragment>'));
    material.needsUpdate = material.map.needsUpdate = false;
    prepareTripoMaterial(material, device);
    assert.equal(material.needsUpdate, false);
    assert.equal(material.map.needsUpdate, false);
  }
  assert.equal(keys.size, 1);
});

test('two-level player hysteresis follows CSS height in both zoom directions', () => {
  let level = 0;
  for (const [px, expected] of [[161,0], [65,0], [64,1], [65,1], [159,1], [160,0], [159,0]]) {
    level = projectedVisitorLevel(px, level);
    assert.equal(level, expected);
  }
});

test('crowd shaders preserve merged clothing and share the portrait fill across named surfaces', () => {
  for (const [name, merged, expected] of [['hair',false,.43], ['skin',false,.62], ['coat',false,.8], ['hair',true,.8]]) {
    const material = {name, isMeshStandardMaterial:true, roughness:.8, vertexColors:merged};
    prepareCrowdMaterial(material, '');
    assert.equal(material.roughness, expected);
    const shader = {...ShaderLib.standard};
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /outgoingLight \+=/);
    assert.equal(shader.vertexShader, ShaderLib.standard.vertexShader);
    assert.equal(material.customProgramCacheKey(), 'gjh-crowd-portrait-v1');
  }
});
