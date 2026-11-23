'use strict';

const { LAYERS, layerFile, parseSectionFile } = require('./layers');
const { ownedGlobs } = require('./squad');

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const SECTION = /^\d{2}-[\w-]+$/;
const WORKER = /^[a-z0-9_-]+$/;
const SHARED = ['CONTRACT.md', 'brief.md', 'contract.json', 'decisions.md', 'design-system/*',
  'direction.md', 'research.md', 'review.md', 'review1.md', 'review2.md', 'tokens.css'];
const FORBIDDEN = ['.git/*', '.run/*', 'agents.json', 'anchors/*', 'ownership.json'];
const LAUNCH_SHARED = ['channel.md', 'discussion/*', 'i18n/*', 'inbox/*', 'notes/*', 'staff/*'];
const LAUNCH_FORBIDDEN = ['.launch-skills/*', 'channel.jsonl', 'chat/00.jsonl', 'chat/.offsets.json', 'dist/*',
  'integration/*', 'names.json', 'skills.json', 'skills/*'];
const MANAGER_FILES = ['direction.md', 'decisions.md', 'research.md', 'review.md', 'review1.md', 'review2.md'];

function isSafePath(relative) {
  return typeof relative === 'string' && !/[\\:\x00-\x1f\x7f]/.test(relative)
    && relative.split('/').every(part => part && part !== '.' && part !== '..'
      && !RESERVED.has(part.toLowerCase()));
}

function workerId(id) {
  if (typeof id !== 'string' || !WORKER.test(id) || !isSafePath(id)) {
    throw new Error(`Invalid worker ID: ${String(id)}`);
  }
  return id;
}

function sectionBase(value) {
  const name = typeof value === 'string' ? value.replace(/^sections\//, '') : value?.id;
  const base = parseSectionFile(name)?.base ?? name;
  if (typeof base !== 'string' || !SECTION.test(base) || !isSafePath(base)) {
    throw new Error(`Invalid section: ${String(name)}`);
  }
  return base;
}

function build({ agents = [], squad = [], sections = [], launchContext = false } = {}) {
  const modules = new Set(sections.map(sectionBase));
  const workers = new Set();
  const claims = new Map();
  const primary = new Set();

  function addWorker(value, manager = false) {
    const id = workerId(value);
    if (launchContext && id === '00' && !manager) throw new Error('Worker ID 00 is reserved for the Manager.');
    if (workers.has(id)) throw new Error(`Duplicate worker ID: ${id}`);
    workers.add(id);
    if (manager) {
      for (const file of MANAGER_FILES) claims.set(file, id);
    } else {
      claims.set(`notes/${id}.md`, id);
      claims.set(`chat/${id}.jsonl`, id);
      if (launchContext) claims.set(`discussion/${id}.md`, id);
    }
    return id;
  }

  for (const agent of agents) {
    if (agent.id === '00' && !agent.section) {
      if (launchContext) addWorker(agent.id, true);
      continue;
    }
    const id = addWorker(agent.id);
    const section = agent.section;
    if (typeof section !== 'string' || !section) throw new Error(`Missing section for worker ${id}`);
    const base = sectionBase(SECTION.test(section) ? section : `${id}-${section}`);
    if (primary.has(base)) throw new Error(`Duplicate section for worker ${id}`);
    primary.add(base);
    modules.add(base);
    claims.set(`sections/${base}.html`, id);
    claims.set(`sections/${base}.css`, id);
    for (const layer of LAYERS) claims.set(`sections/${layerFile(base, layer)}`, id);
    claims.set(`assets/generated/${base}-*`, id);
  }

  const specialists = new Map();
  const members = Array.isArray(squad) ? squad : squad?.members ?? [];
  for (const member of members) {
    const id = addWorker(member.id);
    const base = sectionBase(member.base ?? squad?.base ?? member.section ?? (modules.size === 1 ? [...modules][0] : null));
    if (!modules.has(base)) throw new Error(`Unknown squad section: ${base}`);
    for (const glob of ownedGlobs(member.squad ?? member, base)) {
      if (specialists.has(glob)) throw new Error(`Duplicate squad ownership: ${glob}`);
      specialists.set(glob, id);
    }
  }
  // The active squad takes over its exact paths. The section worker keeps legacy CSS and unassigned layers.
  for (const [glob, id] of specialists) claims.set(glob, id);

  return {
    sections: [...modules].sort(),
    workers: [...workers].sort(),
    owned: Object.fromEntries([...claims.keys()].sort().map(glob => [glob, claims.get(glob)])),
    shared: launchContext ? [...SHARED, ...LAUNCH_SHARED] : [...SHARED],
    forbidden: launchContext ? [...FORBIDDEN, ...LAUNCH_FORBIDDEN] : [...FORBIDDEN],
    ...(launchContext ? { launchContext: true } : {}),
  };
}

function matchesTree(glob, relative) {
  if (!glob.endsWith('/*')) return relative === glob;
  const root = glob.slice(0, -2);
  return relative === root || relative.startsWith(`${root}/`);
}

function classify(manifest, id, relative) {
  if (!isSafePath(relative)) return 'forbidden';
  const key = relative.toLowerCase();
  if (FORBIDDEN.some(glob => matchesTree(glob, key)) ||
      (manifest.launchContext && LAUNCH_FORBIDDEN.some(glob => matchesTree(glob, key)))) return 'forbidden';
  if (typeof id !== 'string' || !isSafePath(id)) return 'foreign';

  let owner;
  if (Object.hasOwn(manifest.owned, relative)) {
    owner = manifest.owned[relative];
  } else {
    // Image specialist globs with an extension outrank the section's general asset prefix.
    let specificity = 0;
    for (const [glob, worker] of Object.entries(manifest.owned)) {
      const wildcard = glob.indexOf('*');
      if (wildcard === -1 || glob.length <= specificity) continue;
      const prefix = glob.slice(0, wildcard);
      const suffix = glob.slice(wildcard + 1);
      if (relative.length >= prefix.length + suffix.length && relative.startsWith(prefix)
        && relative.endsWith(suffix) && !relative.slice(prefix.length).includes('/')) {
        [owner, specificity] = [worker, glob.length];
      }
    }
  }
  if (owner !== undefined) return owner === id ? 'owned' : 'foreign';
  return SHARED.some(glob => matchesTree(glob, relative)) ||
    (manifest.launchContext && LAUNCH_SHARED.some(glob => matchesTree(glob, relative))) ? 'shared' : 'foreign';
}

function approvalRequired(manifest, id, changes) {
  const { added = [], changed = [], removed = [] } = changes;
  const items = Array.isArray(changes) ? changes : [...added, ...changed, ...removed];
  const reasons = [];
  for (const relative of new Set(items.map(item => typeof item === 'string' ? item : item.path))) {
    const code = classify(manifest, id, relative);
    if (code !== 'owned') reasons.push({ code, path: relative });
  }
  return { required: reasons.length > 0, reasons };
}

module.exports = { build, classify, approvalRequired, isSafePath };
