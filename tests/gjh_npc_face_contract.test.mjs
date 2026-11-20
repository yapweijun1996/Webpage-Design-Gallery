import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

// Contracts are pinned to 6ec566df. Only image bytes and crowd UVs may change.
function contract(bytes, repacked) {
  const end = 20 + bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20,end));
  const hash = createHash('sha256');
  for (const key of ['nodes','meshes','skins','animations','materials','textures','samplers']) {
    hash.update(JSON.stringify(doc[key] ?? null));
  }
  const skip = new Set(doc.images.map(im=>im.bufferView));
  const uv = doc.meshes[0].primitives[0].attributes.TEXCOORD_0;
  if (repacked) skip.add(doc.accessors[uv].bufferView);
  for (const [i,info] of doc.accessors.entries()) {
    const {min,max,...layout}=info;
    hash.update(JSON.stringify(repacked && i===uv ? layout : info));
  }
  for (const [i,view] of doc.bufferViews.entries()) {
    const start=end+8+(view.byteOffset ?? 0);
    if (!skip.has(i)) hash.update(bytes.subarray(start,start+view.byteLength));
  }
  return hash.digest('hex');
}

test('NPC face bakes preserve the shipped topology, bind matrices, joints and every animation key', async()=>{
  const assets=new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
  const boy='3cbdebc9f4620c7f1119be0e661f673e13b71d517eaed224ee2139f2f6251d50';
  const far='1ee921102125f24db8da1184471317fbd8b4969b064d682cc1a1ab2ba1be524c';
  const crowd='784a745c65aee5a9a64356e226d5d308c9c178d4865174fa3d848a2b5e4e1fdc';
  for(const [file,expected] of [['gjh-tripo-npc-boy',boy],['gjh-tripo-npc-boy-1k',boy],
    ['gjh-tripo-npc-boy-lod1',far],['chibi-crowd/base_body',crowd],['chibi-crowd/base_body-512',crowd]]) {
    const bytes=await readFile(new URL(file+'.glb',assets));
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    assert.equal(contract(bytes,file.startsWith('chibi-crowd/')),expected,file);
  }
});
