'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { crc32, deflateSync } = require('node:zlib');
const { impact, compareWidth, summarizeWidths, sharedTokensImpact, summarizeSharedTokens, captureStableShared } = require('../tools/impact-check');
const { decodePng } = require('../tools/anchor-qa');

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

test('component restore permits proven vertical translations in either direction', () => {
  const compact = snapshot({ [HEADER]: section(0), [HERO]: { ...section(1), withoutOwnerY: 0 } });
  const expanded = snapshot({ [HEADER]: section(0, original, { height: 5 }), [HERO]: { ...section(5), withoutOwnerY: 0 } });
  for (const [before, after, y] of [[compact, expanded, 4], [expanded, compact, -4]]) {
    const result = compareWidth(before, after, HEADER, { componentRestore: true });
    const hero = result.perSection[1];
    assert.deepEqual(result.unexpected, []);
    assert.deepEqual(hero.boxDelta, { ...ZERO_DELTA, y });
    assert.equal(hero.changed, true);
    assert.equal(hero.flowTranslation, true);
  }
  assert.deepEqual(compareWidth(expanded, compact, HEADER).unexpected, [HERO]);
});

test('component restore rejects displaced peers with missing flow evidence or any other change', () => {
  const before = snapshot({ [HEADER]: section(0), [HERO]: { ...section(5), withoutOwnerY: 0 } });
  const moved = { ...section(1), withoutOwnerY: 0 };
  for (const [name, peer, errors] of [
    ['disappears', null],
    ['has no measurement without the owner', section(1)],
    ['moves with the owner hidden', { ...moved, withoutOwnerY: 1 }],
    ['changes pixels', { ...moved, png: tinted }],
    ['moves horizontally', { ...moved, box: { ...moved.box, x: 1 } }],
    ['resizes', { ...moved, box: { ...moved.box, height: 2 } }],
    ['overflows', { ...moved, horizontalOverflow: 1 }],
    ['logs a new error', moved, [{ section: HERO, message: 'Unexpected peer error' }]],
  ]) {
    const after = snapshot({ ...before.sections, [HERO]: peer }, 0, errors);
    const result = compareWidth(before, after, HEADER, { componentRestore: true });
    assert.deepEqual(result.unexpected, [HERO], name);
    assert.equal(result.perSection[1].flowTranslation, false, name);
  }

  const empty = y => ({ ...section(y, null, { height: 0 }), empty: true });
  const previous = snapshot({ ...before.sections, [HERO]: empty(1) });
  const current = snapshot({ ...previous.sections, [HERO]: empty(5) });
  assert.deepEqual(compareWidth(previous, current, HEADER, { componentRestore: true }).unexpected, [HERO]);
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

test('the CLI does not expose the component restore policy', () => {
  const result = spawnSync(process.execPath, [TOOL, '--before', 'before', '--after', 'after', '--component-restore'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown option.*--component-restore/);
});

const approvalAppearance = { theme: 'dark', brand: 'forest-gold', lang: 'ms', colorScheme: 'light' };

test('shared captures wait for matching consecutive paints and stop at a bounded deadline', async () => {
  const frames = [original, tinted, tinted];
  const calls = [];
  const image = await captureStableShared(async () => {
    calls.push('capture');
    return frames.shift();
  }, async () => { calls.push('settle'); });
  assert.equal(image, tinted);
  assert.deepEqual(calls, ['settle', 'capture', 'settle', 'capture', 'settle', 'capture']);

  const staleFrames = [original, null, original, tinted, tinted];
  assert.equal(await captureStableShared(async () => staleFrames.shift(), async () => {}), tinted);

  let attempts = 0;
  await assert.rejects(captureStableShared(async () => Buffer.from([attempts++]), async () => {}),
    /did not paint a stable screenshot/);
  assert.equal(attempts, 5);

  const controller = new AbortController();
  await assert.rejects(captureStableShared(async () => assert.fail('A cancelled capture must stop before taking another image.'),
    async () => controller.abort(), controller.signal), { name: 'AbortError' });
});

function tokensView(sections, { horizontalOverflow = 0, consoleErrors = [], resources = [] } = {}) {
  return { ...snapshot(sections, horizontalOverflow, consoleErrors), png: original, resources };
}

test('shared token review binds all section images, loaded resources and exact appearances to the approval digest', () => {
  const ids = [HEADER, HERO];
  const before = tokensView({ [HEADER]: section(0), [HERO]: section(1) });
  const after = tokensView({ [HEADER]: section(0, tinted), [HERO]: section(2, tinted) });
  const makeReport = (candidate = after, appearance = approvalAppearance) =>
    summarizeSharedTokens([{ width: 393, height: 844, before, after: candidate }], ids, appearance);
  const report = makeReport();
  assert.equal(report.ok, true);
  assert.equal(compareWidth(before, after, HEADER).unexpected.includes(HERO), true);
  assert.deepEqual(report.widths, [393]);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.evidence[393].sections[HERO], { before: original, after: tinted });
  assert.equal(report.perSection[1].widths[0].diffRatio, 0.5);
  assert.equal(report.perSection[1].widths[0].boxDelta.y, 1);
  assert.notEqual(report.perSection[1].widths[0].before.sha256, report.perSection[1].widths[0].after.sha256);
  assert.equal(makeReport().digest, report.digest);
  assert.notEqual(makeReport(after, { ...approvalAppearance, lang: 'en' }).digest, report.digest);
  assert.notEqual(makeReport({ ...after, resources: [{ path: '/tokens.css', status: 200, sha256: 'different' }] }).digest, report.digest);
});

test('shared token review rejects missing expected evidence, overflow and candidate runtime errors', () => {
  const error = { section: null, message: 'Uncaught fixture failure' };
  const before = tokensView({ [HEADER]: section(0), [HERO]: section(1), [FOOTER]: null }, { consoleErrors: [error] });
  const after = tokensView({ [HEADER]: section(0, original, {}, 1), [HERO]: null, [FOOTER]: null }, {
    horizontalOverflow: 1, consoleErrors: [error],
  });
  const result = summarizeSharedTokens([{ width: 393, height: 844, before, after }], [HEADER, HERO, FOOTER], approvalAppearance);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, [
    '393px: 01-header has horizontal overflow.',
    '393px: 02-hero is missing or not visible in one of the previews.',
    '393px: 10-footer is missing or not visible in one of the previews.',
    '393px: the proposed preview has horizontal overflow.',
    '393px: the proposed preview has browser errors.',
  ]);
  assert.deepEqual(result.evidence[393].sections[HERO], { before: original, after: null });
  assert.deepEqual(result.perWidth[0].consoleErrors.added, []);
});

test('preserves intentionally hidden sections and empty scaffold roots at a breakpoint', () => {
  const placeholder = { box: {x: 0, y: 100, width: 393, height: 0}, hidden: true, horizontalOverflow: 0 };
  const hidden = tokensView({ [HEADER]: placeholder });
  const visible = tokensView({ [HEADER]: section(0) });
  const assess = (before, after) => summarizeSharedTokens([{ width: 393, height: 844, before, after }], [HEADER], {});
  assert.equal(assess(hidden, hidden).ok, true);
  assert.equal(assess(hidden, visible).ok, true);
  assert.equal(assess(visible, hidden).ok, false);
  assert.equal(assess(hidden, tokensView({ [HEADER]: null })).ok, false);
});

test('shared token review validates its scope and Studio appearance before opening a browser', async () => {
  const args = ['does-not-exist', 'does-not-exist'];
  await assert.rejects(sharedTokensImpact(...args, { expectedSections: [HEADER, '01-duplicate'] }), /distinct expected Studio section IDs/);
  await assert.rejects(sharedTokensImpact(...args, { expectedSections: [HEADER], appearance: { theme: 'bad' } }), /valid Studio appearance/);
  await assert.rejects(sharedTokensImpact(...args, { signal: AbortSignal.abort() }), { name: 'AbortError' });
});

test('shared token approval captures three opaque Studio viewports and reproduces its approval digest in Chrome', {
  skip: process.env.SWARM_SHARED_TOKENS_CHROME_TEST !== '1' && 'Set SWARM_SHARED_TOKENS_CHROME_TEST=1 to run the Chrome proof',
}, async t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-shared-tokens-test-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  function makeProject(name, color) {
    const dir = path.join(scratch, name);
    const sections = path.join(dir, 'sections');
    const assets = path.join(dir, 'assets/generated');
    fs.mkdirSync(sections, { recursive: true });
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'token-sample.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"><rect width="5" height="5" fill="gray"/></svg>');
    fs.writeFileSync(path.join(dir, 'tokens.css'), `
      :root { --shared-fixture-color: #000; }
      @media (prefers-color-scheme: light) and (prefers-reduced-motion: reduce) {
        :root[data-theme=dark][data-brand=forest-gold][lang=ms] { --shared-fixture-color: ${color}; }
      }
    `);
    fs.writeFileSync(path.join(sections, HEADER + '.html'), `
      <header id="${HEADER}" class="s-01"><p data-i18n="fixture.heading">Default words</p><img src="/assets/generated/token-sample.svg" alt=""></header>
    `);
    fs.writeFileSync(path.join(sections, HERO + '.html'), `
      <section id="${HERO}" class="s-02"><h1>Beyond the first viewport</h1></section>
    `);
    fs.writeFileSync(path.join(sections, HEADER + '.css'), '.s-01 { position: relative; height: 1700px; background: #eee; } .s-01::after { content: ""; position: absolute; inset: 1400px 0 auto; height: 100px; background: var(--shared-fixture-color); } .s-01 p { margin: 0; }');
    fs.writeFileSync(path.join(sections, HERO + '.css'), '.s-02 { height: 120.171875px; background-color: var(--shared-fixture-color); } .s-02 h1 { margin: 0; }');
    fs.mkdirSync(path.join(dir, 'i18n'));
    fs.writeFileSync(path.join(dir, 'i18n/ms.json'), JSON.stringify({ messages: { 'fixture.heading': 'Tajuk ujian' } }));
    return dir;
  }
  const before = makeProject('before', '#224466');
  const after = makeProject('after', '#662244');
  const options = { appearance: approvalAppearance, expectedSections: [HERO, HEADER] };
  const result = await sharedTokensImpact(before, after, options);
  assert.equal(result.ok, true, result.problems.join('\n'));
  assert.deepEqual(result.perWidth.map(({ width, height }) => [width, height]), [[393, 844], [768, 1024], [1440, 900]]);
  for (const { width, height, resources } of result.perWidth) {
    const { before: left, after: right, sections } = result.evidence[width];
    assert.deepEqual([decodePng(left).width, decodePng(right).height], [width, height]);
    const middle = decodePng(sections[HEADER].after);
    assert.equal(middle.height, 1700);
    const pixel = (1450 * middle.width + 100) * 3;
    assert.deepEqual([...middle.rgb.subarray(pixel, pixel + 3)], [102, 34, 68]);
    assert.deepEqual([...decodePng(sections[HERO].before).rgb.subarray(-3)], [34, 68, 102]);
    assert.deepEqual([...decodePng(sections[HERO].after).rgb.subarray(-3)], [102, 34, 68]);
    for (const resource of ['/i18n/ms.json', '/assets/generated/token-sample.svg', '/ds/themes.css', '/p/sections/01-header.html']) {
      assert.ok(resources.before.find(entry => entry.path === resource && entry.status === 200), resource);
      assert.deepEqual(resources.before.find(entry => entry.path === resource), resources.after.find(entry => entry.path === resource));
    }
  }
  assert.equal(result.perSection.find(({ id }) => id === HERO).widths.every(({ diffRatio }) => diffRatio > 0.8), true);
  const replay = await sharedTokensImpact(makeProject('replay-before', '#224466'), makeProject('replay-after', '#662244'), options);
  assert.equal(replay.digest, result.digest);
});

