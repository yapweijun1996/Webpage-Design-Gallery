import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {allowMallLightWash, createMallAtmosphere} from '../demos/corporate/gjh/v11/assets/mall-atmosphere.js';

test('both light slots follow one shop and fade before changing positions', () => {
  const slots = Array.from({length:8}, (_, i) => ({
    minX:i*5-2,maxX:i*5+2,minZ:-3,maxZ:3,side:i === 4 ? 'east' : 'north'
  }));
  const scene = new T.Scene(), key = new T.DirectionalLight();
  scene.add(key);
  const atmosphere = createMallAtmosphere(T,null,scene,slots);
  const lights = scene.children.filter(object => object.isPointLight);
  const litPositions = () => lights.filter(light => light.visible && light.intensity > 0).map(light => light.position.toArray());
  const at = (x,y,z,time) => atmosphere.update({x,y,z},time);
  at(0,0,0,100);
  assert.deepEqual(litPositions(), [[0,3.9,2.1],[0,4.3,-1.8]]);
  const variants = atmosphere.lightVariants([key,...lights]);
  assert.deepEqual(variants,[[key],[key,...lights]]);
  assert.ok(lights.every(light => light.layers.isEnabled(0) && light.layers.isEnabled(2)));
  const original = lights[0].color.clone();
  atmosphere.applyTheme({lighting:{key:0x4466cc}});
  assert.notDeepEqual(lights[0].color.toArray(),original.toArray());

  // Warm-up changes only visibility. It cannot switch the current focus.
  atmosphere.setLightFloor({y:8});
  assert.ok(lights.every(light => !light.visible));
  at(20,0,0,130);
  assert.deepEqual(litPositions(),[[0,3.9,2.1],[0,4.3,-1.8]]);
  assert.equal(lights[0].intensity,19.5);
  at(20,0,0,220);
  at(20,0,0,340);
  assert.deepEqual(litPositions(),[[17.9,3.9,0],[21.8,4.3,0]]);
  at(20,0,30,460);
  assert.deepEqual(litPositions(),[]);
  assert.equal(lights.filter(light => light.visible).length,2);
  at(20,8,0,490);
  assert.ok(lights.every(light => !light.visible && light.intensity === 0));
});

test('three PMREMs are retained, swapped by zone without rebaking, and released together', () => {
  const captured = [];
  const generatorDisposals = [];
  const fake = {...T, PMREMGenerator:class {
    fromScene(studio, sigma) {
      const target = new T.WebGLRenderTarget(768,1024);
      target.texture.mapping = T.CubeUVReflectionMapping;
      const record = {target,sigma,colour:studio.children[0].material.color.getHex(),disposed:false};
      target.addEventListener('dispose',() => { record.disposed = true; });
      captured.push(record);
      return target;
    }
    dispose() { generatorDisposals.push(true); }
  }};
  const scene = new T.Scene(), renderer = {toneMappingExposure:1.08};
  const atmosphere = createMallAtmosphere(fake,renderer,scene,[{minX:18,maxX:22,minZ:-7,maxZ:0}],
    {atrium:{x:10,z:12}});
  atmosphere.restoreEnvironment();
  assert.equal(new Set(captured.map(({colour}) => colour)).size,3);
  assert.ok(captured.every(({target,sigma}) => sigma === .04 &&
    target.texture.mapping === T.CubeUVReflectionMapping && target.height === 1024));
  const route = [
    [10,1,12,0,1], [28,1,12,1,.9], [20,1,-2,2,.8],
    [20,8,-2,0,1], [10,1,41,1,.9], [20,1,-2,2,.8]
  ];
  for (const [x,y,z,index,intensity] of route) {
    atmosphere.update({x,y,z});
    assert.equal(scene.environment,captured[index].target.texture);
    assert.equal(scene.environmentIntensity,intensity);
  }
  assert.equal(captured.length,3);
  atmosphere.applyTheme({lighting:{key:0xffcea0,exposure:1.01}});
  assert.equal(renderer.toneMappingExposure,1.01);
  assert.equal(captured.length,3);
  atmosphere.releaseEnvironment();
  assert.equal(scene.environment,null);
  assert.ok(captured.every(({disposed}) => disposed));
  atmosphere.restoreEnvironment();
  assert.equal(scene.environment,captured[5].target.texture);
  assert.equal(scene.environmentIntensity,.8);
  assert.equal(generatorDisposals.length,2);
  atmosphere.releaseEnvironment();
});

