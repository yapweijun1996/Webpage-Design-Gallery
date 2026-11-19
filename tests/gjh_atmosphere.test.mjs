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

test('Detailed filters glow at quarter resolution and reserves the final draw for budget admission', () => {
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(), passes = [];
  const light = new T.DirectionalLight();
  light.shadow.mapSize.set(768,768);
  scene.add(light);
  const targets = [];
  let width = 1920, height = 892;
  let target = null, colour = new T.Color(), alpha = 1;
  const info = {autoReset:true,render:{calls:0,triangles:0},reset() {
    this.render.calls = this.render.triangles = 0;
  }};
  const renderer = {
    info, autoClear:true, shadowMap:{autoUpdate:true},
    getRenderTarget:() => target,
    setRenderTarget(next) { target = next; },
    getDrawingBufferSize:size => size.set(width,height),
    getClearColor:saved => saved.copy(colour),
    getClearAlpha:() => alpha,
    setClearColor(next,opacity) { colour.set(next); alpha = opacity; },
    clear() {},
    render(rendered, activeCamera) {
      targets.push(target);
      passes.push([rendered.name,activeCamera.layers.mask,target?.width,target?.height,this.shadowMap.autoUpdate]);
      info.render.calls++;
      info.render.triangles += 2;
    }
  };
  const atmosphere = createMallAtmosphere(T,renderer,scene,[]);
  const budget = {calls:110,triangles:420000};
  const npcs = {setVisible() {}, admit(calls,triangles,limits) {
    assert.equal(limits,budget);
    assert.equal(calls,4);
    assert.equal(triangles,8);
    return 0;
  }};
  atmosphere.render(camera,true,npcs,budget);
  assert.deepEqual(passes,[
    ['',1,1920,892,true], ['',2,480,223,false],
    ['Mall glow filter',1,480,223,false], ['Mall glow composite',1,undefined,undefined,false]
  ]);
  assert.equal(atmosphere.state.totalCalls,4);
  assert.equal(atmosphere.state.submissions,4);
  assert.equal(target,null);
  assert.equal(camera.layers.mask,1);
  assert.equal(renderer.shadowMap.autoUpdate,true);

  const [base, glow, blurredGlow] = targets;
  const samples = targets.slice(0,3).map(buffer => buffer.samples);
  const shadowSize = light.shadow.mapSize.toArray();
  for (const [w, h] of [[1152,535], [1920,892]]) {
    width = w; height = h;
    passes.length = targets.length = 0;
    atmosphere.render(camera,true,npcs,budget);
    assert.deepEqual(targets,[base,glow,blurredGlow,null]);
    const glowWidth = Math.floor(w/4), glowHeight = Math.floor(h/4);
    assert.deepEqual(passes,[
      ['',1,w,h,true], ['',2,glowWidth,glowHeight,false],
      ['Mall glow filter',1,glowWidth,glowHeight,false], ['Mall glow composite',1,undefined,undefined,false]
    ]);
    assert.deepEqual(targets.slice(0,3).map(buffer => buffer.samples), samples);
    assert.deepEqual(light.shadow.mapSize.toArray(),shadowSize);
  }
});
