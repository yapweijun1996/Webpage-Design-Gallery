import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

for (const [tier, budget] of Object.entries({low:900, balanced:1800, detailed:3000})) {
  test(tier + ' carriage fits the swept envelope and opaque draw budget', async () => {
    const file = new URL('../demos/corporate/gjh/v11/assets/tram/' + tier + '.glb', import.meta.url);
    const bytes = await readFile(file);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const doc = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert.equal(doc.asset.version, '2.0');
    assert.equal(doc.materials.length, 1);
    const [material] = doc.materials;
    assert.equal(material.alphaMode ?? 'OPAQUE', 'OPAQUE');
    assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);
    assert.ok(material.emissiveTexture && material.emissiveFactor.every(x => x > 0));
    assert.ok(doc.images.every(image => image.bufferView !== undefined && !image.uri));
    const nodes = doc.scenes[doc.scene].nodes.map(index => doc.nodes[index]);
    const [car] = nodes.filter(node => node.mesh !== undefined);
    assert.equal(nodes.length, 3);
    const [primitive] = doc.meshes[car.mesh].primitives;
    assert.equal(doc.meshes[car.mesh].primitives.length, 1);
    const triangles = doc.accessors[primitive.indices].count / 3;
    assert.ok(triangles > 0 && triangles <= budget, String(triangles));
    const bounds = doc.accessors[primitive.attributes.POSITION];
    const close = (actual, expected) => actual.forEach((x,i) => assert.ok(Math.abs(x-expected[i]) < 1e-5));
    close(bounds.min, [-.7,0,-1.5]);
    close(bounds.max, [.7,2.2,1.5]);
    const seat = nodes.find(node => node.name === 'TramSeatAnchor');
    close(seat.translation, [-.48,.705,.73]);
    close(seat.rotation, [0,-Math.SQRT1_2,0,Math.SQRT1_2]);
    close(nodes.find(node => node.name === 'TramLamp').translation, [0,.79,1.484]);
  });
}
