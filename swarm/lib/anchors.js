'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { validate: validateContract } = require('./contract');

const WIDTHS = Object.freeze({ desktop: 1440, tablet: 768, mobile: 393 });
const FILES = Object.keys(WIDTHS).map(breakpoint => `anchor.${breakpoint}.png`);
const ID = /^v(?:00[1-9]|0[1-9]\d|[1-9]\d{2,})$/;
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const READ_ONLY = 0o444;

function own(object, key) {
  return object != null && Object.hasOwn(object, key) ? object[key] : undefined;
}

function parseJSON(text) {
  return JSON.parse(text, (key, value) => PROTOTYPE_KEYS.has(key) ? undefined : value);
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stat(file) {
  return fs.lstatSync(file, { throwIfNoEntry: false });
}

function checkDirectory(dir) {
  const entry = stat(dir);
  if (entry && !entry.isDirectory()) throw new Error('Invalid anchor directory');
  return !!entry;
}

function readFile(file) {
  const entry = stat(file);
  if (entry && !entry.isFile()) throw new Error('Invalid anchor file');
  return fs.readFileSync(file, { flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW });
}

function json(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function writeFile(file, data) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, data);
    fs.fchmodSync(fd, READ_ONLY);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function syncDirectory(dir) {
  const fd = fs.openSync(dir, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function replaceFile(dir, name, data) {
  const file = path.join(dir, name);
  const entry = stat(file);
  if (entry && !entry.isFile()) throw new Error('Invalid anchor file');

  const temporary = path.join(dir, `.${randomUUID()}.tmp`);
  try {
    writeFile(temporary, data);
    fs.renameSync(temporary, file);
    syncDirectory(dir);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function ids(root) {
  if (!checkDirectory(root)) return [];
  return fs.readdirSync(root)
    .filter(name => ID.test(name))
    .sort((left, right) => left.length - right.length || left.localeCompare(right, 'en'));
}

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function dimensions(buffer, width, name) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)
    || buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`Invalid PNG for ${name}`);
  }
  const height = buffer.readUInt32BE(20);
  if (buffer.readUInt32BE(16) !== width || height === 0 || height > 0x7fffffff) {
    throw new Error(`Expected ${name} to be ${width} pixels wide and have a valid height`);
  }
  return { width, height };
}

function image(source) {
  if (Buffer.isBuffer(source)) return Buffer.from(source);
  if (typeof source !== 'string' || !source || source.includes('\0') || source.split(/[/\\]/).includes('..')) {
    throw new Error('Invalid anchor image source path');
  }
  return readFile(source);
}

function sha256Map(meta) {
  return Object.fromEntries(Object.entries(meta.files).map(([name, details]) => [name, details.sha256]));
}

function create(projectDir, input) {
  const sources = own(input, 'files');
  if (!record(sources) || own(sources, 'desktop') == null) throw new Error('A desktop anchor is required');
  const images = new Map();
  const files = {};
  for (const breakpoint of Object.keys(sources)) {
    if (PROTOTYPE_KEYS.has(breakpoint)) continue;
    if (!Object.hasOwn(WIDTHS, breakpoint)) throw new Error('Invalid anchor file name');
    const buffer = image(sources[breakpoint]);
    const name = `anchor.${breakpoint}.png`;
    files[name] = { sha256: hash(buffer), bytes: buffer.length, ...dimensions(buffer, WIDTHS[breakpoint], name) };
    images.set(name, buffer);
  }

  const meta = {
    createdAt: new Date().toISOString(),
    goals: own(input, 'goals') ?? null,
    prompt: own(input, 'prompt') ?? null,
    model: own(input, 'model') ?? null,
    files,
    status: 'draft',
    advisor: null,
    approvedBy: null,
    approvedAt: null,
  };
  const cleanMeta = parseJSON(json(meta));

  const root = path.join(projectDir, 'anchors');
  if (!checkDirectory(root)) fs.mkdirSync(root, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(root, '.draft-'));
  try {
    for (const [name, data] of images) writeFile(path.join(temporary, name), data);
    // A concurrent creation can win the rename, so choose a fresh ID on collision.
    while (true) {
      const latest = ids(root).at(-1);
      const next = latest ? BigInt(latest.slice(1)) + 1n : 1n;
      const id = `v${String(next).padStart(3, '0')}`;
      const dir = path.join(root, id);
      replaceFile(temporary, 'meta.json', json({ id, ...cleanMeta }));
      try {
        fs.renameSync(temporary, dir);
      } catch (error) {
        if (['EEXIST', 'ENOTEMPTY'].includes(error.code) && stat(dir)?.isDirectory()) continue;
        throw error;
      }
      syncDirectory(root);
      return { id, dir };
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function readAnchor(projectDir, id) {
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('Invalid anchor ID');
  const root = path.join(projectDir, 'anchors');
  const dir = path.join(root, id);
  if (!checkDirectory(root) || !checkDirectory(dir)) return null;
  const meta = parseJSON(readFile(path.join(dir, 'meta.json')));
  if (!record(meta) || meta.id !== id) throw new Error('Invalid anchor metadata');
  return { dir, meta };
}

function get(projectDir, id) {
  const anchor = readAnchor(projectDir, id);
  if (!anchor) return null;
  const { dir, meta } = anchor;
  const contract = meta.contractSha256 ? parseJSON(readFile(path.join(dir, 'contract.json'))) : null;
  return { ...meta, dir, contract };
}

function list(projectDir) {
  return ids(path.join(projectDir, 'anchors')).map(id => get(projectDir, id));
}

function current(projectDir) {
  for (const id of ids(path.join(projectDir, 'anchors')).reverse()) {
    const { meta } = readAnchor(projectDir, id);
    if (['approved', 'locked'].includes(meta.status)) return get(projectDir, id);
  }
  return null;
}

function requireStatus(projectDir, id, statuses) {
  const anchor = readAnchor(projectDir, id);
  if (!anchor) throw new Error('Anchor not found');
  if (!statuses.includes(anchor.meta.status)) throw new Error(`Anchor is ${anchor.meta.status}`);
  return anchor;
}

function saveMeta({ dir, meta }, changes) {
  const next = { ...meta, ...changes };
  replaceFile(dir, 'meta.json', json(next));
  return next;
}

function setAdvisor(projectDir, id, input) {
  const anchor = requireStatus(projectDir, id, ['draft']);
  const verdict = own(input, 'verdict');
  const score = own(input, 'score');
  const findings = own(input, 'findings');
  if (!['pass', 'revise'].includes(verdict) || !Number.isFinite(score) || !Array.isArray(findings)) {
    throw new Error('Invalid advisor review');
  }
  return saveMeta(anchor, { advisor: parseJSON(json({ verdict, score, findings })) });
}

function manager(input) {
  const by = own(input, 'by');
  if (!['manager', 'owner', 'claude'].includes(by)) throw new Error('Manager authorisation required');
  return by;
}

function requireIntegrity(projectDir, id) {
  const { ok, mismatches } = verify(projectDir, id);
  if (!ok) throw new Error(`Anchor verification failed: ${mismatches.join(', ')}`);
}

function approve(projectDir, id, input) {
  const by = manager(input);
  const anchor = requireStatus(projectDir, id, ['draft']);
  requireIntegrity(projectDir, id);
  return saveMeta(anchor, { status: 'approved', approvedBy: by, approvedAt: new Date().toISOString() });
}

function lock(projectDir, id, contract) {
  const anchor = requireStatus(projectDir, id, ['approved']);
  const clean = parseJSON(json(contract ?? null));
  if (!record(clean) || !record(clean.rules)) {
    throw new Error('A versioned design contract with breakpoint rules is required');
  }
  const { rules, anchorId, anchorSha256, ...base } = clean;
  const validation = validateContract(base);
  if (!validation.ok) throw new Error(`Invalid design contract: ${validation.errors[0].message}`);
  requireIntegrity(projectDir, id);
  const contents = json({ ...base, rules, anchorId: id, anchorSha256: sha256Map(anchor.meta) });
  // The metadata is the commit marker. An interrupted lock can replace its staged contract.
  replaceFile(anchor.dir, 'contract.json', contents);
  return saveMeta(anchor, { status: 'locked', contractSha256: hash(contents) });
}

function supersede(projectDir, id, input) {
  const by = manager(input);
  const anchor = requireStatus(projectDir, id, ['draft', 'approved', 'locked']);
  const reason = own(input, 'reason');
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('A supersede reason is required');
  return saveMeta(anchor, {
    status: 'superseded',
    supersededBy: by,
    supersededAt: new Date().toISOString(),
    supersededReason: reason,
  });
}

function verify(projectDir, id) {
  let anchor;
  try {
    anchor = readAnchor(projectDir, id);
  } catch (error) {
    if (typeof id !== 'string' || !ID.test(id)) throw error;
    return { ok: false, mismatches: ['meta.json'] };
  }
  if (!anchor) return { ok: false, mismatches: ['meta.json'] };
  const { dir, meta } = anchor;
  const mismatches = [];

  function check(name, expectedHash, expectedSize) {
    const file = path.join(dir, name);
    try {
      const entry = stat(file);
      if (entry?.isFile() && (entry.mode & 0o7777) === READ_ONLY
        && (expectedSize === undefined || expectedSize === entry.size)) {
        if (expectedHash === undefined) return true;
        const contents = readFile(file);
        if ((expectedSize === undefined || contents.length === expectedSize) && expectedHash === hash(contents)) {
          return contents;
        }
      }
    } catch {
      // An unreadable file cannot be verified.
    }
    mismatches.push(name);
  }

  check('meta.json');
  if (!record(meta.files) || !Object.hasOwn(meta.files, FILES[0])) {
    if (!mismatches.includes('meta.json')) mismatches.push('meta.json');
    return { ok: false, mismatches };
  }
  for (const [name, details] of Object.entries(meta.files)) {
    if (!FILES.includes(name) || !record(details) || !/^[a-f0-9]{64}$/.test(details.sha256)
      || !Number.isSafeInteger(details.bytes) || details.bytes < 33) {
      mismatches.push(name);
      continue;
    }
    check(name, details.sha256, details.bytes);
  }
  for (const name of FILES) {
    if (!Object.hasOwn(meta.files, name) && stat(path.join(dir, name))) mismatches.push(name);
  }
  if (meta.status === 'locked' || Object.hasOwn(meta, 'contractSha256')) {
    if (typeof meta.contractSha256 === 'string' && /^[a-f0-9]{64}$/.test(meta.contractSha256)) {
      const contents = check('contract.json', meta.contractSha256);
      if (contents) {
        try {
          const { anchorId, anchorSha256 } = parseJSON(contents);
          const hashes = Object.entries(sha256Map(meta));
          if (anchorId !== id || !record(anchorSha256) || Object.keys(anchorSha256).length !== hashes.length
            || hashes.some(([name, digest]) => own(anchorSha256, name) !== digest)) {
            mismatches.push('contract.json');
          }
        } catch {
          mismatches.push('contract.json');
        }
      }
    } else {
      mismatches.push('contract.json');
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

module.exports = { create, list, get, current, setAdvisor, approve, lock, supersede, verify };
