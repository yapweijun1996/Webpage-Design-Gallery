// Khronos binary validation and independent export budget checks.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const validator=require(process.env.GLTF_VALIDATOR || '/Users/yapweijun/Documents/GitHub/Blender-3D-Gallery/node_modules/gltf-validator');
const here=path.dirname(fileURLToPath(import.meta.url)),runtime=path.resolve(here,'../../demos/corporate/gjh/v11/assets');
const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'interior-shell.json'))),results=[];
for(const record of manifest.assets){
 const buffer=fs.readFileSync(path.join(runtime,record.file));
 if(crypto.createHash('sha256').update(buffer).digest('hex')!==record.sha256)throw Error('hash mismatch');
 const report=await validator.validateBytes(new Uint8Array(buffer),{uri:record.file,maxIssues:100});
 if(report.issues.numErrors||report.issues.numWarnings)throw Error(JSON.stringify(report.issues));
 const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
 if((json.images||[]).length||(json.animations||[]).length||(json.skins||[]).length||(json.extensionsRequired||[]).length||(json.buffers||[]).some(b=>b.uri))throw Error('non-static export');
 const root=json.nodes.find(n=>n.name===record.asset_id);if(root?.extras?.asset_id!==record.asset_id)throw Error('root identity');
 const primitives=json.meshes.flatMap(m=>m.primitives);const triangles=primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0);
 if(triangles>700||primitives.length>3||!primitives.length)throw Error('native budget');
 results.push({asset_id:record.asset_id,file:record.file,sha256:record.sha256,bytes:buffer.length,triangles,primitives:primitives.length,errors:report.issues.numErrors,warnings:report.issues.numWarnings,info:report.issues.numInfos});
}
if(results.reduce((n,r)=>n+r.bytes,0)>102400)throw Error('payload budget');
fs.writeFileSync(path.join(here,'reports/gltf-validation.json'),JSON.stringify({validatorVersion:validator.version(),assets:results},null,2)+'\n');
console.log('SHELL_GLTF_PASS',JSON.stringify(results));
