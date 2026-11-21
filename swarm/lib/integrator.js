'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { checkProject } = require('../tools/check-sections');
const { classify, isSafePath } = require('./ownership');

const MAX_FILE_BYTES = 1024 * 1024;
const READ_FLAGS = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;
const WORKSPACES = '.run/ws';
const SNAPSHOTS = '.run/component-snapshots';
const SCOPE_RULES = new Set(['layer-scope', 'unscoped-selector', 'css-scope']);
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/;
const sessions = new WeakMap();
const active = new Map();

class Violation extends Error {
  constructor(code, relative, message) {
    super(message);
    this.detail = { code, path: relative, message };
  }
}

function unsafe(relative) {
  return new Violation('forbidden', relative, 'Unsafe path, link, or file type.');
}

function projectRoot(directory) {
  const root = path.resolve(directory);
  if (!fs.lstatSync(root).isDirectory()) throw unsafe(directory);
  return fs.realpathSync.native(root);
}

function entry(root, relative) {
  if (!isSafePath(relative)) throw unsafe(relative);
  const parts = relative.split('/');
  let current = root;
  let stat;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) return { file: path.join(root, relative), stat };
    const regular = index === parts.length - 1 && stat.isFile() && stat.nlink === 1;
    if ((!stat.isDirectory() && !regular) || fs.realpathSync.native(current) !== current) throw unsafe(relative);
  }
  return { file: current, stat };
}

function directory(root, relative, created = []) {
  const parts = relative.split('/');
  for (const [index] of parts.entries()) {
    const prefix = parts.slice(0, index + 1).join('/');
    const { file, stat } = entry(root, prefix);
    if (stat?.isDirectory()) continue;
    if (stat) throw unsafe(relative);
    fs.mkdirSync(file, { mode: 0o700 });
    created.push(file);
  }
  return path.join(root, relative);
}

function readFile(root, relative, { hashOnly = false, maxBytes = Infinity } = {}) {
  const { file, stat } = entry(root, relative);
  if (!stat) return null;
  if (!stat.isFile()) throw unsafe(relative);
  let fd;
  try {
    fd = fs.openSync(file, READ_FLAGS);
  } catch (error) {
    if (error.code === 'ELOOP') throw unsafe(relative);
    throw error;
  }
  try {
    const actual = fs.fstatSync(fd);
    if (!actual.isFile() || actual.nlink !== 1 || actual.ino !== stat.ino || actual.dev !== stat.dev) {
      throw unsafe(relative);
    }
    const limit = () => new Violation('size', relative, `File exceeds the ${maxBytes} byte limit.`);
    if (actual.size > maxBytes) throw limit();

    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(Math.min(actual.size || 1, 64 * 1024));
    const chunks = [];
    let size = 0;
    for (let count; (count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0;) {
      size += count;
      if (size > maxBytes) throw limit();
      const chunk = buffer.subarray(0, count);
      hash.update(chunk);
      if (!hashOnly) chunks.push(Buffer.from(chunk));
    }
    return { sha256: hash.digest('hex'), mode: actual.mode & 0o777, size,
      ...(hashOnly ? {} : { data: Buffer.concat(chunks, size) }) };
  } finally {
    fs.closeSync(fd);
  }
}

function stageFile(root, relative, record) {
  const parent = path.posix.dirname(relative);
  if (parent !== '.') directory(root, parent);
  const file = entry(root, relative).file;
  fs.writeFileSync(file, record.data, { flag: 'wx', mode: 0o600 });
  fs.chmodSync(file, record.mode);
}

function walk(root, roots, visit, onUnsafe = error => { throw error; }) {
  function descend(relative) {
    try {
      const { file, stat } = entry(root, relative);
      if (!stat) return;
      visit(relative, stat);
      if (stat.isDirectory()) {
        for (const name of fs.readdirSync(file).sort()) descend(`${relative}/${name}`);
      }
    } catch (error) {
      if (!(error instanceof Violation)) throw error;
      onUnsafe(error);
    }
  }
  for (const relative of roots ?? fs.readdirSync(root).sort()) descend(relative);
}

function copyRoots(from, to, roots, recordBase = () => {}) {
  walk(from, roots, (relative, stat) => {
    if (stat.isDirectory()) directory(to, relative);
    else {
      const record = readFile(from, relative);
      stageFile(to, relative, { ...record, mode: 0o600 });
      recordBase(relative, record);
    }
  });
}

function open(projectDir, workerId, manifest) {
  if (!isSafePath(workerId) || !manifest.workers.includes(workerId)) throw new Error('Unknown worker ID.');
  const project = projectRoot(projectDir);
  const id = randomUUID();
  const relative = `${WORKSPACES}/${id}`;
  const dir = directory(project, relative);
  const base = Object.create(null);
  const sizes = new Map();
  const roots = ['anchors', 'assets', 'sections', `notes/${workerId}.md`, `chat/${workerId}.jsonl`,
    ...manifest.shared.map(glob => glob.replace(/\/\*$/, ''))];
  try {
    copyRoots(project, dir, roots, (name, { sha256, size }) => {
      base[name] = Object.freeze({ sha256 });
      sizes.set(name, size);
    });
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  const ws = Object.freeze({ id, dir, base: Object.freeze(base) });
  const session = { project, workerId, relative, sizes, overlap: new Set() };
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
    const paths = [...changes.added, ...changes.changed, ...changes.removed].sort();
    for (const relative of paths) {
      if (unsafePaths.has(relative)) continue;
      const code = classify(manifest, session.workerId, relative);
      try {
        if (code !== 'owned') throw new Violation(code, relative, `Worker ${session.workerId} cannot modify this path.`);
        if (session.overlap.has(relative)) throw new Violation('overlap', relative, 'Another workspace already merged this path.');
        const next = after.get(relative);
        if (next?.size > maxFileBytes) throw new Violation('size', relative, `File exceeds the ${maxFileBytes} byte limit.`);
        const live = readFile(project, relative, { hashOnly: true });
        if (live?.sha256 === next?.sha256) continue;
        if (live?.sha256 !== ws.base[relative]?.sha256) throw new Violation('stale', relative, 'The live file changed since this workspace opened.');
        const content = next ? readFile(ws.dir, relative, { maxBytes: maxFileBytes }) : null;
        if (content?.sha256 !== next?.sha256) throw new Violation('stale', relative, 'The workspace changed while being validated.');
        if (content && relative.endsWith('.css') && !balancedCss(content.data)) {
          throw new Violation('invalid-css', relative, 'CSS contains an unclosed or mismatched delimiter.');
        }
        const before = live ? readFile(project, relative) : null;
        if (live?.sha256 !== before?.sha256) throw new Violation('stale', relative, 'The live file changed while being validated.');
        if (content) content.mode = before?.mode ?? 0o644;
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

function commit(project, plan) {
  if (!plan.length) return null;
  const id = randomUUID();
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

function rollback(projectDir, snapshotId, { paths } = {}) {
  if (typeof snapshotId !== 'string' || !UUID.test(snapshotId)) throw new Error('Invalid snapshot ID.');
  const project = projectRoot(projectDir);
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
  const plan = [];
  for (const relative of [...new Set(selected)].sort()) {
    const saved = readFile(project, `${source}/files/${relative}`);
    if ((saved?.sha256 ?? null) !== files.get(relative)) throw new Error(`Invalid snapshot file: ${relative}`);
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

module.exports = { open, diff, validate, merge, rollback, close };
