#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { parseArgs } = require('node:util');
const { crc32, deflateSync, inflateSync } = require('node:zlib');

const USAGE = 'Usage: node swarm/tools/anchor-qa.js anchor.png screenshot.png [--out report.md] [--json report.json] [--grid 12x16] [--threshold 80]';
const DEFAULT_THRESHOLD = 80;
const WEIGHTS = Object.freeze({ palette: 25, grid: 45, rowBands: 15, aspect: 10, sections: 5 });
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
// Passes are [startX, startY, stepX, stepY]. https://www.w3.org/TR/png-3/#8InterlaceMethods
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];
const MAX_PIXELS = 24_000_000;
const SAMPLES_PER_CELL = 24;
const EDGE_THRESHOLD = 0.10;
const SECTION_THRESHOLD = 0.28;

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const dl = Math.abs(estimate - left), da = Math.abs(estimate - above), du = Math.abs(estimate - upperLeft);
  if (dl <= da && dl <= du) return left;
  return da <= du ? above : upperLeft;
}

function unfilter(data, start, stride, channels, firstRow) {
  const filter = data[start - 1];
  if (filter === 0) return;
  if (filter > 4) throw new Error(`Unsupported PNG row filter ${filter}`);
  for (let byte = 0; byte < stride; byte++) {
    const index = start + byte;
    const left = byte >= channels ? data[index - channels] : 0;
    const above = firstRow ? 0 : data[index - stride - 1];
    const upperLeft = firstRow || byte < channels ? 0 : data[index - stride - 1 - channels];
    let predictor;
    if (filter === 1) predictor = left;
    else if (filter === 2) predictor = above;
    else if (filter === 3) predictor = Math.floor((left + above) / 2);
    else predictor = paeth(left, above, upperLeft);
    data[index] += predictor;
  }
}

function decodePng(png) {
  if (!Buffer.isBuffer(png) || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Expected a PNG buffer');
  let header, palette, transparency, ended = false;
  const compressed = [];
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const end = offset + 8 + length;
    const type = png.toString('latin1', offset + 4, offset + 8);
    if (end + 4 > png.length) throw new Error(`Truncated PNG ${type} chunk`);
    if (crc32(png.subarray(offset + 4, end)) !== png.readUInt32BE(end)) throw new Error(`Invalid PNG ${type} checksum`);
    const data = png.subarray(offset + 8, end);
    if (!header && type !== 'IHDR') throw new Error('PNG header must come first');
    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('Invalid PNG header');
      header = data;
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') {
      if (length !== 0) throw new Error('Invalid PNG end chunk');
      ended = true;
      break;
    } else if (!(png[offset + 4] & 32)) throw new Error(`Unsupported PNG chunk ${type}`);
    offset = end + 4;
  }
  if (!header || !compressed.length || !ended) throw new Error('Incomplete PNG');

  const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
  const [depth, type, compression, filter, interlace] = header.subarray(8);
  const channels = CHANNELS[type];
  if (!width || !height || width * height > MAX_PIXELS) throw new Error(`PNG dimensions must fit within ${MAX_PIXELS} pixels`);
  if (depth !== 8 || !channels || compression || filter || interlace > 1) throw new Error('Expected a supported 8-bit PNG');
  if (type === 3 && (!palette?.length || palette.length > 768 || palette.length % 3)) throw new Error('Invalid PNG palette');
  if (transparency && !((type === 0 && transparency.length === 2) || (type === 2 && transparency.length === 6) ||
    (type === 3 && transparency.length > 0 && transparency.length <= palette.length / 3))) {
    throw new Error('Invalid PNG transparency');
  }
  const transparentGray = type === 0 && transparency ? transparency.readUInt16BE(0) : -1;
  const transparentRgb = type === 2 && transparency ? [0, 2, 4].map(i => transparency.readUInt16BE(i)) : [];
  const passes = (interlace ? ADAM7 : [[0, 0, 1, 1]]).map(([x, y, dx, dy]) => ({
    x, y, dx, dy, columns: Math.ceil((width - x) / dx), rows: Math.ceil((height - y) / dy),
  })).filter(pass => pass.columns > 0 && pass.rows > 0);
  const expected = passes.reduce((size, pass) => size + (pass.columns * channels + 1) * pass.rows, 0);
  const data = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (data.length !== expected) throw new Error('Invalid PNG scanline length');

  const rgb = Buffer.allocUnsafe(width * height * 3);
  let cursor = 0;
  for (const { x, y, dx, dy, columns, rows } of passes) {
    const stride = columns * channels;
    for (let row = 0; row < rows; row++) {
      const start = cursor + 1;
      unfilter(data, start, stride, channels, row === 0);
      for (let column = 0; column < columns; column++) {
        const source = start + column * channels;
        let red = data[source], green = red, blue = red, alpha = 255;
        if (type === 2 || type === 6) {
          green = data[source + 1];
          blue = data[source + 2];
          if (type === 6) alpha = data[source + 3];
          else if (red === transparentRgb[0] && green === transparentRgb[1] && blue === transparentRgb[2]) alpha = 0;
        } else if (type === 3) {
          const index = red * 3;
          if (index >= palette.length) throw new Error('PNG pixel references a missing palette entry');
          alpha = transparency?.[red] ?? 255;
          red = palette[index];
          green = palette[index + 1];
          blue = palette[index + 2];
        } else if (type === 4) alpha = data[source + 1];
        else if (red === transparentGray) alpha = 0;
        const dest = ((y + row * dy) * width + x + column * dx) * 3;
        rgb[dest] = 255 - Math.round((255 - red) * alpha / 255);
        rgb[dest + 1] = 255 - Math.round((255 - green) * alpha / 255);
        rgb[dest + 2] = 255 - Math.round((255 - blue) * alpha / 255);
      }
      cursor += stride + 1;
    }
  }
  return { width, height, rgb };
}

function pngChunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  result.write(type, 4, 'latin1');
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
  return result;
}

function encodePng({ width, height, rgb }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const stride = width * 3;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(scanlines)), pngChunk('IEND', Buffer.alloc(0))]);
}

function colorBox(colors) {
  const min = [255, 255, 255], max = [0, 0, 0], sums = [0, 0, 0];
  let count = 0;
  for (const color of colors) {
    count += color.count;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], color.rgb[i]);
      max[i] = Math.max(max[i], color.rgb[i]);
      sums[i] += color.rgb[i] * color.count;
    }
  }
  const ranges = max.map((value, i) => value - min[i]);
  const range = Math.max(...ranges);
  return { colors, count, axis: ranges.indexOf(range), priority: range * count, rgb: sums.map(sum => sum / count) };
}

function dominantPalette({ rgb }) {
  // Binning bounds median-cut work while keeping the original channel averages.
  const bins = Array(32768);
  for (let i = 0; i < rgb.length; i += 3) {
    const red = rgb[i], green = rgb[i + 1], blue = rgb[i + 2];
    const key = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
    const bin = bins[key] ?? (bins[key] = { count: 0, sums: [0, 0, 0] });
    bin.count++;
    bin.sums[0] += red;
    bin.sums[1] += green;
    bin.sums[2] += blue;
  }
  const boxes = [colorBox(bins.filter(Boolean).map(({ count, sums }) => ({ count, rgb: sums.map(sum => sum / count) })))];
  while (boxes.length < 6) {
    boxes.sort((a, b) => b.priority - a.priority);
    const { colors, count, axis, priority } = boxes[0];
    if (!priority) break;
    colors.sort((a, b) => a.rgb[axis] - b.rgb[axis]);
    let pivot = 1, lowerCount = colors[0].count;
    while (lowerCount < count / 2 && pivot < colors.length - 1) lowerCount += colors[pivot++].count;
    boxes.splice(0, 1, colorBox(colors.slice(0, pivot)), colorBox(colors.slice(pivot)));
  }
  return boxes.sort((a, b) => b.count - a.count).map(box => ({
    rgb: box.rgb,
    hex: '#' + box.rgb.map(value => Math.round(value).toString(16).padStart(2, '0')).join(''),
    share: box.count / (rgb.length / 3),
  }));
}

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const cap = value => Math.min(1, value);
const percent = value => `${(value * 100).toFixed(1)}%`;
const rgbDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.hypot(255, 255, 255);

