'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { crc32, deflateSync } = require('node:zlib');
const { compare } = require('../tools/visual-compare');

const SAME = { differentRatio: 0, pass: true };

function chunk(name, bytes) {
  const payload = Buffer.concat([Buffer.from(name), bytes]);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, crc]);
}

function png(width, height, type, rows, { palette, alpha, interlace = 0, depth = 8 } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = depth;
  header[9] = type;
  header[12] = interlace;
  const data = deflateSync(Buffer.from(rows.flat()));
  const halfway = Math.floor(data.length / 2);
  const chunks = [chunk('IHDR', header)];
  if (palette) chunks.push(chunk('PLTE', Buffer.from(palette)));
  if (alpha) chunks.push(chunk('tRNS', Buffer.from(alpha)));
  chunks.push(chunk('IDAT', data.subarray(0, halfway)), chunk('IDAT', data.subarray(halfway)), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ...chunks]);
}

test('decodes all five 8-bit colour types into equivalent RGBA pixels', () => {
  const opaque = png(2, 1, 6, [[0, 25, 25, 25, 255, 125, 125, 125, 255]]);
  const translucent = png(2, 1, 6, [[0, 25, 25, 25, 64, 125, 125, 125, 255]]);
  const palette = [25, 25, 25, 125, 125, 125];
  assert.deepEqual(compare(png(2, 1, 0, [[0, 25, 125]]), opaque), SAME);
  assert.deepEqual(compare(png(2, 1, 2, [[0, ...palette]]), opaque), SAME);
  assert.deepEqual(compare(png(2, 1, 3, [[0, 0, 1]], { palette, alpha: [64] }), translucent), SAME);
  assert.deepEqual(compare(png(2, 1, 4, [[0, 25, 64, 125, 255]]), translucent), SAME);
  assert.deepEqual(compare(png(2, 1, 6, [[0, 25, 25, 25, 64, 125, 125, 125, 255]]), translucent), SAME);
});

test('decodes grayscale and RGB transparency keys', () => {
  const rgba = png(2, 1, 6, [[0, 23, 23, 23, 0, 7, 7, 7, 255]]);
  assert.deepEqual(compare(png(2, 1, 0, [[0, 23, 7]], { alpha: [0, 23] }), rgba), SAME);
  assert.deepEqual(compare(png(2, 1, 2, [[0, 23, 23, 23, 7, 7, 7]], { alpha: [0, 23, 0, 23, 0, 23] }), rgba), SAME);
});

test('reverses row filters 0 through 4 with byte wraparound and channel strides', () => {
  const base = png(2, 5, 0, [[0, 10, 50], [0, 20, 30], [0, 2, 100], [0, 100, 10], [0, 90, 140]]);
  const filtered = png(2, 5, 0, [[0, 10, 50], [1, 20, 10], [2, 238, 70], [3, 99, 166], [4, 246, 130]]);
  assert.deepEqual(compare(filtered, base), SAME);
  const rgb = png(2, 1, 2, [[1, 1, 2, 3, 5, 2, 5]]);
  assert.deepEqual(compare(rgb, png(2, 1, 2, [[0, 1, 2, 3, 6, 4, 8]])), SAME);
});

test('reassembles Adam7 pixels in row order, including images with empty passes', () => {
  const base = png(3, 3, 0, [[0, 11, 12, 13], [0, 14, 15, 16], [0, 17, 18, 19]]);
  const interlaced = png(3, 3, 0, [[0, 11], [0, 13], [1, 17, 2], [0, 12], [2, 6], [0, 14, 15, 16]], { interlace: 1 });
  assert.deepEqual(compare(interlaced, base), SAME);
});

test('counts each changed pixel once and includes the threshold boundary', () => {
  const black = Array(50).fill(0);
  const a = png(50, 1, 0, [[0, ...black]]);
  black[49] = 255;
  assert.deepEqual(compare(a, png(50, 1, 0, [[0, ...black]])), { differentRatio: 0.02, pass: true });
  black[0] = 255;
  assert.deepEqual(compare(a, png(50, 1, 0, [[0, ...black]])), { differentRatio: 0.04, pass: false });
  const transparent = png(1, 1, 6, [[0, 0, 0, 0, 0]]);
  assert.deepEqual(compare(transparent, png(1, 1, 0, [[0, 0]])), { differentRatio: 1, pass: false });
});

test('different dimensions fail even if the threshold is one', () => {
  const a = png(2, 1, 0, [[0, 0, 0]]);
  const b = png(1, 2, 0, [[0, 0], [0, 0]]);
  assert.deepEqual(compare(a, b, { threshold: 1 }), { differentRatio: 1, pass: false });
});

test('rejects invalid PNG signatures, checksums, row lengths and unsupported depth or filters', () => {
  const valid = png(1, 1, 0, [[0, 0]]);
  const corrupt = Buffer.from(valid);
  corrupt[29] ^= 1;
  assert.throws(() => compare(Buffer.from('bad PNG'), valid), /signature/);
  assert.throws(() => compare(corrupt, valid), /checksum/);
  assert.throws(() => compare(png(1, 1, 0, [[0]]), valid), /image data length/);
  assert.throws(() => compare(png(1, 1, 0, [[0, 0]], { depth: 4 }), valid), /8-bit PNG/);
  assert.throws(() => compare(png(1, 1, 0, [[5, 0]]), valid), /filter 5/);
});

test('the CLI writes the diff mask, prints JSON, and uses the pass/fail exit status', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-visual-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const [a, b, diff] = ['a.png', 'b.png', 'diff.png'].map(file => path.join(directory, file));
  fs.writeFileSync(a, png(2, 2, 0, [[0, 0, 0], [0, 0, 0]]));
  fs.writeFileSync(b, png(2, 2, 0, [[0, 0, 0], [0, 0, 255]]));
  const tool = require.resolve('../tools/visual-compare');
  const run = (...args) => spawnSync(process.execPath, [tool, a, b, ...args], { encoding: 'utf8' });
  const fail = run('--out', diff);
  const pass = run('--threshold', '0.25');
  assert.equal(fail.status, 1, fail.stderr);
  assert.deepEqual(JSON.parse(fail.stdout), { differentRatio: 0.25, pass: false });
  assert.equal(pass.status, 0, pass.stderr);
  assert.deepEqual(JSON.parse(pass.stdout), { differentRatio: 0.25, pass: true });
  const expected = png(2, 2, 6, [[0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 255, 0, 255, 255]]);
  assert.deepEqual(compare(fs.readFileSync(diff), expected), SAME);
  const invalid = run('--threshold', '1.01');
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /between 0 and 1/);
});
