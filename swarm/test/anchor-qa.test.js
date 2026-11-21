'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { crc32, deflateSync, inflateSync } = require('node:zlib');
const { compare } = require('../tools/anchor-qa');

const black = [0, 0, 0], white = [255, 255, 255];
const withoutImage = { includeImage: false };

function chunk(type, data) {
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  const content = Buffer.concat([Buffer.from(type), data]);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(content));
  return Buffer.concat([length, content, checksum]);
}

function fixture(width, height, pixel, { type = 2, depth = 8, palette, transparency, interlaced, filters = [0] } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = depth;
  header[9] = type;
  header[12] = Number(Boolean(interlaced));
  // Place coordinates into their numbered Adam7 pass, then emit the rows in pass order.
  const adam7 = [[1, 6, 4, 6, 2, 6, 4, 6], [7], [5, 6, 5, 6, 5, 6, 5, 6], [7], [3, 6, 4, 6, 3, 6, 4, 6], [7], [5, 6, 5, 6, 5, 6, 5, 6], [7]];
  const passes = Array.from({ length: interlaced ? 7 : 1 }, () => Array.from({ length: height }, () => []));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pass = interlaced ? adam7[y % 8][x % adam7[y % 8].length] - 1 : 0;
      passes[pass][y].push(pixel(x, y));
    }
  }
  const scanlines = [];
  for (const pass of passes) {
    let previous = [];
    for (const row of pass.filter(pixels => pixels.length)) {
      const type = filters[scanlines.length % filters.length];
      const flat = row.flat(), channels = row[0].length;
      const encoded = flat.map((value, i) => {
        const a = flat[i - channels] ?? 0, b = previous[i] ?? 0, c = previous[i - channels] ?? 0;
        const predictors = [a, b, c];
        const paeth = predictors.reduce((best, next) => Math.abs(a + b - c - next) < Math.abs(a + b - c - best) ? next : best);
        return value - [0, a, b, (a + b) >> 1, paeth][type];
      });
      scanlines.push(Buffer.from([type, ...encoded]));
      previous = flat;
    }
  }
  const compressed = deflateSync(Buffer.concat(scanlines));
  const middle = Math.floor(compressed.length / 2);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    ...(palette ? [chunk('PLTE', Buffer.from(palette))] : []),
    ...(transparency ? [chunk('tRNS', Buffer.from(transparency))] : []),
    chunk('IDAT', compressed.subarray(0, middle)), chunk('IDAT', compressed.subarray(middle)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function outputPixel(png, x, y) {
  const width = png.readUInt32BE(16);
  assert.equal(png.toString('ascii', 37, 41), 'IDAT');
  const raw = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)));
  const offset = y * (width * 3 + 1);
  assert.equal(raw[offset], 0);
  return Array.from(raw.subarray(offset + 1 + x * 3, offset + 4 + x * 3));
}

test('equal images score 100 and render identical content in all three panels', () => {
  const image = fixture(48, 48, (x, y) => x < y ? [22, 80, 132] : white);
  const result = compare(image, image);
  assert.equal(result.score, 100);
  assert.equal(result.pass, true);
  assert.equal(result.threshold, 80);
  assert.equal(Object.values(result.weights).reduce((sum, weight) => sum + weight, 0), 100);
  assert.equal(result.grid.cells.length, 192);
  assert.equal(result.rowBands.bands.length, 16);
  assert.deepEqual(result.grid.biggestDeviations, []);
  assert.deepEqual(result.rowBands.biggestDeviations, []);
  assert.equal(result.comparePng.readUInt32BE(16), 160);
  assert.equal(result.comparePng.readUInt32BE(20), 48);
  for (const x of [4, 60, 116]) assert.deepEqual(outputPixel(result.comparePng, x, 20), [22, 80, 132]);
});

test('matching normalized layouts pass at different pixel sizes', () => {
  const a = fixture(48, 48, x => x < 24 ? black : white);
  const b = fixture(96, 96, x => x < 48 ? black : white);
  const result = compare(a, b, { ...withoutImage, grid: '4x4' });
  assert.equal(result.score, 100);
  assert.equal(result.aspect.distance, 0);
  assert.equal(result.comparePng, undefined);
});

