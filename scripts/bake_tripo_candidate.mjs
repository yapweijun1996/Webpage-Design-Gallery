// CPU-only offline candidate. Arguments and validation procedure are in docs/gjh-v11-avatar.md.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const [source, output, simplifier] = process.argv.slice(2);
const assets = new URL('../demos/corporate/gjh/v11/assets/', import.meta.url);
const bytes = readFileSync(source);
const metadata = JSON.parse(readFileSync(new URL('gjh-tripo-visitor-source.json', assets)));
assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.raw_sha256);
function readGLB(bytes) {
  const end = 20 + bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, end));
  const views = doc.bufferViews.map(({byteOffset = 0, byteLength}) =>
    bytes.subarray(end+8+byteOffset, end+8+byteOffset+byteLength));
  return {doc, views};
}
function chunk(bytes, type, fill) {
  const length = Math.ceil(bytes.length/4)*4;
  const result = Buffer.alloc(8+length, fill);
  result.writeUInt32LE(length);
  result.write(type, 4, 'latin1');
  bytes.copy(result, 8);
  return result;
}
function writeGLB(doc, views) {
  const parts = [];
  let offset = 0;
  for (const [i, view] of views.entries()) {
    Object.assign(doc.bufferViews[i], {byteOffset:offset, byteLength:view.length});
    const padding = Buffer.alloc((4-view.length%4)%4);
    parts.push(view, padding);
    offset += view.length+padding.length;
  }
  doc.buffers[0].byteLength = offset;
  const json = chunk(Buffer.from(JSON.stringify(doc)), 'JSON', 32);
  const binary = chunk(Buffer.concat(parts), 'BIN\0', 0);
  const header = Buffer.alloc(12);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12+json.length+binary.length, 8);
  return Buffer.concat([header, json, binary]);
}

const raw = readGLB(bytes);
const runtime = readGLB(readFileSync(new URL(metadata.runtime_exports.lod0, assets)));
const jointNames = doc => doc.skins[0].joints.map(i => doc.nodes[i].name);
assert.deepEqual(jointNames(raw.doc), jointNames(runtime.doc));
const primitive = doc => doc.meshes[0].primitives[0];
assert.deepEqual(primitive(raw.doc), primitive(runtime.doc));
const {MeshoptSimplifier} = await import(pathToFileURL(resolve(simplifier)));
await MeshoptSimplifier.ready;
const floats = view => new Float32Array(Uint8Array.from(view).buffer);
const bindMatrices = glb => floats(glb.views[glb.doc.accessors[glb.doc.skins[0].inverseBindMatrices].bufferView]);
const sourceBind = bindMatrices(raw), runtimeBind = bindMatrices(runtime);
assert.equal(sourceBind.length, runtimeBind.length);
assert.ok(sourceBind.every((value, i) => Math.abs(value-runtimeBind[i]) < 1e-4), 'Incompatible bind poses');
const position = floats(raw.views[0]), uv = floats(raw.views[2]);
const original = new Uint16Array(Uint8Array.from(raw.views[5]).buffer);
const [reduced] = MeshoptSimplifier.simplifyWithAttributes(original, position, 3, uv, 2,
  [.1, .1], null, 14000*3, 1, ['Permissive']);
assert.ok(reduced.length <= 42000 && reduced.length > 11764*3);
const vertexIds = [...new Set(reduced)];
const remap = new Map(vertexIds.map((id, i) => [id, i]));
const indices = Array.from(reduced, id => remap.get(id));
const {doc, views} = runtime;
const packed = (array, width) => vertexIds.map(i => Array.from(array.subarray(i*width, (i+1)*width)));
const positions = packed(position, 3);
const directory = mkdtempSync(join(tmpdir(), 'tripo-portrait-'));
try {
  writeFileSync(join(directory, 'geometry.json'), JSON.stringify([positions, packed(uv, 2), indices]));
  writeFileSync(join(directory, 'source.jpg'), raw.views[raw.doc.images[0].bufferView]);
  execFileSync(process.env.PYTHON || 'python3', [fileURLToPath(new URL('./bake_tripo_atlas.py', import.meta.url)), directory]);
  for (const [i, stride] of [12, 12, 8, 4, 16].entries()) {
    views[i] = Buffer.concat(vertexIds.map(id => raw.views[i].subarray(id*stride, (id+1)*stride)));
    doc.accessors[i].count = vertexIds.length;
  }
  views[2] = Buffer.from(new Float32Array(JSON.parse(readFileSync(join(directory, 'uv.json'))).flat()).buffer);
  views[5] = Buffer.from(new Uint16Array(indices).buffer);
  views[doc.images[0].bufferView] = readFileSync(join(directory, 'atlas.jpg'));
  doc.accessors[5].count = indices.length;
  for (const bound of ['min','max']) {
    doc.accessors[0][bound] = [0,1,2].map(axis => Math[bound](...positions.map(p => p[axis])));
  }
  const result = writeGLB(doc, views);
  const validator = createRequire(import.meta.url)('gltf-validator');
  const {issues} = await validator.validateBytes(result);
  assert.equal(issues.numErrors, 0, JSON.stringify(issues.messages.slice(0, 10)));
  writeFileSync(output, result, {flag:'wx'});
  console.log(JSON.stringify({triangles:indices.length/3, bytes:result.length, warnings:issues.numWarnings}));
} finally {
  rmSync(directory, {recursive:true, force:true});
}