// Run explicitly where headless Chrome is permitted: SWARM_IMPACT_CHROME_TEST=1 node --test swarm/test/impact-check.test.js
const chromeTest = { skip: process.env.SWARM_IMPACT_CHROME_TEST !== '1' && 'Set SWARM_IMPACT_CHROME_TEST=1 to run the Chrome proof' };
const home = process.env.SWARM_IMPACT_HOME || path.resolve(__dirname, '../archive/gjh-home-run1');
const widths = [393, 768, 1440];

function compareHome(t, leaks) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-impact-home-'));
  t.after(() => fs.rmSync(temp, { force: true, recursive: true }));
  const before = path.join(temp, 'before');
  const after = path.join(temp, 'after');
  fs.cpSync(home, before, { recursive: true });
  fs.cpSync(before, after, { recursive: true });
  const layer = path.join(after, 'sections/01-header.layout.css');
  // The navigation surface can completely cover its header's background.
  fs.appendFileSync(layer, '\n.s-01 > :first-child { background-color: #ff00ff !important; }\n');
  if (leaks) fs.appendFileSync(layer, '\nh1 { color: #ff00ff !important; }\n');
  const json = path.join(temp, 'result.json');
  const cli = spawnSync(process.execPath, [TOOL, '--before', before, '--after', after, '--owner', HEADER, '--json', json],
    { encoding: 'utf8', timeout: 120_000 });
  assert.equal(cli.status, leaks ? 1 : 0, cli.error?.message || cli.stderr || cli.stdout);
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

