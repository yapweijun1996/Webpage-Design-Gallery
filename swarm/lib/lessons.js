'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');

const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set(['verified', 'proposed']);
const SECRET_PATTERNS = [
  /\b(?:sk-|sk_(?:live|test)_|gh[pousr]_|github_pat_)[a-z0-9_-]{8,}/i,
  /\bbearer\s+[a-z0-9._~+/=-]{8,}/i,
  /(?:^|[^a-z0-9])(?:0x)?[a-f0-9]{32,}(?![a-z0-9])/i,
  /password\s*=/i,
  /(?:^|[^a-z0-9])(?:api[_-]?key|access[_-]?token)\s*[:=]\s*["']?[a-z0-9._~+/=-]{8,}/i,
];
const LOCK_TIMEOUT_MS = 5_000;
const lockWait = new Int32Array(new SharedArrayBuffer(4));

const isText = value => typeof value === 'string' && value.trim().length > 0;

function validTags(tags) {
  return Array.isArray(tags) && Array.from(tags).every(tag => (
    typeof tag === 'string' && tag === tag.trim() && TAG.test(tag)
  ));
}

function validate({ title, text, evidence, tags, status, supersedes }) {
  if (!isText(title) || !isText(text)) throw new TypeError('Lesson title and text must be non-empty');
  if (!Array.isArray(evidence) || !evidence.length || !Array.from(evidence).every(isText)) {
    throw new TypeError('Lesson evidence must contain one or more non-empty strings');
  }
  if (!validTags(tags)) throw new TypeError('Lesson tags must be an array of lowercase slugs');
  if (!STATUSES.has(status)) throw new TypeError('Lesson status must be verified or proposed');
  if (supersedes !== undefined && !isText(supersedes)) throw new TypeError('Invalid supersedes ID');
  const content = [title, text, ...evidence, ...tags, supersedes ?? ''];
  if (content.some(value => SECRET_PATTERNS.some(pattern => pattern.test(value)))) {
    throw new TypeError('Lesson contains secret-looking content');
  }
}

function logFile(projectDir, create = false) {
  const directory = path.join(projectDir, 'lessons');
  if (create) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const entry = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (entry && !entry.isDirectory()) throw new Error('Invalid lessons directory');
  return path.join(directory, 'lessons.jsonl');
}

function readLog(file) {
  const entry = fs.lstatSync(file, { throwIfNoEntry: false });
  if (entry && !entry.isFile()) throw new Error('Invalid lessons log');
  try {
    return fs.readFileSync(file, { flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return Buffer.alloc(0);
  }
}

function entriesFrom(log) {
  const entries = new Map();
  for (const line of log.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const { id, ts, title, text, evidence, tags, status, supersedes } = JSON.parse(line);
      if (!isText(id) || !isText(ts) || !Number.isFinite(Date.parse(ts)) || entries.has(id)) continue;
      const entry = { id, ts, title, text, evidence, tags, status };
      if (supersedes !== undefined) entry.supersedes = supersedes;
      validate(entry);
      entries.set(id, entry);
    } catch (error) {
      if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
      // A damaged record must not hide the rest of the log.
    }
  }
  return entries;
}

function acquireLock(lock) {
  const deadline = performance.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (performance.now() >= deadline) throw new Error('Timed out waiting for the lessons log lock');
      Atomics.wait(lockWait, 0, 0, 10);
    }
  }
}

function append(file, log, entry) {
  const temporary = path.join(path.dirname(file), `.${entry.id}.tmp`);
  const separator = log.length && log.at(-1) !== 0x0a ? '\n' : '';
  const line = Buffer.from(`${separator}${JSON.stringify(entry)}\n`);
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    try {
      fs.writeFileSync(fd, log);
      fs.writeFileSync(fd, line);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function add(projectDir, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Lesson input is required');
  const { title, text, evidence, tags = [], status = 'proposed', supersedes } = input;
  validate({ title, text, evidence, tags, status, supersedes });
  const file = logFile(projectDir, true);
  const lock = `${file}.lock`;
  // Hold the lock across reading and renaming so concurrent writers cannot lose an append.
  acquireLock(lock);
  try {
    const log = readLog(file);
    const previous = supersedes?.trim();
    if (previous !== undefined && !entriesFrom(log).has(previous)) throw new Error('Unknown supersedes ID');
    const entry = {
      id: randomUUID(), ts: new Date().toISOString(), title: title.trim(), text: text.trim(),
      evidence: evidence.map(item => item.trim()), tags: [...new Set(tags)], status,
    };
    if (previous !== undefined) entry.supersedes = previous;
    append(file, log, entry);
    return entry;
  } finally {
    fs.rmdirSync(lock);
  }
}

function list(projectDir) {
  return [...entriesFrom(readLog(logFile(projectDir))).values()];
}

function search(projectDir, keywords) {
  const terms = Array.isArray(keywords) ? keywords : [keywords];
  const query = [...new Set(terms.filter(isText).flatMap(term => term.toLowerCase().trim().split(/\s+/)))];
  const entries = list(projectDir).reverse();
  if (!query.length) return entries;
  return entries.map(entry => {
    const title = entry.title.toLowerCase();
    const text = entry.text.toLowerCase();
    let score = 0;
    for (const term of query) {
      if (title.includes(term)) score += 3;
      if (entry.tags.some(tag => tag.includes(term))) score += 2;
      if (text.includes(term)) score += 1;
    }
    return { entry, score };
  }).filter(result => result.score > 0).sort((left, right) => right.score - left.score).map(result => result.entry);
}

function forPrompt(projectDir, { tags = [], budget = 3000 } = {}) {
  if (!validTags(tags)) throw new TypeError('Lesson tags must be an array of lowercase slugs');
  if (!Number.isSafeInteger(budget) || budget < 0) throw new TypeError('Prompt budget must be a non-negative integer');
  if (!budget) return '';

  const entries = entriesFrom(readLog(logFile(projectDir)));
  const verified = [...entries.values()].reverse().filter(entry => entry.status === 'verified');
  const superseded = new Set();
  // Only verified corrections retire earlier lessons, including across intervening proposals.
  for (const entry of verified) {
    let previous = entry.supersedes;
    while (previous !== undefined && !superseded.has(previous)) {
      superseded.add(previous);
      previous = entries.get(previous)?.supersedes;
    }
  }
  const wanted = new Set(tags);
  let prompt = '';
  for (const entry of verified) {
    if (superseded.has(entry.id) || (wanted.size && !entry.tags.some(tag => wanted.has(tag)))) continue;
    const line = `${prompt ? '\n' : ''}- ${entry.title}: ${entry.text}`;
    if (prompt.length + line.length <= budget) prompt += line;
  }
  return prompt;
}

function createLessons(projectDir) {
  return {
    add: input => add(projectDir, input),
    list: () => list(projectDir),
    search: keywords => search(projectDir, keywords),
    forPrompt: options => forPrompt(projectDir, options),
  };
}

module.exports = { createLessons, add, list, search, forPrompt };
