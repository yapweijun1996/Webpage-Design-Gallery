#!/usr/bin/env node
'use strict';

const { execFileSync, spawn } = require('node:child_process');
const { EventEmitter, once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseArgs } = require('node:util');
const { span, record, summarize } = require('../lib/metrics');
const { findChrome } = require('./shot');

const SWARM = path.resolve(__dirname, '..');
const TEMPLATE = path.join(SWARM, 'template');
const EXPORTER = path.join(__dirname, 'export-page.js');
const FAST_MODULES = ['recipes', 'router', 'composer'].map(name => path.join(SWARM, 'lib', `${name}.js`));
const REQUEST = 'Build a GJH corporate landing page with brand cards, about and enquiry sections';
const PAINT_BINDING = 'swarmBenchmarkFirstPaint';
const PAINT_SCRIPT = `
  if (window.top === window && location.protocol === 'file:') {
    new PerformanceObserver((list, observer) => {
      const paint = list.getEntriesByName('first-paint')[0];
      if (paint) {
        observer.disconnect();
        ${PAINT_BINDING}(String(paint.startTime));
      }
    }).observe({ type: 'paint', buffered: true });
  }
`;

function copyProject(project, standIn) {
  fs.cpSync(TEMPLATE, project, { recursive: true, dereference: true });
  const tokens = path.join(project, 'tokens.css');
  if (!fs.existsSync(tokens)) fs.copyFileSync(path.join(SWARM, '../design-canvas/tokens.css'), tokens);
  if (!standIn) return;

  const sections = path.join(project, 'sections');
  fs.mkdirSync(sections, { recursive: true });
  if (fs.readdirSync(sections, { withFileTypes: true }).some(entry => entry.isFile() && /^\d{2}-.+\.html$/.test(entry.name))) return;
  // The project template currently ships metadata only. Give the exporter a minimal renderable section.
  fs.writeFileSync(path.join(sections, '01-hero.html'), '<section class="s-01"><h1>Fast path benchmark</h1></section>\n');
  fs.writeFileSync(path.join(sections, '01-hero.css'), '.s-01 { padding: 2rem; }\n');
}

function loadFastPath() {
  if (!FAST_MODULES.every(file => fs.existsSync(file))) return null;
  try {
    const [{ loadAll }, { route }, { compose }] = FAST_MODULES.map(file => require(file));
    loadAll();
    return { loadAll, route, compose };
  } catch (error) {
    // Catalog files can arrive after their modules during parallel development.
    if (error.code === 'ENOENT' || error.cause?.code === 'ENOENT') return null;
    throw error;
  }
}

