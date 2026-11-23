'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { checkProject } = require('../tools/check-sections');
const { parseSectionFile } = require('./layers');
const { classify, isSafePath } = require('./ownership');
const { ProjectBusyError, withProjectLock } = require('./project-init');

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_OUTBOX_BYTES = 64 * 1024;
const MAX_SKILL_BYTES = 32 * 1024;
const { Violation, unsafe, projectRoot, entry, directory, readFile, stageFile, walk, copyRoots } = require('./project-files');
const sharedTokens = require('./shared-tokens');
const WORKSPACES = '.run/ws';
const SNAPSHOTS = '.run/component-snapshots';
const SCOPE_RULES = new Set(['layer-scope', 'unscoped-selector', 'css-scope']);
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
const ANCHOR_ID = /^v(?:00[1-9]|0[1-9]\d|[1-9]\d{2,})$/;
const CATALOGS = ['i18n/en.json', 'i18n/zh-Hans.json', 'i18n/ms.json'];
const PREVIEW_ROOTS = ['sections', 'assets', 'tokens.css', 'brief.md', ...CATALOGS,
  ...['tokens.css', 'themes.css', 'components.css', 'runtime.js', 'i18n.js', ...CATALOGS]
    .map(file => `design-system/${file}`)];
const sessions = new WeakMap();
const active = new Map();

function launchManifest(manifest) {
  return Object.freeze({
    launchContext: true,
    shared: Object.freeze([...manifest.shared]),
    workers: Object.freeze([...manifest.workers]),
    sections: Object.freeze([...manifest.sections]),
    owned: Object.freeze({ ...manifest.owned }),
  });
}

function readRoots(manifest, workerId) {
  const shared = manifest.shared.map(glob => glob.replace(/\/\*$/, ''));
  const context = ['anchors', 'assets', 'sections'];
  if (!manifest.launchContext) {
    return [...context, `notes/${workerId}.md`, `chat/${workerId}.jsonl`, ...shared];
  }
  // Copy only the current roster's notes and discussion, and only this launch's inbox.
  const peers = manifest.workers.filter(id => id !== '00');
  const rosterRoots = peers.flatMap(id => [`notes/${id}.md`, `discussion/${id}.md`]);
  return [...context, ...CATALOGS, ...rosterRoots, `inbox/${workerId}.md`,
    ...shared.filter(root => !['notes', 'discussion', 'i18n', 'inbox'].includes(root))];
}

function copySkills(project, dir, skillDirs, recordBase) {
  const builtin = path.join(fs.realpathSync.native(path.join(__dirname, '..')), 'skills');
  const local = path.join(project, 'skills');
  const ids = new Set();
  return skillDirs.map(source => {
    if (typeof source !== 'string' || !path.isAbsolute(source)) throw new TypeError('Invalid selected skill directory.');
    const root = path.dirname(source);
    const id = path.basename(source);
    if ((root !== builtin && root !== local) || !/^[a-z0-9-]{2,40}$/.test(id) || !isSafePath(id) || ids.has(id)) {
      throw new TypeError('Invalid selected skill directory.');
    }
    const record = readFile(root, `${id}/SKILL.md`, { maxBytes: MAX_SKILL_BYTES });
    if (!record) throw new Error('Selected skill file is missing.');
    const stage = `.launch-skills/${id}`;
    const relative = `${stage}/SKILL.md`;
    stageFile(dir, relative, { ...record, mode: 0o400 });
    recordBase(relative, record);
    ids.add(id);
    return path.join(dir, stage);
  });
}

