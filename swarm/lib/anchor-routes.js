'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { AnchorRequestError, createAnchorManager, MAX_IMAGE } = require('./anchor-manager');
const { ProjectBusyError, withProjectLock } = require('./project-init');
const { approvedAnchor } = require('./publication');

const BASE = '/api/anchor/';
const IMAGE = /^image\/(v(?:00[1-9]|0[1-9]\d|[1-9]\d{2,}))\/(desktop|tablet|mobile)$/;
const FORM_LIMIT = 512 * 1024;
const IMAGE_LIMIT = 12 * Math.ceil(MAX_IMAGE / 3) + 4096;
const GRANT_LIFETIME = 30 * 60 * 1000;
const TASK_LIFETIME = 5 * 60 * 1000;
const BUSY = 'Wait until the current Swarm work finishes.';
const CANCELLED = 'The anchor task was cancelled.';

async function readObject(req, limit) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw new AnchorRequestError(415, 'Expected application/json.');
  }
  const chunks = [];
  let length = 0;
  try {
    for await (const chunk of req) {
      const data = Buffer.from(chunk);
      length += data.length;
      if (length <= limit) chunks.push(data);
    }
  } catch { throw new AnchorRequestError(400, 'The request did not finish.'); }
  if (length > limit) throw new AnchorRequestError(413, 'The anchor request is too large.');
  try {
    const input = JSON.parse(Buffer.concat(chunks));
    if (input && typeof input === 'object' && !Array.isArray(input)) return input;
  } catch { /* Invalid JSON uses the same response as a non-object body. */ }
  throw new AnchorRequestError(400, 'Expected a JSON object.');
}

function revision(projectDir) {
  const digest = createHash('sha256');
  function add(relative) {
    const file = path.join(projectDir, relative);
    const entry = fs.lstatSync(file, { bigint: true, throwIfNoEntry: false });
    const stamp = entry ? [entry.dev, entry.ino, entry.size, entry.ctimeNs].map(String) : [];
    digest.update(JSON.stringify([relative, ...stamp]));
    if (entry?.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) add(path.join(relative, name));
    }
  }
  for (const relative of ['sections', 'contract.json', 'tokens.css', 'assets', 'i18n', 'design-system']) add(relative);
  return digest.digest('hex');
}

