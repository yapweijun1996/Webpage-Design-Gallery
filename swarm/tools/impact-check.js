#!/usr/bin/env node
'use strict';

const { execFileSync, spawn } = require('node:child_process');
const { EventEmitter, once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { parseArgs } = require('node:util');
const { findChrome } = require('./shot');
const { compare } = require('./visual-compare');

const DEFAULT_WIDTHS = [393, 768, 1440];
const HEIGHT = 844;
const TIMEOUT = 30_000;
const PAGE = 'http://swarm-impact.invalid';
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
async function measurePage(ids, width, flowOwner) {
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
    return [id, { box: { x, y, width, height }, horizontalOverflow: overflow(root, -Infinity, Infinity),
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

module.exports = { impact, compareWidth, summarizeWidths, startChrome };
