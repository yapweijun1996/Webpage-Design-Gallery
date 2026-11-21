'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const RETENTION = 20;
const ENTRIES = ['sections', 'contract.json'];
const ID = /^\d{13}-[a-f0-9-]{36}$/;
const MANIFEST = 'snapshot.json';

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
    throw new Error(`Unknown snapshot: ${id}`);
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

function snapshot(projectDir, label = '') {
  if (typeof label !== 'string') throw new TypeError('Snapshot label must be a string');
  const entries = inspectEntries(projectDir);
  const storage = versionsDir(projectDir, true);
  const previous = snapshotIds(storage);
  const now = Date.now();
  // Keep insertion order when snapshots share a clock tick or the clock moves backward.
  const sequence = previous.length ? Math.max(now, Number(previous[0].slice(0, 13)) + 1) : now;
  const id = `${String(sequence).padStart(13, '0')}-${randomUUID()}`;
  const staging = fs.mkdtempSync(path.join(storage, '.snapshot-'));
  try {
    copyEntries(projectDir, staging, entries);
    fs.writeFileSync(path.join(staging, MANIFEST), JSON.stringify({
      label, createdAt: new Date(now).toISOString(), entries,
    }));
    fs.renameSync(staging, path.join(storage, id));
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  for (const old of previous.slice(RETENTION - 1)) {
    fs.rmSync(path.join(storage, old), { recursive: true, force: true });
  }
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

function rollback(projectDir, id) {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('Invalid snapshot id');
  const storage = versionsDir(projectDir);
  if (!storage) throw new Error(`Unknown snapshot: ${id}`);
  const { entries } = readManifest(storage, id);
  const source = path.join(storage, id);
  const captured = inspectEntries(source);
  if (captured.length !== entries.length || !entries.every(name => captured.includes(name))) {
    throw new Error(`Incomplete snapshot: ${id}`);
  }

  const live = inspectEntries(projectDir);
  const staging = fs.mkdtempSync(path.join(storage, '.rollback-'));
  const moves = [];
  let keepStaging = false;
  function move(from, to) {
    fs.renameSync(from, to);
    moves.push([from, to]);
  }
  try {
    // Complete all potentially failing copies before moving live entries.
    copyEntries(source, staging, entries);
    for (const name of ENTRIES) {
      const target = path.join(projectDir, name);
      if (live.includes(name)) move(target, path.join(staging, `old-${name}`));
      if (entries.includes(name)) move(path.join(staging, name), target);
    }
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
    if (!keepStaging) fs.rmSync(staging, { recursive: true, force: true });
  }
}

module.exports = { snapshot, list, rollback };
