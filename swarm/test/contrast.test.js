'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');
const { contrastRatio } = require('../tools/contrast');

const ROOT = path.resolve(__dirname, '..', '..');
const cli = (...args) => spawnSync(process.execPath, ['swarm/tools/contrast.js', ...args], {
  cwd: ROOT,
  encoding: 'utf8',
});

test('computes black, white, and equal-color ratios', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.equal(contrastRatio('ffffff', '000000'), 21);
  assert.equal(contrastRatio('#AbC', '#aabbcc'), 1);
  assert.equal(contrastRatio('#fff', '#777'), contrastRatio('#777', '#fff'));
});

test('uses weighted sRGB luminance for colored pairs', () => {
  assert.equal(contrastRatio('#ff0000', '#000').toFixed(2), '5.25');
  assert.equal(contrastRatio('#00ff00', '#000').toFixed(2), '15.30');
  assert.equal(contrastRatio('#0000ff', '#000').toFixed(2), '2.44');
});

test('composites foreground alpha and uses white behind translucent backgrounds', () => {
  assert.equal(contrastRatio('#000000ff', '#ffffffff'), 21);
  assert.equal(contrastRatio('#00000000', '#abc'), 1);
  assert.equal(contrastRatio('#00000080', '#fff').toFixed(2), '4.00');
  assert.equal(contrastRatio('#000', '#00000080').toFixed(2), '5.24');
  assert.equal(contrastRatio('#12345678', '#789abc00'), contrastRatio('#12345678', '#fff'));
});

test('rejects invalid hex strings and reports which color failed', () => {
  for (const invalid of ['#12', '#1234', '#12345', '#1234567', '#123456789', '#ggg', 'black', '', null]) {
    assert.throws(() => contrastRatio(invalid, '#fff'), /Invalid foreground color.*3, 6, or 8 hex digits/);
  }
  assert.throws(() => contrastRatio('#fff', 'not-a-color'), /Invalid background color/);
});

test('CLI prints two-decimal ratios and the text contrast ratings', () => {
  const black = cli('#000', '#fff');
  assert.equal(black.status, 0, black.stderr);
  assert.equal(black.stdout, [
    'Contrast ratio: 21.00:1',
    'AA normal (4.5): PASS',
    'AA large (3): PASS',
    'AAA normal (7): PASS',
    'AAA large (4.5): PASS',
    '',
  ].join('\n'));

  const gray = cli('#777', '#fff');
  assert.equal(gray.status, 0, gray.stderr);
  assert.equal(gray.stdout, [
    'Contrast ratio: 4.48:1',
    'AA normal (4.5): FAIL',
    'AA large (3): PASS',
    'AAA normal (7): FAIL',
    'AAA large (4.5): FAIL',
    '',
  ].join('\n'));
});

test('CLI rates the unrounded ratio even when display rounds up to 4.50', () => {
  const result = cli('#070707', '#777777');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Contrast ratio: 4\.50:1/);
  assert.match(result.stdout, /AA normal \(4\.5\): FAIL/);
});

test('CLI exits nonzero on invalid color or argument count', () => {
  const invalid = cli('#xyz', '#fff');
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Invalid foreground color/);
  assert.equal(invalid.stdout, '');
  const missing = cli('#fff');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Usage: node swarm\/tools\/contrast\.js <fg> <bg>/);
});