function paletteDistance(a, b) {
  const nearest = (from, to) => from.reduce((sum, color) => sum + color.share * Math.min(...to.map(other => rgbDistance(color.rgb, other.rgb))), 0);
  const centroid = palette => [0, 1, 2].map(channel => palette.reduce((sum, color) => sum + color.rgb[channel] * color.share, 0));
  return cap(1.5 * (0.75 * mean([nearest(a, b), nearest(b, a)]) + 0.25 * rgbDistance(centroid(a), centroid(b))));
}

const LINEAR = Array.from({ length: 256 }, (_, byte) => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});

function layoutStats(image, columns, rows) {
  const { width, height, rgb } = image;
  const w = columns * SAMPLES_PER_CELL, h = rows * SAMPLES_PER_CELL;
  const luminance = new Float64Array(w * h);
  // Box averaging normalizes edges to a common sampling scale across screenshot sizes.
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * height / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * width / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / w));
      let sum = 0;
      for (let sy = y0; sy < y1; sy++) {
        let pixel = (sy * width + x0) * 3;
        for (let sx = x0; sx < x1; sx++, pixel += 3) {
          sum += 0.2126 * LINEAR[rgb[pixel]] + 0.7152 * LINEAR[rgb[pixel + 1]] + 0.0722 * LINEAR[rgb[pixel + 2]];
        }
      }
      luminance[y * w + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  const cells = Array.from({ length: columns * rows }, () => ({ luminance: 0, edgeDensity: 0 }));
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / SAMPLES_PER_CELL);
    for (let x = 0; x < w; x++) {
      const index = y * w + x;
      const cell = cells[row * columns + Math.floor(x / SAMPLES_PER_CELL)];
      const current = luminance[index];
      cell.luminance += current;
      const right = x + 1 < w ? Math.abs(current - luminance[index + 1]) : 0;
      const below = y + 1 < h ? Math.abs(current - luminance[index + w]) : 0;
      if (Math.max(right, below) >= EDGE_THRESHOLD) cell.edgeDensity++;
    }
  }
  for (const cell of cells) {
    cell.luminance /= SAMPLES_PER_CELL ** 2;
    cell.edgeDensity /= SAMPLES_PER_CELL ** 2;
  }
  const bands = Array.from({ length: rows }, (_, row) => {
    const members = cells.slice(row * columns, (row + 1) * columns);
    return { luminance: mean(members.map(cell => cell.luminance)), edgeDensity: mean(members.map(cell => cell.edgeDensity)) };
  });
  return { cells, bands };
}

function layoutDelta(a, b) {
  const deltas = {
    luminanceDelta: Math.abs(a.luminance - b.luminance),
    edgeDensityDelta: Math.abs(a.edgeDensity - b.edgeDensity),
  };
  return { ...deltas, deviation: cap(layoutSeverity(deltas)) };
}

function layoutSeverity({ luminanceDelta, edgeDensityDelta }) {
  return 2 * luminanceDelta + 4 * edgeDensityDelta;
}

function biggest(items) {
  return items.filter(item => item.deviation > 0).sort((a, b) => layoutSeverity(b) - layoutSeverity(a)).slice(0, 8);
}

function gridDistance(cells) {
  const deviations = cells.map(cell => cell.deviation).sort((a, b) => b - a);
  return 0.65 * mean(deviations) + 0.35 * mean(deviations.slice(0, Math.ceil(deviations.length / 4)));
}

