#!/usr/bin/env node
'use strict';

// Regenerate from the repo root with node swarm/design-system/shell/make-icons.js.
// Generation requires macOS sips. Exports use the checked-in PNGs on every platform.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const source = path.resolve(__dirname, '../../../assets/companies/gjh/official/gjh-logo.png');
const output = path.join(__dirname, 'icons');
const icons = [
  ['icon-192.png', 192, 156],
  ['icon-512.png', 512, 416],
  // This width keeps the entire logo inside the maskable icon's central circle.
  ['icon-maskable-512.png', 512, 300],
];

function sips(...args) {
  execFileSync('/usr/bin/sips', args, { stdio: 'pipe' });
}

function main() {
  if (process.platform !== 'darwin') throw new Error('Icon generation requires macOS sips. Use the checked-in PNGs for exports.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-icons-'));
  try {
    const flattened = path.join(temporary, 'logo.jpg');
    const resized = path.join(temporary, 'resized.png');
    // sips composites transparency onto white when writing a JPEG.
    sips('--setProperty', 'format', 'jpeg', '--setProperty', 'formatOptions', 'best', source, '--out', flattened);
    fs.mkdirSync(output, { recursive: true });
    for (const [name, size, width] of icons) {
      sips('--setProperty', 'format', 'png', '--resampleWidth', String(width), flattened, '--out', resized);
      sips('--padToHeightWidth', String(size), String(size), '--padColor', 'FFFFFF', resized, '--out', path.join(output, name));
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
