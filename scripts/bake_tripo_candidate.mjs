// Offline visitor atlas builder. Reproduction commands are in docs/gjh-v11-avatar.md.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const [source, output, simplifier, overlay, skinOverlay, lowOutput, farOutput] = process.argv.slice(2);
if (overlay) assert.ok(skinOverlay && lowOutput && farOutput, 'Provide the 1K and 512 output paths');
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

// Copy all per-vertex values verbatim, including joint indices and skin weights.
function compactGeometry(doc, views, sourceViews, selected, indices) {
  for (const [i, stride] of [12, 12, 8, 4, 16].entries()) {
    const source = sourceViews[i];
    views[i] = Buffer.concat(selected.map(id => source.subarray(id*stride, (id+1)*stride)));
    doc.accessors[i].count = selected.length;
  }
  views[5] = Buffer.from(new Uint16Array(indices).buffer);
  doc.accessors[5].count = indices.length;
  const position = floats(views[0]);
  for (const bound of ['min', 'max']) {
    doc.accessors[0][bound] = [0, 1, 2].map(axis =>
      Math[bound](...selected.map((_, i) => position[3*i+axis])));
  }
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
// Preserve UV seams. Permissive collapses interpolate between unrelated atlas islands.
const [reduced] = MeshoptSimplifier.simplifyWithAttributes(original, position, 3, uv, 2,
  [1, 1], null, 13998*3, 1, []);
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
  const baker = overlay ? './project_tripo_face.py' : './bake_tripo_atlas.py';
  execFileSync(process.env.PYTHON || 'python3', [fileURLToPath(new URL(baker, import.meta.url)),
    directory, ...(overlay ? [overlay, skinOverlay] : [])], {stdio:'inherit'});
  compactGeometry(doc, views, raw.views, vertexIds, indices);
  views[2] = Buffer.from(new Float32Array(JSON.parse(readFileSync(join(directory, 'uv.json'))).flat()).buffer);
  views[doc.images[0].bufferView] = readFileSync(join(directory, 'atlas.jpg'));
  const exports = [];
  const validator = createRequire(import.meta.url)('gltf-validator');
  async function stageExport(outputDoc, outputViews, targetPath) {
    const result = writeGLB(outputDoc, outputViews);
    const {issues} = await validator.validateBytes(result);
    assert.equal(issues.numErrors, 0, JSON.stringify(issues.messages.slice(0, 10)));
    exports.push({targetPath, result, triangles:outputDoc.accessors[5].count / 3, issues});

  }
  await stageExport(doc, views, output);
  if (overlay) {
    // Keep the phone triangle envelope and the crack-fixed face from the 2K mesh.
    const lockFace = Uint8Array.from(positions, ([, y, z]) => y > .55 && z > -.04 ? 1 : 0);
    const [lowIndices] = MeshoptSimplifier.simplifyWithAttributes(new Uint16Array(indices),
      floats(views[0]), 3, floats(views[2]), 2, [1, 1], lockFace, 11764*3, 1, []);
    assert.ok(lowIndices.length <= 11764*3, 'Exceeded the existing phone geometry budget');
    const lowVertices = [...new Set(lowIndices)];
    const lowRemap = new Map(lowVertices.map((id, i) => [id, i]));
    compactGeometry(doc, views, views, lowVertices, Array.from(lowIndices, id => lowRemap.get(id)));
    views[doc.images[0].bufferView] = readFileSync(join(directory, 'low.jpg'));
    await stageExport(doc, views, lowOutput);
    const far = readGLB(readFileSync(new URL(metadata.runtime_exports.lod1, assets)));
    far.views[far.doc.images[0].bufferView] = readFileSync(join(directory, 'far.jpg'));
    await stageExport(far.doc, far.views, farOutput);
  }
  const created = [];
  try {
    for (const {targetPath, result} of exports) {
      writeFileSync(targetPath, result, {flag:'wx'});
      created.push(targetPath);
    }
  } catch (error) {
    for (const path of created) rmSync(path);
    throw error;
  }
  for (const {targetPath, result, triangles, issues} of exports) {
    console.log(JSON.stringify({targetPath, triangles, bytes:result.length,
      errors:issues.numErrors, warnings:issues.numWarnings}));
  }
} finally {
  rmSync(directory, {recursive:true, force:true});
}