function sectionProfile(bands, height) {
  const jumps = bands.slice(1).map((band, i) => layoutDelta(bands[i], band).deviation);
  const boundaries = [0];
  for (const [i, jump] of jumps.entries()) {
    if (jump >= SECTION_THRESHOLD && jump > (jumps[i - 1] ?? 0) && jump >= (jumps[i + 1] ?? 0)) boundaries.push((i + 1) / bands.length);
  }
  boundaries.push(1);
  const profile = boundaries.slice(1).map((end, i) => {
    const start = boundaries[i];
    return { start, end, height: end - start, heightPx: Math.round(end * height) - Math.round(start * height) };
  });
  return { boundaries, profile };
}

function sectionDistance(a, b) {
  // Compare internal boundaries in both directions. Page ends are fallback matches for a missing section.
  const nearest = (from, to) => from.length === 2 ? 0 : mean(from.slice(1, -1).map(point => Math.min(...to.map(other => Math.abs(point - other)))));
  return cap(4 * mean([nearest(a, b), nearest(b, a)]));
}

function compareImage(anchor, screenshot, grid) {
  const maxWidth = Math.max(anchor.width, screenshot.width), maxHeight = Math.max(anchor.height, screenshot.height);
  const scale = Math.min(1, 1000 / maxWidth, 1600 / maxHeight);
  const panel = Math.max(1, Math.round(maxWidth * scale)), height = Math.max(1, Math.round(maxHeight * scale));
  const gap = 8, width = panel * 3 + gap * 2;
  const rgb = Buffer.alloc(width * height * 3, 36);
  for (const [index, image] of [anchor, screenshot, screenshot].entries()) {
    const panelWidth = Math.max(1, Math.round(image.width * scale)), panelHeight = Math.max(1, Math.round(image.height * scale));
    const left = index * (panel + gap) + Math.floor((panel - panelWidth) / 2);
    for (let y = 0; y < panelHeight; y++) {
      const sy = Math.floor(y * image.height / panelHeight), row = Math.floor(y * grid.rows / panelHeight);
      for (let x = 0; x < panelWidth; x++) {
        const sx = Math.floor(x * image.width / panelWidth), column = Math.floor(x * grid.columns / panelWidth);
        const source = (sy * image.width + sx) * 3, dest = (y * width + left + x) * 3;
        const deviation = index === 2 ? grid.cells[row * grid.columns + column].deviation : 0;
        const opacity = 0.8 * Math.sqrt(deviation);
        rgb[dest] = Math.round(image.rgb[source] * (1 - opacity) + 255 * opacity);
        rgb[dest + 1] = Math.round(image.rgb[source + 1] * (1 - opacity) + 190 * (1 - deviation) * opacity);
        rgb[dest + 2] = Math.round(image.rgb[source + 2] * (1 - opacity) + 30 * opacity);
      }
    }
  }
  return encodePng({ width, height, rgb });
}

