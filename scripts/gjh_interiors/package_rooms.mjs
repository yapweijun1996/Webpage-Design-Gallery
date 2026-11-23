// Validate the exact runtime assets and emit the warm-loader projection.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options:{gallery:{type:'string'},output:{type:'string'},brands:{type:'string'},'models-only':{type:'boolean'},check:{type:'boolean'}}});
const gallery = path.resolve(values.gallery), output = path.resolve(values.output);
const require = createRequire(path.join(gallery,'package.json'));
const validator = require('gltf-validator');
const sha = data => createHash('sha256').update(data).digest('hex');
const read = name => fs.readFileSync(path.join(output,name));
function emit(name, text) {
  if (values.check) assert.equal(read(name).toString(),text,name);
  else fs.writeFileSync(path.join(output,name),text);
}
const anchors = path.join(gallery,'exports/gjh-v11-interiors');
const anchorManifest = fs.readFileSync(path.join(anchors,'manifest.json'),'utf8').trimEnd();
const manifest = JSON.parse(anchorManifest);
const planBytes = fs.readFileSync(new URL('../../docs/gjh-v11-interior-program.json', import.meta.url));
const localAnchors = {
  S01: {
    root:'models/gjh-new-moon-header', editable:'s01-crescent-header.blend', lowCap:960,
    credit:'Original scalloped crown, oak bead, underside light, crescent and category lettering.'
  },
  S04: {
    root:'models/gjh-borsch-folio',
    credit:'Original two-leaf sloping folio, paper inset and oxblood-topped display plinth.'
  },
};
const localFocals = new Map(JSON.parse(planBytes).stores.filter(store => localAnchors[store.id])
  .map(store => [store.id,store.items.find(item => item.id === store.focal)]));
const originalAnchors = manifest.assets;
const runtimeAnchors = originalAnchors.map(asset => {
  const focal = localFocals.get(asset.store);
  return values['models-only'] || !focal ? asset : {
    ...asset, file:focal.lod[asset.tier.toLowerCase()], model:focal.modelId
  };
});
const brands = path.resolve(values.brands ?? path.join(output,'../brands'));
const sources = JSON.parse(fs.readFileSync(path.join(brands,'logo-sources.json')));
const marks = Object.fromEntries(Object.entries(sources).map(([slot,record])=>[slot,{
  file:record.file,source:record.source_url_or_generated,sha256:sha(fs.readFileSync(path.join(brands,record.file)))
}]));
const details = [], names = fs.readdirSync(output).filter(name=>name.endsWith('-details.glb')).sort();
const atlas = 'showroom-atlas.png', png = read(atlas);
assert.equal(png.readUInt32BE(16),256);
assert.equal(png.readUInt32BE(20),256);
assert.equal(names.length,17);