function open(projectDir, workerId, manifest, { skillDirs = [] } = {}) {
  if (!isSafePath(workerId) || !manifest.workers.includes(workerId)) throw new Error('Unknown worker ID.');
  if (!Array.isArray(skillDirs) || (!manifest.launchContext && skillDirs.length)) {
    throw new TypeError('Selected skills require a launch workspace and a directory list.');
  }
  const project = projectRoot(projectDir);
  const id = randomUUID();
  const relative = `${WORKSPACES}/${id}`;
  const launched = manifest.launchContext ? launchManifest(manifest) : null;
  const outbox = launched && workerId !== '00' ? `chat/${workerId}.jsonl` : null;
  const dir = directory(project, relative);
  const base = Object.create(null);
  const sizes = new Map();
  const recordBase = (name, { sha256, size }) => {
    base[name] = Object.freeze({ sha256 });
    sizes.set(name, size);
  };
  let stagedSkills;
  try {
    const modeFor = name => !launched || classify(launched, workerId, name) === 'owned' ? 0o600 : 0o400;
    copyRoots(project, dir, readRoots(launched ?? manifest, workerId), recordBase, modeFor);
    if (outbox) {
      const data = Buffer.alloc(0);
      stageFile(dir, outbox, { data, mode: 0o600 });
      recordBase(outbox, { sha256: createHash('sha256').update(data).digest('hex'), size: 0 });
    }
    if (launched) stagedSkills = Object.freeze(skillDirs.length ? copySkills(project, dir, skillDirs, recordBase) : []);
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  const ws = Object.freeze({ id, dir, base: Object.freeze(base), ...(launched ? { skillDirs: stagedSkills } : {}) });
  const session = { project, workerId, relative, launched, outbox, sizes, overlap: new Set() };
  sessions.set(ws, session);
  if (!active.has(project)) active.set(project, new Set());
  active.get(project).add(session);
  return ws;
}

function getSession(ws) {
  const session = sessions.get(ws);
  if (!session) throw new Error('Unknown or closed workspace.');
  return session;
}

function workspaceEntry(session) {
  const result = entry(session.project, session.relative);
  if (result.stat && !result.stat.isDirectory()) throw unsafe(session.relative);
  return result;
}

function workspaceChanges(ws, session, maxFileBytes = Infinity) {
  const { file: root, stat } = workspaceEntry(session);
  if (!stat) throw unsafe(session.relative);
  const after = new Map();
  const violations = [];
  walk(root, null, (relative, current) => {
    if (current.isFile()) {
      // A size change already proves a diff. Hash oversized files only when they might be unchanged inputs.
      const { size } = current;
      after.set(relative, size > maxFileBytes && size !== session.sizes.get(relative)
        ? { size } : readFile(root, relative, { hashOnly: true }));
    } else if (Object.hasOwn(ws.base, relative)) throw unsafe(relative);
  }, error => {
    violations.push(error.detail);
    after.set(error.detail.path, {});
  });
  const changes = { added: [], changed: [], removed: [] };
  for (const [relative, record] of after) {
    if (!Object.hasOwn(ws.base, relative)) changes.added.push(relative);
    else if (ws.base[relative].sha256 !== record.sha256) changes.changed.push(relative);
  }
  for (const relative of Object.keys(ws.base)) {
    if (!after.has(relative)) changes.removed.push(relative);
  }
  for (const group of Object.values(changes)) group.sort();
  return { changes, after, violations };
}

function diff(ws) {
  return workspaceChanges(ws, getSession(ws)).changes;
}

function workerOutbox(ws) {
  const session = getSession(ws);
  if (!session.outbox) return null;
  const { file, stat } = workspaceEntry(session);
  if (!stat) throw unsafe(session.relative);
  // Worker posts are a per-launch transport, capped at 64 KiB and never written to live files.
  return readFile(file, session.outbox, { maxBytes: MAX_OUTBOX_BYTES })?.data ?? Buffer.alloc(0);
}

function balancedCss(data) {
  const css = data.toString('utf8');
  const tokens = /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\\r\n\f])*"|'(?:\\[\s\S]|[^'\\\r\n\f])*'|\\[\s\S]|\/\*|["'{}()[\]]/g;
  const stack = [];
  const pairs = { '}': '{', ')': '(', ']': '[' };
  for (const [token] of css.matchAll(tokens)) {
    if (token === '/*' || token === '"' || token === "'") return false;
    if ('{(['.includes(token)) stack.push(token);
    if (Object.hasOwn(pairs, token) && stack.pop() !== pairs[token]) return false;
  }
  return stack.length === 0;
}

function checkCandidate(project, plan) {
  const sections = new Map(plan.filter(change => change.relative.startsWith('sections/'))
    .map(change => [change.relative, change.after]));
  if (!sections.size) return [];
  const candidate = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'swarm-scope-'));
  try {
    copyRoots(project, candidate, ['sections', 'brief.md']);
    for (const [relative, after] of sections) {
      fs.rmSync(entry(candidate, relative).file, { force: true });
      if (after) stageFile(candidate, relative, after);
    }
    const verdict = checkProject(candidate);
    const findings = verdict.findings.filter(finding => sections.get(finding.file) && SCOPE_RULES.has(finding.rule));
    const scope = new Map(findings.map(({ file, message }) => [`${file}\0${message}`, { code: 'scope', path: file, message }]));
    return [...scope.values()];
  } finally {
    fs.rmSync(candidate, { recursive: true, force: true });
  }
}