test('component restore measures owner flow in Chrome', chromeTest, async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-impact-restore-'));
  t.after(() => fs.rmSync(temp, { force: true, recursive: true }));
  function fixture(name, height, margin = 0) {
    const project = path.join(temp, name);
    const sections = path.join(project, 'sections');
    fs.mkdirSync(sections, { recursive: true });
    fs.writeFileSync(path.join(sections, `${HEADER}.html`), '<header id="01-header" class="s-01">Header</header>');
    fs.writeFileSync(path.join(sections, `${HERO}.html`), '<section id="02-hero" class="s-02"><h1>Hero</h1></section>');
    fs.writeFileSync(path.join(sections, `${HEADER}.css`), `.s-01 { height: ${height}px; }`);
    fs.writeFileSync(path.join(sections, `${HERO}.css`), `.s-02 { margin-top: ${margin}px; background: #cee; } .s-02 h1 { margin: 0; }`);
    return project;
  }
  const compact = fixture('compact', 24);
  const expanded = fixture('expanded', 64);
  const shifted = fixture('shifted', 24, 10);
  const options = { owner: HEADER, widths: [393] };
  for (const [before, after, componentRestore, expectedY, ok] of [
    [compact, expanded, true, 40, true],
    [expanded, compact, true, -40, true],
    [expanded, shifted, true, -30, false],
    [expanded, compact, false, -40, false],
  ]) {
    const result = await impact(before, after, { ...options, componentRestore });
    const hero = result.perSection.find(({ id }) => id === HERO);
    assert.equal(result.ok, ok);
    assert.deepEqual(result.unexpected, ok ? [] : [HERO]);
    assert.deepEqual(hero.boxDelta, { ...ZERO_DELTA, y: expectedY });
    assert.equal(hero.diffRatio, 0);
    assert.equal(hero.widths[0].flowTranslation, ok);
  }
});
