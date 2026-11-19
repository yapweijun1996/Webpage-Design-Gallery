import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {addBrandWallAtlas} from '../demos/corporate/gjh/v11/assets/brand-wall.js';
import {filterWallArtwork, setupMaterialArtwork} from '../demos/corporate/gjh/v11/assets/artwork-textures.js';
import {decalMaterial} from '../demos/corporate/gjh/v11/assets/surface-decals.js';
import {createModelWarmup} from '../demos/corporate/gjh/v11/assets/model-warmup.js';

test('all 17 brand plaques use guttered mipmapped colour artwork before becoming visible', async t => {
  const data = readFileSync(new URL('../demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json',import.meta.url));
  t.mock.method(globalThis,'fetch',async () => new Response(data));
  globalThis.Image = class {
    set src(_) { this.width = 40; this.height = 30; queueMicrotask(() => this.onload()); }
  };
  const copied = [];
  const noop = () => {};
  const canvas = {getContext:() => ({
    canvas, save:noop, restore:noop, translate:noop, scale:noop, fillRect:noop,
    strokeRect:noop, fillText:noop, measureText:text=>({width:text.length*10}),
    drawImage(source,...args) { if (source === canvas) copied.push(args); }
  })};
  globalThis.document = {createElement:() => canvas};
  t.after(() => { delete globalThis.Image; delete globalThis.document; });
  const scene = new T.Scene();
  for (const [tier, anisotropy] of [['low',2],['balanced',4],['detailed',4]]) {
    copied.length = 0;
    const result = await addBrandWallAtlas(T,scene,4.2,mesh => {
      assert.equal(mesh.parent,null);
      const {map} = mesh.material;
      assert.equal(map.generateMipmaps,true);
      assert.equal(map.minFilter,T.LinearMipmapLinearFilter);
      assert.equal(map.anisotropy,anisotropy);
      assert.equal(map.colorSpace,T.SRGBColorSpace);
      assert.equal(map.premultiplyAlpha,false);
      assert(mesh.material.polygonOffset);
    },() => tier);
    assert.equal(result.interactables.length,17);
    assert.equal(result.mesh.geometry.index.count,17*6);
    assert.equal(copied.length,17*4);
    assert.equal(result.mesh.visible,false);
  }
});

test('artwork changes tier in the upload step and preserves data-map sampling', async () => {
  const map = new T.Texture(), roughnessMap = new T.Texture(), emissiveMap = new T.Texture();
  const material = new T.MeshStandardMaterial({map,roughnessMap,emissiveMap});
  map.minFilter = roughnessMap.minFilter = T.NearestFilter;
  map.generateMipmaps = roughnessMap.generateMipmaps = false;
  setupMaterialArtwork(T,material,'low');
  assert.equal(roughnessMap.minFilter,T.NearestFilter);
  assert.equal(roughnessMap.generateMipmaps,false);
  assert.equal(roughnessMap.colorSpace,T.NoColorSpace);
  const uploads = [];
  const warmup = createModelWarmup(T,{
    getContext:() => ({isContextLost:() => false}),
    initTexture(texture) { uploads.push([texture,texture.anisotropy]); }
  });
  const controller = new AbortController();
  const scene = new T.Scene(), mesh = new T.Mesh(new T.PlaneGeometry(),material);
  scene.add(mesh);
  const prepared = warmup.prepare(mesh,scene,{artworkTier:'detailed',signal:controller.signal});
  assert.equal(map.anisotropy,2);
  warmup.runFrame(true);
  assert.deepEqual(uploads,[[map,4]]);
  assert.equal(emissiveMap.anisotropy,2);
  warmup.runFrame(true);
  assert.deepEqual(uploads,[[map,4],[emissiveMap,4]]);
  controller.abort();
  await assert.rejects(prepared,{name:'AbortError'});
  assert.equal(warmup.initTexture(map,'balanced'),false);
  assert.equal(warmup.initTexture(map,'low'),true);
  assert.deepEqual(uploads.at(-1),[map,2]);
});

test('wall photo filtering biases both passes and transparent decals read depth without writing it', () => {
  const material = filterWallArtwork(T,decalMaterial(new T.MeshStandardMaterial({transparent:true})));
  const shader = {fragmentShader:'#include <map_fragment>\n#include <emissivemap_fragment>'};
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/texture2D\( map, vMapUv, 0\.65 \)/);
  assert.match(shader.fragmentShader,/texture2D\( emissiveMap, vEmissiveMapUv, 0\.65 \)/);
  assert(material.polygonOffset && material.depthTest && !material.depthWrite);
  assert.equal(material.polygonOffsetFactor,-1);
});
