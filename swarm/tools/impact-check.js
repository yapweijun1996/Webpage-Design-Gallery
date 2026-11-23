#!/usr/bin/env node
'use strict';

const { execFileSync, spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { EventEmitter, once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');
const { parseArgs } = require('node:util');
const { createPreview } = require('../lib/preview');
const { findChrome } = require('./shot');
const { compare } = require('./visual-compare');
const { decodePng, encodePng } = require('./anchor-qa');

const DEFAULT_WIDTHS = [393, 768, 1440];
const HEIGHT = 844;
const TIMEOUT = 30_000;
const PAGE = 'http://swarm-impact.invalid';
const STUDIO_STAGE = '/studio-preview.html';
const SHARED_PREVIEW = '/shared-tokens-preview';
const STUDIO_VIEWPORTS = [
  { width: 393, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 },
];
const SWARM = path.resolve(__dirname, '..');
const STUDIO_UI = path.join(SWARM, 'ui');
const DESIGN_SYSTEM = path.join(SWARM, 'design-system');
const REPO = path.dirname(SWARM);
const SECTION_ID = /^\d{2}-[a-z0-9][a-z0-9-]*$/;
const EVIDENCE_LIMIT = 64 * 1024 * 1024;
const digestBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const BOX_FIELDS = ['x', 'y', 'width', 'height'];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function exportPage(project, output) {
  project = fs.realpathSync(project);
  execFileSync(process.execPath, [path.join(__dirname, 'export-page.js'), project, '--out', output, '--title', 'Swarm impact check'],
    { timeout: TIMEOUT, stdio: 'pipe' });
  const ids = fs.readdirSync(path.join(project, 'sections'), { withFileTypes: true })
    .filter(file => file.isFile() && /^\d{2}-.+\.html$/.test(file.name))
    .map(file => path.basename(file.name, '.html')).sort();
  return { project, output: fs.realpathSync(output), ids };
}

function withinRoot(root, file) {
  const relative = path.relative(root, file);
  return relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

function localFile(root, relative) {
  const candidate = path.resolve(root, relative);
  if (!withinRoot(root, candidate)) return undefined;
  try {
    const file = fs.realpathSync(candidate);
    if (withinRoot(root, file) && fs.statSync(file).isFile()) return file;
  } catch (error) {
    if (!['ENOENT', 'EISDIR', 'ENOTDIR', 'ELOOP', 'ERR_INVALID_ARG_VALUE'].includes(error.code)) throw error;
  }
}

async function serveRequest(send, bundle, { requestId, request }) {
  const url = new URL(request.url);
  if (url.protocol === 'data:' || url.protocol === 'blob:') return send('Fetch.continueRequest', { requestId });
  if (url.origin !== PAGE) return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
  let file;
  try {
    const relative = decodeURIComponent(url.pathname.slice(1));
    file = localFile(bundle.output, relative);
    if (!file && relative.startsWith('assets/')) {
      // Resolve project-generated assets that are referenced by the export but are not copied by it.
      const asset = localFile(bundle.project, relative);
      if (asset?.startsWith(path.join(bundle.project, 'assets') + path.sep)) file = asset;
    }
  } catch (error) {
    if (!(error instanceof URIError)) throw error;
  }
  if (!file) return send('Fetch.fulfillRequest', { requestId, responseCode: url.pathname === '/favicon.ico' ? 204 : 404 });
  return send('Fetch.fulfillRequest', {
    requestId, responseCode: 200,
    responseHeaders: [{ name: 'Content-Type', value: MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' }],
    body: fs.readFileSync(file).toString('base64'),
  });
}

function startChrome(binary, profile, width) {
  const processGroup = process.platform !== 'win32';
  const chrome = spawn(binary, [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
    `--window-size=${Math.max(width, 500)},${HEIGHT}`, '--force-device-scale-factor=1', '--hide-scrollbars',
    '--disable-gpu', '--disable-background-networking', '--use-mock-keychain', '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { detached: processGroup, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const stopped = new AbortController();
  const exited = new Promise(resolve => {
    chrome.once('exit', resolve);
    chrome.once('error', resolve);
  });
  const events = new EventEmitter();
  const pending = new Map();
  const [, , stderr, input, output] = chrome.stdio;
  let diagnostics = '';
  let buffer = '';
  let id = 0;

  function stop(error) {
    stopped.abort(error);
    for (const finish of pending.values()) finish(error);
  }

  stderr.setEncoding('utf8').on('data', data => { diagnostics = (diagnostics + data).slice(-4096); });
  chrome.on('error', stop);
  chrome.on('exit', (code, signal) => {
    const detail = diagnostics.trim();
    stop(new Error(`Chrome exited (${signal ?? code})${detail ? ': ' + detail : ''}`));
  });
  input.on('error', error => { if (error.code !== 'EPIPE') stop(error); });
  output.on('error', stop);
  output.setEncoding('utf8').on('data', data => {
    buffer += data;
    let end;
    // DevTools uses nul-delimited JSON over the child process pipes.
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.id !== undefined) pending.get(message.id)?.(null, message);
      else events.emit(`${message.sessionId}:${message.method}`, message.params);
    }
  });

  function send(method, params = {}, sessionId) {
    if (stopped.signal.aborted) return Promise.reject(stopped.signal.reason);
    const request = ++id;
    return new Promise((resolve, reject) => {
      function finish(error, message) {
        clearTimeout(timer);
        pending.delete(request);
        if (error) reject(error);
        else if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      }
      const timer = setTimeout(() => finish(new Error(`Timed out waiting for Chrome ${method}`)), TIMEOUT);
      pending.set(request, finish);
      input.write(`${JSON.stringify({ id: request, method, params, sessionId })}\0`);
    });
  }

  let closing;
  function close() {
    if (closing) return closing;
    stop(new Error('Chrome session closed.'));
    closing = (async () => {
      function terminate(signal) {
        if (!chrome.pid) return;
        try {
          if (processGroup) process.kill(-chrome.pid, signal);
          else chrome.kill(signal);
        } catch (error) { if (error.code !== 'ESRCH') chrome.kill(signal); }
      }
      terminate('SIGTERM');
      const force = setTimeout(() => terminate('SIGKILL'), 1000);
      try { await exited; }
      finally {
        clearTimeout(force);
        // Chromium descendants may inherit these descriptors after its main process exits.
        for (const stream of [stderr, input, output]) stream?.destroy();
      }
    })();
    return closing;
  }

  return {
    send, events,
    async wait(event) {
      try {
        await once(events, event, { signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(TIMEOUT)]) });
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
        throw stopped.signal.reason ?? new Error('Timed out waiting for Chrome page load');
      }
    },
    close,
  };
}

// This function runs inside Chrome. Measurements use document coordinates at the top of the page.
async function measurePage(ids, width, flowOwner, studio = false) {
  if (window.innerWidth !== width) throw new Error(`Expected viewport ${width}px, got ${window.innerWidth}px`);
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

  const viewport = document.documentElement.clientWidth;
  const roots = ids.map(id => [id, document.getElementById(id)]);
  function overflow(node, clipLeft, clipRight) {
    const { left, width, right, height } = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (style.display === 'none') return 0;
    let pixels = 0;
    if (width && height) {
      const overhang = style.overflowX === 'visible' ? Math.max(0, node.scrollWidth - node.clientWidth) : 0;
      const start = Math.max(clipLeft, left - (style.direction === 'rtl' ? overhang : 0));
      const end = Math.min(clipRight, right + (style.direction === 'rtl' ? 0 : overhang));
      if (end > start) pixels = Math.max(-start, end - viewport, 0);
      if (style.overflowX !== 'visible') {
        clipLeft = Math.max(clipLeft, left);
        clipRight = Math.min(clipRight, right);
      }
    }
    for (const child of node.children) pixels = Math.max(pixels, overflow(child, clipLeft, clipRight));
    return pixels;
  }

  const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - viewport);
  const sections = Object.fromEntries(roots.map(([id, root]) => {
    if (!root) return [id, null];
    const { x, y, width, height } = root.getBoundingClientRect();
    return [id, { box: { x, y, width, height },
      ...(studio && { hidden: !width || !height || !root.checkVisibility({ opacityProperty: true, visibilityProperty: true }) }),
      horizontalOverflow: overflow(root, -Infinity, Infinity),
      empty: Boolean(flowOwner && !height && !root.childElementCount && !root.textContent.trim()) }];
  }));
  const subject = flowOwner && document.getElementById(flowOwner);
  if (subject) {
    const style = subject.getAttribute('style');
    try {
      subject.style.setProperty('display', 'none', 'important');
      for (const [id, root] of roots) {
        if (root && id > flowOwner) sections[id].withoutOwnerY = root.getBoundingClientRect().y;
      }
    } finally {
      if (style === null) subject.removeAttribute('style');
      else subject.setAttribute('style', style);
    }
  }
  return {
    horizontalOverflow, sections,
    scripts: [...document.scripts].map(script => ({
      section: roots.find(([, root]) => root?.contains(script))?.[0] ?? null,
      src: script.src,
      text: script.text,
    })),
  };
}

function scriptOwners(url, html, scripts) {
  const inline = [...html.replace(/\r\n?/g, '\n').matchAll(/<!--[\s\S]*?-->|<script\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match => match[1] !== undefined);
  const external = new Map();
  const locations = [];
  for (const [index, script] of scripts.entries()) {
    if (script.src) {
      // A shared script cannot be blamed on just one of its callers.
      const previous = external.get(script.src);
      external.set(script.src, previous === undefined || previous === script.section ? script.section : null);
    } else if (script.section && inline[index]?.[1] === script.text) {
      const firstLine = inline[index].input.slice(0, inline[index].index).split('\n').length - 1;
      locations.push({ firstLine, lastLine: firstLine + inline[index][0].split('\n').length - 1, section: script.section });
    }
  }
  return (source, line) => source === url
    ? locations.find(range => line >= range.firstLine && line <= range.lastLine)?.section ?? null
    : external.get(source) ?? null;
}

function screenshotClip(box, width) {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const right = Math.min(width, Math.ceil(box.x + box.width));
  const bottom = Math.ceil(box.y + box.height);
  if (box.width > 0 && box.height > 0 && right > x && bottom > y) {
    return { x, y, width: right - x, height: bottom - y, scale: 1 };
  }
}

async function render(chrome, bundle, width, flowOwner) {
  const { browserContextId } = await chrome.send('Target.createBrowserContext');
  const listeners = [];
  try {
    const { targetId } = await chrome.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await chrome.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => chrome.send(method, params, sessionId);
    const on = (method, handler) => {
      const name = `${sessionId}:${method}`;
      chrome.events.on(name, handler);
      listeners.push([name, handler]);
    };

    const logs = [];
    const loaded = new Set();
    let serveError;
    on('Fetch.requestPaused', params => { serveRequest(send, bundle, params).catch(error => { serveError ??= error; }); });
    on('Page.lifecycleEvent', ({ name, loaderId }) => {
      if (name !== 'load') return;
      loaded.add(loaderId);
      chrome.events.emit(`${sessionId}:load:${loaderId}`);
    });
    on('Runtime.consoleAPICalled', ({ type, args, stackTrace }) => {
      if (type === 'error' || type === 'assert') {
        const message = args.map(arg => arg.value ?? arg.description ?? arg.type).join(' ');
        logs.push({ message, frames: stackTrace?.callFrames ?? [] });
      }
    });
    on('Runtime.exceptionThrown', ({ exceptionDetails: details }) => {
      const message = details.exception?.description?.split('\n')[0] ?? details.text;
      logs.push({ message, frames: [details, ...(details.stackTrace?.callFrames ?? [])] });
    });

    await send('Page.enable');
    await send('Page.setLifecycleEventsEnabled', { enabled: true });
    await send('Runtime.enable');
    // Serve both states at the same URL from isolated contexts, without a listening port or live resources.
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' },
    ] });
    await send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    const url = `${PAGE}/index.html`;
    const navigation = await send('Page.navigate', { url });
    if (navigation.errorText || !navigation.loaderId) throw new Error(`Chrome navigation failed: ${navigation.errorText ?? url}`);
    if (!loaded.has(navigation.loaderId)) await chrome.wait(`${sessionId}:load:${navigation.loaderId}`);
    if (serveError) throw serveError;

    const data = await send('Runtime.evaluate', {
      expression: `(${measurePage})(${JSON.stringify(bundle.ids)}, ${width}, ${JSON.stringify(flowOwner)})`, awaitPromise: true, returnByValue: true,
    });
    if (data.exceptionDetails) throw new Error(data.exceptionDetails.exception?.description ?? 'Chrome could not measure the page');
    const { horizontalOverflow, sections, scripts } = data.result.value;
    for (const section of Object.values(sections)) {
      if (!section) continue;
      const clip = screenshotClip(section.box, width);
      if (!clip) continue;
      const screenshot = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
      section.png = Buffer.from(screenshot.data, 'base64');
    }
    if (serveError) throw serveError;
    const ownerForScript = scriptOwners(url, fs.readFileSync(path.join(bundle.output, 'index.html'), 'utf8'), scripts);
    const consoleErrors = logs.map(({ message, frames }) => ({
      section: frames.map(frame => ownerForScript(frame.url, frame.lineNumber)).find(Boolean) ?? null,
      message,
    }));
    return { sections, horizontalOverflow, consoleErrors };
  } finally {
    for (const [event, handler] of listeners) chrome.events.off(event, handler);
    await chrome.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
}

function errorChanges(before, after) {
  const allowance = new Map();
  const key = error => JSON.stringify([error.section, error.message]);
  for (const error of before) allowance.set(key(error), (allowance.get(key(error)) ?? 0) + 1);
  const added = after.filter(error => {
    const remaining = allowance.get(key(error)) ?? 0;
    if (!remaining) return true;
    allowance.set(key(error), remaining - 1);
    return false;
  });
  return { before, after, added };
}

function compareWidth(before, after, owner, { componentRestore = false } = {}) {
  const consoleErrors = errorChanges(before.consoleErrors, after.consoleErrors);
  const ids = [...new Set([...Object.keys(before.sections), ...Object.keys(after.sections)])].sort();
  const perSection = ids.map(id => {
    const previous = before.sections[id];
    const current = after.sections[id];
    const boxDelta = previous && current ? Object.fromEntries(BOX_FIELDS.map(field => [field, current.box[field] - previous.box[field]])) : null;
    const moved = Boolean(boxDelta?.x || boxDelta?.y);
    const resized = Boolean(boxDelta?.width || boxDelta?.height);
    const presenceChanged = Boolean(previous) !== Boolean(current);
    let diffRatio = 0;
    if (previous?.png && current?.png) {
      if (!previous.png.equals(current.png)) diffRatio = compare(previous.png, current.png).differentRatio;
    } else if (presenceChanged || previous?.png || current?.png) diffRatio = 1;
    const horizontalOverflow = { before: previous?.horizontalOverflow ?? 0, after: current?.horizontalOverflow ?? 0 };
    const errors = Object.fromEntries(Object.entries(consoleErrors).map(([key, list]) => [key,
      list.filter(error => error.section === id).map(error => error.message),
    ]));
    const changed = presenceChanged || moved || resized || diffRatio > 0
      || horizontalOverflow.after !== horizontalOverflow.before || errors.added.length > 0;
    const emptyPlaceholder = previous?.empty && current?.empty;
    const sameYWithoutOwner = Number.isFinite(previous?.withoutOwnerY) && previous.withoutOwnerY === current?.withoutOwnerY;
    // Restoration can grow or shrink the owner. Even an empty peer needs proof of owner flow.
    const allowedTranslation = componentRestore
      ? sameYWithoutOwner
      : emptyPlaceholder || (boxDelta?.y > 0 && sameYWithoutOwner);
    const flowTranslation = boxDelta?.x === 0 && moved && !resized && diffRatio === 0
      && horizontalOverflow.after === horizontalOverflow.before && errors.added.length === 0
      && allowedTranslation;
    return { id, owned: id === owner, boxDelta, diffRatio, moved, resized, presenceChanged, horizontalOverflow, consoleErrors: errors, changed, flowTranslation };
  });
  return {
    perSection, unexpected: perSection.filter(section => section.changed && !section.owned && !section.flowTranslation).map(section => section.id),
    horizontalOverflow: { before: before.horizontalOverflow, after: after.horizontalOverflow }, consoleErrors,
  };
}

function summarizeWidths(comparisons) {
  const perWidth = [];
  const bySection = new Map();
  const unexpected = new Set();
  for (const { width, perSection, ...report } of comparisons) {
    for (const { id, owned, ...sample } of perSection) {
      if (!bySection.has(id)) bySection.set(id, { id, owned, widths: [] });
      bySection.get(id).widths.push({ width, ...sample });
    }
    for (const id of report.unexpected) unexpected.add(id);
    perWidth.push({ width, ...report });
  }
  const perSection = [...bySection.values()].map(section => {
    const { widths: samples } = section;
    const boxDelta = samples.every(sample => sample.boxDelta) ? Object.fromEntries(BOX_FIELDS.map(field => [field,
      samples.reduce((max, { boxDelta: delta }) => Math.abs(delta[field]) > Math.abs(max) ? delta[field] : max, 0),
    ])) : null;
    const diffRatio = Math.max(...samples.map(sample => sample.diffRatio));
    return { ...section, boxDelta, diffRatio };
  });
  return { ok: unexpected.size === 0, perSection, unexpected: [...unexpected].sort(), perWidth };
}

async function impact(before, after, { owner, firstBuild = false, componentRestore = false, widths = DEFAULT_WIDTHS } = {}) {
  if (!Array.isArray(widths) || !widths.length || widths.some(width => !Number.isSafeInteger(width) || width < 1)) {
    throw new Error('Widths must be positive integers');
  }
  const binary = findChrome();
  if (!binary) throw new Error('Chrome not found; set CHROME_BIN');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-impact-'));
  let chrome;
  try {
    const original = exportPage(before, path.join(temp, 'before'));
    const candidate = exportPage(after, path.join(temp, 'after'));
    // The real window clears Chrome's minimum width. DevTools sets the exact CSS viewport per render.
    chrome = startChrome(binary, path.join(temp, 'profile'), Math.max(...widths));
    await chrome.send('Browser.getVersion');
    const comparisons = [];
    const flowOwner = firstBuild || componentRestore ? owner : null;
    for (const width of new Set(widths)) {
      const started = performance.now();
      const left = await render(chrome, original, width, flowOwner);
      const right = await render(chrome, candidate, width, flowOwner);
      const report = compareWidth(left, right, owner, { componentRestore });
      comparisons.push({ width, runtimeMs: performance.now() - started, ...report });
    }
    return summarizeWidths(comparisons);
  } finally {
    if (chrome) await chrome.close();
    fs.rmSync(temp, { force: true, recursive: true });
  }
}

function sharedStudio(project, ids, appearance, resources) {
  const preview = createPreview({ ui: STUDIO_UI, project, designSystem: DESIGN_SYSTEM,
    library: path.join(REPO, 'assets/companies/gjh'), mall: path.join(REPO, 'demos/corporate/gjh/v11/assets') });
  const roster = ids.map(sectionId => ({
    id: sectionId.slice(0, 2), section: sectionId.slice(3), name: sectionId.slice(3), color: '#64748b', status: 'idle',
  }));
  const frame = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;overflow:hidden}iframe{display:block;border:0;width:100vw;height:100vh}</style>
<iframe title="Studio token impact"></iframe><script src="/preview-bridge.js"></script>
<script>
const frame = document.querySelector('iframe');
const send = StudioPreview.connect(frame, null, () => {
  send('appearance', ${JSON.stringify(appearance)});
  send('roster', ${JSON.stringify(roster)});
});
frame.src = StudioPreview.stage;
</script>`;
  const staticFiles = new Map([
    ['/preview-bridge.js', path.join(STUDIO_UI, 'preview-bridge.js')],
    ['/studio-preview.js', path.join(STUDIO_UI, 'studio-preview.js')],
    ['/studio.css', path.join(STUDIO_UI, 'studio.css')],
    ...['tokens.css', 'themes.css', 'components.css', 'runtime.js', 'i18n.js']
      .map(name => ['/ds/' + name, path.join(DESIGN_SYSTEM, name)]),
  ]);
  return async function serve(send, { requestId, request }) {
    const url = URL.parse(request.url);
    if (url?.origin !== PAGE || !['GET', 'HEAD'].includes(request.method)) {
      if (['data:', 'blob:'].includes(url?.protocol)) return send('Fetch.continueRequest', { requestId });
      return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    }
    function reply(responseCode, body = '', headers = {}) {
      if (request.method === 'GET' && url.pathname !== '/favicon.ico') {
        // Generated asset revision URLs are tied to the temporary copies' inodes.
        const stableBody = /^\/p\/sections\/.*\.(?:html|css)$/.test(url.pathname)
          ? body.toString().replace(/\?swarm_asset=[a-z0-9]+-[a-z0-9]+(&?)/gi, (_, query) => query ? '?' : '')
          : body;
        resources.set(url.pathname, { path: url.pathname, status: responseCode, sha256: digestBytes(stableBody) });
      }
      return send('Fetch.fulfillRequest', { requestId, responseCode,
        responseHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })),
        body: request.method === 'HEAD' ? '' : Buffer.from(body).toString('base64') });
    }
    const headers = Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), value]));
    if (url.pathname === SHARED_PREVIEW && !headers.origin) {
      return reply(200, frame, { 'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `default-src 'none'; frame-src ${PAGE}${STUDIO_STAGE}; script-src ${PAGE}/preview-bridge.js 'unsafe-inline'; style-src 'unsafe-inline'` });
    }
    if (url.pathname === '/favicon.ico') return reply(204);
    const file = staticFiles.get(url.pathname);
    if (file) return reply(200, fs.readFileSync(file), { 'Content-Type': MIME[path.extname(file)] });
    // Reuse Studio's normal preview routes, without exposing project documents or starting an HTTP server.
    if (url.pathname !== STUDIO_STAGE && url.pathname !== '/tokens.css' &&
        !/^\/(?:p\/(?:sections|assets|v11)\/|assets\/generated\/|i18n\/|gjh(?:-v11)?\/|v11\/)/.test(url.pathname)) return reply(404);
    let result;
    const handled = preview({ url: url.pathname + url.search, headers, method: request.method }, {
      writeHead(status, headers) { result = { status, headers }; },
      end(body) { result.body = body; },
    }, PAGE);
    if (!handled) return reply(404);
    return reply(result.status, result.body, result.headers);
  };
}

// Run in the real opaque preview after its roster and requested SDS appearance have arrived.
async function sharedFrameReady(fragments, width, height, appearance) {
  if (window.origin !== 'null' || innerWidth !== width || innerHeight !== height || document.readyState !== 'complete' ||
      !window.SDS?.i18n || Object.entries(appearance).some(([key, value]) => SDS[key].get() !== value)) return false;
  if (!fragments.every(({ id, hasMarkup }) => {
    const body = document.querySelector('#host-' + id.slice(0, 2) + ' > .body');
    return body && (!hasMarkup || body.innerHTML.trim().length);
  })) return false;
  await SDS.i18n.load(SDS.lang.get());
  SDS.i18n.apply();
  return true;
}

async function showSharedSection(id, width, height, offset) {
  const node = document.getElementById(id);
  if (!node) return null;
  window.scrollTo({ left: 0, top: Math.floor(scrollY + node.getBoundingClientRect().top) + offset, behavior: 'instant' });
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  // Scrolling can start compositor animations after the initial page measurement.
  for (const animation of document.getAnimations()) {
    if (!animation.effect || animation.timeline !== document.timeline) continue;
    const end = animation.effect.getComputedTiming().endTime;
    animation.pause();
    animation.currentTime = Number.isFinite(end) ? end : 0;
  }
  await new Promise(resolve => requestAnimationFrame(resolve));
  const box = node.getBoundingClientRect();
  const x = Math.max(0, Math.floor(box.left));
  const y = Math.floor(box.top) + offset;
  const right = Math.min(width, Math.ceil(box.right));
  // scrollHeight is integer CSS pixels. A fractional footer can extend beyond
  // the last drawable pixel after Chrome rounds the document extent.
  const contentBottom = Math.min(Math.ceil(box.bottom), document.scrollingElement.scrollHeight - scrollY);
  const bottom = Math.min(height, contentBottom);
  if (right <= x || y < 0 || bottom <= y) return null;
  // Keep one row outside this crop for a paint probe. A later strip captures the row itself.
  return { clip: { x, y, width: right - x, height: Math.min(bottom - y, height - 1) },
    totalHeight: contentBottom - Math.floor(box.top) };
}

function markSharedPaint(row, color) {
  const key = Symbol.for('swarm.paintProbe');
  const mark = window[key] ??= document.createElement('div');
  // Use a document-space marker so a stale iframe scroll transform cannot satisfy the probe.
  mark.style.cssText = `all:initial!important;position:absolute!important;top:${scrollY + row}px!important;
    left:0!important;width:2px!important;height:1px!important;background:#${color}!important;
    z-index:2147483647!important;pointer-events:none!important`;
  if (!mark.isConnected) document.documentElement.append(mark);
}

async function captureStableShared(capture, settle, signal) {
  let previous;
  for (let attempt = 0; attempt < 5; attempt++) {
    signal?.throwIfAborted();
    await settle();
    signal?.throwIfAborted();
    const png = await capture();
    if (png && previous?.equals(png)) return png;
    previous = png;
  }
  throw new Error('Studio did not paint a stable screenshot.');
}

async function renderShared(chrome, project, fragments, { width, height }, appearance, colorScheme, takeEvidence, signal) {
  const ids = fragments.map(({ id }) => id);
  const resources = new Map();
  const serve = sharedStudio(project, ids, appearance, resources);
  const { browserContextId } = await chrome.send('Target.createBrowserContext');
  const listeners = [];
  try {
    const { targetId } = await chrome.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await chrome.send('Target.attachToTarget', { targetId, flatten: true });
    const sendTo = (session, method, params) => chrome.send(method, params, session);
    const send = (method, params) => sendTo(sessionId, method, params);
    const sessions = new Map();
    const consoleErrors = [];
    const media = { features: [
      { name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: colorScheme },
    ] };
    let failed;
    function on(session, event, handler) {
      const name = `${session}:${event}`;
      chrome.events.on(name, handler);
      listeners.push([name, handler]);
    }
    function report(message) { consoleErrors.push({ section: null, message }); }
    async function attach(session) {
      const contexts = new Map();
      sessions.set(session, contexts);
      on(session, 'Runtime.executionContextCreated', ({ context }) => {
        if (context.auxData?.isDefault) contexts.set(context.auxData.frameId, context.uniqueId);
      });
      on(session, 'Runtime.executionContextsCleared', () => contexts.clear());
      on(session, 'Runtime.consoleAPICalled', ({ type, args }) => {
        if (type === 'error' || type === 'assert') report(args.map(arg => arg.value ?? arg.description ?? arg.type).join(' '));
      });
      on(session, 'Runtime.exceptionThrown', ({ exceptionDetails: details }) => {
        report(details.exception?.description?.split('\n')[0] ?? details.text);
      });
      on(session, 'Log.entryAdded', ({ entry }) => {
        if (entry.level === 'error' && entry.source === 'security') report(entry.text);
      });
      on(session, 'Fetch.requestPaused', request => {
        serve((method, params) => sendTo(session, method, params), request).catch(error => { failed ??= error; });
      });
      await Promise.all(['Page', 'Runtime', 'Log'].map(domain => sendTo(session, domain + '.enable')));
      await sendTo(session, 'Fetch.enable', { patterns: [{ urlPattern: '*' }] });
      await sendTo(session, 'Emulation.setEmulatedMedia', media);
    }
    await attach(sessionId);
    on(sessionId, 'Target.attachedToTarget', ({ sessionId: child }) => {
      attach(child).then(() => sendTo(child, 'Runtime.runIfWaitingForDebugger'))
        .catch(error => { if (sessions.has(child)) failed ??= error; });
    });
    on(sessionId, 'Target.detachedFromTarget', ({ sessionId: child }) => sessions.delete(child));
    await send('Target.setAutoAttach', {
      autoAttach: true, waitForDebuggerOnStart: true, flatten: true, filter: [{ type: 'iframe', exclude: false }],
    });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const navigation = await send('Page.navigate', { url: PAGE + SHARED_PREVIEW });
    if (navigation.errorText) throw new Error(`Chrome navigation failed: ${navigation.errorText}`);

    async function evaluate(context, fn, ...args) {
      const expression = `(${fn})(${args.map(value => JSON.stringify(value)).join(',')})`;
      const answer = await sendTo(context.session, 'Runtime.evaluate', {
        expression, uniqueContextId: context.uniqueId, awaitPromise: true, returnByValue: true,
      });
      if (answer.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? 'Studio could not measure the page');
      return answer.result.value;
    }
    async function ready() {
      const deadline = performance.now() + 12_000;
      while (performance.now() < deadline) {
        signal?.throwIfAborted();
        if (failed) throw failed;
        for (const [session, contexts] of sessions) {
          const result = await sendTo(session, 'Page.getFrameTree').catch(() => null);
          if (!result) continue;
          const { frameTree } = result;
          const frames = session === sessionId ? frameTree.childFrames ?? [] : [frameTree];
          const frame = frames.find(item => item.frame.url === PAGE + STUDIO_STAGE)?.frame;
          const uniqueId = frame && contexts.get(frame.id);
          if (uniqueId) {
            const context = { session, uniqueId };
            if (await evaluate(context, sharedFrameReady, fragments, width, height, appearance)) return context;
          }
        }
        await delay(50, undefined, { signal });
      }
      throw new Error(`Studio did not settle at ${width}×${height}.`);
    }
    const scope = await ready();
    const measured = await evaluate(scope, measurePage, ids, width, null, true);
    async function settlePaint() {
      const expression = 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))';
      const options = { expression, awaitPromise: true, returnByValue: true };
      // A child layout frame can settle before its pixels reach the parent compositor.
      const child = await sendTo(scope.session, 'Runtime.evaluate', { ...options, uniqueContextId: scope.uniqueId });
      const parent = await send('Runtime.evaluate', options);
      if (!child.result?.value || !parent.result?.value) throw new Error('Chrome could not settle the Studio frame.');
    }
    async function capture(probe) {
      return captureStableShared(async () => {
        // Capture the current compositor surface without asking Chrome to emulate a clip.
        const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        const image = Buffer.from(result.data, 'base64');
        if (image.length < 24 || image.readUInt32BE(16) !== width || image.readUInt32BE(20) !== height) {
          throw new Error('Unexpected Studio viewport screenshot size.');
        }
        if (probe) {
          const surface = decodePng(image);
          const pixel = probe.row * width * 3;
          if (!surface.rgb.subarray(pixel, pixel + 3).equals(probe.rgb) ||
              !surface.rgb.subarray(pixel + 3, pixel + 6).equals(probe.rgb)) return null;
          probe.surface = surface;
        }
        return image;
      }, settlePaint, signal);
    }
    let probeOrdinal = 0;
    async function captureRegion(clip) {
      const row = clip.y + clip.height < height ? height - 1 : 0;
      const color = ((0x4c2011 + 0x29f23 * ++probeOrdinal) & 0xffffff).toString(16).padStart(6, '0');
      const probe = { row, rgb: Buffer.from(color, 'hex') };
      await evaluate(scope, markSharedPaint, row, color);
      await capture(probe);
      const { surface } = probe;
      const rgb = Buffer.allocUnsafe(clip.width * clip.height * 3);
      const stride = clip.width * 3;
      for (let row = 0; row < clip.height; row++) {
        const pixel = ((clip.y + row) * width + clip.x) * 3;
        surface.rgb.copy(rgb, row * stride, pixel, pixel + stride);
      }
      return { width: clip.width, height: clip.height, rgb };
    }
    const png = takeEvidence(await capture());
    for (const [id, section] of Object.entries(measured.sections)) {
      if (!section || section.hidden) continue;
      let offset = 0;
      let combined;
      // The preview runs in a scrollable opaque iframe. Capture its actual viewport
      // in consecutive strips so changes below the fold appear in the section evidence.
      while (true) {
        const strip = await evaluate(scope, showSharedSection, id, width, height, offset);
        if (!strip) break;
        const { clip, totalHeight } = strip;
        if (clip.width * totalHeight > 16_000_000 || totalHeight > 32_768) {
          throw new Error(`The section ${id} exceeds the supported review image size.`);
        }
        const pixels = await captureRegion(clip);
        if (!offset && clip.height === totalHeight) {
          section.png = takeEvidence(encodePng(pixels));
        } else {
          combined ??= { width: clip.width, height: totalHeight, rgb: Buffer.alloc(clip.width * totalHeight * 3) };
          if (combined.width !== clip.width || combined.height !== totalHeight || offset + clip.height > totalHeight) {
            throw new Error(`The section ${id} changed size during capture.`);
          }
          pixels.rgb.copy(combined.rgb, offset * combined.width * 3);
          if (offset + clip.height === totalHeight) section.png = takeEvidence(encodePng(combined));
        }
        offset += clip.height;
        if (offset === totalHeight) {
          section.visible = { width: clip.width, height: totalHeight };
          break;
        }
      }
    }
    if (failed) throw failed;
    return { sections: measured.sections, horizontalOverflow: measured.horizontalOverflow, consoleErrors, png,
      resources: [...resources.values()].sort((a, b) => a.path.localeCompare(b.path)) };
  } finally {
    for (const [name, handler] of listeners) chrome.events.off(name, handler);
    await chrome.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
}

function summarizeSharedTokens(samples, ids, appearance) {
  const evidence = {};
  const problems = [];
  const comparisons = [];
  for (const { width, height, before, after } of samples) {
    const report = compareWidth(before, after);
    const { horizontalOverflow, consoleErrors } = report;
    const byId = new Map(report.perSection.map(sample => [sample.id, sample]));
    const images = { before: before.png, after: after.png, sections: {} };
    const perSection = ids.map(id => {
      const left = before.sections[id];
      const right = after.sections[id];
      if (!(left?.png || left?.hidden) || !(right?.png || (left?.hidden && right?.hidden))) problems.push(`${width}px: ${id} is missing or not visible in one of the previews.`);
      if (right?.horizontalOverflow > 0) problems.push(`${width}px: ${id} has horizontal overflow.`);
      images.sections[id] = { before: left?.png ?? null, after: right?.png ?? null };
      const describe = section => section ? {
        box: section.box, hidden: Boolean(section.hidden), visible: section.visible ?? null, sha256: section.png ? digestBytes(section.png) : null,
      } : null;
      return { ...byId.get(id), id, before: describe(left), after: describe(right) };
    });
    if (horizontalOverflow.after > 0) problems.push(`${width}px: the proposed preview has horizontal overflow.`);
    if (consoleErrors.after.length) problems.push(`${width}px: the proposed preview has browser errors.`);
    evidence[width] = images;
    comparisons.push({ width, height, perSection, unexpected: [], horizontalOverflow, consoleErrors,
      viewport: { before: digestBytes(before.png), after: digestBytes(after.png) },
      resources: { before: before.resources, after: after.resources } });
  }
  const { perWidth, perSection } = summarizeWidths(comparisons);
  const report = {
    appearance, widths: samples.map(({ width }) => width),
    perWidth: perWidth.map(({ unexpected, ...sample }) => sample),
    perSection: perSection.map(({ owned, ...section }) => ({ ...section, changed: section.widths.some(sample => sample.changed) })),
    problems,
  };
  return { ok: problems.length === 0, digest: digestBytes(JSON.stringify(report)), ...report, evidence };
}

function sharedFragments(project, ids) {
  return ids.map(id => {
    const file = path.join(project, 'sections', id + '.html');
    const hasMarkup = fs.lstatSync(file, { throwIfNoEntry: false })?.isFile() &&
      fs.readFileSync(file, 'utf8').trim().length > 0;
    return { id, hasMarkup: Boolean(hasMarkup) };
  });
}

async function sharedTokensImpact(before, after, { appearance: input, expectedSections, signal } = {}) {
  signal?.throwIfAborted();
  if (!Array.isArray(expectedSections) || !expectedSections.length ||
      expectedSections.some(id => typeof id !== 'string' || !SECTION_ID.test(id)) ||
      new Set(expectedSections.map(id => id.slice(0, 2))).size !== expectedSections.length) {
    throw new TypeError('Shared tokens require distinct expected Studio section IDs.');
  }
  const { theme = 'light', brand = 'none', lang = 'en', colorScheme = theme === 'dark' ? 'dark' : 'light' } = input ?? {};
  if (!['light', 'dark', 'auto'].includes(theme) || !['light', 'dark'].includes(colorScheme) ||
      !['none', 'forest-gold', 'gjh-classic', 'cny-red-gold'].includes(brand) || !['en', 'zh-Hans', 'ms'].includes(lang)) {
    throw new TypeError('Shared tokens require valid Studio appearance preferences.');
  }
  const ids = [...expectedSections].sort();
  const appearance = { theme, brand, lang };
  const original = fs.realpathSync(before);
  const candidate = fs.realpathSync(after);
  const left = sharedFragments(original, ids);
  const right = sharedFragments(candidate, ids);
  const binary = findChrome();
  if (!binary) throw new Error('Chrome not found; set CHROME_BIN');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-shared-tokens-'));
  let chrome, evidenceBytes = 0;
  const abort = () => chrome.close().catch(() => {});
  const takeEvidence = png => {
    evidenceBytes += png.length;
    if (evidenceBytes > EVIDENCE_LIMIT) throw new Error('Studio screenshot evidence exceeds the shared tokens review limit.');
    return png;
  };
  try {
    chrome = startChrome(binary, path.join(temp, 'profile'), 1440);
    signal?.addEventListener('abort', abort, { once: true });
    const samples = [];
    for (const viewport of STUDIO_VIEWPORTS) {
      signal?.throwIfAborted();
      const originalView = await renderShared(chrome, original, left, viewport, appearance, colorScheme, takeEvidence, signal);
      const candidateView = await renderShared(chrome, candidate, right, viewport, appearance, colorScheme, takeEvidence, signal);
      samples.push({ ...viewport, before: originalView, after: candidateView });
    }
    signal?.throwIfAborted();
    return summarizeSharedTokens(samples, ids, { ...appearance, colorScheme });
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    if (chrome) await chrome.close();
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 2 });
  }
}

async function main(args) {
  const { values } = parseArgs({ args, options: {
    before: { type: 'string' }, after: { type: 'string' }, owner: { type: 'string' },
    widths: { type: 'string' }, json: { type: 'string' },
  } });
  if (!values.before || !values.after) {
    throw new Error('Usage: node swarm/tools/impact-check.js --before dir --after dir [--owner 01-header] [--widths 393,768,1440] [--json out.json]');
  }
  const widths = values.widths?.split(',').map(value => /^\d+$/.test(value.trim()) ? Number(value) : NaN);
  const result = await impact(values.before, values.after, { owner: values.owner, widths });
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (values.json) fs.writeFileSync(values.json, json);
  else process.stdout.write(json);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => {
    console.error(error.message);
    process.exitCode = 2;
  });
}

module.exports = { impact, compareWidth, summarizeWidths, startChrome, sharedTokensImpact, summarizeSharedTokens, captureStableShared };