function createAnchorRoutes({ projectDir, projectId, busy, changed, generateAnchor, reviewAnchor, captureAnchorQA, previewUrl }) {
  const qaPath = path.join(projectDir, '.run', 'anchor-qa.json');
  let active;
  let grant = null;

  function locked(action) {
    return withProjectLock(projectDir, exists => {
      if (!exists) throw new AnchorRequestError(409, 'The project is unavailable.');
      if (busy()) throw new AnchorRequestError(409, BUSY);
      return action(createAnchorManager(projectDir));
    });
  }

  const browserRequest = req => req.headers['sec-fetch-site'] === 'same-origin' && req.headers['sec-fetch-dest'] === 'empty';
  function getGrant(req) {
    if (!browserRequest(req)) throw new AnchorRequestError(403, 'Open Review in the local Studio to manage anchors.');
    if (!grant || grant.expires <= Date.now()) grant = { token: randomBytes(32).toString('hex'), expires: Date.now() + GRANT_LIFETIME };
    return { token: grant.token };
  }

  function requireGrant(req) {
    const provided = req.headers['x-swarm-anchor-token'];
    if (!grant || grant.expires <= Date.now() || !browserRequest(req) || typeof provided !== 'string' || !/^[a-f0-9]{64}$/.test(provided)
        || !timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(grant.token, 'hex'))) {
      throw new AnchorRequestError(403, 'Open Review again to renew the anchor session.');
    }
  }

  function readQA(flow) {
    const runtime = path.dirname(qaPath);
    if (!fs.lstatSync(runtime, { throwIfNoEntry: false })?.isDirectory()) return null;
    if (!fs.lstatSync(qaPath, { throwIfNoEntry: false })?.isFile()) return null;
    try {
      const result = JSON.parse(fs.readFileSync(qaPath, { flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW }));
      if (result.anchorId !== flow.anchorId) return null;
      return { ...result, stale: result.revision !== revision(projectDir) };
    } catch { return null; }
  }

  function writeQA(result) {
    const directory = path.dirname(qaPath);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(directory).isDirectory()) throw new Error('Invalid anchor QA directory.');
    const draft = path.join(directory, `.anchor-qa-${randomUUID()}`);
    try {
      const fd = fs.openSync(draft, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(result) + '\n'); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      fs.renameSync(draft, qaPath);
    } finally { fs.rmSync(draft, { force: true }); }
  }

  function status(manager = createAnchorManager(projectDir)) {
    const flow = manager.flow.state();
    return { projectId, busy: busy() || Boolean(active), flow, anchors: manager.list().reverse(), canEdit: true, qa: readQA(flow) };
  }

  function notify() {
    try { changed?.(); }
    catch { console.warn('Anchor state changed, but its notification could not be sent.'); }
  }

  async function run(action) {
    const controller = new AbortController();
    active = controller;
    notify();
    const timeout = setTimeout(() => controller.abort(new AnchorRequestError(504, 'The anchor task timed out.')), TASK_LIFETIME);
    try { return await action(controller.signal); }
    finally {
      clearTimeout(timeout);
      if (active === controller) active = undefined;
      notify();
    }
  }

  async function advisor(input) {
    const observed = locked(manager => manager.reviewInput(input.anchorId));
    await run(async signal => {
      const result = observed.advisor ?? await reviewAnchor({ projectDir, anchor: observed, signal });
      signal.throwIfAborted();
      locked(manager => manager.review(input.anchorId, observed, result));
    });
  }

  async function generate() {
    const goals = locked(manager => manager.draftGoals());
    if (!Array.isArray(goals) || !goals.length) throw new AnchorRequestError(409, 'Enter design goals before generating a reference.');
    await run(async signal => {
      const candidate = await generateAnchor({ projectDir, goals, signal });
      signal.throwIfAborted();
      locked(manager => manager.generatedDraft(goals, candidate));
    });
  }

  async function qa(input) {
    const before = locked(manager => {
      const flow = manager.flow.state();
      if (!['locked', 'implementing', 'qa', 'final_review', 'done'].includes(flow.state)) {
        throw new AnchorRequestError(409, 'Lock an anchor before checking the preview.');
      }
      manager.current(input.anchorId);
      const anchor = approvedAnchor(projectDir);
      return { anchor, flow, revision: revision(projectDir) };
    });
    await run(async signal => {
      const result = await captureAnchorQA({ projectDir, anchor: before.anchor, signal,
        previewUrl: (width, height) => previewUrl(width, height, input.appearance) });
      signal.throwIfAborted();
      const failures = result.breakpoints.filter(item => item.status === 'error');
      if (failures.length) {
        const details = failures.map(({ name, message }) => `${name}: ${message || 'Capture failed.'}`);
        throw new AnchorRequestError(502, details.join(' '));
      }
      locked(manager => {
        const now = manager.flow.state();
        const anchor = approvedAnchor(projectDir);
        if (anchor?.id !== before.anchor.id || anchor?.contractHash !== before.anchor.contractHash
            || now.state !== before.flow.state || revision(projectDir) !== before.revision) {
          throw new AnchorRequestError(409, 'The design changed during QA. Run QA again.');
        }
        const system = { actor: 'system', anchorId: anchor.id, audit: { anchorId: anchor.id, contractSha256: anchor.contractHash } };
        const { ok, completeCoverage, breakpoints } = result;
        if (now.state === 'locked') manager.transition('start_implementation', system);
        if (manager.flow.state().state === 'implementing') manager.transition('finish', system);
        if (now.state === 'final_review' || now.state === 'done') manager.transition('check_again', system);
        if (ok || now.qaRevisions < 3) manager.transition(ok ? 'qa_pass' : 'qa_fail', system);
        writeQA({ anchorId: anchor.id, contractHash: anchor.contractHash, revision: before.revision,
          checkedAt: new Date().toISOString(), ok, completeCoverage, breakpoints });
      });
    });
  }

  const actions = {
    goals: (manager, input) => manager.goals(input),
    import: (manager, input) => manager.importAnchor(input),
    approve: (manager, input) => manager.approve(input),
    lock: (manager, input) => manager.lock(input),
    revise: (manager, input) => manager.revise(input, 'request_revision'),
    unlock: (manager, input) => manager.revise(input, 'unlock'),
    finish(manager, input) {
      const anchor = manager.current(input.anchorId);
      if (typeof input.sha256 !== 'string') throw new AnchorRequestError(400, 'A displayed desktop image digest is required.');
      manager.check(anchor, input.sha256);
      const result = readQA(manager.flow.state());
      if (!result?.ok || result.stale || result.contractHash !== anchor.contractSha256) {
        throw new AnchorRequestError(409, 'Run visual QA on the current preview before final approval.');
      }
      manager.transition('finish', { actor: 'manager', anchorId: anchor.id, audit: { principal: 'studio-operator', anchorId: anchor.id } });
    },
  };

  async function handle(req, res, pathname, send) {
    const action = pathname.slice(BASE.length);
    try {
      if (req.method === 'GET') {
        if (action === 'state') return send(res, 200, status());
        if (action === 'session') return send(res, 200, getGrant(req));
        const image = IMAGE.exec(action);
        if (image) return send(res, 200, createAnchorManager(projectDir).image(image[1], image[2]), 'image/png');
      }
      if (req.method !== 'POST') throw new AnchorRequestError(405, 'Unsupported anchor request.');
      if (!Object.hasOwn(actions, action) && !['generate', 'advisor', 'qa'].includes(action)) throw new AnchorRequestError(404, 'Unknown anchor action.');
      requireGrant(req);
      if (active || busy()) throw new AnchorRequestError(409, BUSY);
      const input = await readObject(req, action === 'import' ? IMAGE_LIMIT : FORM_LIMIT);
      if (input.projectId !== projectId) throw new AnchorRequestError(409, 'The project changed. Refresh Review.');
      if (active || busy()) throw new AnchorRequestError(409, BUSY);
      if (action === 'generate') await generate();
      else if (action === 'advisor') await advisor(input);
      else if (action === 'qa') await qa(input);
      else { locked(manager => actions[action](manager, input)); notify(); }
      return send(res, 200, status());
    } catch (error) {
      if (error instanceof ProjectBusyError) return send(res, 409, { error: error.message });
      if (error instanceof AnchorRequestError || [409, 502, 503, 504].includes(error?.status)) return send(res, error.status, { error: error.message });
      console.warn('Anchor operation failed:', error.message);
      return send(res, 500, { error: 'The anchor request could not be completed.' });
    }
  }

  return { handle, busy: () => Boolean(active), cancel: () => active?.abort(new AnchorRequestError(409, CANCELLED)) };
}

module.exports = { createAnchorRoutes, matches: pathname => pathname.startsWith(BASE) };
