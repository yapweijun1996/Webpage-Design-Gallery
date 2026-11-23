'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { compare } = require('../tools/anchor-qa');
const { startChrome } = require('../tools/impact-check');
const { findChrome } = require('../tools/shot');
const { approvedAnchor } = require('./publication');

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const BREAKPOINTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 393, height: 844 },
];

class AnchorQAConflictError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}

class ScreenshotError extends Error {
  constructor(phase, message) {
    super(message);
    this.phase = phase;
    this.status = 502;
  }
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readRegular(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || fs.realpathSync.native(file) !== file) {
      throw new Error('Expected a regular project file.');
    }
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}

function activeAnchor(project, expected) {
  let current;
  try { current = approvedAnchor(project); }
  catch { throw new AnchorQAConflictError('The approved design anchor or contract could not be verified.'); }
  if (!current || current.id !== expected?.id || current.contractHash !== expected.contractHash) {
    throw new AnchorQAConflictError('The approved design anchor changed before review could finish.');
  }
  const directory = path.join(project, 'anchors', current.id);
  let locked;
  try {
    locked = readRegular(path.join(directory, 'contract.json'));
    if (hash(locked) !== current.contractHash) throw new Error('Changed locked contract.');
  } catch { throw new AnchorQAConflictError('The locked design contract changed or could not be read.'); }
  try {
    const live = readRegular(path.join(project, 'contract.json'));
    if (!live.equals(locked)) throw new Error('Changed live contract.');
  } catch { throw new AnchorQAConflictError('The live design contract does not match the locked anchor.'); }
  return { ...current, directory, locked };
}

function readReferences({ directory, locked, files }) {
  const { anchorSha256 } = JSON.parse(locked.toString('utf8'));
  const references = new Map();
  try {
    for (const { name } of BREAKPOINTS) {
      const file = `anchor.${name}.png`;
      if (!files.includes(file)) continue;
      const bytes = readRegular(path.join(directory, file));
      if (hash(bytes) !== anchorSha256[file]) throw new Error('Changed reference.');
      references.set(name, bytes);
    }
  } catch { throw new AnchorQAConflictError('A locked anchor reference changed or could not be read.'); }
  return references;
}

function trustedUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.hash || url.pathname !== '/studio.html' ||
      url.searchParams.getAll('preview').join(',') !== '1') {
    throw new TypeError('Anchor QA requires the isolated Studio preview URL on loopback.');
  }
  return url;
}

// Run inside the opaque Studio frame after the render roster and appearance arrive.
async function prepareFrame(width, height, sections, appearance) {
  if (window.origin !== 'null' || innerWidth !== width || innerHeight !== height || document.readyState !== 'complete' ||
      !window.SDS?.i18n || Object.entries(appearance).some(([key, value]) => SDS[key].get() !== value)) return false;
  if (!sections.every(({ id, content }) => {
    const body = document.querySelector('#host-' + id + ' > .body');
    return body && (!content || body.innerHTML.trim().length > 0);
  })) return false;
  await SDS.i18n.load(SDS.lang.get());
  SDS.i18n.apply();
  await Promise.all([...document.images].map(image => {
    image.loading = 'eager';
    return image.decode().catch(() => {});
  }));
  await document.fonts.ready;
  for (const animation of document.getAnimations()) {
    if (!animation.effect || animation.timeline !== document.timeline) continue;
    const end = animation.effect.getComputedTiming().endTime;
    animation.pause();
    animation.currentTime = Number.isFinite(end) ? end : 0;
  }
  window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const geometry = [];
  const clip = node => {
    const rect = node.getBoundingClientRect();
    const x = Math.max(0, rect.left), y = Math.max(0, rect.top);
    return { x, y, width: Math.min(width, rect.right) - x, height: Math.min(height, rect.bottom) - y };
  };
  for (const { id, sectionId } of sections) {
    const host = document.getElementById('host-' + id);
    const body = host.querySelector(':scope > .body');
    const root = body.firstElementChild;
    if (body.children.length !== 1 || root?.id !== sectionId ||
        getComputedStyle(host.querySelector(':scope > .stub')).display !== 'none') {
      const visible = clip(host);
      if (visible.width > 0 && visible.height > 0) return { geometry: [] };
      continue;
    }
    const rect = clip(root);
    if (rect.width > 0 && rect.height > 0) geometry.push({ sectionId, ...rect });
  }
  return { geometry };
}