test('same colors in unrelated layouts still fail', () => {
  const vertical = fixture(96, 96, x => x < 48 ? black : white);
  const horizontal = fixture(96, 96, (_, y) => y < 48 ? black : white);
  const result = compare(vertical, horizontal, { ...withoutImage, grid: '4x4' });
  assert.equal(result.palette.distance, 0);
  assert.equal(result.aspect.distance, 0);
  assert.ok(result.grid.distance > 0.6);
  assert.ok(result.rowBands.distance > 0.9);
  assert.equal(result.pass, false);
  const mirror = compare(horizontal, vertical, { ...withoutImage, grid: '4x4' });
  assert.equal(mirror.score, result.score);
});

test('localized changes rank the affected cells and tint only deviating areas', () => {
  const a = fixture(96, 96, () => black);
  const b = fixture(96, 96, (x, y) => x >= 48 && y >= 48 ? white : black);
  const result = compare(a, b, { grid: '4x4' });
  const [first] = result.grid.biggestDeviations;
  assert.equal(result.pass, false);
  assert.deepEqual([first.row, first.column, first.deviation], [3, 3, 1]);
  assert.equal(result.rowBands.biggestDeviations[0].row, 3);
  assert.deepEqual(outputPixel(result.comparePng, 10, 10), black);
  assert.deepEqual(outputPixel(result.comparePng, 104 + 75, 75), white);
  assert.deepEqual(outputPixel(result.comparePng, 208 + 10, 10), black);
  assert.deepEqual(outputPixel(result.comparePng, 208 + 75, 75), [255, 51, 75]);
});

test('dense edges raise grid deviation even at the same average luminance', () => {
  const flat = fixture(48, 48, () => [188, 188, 188]);
  const stripes = fixture(48, 48, x => x % 2 ? white : black);
  const { grid } = compare(flat, stripes, { ...withoutImage, grid: '2x2' });
  assert.ok(grid.cells[0].luminanceDelta < 0.004);
  assert.equal(grid.cells[0].anchor.edgeDensity, 0);
  assert.equal(grid.cells[0].screenshot.edgeDensity, 1);
  assert.equal(grid.cells[0].deviation, 1);

  const halfStripes = fixture(48, 48, x => x >= 24 && x % 2 ? white : black);
  const mixed = compare(flat, halfStripes, { ...withoutImage, grid: '2x2' });
  assert.ok(mixed.grid.cells.every(cell => cell.deviation === 1));
  assert.equal(mixed.grid.biggestDeviations[0].column, 2);
});

test('reports a maximum of six palette entries with ordered pixel shares', () => {
  const colors = [[250, 2, 2], [250, 125, 2], [250, 250, 2], [2, 250, 2], [2, 250, 250], [2, 2, 250], [125, 2, 250]];
  const a = fixture(70, 30, x => colors[Math.floor(x / 10)]);
  const b = fixture(70, 30, () => black);
  const { palette } = compare(a, b, withoutImage);
  assert.equal(palette.anchor.length, 6);
  assert.deepEqual(palette.screenshot, [{ rgb: black, hex: '#000000', share: 1 }]);
  const shares = palette.anchor.map(color => color.share);
  assert.deepEqual(shares, [...shares].sort((x, y) => y - x));
  assert.ok(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1) < 1e-12);
  assert.ok(palette.distance > 0.5);
});

test('reports aspect mismatch and measured section height shifts in pixels', () => {
  const anchor = fixture(48, 96, (_, y) => y < 48 ? white : black);
  const shot = fixture(96, 96, (_, y) => y < 72 ? white : black);
  const { aspect, sections } = compare(anchor, shot, { ...withoutImage, grid: '2x4' });
  assert.deepEqual(aspect, { anchor: { width: 48, height: 96, ratio: 0.5 }, screenshot: { width: 96, height: 96, ratio: 1 }, distance: 1 });
  assert.deepEqual(sections.anchor.map(section => section.heightPx), [48, 48]);
  assert.deepEqual(sections.screenshot.map(section => section.heightPx), [72, 24]);
  assert.deepEqual(sections.screenshot.map(section => section.height), [0.75, 0.25]);
  assert.equal(sections.distance, 1);
});