function prepare(ws, session, manifest, { maxFileBytes = MAX_FILE_BYTES } = {}) {
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) throw new TypeError('Invalid file size limit.');
  const project = session.project;
  const plan = [];
  try {
    const { changes, after, violations } = workspaceChanges(ws, session, maxFileBytes);
    const unsafePaths = new Set(violations.map(finding => finding.path));
    const paths = [...new Set([...changes.added, ...changes.changed, ...changes.removed, ...(session.restore?.keys() ?? [])])].sort();
    for (const relative of paths) {
      if (unsafePaths.has(relative)) continue;
      const code = classify(session.launched ?? manifest, session.workerId, relative);
      try {
        if (code !== 'owned') throw new Violation(code, relative, `Worker ${session.workerId} cannot modify this path.`);
        if (relative === session.outbox) {
          if (after.get(relative)?.size > MAX_OUTBOX_BYTES) {
            throw new Violation('size', relative, `Worker outbox exceeds the ${MAX_OUTBOX_BYTES} byte limit.`);
          }
          continue;
        }
        if (session.overlap.has(relative)) throw new Violation('overlap', relative, 'Another workspace already merged this path.');
        const next = after.get(relative);
        const restore = session.restore?.get(relative);
        if (session.restore && (!restore || (next?.sha256 ?? null) !== restore.sha256)) {
          throw new Violation('stale', relative, 'The staged file no longer matches the selected version.');
        }
        if (next?.size > maxFileBytes) throw new Violation('size', relative, `File exceeds the ${maxFileBytes} byte limit.`);
        const live = readFile(project, relative, { hashOnly: true });
        if (live?.sha256 === next?.sha256 && (!restore || (live?.mode ?? null) === restore.mode)) continue;
        if (live?.sha256 !== ws.base[relative]?.sha256) throw new Violation('stale', relative, 'The live file changed since this workspace opened.');
        const content = next ? readFile(ws.dir, relative, { maxBytes: maxFileBytes }) : null;
        if (content?.sha256 !== next?.sha256) throw new Violation('stale', relative, 'The workspace changed while being validated.');
        if (content && relative.endsWith('.css') && !balancedCss(content.data)) {
          throw new Violation('invalid-css', relative, 'CSS contains an unclosed or mismatched delimiter.');
        }
        const before = live ? readFile(project, relative) : null;
        if (live?.sha256 !== before?.sha256) throw new Violation('stale', relative, 'The live file changed while being validated.');
        if (content) content.mode = restore?.mode ?? before?.mode ?? 0o644;
        plan.push({ relative, before, after: content });
      } catch (error) {
        if (!(error instanceof Violation)) throw error;
        violations.push(error.detail);
      }
    }
    if (!violations.length) violations.push(...checkCandidate(project, plan));
    return { plan, violations };
  } catch (error) {
    if (!(error instanceof Violation)) throw error;
    return { plan: [], violations: [error.detail] };
  }
}

function validate(ws, manifest, opts) {
  const { violations } = prepare(ws, getSession(ws), manifest, opts);
  return { ok: !violations.length, violations };
}

