'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const RETENTION = 20;
const ENTRIES = ['sections', 'contract.json'];
const ID = /^\d{13}-[a-f0-9-]{36}$/;
const MANIFEST = 'snapshot.json';

class VersionNotFoundError extends Error {}
class VersionRestoreBlockedError extends Error {}

function isVersionId(id) {
  return typeof id === 'string' && ID.test(id);
}

function versionsDir(projectDir, create = false) {
  const project = path.resolve(projectDir);
  if (!fs.lstatSync(project).isDirectory()) throw new Error(`Expected a project directory: ${project}`);
  let directory = project;
  for (const name of ['.run', 'versions']) {
    directory = path.join(directory, name);
    let stat = fs.lstatSync(directory, { throwIfNoEntry: false });
    if (!stat) {
      if (!create) return null;
      fs.mkdirSync(directory, { recursive: true });
      stat = fs.lstatSync(directory);
    }
    if (!stat.isDirectory()) throw new Error(`Expected a version storage directory: ${directory}`);
  }
  return directory;
}

function snapshotIds(storage) {
  return fs.readdirSync(storage, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && ID.test(entry.name))
    .map(entry => entry.name).sort().reverse();
}

function readManifest(storage, id) {
  const directory = path.join(storage, id);
  if (!fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new VersionNotFoundError(`Unknown snapshot: ${id}`);
  }
  const file = path.join(directory, MANIFEST);
  if (!fs.lstatSync(file, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing snapshot manifest: ${id}`);
  }
  const { label, createdAt, entries } = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (typeof label !== 'string' || typeof createdAt !== 'string' || !Array.isArray(entries) ||
    entries.length > ENTRIES.length || new Set(entries).size !== entries.length ||
    !entries.every(entry => ENTRIES.includes(entry))) {
    throw new Error(`Invalid snapshot manifest: ${id}`);
  }
  return { id, label, createdAt, entries };
}

function inspectEntries(directory) {
  return ENTRIES.filter(name => {
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return false;
    if (name === 'sections' ? !stat.isDirectory() : !stat.isFile()) {
      throw new Error(`Unexpected file type: ${file}`);
    }
    return true;
  });
}

function copyEntries(from, to, entries) {
  for (const name of entries) {
    fs.cpSync(path.join(from, name), path.join(to, name), {
      recursive: true,
      filter(source) {
        const stat = fs.lstatSync(source);
        if (!stat.isDirectory() && !stat.isFile()) throw new Error(`Unexpected file type: ${source}`);
        return true;
      },
    });
  }
}

function nextVersion(storage) {
  const latest = snapshotIds(storage)[0];
  const now = Date.now();
  // Keep insertion order when snapshots share a clock tick or the clock moves backward.
  const sequence = latest ? Math.max(now, Number(latest.slice(0, 13)) + 1) : now;
  const id = `${String(sequence).padStart(13, '0')}-${randomUUID()}`;
  return { id, createdAt: new Date(now).toISOString() };
}

function prune(storage, pinned) {
  try {
    let remaining = RETENTION - (pinned ? 1 : 0);
    for (const id of snapshotIds(storage)) {
      if (id === pinned || remaining-- > 0) continue;
      fs.rmSync(path.join(storage, id), { recursive: true, force: true });
    }
  } catch {
    // Pruning is housekeeping. A saved or restored version remains committed.
    console.warn('Version history cleanup could not finish.');
  }
}

function cleanStage(staging) {
  try { fs.rmSync(staging, { recursive: true, force: true }); }
  catch { console.warn('Version staging cleanup could not finish.'); }
}

function snapshot(projectDir, label = '') {
  if (typeof label !== 'string') throw new TypeError('Snapshot label must be a string');
  const entries = inspectEntries(projectDir);
  const storage = versionsDir(projectDir, true);
  const { id, createdAt } = nextVersion(storage);
  const staging = fs.mkdtempSync(path.join(storage, '.snapshot-'));
  try {
    copyEntries(projectDir, staging, entries);
    fs.writeFileSync(path.join(staging, MANIFEST), JSON.stringify({ label, createdAt, entries }));
    fs.renameSync(staging, path.join(storage, id));
  } finally {
    cleanStage(staging);
  }
  prune(storage);
  return id;
}

function list(projectDir) {
  const storage = versionsDir(projectDir);
  if (!storage) return [];
  return snapshotIds(storage).map(id => {
    const { label, createdAt } = readManifest(storage, id);
    return { id, label, createdAt };
  });
}

function rollback(projectDir, id, { backupLabel, canRestore } = {}) {
  if (!isVersionId(id)) throw new Error('Invalid snapshot id');
  if (backupLabel !== undefined && typeof backupLabel !== 'string') throw new TypeError('Snapshot label must be a string');
  const storage = versionsDir(projectDir);
  if (!storage) throw new VersionNotFoundError(`Unknown snapshot: ${id}`);
  const { entries } = readManifest(storage, id);
  const source = path.join(storage, id);
  const captured = inspectEntries(source);
  if (captured.length !== entries.length || !entries.every(name => captured.includes(name))) {
    throw new Error(`Incomplete snapshot: ${id}`);
  }

  const live = inspectEntries(projectDir);
  const backup = backupLabel === undefined ? undefined : nextVersion(storage);
  const staging = fs.mkdtempSync(path.join(storage, '.rollback-'));
  const candidate = path.join(staging, 'candidate');
  const before = path.join(staging, 'before');
  const moves = [];
  let keepStaging = false;
  function move(from, to) {
    fs.renameSync(from, to);
    moves.push([from, to]);
  }
  try {
    // Complete all potentially failing copies before moving live entries.
    fs.mkdirSync(candidate);
    fs.mkdirSync(before);
    copyEntries(source, candidate, entries);
    if (canRestore) {
      const decision = canRestore({ id, source: candidate });
      if (decision !== true) {
        throw new VersionRestoreBlockedError(typeof decision === 'string' ? decision : 'This version cannot be restored.');
      }
    }
    if (backup) {
      fs.writeFileSync(path.join(before, MANIFEST), JSON.stringify({
        label: backupLabel, createdAt: backup.createdAt, entries: live,
      }));
    }
    for (const name of ENTRIES) {
      const target = path.join(projectDir, name);
      if (live.includes(name)) move(target, path.join(before, name));
      if (entries.includes(name)) move(path.join(candidate, name), target);
    }
    // Publish the undo snapshot only after the replacement succeeds. Keep the
    // restored version available at the history limit until the next save.
    if (backup) move(before, path.join(storage, backup.id));
  } catch (error) {
    const failures = [];
    for (const [from, to] of moves.reverse()) {
      try {
        fs.renameSync(to, from);
      } catch (restoreError) {
        failures.push(restoreError);
      }
    }
    if (failures.length) {
      keepStaging = true;
      throw new AggregateError([error, ...failures], `Rollback recovery files remain in ${staging}`);
    }
    throw error;
  } finally {
    if (!keepStaging) cleanStage(staging);
  }
  if (backup) prune(storage, id);
  return backup?.id;
}

module.exports = { snapshot, list, rollback, isVersionId, VersionNotFoundError, VersionRestoreBlockedError };