test('broad wash is limited to known discrete adapters and skips phones', () => {
  const context = (adapter, exposed = true) => ({
    getExtension:() => exposed ? {UNMASKED_RENDERER_WEBGL:1} : null,
    getParameter:() => adapter
  });
  assert.equal(allowMallLightWash('desktop',context('ANGLE (NVIDIA GeForce RTX 4080)')),true);
  assert.equal(allowMallLightWash('desktop',context('ANGLE (AMD Radeon RX Vega 8 Graphics)')),false);
  assert.equal(allowMallLightWash('desktop',context('Apple M3')),false);
  assert.equal(allowMallLightWash('tablet',context('Intel Iris Xe Graphics')),false);
  assert.equal(allowMallLightWash('desktop',context('',false)),false);
  assert.equal(allowMallLightWash('phone',context('NVIDIA GeForce')),false);
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
    info, capabilities:{maxSamples:4}, autoClear:true, shadowMap:{autoUpdate:true},
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
    ['',2,480,223,false], ['Mall glow filter',1,480,223,false],
    ['',1,1920,892,true], ['Mall glow composite',1,undefined,undefined,false]
  ]);
  assert.equal(atmosphere.state.totalCalls,4);
  assert.equal(atmosphere.state.submissions,4);
  assert.equal(target,null);
  assert.equal(camera.layers.mask,1);
  assert.equal(renderer.shadowMap.autoUpdate,true);

  const [glow, blurredGlow, base] = targets;
  const samples = targets.slice(0,3).map(buffer => buffer.samples);
  assert.deepEqual(samples,[0,0,2]);
  const shadowSize = light.shadow.mapSize.toArray();
  for (const [w, h] of [[1152,535], [1920,892]]) {
    width = w; height = h;
    passes.length = targets.length = 0;
    atmosphere.render(camera,true,npcs,budget);
    assert.deepEqual(targets,[glow,blurredGlow,base,null]);
    const glowWidth = Math.floor(w/4), glowHeight = Math.floor(h/4);
    assert.deepEqual(passes,[
      ['',2,glowWidth,glowHeight,false], ['Mall glow filter',1,glowWidth,glowHeight,false],
      ['',1,w,h,true], ['Mall glow composite',1,undefined,undefined,false]
    ]);
    assert.deepEqual(targets.slice(0,3).map(buffer => buffer.samples), samples);
    assert.deepEqual(light.shadow.mapSize.toArray(),shadowSize);
  }
});

test('visitor shadows share their depth buffer and fit inside NPC admission', () => {
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(), passes = [];
  const plane = new T.PlaneGeometry(), contact = new T.MeshBasicMaterial({transparent:true,depthWrite:false});
  const info = {autoReset:true,render:{calls:0,triangles:0},reset() { this.render.calls = this.render.triangles = 0; }};
  let current = null;
  const renderer = {
    info, capabilities:{maxSamples:2}, autoClear:true, shadowMap:{autoUpdate:true},
    getRenderTarget:() => current,
    setRenderTarget(next) { current = next; },
    getDrawingBufferSize:size => size.set(800,600),
    getClearColor:colour => colour.set(0), getClearAlpha:() => 1, setClearColor() {},
    render(rendered,activeCamera) {
      passes.push([current,activeCamera.layers.mask,this.autoClear]);
      info.render.calls++;
      info.render.triangles += 2;
      const shadow = rendered.getObjectByName('Visitor contact shadows');
      if (activeCamera.layers.mask === 4) {
        assert.equal(shadow.material,contact);
        assert.equal(shadow.geometry,plane);
        assert.equal(shadow.count,2);
        const matrix = new T.Matrix4();
        shadow.getMatrixAt(1,matrix);
        assert.ok(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(new T.Vector3(4,8.026,-2)) < .00001);
        info.render.calls++;
        info.render.triangles += 4;
      } else if (shadow) assert.equal(shadow.visible,false);
    }
  };
  const atmosphere = createMallAtmosphere(T,renderer,scene,[],{plane,contact});
  const npcs = {setVisible() {}, admit(calls,triangles) {
    assert.equal(calls,5); // Three preceding draws, one composite, one shadow batch.
    assert.equal(triangles,20); // Six submitted triangles, two composite, 12 reserved.
    return 2;
  }, forEachVisible(visit) {
    visit({x:2,z:3},0,0);
    visit({x:4,z:-2},.5,8);
  }};
  atmosphere.render(camera,true,npcs,{calls:110,triangles:420000});
  assert.equal(passes[2][0],passes[3][0]);
  assert.equal(passes[3][1],4);
  assert.equal(passes[3][2],false);
  assert.equal(atmosphere.state.nonNpcCalls,4);
  assert.equal(atmosphere.state.npcCalls,2);
  assert.equal(atmosphere.state.totalCalls,6);
  assert.equal(scene.getObjectByName('Visitor contact shadows').visible,false);

  passes.length = 0;
  atmosphere.render(camera,false,null);
  assert.deepEqual(passes,[[null,1,true]]);
});