function commit(project, plan, id = randomUUID()) {
  if (!plan.length) return null;
  const storage = directory(project, SNAPSHOTS);
  const staging = fs.mkdtempSync(path.join(storage, '.staging-'));
  const undo = path.join(staging, 'undo');
  const applied = [];
  const created = [];
  let published = false;
  let keepStaging = false;
  try {
    const next = directory(staging, 'next');
    directory(staging, 'undo');
    const snapshot = directory(staging, 'snapshot');
    const previous = directory(snapshot, 'files');
    for (const { relative, before, after } of plan) {
      if (after) stageFile(next, relative, after);
      if (before) {
        stageFile(undo, relative, before);
        stageFile(previous, relative, before);
      }
    }
    const files = plan.map(({ relative, before }) => ({ path: relative, sha256: before?.sha256 ?? null }));
    fs.writeFileSync(path.join(snapshot, 'snapshot.json'), JSON.stringify(files), { flag: 'wx', mode: 0o600 });
    fs.renameSync(snapshot, path.join(storage, id));
    published = true;

    for (const change of plan) {
      const { relative, before, after } = change;
      const current = readFile(project, relative, { hashOnly: true });
      if (current?.sha256 !== before?.sha256 || current?.mode !== before?.mode) {
        throw new Violation('stale', relative, 'The live file changed before it could be replaced.');
      }
      const parent = path.posix.dirname(relative);
      if (after && parent !== '.') directory(project, parent, created);
      const live = entry(project, relative).file;
      if (after) fs.renameSync(path.join(next, relative), live);
      else fs.unlinkSync(live);
      applied.push(change);
    }
    return id;
  } catch (error) {
    const recovery = [];
    for (const { relative, before } of applied.reverse()) {
      try {
        const live = entry(project, relative).file;
        if (before) fs.renameSync(path.join(undo, relative), live);
        else fs.unlinkSync(live);
      } catch (restoreError) {
        recovery.push(restoreError);
      }
    }
    for (const folder of created.reverse()) {
      try {
        fs.rmdirSync(folder);
      } catch (restoreError) {
        recovery.push(restoreError);
      }
    }
    if (recovery.length) {
      keepStaging = true;
      throw new AggregateError([error, ...recovery], `Integration recovery files remain in ${staging}`);
    }
    if (published) fs.rmSync(path.join(storage, id), { recursive: true, force: true });
    throw error;
  } finally {
    if (!keepStaging) fs.rmSync(staging, { recursive: true, force: true });
  }
}

function recordOverlap(project, paths, source) {
  for (const session of active.get(project) ?? []) {
    if (session !== source) for (const relative of paths) session.overlap.add(relative);
  }
}

function merge(projectDir, ws, manifest, opts) {
  const session = getSession(ws);
  const rejected = violations => ({ ok: false, merged: [], rejected: violations, snapshotId: null });
  try {
    const project = projectRoot(projectDir);
    if (project !== session.project) throw unsafe(session.relative);
    const { plan, violations } = prepare(ws, session, manifest, opts);
    if (violations.length) return rejected(violations);
    const snapshotId = commit(project, plan);
    const merged = plan.map(change => change.relative);
    recordOverlap(project, merged, session);
    return { ok: true, merged, rejected: [], snapshotId };
  } catch (error) {
    if (error instanceof Violation) return rejected([error.detail]);
    if (typeof error.code === 'string') return rejected([{ code: 'io', path: '', message: error.message }]);
    throw error;
  }
}

function publicationRoots(anchorId, visual) {
  const policy = ['contract.json', 'anchors/flow.json'];
  if (anchorId !== undefined) {
    if (typeof anchorId !== 'string' || !ANCHOR_ID.test(anchorId)) throw new TypeError('Invalid anchor ID.');
    for (const file of ['meta.json', 'contract.json', 'anchor.desktop.png', 'anchor.tablet.png', 'anchor.mobile.png']) {
      policy.push(`anchors/${anchorId}/${file}`);
    }
  }
  return visual ? [...PREVIEW_ROOTS, ...policy] : policy;
}

function signature(record) {
  return record ? `${record.sha256}:${record.mode}` : null;
}

function inputState(root, roots) {
  if (projectRoot(root) !== root) throw unsafe(root);
  const state = new Map();
  walk(root, roots, (relative, stat) => {
    state.set(relative, stat.isDirectory() ? 'directory' : signature(readFile(root, relative, { hashOnly: true })));
  });
  return state;
}

function changedInput(expected, actual) {
  return [...new Set([...expected.keys(), ...actual.keys()])].find(key => expected.get(key) !== actual.get(key));
}

function requireInputs(expected, root, roots, message) {
  const changed = changedInput(expected, inputState(root, roots));
  if (changed) throw new Violation('stale', changed, message);
}

function planState(plan) {
  return new Map(plan.map(({ relative, before, after }) => [relative, `${signature(before)}>${signature(after)}`]));
}

function visualPath(relative) {
  return relative.startsWith('sections/') || relative.startsWith('assets/');
}

function affectedSections(plan, manifest) {
  const owners = new Set();
  for (const { relative } of plan) {
    if (relative.startsWith('sections/')) {
      const section = parseSectionFile(relative.slice('sections/'.length));
      if (section) owners.add(section.base);
    } else if (relative.startsWith('assets/generated/')) {
      const named = manifest.sections.filter(base => relative.startsWith(`assets/generated/${base}-`));
      const section = named.sort((a, b) => b.length - a.length)[0];
      if (section) owners.add(section);
    }
  }
  return [...owners].sort();
}

