import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {INTERIOR_ADDITIONS} from '../demos/corporate/gjh/v11/assets/interior-additions-registry.js';
import {INTERIOR_PILOT} from '../demos/corporate/gjh/v11/assets/interior-pilot-registry.js';

const assets = new URL('../demos/corporate/gjh/v11/assets/', import.meta.url);
const startup = JSON.parse(readFileSync(new URL('../../../../../data/gjh-startup-assets.json', assets), 'utf8'));
const glbJson = buffer => {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString('utf8', 20, 20 + length));
};

test('interior additions match their files and the strict static loader rules', () => {
  const entries = Object.values(INTERIOR_ADDITIONS);
  assert.equal(entries.length, 11);
  const ids = new Set(entries.map(entry => entry.asset_id));
  assert.equal(ids.size, entries.length);
  for (const entry of entries) {
    assert.ok(!Object.values(INTERIOR_PILOT).some(pilot => pilot.asset_id === entry.asset_id), `${entry.asset_id} reuses a pilot id`);
    const data = readFileSync(new URL(entry.file, assets));
    assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256, entry.file);
    assert.equal(data.length, entry.bytes);
    assert.ok(data.length <= 256000, `${entry.file} is larger than 250 KB`);
    const json = glbJson(data);
    for (const key of ['images', 'textures', 'animations', 'skins']) assert.equal((json[key] ?? []).length, 0, `${entry.file} has ${key}`);
    assert.ok(!(json.buffers ?? []).some(buffer => buffer.uri) && !(json.extensionsRequired ?? []).length);
    assert.ok(json.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0) <= 16);
    const root = json.nodes.find(node => node.name === entry.asset_id);
    assert.equal(root?.extras?.asset_id, entry.asset_id);
    assert.equal(entry.dimensions_m.length, 3);
    assert.match(entry.rights, /unspecified/);
  }
});

test('only placed additions travel in the startup pack', () => {
  for (const entry of Object.values(INTERIOR_ADDITIONS)) {
    assert.equal(startup.includes(entry.file), entry.placed, entry.file);
  }
});
