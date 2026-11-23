'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { crc32, deflateSync } = require('node:zlib');
const { AnchorQAConflictError, captureAnchorQA } = require('../lib/anchor-preview-qa');
const { createFlow } = require('../lib/anchorflow');
const anchors = require('../lib/anchors');
const { createPreview } = require('../lib/preview');
const { approvedAnchor } = require('../lib/publication');
const { startChrome } = require('../tools/impact-check');

const SWARM = path.resolve(__dirname, '..');
const VIEWPORTS = [[1440, 900], [768, 1024], [393, 844]];
const PREVIEW = 'http://127.0.0.1:8800/studio.html?preview=1&theme=light';
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];

function png(width, height, color = RED) {
  function chunk(type, data) {
    const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const payload = Buffer.concat([Buffer.from(type), data]);
    checksum.writeUInt32BE(crc32(payload));
    return Buffer.concat([size, payload, checksum]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  const pixel = Buffer.from(color);
  for (let row = 0; row < height; row += 1) {
    raw.fill(pixel, row * stride + 1, (row + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function fixture(t, images = { desktop: png(...VIEWPORTS[0]) }) {
  const projectDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'anchor-preview-test-')));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const { id, dir } = anchors.create(projectDir, { files: images });
  const flow = createFlow(projectDir);
  for (const [event, actor, extra] of [
    ['set_goals', 'manager', { goals: ['Review the preview'] }],
    ['anchor_ready', 'system', { anchorId: id }],
    ['advisor_pass', 'advisor'],
    ['approve', 'manager', { anchorId: id }],
    ['lock', 'manager', { anchorId: id }],
  ]) assert.equal(flow.dispatch(event, { actor, ...extra }).ok, true, event);
  anchors.approve(projectDir, id, { by: 'manager' });
  anchors.lock(projectDir, id, { version: 1, recipe: 'corporate-landing', brand: 'gjh', tokens: {},
    sections: [], owners: {}, rules: { desktop: { columns: 12 } } });
  const live = path.join(projectDir, 'contract.json');
  fs.copyFileSync(path.join(dir, 'contract.json'), live);
  const anchor = approvedAnchor(projectDir);
  return { projectDir, anchor, dir, live, flow, previewUrl: () => PREVIEW };
}

test('captures the three requested viewports and compares matching locked images', async t => {
  const [desktop, tablet, mobile] = VIEWPORTS.map(([width, height], index) => png(width, height, [RED, GREEN, BLUE][index]));
  const f = fixture(t, { desktop, tablet, mobile });
  const seen = [];
  const urls = [];
  const result = await captureAnchorQA({
    ...f, includeEvidence: true,
    previewUrl(width, height) {
      urls.push([width, height]);
      return new URL(PREVIEW);
    },
    capture({ url, width, height }) {
      seen.push([url, width, height]);
      return [desktop, tablet, mobile][seen.length - 1];
    },
  });
  assert.deepEqual(urls, VIEWPORTS);
  assert.deepEqual(seen, VIEWPORTS.map(dims => [PREVIEW, ...dims]));
  assert.equal(result.ok, true);
  assert.equal(result.completeCoverage, true);
  assert.equal(result.anchorId, f.anchor.id);
  assert.equal(result.contractHash, f.anchor.contractHash);
  assert.deepEqual(result.breakpoints.map(({ name, status, score, threshold }) => [name, status, score, threshold]), [
    ['desktop', 'pass', 100, 80], ['tablet', 'pass', 100, 80], ['mobile', 'pass', 100, 80],
  ]);
  assert.deepEqual(result.evidence.desktop.screenshot, desktop);
  assert.notEqual(result.evidence.desktop.screenshot, desktop);
  assert.ok(result.evidence.desktop.comparison.length > 0);
  assert.equal(result.breakpoints[0].report.comparePng, undefined);
});

test('missing optional references are explicit coverage gaps even though those sizes are still captured', async t => {
  const f = fixture(t);
  const result = await captureAnchorQA({
    ...f, capture: ({ width, height }) => png(width, height), includeEvidence: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.completeCoverage, false);
  assert.deepEqual(result.breakpoints.map(({ status, referenceAvailable }) => [status, referenceAvailable]), [
    ['pass', true], ['missing', false], ['missing', false],
  ]);
  assert.match(result.breakpoints[1].message, /no reference image/);
  assert.deepEqual(Object.keys(result.evidence.tablet), ['screenshot']);
  assert.deepEqual(Object.keys(result.evidence.mobile), ['screenshot']);
});

test('failed comparisons and invalid screenshot dimensions affect the appropriate viewport', async t => {
  const f = fixture(t, { desktop: png(...VIEWPORTS[0]), tablet: png(...VIEWPORTS[1]) });
  const result = await captureAnchorQA({
    ...f, capture: ({ width, height }) => png(width, width === 768 ? height - 1 : height, GREEN),
  });
  assert.equal(result.ok, false);
  assert.equal(result.completeCoverage, false);
  assert.deepEqual(result.breakpoints.map(({ status }) => status), ['fail', 'error', 'missing']);
  assert.equal(result.breakpoints[0].report.pass, false);
  assert.match(result.breakpoints[1].message, /requested viewport/);
  assert.equal(result.breakpoints[1].phase, 'capture');
  assert.equal(Object.hasOwn(result, 'evidence'), false);
});

test('requires the exact live locked contract before spending any work on capture', async t => {
  const f = fixture(t);
  fs.chmodSync(f.live, 0o644);
  fs.appendFileSync(f.live, '\n');
  let captured = false;
  await assert.rejects(captureAnchorQA({ ...f, capture() { captured = true; } }), error =>
    error instanceof AnchorQAConflictError && error.status === 409 && /live design contract/.test(error.message));
  assert.equal(captured, false);
});

test('rejects a report if the locked reference or live contract changes after capture starts', async t => {
  for (const changed of ['locked reference', 'live contract']) {
    const f = fixture(t);
    await assert.rejects(captureAnchorQA({
      ...f,
      async capture({ width, height }) {
        if (width === 1440) {
          const file = changed === 'locked reference' ? path.join(f.dir, 'anchor.desktop.png') : f.live;
          fs.chmodSync(file, 0o644);
          fs.appendFileSync(file, Buffer.from([0]));
          fs.chmodSync(file, 0o444);
        }
        return png(width, height);
      },
    }), { status: 409 }, changed);
  }
});

test('an unlocked design and a canceled capture cannot return a report', async t => {
  const f = fixture(t);
  const unlocked = f.flow.dispatch('unlock', { actor: 'manager', anchorId: f.anchor.id, reason: 'Revise the design' });
  assert.equal(unlocked.ok, true);
  await assert.rejects(captureAnchorQA({ ...f, capture: () => assert.fail('Unexpected capture') }), { status: 409 });

  const current = fixture(t);
  const controller = new AbortController();
  const stop = new Error('Owner canceled Anchor QA.');
  let captures = 0;
  await assert.rejects(captureAnchorQA({
    ...current, signal: controller.signal,
    async capture({ width, height, signal }) {
      assert.equal(signal, controller.signal);
      captures += 1;
      controller.abort(stop);
      return png(width, height);
    },
  }), error => error === stop);
  assert.equal(captures, 1);
});

test('prevents screenshots of non-loopback pages, unrelated routes and different local origins', async t => {
  const f = fixture(t);
  const capture = () => assert.fail('Unexpected capture');
  for (const url of [
    'http://example.test/studio.html?preview=1',
    'http://127.0.0.1:8800/api/state',
    'http://127.0.0.1:8800/studio.html?preview=1#01-hero',
    'http://name:password@127.0.0.1:8800/studio.html?preview=1',
  ]) await assert.rejects(captureAnchorQA({ ...f, previewUrl: () => url, capture }), /Studio preview URL on loopback/);
  await assert.rejects(captureAnchorQA({
    ...f, previewUrl: width => width === 1440 ? PREVIEW : PREVIEW.replace(':8800', ':8801'), capture,
  }), /same loopback origin/);
});

test('closing the DevTools driver settles pending calls and stops a process that ignores SIGTERM', {
  skip: process.platform === 'win32' && 'Uses a POSIX executable fixture.',
  timeout: 12000,
}, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-chrome-close-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 2 }));
  const binary = path.join(root, 'chrome.js');
  const ready = path.join(root, 'ready');
  fs.writeFileSync(binary, `#!/usr/bin/env node
process.on('SIGTERM', () => {});
require('node:fs').writeFileSync(${JSON.stringify(ready)}, String(process.pid));
setTimeout(() => {}, 8000);
`, { mode: 0o700 });
  const chrome = startChrome(binary, path.join(root, 'profile'), 393);
  t.after(() => chrome.close());
  const until = Date.now() + 5000;
  while (!fs.existsSync(ready) && Date.now() < until) await delay(20);
  const pid = Number(fs.readFileSync(ready, 'utf8'));
  const result = assert.rejects(chrome.send('Browser.getVersion'), /Chrome session closed/);
  await chrome.close();
  await result;
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('Chrome captures the real isolated Studio at all three viewport sizes', {
  skip: process.env.SWARM_ANCHOR_QA_CHROME_TEST !== '1' && 'Set SWARM_ANCHOR_QA_CHROME_TEST=1 to run the browser proof.',
  timeout: 75000,
}, async t => {
  const f = fixture(t);
  const ui = path.join(SWARM, 'ui');
  const designSystem = path.join(SWARM, 'design-system');
  const sections = path.join(f.projectDir, 'sections');
  fs.mkdirSync(sections);
  fs.writeFileSync(path.join(sections, '01-hero.html'), '<section class="s-01" id="01-hero"><h1>Studio capture</h1></section>');
  fs.writeFileSync(path.join(sections, '01-hero.css'), '.s-01 { min-height: 100vh; background-color: #ff0000; }');
  fs.writeFileSync(path.join(f.projectDir, 'tokens.css'), ':root {}');
  const preview = createPreview({ ui, project: f.projectDir, designSystem, library: ui, mall: ui });
  const server = http.createServer((req, res) => {
    if (preview(req, res, 'http://' + req.headers.host)) return;
    const route = new URL(req.url, PREVIEW).pathname;
    if (route === '/api/state') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
        agents: {}, previewSections: [{ id: '01', section: 'hero' }],
      }));
      return;
    }
    const match = /^\/(ds\/)?([a-z][\w-]*\.(css|js))$/.exec(route);
    const file = match && path.join(match[1] ? designSystem : ui, match[2]);
    if (file && fs.existsSync(file)) {
      res.writeHead(200, { 'content-type': match[3] === 'css' ? 'text/css' : 'text/javascript' }).end(fs.readFileSync(file));
    } else res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/studio.html?preview=1&theme=light`;
  const result = await captureAnchorQA({ ...f, previewUrl: () => url, includeEvidence: true, signal: AbortSignal.timeout(65000) });
  assert.deepEqual(result.breakpoints.map(({ status }) => status), ['pass', 'missing', 'missing'],
    result.breakpoints.map(({ name, status, message }) => `${name}: ${message || status}`).join('\n'));
  assert.ok(result.breakpoints[0].report.palette.screenshot.some(color => color.hex === '#ff0000'));
  assert.deepEqual(Object.values(result.evidence).map(({ screenshot }) =>
    [screenshot.readUInt32BE(16), screenshot.readUInt32BE(20)]), VIEWPORTS);
});