async function publish(projectDir, ws, { accept, anchorId, maxFileBytes, canCommit, sharedProposal } = {}) {
  const session = getSession(ws);
  if (!session.launched) throw new TypeError('Publication requires a launch workspace.');
  if (typeof accept !== 'function') throw new TypeError('Publication requires acceptance checks.');
  const rejected = violations => ({ ok: false, merged: [], rejected: violations, snapshotId: null, outbox: null });
  if (session.publishing || session.published) {
    return rejected([{ code: 'busy', path: '', message: 'This launch already has a publication.' }]);
  }

  session.publishing = true;
  let scratch;
  try {
    const project = projectRoot(projectDir);
    if (project !== session.project) throw unsafe(session.relative);
    const { plan, violations } = prepare(ws, session, session.launched, { maxFileBytes });
    if (violations.length) return rejected(violations);

    const outbox = workerOutbox(ws);
    const frozenPlan = planState(plan);
    const visual = plan.filter(change => visualPath(change.relative));
    const roots = publicationRoots(anchorId, visual.length > 0);
    const baseline = inputState(project, roots);
    let before = null;
    let after = null;
    let expectedAfter;
    if (visual.length) {
      scratch = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'swarm-publication-'));
      before = directory(scratch, 'before');
      after = directory(scratch, 'after');
      const sourceMode = (_relative, record) => record.mode;
      copyRoots(project, before, roots, undefined, sourceMode);
      requireInputs(baseline, before, roots, 'The preview baseline changed while it was copied.');
      copyRoots(before, after, roots, undefined, sourceMode);
      for (const { relative, after: desired } of visual) {
        fs.rmSync(entry(after, relative).file, { force: true });
        if (desired) stageFile(after, relative, desired);
      }
      expectedAfter = inputState(after, roots);
    }

    const changed = Object.freeze(plan.map(change => change.relative));
    const sections = Object.freeze(affectedSections(visual, session.launched));
    const review = Object.freeze({ before, after, anchorId, workerId: session.workerId,
      changed, sections, outbox: outbox?.toString('utf8') ?? null });
    const verdict = await accept(review);
    if (verdict?.ok !== true) {
      const reasons = Array.isArray(verdict?.rejected) && verdict.rejected.length ? verdict.rejected
        : [{ code: 'acceptance', path: '', message: 'Publication checks did not accept the changes.' }];
      return rejected(reasons);
    }

    return withProjectLock(project, () => {
      if (canCommit?.() === false) return rejected([{ code: 'cancelled', path: '', message: 'The restore was cancelled.' }]);
      if (sessions.get(ws) !== session || projectRoot(projectDir) !== project) {
        throw new Violation('stale', '', 'The launch workspace changed while acceptance was pending.');
      }
      if (session.restoreBaseline) {
        const changed = [...session.restoreBaseline].find(([relative, baseline]) =>
          signature(readFile(project, relative, { hashOnly: true })) !== baseline);
        if (changed || componentControl(project).some((value, index) => value !== session.restoreControl[index])) {
          throw new Violation('stale', changed?.[0] ?? '', 'The confirmed component changed during review.');
        }
      }
      requireInputs(baseline, project, roots, 'The live preview inputs changed during acceptance.');
      if (before) {
        requireInputs(baseline, before, roots, 'The before preview changed during acceptance.');
        requireInputs(expectedAfter, after, roots, 'The after preview changed during acceptance.');
      }
      const next = prepare(ws, session, session.launched, { maxFileBytes });
      if (next.violations.length) return rejected(next.violations);
      const edited = changedInput(frozenPlan, planState(next.plan));
      if (edited) throw new Violation('stale', edited, 'The prepared changes no longer match the accepted candidate.');
      if (outbox !== null && !outbox.equals(workerOutbox(ws))) {
        throw new Violation('stale', session.outbox, 'The worker outbox changed during acceptance.');
      }

      const pending = sharedProposal ? sharedTokens.pendingFile(project, sharedProposal) : null;
      const snapshotId = commit(project, pending ? [...plan, pending] : plan);
      session.published = true;
      recordOverlap(project, changed, session);
      return { ok: true, merged: [...changed], rejected: [], snapshotId, outbox };
    });
  } catch (error) {
    if (error instanceof Violation) return rejected([error.detail]);
    if (error instanceof ProjectBusyError) return rejected([{ code: 'busy', path: '', message: error.message }]);
    if (typeof error.code === 'string') return rejected([{ code: 'io', path: '', message: error.message }]);
    throw error;
  } finally {
    session.publishing = false;
    if (scratch) {
      try { fs.rmSync(scratch, { recursive: true, force: true }); }
      catch { console.warn('Could not clean up publication preview copies.'); }
    }
  }
}

