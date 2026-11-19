import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {assembleElevatorKit,createKitLoader} from '../demos/corporate/gjh/v11/assets/elevator-kit.js';
import {rideTime,sampleRide} from '../demos/corporate/gjh/v11/assets/elevator-ride.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';

const folder=new URL('../demos/corporate/gjh/v11/assets/elevator/',import.meta.url);
const nodes=['Portal','GoldTrim','Pilasters','Sconces','Planters','ElevatorSign','MarbleInlay','FloorIndicator','Cabin','DoorLeft','DoorRight'];
const layout={...liftLayout,expanded:true};
globalThis.self=globalThis;
// Node has no image decoder. Inspect PNG headers and let the real r170 GLTF
// loader create materials, samplers, indexed geometry and transforms.
globalThis.createImageBitmap=async blob=>{
  const bytes=Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.toString('ascii',1,4),'PNG');
  assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[512,512]);
  return {width:512,height:512,close(){}};
};
async function readKit(tier){
  const raw=readFileSync(new URL(tier+'.glb',folder));
  assert.equal(raw.toString('ascii',0,4),'glTF');
  assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  const doc=JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12)));
  const {scene}=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  return {scene,doc};
}
for(const [tier,max] of [['low',3000],['balanced',4000],['detailed',5400]]){
  test(tier+' ships the named components and fits the entire two-stop draw budget',async()=>{
    const {scene,doc}=await readKit(tier);
    assert.deepEqual(doc.nodes.map(n=>n.name).sort(),[...nodes].sort());
    assert.equal(doc.images.length,3);assert.equal(doc.textures.length,3);
    assert.equal(doc.materials.length,2);assert(!doc.extensions?.KHR_lights_punctual);
    const left=scene.getObjectByName('DoorLeft'),right=scene.getObjectByName('DoorRight');
    assert.equal(left.geometry,right.geometry);assert(left.position.x<0&&right.position.x>0);
    assert.equal(left.material.transparent,true);
    assert(scene.getObjectByName('FloorIndicator').material.emissiveMap?.isTexture);
    const kit=assembleElevatorKit(T,scene,layout);
    const meshes=kit.root.children;
    const calls=meshes.reduce((n,m)=>n+(m.geometry.groups.length||1),0);
    const tris=meshes.reduce((n,m)=>n+m.geometry.index.count/3*(m.isInstancedMesh?m.count:1),0);
    assert.equal(calls,3);assert(tris>0&&tris<=max,tier+' submitted triangles '+tris);
    const uv=meshes[0].geometry.attributes.uv, original=uv.array.slice();
    const doors=meshes[2],matrix=new T.Matrix4();
    kit.update(0,1,0,0);
    doors.getMatrixAt(0,matrix);assert(matrix.elements[12]<-1.50);
    doors.getMatrixAt(1,matrix);assert(matrix.elements[12]>1.50);
    doors.getMatrixAt(2,matrix);assert.equal(matrix.elements[12],Math.fround(left.position.x));
    kit.update(7.2,0,1,3);
    assert.equal(meshes[1].position.y,7.2);
    // Exactly the four panel UVs at each landing advance to the 1/down cell.
    const diffs=uv.array.map((v,i)=>v-original[i]).filter(v=>v!==0);
    assert.equal(diffs.length,8);assert(diffs.every(v=>Math.abs(v-3*96/512)<1e-5));
    const version=doors.instanceMatrix.version;
    kit.update(7.2,0,1,3);assert.equal(doors.instanceMatrix.version,version);
    kit.update(0,0,0,0);assert.deepEqual(uv.array,original);
    kit.dispose();
  });
}

test('classic ground marble clears the raised brass promenade and the upper landing stays flush',async()=>{
  const {scene}=await readKit('low');
  const kit=assembleElevatorKit(T,scene,{upper:7.2,x:0,z:16,expanded:false});
  const down=new T.Vector3(0,-1,0);
  function surfaceAt(floor,z) {
    kit.update(floor,0,0,0);
    kit.root.updateMatrixWorld(true);
    const ray=new T.Raycaster(new T.Vector3(0,floor+.3,z),down,0,1);
    return ray.intersectObject(kit.root,true)[0].point.y-floor;
  }
  for(const z of [14,16]) {
    assert(surfaceAt(0,z)>.043);
    assert(surfaceAt(7.2,z)>0 && surfaceAt(7.2,z)<.04);
  }
  kit.dispose();
});

test('a newer tier supersedes a pending upload and a failed download preserves the mounted kit',async t=>{
  const scene=new T.Scene(),waiters=[],urls=[];
  let mounts=0;
  const realFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',(url,...options)=>{
    const href=String(url);
    if(!href.endsWith('.glb'))return realFetch(url,...options);
    urls.push(href);
    return Promise.resolve(href.endsWith('/detailed.glb')?new Response(null,{status:404}):
      new Response(readFileSync(new URL(href))));
  });
  const prepare=()=>new Promise(resolve=>waiters.push(resolve));
  const kit=createKitLoader(T,scene,layout,prepare,()=>mounts++);
  async function waitForUpload(count) {
    for(let i=0;i<200 && waiters.length<count;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(waiters.length,count,'expected decoded kit to reach the upload queue');
  }
  const first=kit.select('low');
  await waitForUpload(1);
  assert.equal(scene.children.length,0);
  const second=kit.select('balanced');
  await waitForUpload(2);
  waiters[1]();await second;waiters[0]();await first;
  assert.equal(mounts,1);assert.equal(scene.children.length,1);
  assert.equal(kit.status,'loaded');
  await kit.select('balanced');assert.equal(urls.length,2);
  const mounted=scene.children[0];
  await kit.select('detailed');assert.equal(kit.status,'fallback');assert.equal(scene.children[0],mounted);
  kit.dispose();assert.equal(scene.children.length,0);
});

test('both directions open before boarding, seal during movement and reopen before exit',()=>{
  for(const from of [0,7.2]){
    const trip={from,to:7.2-from,x:-3,z:10,startX:-6.4,startZ:10,exitX:-6.4,exitZ:10,position:{}};
    const source=()=>from===0?trip.groundDoor:trip.upperDoor;
    const target=()=>from===0?trip.upperDoor:trip.groundDoor;
    sampleRide(0,trip);assert.equal(source(),0);
    sampleRide(rideTime.open,trip);assert.equal(source(),1);assert.equal(trip.position.x,-6.4);
    sampleRide(rideTime.board,trip);assert.equal(trip.position.x,-3);
    sampleRide(rideTime.close,trip);assert.equal(source(),0);assert.equal(trip.height,from);
    sampleRide(1,trip);assert(trip.height>0&&trip.height<7.2);assert.equal(source()+target(),0);
    sampleRide(rideTime.arrive,trip);assert.equal(trip.height,trip.to);assert.equal(target(),0);
    sampleRide(rideTime.reopen,trip);assert.equal(target(),1);assert.equal(trip.position.x,-3);
    sampleRide(rideTime.exit,trip);assert.equal(target(),1);assert.equal(trip.position.x,-6.4);
    assert(rideTime.exit>=1.2&&rideTime.exit<=2);
  }
});
