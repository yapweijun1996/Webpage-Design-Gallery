'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const IGNORED_ROOT_ENTRIES = new Set(['chat', '.checkpoint', 'dist']);
const MAX_HASH_BYTES = 1024 * 1024;
const READ_FLAGS = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function snapshot(projectDir) {
  const files = new Map();

  function walk(dir, prefix) {
    for (const name of fs.readdirSync(dir)) {
      if (!prefix && (IGNORED_ROOT_ENTRIES.has(name) || name.startsWith('channel.'))) continue;

      const absolute = path.join(dir, name);
      const relative = prefix + name;
      const stat = fs.lstatSync(absolute, { throwIfNoEntry: false });
      if (!stat) continue;

      try {
        if (stat.isDirectory()) {
          walk(absolute, relative + '/');
          continue;
        }

        const record = { size: stat.size, mtimeMs: stat.mtimeMs };
        if (stat.isSymbolicLink()) {
          record.hash = 'link:' + sha256(fs.readlinkSync(absolute, { encoding: 'buffer' }));
        } else if (stat.isFile() && stat.size <= MAX_HASH_BYTES) {
          record.hash = sha256(fs.readFileSync(absolute, { flag: READ_FLAGS }));
        }
        files.set(relative, record);
      } catch (error) {
        // Files may disappear or be replaced while the project is being edited.
        if (!['ENOENT', 'ENOTDIR', 'ELOOP', 'EINVAL'].includes(error.code)) throw error;
      }
    }
  }

  walk(projectDir, '');
  return files;
}

function violations(before, after, ownedGlobs) {
  // The ownership patterns use literal paths and wildcards within a single path segment.
  const owned = ownedGlobs.map(glob => {
    const pattern = glob.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp('^' + pattern.join('[^/]*') + '$');
  });
  const changed = [];

  for (const file of new Set([...before.keys(), ...after.keys()])) {
    const old = before.get(file);
    const current = after.get(file);
    if (old && current && old.size === current.size && old.mtimeMs === current.mtimeMs && old.hash === current.hash) {
      continue;
    }
    if (!owned.some(pattern => pattern.test(file))) changed.push(file);
  }

  return changed.sort();
}

module.exports = { snapshot, violations };
