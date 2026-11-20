import assert from 'node:assert/strict';

// Read embedded pixel dimensions independently of the Node bitmap placeholder.
export function atlasDimensions(bytes, mimeType) {
  if (mimeType === 'image/png') {
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  assert.equal(mimeType, 'image/jpeg');
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  for (let offset = 2; offset + 8 < bytes.length;) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker))
      return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    assert.ok(length >= 2 && marker !== 0xda, 'expected a JPEG frame header before scan data');
    offset += 2 + length;
  }
  assert.fail('Missing JPEG frame');
}