function browserCapture(project, origin, signal) {
  const chromePath = findChrome();
  if (!chromePath) {
    return { capture() { throw new ScreenshotError('setup', 'Chrome could not be found for the Studio screenshot.'); } };
  }
  const sectionDir = path.join(project, 'sections');
  const dir = fs.lstatSync(sectionDir, { throwIfNoEntry: false });
  const sections = dir?.isDirectory() && fs.realpathSync.native(sectionDir) === sectionDir &&
    fs.readdirSync(sectionDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^\d{2}-[a-z0-9-]+\.html$/.test(entry.name))
    .map(({ name }) => ({ id: name.slice(0, 2), sectionId: name.slice(0, -5),
      content: Boolean(readRegular(path.join(sectionDir, name)).toString('utf8').trim()) }));
  if (!sections?.length) return { capture() { throw new ScreenshotError('setup', 'The Studio preview has no sections to capture.'); } };

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-anchor-qa-'));
  const browser = startChrome(chromePath, path.join(scratch, 'profile'), 1440);
  const sessions = new Map();
  let closing;
  const stop = () => { closing ??= browser.close(); };
  signal?.addEventListener('abort', stop, { once: true });

  const sendTo = (session, method, params) => browser.send(method, params, session);
  const on = (session, method, callback) => browser.events.on(`${session}:${method}`, callback);

  async function attach(id) {
    const contexts = new Map();
    sessions.set(id, contexts);
    on(id, 'Runtime.executionContextCreated', ({ context }) => {
      if (context.auxData?.isDefault) contexts.set(context.auxData.frameId, context.uniqueId);
    });
    on(id, 'Runtime.executionContextsCleared', () => contexts.clear());
    on(id, 'Fetch.requestPaused', ({ requestId, request }) => {
      const target = URL.parse(request.url);
      const local = target?.origin === origin && ['GET', 'HEAD'].includes(request.method) &&
        (!target.pathname.startsWith('/api/') || target.pathname === '/api/state');
      const inline = target?.protocol === 'data:' || target?.protocol === 'blob:';
      const operation = local || inline ? sendTo(id, 'Fetch.continueRequest', { requestId })
        : sendTo(id, 'Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      operation.catch(() => {});
    });
    await Promise.all([sendTo(id, 'Page.enable'), sendTo(id, 'Runtime.enable'),
      sendTo(id, 'Fetch.enable', { patterns: [{ urlPattern: '*' }] })]);
  }

  async function setup() {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    on(sessionId, 'Target.attachedToTarget', ({ sessionId: frame }) => {
      attach(frame).then(() => sendTo(frame, 'Runtime.runIfWaitingForDebugger')).catch(() => {});
    });
    on(sessionId, 'Target.detachedFromTarget', ({ sessionId: frame }) => sessions.delete(frame));
    await attach(sessionId);
    const send = (method, params) => sendTo(sessionId, method, params);
    await send('Target.setAutoAttach', {
      autoAttach: true, waitForDebuggerOnStart: true, flatten: true, filter: [{ type: 'iframe' }, { exclude: true }],
    });
    return { sessionId, send };
  }

  async function ready({ sessionId }, width, height, appearance) {
    const expression = `(${prepareFrame})(${width},${height},${JSON.stringify(sections)},${JSON.stringify(appearance)})`;
    const until = Date.now() + 12000;
    while (Date.now() < until) {
      signal?.throwIfAborted();
      for (const [id, contexts] of sessions) {
        const result = await sendTo(id, 'Page.getFrameTree').catch(() => null);
        if (!result) continue;
        const { frameTree } = result;
        const frames = id === sessionId ? frameTree.childFrames ?? [] : [frameTree];
        const frame = frames.find(({ frame }) => frame.url === `${origin}/studio-preview.html`)?.frame;
        const uniqueContextId = frame && contexts.get(frame.id);
        if (!uniqueContextId) continue;
        const answer = await sendTo(id, 'Runtime.evaluate', {
          expression, uniqueContextId, returnByValue: true, awaitPromise: true,
        }).catch(() => null);
        if (Array.isArray(answer?.result?.value?.geometry)) return answer.result.value.geometry;
      }
      await delay(50, undefined, { signal });
    }
    throw new ScreenshotError('readiness', 'The isolated Studio frame did not finish rendering at the requested viewport.');
  }

  let setupBrowser;
  return {
    async capture({ url, width, height }) {
      signal?.throwIfAborted();
      const environment = await (setupBrowser ??= setup().catch(() => {
        throw new ScreenshotError('setup', 'Chrome could not initialize the Studio screenshot session.');
      }));
      const { send } = environment;
      const target = new URL(url);
      target.searchParams.set('w', width);
      target.searchParams.set('h', height);
      const appearance = Object.fromEntries(['theme', 'brand', 'lang']
        .filter(key => target.searchParams.has(key)).map(key => [key, target.searchParams.get(key)]));
      try {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await send('Emulation.setEmulatedMedia', { features: [
          { name: 'prefers-reduced-motion', value: 'reduce' },
          { name: 'prefers-color-scheme', value: appearance.theme === 'dark' ? 'dark' : 'light' },
        ] });
        const navigation = await send('Page.navigate', { url: target.href });
        if (navigation.errorText) throw new Error('Navigation failed.');
      } catch { throw new ScreenshotError('setup', 'Chrome could not open the Studio preview.'); }
      const geometry = await ready(environment, width, height, appearance);
      try {
        const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
        return { screenshot: Buffer.from(data, 'base64'), geometry };
      } catch { throw new ScreenshotError('capture', 'Chrome could not capture the rendered Studio preview.'); }
    },
    async close() {
      signal?.removeEventListener('abort', stop);
      stop();
      try {
        await closing;
        fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 2 });
      } catch {
        signal?.throwIfAborted();
        throw new ScreenshotError('teardown', 'Chrome could not clean up the Studio screenshot session.');
      }
    },
  };
}

