import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNaturalSurfaceTextures} from '../demos/corporate/gjh/v11/assets/natural-materials.js';
function fixture(failAt=Infinity){
 const maps=[],canvases=[],operations=[];
 class CanvasTexture{
  constructor(image){this.image=image;this.repeat={set:(...value)=>{this.repeatValue=value;}};maps.push(this);}
  dispose(){this.disposed=(this.disposed||0)+1;}
 }
 const T={CanvasTexture,SRGBColorSpace:'srgb',RepeatWrapping:'repeat'};
 const makeCanvas=()=>{const index=canvases.length,context={};for(const method of ['fillRect','beginPath','moveTo','bezierCurveTo','stroke','strokeRect'])context[method]=(...args)=>operations.push([index,method,...args]);const canvas={getContext:type=>{assert.equal(type,'2d');return index===failAt?null:context;}};canvases.push(canvas);return canvas;};
 return {T,makeCanvas,maps,canvases,operations};
}
test('two shared deterministic256px finishes use sRGB repeat and bounded source pixel storage',()=>{
 const a=fixture(),b=fixture(),first=createNaturalSurfaceTextures(a.T,a.makeCanvas),second=createNaturalSurfaceTextures(b.T,b.makeCanvas);
 assert(Object.isFrozen(first));assert.equal(a.maps.length,2);assert.equal(first.stone,a.maps[0]);assert.equal(first.wood,a.maps[1]);assert.notEqual(first.stone,first.wood);
 for(const c of a.canvases)assert.equal(c.width*c.height*4,262144);
 for(const map of a.maps){assert.equal(map.colorSpace,'srgb');assert.equal(map.wrapS,'repeat');assert.equal(map.wrapT,'repeat');assert.equal(map.anisotropy,2);assert.equal(map.disposed,undefined);}
 assert.deepEqual(first.stone.repeatValue,[35,30]);assert.deepEqual(first.wood.repeatValue,[1,1]);assert.deepEqual(a.operations,b.operations);assert.equal(second.wood,b.maps[1]);
});
test('canvas failure returns usable flat-finish sentinel without partial texture retention',()=>{
 for(const failAt of [0,1]){const f=fixture(failAt),result=createNaturalSurfaceTextures(f.T,f.makeCanvas);assert.deepEqual(result,{stone:null,wood:null});assert(Object.isFrozen(result));assert.equal(f.maps.length,failAt);for(const map of f.maps)assert.equal(map.disposed,1);}
});
test('unexpected canvas allocation failure stays contained',()=>{
 const f=fixture();assert.deepEqual(createNaturalSurfaceTextures(f.T,()=>{throw Error('allocation failed');}),{stone:null,wood:null});assert.equal(f.maps.length,0);
});