// Both review and approval render clean copies. Recheck their exact inputs under the
// project lock before persisting evidence or applying an operator decision.
async function inspectSharedTokens(projectDir, proposal, measure, finish) {
  const project = projectRoot(projectDir);
  const roots = [...publicationRoots(proposal.anchor?.id, true), 'agents.json'];
  const baseline = inputState(project, roots);
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'swarm-shared-review-'));
  try {
    const before = directory(scratch, 'before');
    const after = directory(scratch, 'after');
    const sourceMode = (_relative, record) => record.mode;
    copyRoots(project, before, roots, undefined, sourceMode);
    requireInputs(baseline, before, roots, 'The project changed while preparing the style review.');
    copyRoots(before, after, roots, undefined, sourceMode);
    const file = readFile(before, 'tokens.css');
    if (!file || file.sha256 !== proposal.baseHash || file.mode !== proposal.baseMode) {
      throw new Violation('stale', 'tokens.css', 'The shared stylesheet changed. Request a fresh proposal.');
    }
    fs.unlinkSync(entry(after, 'tokens.css').file);
    stageFile(after, 'tokens.css', { mode: file.mode, data: Buffer.from(proposal.after) });
    const candidate = inputState(after, roots);
    const inputs = createHash('sha256').update(JSON.stringify([...baseline])).digest('hex');
    const impact = await measure(before, after);
    return withProjectLock(project, () => {
      requireInputs(baseline, project, roots, 'The project changed during the style review.');
      requireInputs(baseline, before, roots, 'The review baseline changed during capture.');
      requireInputs(candidate, after, roots, 'The style candidate changed during capture.');
      return finish(impact, inputs);
    });
  } finally {
    fs.rmSync(scratch, { force: true, recursive: true });
  }
}

function applySharedDecision(project, proposal, decision) {
  const before = readFile(project, 'tokens.css');
  if (before?.sha256 !== proposal.baseHash || before.mode !== proposal.baseMode) {
    throw new Violation('stale', 'tokens.css', 'The reviewed stylesheet is no longer current.');
  }
  const id = commit(project, [{ relative: 'tokens.css', before,
    after: { mode: before.mode, data: Buffer.from(proposal.after) } }, decision], proposal.decision.undoSnapshotId);
  recordOverlap(project, ['tokens.css']);
  return id;
}

function snapshotRecords(project, snapshotId, paths, hashOnly = false) {
  if (typeof snapshotId !== 'string' || !UUID.test(snapshotId)) throw new Error('Invalid snapshot ID.');
  const source = `${SNAPSHOTS}/${snapshotId}`;
  const meta = readFile(project, `${source}/snapshot.json`, { maxBytes: MAX_FILE_BYTES });
  if (!meta) throw new Error(`Unknown snapshot: ${snapshotId}`);
  const savedFiles = JSON.parse(meta.data.toString('utf8'));
  if (!Array.isArray(savedFiles)) throw new Error('Invalid snapshot manifest.');
  const files = new Map();
  for (const file of savedFiles) {
    if (!isSafePath(file?.path) || files.has(file.path) || (file.sha256 !== null &&
      (typeof file.sha256 !== 'string' || !/^[a-f\d]{64}$/.test(file.sha256)))) throw new Error('Invalid snapshot manifest.');
    files.set(file.path, file.sha256);
  }
  const selected = paths ?? [...files.keys()];
  if (!Array.isArray(selected) || selected.some(relative => !files.has(relative))) {
    throw new Error('Rollback paths must belong to the component snapshot.');
  }
  return [...new Set(selected)].sort().map(relative => {
    const saved = readFile(project, `${source}/files/${relative}`, { hashOnly });
    if ((saved?.sha256 ?? null) !== files.get(relative)) throw new Error(`Invalid snapshot file: ${relative}`);
    return { relative, saved };
  });
}

function componentControl(project) {
  return ['contract.json', 'anchors/flow.json', 'agents.json'].map(relative =>
    signature(readFile(project, relative, { hashOnly: true })));
}

