// Use the already installed Khronos validator; no runtime/npm dependency is added.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const modulePath=process.argv[2] || process.env.GJH_GLTF_VALIDATOR;
if(!modulePath)throw Error('Provide the installed gltf-validator module path as the first argument or GJH_GLTF_VALIDATOR.');
const validator=require(modulePath);
const here=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.resolve(here,'../../demos/corporate/gjh/v11/assets');
const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'interior-pilot.json')));
const rows=[];
for(const asset of manifest.assets){
  const bytes=fs.readFileSync(path.join(runtime,asset.file));
  const report=await validator.validateBytes(new Uint8Array(bytes),{uri:asset.file,maxIssues:100});
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const primitives=json.meshes.flatMap(m=>m.primitives);
  const triangles=primitives.reduce((sum,p)=>sum+json.accessors[p.indices].count/3,0);
  const ceiling=asset.kind==='wallLight'?2000:asset.kind==='storeSign'?8000:asset.kind==='plinth'?12000:6000;
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  const root=json.nodes.find(n=>n.name===asset.asset_id);
  const pass=report.issues.numErrors===0 && report.issues.numWarnings===0 && hash===asset.sha256 && root?.extras?.asset_id===asset.asset_id && !json.images?.length && !json.animations?.length && !json.skins?.length && !json.extensionsRequired?.length && primitives.length<=16 && triangles<=ceiling;
  rows.push({asset_id:asset.asset_id,pass,triangles,triangle_ceiling:ceiling,primitives:primitives.length,bytes:bytes.length,validator:report.issues});
  console.log(asset.asset_id,pass?'PASS':'FAIL',triangles,primitives.length,report.issues.numErrors,report.issues.numWarnings);
}
fs.writeFileSync(path.join(here,'reports/gltf-validation.json'),JSON.stringify({validator:'Khronos glTF Validator',assets:rows,totalBytes:rows.reduce((s,r)=>s+r.bytes,0)},null,2)+'\n');
if(rows.some(r=>!r.pass))process.exitCode=1;
