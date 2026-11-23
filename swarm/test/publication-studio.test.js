'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { impact, publicationImpact } = require('../tools/impact-check');

const HEADER = '01-header';
const HERO = '02-hero';
const WIDTHS = [393, 768, 1440];
const APPEARANCE = { theme: 'dark', brand: 'forest-gold', lang: 'ms', colorScheme: 'light' };
const OPTIONS = { owner: HEADER, appearance: APPEARANCE };
const PALETTES = { first: '#245b78', second: '#b47523' };
const ZERO = { x: 0, y: 0, width: 0, height: 0 };

// The owner paints its own pseudo-element. It can cover a peer only when
// published in the Studio stage with the requested independent preferences.
const STUDIO_OVERLAP = `
  @media (prefers-color-scheme: light) {
    .s-01:is(html[data-theme=dark][data-brand=forest-gold][lang=ms] body.studio-stage .s-01)::after {
      content: "";
      position: absolute;
      inset: 100% 0 auto;
      height: 72px;
      background: #df1745;
      z-index: 2;
    }
  }
`;

const chrome = {
  skip: process.env.SWARM_PUBLICATION_STUDIO_CHROME_TEST !== '1' && 'Set SWARM_PUBLICATION_STUDIO_CHROME_TEST=1',
  timeout: 300_000,
};

function fixtures(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-publication-studio-'));
  t.after(() => fs.rmSync(temp, { force: true, recursive: true }));
  return (name, { height = 80, color = PALETTES.first, fill = true, extra = '', peerId = HERO, hiddenPeer = false } = {}) => {
    const project = path.join(temp, name);
    const dir = path.join(project, 'sections');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(project, 'tokens.css'), ':root { --dc-bg: #fff; --dc-ink: #161b25; --dc-font: system-ui; }');
    fs.writeFileSync(path.join(dir, HEADER + '.html'), fill
      ? '<section class="s-01" id="01-header"><p>Only the owning header worker has edited this section.</p></section>'
      : '<section class="s-01" id="01-header"></section>');
    fs.writeFileSync(path.join(dir, HERO + '.html'),
      `<section class="s-02" id="${peerId}"><h1>Unchanged peer content</h1><p>This fixture remains byte-identical.</p></section>`);
    fs.writeFileSync(path.join(dir, HEADER + '.css'), (fill
      ? `.s-01 { position: relative; height: ${height}px; color: #fff; background: ${color}; } .s-01 p { margin: 0; }`
      : '') + extra);
    fs.writeFileSync(path.join(dir, HERO + '.css'),
      '.s-02 { height: 120px; background: #eaf2f5; color: #191e29; } .s-02 h1, .s-02 p { margin: 0; }' +
      (hiddenPeer ? '@media (max-width: 500px) { .s-02 { display: none; } }' : ''));
    return project;
  };
}

function section(report, id) {
  const row = report.perSection.find(row => row.id === id);
  assert.ok(row, `Expected evidence for ${id}`);
  assert.deepEqual(row.widths.map(sample => sample.width), WIDTHS);
  return row.widths;
}

test('publication checks ordinary owner edits and Studio-only visual overlap in native Chrome', chrome, async t => {
  const project = fixtures(t);
  const original = project('original');
  const scoped = project('owned-paint', { color: PALETTES.second });
  const leaking = project('owned-paint-with-studio-overlap', { color: PALETTES.second, extra: STUDIO_OVERLAP });

  const accepted = await publicationImpact(original, scoped, OPTIONS);
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.unexpected, []);
  for (const report of [accepted.export, accepted.studio]) {
    assert.equal(report.ok, true);
    assert.ok(section(report, HEADER).every(sample => sample.diffRatio > 0));
    assert.ok(section(report, HERO).every(sample => sample.diffRatio === 0 && !sample.changed));
  }

  const old = await impact(original, leaking, { owner: HEADER, widths: [393] });
  assert.equal(old.ok, true);
  assert.deepEqual(old.unexpected, []);
  const rejected = await publicationImpact(original, leaking, OPTIONS);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.unexpected, [HERO]);
  assert.equal(rejected.export.ok, true);
  assert.equal(rejected.studio.ok, false);
  assert.deepEqual(rejected.studio.unexpected, [HERO]);
  assert.deepEqual(rejected.perWidth.map(sample => sample.width), WIDTHS);
  for (const sample of section(rejected.studio, HERO)) {
    assert.deepEqual(sample.boxDelta, ZERO);
    assert.ok(sample.diffRatio > 0.25, `Expected a painted peer overlap at ${sample.width}px`);
  }
});

test('publication distinguishes a shrinking Studio stub and ordinary component translations', chrome, async t => {
  const project = fixtures(t);
  const blank = project('blank', { fill: false });
  const compact = project('compact');
  const expanded = project('expanded', { height: 120 });
  for (const [name, before, after, flags, exportY, studioY] of [
    ['first build', blank, compact, { firstBuild: true }, 80, -40],
    ['restore expanding', compact, expanded, { componentRestore: true }, 40, 40],
    ['restore shrinking', expanded, compact, { componentRestore: true }, -40, -40],
  ]) {
    const result = await publicationImpact(before, after, { ...OPTIONS, ...flags });
    assert.equal(result.ok, true, name);
    assert.deepEqual(result.unexpected, [], name);
    for (const [report, y] of [[result.export, exportY], [result.studio, studioY]]) {
      assert.equal(report.ok, true, name);
      for (const sample of section(report, HERO)) {
        assert.deepEqual(sample.boxDelta, { ...ZERO, y }, name);
        assert.equal(sample.diffRatio, 0, name);
        assert.equal(sample.flowTranslation, true, name);
      }
    }
  }
});

test('first-build Studio flow rejects peer motion or paint that survives excluding the owner host', chrome, async t => {
  const project = fixtures(t);
  const blank = project('blank', { fill: false });
  const changed = project('filled-owner-with-peer-changes', { extra: `
    @media (max-width: 500px) { body.studio-stage .s-02 { background: #df1745; } }
    @media (min-width: 501px) { body.studio-stage #host-02 { margin-top: 12px; } }
  ` });
  const result = await publicationImpact(blank, changed, { ...OPTIONS, firstBuild: true });
  assert.equal(result.ok, false);
  assert.equal(result.export.ok, true);
  assert.deepEqual(result.studio.unexpected, [HERO]);
  for (const sample of section(result.studio, HERO)) {
    assert.equal(sample.flowTranslation, false);
    if (sample.width === 393) assert.ok(sample.diffRatio > 0.25);
    else {
      assert.equal(sample.diffRatio, 0);
      assert.deepEqual(sample.boxDelta, { ...ZERO, y: -28 });
    }
  }
});

test('Studio coverage distinguishes an unchanged responsive hide from a missing expected section root', chrome, async t => {
  const project = fixtures(t);
  const hidden = await publicationImpact(project('hidden', { hiddenPeer: true }),
    project('hidden-owner-edit', { hiddenPeer: true, color: PALETTES.second }), OPTIONS);
  assert.equal(hidden.ok, true);
  assert.ok(section(hidden.studio, HERO).every(sample => !sample.changed));
  assert.ok(hidden.studio.perWidth.every(sample => sample.coverage.length === 0));

  const wrongId = 'unexpected-peer-id';
  const missing = await publicationImpact(project('missing-root', { peerId: wrongId }),
    project('missing-root-owner-edit', { peerId: wrongId, color: PALETTES.second }), OPTIONS);
  assert.equal(missing.export.ok, true);
  assert.equal(missing.ok, false);
  for (const sample of missing.studio.perWidth) assert.deepEqual(sample.coverage, [HERO]);
});