function componentStates(project, records, live = new Map()) {
  return records.map(({ relative, saved }) => {
    if (!live.has(relative)) live.set(relative, signature(readFile(project, relative, { hashOnly: true })));
    return [relative, live.get(relative), signature(saved)];
  });
}

function componentRevision(sectionId, snapshotId, control, states) {
  return createHash('sha256').update(JSON.stringify([sectionId, snapshotId, control, states])).digest('hex');
}

function stageComponentRestore(ws, sectionId, { snapshotId, paths, expectedRevision }) {
  const session = getSession(ws);
  if (!session.launched || session.restore || session.publishing || session.published || !Array.isArray(paths) || !paths.length) {
    throw new Error('A new launch workspace and component paths are required.');
  }
  const records = snapshotRecords(session.project, snapshotId, paths);
  if (records.some(({ relative }) => classify(session.launched, session.workerId, relative) !== 'owned' ||
      affectedSections([{ relative }], session.launched)[0] !== sectionId)) {
    throw new Error('The selected paths are not owned by this component.');
  }
  const states = componentStates(session.project, records);
  const control = componentControl(session.project);
  if (componentRevision(sectionId, snapshotId, control, states) !== expectedRevision) {
    throw new Violation('stale', '', 'The component changed. Reload its history before restoring.');
  }
  session.restore = new Map(records.map(({ relative, saved }) => [relative,
    { sha256: saved?.sha256 ?? null, mode: saved?.mode ?? null }]));
  session.restoreBaseline = new Map(states.map(([relative, before]) => [relative, before]));
  session.restoreControl = control;
  for (const { relative, saved } of records) {
    fs.rmSync(entry(ws.dir, relative).file, { force: true });
    if (saved) stageFile(ws.dir, relative, { ...saved, mode: 0o600 });
  }
}

function componentHistory(projectDir, sectionId, workerId, manifest) {
  const project = projectRoot(projectDir);
  const log = readFile(project, 'integration/log.jsonl', { maxBytes: 8 * 1024 * 1024 });
  if (!log) return [];
  const control = componentControl(project);
  const versions = [];
  const visited = new Set();
  const live = new Map();
  for (const line of log.data.toString('utf8').trimEnd().split('\n').reverse()) {
    try {
      const item = JSON.parse(line);
      if (!UUID.test(item.snapshotId) || visited.has(item.snapshotId) || !Array.isArray(item.paths) ||
          typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at))) continue;
      const paths = item.paths.filter(relative => isSafePath(relative) && classify(manifest, workerId, relative) === 'owned' &&
        affectedSections([{ relative }], manifest)[0] === sectionId);
      if (!paths.length) continue;
      const records = snapshotRecords(project, item.snapshotId, paths, true);
      const states = componentStates(project, records, live);
      visited.add(item.snapshotId);
      if (states.every(([, current, saved]) => current === saved)) continue;
      const expectedRevision = componentRevision(sectionId, item.snapshotId, control, states);
      versions.push({ snapshotId: item.snapshotId, createdAt: item.at, paths: states.map(([relative]) => relative), expectedRevision });
      if (versions.length === 20) break;
    } catch { /* A malformed or unavailable history record cannot be restored. */ }
  }
  return versions;
}

function rollback(projectDir, snapshotId, { paths } = {}) {
  const project = projectRoot(projectDir);
  const plan = [];
  for (const { relative, saved } of snapshotRecords(project, snapshotId, paths)) {
    const live = readFile(project, relative);
    if (live?.sha256 !== saved?.sha256 || live?.mode !== saved?.mode) {
      plan.push({ relative, before: live, after: saved });
    }
  }
  const undoId = commit(project, plan);
  const restored = plan.map(change => change.relative);
  recordOverlap(project, restored);
  return { ok: true, restored, snapshotId: undoId };
}

function close(ws) {
  const session = sessions.get(ws);
  if (!session) return;
  try {
    const { file, stat } = entry(session.project, WORKSPACES);
    if (stat && !stat.isDirectory()) throw unsafe(WORKSPACES);
    if (stat) fs.rmSync(path.join(file, ws.id), { recursive: true, force: true });
  } finally {
    sessions.delete(ws);
    const workspaces = active.get(session.project);
    workspaces.delete(session);
    if (!workspaces.size) active.delete(session.project);
  }
}

module.exports = { open, diff, workerOutbox, validate, merge, publish, rollback, close, componentHistory, stageComponentRestore, inspectSharedTokens, applySharedDecision };
