#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { constants: { MAX_LENGTH } } = require('node:buffer');
const { parseArgs } = require('node:util');
const { crc32, deflateSync, inflateSync } = require('node:zlib');

const SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
const DEFAULT_THRESHOLD = 0.02;

function readPng(input) {
  if (!Buffer.isBuffer(input) || !input.subarray(0, 8).equals(SIGNATURE)) throw new Error('Invalid PNG signature');
  const compressed = [];
  let header, palette, transparency;
  for (let offset = 8; offset + 12 <= input.length;) {
    const length = input.readUInt32BE(offset);
    const end = offset + 8 + length;
    if (end + 4 > input.length) throw new Error('Truncated PNG chunk');
    const type = input.toString('ascii', offset + 4, offset + 8);
    if (crc32(input.subarray(offset + 4, end)) !== input.readUInt32BE(end)) throw new Error(`Invalid PNG ${type} checksum`);
    const data = input.subarray(offset + 8, end);
    if (!header && type !== 'IHDR') throw new Error('Missing PNG header');

    switch (type) {
      case 'IHDR':
        if (header || length !== 13) throw new Error('Invalid PNG header');
        header = data;
        break;
      case 'PLTE':
        if (!length || length > 768 || length % 3) throw new Error('Invalid PNG palette');
        palette = data;
        break;
      case 'tRNS':
        transparency = data;
        break;
      case 'IDAT':
        compressed.push(data);
        break;
      case 'IEND':
        if (length || !compressed.length) throw new Error('Invalid PNG image data');
        return { header, palette, transparency, compressed };
      default:
        if (!(input[offset + 4] & 0x20)) throw new Error(`Unsupported PNG chunk ${type}`);
    }
    offset = end + 4;
  }
  throw new Error('Missing PNG end chunk');
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const a = Math.abs(estimate - left);
  const b = Math.abs(estimate - up);
  const c = Math.abs(estimate - upperLeft);
  if (a <= b && a <= c) return left;
  return b <= c ? up : upperLeft;
}

function unfilter(data, start, stride, channels, previous) {
  const filter = data[start - 1];
  if (filter > 4) throw new Error(`Unsupported PNG filter ${filter}`);
  if (filter === 0) return;
  for (let i = 0; i < stride; i++) {
    const left = i >= channels ? data[start + i - channels] : 0;
    const up = previous === null ? 0 : data[previous + i];
    const upperLeft = previous !== null && i >= channels ? data[previous + i - channels] : 0;
    switch (filter) {
      case 1: data[start + i] += left; break;
      case 2: data[start + i] += up; break;
      case 3: data[start + i] += (left + up) >> 1; break;
      case 4: data[start + i] += paeth(left, up, upperLeft); break;
    }
  }
}

