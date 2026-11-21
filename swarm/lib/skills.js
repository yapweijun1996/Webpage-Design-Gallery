'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Staff = require('./staff');

const BUILTINS = path.join(__dirname, '..', 'skills');
const HANDBOOK = path.join(__dirname, '..', 'staff', 'handbook');
const INITIAL_VERSION = '1.0.0';
const MAX_DESCRIPTION = 300;
const MAX_BODY = 8000;
const MAX_HEADER_BYTES = 8192;
const MAX_SKILL_BYTES = MAX_HEADER_BYTES + MAX_BODY * 3 + 16;
const MAX_ASSIGNMENT_BYTES = 64 * 1024;
const SKILL_ID = /^[a-z0-9-]{2,40}$/;
const WORKER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const FRONTMATTER = ['name', 'description', 'version', 'roles', 'enabled', 'tags'];
const PI_IGNORE_FILES = ['.gitignore', '.ignore', '.fdignore'];
const YAML_NONSTRING = /^(?:null|true|false|~|[+-]?(?:\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|0x[\da-f]+|0o[0-7]+|\.inf|\.nan))$/i;
const READ_FLAGS = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

const own = (object, key) => Object.hasOwn(object ?? {}, key) ? object[key] : undefined;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = id => typeof id === 'string' && !PROTOTYPE_KEYS.has(id) && SKILL_ID.test(id);
const validWorker = id => typeof id === 'string' && !PROTOTYPE_KEYS.has(id) && WORKER_ID.test(id);
const validVersion = value => typeof value === 'string' && value.length <= 128 && SEMVER.test(value);
const unique = values => [...new Set(values)];

function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}

function change(operation) {
  try {
    return operation() ?? { ok: true };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
}

function entry(file, type) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat) requireValid(type === 'directory' ? stat.isDirectory() : stat.isFile(),
    `Expected a regular ${type} at ${file}. Symlinks are rejected.`);
  return stat;
}

function projectRoot(projectDir) {
  requireValid(typeof projectDir === 'string' && projectDir.length > 0 &&
    !projectDir.includes('\0') && !projectDir.split(/[/\\]/).includes('..'), 'Invalid project directory.');
  let root = path.resolve(projectDir);
  // macOS provides /tmp and /var as aliases for system directories under /private.
  if (process.platform === 'darwin' && /^\/(tmp|var)(\/|$)/.test(root)) root = '/private' + root;
  const { root: base } = path.parse(root);
  const builtinOwner = entry(path.dirname(BUILTINS), 'directory');
  const builtinRoot = entry(BUILTINS, 'directory');
  const sameDirectory = (left, right) => right && left.dev === right.dev && left.ino === right.ino;
  let directory = base;
  for (const segment of root.slice(base.length).split(path.sep).filter(Boolean)) {
    directory = path.join(directory, segment);
    const stat = entry(directory, 'directory');
    requireValid(stat, 'Project directory does not exist.');
    requireValid(!sameDirectory(stat, builtinRoot) && !(directory === root && sameDirectory(stat, builtinOwner)),
      'Project directory overlaps the builtin skill library.');
  }
  return root;
}

function makeDirectory(dir) {
  if (!entry(dir, 'directory')) fs.mkdirSync(dir, { mode: 0o700 });
}

function readText(file, limit) {
  if (!entry(file, 'file')) return null;
  const fd = fs.openSync(file, READ_FLAGS);
  try {
    const stat = fs.fstatSync(fd);
    requireValid(stat.isFile() && stat.size <= limit, `File exceeds ${limit} bytes or is not regular: ${file}`);
    const buffer = Buffer.allocUnsafe(limit + 1);
    let size = 0;
    while (size <= limit) {
      const count = fs.readSync(fd, buffer, size, buffer.length - size, null);
      if (!count) break;
      size += count;
    }
    requireValid(size <= limit, `File exceeds ${limit} bytes: ${file}`);
    return UTF8.decode(buffer.subarray(0, size));
  } finally {
    fs.closeSync(fd);
  }
}

