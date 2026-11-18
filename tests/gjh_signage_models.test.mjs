import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {moduleIds,modelFiles} from '../demos/corporate/gjh/v11/assets/signage/models.js';

const folder=new URL('../demos/corporate/gjh/v11/assets/signage/models/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',folder)));
const near=(a,b,t=1e-5)=>Math.abs(a-b)<=t;

async function readModel(asset){
  const raw=readFileSync(new URL(asset.file,folder));
  assert.equal(raw.toString('ascii',0,4),'glTF');assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  assert.equal(raw.readUInt32LE(16),0x4e4f534a);
  assert.equal(raw.length,asset.bytes);
  assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256);
  const doc=JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12)));
  const {scene}=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  return {doc,scene};
}

function validate(doc,scene,asset){
  assert.equal(doc.asset.version,'2.0');
  const hints=doc.asset.extras??{};
  assert.equal(hints.metersPerUnit??1,1,'metre scale');
  assert.equal(hints.upAxis??'+Y','+Y');assert.equal(hints.frontAxis??'+Z','+Z');
  assert.deepEqual(doc.extensionsUsed??[],[],'core glTF');
  assert.ok(doc.buffers.every(b=>!b.uri),'embedded GLB data');
  assert.equal(doc.textures?.length??0,0,'shared atlas owns textures');
  assert.equal(asset.file,asset.name+'.glb');assert.match(asset.name,/^sign_[a-z0-9_]+$/);
  assert.deepEqual(doc.nodes,[{name:asset.name,mesh:0}],'one identity mesh node named after the file');
  assert.deepEqual(doc.scenes[doc.scene??0].nodes,[0]);
  assert.equal(doc.meshes.length,1);assert.equal(doc.meshes[0].name,asset.name);
  assert.deepEqual(doc.materials.map(m=>m.name).sort(),[...asset.materials].sort());
  assert.equal(new Set(asset.materials).size,asset.materials.length);
  for(const mat of doc.materials){
    const spec=manifest.materialLibrary[mat.name],pbr=mat.pbrMetallicRoughness;
    assert.ok(spec,'unknown material class '+mat.name);
    const linear=new T.Color(spec.color).toArray();
    const expected=[...linear,1,...linear.map(c=>c*(spec.emission??0))];
    const actual=[...pbr.baseColorFactor??[1,1,1,1],...mat.emissiveFactor??[0,0,0]];
    assert.equal(actual.length,expected.length);
    assert.ok(expected.every((v,i)=>near(v,actual[i])),mat.name+' shared PBR factors');
    assert.ok(near(pbr.metallicFactor??1,spec.metallic),mat.name+' metallicFactor');
    assert.ok(near(pbr.roughnessFactor??1,spec.roughness),mat.name+' roughnessFactor');
    assert.equal(mat.doubleSided??false,spec.doubleSided??false,mat.name+' sidedness');
    assert.ok(!pbr.baseColorTexture && !pbr.metallicRoughnessTexture && !mat.normalTexture && !mat.emissiveTexture && !mat.occlusionTexture);
  }
  for(const prim of doc.meshes[0].primitives){
    assert.equal(prim.mode??4,4,'triangle geometry');assert.ok(doc.materials[prim.material],'named PBR material');
  }
  scene.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(scene,true);
  const size=box.getSize(new T.Vector3()).toArray();
  assert.ok(size.every((v,i)=>v>0 && near(v,asset.sizeMetres[i])),'measured metre dimensions');
  assert.ok(near(box.min.x,-box.max.x) && near(box.min.y,0) && near(box.min.z,0),'bottom-centre-back origin');
  let front=false,back=false,triangles=0;
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
  scene.traverse(node=>{
    if(!node.isMesh)return;
    const {index,attributes}=node.geometry;
    triangles+=index.count/3;
    for(let i=0;i<index.count;i+=3){
      const j=index.getX(i);
      a.fromBufferAttribute(attributes.position,j);
      b.fromBufferAttribute(attributes.position,index.getX(i+1));
      c.fromBufferAttribute(attributes.position,index.getX(i+2));
      normal.crossVectors(b.sub(a),c.sub(a)).normalize();
      if(normal.z>.25 && attributes.normal.getZ(j)>.5)front=true;
      if(normal.z<-.25 && attributes.normal.getZ(j)<-.5)back=true;
    }
  });
  assert.ok(front && back,'outward +Z and -Z winding');
  assert.equal(triangles,asset.tris);
}

test('every local signage GLB satisfies the metre, node, origin and shared PBR contract',async()=>{
  const files=readdirSync(folder).filter(f=>f.endsWith('.glb')).sort();
  assert.deepEqual([...modelFiles].sort(),files);
  assert.deepEqual([...moduleIds].sort(),files.map(f=>f.slice(0,-4)));
  assert.equal(new Set(moduleIds).size,moduleIds.length);
  for(const asset of manifest.assets){
    const {doc,scene}=await readModel(asset);validate(doc,scene,asset);
  }
  assert.equal(manifest.assets.reduce((n,a)=>n+a.tris,0),manifest.totals.tris);
  assert.equal(manifest.assets.reduce((n,a)=>n+a.bytes,0),manifest.totals.bytes);
});

test('reject wrong identity, scale, origin, winding and shared finish',async()=>{
  const asset=manifest.assets.find(a=>a.name==='sign_backplate');
  const {doc,scene}=await readModel(asset);
  const badNode=patch=>({...doc,nodes:[{...doc.nodes[0],...patch}]});
  assert.throws(()=>validate(badNode({name:'sign_other'}),scene,asset),/identity mesh node/);
  assert.throws(()=>validate(badNode({translation:[0,.1,0]}),scene,asset),/identity mesh node/);
  assert.throws(()=>validate({...doc,asset:{version:'2.0',extras:{metersPerUnit:.01}}},scene,asset),/metre scale/);
  scene.position.y=.1;assert.throws(()=>validate(doc,scene,asset),/origin/);scene.position.y=0;
  scene.scale.x=100;assert.throws(()=>validate(doc,scene,asset),/dimensions/);scene.scale.x=1;
  const bad=structuredClone(doc);bad.materials[0].pbrMetallicRoughness.roughnessFactor=0;
  assert.throws(()=>validate(bad,scene,asset),/roughnessFactor/);
  scene.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.index.array.reverse();});
  assert.throws(()=>validate(doc,scene,asset),/winding/);
});
