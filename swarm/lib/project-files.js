'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { isSafePath } = require('./ownership');

const READ_FLAGS = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;

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

function copyRoots(from, to, roots, recordBase = () => {}, modeFor = () => 0o600) {
  walk(from, roots, (relative, stat) => {
    if (stat.isDirectory()) directory(to, relative);
    else {
      const record = readFile(from, relative);
      stageFile(to, relative, { ...record, mode: modeFor(relative, record) });
      recordBase(relative, record);
    }
  });
}

module.exports = { Violation, unsafe, projectRoot, entry, directory, readFile, stageFile, walk, copyRoots };
