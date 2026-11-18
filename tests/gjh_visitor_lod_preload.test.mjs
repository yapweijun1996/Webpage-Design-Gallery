import test from 'node:test';
import assert from 'node:assert/strict';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {createVisitorLOD} from '../demos/corporate/gjh/v11/assets/visitor-v2-lod.js';

test('visitor LOD preloads, times out safely, and retries only once after cooldown', async () => {
  const globals=['window','fetch','performance','setTimeout','clearTimeout'];
  const original=Object.fromEntries(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const parse=GLTFLoader.prototype.parseAsync;
  let idle,timer,now=0,requests=0,disposeCount=0,uploads=0,finishUpload;
  const bones=[{name:'body'}], geometry={attributes:{skinIndex:{count:0}},dispose(){disposeCount++;}};
  const low={isSkinnedMesh:true,geometry:{clone:()=>geometry,dispose(){}},skeleton:{bones}};
  const scene={getObjectByName:()=>low,traverse(fn){fn({geometry:{dispose(){}},material:{dispose(){}}});}};
  const mesh={isSkinnedMesh:true,name:'visitor',geometry:{},skeleton:{bones},clone(){return {...this};}};
  const high=mesh.geometry;
  const avatar={traverse(fn){fn(mesh)},getWorldPosition(v){return v}};
  const camera={position:{distanceTo:()=>12}}, T={Vector3:class {}};
  const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
  try {
    Object.defineProperty(globalThis,'window',{configurable:true,value:{requestIdleCallback(fn){idle=fn}}});
    Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
    Object.defineProperty(globalThis,'setTimeout',{configurable:true,value:fn=>{timer=fn;return 1}});
    Object.defineProperty(globalThis,'clearTimeout',{configurable:true,value:()=>{}});
    Object.defineProperty(globalThis,'fetch',{configurable:true,value:(_url,{signal})=>{requests++;if(requests===1)return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));return Promise.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});}});
    GLTFLoader.prototype.parseAsync=async()=>({scene});
    const lod=createVisitorLOD(T,avatar,{prepareModel:async ([preview])=>{
      uploads++;
      assert.equal(preview.geometry,geometry);
      assert.equal(preview.skeleton,mesh.skeleton);
      await new Promise(resolve=>{finishUpload=resolve;});
    }});
    idle();await flush();assert.equal(requests,1);timer();await flush();
    assert.equal(lod.state.failed,true);assert.equal(lod.state.available,false);
    now=29999;lod.update(camera);await flush();assert.equal(requests,1);
    now=30001;lod.update(camera);await flush();assert.equal(requests,2);assert.equal(uploads,1);
    lod.update(camera);assert.equal(lod.state.available,false);assert.equal(mesh.geometry,high);
    finishUpload();await flush();assert.equal(lod.state.available,true);assert.equal(lod.state.failed,false);
    lod.update(camera);assert.equal(lod.state.level,1);assert.equal(mesh.geometry,geometry);
    now=90000;lod.update(camera);await flush();assert.equal(requests,2);assert.equal(disposeCount,0);
  } finally {GLTFLoader.prototype.parseAsync=parse;for(const name of globals)if(original[name])Object.defineProperty(globalThis,name,original[name]);else delete globalThis[name];}
});
