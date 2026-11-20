'use strict';

const { ALLOWLIST } = require('./settings');
const { positions } = require('../staff/staff.json');

const TEXT_LIMITS = { name: 40, title: 60, lane: 400 };
const LIMITS = Object.freeze({ maxWorkers: 16, ...TEXT_LIMITS });
const ID_PATTERN = /^(?:0[1-9]|[1-9][0-9])$/;
const FORMATS = {
  id: [ID_PATTERN, 'Expected a two-digit worker ID from 01 to 99.'],
  section: [/^[a-z][a-z0-9-]{1,24}$/, 'Expected 2 to 25 lowercase letters, digits, or hyphens, starting with a letter.'],
  color: [/^#[0-9a-f]{6}$/i, 'Expected a six-digit hex colour such as #f76b15.'],
};
const POSITION_IDS = new Set(positions.map(position => position.id));
const DIFF_FIELDS = ['name', 'title', 'section', 'lane', 'color', 'runner', 'model', 'effort', 'position'];

// The accents have at least 4.5:1 contrast against the Settings dark surfaces.
const COLOURS = [
  '#fb7185', '#60a5fa', '#facc15', '#34d399', '#c084fc', '#fb923c', '#22d3ee', '#f472b6',
  '#84cc16', '#a5b4fc', '#fdba74', '#2dd4bf', '#fda4af', '#94a3b8', '#d8b4fe', '#67e8f9',
];

function ownValue(record, key) {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function validate(input, { allowlist = ALLOWLIST, existing = [] } = {}) {
  const errors = [];
  const value = [];
  const reject = (path, message) => errors.push({ path, message });

  if (!Array.isArray(input)) {
    reject('agents', 'Expected an array of workers.');
    return { ok: false, errors, value };
  }
  if (input.length < 1 || input.length > LIMITS.maxWorkers) {
    reject('agents', `Expected 1 to ${LIMITS.maxWorkers} workers.`);
    return { ok: false, errors, value };
  }

  const selections = {
    runner: Object.keys(allowlist.runners),
    model: Object.keys(allowlist.models),
    effort: allowlist.efforts,
  };
  const existingSections = new Map(existing.map(({ id, section }) => [id, section]));
  const seenIds = new Set();
  const seenSections = new Set();

  for (const [index, worker] of input.entries()) {
    const location = `agents[${index}]`;
    if (worker === null || typeof worker !== 'object' || Array.isArray(worker)) {
      reject(location, 'Expected a worker object.');
      continue;
    }

    const agent = {};
    for (const [key, [pattern, message]] of Object.entries(FORMATS)) {
      const field = ownValue(worker, key);
      if (typeof field === 'string' && pattern.test(field)) agent[key] = field;
      else reject(`${location}.${key}`, message);
    }
    for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
      const field = ownValue(worker, key);
      const cleaned = typeof field === 'string' ? field.replace(/\p{Cc}/gu, '') : '';
      if (cleaned.length >= 1 && cleaned.length <= limit) agent[key] = cleaned;
      else reject(`${location}.${key}`, `Expected 1 to ${limit} characters.`);
    }
    for (const [key, allowed] of Object.entries(selections)) {
      if (!Object.hasOwn(worker, key)) continue;
      if (allowed.includes(worker[key])) agent[key] = worker[key];
      else reject(`${location}.${key}`, `Expected one of ${allowed.join(', ')}.`);
    }
    if (Object.hasOwn(worker, 'position')) {
      if (POSITION_IDS.has(worker.position)) agent.position = worker.position;
      else reject(`${location}.position`, 'Expected an ID from the staff roster.');
    }

    const { id, section } = agent;
    if (id !== undefined) {
      if (seenIds.has(id)) reject(`${location}.id`, 'Duplicate worker ID.');
      seenIds.add(id);
    }
    if (section !== undefined) {
      if (seenSections.has(section)) reject(`${location}.section`, 'Duplicate worker section.');
      seenSections.add(section);
      if (existingSections.has(id) && existingSections.get(id) !== section) {
        reject(`${location}.section`, `Cannot change the section of existing worker ${id}.`);
      }
    }
    value.push(agent);
  }

  return { ok: errors.length === 0, errors, value };
}

function nextId(agents) {
  const highest = agents.reduce((max, { id }) => Math.max(max, Number(id)), 0);
  if (highest >= 99) throw new RangeError('No worker IDs are available above 99.');
  return String(highest + 1).padStart(2, '0');
}

function diff(oldAgents, newAgents) {
  const oldById = new Map(oldAgents.map(agent => [agent.id, agent]));
  const newById = new Map(newAgents.map(agent => [agent.id, agent]));
  const ids = [...new Set([...oldById.keys(), ...newById.keys()])].sort();
  const added = [];
  const removed = [];
  const changed = [];

  for (const id of ids) {
    const before = oldById.get(id);
    const after = newById.get(id);
    if (!before) added.push(after);
    else if (!after) removed.push(before);
    else {
      const fields = DIFF_FIELDS.filter(key => before[key] !== after[key]);
      if (fields.length) changed.push({ id, fields });
    }
  }

  return { added, removed, changed };
}

function palette(index) {
  return COLOURS[((index % COLOURS.length) + COLOURS.length) % COLOURS.length];
}

function view(agents, staffPositions = []) {
  const titles = staffPositions.map(position => position?.title)
    .filter(title => typeof title === 'string' && title.length > 0);
  return { agents, titles: [...new Set(titles)].sort() };
}

module.exports = { LIMITS, validate, nextId, diff, palette, view };