function decodePng(input) {
  const { header, palette, transparency, compressed } = readPng(input);
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const [depth, type, compression, filter, interlace] = header.subarray(8);
  const channels = CHANNELS[type];
  if (depth !== 8 || !channels || compression || filter || interlace > 1) throw new Error('Unsupported PNG format; expected an 8-bit PNG');

  const byteLength = width * height * 4;
  if (!width || !height || width > 0x7fffffff || height > 0x7fffffff || !Number.isSafeInteger(byteLength) || byteLength > MAX_LENGTH) {
    throw new Error('Invalid PNG dimensions');
  }
  if (type === 3 && !palette) throw new Error('Missing PNG palette');
  if (transparency && !((type === 0 && transparency.length === 2) || (type === 2 && transparency.length === 6)
      || (type === 3 && transparency.length <= palette.length / 3))) {
    throw new Error('Invalid PNG transparency');
  }

  const passes = (interlace ? ADAM7 : [[0, 0, 1, 1]]).map(([x, y, dx, dy]) => ({
    x, y, dx, dy, columns: Math.ceil((width - x) / dx), rows: Math.ceil((height - y) / dy),
  })).filter(({ columns, rows }) => columns > 0 && rows > 0);
  const expected = passes.reduce((bytes, { columns, rows }) => bytes + rows * (1 + columns * channels), 0);
  if (!Number.isSafeInteger(expected) || expected > MAX_LENGTH) throw new Error('PNG image data is too large');
  const data = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (data.length !== expected) throw new Error('Invalid PNG image data length');

  const pixels = Buffer.allocUnsafe(byteLength);
  const key = type === 0 ? transparency?.readUInt16BE(0) : undefined;
  const redKey = type === 2 ? transparency?.readUInt16BE(0) : undefined;
  const greenKey = type === 2 ? transparency?.readUInt16BE(2) : undefined;
  const blueKey = type === 2 ? transparency?.readUInt16BE(4) : undefined;
  let offset = 0;
  for (const { x, y, dx, dy, columns, rows } of passes) {
    const stride = columns * channels;
    let previous = null;
    for (let row = 0; row < rows; row++) {
      const start = offset + 1;
      unfilter(data, start, stride, channels, previous);
      for (let column = 0; column < columns; column++) {
        const index = start + column * channels;
        const dest = ((y + row * dy) * width + x + column * dx) * 4;
        const first = data[index];
        if (type === 3) {
          const color = first * 3;
          if (color >= palette.length) throw new Error('PNG palette index out of range');
          pixels[dest] = palette[color];
          pixels[dest + 1] = palette[color + 1];
          pixels[dest + 2] = palette[color + 2];
          pixels[dest + 3] = transparency?.[first] ?? 255;
        } else if (type === 0 || type === 4) {
          pixels[dest] = first;
          pixels[dest + 1] = first;
          pixels[dest + 2] = first;
          pixels[dest + 3] = type === 4 ? data[index + 1] : first === key ? 0 : 255;
        } else {
          const green = data[index + 1];
          const blue = data[index + 2];
          pixels[dest] = first;
          pixels[dest + 1] = green;
          pixels[dest + 2] = blue;
          pixels[dest + 3] = type === 6 ? data[index + 3] : first === redKey && green === greenKey && blue === blueKey ? 0 : 255;
        }
      }
      previous = start;
      offset = start + stride;
    }
  }
  return { width, height, pixels };
}

function chunk(type, data) {
  const output = Buffer.allocUnsafe(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  output.write(type, 4, 'ascii');
  data.copy(output, 8);
  output.writeUInt32BE(crc32(output.subarray(4, -4)), output.length - 4);
  return output;
}

function encodeDiff(width, height, rows) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

function compare(bufA, bufB, { threshold = DEFAULT_THRESHOLD, out } = {}) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('Threshold must be between 0 and 1');
  const a = decodePng(bufA);
  const b = decodePng(bufB);
  const { width, height } = a;
  if (width !== b.width || height !== b.height) return { differentRatio: 1, pass: false };

  // Each diff scanline uses filter 0. Unchanged pixels are transparent.
  const rows = out === undefined ? null : Buffer.alloc((width * 4 + 1) * height);
  let different = 0;
  for (let pixel = 0; pixel < width * height; pixel++) {
    const offset = pixel * 4;
    if (a.pixels.readUInt32BE(offset) === b.pixels.readUInt32BE(offset)) continue;
    different++;
    if (rows) rows.writeUInt32BE(0xff00ffff, offset + Math.floor(pixel / width) + 1);
  }
  if (rows) fs.writeFileSync(out, encodeDiff(width, height, rows));
  const differentRatio = different / (width * height);
  return { differentRatio, pass: differentRatio <= threshold };
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, threshold: { type: 'string' } },
  });
  if (positionals.length !== 2) {
    throw new Error('Usage: node swarm/tools/visual-compare.js a.png b.png [--out diff.png] [--threshold 0.02]');
  }
  const threshold = values.threshold === undefined ? DEFAULT_THRESHOLD : Number(values.threshold.trim() || NaN);
  const result = compare(...positionals.map(file => fs.readFileSync(file)), { threshold, out: values.out });
  console.log(JSON.stringify(result));
  if (!result.pass) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { compare };
