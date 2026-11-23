'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { crc32, deflateSync } = require('node:zlib');
const { compareWidth, summarizeWidths } = require('../tools/impact-check');

const HEADER = '01-header';
const HERO = '02-hero';
const FOOTER = '10-footer';
const ZERO_DELTA = { x: 0, y: 0, width: 0, height: 0 };
const TOOL = path.resolve(__dirname, '../tools/impact-check.js');

function png(firstPixel) {
  function chunk(type, data) {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const content = Buffer.concat([Buffer.from(type), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(content));
    return Buffer.concat([size, content, checksum]);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, firstPixel, 0, 0, 255, 0, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const original = png(0);
const tinted = png(255);

function section(y, pixels = original, box = {}, horizontalOverflow = 0) {
  return { box: { x: 0, y, width: 2, height: 1, ...box }, png: pixels, horizontalOverflow };
}

function snapshot(sections, horizontalOverflow = 0, consoleErrors = []) {
  return { sections, horizontalOverflow, consoleErrors };
}

test('owned-only paint changes pass without ignoring the changed pixels', () => {
  const before = snapshot({ [HEADER]: section(0), [HERO]: section(1) });
  const after = snapshot({ [HEADER]: section(0, tinted), [HERO]: section(1) });
  const comparison = compareWidth(before, after, HEADER);
  const result = summarizeWidths([{ width: 393, runtimeMs: 2, ...comparison }]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unexpected, []);
  assert.deepEqual(result.perSection.map(({ id, owned, boxDelta, diffRatio }) => ({ id, owned, boxDelta, diffRatio })), [
    { id: HEADER, owned: true, boxDelta: ZERO_DELTA, diffRatio: 0.5 },
    { id: HERO, owned: false, boxDelta: ZERO_DELTA, diffRatio: 0 },
  ]);
  assert.equal(result.perWidth[0].runtimeMs, 2);
});

test('a paint-only change in the hero is unexpected even with identical geometry', () => {
  const before = snapshot({ [HEADER]: section(0), [HERO]: section(1) });
  const after = snapshot({ [HEADER]: section(0, tinted), [HERO]: section(1, tinted) });
  const result = compareWidth(before, after, HEADER);
  assert.deepEqual(result.unexpected, [HERO]);
  const hero = result.perSection[1];
  assert.deepEqual(hero.boxDelta, ZERO_DELTA);
  assert.equal(hero.diffRatio, 0.5);
  assert.equal(hero.moved, false);
  assert.equal(hero.resized, false);
});

test('a layout shift below the owner is unexpected when the cropped pixels match', () => {
  const before = snapshot({ [HEADER]: section(0), [HERO]: section(1), [FOOTER]: section(2) });
  const after = snapshot({ [HEADER]: section(0), [HERO]: section(4, original, { x: -1, width: 3 }), [FOOTER]: section(5) });
  const result = compareWidth(before, after, HEADER);
  assert.deepEqual(result.unexpected, [HERO, FOOTER]);
  assert.deepEqual(result.perSection[1].boxDelta, { x: -1, y: 3, width: 1, height: 0 });
  assert.equal(result.perSection[1].moved, true);
  assert.equal(result.perSection[1].resized, true);
  assert.equal(result.perSection[2].diffRatio, 0);
  assert.equal(result.perSection[2].resized, false);
});

test('initial insertion only permits unchanged peers in the same flow position without the owner', () => {
  const shifted = (y, withoutOwnerY, pixels = original) => ({ ...section(y, pixels), withoutOwnerY });
  const empty = y => ({ ...section(y, null, { height: 0 }), empty: true });
  const before = snapshot({ [HEADER]: empty(0), [HERO]: empty(1), [FOOTER]: shifted(10, 10) });
  const after = snapshot({ [HEADER]: empty(4), [HERO]: section(4), [FOOTER]: shifted(50, 10) });
  const result = compareWidth(before, after, HERO);
  assert.deepEqual(result.unexpected, []);
  assert.deepEqual(result.perSection.filter(sample => sample.flowTranslation).map(sample => sample.id), [HEADER, FOOTER]);
  for (const overridden of [shifted(50, 20), shifted(50, 10, tinted)]) {
    assert.deepEqual(compareWidth(before, snapshot({ ...after.sections, [FOOTER]: overridden }), HERO).unexpected, [FOOTER]);
  }
});

test('removed and added sections are reported and empty fragments stay unchanged', () => {
  const before = snapshot({ [HEADER]: section(0), [HERO]: section(1), '03-empty': null });
  const after = snapshot({ [HEADER]: section(0), '03-empty': null, [FOOTER]: section(2) });
  const result = compareWidth(before, after, HEADER);
  assert.deepEqual(result.unexpected, [HERO, FOOTER]);
  assert.deepEqual(result.perSection.slice(1).map(({ id, boxDelta, diffRatio, presenceChanged }) => [id, boxDelta, diffRatio, presenceChanged]), [
    [HERO, null, 1, true], ['03-empty', null, 0, false], [FOOTER, null, 1, true],
  ]);
});

test('new overflow is attributed even when a larger preexisting page overflow hides it', () => {
  const before = snapshot({ [HEADER]: section(0, original, {}, 12), [HERO]: section(1), [FOOTER]: section(2) }, 12);
  const after = snapshot({ [HEADER]: section(0, original, {}, 12), [HERO]: section(1, original, {}, 4), [FOOTER]: section(2) }, 12);
  const result = compareWidth(before, after, HEADER);
  assert.deepEqual(result.horizontalOverflow, { before: 12, after: 12 });
  assert.deepEqual(result.perSection[1].horizontalOverflow, { before: 0, after: 4 });
  assert.deepEqual(result.unexpected, [HERO]);
  assert.deepEqual(compareWidth(after, before, HEADER).unexpected, [HERO]);
});

test('console errors preserve page scope and count only new occurrences against a section', () => {
  const sections = { [HEADER]: section(0), [HERO]: section(1), [FOOTER]: section(2) };
  const old = { section: HERO, message: 'Broken hero script' };
  const global = { section: null, message: 'Shared runtime error' };
  const before = snapshot(sections, 0, [old]);
  const after = snapshot(sections, 0, [old, old, global]);
  const result = compareWidth(before, after, HEADER);
  assert.deepEqual(result.consoleErrors, { before: [old], after: [old, old, global], added: [old, global] });
  assert.deepEqual(result.perSection[1].consoleErrors, { before: [old.message], after: [old.message, old.message], added: [old.message] });
  assert.deepEqual(result.unexpected, [HERO]);
  assert.deepEqual(compareWidth(before, snapshot(sections, 0, [old, global]), HEADER).unexpected, []);
});

test('responsive changes combine across widths with signed peak deltas and maximum diff ratios', () => {
  const before = snapshot({ [HEADER]: section(0), [HERO]: section(3) });
  const narrow = snapshot({ [HEADER]: section(0), [HERO]: section(2, tinted) });
  const wide = snapshot({ [HEADER]: section(0), [HERO]: section(8) });
  const result = summarizeWidths([
    { width: 393, ...compareWidth(before, narrow, HEADER) },
    { width: 1440, ...compareWidth(before, wide, HEADER) },
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.unexpected, [HERO]);
  assert.deepEqual(result.perSection[1].boxDelta, { ...ZERO_DELTA, y: 5 });
  assert.equal(result.perSection[1].diffRatio, 0.5);
  assert.deepEqual(result.perSection[1].widths.map(({ width, boxDelta }) => [width, boxDelta.y]), [[393, -1], [1440, 5]]);
});

test('the CLI rejects malformed widths before exporting or launching Chrome', () => {
  const result = spawnSync(process.execPath, [TOOL, '--before', 'before', '--after', 'after', '--widths', '393,,1440'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Widths must be positive integers/);
});

// Run explicitly where headless Chrome is permitted: SWARM_IMPACT_CHROME_TEST=1 node --test swarm/test/impact-check.test.js
const chromeTest = { skip: process.env.SWARM_IMPACT_CHROME_TEST !== '1' && 'Set SWARM_IMPACT_CHROME_TEST=1 to run the Chrome proof' };
const home = path.resolve(__dirname, '../projects/home');
const widths = [393, 768, 1440];

function compareHome(t, leaks) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-impact-home-'));
  t.after(() => fs.rmSync(temp, { force: true, recursive: true }));
  const before = path.join(temp, 'before');
  const after = path.join(temp, 'after');
  fs.cpSync(home, before, { recursive: true });
  fs.cpSync(before, after, { recursive: true });
  const layer = path.join(after, 'sections/01-header.layout.css');
  fs.appendFileSync(layer, '\n.s-01 { background-color: #ff00ff !important; }\n');
  if (leaks) fs.appendFileSync(layer, '\nh1 { color: #ff00ff !important; }\n');
  const json = path.join(temp, 'result.json');
  const cli = spawnSync(process.execPath, [TOOL, '--before', before, '--after', after, '--owner', HEADER, '--json', json],
    { encoding: 'utf8', timeout: 120_000 });
  assert.equal(cli.status, leaks ? 1 : 0, cli.error?.message ?? cli.stderr);
  const result = JSON.parse(fs.readFileSync(json, 'utf8'));
  assert.equal(result.ok, !leaks);
  assert.deepEqual(result.unexpected, leaks ? [HERO] : []);
  assert.deepEqual(result.perWidth.map(report => report.width), widths);
  const changed = result.perSection.find(({ id }) => id === (leaks ? HERO : HEADER));
  for (const sample of changed.widths) {
    assert.deepEqual(sample.boxDelta, ZERO_DELTA);
    assert.ok(sample.diffRatio > 0, `Expected a pixel change for ${changed.id} at ${sample.width}px`);
  }
  for (const { width, runtimeMs, unexpected } of result.perWidth) {
    assert.ok(Number.isFinite(runtimeMs) && runtimeMs > 0);
    assert.deepEqual(unexpected, leaks ? [HERO] : []);
    t.diagnostic(`${width}px ${runtimeMs.toFixed(1)} ms`);
  }
}

test('home with a scoped header color change has no unexpected impact in Chrome', chromeTest, t => {
  compareHome(t, false);
});

test('home with a leaking global rule in the header layer flags the hero in Chrome', chromeTest, t => {
  compareHome(t, true);
});