test('decodes every 8-bit color type, including explicit and keyed transparency', () => {
  const a = fixture(16, 10, x => x < 8 ? white : [104, 104, 104]);
  const variants = [
    fixture(16, 10, x => [x < 8 ? 0 : 104], { type: 0, transparency: [0, 0] }),
    fixture(16, 10, x => x < 8 ? [10, 20, 30] : [104, 104, 104], { type: 2, transparency: [0, 10, 0, 20, 0, 30] }),
    fixture(16, 10, x => [x < 8 ? 0 : 1], { type: 3, palette: [40, 80, 120, 104, 104, 104], transparency: [0] }),
    fixture(16, 10, x => x < 8 ? [16, 0] : [0, 151], { type: 4 }),
    fixture(16, 10, x => x < 8 ? [11, 17, 23, 0] : [104, 104, 104, 255], { type: 6 }),
  ];
  for (const variant of variants) assert.equal(compare(a, variant, withoutImage).score, 100);
});

test('decodes all PNG row filters in sequential and Adam7 scanlines', () => {
  const color = (x, y) => [(27 * x + 41 * y) % 256, (13 * x + 23 * y) % 256, (11 * x + 31 * y) % 256];
  const unfiltered = fixture(19, 17, color);
  for (const interlaced of [false, true]) {
    const filtered = fixture(19, 17, color, { interlaced, filters: [0, 1, 2, 3, 4] });
    assert.equal(compare(unfiltered, filtered, withoutImage).score, 100);
  }
});

test('rejects invalid options and unsupported or broken PNG data', () => {
  const a = fixture(8, 8, () => black);
  const wrongCrc = Buffer.from(a);
  wrongCrc[29] ^= 0xff;
  assert.throws(() => compare(a, wrongCrc), /checksum/);
  assert.throws(() => compare(a, a.subarray(0, -12)), /Incomplete PNG/);
  assert.throws(() => compare(a, fixture(8, 8, () => black, { depth: 16 })), /8-bit PNG/);
  assert.throws(() => compare(a, fixture(8, 8, () => [1], { type: 3, palette: black })), /missing palette entry/);
  assert.throws(() => compare(a, Buffer.alloc(0)), /Expected a PNG/);
  for (const grid of ['0x2', '65x64', 'garbage']) assert.throws(() => compare(a, a, { grid }), /Grid must be/);
  for (const threshold of [-1, 101, NaN, '90']) assert.throws(() => compare(a, a, { threshold }), /Threshold must be/);
});

test('CLI produces consistent Markdown, JSON, PNG, and threshold exit statuses', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-qa-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const [a, b, report, json] = ['a.png', 'b.png', 'result.md', 'result.json'].map(name => path.join(directory, name));
  const image = fixture(48, 48, () => black);
  fs.writeFileSync(a, image);
  fs.writeFileSync(b, fixture(48, 48, (_, y) => y < 24 ? black : white));
  const cli = (shot, ...args) => spawnSync(process.execPath, [path.join(__dirname, '../tools/anchor-qa.js'), a, shot, ...args], { encoding: 'utf8' });
  assert.equal(cli(a, '--threshold', '100').status, 0);
  const fail = cli(b, '--out', report, '--json', json, '--grid', '2x3', '--threshold', '95.5');
  assert.equal(fail.status, 1, fail.stderr);
  const result = JSON.parse(fs.readFileSync(json, 'utf8'));
  assert.equal(result.pass, false);
  assert.equal(result.threshold, 95.5);
  assert.equal(result.grid.cells.length, 6);
  assert.equal(result.comparePng, undefined);
  const markdown = fs.readFileSync(report, 'utf8');
  assert.match(markdown, /\*\*FAIL\*\*/);
  assert.match(markdown, /Row \d, column \d/);
  assert.match(markdown, /\(result\.md\.compare\.png\)/);
  assert.deepEqual(outputPixel(fs.readFileSync(`${report}.compare.png`), 4, 40), black);
  assert.equal(cli(b, '--threshold', '0').status, 0);
  assert.equal(cli(a, '--threshold', 'bad').status, 2);
  const overwrite = cli(a, '--out', a);
  assert.equal(overwrite.status, 2);
  assert.deepEqual(fs.readFileSync(a), image);
});