function writeText(file, text, { exclusive = false, mode = 0o600 } = {}) {
  entry(file, 'file');
  const temporary = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
  const fd = fs.openSync(temporary, 'wx', mode);
  try {
    try {
      fs.writeFileSync(fd, text);
    } finally {
      fs.closeSync(fd);
    }
    if (exclusive) fs.linkSync(temporary, file);
    else fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function positionIds() {
  return new Set(Staff.load().positions.map(position => position.id));
}

// Skill metadata uses scalar fields and lists of strings. Parse only these YAML shapes.
function yamlPlain(value) {
  requireValid(!/^[!&*{}\[|>]/.test(value) && !/:(?:\s|$)/.test(value) && !YAML_NONSTRING.test(value),
    'Invalid YAML string. Quote values that would be parsed as another type.');
  return value;
}

function yamlToken(raw) {
  const token = raw.trimStart();
  const match = token.match(/^(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*')/);
  if (match) {
    const quoted = match[0];
    const value = quoted.startsWith('"') ? JSON.parse(quoted) : quoted.slice(1, -1).replaceAll("''", "'");
    return { value, rest: token.slice(quoted.length).trimStart() };
  }
  requireValid(!/^["']/.test(token), 'Invalid YAML string.');
  const end = token.search(/(?:^|\s)#|[,\]]/);
  const value = yamlPlain((end < 0 ? token : token.slice(0, end)).trimEnd());
  return { value, rest: end < 0 ? '' : token.slice(end).trimStart() };
}

function yamlScalar(raw) {
  const token = raw.trimStart();
  if (!/^["']/.test(token)) {
    return yamlPlain(token.split(/(?:^|[ \t])#/)[0].trimEnd());
  }
  const { value, rest } = yamlToken(token);
  requireValid(!rest || rest.startsWith('#'), 'Invalid YAML scalar.');
  return value;
}

function yamlList(raw, lines) {
  let rest = raw.trimStart();
  if (!rest || rest.startsWith('#')) {
    return lines.map(line => {
      const item = line.match(/^\s*-\s+(.+)$/);
      requireValid(item, 'Invalid YAML list item.');
      return yamlScalar(item[1]);
    });
  }
  requireValid(rest.startsWith('[') && !lines.length, 'Expected a YAML list.');
  const values = [];
  rest = rest.slice(1).trimStart();
  while (!rest.startsWith(']')) {
    const item = yamlToken(rest);
    requireValid(item.rest.startsWith(',') || item.rest.startsWith(']'), 'Invalid YAML list.');
    values.push(item.value);
    rest = item.rest.startsWith(',') ? item.rest.slice(1).trimStart() : item.rest;
  }
  requireValid(/^\]\s*(?:#.*)?$/.test(rest), 'Invalid YAML list.');
  return values;
}

function parseSkill(text) {
  const match = text.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  requireValid(match && Buffer.byteLength(match[0]) <= MAX_HEADER_BYTES, 'Invalid or oversized skill frontmatter.');
  const fields = new Map();
  let field;
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    const item = line.match(/^([a-zA-Z0-9_-]+):[ \t]*(.*)$/);
    if (item) {
      const [, key, raw] = item;
      field = { raw, lines: [] };
      if (FRONTMATTER.includes(key)) {
        requireValid(!fields.has(key), `Duplicate skill field: ${key}.`);
        fields.set(key, field);
      }
    } else {
      requireValid(field && /^(?:[ \t]+|-\s)/.test(line), 'Invalid skill frontmatter.');
      field.lines.push(line);
    }
  }
  const meta = {};
  for (const [key, { raw, lines }] of fields) {
    if (key === 'roles' || key === 'tags') meta[key] = yamlList(raw, lines);
    else if (key === 'description' && /^[>|]-?$/.test(raw)) {
      meta.description = lines.map(line => line.trim()).join(raw[0] === '>' ? ' ' : '\n');
    } else {
      requireValid(!lines.length, `Invalid skill field: ${key}.`);
      if (key === 'enabled') {
        const value = raw.split(/[ \t]+#/)[0].trim();
        requireValid(/^(?:true|false)$/i.test(value), 'Enabled must be a boolean.');
        meta.enabled = value.toLowerCase() === 'true';
      } else meta[key] = yamlScalar(raw);
    }
  }
  // The writer uses one blank line between the header and the exact Markdown body.
  return { meta, body: text.slice(match[0].length).replace(/^\r?\n/, '') };
}

function validateSkill(id, meta, body, positions) {
  requireValid(validId(id) && meta.name === id, 'Skill name must match its lowercase ID (2 to 40 characters).');
  requireValid(typeof meta.description === 'string' && meta.description.trim() &&
    meta.description.length <= MAX_DESCRIPTION, `Description must contain 1 to ${MAX_DESCRIPTION} characters.`);
  requireValid(typeof body === 'string' && body.length <= MAX_BODY, `Body must be Markdown of at most ${MAX_BODY} characters.`);
  requireValid(validVersion(meta.version), 'Version must be valid semver.');
  requireValid(typeof meta.enabled === 'boolean', 'Enabled must be a boolean.');
  requireValid(Array.isArray(meta.roles) && meta.roles.length <= positions.size + 1 &&
    Array.from(meta.roles).every(role => role === '*' || positions.has(role)), 'Roles must be staff position IDs or *.');
  requireValid(Array.isArray(meta.tags) && meta.tags.length <= MAX_HEADER_BYTES &&
    Array.from(meta.tags).every(tag => typeof tag === 'string' && tag.trim()), 'Tags must be a list of nonempty strings.');
}

function encodeSkill(id, meta, body, positions) {
  validateSkill(id, meta, body, positions);
  const header = ['---', ...FRONTMATTER.map(key => `${key}: ${JSON.stringify(meta[key])}`), '---', ''].join('\n');
  requireValid(Buffer.byteLength(header) <= MAX_HEADER_BYTES, 'Skill frontmatter is too large.');
  return `${header}\n${body}`;
}

function loadSkill(root, id, source, positions) {
  if (!root || !entry(root, 'directory')) return null;
  const dir = path.join(root, id);
  if (!entry(dir, 'directory')) return null;
  const text = readText(path.join(dir, 'SKILL.md'), MAX_SKILL_BYTES);
  if (text === null) return null;
  const { meta, body } = parseSkill(text);
  const normalized = { version: INITIAL_VERSION, enabled: true, roles: ['*'], tags: [], ...meta };
  validateSkill(id, normalized, body, positions);
  return { meta: { id, ...normalized, source, bytes: Buffer.byteLength(text) }, body, text, dir };
}

function findSkill(projectDir, id, positions) {
  return loadSkill(projectDir && path.join(projectDir, 'skills'), id, 'project', positions) ??
    loadSkill(BUILTINS, id, 'builtin', positions);
}

function get(id, options) {
  if (!validId(id)) return null;
  try {
    const projectDir = own(options, 'projectDir');
    const skill = findSkill(projectDir === undefined ? undefined : projectRoot(projectDir), id, positionIds());
    return skill ? { meta: skill.meta, body: skill.body } : null;
  } catch {
    return null;
  }
}

function list(options) {
  try {
    const projectDir = own(options, 'projectDir');
    const roots = [BUILTINS];
    const root = projectDir === undefined ? undefined : projectRoot(projectDir);
    if (root) roots.push(path.join(root, 'skills'));
    const ids = unique(roots.flatMap(dir => entry(dir, 'directory') ? fs.readdirSync(dir).filter(validId) : [])).sort();
    const positions = positionIds();
    return ids.flatMap(id => {
      try {
        const skill = findSkill(root, id, positions);
        if (!skill) return [];
        const { tags, ...meta } = skill.meta;
        return [meta];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function bumpPatch(version) {
  const [, major, minor, patch] = version.match(SEMVER);
  return `${major}.${minor}.${BigInt(patch) + 1n}`;
}

function saveProject(root, id, current, meta, body, positions) {
  const text = encodeSkill(id, meta, body, positions);
  const skills = path.join(root, 'skills');
  const dir = path.join(skills, id);
  makeDirectory(skills);
  makeDirectory(dir);
  if (current) {
    const history = path.join(dir, '.history');
    makeDirectory(history);
    const previous = path.join(history, `${current.meta.version}.md`);
    const existing = readText(previous, MAX_SKILL_BYTES);
    if (existing === null) writeText(previous, current.text, { exclusive: true });
    else requireValid(existing === current.text, 'Existing skill history conflicts with the current version.');
  }
  writeText(path.join(dir, 'SKILL.md'), text);
}

function save(options) {
  return change(() => {
    const { projectDir, id, description, body, roles, enabled, version, tags } = { ...options };
    requireValid(validId(id), 'Invalid skill ID.');
    requireValid(version === undefined || validVersion(version), 'Version must be valid semver.');
    const root = projectRoot(projectDir);
    const positions = positionIds();
    const current = findSkill(root, id, positions);
    saveProject(root, id, current, {
      name: id,
      description,
      version: current ? bumpPatch(current.meta.version) : version ?? INITIAL_VERSION,
      roles: roles === undefined ? current?.meta.roles ?? ['*'] : roles,
      enabled: enabled === undefined ? current?.meta.enabled ?? true : enabled,
      tags: tags === undefined ? current?.meta.tags ?? [] : tags,
    }, body, positions);
  });
}

function setEnabled(options) {
  return change(() => {
    const { projectDir, id, enabled } = { ...options };
    requireValid(validId(id), 'Invalid skill ID.');
    requireValid(typeof enabled === 'boolean', 'Enabled must be a boolean.');
    const root = projectRoot(projectDir);
    const positions = positionIds();
    const current = findSkill(root, id, positions);
    requireValid(current, 'Skill does not exist.');
    if (current.meta.enabled !== enabled) {
      const meta = { ...current.meta, enabled, version: bumpPatch(current.meta.version) };
      saveProject(root, id, current, meta, current.body, positions);
    }
  });
}

function checkTree(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    requireValid(item.isDirectory() || item.isFile(), 'Skill directory contains a symlink or special file.');
    if (item.isDirectory()) checkTree(path.join(dir, item.name));
  }
}

function remove(options) {
  return change(() => {
    const { projectDir, id } = { ...options };
    requireValid(validId(id), 'Invalid skill ID.');
    const root = projectRoot(projectDir);
    const current = loadSkill(path.join(root, 'skills'), id, 'project', positionIds());
    requireValid(current, 'Only a project skill or override can be removed.');
    checkTree(current.dir);
    fs.rmSync(current.dir, { recursive: true });
  });
}

function readAssignments(root, positions) {
  const byPosition = {};
  const byWorker = {};
  const text = root ? readText(path.join(root, 'skills.json'), MAX_ASSIGNMENT_BYTES) : null;
  if (text === null) return { byPosition, byWorker };
  const overrides = JSON.parse(text, (key, value) => PROTOTYPE_KEYS.has(key) ? undefined : value);
  requireValid(isRecord(overrides), 'Invalid skill assignments.');
  for (const [key, target, validKey] of [
    ['byPosition', byPosition, id => positions.has(id)], ['byWorker', byWorker, validWorker],
  ]) {
    const values = own(overrides, key);
    if (values === undefined) continue;
    requireValid(isRecord(values), 'Invalid skill assignment map.');
    for (const id of Object.keys(values).sort().filter(validKey)) {
      requireValid(Array.isArray(values[id]), 'Invalid skill assignment list.');
      target[id] = unique(values[id].filter(validId));
    }
  }
  return { byPosition, byWorker };
}

function effectiveAssignments(root, staff, positions) {
  const { byPosition, byWorker } = readAssignments(root, positions);
  return {
    byPosition: Object.fromEntries(staff.map(({ id, skills }) => [id, own(byPosition, id) ?? unique(skills)])),
    byWorker,
  };
}

function assignments(options) {
  try {
    const projectDir = own(options, 'projectDir');
    const root = projectDir === undefined ? undefined : projectRoot(projectDir);
    const staff = Staff.load().positions;
    return effectiveAssignments(root, staff, new Set(staff.map(role => role.id)));
  } catch {
    return { byPosition: {}, byWorker: {} };
  }
}

function assign(options) {
  return change(() => {
    const { projectDir, target, ids } = { ...options };
    const root = projectRoot(projectDir);
    const positions = positionIds();
    const position = own(target, 'position');
    const worker = own(target, 'worker');
    const forPosition = position !== undefined;
    requireValid(forPosition ? positions.has(position) && worker === undefined : validWorker(worker),
      'Target must be exactly one staff position or worker ID.');
    requireValid(Array.isArray(ids) && ids.length <= MAX_ASSIGNMENT_BYTES / 2 && Array.from(ids).every(validId),
      'Expected a list of valid skill IDs.');
    const selected = unique(ids);
    for (const id of selected) requireValid(findSkill(root, id, positions), `Unknown skill: ${id}.`);
    const stored = readAssignments(root, positions);
    if (forPosition) stored.byPosition[position] = selected;
    else stored.byWorker[worker] = selected;
    const text = JSON.stringify(stored, (key, value) => isRecord(value)
      ? Object.fromEntries(Object.keys(value).sort().map(id => [id, value[id]])) : value, 2) + '\n';
    requireValid(Buffer.byteLength(text) <= MAX_ASSIGNMENT_BYTES, 'Skill assignments are too large.');
    writeText(path.join(root, 'skills.json'), text);
  });
}

function resolve(options) {
  const result = { dirs: [], text: '', ids: [] };
  try {
    const { projectDir, workerId, position, runner, budget = 3000 } = { ...options };
    const root = projectDir === undefined ? undefined : projectRoot(projectDir);
    const staff = Staff.load().positions;
    const positions = new Set(staff.map(role => role.id));
    const { byPosition, byWorker } = effectiveAssignments(root, staff, positions);
    const positionSkills = positions.has(position) ? own(byPosition, position) ?? [] : [];
    const workerSkills = validWorker(workerId) ? own(byWorker, workerId) ?? [] : [];
    const skills = unique([...positionSkills, ...workerSkills]).flatMap(id => {
      try {
        const skill = findSkill(root, id, positions);
        if (!skill?.meta.enabled || !(skill.meta.roles.includes('*') || skill.meta.roles.includes(position))) return [];
        if (runner === 'pi') {
          // Pi reads these files before it opens SKILL.md.
          for (const filename of PI_IGNORE_FILES) {
            const stat = entry(path.join(skill.dir, filename), 'file');
            requireValid(!stat || stat.size <= MAX_SKILL_BYTES, 'Skill ignore file is too large.');
          }
        }
        return [skill];
      } catch {
        return [];
      }
    });
    result.ids = skills.map(skill => skill.meta.id);
    if (runner === 'pi') result.dirs = skills.map(skill => skill.dir);

    const limit = Number.isFinite(budget) ? Math.max(0, Math.floor(budget)) : 3000;
    for (const [index, skill] of skills.entries()) {
      // Share the remaining room so one long handbook pack cannot hide the later skills.
      const remaining = limit - result.text.length;
      const prefix = `${result.text ? '\n\n' : ''}## Skill: ${skill.meta.id}\n`;
      const share = Math.max(prefix.length, Math.floor(remaining / (skills.length - index)));
      if (prefix.length > remaining) break;
      const body = skill.body.trim().slice(0, Math.min(share, remaining) - prefix.length).replace(/[\uD800-\uDBFF]$/, '');
      result.text += prefix + body.trimEnd();
    }
  } catch {
    // An invalid project or assignment file never turns into a global skill selection.
  }
  return result;
}

function migrate() {
  return change(() => {
    const staff = Staff.load().positions;
    const positions = new Set(staff.map(role => role.id));
    requireValid(entry(HANDBOOK, 'directory'), 'Staff handbook does not exist.');
    makeDirectory(BUILTINS);
    const created = [];
    for (const file of fs.readdirSync(HANDBOOK).sort()) {
      const id = path.basename(file, '.md');
      if (!file.endsWith('.md') || !validId(id)) continue;
      const dir = path.join(BUILTINS, id);
      const destination = path.join(dir, 'SKILL.md');
      makeDirectory(dir);
      if (entry(destination, 'file')) continue;
      const body = readText(path.join(HANDBOOK, file), MAX_SKILL_BYTES);
      const purpose = body.match(/^## Purpose\r?\n\s*([\s\S]+?)(?=\r?\n## )/m)?.[1]
        .replace(/\\\s+|\s+/g, ' ').trim();
      requireValid(purpose, `Missing handbook purpose: ${id}.`);
      const description = `Use this skill to ${purpose[0].toLowerCase()}${purpose.slice(1)}`;
      const roles = staff.filter(role => role.skills.includes(id)).map(role => role.id);
      const meta = { name: id, description, version: INITIAL_VERSION, roles, enabled: true, tags: [] };
      writeText(destination, encodeSkill(id, meta, body, positions), { exclusive: true, mode: 0o644 });
      created.push(id);
    }
    return { ok: true, created };
  });
}

module.exports = { list, get, save, setEnabled, remove, assignments, assign, resolve, migrate };
