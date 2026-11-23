'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const { AnchorRequestError, createAnchorManager, MAX_IMAGE } = require('./anchor-manager');
const { ProjectBusyError, withProjectLock } = require('./project-init');
const { approvedAnchor } = require('./publication');
const { mapAnchorRepairScope } = require('./anchor-repair-scope');

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

function createAnchorRoutes({ projectDir, projectId, busy, changed, generateAnchor, reviewAnchor, captureAnchorQA,
  previewUrl, repairOwners, runRepair, cleanAppearance = () => ({}) }) {
  const qaPath = path.join(projectDir, '.run', 'anchor-qa.json');
  let active;
  let repairTask;
  let grant = null;
  const taskBusy = () => Boolean(active || repairTask);

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
    const qa = readQA(flow);
    if (qa) {
      delete qa.repairRevisions;
      if (!repairTask && ['queued', 'running'].includes(qa.repair?.status)) {
        qa.repair = { ...qa.repair, status: 'cancelled', message: 'The repair was interrupted.' };
      }
    }
    return { projectId, busy: busy() || taskBusy(), flow, anchors: manager.list().reverse(), canEdit: true, qa };
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

  function beforeQA(anchorId) {
    return locked(manager => {
      const flow = manager.flow.state();
      if (!['locked', 'implementing', 'qa', 'final_review', 'done'].includes(flow.state)) {
        throw new AnchorRequestError(409, 'Lock an anchor before checking the preview.');
      }
      manager.current(anchorId);
      const anchor = approvedAnchor(projectDir);
      return { anchor, flow, revision: revision(projectDir) };
    });
  }

  function isCurrent(before, flow, anchor) {
    return anchor?.id === before.anchor.id && anchor.contractHash === before.anchor.contractHash &&
      flow.state === before.flow.state && flow.qaRevisions === before.flow.qaRevisions &&
      revision(projectDir) === before.revision;
  }

  function improved(breakpoints, prior) {
    const scores = breakpoints.filter(view => view.status === 'pass' || view.status === 'fail');
    const deltas = scores.map(view => view.score - prior.find(old => old.name === view.name)?.score);
    return deltas.length > 0 && deltas.every(delta => delta >= 0) && deltas.some(delta => delta > 0);
  }

  async function checkQA(before, appearance, signal, previousRepair) {
    const captureSignal = AbortSignal.any([signal, AbortSignal.timeout(TASK_LIFETIME)]);
    const result = await captureAnchorQA({ projectDir, anchor: before.anchor, signal: captureSignal,
      previewUrl: (width, height) => previewUrl(width, height, appearance) });
    captureSignal.throwIfAborted();
    const failures = result.breakpoints.filter(item => item.status === 'error');
    if (failures.length) {
      const details = failures.map(({ name, message }) => `${name}: ${message || 'Capture failed.'}`);
      throw new AnchorRequestError(502, details.join(' '));
    }
    return locked(manager => {
      const now = manager.flow.state();
      const anchor = approvedAnchor(projectDir);
      if (!isCurrent(before, now, anchor)) {
        throw new AnchorRequestError(409, 'The design changed during QA. Run QA again.');
      }
      const { ok, completeCoverage, breakpoints } = result;
      const history = readQA(now)?.repairRevisions;
      const repairRevisions = Array.isArray(history) ? history : [];
      const repeated = !ok && repairRevisions.includes(before.revision);
      const system = { actor: 'system', anchorId: anchor.id, audit: { anchorId: anchor.id, contractSha256: anchor.contractHash } };
      if (now.state === 'locked') manager.transition('start_implementation', system);
      if (manager.flow.state().state === 'implementing' && !repeated) manager.transition('finish', system);
      if (now.state === 'final_review' || now.state === 'done') manager.transition('check_again', system);
      const mayRevise = !ok && !repeated && manager.flow.preview('qa_fail', system).ok;
      if (ok || mayRevise) manager.transition(ok ? 'qa_pass' : 'qa_fail', system);

      let plan, repair;
      if (ok && previousRepair) {
        repair = { ...previousRepair.repair, message: 'The scoped repair published and visual QA passed.' };
      } else if (!ok && runRepair) {
        let message;
        if (repeated) message = 'A repair already ran for this design revision.';
        else if (!mayRevise) message = 'The automatic repair revision limit was reached.';
        else if (previousRepair && !improved(breakpoints, previousRepair.breakpoints)) {
          message = 'Visual QA did not improve across the checked viewports. Review the changes before retrying.';
        } else {
          plan = mapAnchorRepairScope({ breakpoints, owners: repairOwners() });
          if (!plan) message = 'The failed views did not isolate one owned section.';
        }
        if (plan) {
          repair = { status: 'queued', sectionId: plan.sectionId, ownerId: plan.ownerId };
          repairRevisions.push(before.revision);
        } else {
          repair = { status: 'skipped', message };
        }
      }
      const record = { anchorId: anchor.id, contractHash: anchor.contractHash, revision: before.revision,
        checkedAt: new Date().toISOString(), ok, completeCoverage, breakpoints, repair, repairRevisions };
      writeQA(record);
      return { record, plan, before: { ...before, flow: manager.flow.state() } };
    });
  }

  function updateRepair(record, status, message) {
    record.repair = { ...record.repair, status, message };
    writeQA(record);
    notify();
  }

  async function repairLoop(first, appearance, signal) {
    let job = first;
    while (job.plan) {
      const { before, record, plan } = job;
      const isValid = () => !signal.aborted && isCurrent(before, createAnchorManager(projectDir).flow.state(), approvedAnchor(projectDir));
      try {
        if (!locked(() => isValid() && repairOwners()[plan.sectionId] === plan.ownerId)) {
          if (signal.aborted) updateRepair(record, 'cancelled', CANCELLED);
          else updateRepair(record, 'skipped', 'The design or assigned owner changed before repair.');
          return;
        }
        updateRepair(record, 'running');
        const outcome = await runRepair({ ...plan, anchor: before.anchor, appearance, signal, isValid });
        if (outcome !== 'published') {
          if (signal.aborted) updateRepair(record, 'cancelled', CANCELLED);
          else if (outcome === 'no-change') updateRepair(record, 'no-change', 'The worker published no preview changes.');
          else updateRepair(record, 'failed', 'The worker could not publish the scoped repair.');
          return;
        }
        updateRepair(record, 'published', 'The scoped repair published. Checking the updated preview.');
        signal.throwIfAborted();
        job = await checkQA(beforeQA(record.anchorId), appearance, signal, record);
        notify();
      } catch (error) {
        if (!signal.aborted) console.warn('Anchor repair could not finish:', error.message);
        if (record.repair.status === 'published') {
          updateRepair(record, 'published', 'The scoped repair published. Run visual QA again to verify the updated preview.');
        } else {
          updateRepair(record, signal.aborted ? 'cancelled' : 'failed',
            signal.aborted ? CANCELLED : 'The scoped repair stopped before publication.');
        }
        return;
      }
    }
  }

  async function qa(input) {
    const before = beforeQA(input.anchorId);
    const appearance = cleanAppearance(input.appearance);
    await run(async signal => {
      const first = await checkQA(before, appearance, signal);
      if (!first.plan) return;
      const controller = new AbortController();
      repairTask = controller;
      setImmediate(() => {
        repairLoop(first, appearance, controller.signal).catch(error => {
          console.warn('Could not update the anchor repair record:', error.message);
        }).finally(() => {
          repairTask = undefined;
          notify();
        });
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
      if (taskBusy() || busy()) throw new AnchorRequestError(409, BUSY);
      const input = await readObject(req, action === 'import' ? IMAGE_LIMIT : FORM_LIMIT);
      if (input.projectId !== projectId) throw new AnchorRequestError(409, 'The project changed. Refresh Review.');
      if (taskBusy() || busy()) throw new AnchorRequestError(409, BUSY);
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

  return { handle, busy: taskBusy, cancel() {
    const error = new AnchorRequestError(409, CANCELLED);
    active?.abort(error);
    repairTask?.abort(error);
  } };
}

module.exports = { createAnchorRoutes, matches: pathname => pathname.startsWith(BASE) };