function screenshotAt(bytes, width, height) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE) ||
      bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) {
    throw new ScreenshotError('capture', 'Studio did not produce a screenshot at the requested viewport.');
  }
  return Buffer.from(bytes);
}

async function captureAnchorQA({ projectDir, anchor, previewUrl, signal, capture, includeEvidence = false }) {
  signal?.throwIfAborted();
  const project = path.resolve(projectDir);
  const expected = { id: anchor?.id, contractHash: anchor?.contractHash };
  const references = readReferences(activeAnchor(project, expected));
  const targets = BREAKPOINTS.map(({ width, height }) => trustedUrl(previewUrl(width, height)));
  if (targets.some(url => url.origin !== targets[0].origin)) throw new TypeError('Studio snapshots must use the same loopback origin.');

  const studio = !capture && browserCapture(project, targets[0].origin, signal);
  try {
    return await captureViewports({ project, expected, references, targets, signal, capture: capture || studio.capture, includeEvidence });
  } finally { await studio?.close?.(); }
}

async function captureViewports({ project, expected, references, targets, signal, capture, includeEvidence }) {
  const breakpoints = [];
  const evidence = {};
  for (const [index, viewport] of BREAKPOINTS.entries()) {
    signal?.throwIfAborted();
    const { name, width, height } = viewport;
    const reference = references.get(name);
    const base = { ...viewport, referenceAvailable: Boolean(reference) };
    let screenshot, geometry;
    try {
      const captured = await capture({ url: targets[index].href, width, height, signal });
      signal?.throwIfAborted();
      screenshot = screenshotAt(Buffer.isBuffer(captured) ? captured : captured?.screenshot, width, height);
      if (Array.isArray(captured?.geometry) && captured.geometry.length) geometry = captured.geometry;
    } catch (error) {
      signal?.throwIfAborted();
      const message = error instanceof ScreenshotError ? error.message : 'The Studio screenshot could not be captured.';
      breakpoints.push({ ...base, status: 'error', phase: error instanceof ScreenshotError ? error.phase : 'capture', message });
      continue;
    }
    if (includeEvidence) evidence[name] = { screenshot };
    if (!reference) {
      breakpoints.push({ ...base, status: 'missing', message: 'The locked anchor has no reference image for this viewport.' });
      continue;
    }
    try {
      const { comparePng, ...report } = compare(reference, screenshot, { includeImage: includeEvidence });
      if (includeEvidence) evidence[name].comparison = comparePng;
      breakpoints.push({ ...base, status: report.pass ? 'pass' : 'fail', score: report.score, threshold: report.threshold, report,
        ...(geometry ? { geometry } : {}) });
    } catch {
      breakpoints.push({ ...base, status: 'error', message: 'The locked reference and Studio screenshot could not be compared.' });
    }
  }
  signal?.throwIfAborted();
  activeAnchor(project, expected);
  return {
    ok: breakpoints.every(({ status }) => status === 'pass' || status === 'missing'),
    anchorId: expected.id, contractHash: expected.contractHash,
    completeCoverage: breakpoints.every(({ status }) => status === 'pass' || status === 'fail'),
    breakpoints,
    ...(includeEvidence ? { evidence } : {}),
  };
}

module.exports = { AnchorQAConflictError, ScreenshotError, captureAnchorQA };