// opts.grid is "columnsxrows" (1 to 64 each); opts.threshold is a score from 0 to 100.
// The API returns the same metrics as --json and, unless disabled, a comparePng Buffer.
function compare(anchorBuf, shotBuf, { grid = '12x16', threshold = DEFAULT_THRESHOLD, includeImage = true } = {}) {
  const match = typeof grid === 'string' && /^([1-9]\d?)x([1-9]\d?)$/i.exec(grid);
  if (!match || Number(match[1]) > 64 || Number(match[2]) > 64) throw new Error('Grid must be columnsxrows with each dimension from 1 to 64');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error('Threshold must be a number from 0 to 100');
  const columns = Number(match[1]), rows = Number(match[2]);
  const anchor = decodePng(anchorBuf), screenshot = decodePng(shotBuf);
  const aPalette = dominantPalette(anchor), sPalette = dominantPalette(screenshot);
  const aLayout = layoutStats(anchor, columns, rows), sLayout = layoutStats(screenshot, columns, rows);
  const cells = aLayout.cells.map((cell, i) => ({
    row: Math.floor(i / columns) + 1, column: i % columns + 1,
    anchor: cell, screenshot: sLayout.cells[i], ...layoutDelta(cell, sLayout.cells[i]),
  }));
  const bands = aLayout.bands.map((band, i) => ({
    row: i + 1, anchor: band, screenshot: sLayout.bands[i], ...layoutDelta(band, sLayout.bands[i]),
  }));
  const aAspect = anchor.width / anchor.height, sAspect = screenshot.width / screenshot.height;
  const aSections = sectionProfile(aLayout.bands, anchor.height), sSections = sectionProfile(sLayout.bands, screenshot.height);
  const metrics = {
    palette: { anchor: aPalette, screenshot: sPalette, distance: paletteDistance(aPalette, sPalette) },
    grid: { columns, rows, cells, biggestDeviations: biggest(cells), distance: gridDistance(cells) },
    rowBands: { bands, biggestDeviations: biggest(bands), distance: mean(bands.map(band => band.deviation)) },
    aspect: {
      anchor: { width: anchor.width, height: anchor.height, ratio: aAspect },
      screenshot: { width: screenshot.width, height: screenshot.height, ratio: sAspect },
      distance: cap(2 * (1 - Math.min(aAspect, sAspect) / Math.max(aAspect, sAspect))),
    },
    sections: { anchor: aSections.profile, screenshot: sSections.profile, distance: sectionDistance(aSections.boundaries, sSections.boundaries) },
  };
  const score = 100 - Object.entries(WEIGHTS).reduce((penalty, [name, weight]) => penalty + weight * metrics[name].distance, 0);
  const result = { pass: score >= threshold, score, threshold, weights: WEIGHTS, ...metrics };
  if (includeImage) result.comparePng = compareImage(anchor, screenshot, metrics.grid);
  return result;
}

function markdown(result, imagePath) {
  const { pass, score, threshold, palette, grid, rowBands, aspect, sections } = result;
  const listColors = colors => colors.map(color => `\`${color.hex}\` (${percent(color.share)})`).join(', ');
  const listSections = profile => profile.map(section => `${section.heightPx}px (${percent(section.height)})`).join(', ');
  const dimensions = ({ width, height, ratio }) => `${width}x${height} (${ratio.toFixed(3)} width/height)`;
  const names = { palette: 'Palette', grid: 'Grid layout', rowBands: 'Row bands', aspect: 'Aspect ratio', sections: 'Section heights' };
  const lines = [
    '# Anchor structural comparison', '',
    `**${pass ? 'PASS' : 'FAIL'}** with a score of ${Number(score.toFixed(6))}/100 and a threshold of ${threshold}/100.`, '',
    'The score estimates structural similarity. Review typography, imagery, and content visually.', '',
    '## Scoring', '',
    'The score is 100 minus the sum of each weight multiplied by its bounded distance.', '',
    '| Signal | Weight | Distance | Points deducted |', '| --- | ---: | ---: | ---: |',
    ...Object.entries(result.weights).map(([key, weight]) => `| ${names[key]} | ${weight} | ${percent(result[key].distance)} | ${(weight * result[key].distance).toFixed(2)} |`), '',
    '- Palette uses up to six median-cut colors. Distance combines symmetric, share-weighted nearest RGB distances (75%) and the distance between weighted mean colors (25%), scaled by 1.5.',
    `- Grid uses mean linear-sRGB luminance and edge density sampled at ${SAMPLES_PER_CELL}x${SAMPLES_PER_CELL} per cell. An edge changes luminance by at least ${EDGE_THRESHOLD} to the right or below. Cell distance is twice the luminance delta plus four times the edge-density delta, capped at 1. Grid distance blends the overall mean (65%) and the mean of the highest quarter (35%).`,
    '- Each row band averages the cells across its width. Its distance uses the same formula as a cell. The row band score uses the mean distance.',
    '- Aspect distance is twice the proportional difference between width-to-height ratios, capped at 1.',
    `- Section heights are inferred at local maxima of adjacent row-band distance of at least ${SECTION_THRESHOLD}. Section distance is four times the mean nearest boundary shift in both directions, capped at 1. Page endpoints act as fallback matches.`, '',
    '## Dominant palette', '', `- Anchor ${listColors(palette.anchor)}`, `- Screenshot ${listColors(palette.screenshot)}`, '',
    '## Aspect and section heights', '',
    `- Anchor ${dimensions(aspect.anchor)}. Inferred heights from top to bottom are ${listSections(sections.anchor)}.`,
    `- Screenshot ${dimensions(aspect.screenshot)}. Inferred heights from top to bottom are ${listSections(sections.screenshot)}.`, '',
    `## Largest grid deviations (${grid.columns}x${grid.rows})`, '',
    'Coordinates start at row 1, column 1 in the top-left. Bands span the full width. Deviations are ranked before capping distances.', '',
  ];
  const addDeviations = (items, coordinate) => {
    if (!items.length) lines.push('No deviations found.', '');
    else lines.push('| Coordinate | Luminance delta | Edge-density delta | Distance |', '| --- | ---: | ---: | ---: |',
      ...items.map(item => `| ${coordinate(item)} | ${percent(item.luminanceDelta)} | ${percent(item.edgeDensityDelta)} | ${percent(item.deviation)} |`), '');
  };
  addDeviations(grid.biggestDeviations, cell => `Row ${cell.row}, column ${cell.column}`);
  lines.push('## Largest row-band deviations', '');
  addDeviations(rowBands.biggestDeviations, band => `Row ${band.row}`);
  if (imagePath) lines.push('## Comparison image', '', 'Panels show the anchor, screenshot, and screenshot with a grid-deviation overlay. Orange to red indicates increasing deviation.', '',
    `![Anchor, screenshot, and deviation overlay](${encodeURIComponent(path.basename(imagePath))})`, '');
  return lines.join('\n');
}

