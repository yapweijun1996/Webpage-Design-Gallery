'use strict';

const fs = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const { Violation, directory, entry, projectRoot, readFile, stageFile } = require('./project-files');

const STORE = '.run/shared-proposals';
const REQUEST = 'token-proposal.json';
const ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SHA = /^[a-f0-9]{64}$/;
const hash = data => createHash('sha256').update(data).digest('hex');
const invalid = message => new Violation('proposal', REQUEST, message);
const nameOf = id => {
  if (typeof id !== 'string' || !ID.test(id)) throw invalid('Unknown style proposal.');
  return `${STORE}/${id}.json`;
};

const VALUE_FUNCTIONS = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'var', 'calc', 'clamp', 'min', 'max', 'cubic-bezier']);

function validValue(value) {
  if (typeof value !== 'string' || !value || value.length > 256 || value !== value.trim() ||
      !/^[\w#,%.+() /"'-]+$/.test(value)) return false;
  const plain = value.replace(/"[^"()]*"|'[^'()]*'/g, '');
  if (/["']/.test(plain)) return false;
  for (const [, name] of plain.matchAll(/([\w-]+)\s*\(/g)) {
    if (!VALUE_FUNCTIONS.has(name.toLowerCase())) return false;
  }
  let depth = 0;
  for (const ch of plain) {
    if (ch === '(') depth++;
    if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

// A proposal can replace values of existing custom properties. Preserve selectors,
// media queries, declaration order and every byte surrounding the selected values.
function applyEdits(css, edits) {
  if (!Array.isArray(edits) || !edits.length || edits.length > 32) throw invalid('Propose between 1 and 32 token value changes.');
  const mask = css.replace(/\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,
    part => (part.startsWith('/*') ? ' ' : 'x').repeat(part.length));
  const declarations = new Map();
  for (const m of mask.matchAll(/(?<=[{;])\s*(--[\w-]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    const start = m.index + m[0].length - m[2].length;
    const list = declarations.get(m[1]) || [];
    list.push({ start, end: start + m[2].trimEnd().length });
    declarations.set(m[1], list);
  }
  const replacements = new Map();
  for (const edit of edits) {
    if (!edit || typeof edit !== 'object' || Array.isArray(edit) ||
        Object.keys(edit).some(key => !['name', 'occurrence', 'value'].includes(key))) throw invalid('Invalid token edit.');
    const occurrence = edit.occurrence === undefined ? 0 : edit.occurrence;
    const value = edit.value;
    const position = Number.isSafeInteger(occurrence) && occurrence >= 0 && declarations.get(edit.name)?.[occurrence];
    if (!position || replacements.has(position.start) || !validValue(value)) {
      throw invalid('Choose an existing token occurrence and a valid CSS token value.');
    }
    replacements.set(position.start, { ...position, value });
  }
  let result = css;
  for (const { start, end, value } of [...replacements.values()].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, start) + value + result.slice(end);
  }
  if (result === css) throw invalid('The proposal leaves all token values unchanged.');
  return result;
}

function takeRequest(ws, { sectionId, workerId, appearance, anchor, projectId }) {
  const root = projectRoot(ws.dir);
  const req = readFile(root, REQUEST, { maxBytes: 16384 });
  if (!req) return null;
  let edits;
  try { edits = JSON.parse(req.data.toString('utf8')); }
  catch { throw invalid('Write the token proposal as a JSON array.'); }
  const css = readFile(root, 'tokens.css', { maxBytes: 64 * 1024 });
  if (!css || css.sha256 !== ws.base['tokens.css']?.sha256) throw invalid('Propose edits against the original shared stylesheet.');
  const before = css.data.toString('utf8');
  if (!Buffer.from(before).equals(css.data)) throw invalid('The shared stylesheet must contain valid UTF-8.');
  const after = applyEdits(before, edits);
  fs.unlinkSync(entry(root, REQUEST).file);
  return { id: randomUUID(), projectId, sectionId, workerId, createdAt: new Date().toISOString(),
    appearance, anchor, before, after, baseHash: css.sha256 };
}

function revision(record) {
  const { status, decision, reviewRevision, ...review } = record;
  return hash(JSON.stringify(review));
}

function recordFile(project, record) {
  const relative = nameOf(record.id);
  const data = Buffer.from(JSON.stringify(record));
  return { relative, before: readFile(project, relative), after: { data, mode: 0o600 } };
}

function pendingFile(project, draft) {
  const current = readFile(project, 'tokens.css', { hashOnly: true });
  if (current?.sha256 !== draft.baseHash) throw invalid('Shared tokens changed during this turn. Request a fresh proposal.');
  const record = { ...draft, baseMode: current.mode, status: 'pending' };
  record.reviewRevision = revision(record);
  const file = recordFile(project, record);
  if (file.before) throw invalid('The proposal already exists.');
  return file;
}

function get(project, id) {
  const stored = readFile(project, nameOf(id));
  if (!stored) return null;
  const record = JSON.parse(stored.data);
  if (record.id !== id || record.reviewRevision !== revision(record)) throw invalid('The stored proposal failed verification.');
  return record;
}

function list(project) {
  const store = entry(project, STORE);
  if (!store.stat) return [];
  return fs.readdirSync(store.file).filter(name => name.endsWith('.json') && ID.test(name.slice(0, -5)))
    .map(name => get(project, name.slice(0, -5))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function save(project, record) {
  record.reviewRevision = revision(record);
  const dest = entry(project, nameOf(record.id)).file;
  const temp = dest + '.' + randomUUID();
  try {
    fs.writeFileSync(temp, JSON.stringify(record), { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, dest);
  } finally { fs.rmSync(temp, { force: true }); }
  return record;
}

function saveEvidence(project, id, evidence) {
  const relative = `${STORE}/${id}`;
  directory(project, relative);
  const manifest = {};
  function store(data) {
    if (!Buffer.isBuffer(data) || !data.length) throw invalid('Missing visual evidence.');
    const digest = hash(data);
    const file = `${relative}/${digest}.png`;
    if (!entry(project, file).stat) stageFile(project, file, { data, mode: 0o600 });
    return digest;
  }
  function pair(sample, optional = false) {
    const side = data => optional && data === null ? null : store(data);
    return { before: side(sample.before), after: side(sample.after) };
  }
  for (const [width, sample] of Object.entries(evidence)) {
    manifest[width] = { ...pair(sample), sections: Object.fromEntries(
      Object.entries(sample.sections || {}).map(([id, evidence]) => [id, pair(evidence, true)])) };
  }
  return manifest;
}

function image(project, record, width, side, section) {
  const sample = record?.images?.[width];
  const digest = (section ? sample?.sections?.[section] : sample)?.[side];
  if (typeof digest !== 'string' || !SHA.test(digest)) return null;
  const file = readFile(project, `${STORE}/${record.id}/${digest}.png`);
  return file?.sha256 === digest ? file.data : null;
}

function publicRecord(record) {
  const { images, inputs, baseMode, ...rest } = record;
  return rest;
}

module.exports = { takeRequest, pendingFile, revision, get, list, save, saveEvidence, image, recordFile, publicRecord };
