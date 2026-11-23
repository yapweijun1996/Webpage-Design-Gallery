'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { ProjectBusyError, withProjectLock } = require('./project-init');
const { approvedAnchor } = require('./publication');
const { route } = require('./router');
const { loadAll } = require('./recipes');
const metrics = require('./metrics');

const MAX_TEXT = 4096;
const MAX_BODY = 24 * 1024;
const DEADLINE_MS = 8000;
const BUSY = 'Wait for the current work to finish before composing a Fast Path preview.';
const DESIGN_CHANGED = 'The project design changed while the preview was being built. Submit again to use the current design.';

class FastPathError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readRequest(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw new FastPathError(415, 'Expected application/json.');
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    const data = Buffer.from(chunk);
    bytes += data.length;
    if (bytes <= MAX_BODY) chunks.push(data);
  }
  if (bytes > MAX_BODY) throw new FastPathError(413, 'The Fast Path request is too large.');
  try {
    const input = JSON.parse(Buffer.concat(chunks));
    if (input && typeof input === 'object' && !Array.isArray(input)) return input;
  } catch { /* Invalid JSON has the same response as a non-object body. */ }
  throw new FastPathError(400, 'Expected a JSON object.');
}

function statKey(file) {
  const stat = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
  return stat ? [stat.dev, stat.ino, stat.size, stat.ctimeNs].join(':') : '';
}

function treeRevision(directory) {
  const entry = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (entry && (!entry.isDirectory() || fs.realpathSync.native(directory) !== directory)) {
    throw new FastPathError(409, 'A preview source directory is unavailable.');
  }
  return entry ? fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map(child => {
    const file = path.join(directory, child.name);
    return [child.name, statKey(file), child.isDirectory() ? treeRevision(file) : null];
  }) : [];
}

function designRevision(projectDir) {
  const sections = path.join(projectDir, 'sections');
  const assets = path.join(projectDir, 'assets', 'generated');
  return JSON.stringify([statKey(sections), statKey(path.join(projectDir, 'contract.json')),
    statKey(path.join(projectDir, 'tokens.css')), treeRevision(sections), treeRevision(assets)]);
}

function lockPolicy(projectDir) {
  try { return approvedAnchor(projectDir); }
  catch (error) { throw new FastPathError(409, error.message); }
}

function makeStage(projectDir) {
  const runtime = path.join(projectDir, '.run');
  fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(runtime).isDirectory() || fs.realpathSync(runtime) !== runtime) {
    throw new FastPathError(409, 'The project runtime directory is unavailable.');
  }
  return fs.mkdtempSync(path.join(runtime, '.fast-'));
}

function createFastPath({ projectDir, projectId, busy, stageFast, install, fallback, published,
  deadlineMs = DEADLINE_MS }) {
  const project = path.resolve(projectDir);
  let active;
  const cancel = (message = 'The Fast Path preview was stopped.') => {
    if (!active) return false;
    active.abort(new FastPathError(409, message));
    return true;
  };

  async function run(input) {
    if (input.projectId !== projectId) throw new FastPathError(409, 'The project changed. Reload Studio and submit again.');
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text || text.length > MAX_TEXT) throw new FastPathError(400, `Enter a request of 1 to ${MAX_TEXT} characters.`);
    const started = performance.now();
    const catalog = loadAll();
    const selection = route(text, catalog);
    const routeMs = performance.now() - started;
    if (!selection) return { accepted: false, fallback: true, ...fallback({ ...input, text }) };
    if (busy()) throw new FastPathError(409, BUSY);
    cancel('A newer request replaced this Fast Path preview.');

    const controller = new AbortController();
    active = controller;
    const signal = controller.signal;
    const timer = setTimeout(() => controller.abort(new FastPathError(504, 'Fast Path timed out before the preview could be published.')), deadlineMs);
    let stage, work;
    try {
      const { anchor, revision } = withProjectLock(project, exists => {
        if (!exists) throw new FastPathError(409, 'The project is unavailable.');
        return { anchor: lockPolicy(project), revision: designRevision(project) };
      });
      stage = makeStage(project);
      const aborted = new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      work = Promise.resolve().then(() => stageFast({ projectDir: project, stage, selection, anchor, signal }));
      const candidate = await Promise.race([work, aborted]);
      signal.throwIfAborted();
      if (performance.now() - started >= deadlineMs) {
        throw new FastPathError(504, 'Fast Path timed out before the preview could be published.');
      }
      const snapshotId = withProjectLock(project, exists => {
        if (!exists || busy() || designRevision(project) !== revision) throw new FastPathError(409, DESIGN_CHANGED);
        const current = lockPolicy(project);
        if (current?.id !== anchor?.id || current?.contractHash !== anchor?.contractHash) {
          throw new FastPathError(409, 'The approved design anchor changed.');
        }
        return install(project, stage, { backupLabel: 'Before Fast Path' });
      });
      const runId = randomUUID();
      const timings = { ...candidate.timings, route: routeMs, total: performance.now() - started };
      try { metrics.record(runId, timings, project); }
      catch { console.warn('The Fast Path preview was published, but its metrics were unavailable.'); }
      active = undefined;
      const result = { accepted: true, runId, snapshotId, recipe: selection.recipe, brand: selection.brand, timings };
      try { Object.assign(result, published({ ...input, text, candidate, result })); }
      catch { console.warn('The Fast Path preview was published, but the Studio notification did not finish.'); }
      return result;
    } finally {
      clearTimeout(timer);
      if (active === controller) active = undefined;
      if (stage) {
        const clean = () => {
          try { fs.rmSync(stage, { recursive: true, force: true }); }
          catch { console.warn('The Fast Path staging directory could not be removed.'); }
        };
        if (work) void work.then(clean, clean);
        else clean();
      }
    }
  }

  async function respond(res, send, operation) {
    try { return send(res, 200, await operation()); }
    catch (error) {
      if (error instanceof ProjectBusyError) return send(res, 409, { error: error.message });
      if (error instanceof FastPathError || error.status === 409) return send(res, error.status, { error: error.message });
      console.warn('Fast Path could not publish:', error.message);
      return send(res, 500, { error: 'The Fast Path preview could not be published.' });
    }
  }

  function handle(req, res, pathname, send) {
    if (pathname === '/api/metrics' && req.method === 'GET') {
      return respond(res, send, () => metrics.summarize(path.join(project, '.run', 'metrics.jsonl')));
    }
    if (pathname !== '/api/fast' || req.method !== 'POST') return send(res, 405, { error: 'Unsupported Fast Path request.' });
    return respond(res, send, async () => {
      const { projectId: target, text, appearance, scope } = await readRequest(req);
      return run({ projectId: target, text, appearance, scope, from: 'owner' });
    });
  }

  return { handle, run, respond, cancel, busy: () => Boolean(active && !active.signal.aborted) };
}

module.exports = { createFastPath, FastPathError };