function writeArtifact(target, data) {
  const temporary = path.join(path.dirname(target), `.anchor-qa-${randomUUID()}.tmp`);
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    try {
      fs.fchmodSync(fd, 0o600);
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, target);
    let directory;
    try {
      directory = fs.openSync(path.dirname(target), 'r');
      fs.fsyncSync(directory);
    } catch (error) {
      if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EBADF', 'EPERM'].includes(error.code)) throw error;
    } finally {
      if (directory !== undefined) fs.closeSync(directory);
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function main(args) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    out: { type: 'string' }, json: { type: 'string' }, grid: { type: 'string' }, threshold: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { console.log(USAGE); return 0; }
  if (positionals.length !== 2) throw new Error(USAGE);
  if (values.out === '' || values.json === '') throw new Error('Report paths must be nonempty');
  if (values.threshold !== undefined && !/^\d+(?:\.\d+)?$/.test(values.threshold)) throw new Error('Threshold must be a number from 0 to 100');
  const imagePath = values.out && `${values.out}.compare.png`;
  const usedPaths = new Set(positionals.map(file => fs.realpathSync(file)));
  for (const file of [values.out, imagePath, values.json].filter(Boolean)) {
    const canonical = path.join(fs.realpathSync(path.dirname(file)), path.basename(file));
    if (usedPaths.has(canonical)) throw new Error('Report paths must be distinct from the input images and each other');
    const stat = fs.lstatSync(canonical, { throwIfNoEntry: false });
    if (stat && !stat.isFile()) throw new Error(`Report target must be a regular file: ${file}`);
    usedPaths.add(canonical);
  }
  const { comparePng, ...result } = compare(fs.readFileSync(positionals[0]), fs.readFileSync(positionals[1]), {
    grid: values.grid, threshold: values.threshold === undefined ? undefined : Number(values.threshold), includeImage: Boolean(imagePath),
  });
  if (imagePath) writeArtifact(imagePath, comparePng);
  if (values.json) writeArtifact(values.json, JSON.stringify(result, null, 2) + '\n');
  const report = markdown(result, imagePath);
  if (values.out) writeArtifact(values.out, report);
  else process.stdout.write(report);
  return result.pass ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = { compare };
