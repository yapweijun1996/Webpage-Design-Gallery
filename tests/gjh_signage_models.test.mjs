import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {materials} from '../demos/corporate/gjh/v11/assets/signage/tokens.js';
import {moduleIds,modelFiles} from '../demos/corporate/gjh/v11/assets/signage/models.js';

const folder=new URL('../demos/corporate/gjh/v11/assets/signage/models/',import.meta.url);
const tolerance=.001;
const recognised=id=>moduleIds.includes(id) || /^sign_logo3d_[a-z0-9_]+$/.test(id);
const near=(a,b,t=1e-4)=>Math.abs(a-b)<=t;
function validate(doc,scene){
  assert.equal(doc.asset.version,'2.0');
  // Metres and +Y are implicit in glTF. Reject contradictory exporter hints.
  const hints=doc.asset.extras??{};
  assert.equal(hints.metersPerUnit??1,1,'metre scale');
  assert.equal(hints.upAxis??'+Y','+Y');assert.equal(hints.frontAxis??'+Z','+Z');
  for(const ext of doc.extensionsUsed??[])
    assert.doesNotMatch(ext,/draco|meshopt|basisu|materials_unlit|pbrSpecularGlossiness/i);
  assert.ok(doc.buffers.every(b=>!b.uri),'embedded GLB data');
  assert.ok(doc.nodes.every(node=>node.name?.startsWith('sign_')),'sign_ node prefix');
  const ids=doc.nodes.map(n=>n.name).filter(recognised);
  assert.ok(ids.length,'at least one addressable module');
  assert.equal(new Set(ids).size,ids.length,'unique module IDs within file');
  const names=new Set();
  for(const mat of doc.materials){
    const spec=materials[mat.name];
    assert.ok(spec,'unknown material class '+mat.name);assert.ok(!names.has(mat.name),'duplicate material class');names.add(mat.name);
    const pbr=mat.pbrMetallicRoughness??{};
    for(const key of ['metallicFactor','roughnessFactor'])assert.ok(near(pbr[key]??1,spec[key]),mat.name+' '+key);
    const expected=[...spec.baseColorFactor,...spec.emissiveFactor];
    const actual=[...pbr.baseColorFactor??[1,1,1,1],...mat.emissiveFactor??[0,0,0]];
    assert.equal(actual.length,expected.length);
    assert.ok(expected.every((v,i)=>near(v,actual[i])),mat.name+' shared PBR factors');
    assert.ok(!pbr.baseColorTexture && !pbr.metallicRoughnessTexture && !mat.normalTexture && !mat.emissiveTexture && !mat.occlusionTexture,'sign texture belongs in the shared atlas');
  }
  for(const mesh of doc.meshes)for(const prim of mesh.primitives){
    assert.equal(prim.mode??4,4,'triangle geometry');assert.ok(doc.materials[prim.material],'named PBR material');
  }
  scene.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(scene,true);
  const size=box.getSize(new T.Vector3());
  assert.ok(!box.isEmpty() && size.x>0 && size.y>0,'measurable module bounds');
  assert.ok(size.x<=1+tolerance && size.y<=.6+tolerance && size.z<=.06+tolerance,'nominal metre envelope');
  assert.ok(near(box.min.x+size.x/2,0,tolerance) && near(box.min.y,0,tolerance) && near(box.min.z,0,tolerance),'bottom-centre back origin');
  // Winding, including transformed parents. A reversed single front plane
  // also satisfies the bounds check, but disappears from the aisle.
  let front=false;
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
  scene.traverse(node=>{
    if(!node.isMesh)return;
    const g=node.geometry,pos=g.attributes.position;
    for(let i=0;i<(g.index?.count??pos.count);i+=3){
      for(const [j,v] of [a,b,c].entries())v.fromBufferAttribute(pos,g.index?g.index.getX(i+j):i+j).applyMatrix4(node.matrixWorld);
      normal.crossVectors(b.sub(a),c.sub(a)).normalize();
      if(normal.z>.25 && a.z>=box.min.z-tolerance)front=true;
    }
  });
  assert.ok(front,'front faces +Z');return ids;
}

test('every local signage GLB satisfies the metre, node, origin and shared PBR contract',async()=>{
  const files=readdirSync(folder).filter(f=>f.endsWith('.glb')),seen=new Set();
  for(const file of modelFiles)assert.ok(files.includes(file),'registered GLB missing: '+file);
  for(const file of files){
    const raw=readFileSync(new URL(file,folder));
    assert.equal(raw.toString('ascii',0,4),'glTF');assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
    assert.equal(raw.readUInt32LE(16),0x4e4f534a);
    const doc=JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12)));
    const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
    for(const id of validate(doc,gltf.scene)){assert.ok(!seen.has(id),'duplicate module '+id);seen.add(id);}
  }
});

test('contract rejects wrong transforms, reversed fronts, conflicting units, names and finishes',()=>{
  const spec=materials.brass_trim;
  const doc={asset:{version:'2.0'}, buffers:[{}],nodes:[{name:'sign_backplate'}],
    meshes:[{primitives:[{material:0}]}],materials:[{name:'brass_trim',pbrMetallicRoughness:spec}]};
  const scene=new T.Scene(),face=new T.Mesh(new T.PlaneGeometry(1,.6));face.position.y=.3;scene.add(face);
  assert.deepEqual(validate(doc,scene),['sign_backplate']);
  face.position.y=.4;assert.throws(()=>validate(doc,scene),/origin/);face.position.y=.3;
  face.rotation.y=Math.PI;assert.throws(()=>validate(doc,scene),/front faces/);face.rotation.y=0;
  face.scale.x=100;assert.throws(()=>validate(doc,scene),/envelope/);face.scale.x=1;
  assert.throws(()=>validate({...doc,asset:{version:'2.0',extras:{metersPerUnit:.01}}},scene),/metre/);
  assert.throws(()=>validate({...doc,nodes:[{name:'Cube'}]},scene),/node prefix/);
  assert.throws(()=>validate({...doc,materials:[{name:'brass_trim',pbrMetallicRoughness:{...spec,roughnessFactor:0}}]},scene),/roughnessFactor/);
});