async function startChrome(profile) {
  const binary = findChrome();
  if (!binary) throw new Error('Chrome not found; set CHROME_BIN to use --render');
  const child = spawn(binary, [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-gpu', '--window-size=1280,800', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const stopped = new AbortController();
  const closed = new Promise(resolve => child.once('close', resolve));
  const events = new EventEmitter();
  const input = child.stdio[3];
  const output = child.stdio[4];
  let diagnostics = '';
  child.stderr.setEncoding('utf8').on('data', data => { diagnostics = (diagnostics + data).slice(-4096); });
  child.on('error', error => stopped.abort(error));
  child.on('close', (code, signal) => stopped.abort(new Error(`Chrome exited (${signal ?? code})${diagnostics.trim() ? `: ${diagnostics.trim()}` : ''}`)));
  input.on('error', error => stopped.abort(error));
  output.on('error', error => stopped.abort(error));

  // The DevTools pipe carries nul-delimited JSON and needs no listening port.
  let buffer = '';
  output.setEncoding('utf8').on('data', data => {
    buffer += data;
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      events.emit(String(message.id ?? `${message.sessionId}:${message.method}`), message);
    }
  });

  async function wait(event, label) {
    try {
      const [message] = await once(events, String(event), {
        signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(15_000)]),
      });
      return message;
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
      throw stopped.signal.reason ?? new Error(`Timed out waiting for Chrome ${label}`);
    }
  }

  let id = 0;
  async function send(method, params = {}, sessionId) {
    const response = wait(++id, method);
    input.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    const { result, error } = await response;
    if (error) throw new Error(`${method}: ${error.message}`);
    return result;
  }

  async function close() {
    child.kill();
    await closed;
  }

  try {
    const { targetInfos } = await send('Target.getTargets');
    const { targetId } = targetInfos.find(target => target.type === 'page') ?? await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Runtime.addBinding', { name: PAINT_BINDING }, sessionId);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PAINT_SCRIPT }, sessionId);
    return {
      close,
      async clearCache() {
        await send('Network.clearBrowserCache', {}, sessionId);
        await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
      },
      async firstPaint(file) {
        const paint = wait(`${sessionId}:Runtime.bindingCalled`, 'first paint');
        const navigation = send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
        const [, { params }] = await Promise.all([navigation.then(({ errorText }) => {
          if (errorText) throw new Error(`Chrome navigation failed: ${errorText}`);
        }), paint]);
        const render = Number(params.payload);
        if (params.name !== PAINT_BINDING || !Number.isFinite(render) || render < 0) throw new Error('Invalid Chrome first paint');
        return render;
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    runs: { type: 'string', default: '30' }, cold: { type: 'boolean' }, render: { type: 'boolean' },
  } });
  const runs = Number(values.runs);
  if (!/^\d+$/.test(values.runs) || !Number.isSafeInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');
  const cold = Boolean(values.cold);
  const fastPath = loadFastPath();
  const standIn = !fastPath;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-fastpath-'));
  const log = path.join(root, '.run', 'metrics.jsonl');
  let chrome;
  try {
    if (values.render) chrome = await startChrome(path.join(root, 'chrome-profile'));
    let previousHits = 0;
    for (let i = 0; i < runs; i++) {
      if (cold && chrome) await chrome.clearCache();
      const total = span('total');
      const project = path.join(root, `project-${i + 1}`);
      copyProject(project, standIn);
      const measurements = { route: null, compose: null, build: null, render: null, modelTime: null, cacheHits: null };

      if (fastPath) {
        const { loadAll, route, compose } = fastPath;
        const all = loadAll({ cold });
        const routing = span('route');
        const result = route(REQUEST, { recipes: all.recipes, brands: all.brands });
        measurements.route = routing.end();
        if (!result) throw new Error(`Benchmark request did not match a recipe: ${REQUEST}`);
        const composing = span('compose');
        compose({ recipe: result.recipe, brand: result.brand, overrides: {}, outDir: project });
        measurements.compose = composing.end();
        if (Number.isSafeInteger(all.hits)) {
          measurements.cacheHits = all.hits - (cold ? 0 : previousHits);
          previousHits = all.hits;
        }
      }

      const build = span('build');
      execFileSync(process.execPath, [EXPORTER, project], { timeout: 30_000 });
      measurements.build = build.end();
      if (chrome) measurements.render = await chrome.firstPaint(path.join(project, 'dist', 'index.html'));
      measurements.total = total.end();
      record(i + 1, measurements, root);
    }

    const summary = summarize(log);
    const mode = standIn ? 'stand-in' : 'composer';
    const notMeasured = ['Swarm server, snapshot/versioning, live preview refresh and interactivity', 'LLM and asynchronous quality work', 'OS filesystem cache state'];
    if (standIn) notMeasured.push('Router, recipe cache and composer');
    if (!chrome) notMeasured.push('Chrome rendering and first paint (use --render)');
    if (chrome) notMeasured.push('Chrome startup and HTTP delivery (file URL)');
    const report = {
      mode, cold, render: Boolean(chrome), request: standIn ? null : REQUEST, unit: 'ms',
      ...summary, notMeasured, samples: fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)),
    };
    const file = path.join(SWARM, 'bench', 'last.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const pending = path.join(path.dirname(file), `.${path.basename(root)}.json`);
    try {
      fs.writeFileSync(pending, `${JSON.stringify(report, null, 2)}\n`);
      fs.renameSync(pending, file);
    } finally {
      fs.rmSync(pending, { force: true });
    }

    console.log(`Fast path benchmark: ${mode}, ${cold ? 'cold' : 'warm'}, ${runs} runs (ms)`);
    for (const stage of ['route', 'compose', 'build', 'render', 'modelTime', 'total']) {
      const stats = stage === 'total' ? summary : summary.byStage[stage];
      console.log(stats ? `${stage}: p50 ${stats.p50.toFixed(2)}, p95 ${stats.p95.toFixed(2)}` : `${stage}: not measured`);
    }
    console.log(`Not measured: ${notMeasured.join('; ')}`);
    console.log(`Report: ${file}`);
  } finally {
    if (chrome) await chrome.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