const source = (slug, file, directory = 'exports') => {
  const dir = path.join(gallery,'models',slug);
  const {author,rights} = JSON.parse(fs.readFileSync(path.join(dir,'metadata',slug+'.json')));
  return {file:'models/'+slug+'/'+directory+'/'+file,sha256:sha(fs.readFileSync(path.join(dir,directory,file))),author,rights};
};
const freezer = source('freezer-cabinet','freezer-cabinet.blend','sources');
const lamp = source('chinese-lantern','chinese-lantern.glb');
const plate = source('mamak-stainless-steel-plate','mamak-stainless-steel-plate.glb');
for (const file of [...runtimeAnchors.map(a=>a.file),...names]) {
  const bytes = values['models-only'] && !names.includes(file) ? fs.readFileSync(path.join(anchors,file)) : read(file);
  const result = await validator.validateBytes(bytes,{uri:file,maxIssues:0,externalResourceFunction:async uri=>{
    assert.equal(uri,atlas);
    return png;
  }});
  const {numErrors:errors,numWarnings:warnings,messages} = result.issues;
  assert.equal(errors+warnings,0,file+' '+JSON.stringify(messages));
  const gltf = JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  if (!names.includes(file)) {
    const asset = runtimeAnchors.find(a=>a.file===file);
    const local = localAnchors[asset.store];
    if (!local || values['models-only']) {
      assert.equal(sha(bytes),asset.sha256,file);
    } else {
      const primitives = gltf.meshes.flatMap(mesh => mesh.primitives);
      const positions = primitives.map(primitive => gltf.accessors[primitive.attributes.POSITION]);
      assert(!gltf.images?.length && gltf.nodes.every(node => !node.matrix && !node.translation && !node.rotation && !node.scale));
      const bounds_m = {
        min:[0,1,2].map(axis => Math.min(...positions.map(value => value.min[axis]))),
        max:[0,1,2].map(axis => Math.max(...positions.map(value => value.max[axis])))
      };
      const triangles = primitives.reduce((sum,primitive) => sum + gltf.accessors[primitive.indices].count/3,0);
      const {root,editable,lowCap,credit} = local;
      const focal = localFocals.get(asset.store);
      Object.assign(asset,{
        triangles, bytes:bytes.length, vertices:positions.reduce((sum,position) => sum+position.count,0),
        materials:gltf.materials.map(material=>material.name), primitives:primitives.length,
        groups:gltf.nodes.map(node=>node.name), bounds_m, textures:[], sha256:sha(bytes),
        triangle_cap:asset.tier === 'Low' ? (lowCap ?? asset.triangle_cap) : asset.triangle_cap,
        provenance:{kind:'NEW',author:'Yap Wei Jun project / agent-assisted procedural modeling', finish:'solid-pbr',
          credit:[{credit}], generator:`${root}/generate.py`,
          ...(editable && {editable_source:`${root}/${editable}`}),
          licence_reference:`${root}/README.md`, licence_text:asset.licence},
        validator:{version:result.validatorVersion,errors,warnings}
      });
      assert(triangles<=asset.triangle_cap,file);
      assert(bounds_m.max.every((max,axis)=>max-bounds_m.min[axis]<=focal.size[axis]),file);
    }
    continue;
  }
  const store = file.slice(0,3).toUpperCase(), slot = Number(store.slice(1));
  assert.equal(slot,details.length+1);
  assert.deepEqual(gltf.images.map(img=>img.uri),[atlas]);
  let triangles=0, draws=0, instances=0;
  for (const node of gltf.nodes) {
    if (node.mesh===undefined) continue;
    const inst = node.extensions?.EXT_mesh_gpu_instancing;
    const count = inst ? gltf.accessors[inst.attributes.TRANSLATION].count : 1;
    for (const p of gltf.meshes[node.mesh].primitives) {
      triangles+=count*gltf.accessors[p.indices].count/3;
      draws++;
    }
    if(inst) instances+=count;
  }
  assert(draws<=4,file);
  details.push({store,file,bytes:bytes.length,sha256:sha(bytes),triangles,draws,instances,
    motion:gltf.materials.map(m=>m.name).filter(name=>['Pulse','Scroll'].includes(name)),
    sources:slot===2?[plate]:slot===3?[freezer]:[5,7].includes(slot)?[lamp]:[],
    validator:{version:result.validatorVersion,errors,warnings}});
}
manifest.round2 = {version:1,coordinates:'Slot-local metres, +Y up, +Z toward entrance. Shared by all tiers.',
  limits:{lowTrianglesPerShop:2800,lowTrianglesAllShops:45000,extraDrawsPerShop:4},
  atlas:{file:atlas,sha256:sha(png),bytes:png.length,width:256,height:256,marks},
  generator:'scripts/gjh_interiors/build_rooms.py',details};
if (values['models-only']) {
  emit('manifest.json',JSON.stringify(manifest.round2,null,2)+'\n');
} else {
  manifest.anchor_source_plan_sha256 = manifest.plan_sha256;
  manifest.plan_sha256 = sha(planBytes);
  for (const store of localFocals.keys()) {
    const previous = originalAnchors.find(asset=>asset.store===store && asset.tier==='Low');
    const current = runtimeAnchors.find(asset=>asset.store===store && asset.tier==='Low');
    manifest.totals.low_anchor_triangles += current.triangles-previous.triangles;
    manifest.totals.low_anchor_bytes += current.bytes-previous.bytes;
    manifest.totals.projected_full_low_triangles += current.triangles-previous.triangles;
  }
  manifest.assets = runtimeAnchors;
  emit('manifest.json',JSON.stringify(manifest,null,2)+'\n');
}
const atlasRecord = JSON.stringify({file:atlas,bytes:png.length});
const files=Object.fromEntries(details.map(({store,file,bytes})=>[store,{file,bytes,roomDetail:true}]));
if (!values['models-only']) emit('detail-files.js','// Generated by scripts/gjh_interiors/package_rooms.mjs.\n'+
  'export const roomAtlas = '+atlasRecord+';\nexport const roomDetails = '+JSON.stringify(files,null,2)+';\n'+
  'export const newMoonAnchorBytes = '+JSON.stringify(Object.fromEntries(runtimeAnchors
    .filter(asset=>asset.store==='S01').map(asset=>[asset.tier.toLowerCase(),asset.bytes])))+';\n');
console.log(`Khronos validated ${manifest.assets.length} anchors and ${details.length} room models.`);
