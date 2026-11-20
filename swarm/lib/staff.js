'use strict';

// Agent 00 staffs art direction, shared roles list worker IDs in arrays, and review lenses use the page crew.
// An explicit position takes precedence over agent lookup. An unresolved position yields an empty preamble.

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STAFF_DIR = path.join(__dirname, '..', 'staff');
const PACKS = new Set([
  'ui-ux-core', 'typography-layout', 'color-theme', 'accessibility', 'motion-loader',
  'i18n-content', 'pwa-performance', 'tokens-ssot', 'components-engineering', 'qa-verification',
]);
const POSITION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PREAMBLE = 1400;
const SDS_RULES = 'use var(--sds-*), .sds-* components, data-i18n, and data-reveal. Avoid raw colors, sizes, and durations.';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isTextList = value => Array.isArray(value) && value.every(isText);

function readToolCommands(staffDir, errors) {
  const commands = new Map();
  try {
    const source = fs.readFileSync(path.join(staffDir, 'tools.md'), 'utf8');
    const entries = source.matchAll(/^## ([a-z0-9-]+)[ \t]*\r?\n(?:[ \t]*\r?\n)*\x60([^\x60\r\n]+)\x60[ \t]*$/gm);
    for (const [, id, command] of entries) {
      if (commands.has(id)) errors.push(`Duplicate tool "${id}" in tools.md.`);
      commands.set(id, command);
    }
  } catch (error) {
    errors.push(`Cannot read tools.md: ${error.message}`);
  }
  return commands;
}

function inspect(staffDir = DEFAULT_STAFF_DIR, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const documents = new Set();
  let roster;
  try {
    roster = JSON.parse(fs.readFileSync(path.join(staffDir, 'staff.json'), 'utf8'));
  } catch (error) {
    errors.push(`Cannot read or parse staff.json: ${error.message}`);
    return { errors, warnings };
  }
  if (!isObject(roster)) {
    errors.push('staff.json must contain a roster object.');
    return { errors, warnings };
  }
  if (typeof roster.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(roster.version)) {
    errors.push('staff.json version must be a major.minor.patch string.');
  }
  if (!isObject(roster.crews) || !isText(roster.crews.build) || !isText(roster.crews.page)) {
    errors.push('staff.json crews must describe build and page.');
  }
  if (!Array.isArray(roster.positions) || roster.positions.length === 0) {
    errors.push('staff.json positions must be a nonempty array.');
    return { errors, warnings };
  }

  const commands = readToolCommands(staffDir, errors);
  const positionIds = new Set();
  const assignedAgents = new Map();
  for (const [index, role] of roster.positions.entries()) {
    if (!isObject(role)) {
      errors.push(`positions[${index}] must be an object.`);
      continue;
    }
    const location = isText(role.id) ? `Position "${role.id}"` : `positions[${index}]`;
    if (typeof role.id !== 'string' || !POSITION_ID.test(role.id)) {
      errors.push(`${location} id must use lowercase letters, digits, and hyphens.`);
    } else if (positionIds.has(role.id)) {
      errors.push(`${location} has a duplicate position id.`);
    } else {
      positionIds.add(role.id);
      documents.add(`playbooks/${role.id}.md`);
    }
    if (!['build', 'page', 'both'].includes(role.crew)) {
      errors.push(`${location} crew must be build, page, or both.`);
    }
    for (const key of ['title', 'mission']) {
      if (!isText(role[key])) errors.push(`${location} ${key} must be a nonempty string.`);
    }
    for (const key of ['agents', 'skills', 'tools', 'owns', 'reviews']) {
      if (!isTextList(role[key])) errors.push(`${location} ${key} must be an array of nonempty strings.`);
    }
    if (role.worker !== undefined && !isText(role.worker) &&
        !(isTextList(role.worker) && role.worker.length > 0)) {
      errors.push(`${location} worker must be an ID or a nonempty array of IDs.`);
    }
    if (!isObject(role.handoffs) || !isTextList(role.handoffs.receives) || !isTextList(role.handoffs.delivers)) {
      errors.push(`${location} handoffs must contain receives and delivers arrays of nonempty strings.`);
    }
    if (!isTextList(role.definitionOfDone) || role.definitionOfDone.length !== 3) {
      errors.push(`${location} definitionOfDone must contain exactly three nonempty strings.`);
    }

    for (const agentId of isTextList(role.agents) ? role.agents : []) {
      if (assignedAgents.has(agentId)) {
        errors.push(`Agent "${agentId}" is assigned more than once: ${assignedAgents.get(agentId)} and ${location}.`);
      } else {
        assignedAgents.set(agentId, location);
      }
    }
    for (const skill of isTextList(role.skills) ? role.skills : []) {
      if (PACKS.has(skill)) documents.add(`handbook/${skill}.md`);
      else errors.push(`${location} references unknown skill "${skill}".`);
    }
    for (const tool of isTextList(role.tools) ? role.tools : []) {
      if (!commands.has(tool)) errors.push(`${location} references unknown tool "${tool}" in tools.md.`);
    }
  }
  for (const document of documents) {
    try {
      const status = fs.statSync(path.join(staffDir, document), { throwIfNoEntry: false });
      if (!status?.isFile()) {
        (strict ? errors : warnings).push(`Missing staff document: ${document}.`);
      }
    } catch (error) {
      errors.push(`Cannot check ${document}: ${error.message}`);
    }
  }
  return { errors, warnings, positions: roster.positions, commands };
}

function validate(staffDir, options) {
  const { errors, warnings } = inspect(staffDir, options);
  return { errors, warnings };
}

function loadRoster(staffDir, options) {
  const { errors, positions, commands } = inspect(staffDir, options);
  if (errors.length) throw new Error(`Invalid SDS staff roster:\n${errors.join('\n')}`);

  const byId = Object.create(null);
  const byAgentId = new Map();
  for (const role of positions) {
    byId[role.id] = role;
    for (const agentId of role.agents) byAgentId.set(agentId, role);
  }
  return { positions, byId, byAgent: agentId => byAgentId.get(agentId), commands };
}

function load(staffDir, options) {
  const { positions, byId, byAgent } = loadRoster(staffDir, options);
  return { positions, byId, byAgent };
}

function shorten(text, limit) {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

function preamble({ staffDir, agentId, position, step } = {}) {
  const { byId, byAgent, commands } = loadRoster(staffDir);
  const role = position === undefined ? byAgent(agentId) : byId[position];
  if (!role) return '';

  const parts = [
    ['POSITION: ', `${role.title}.`, 65],
    ['MISSION: ', role.mission, 165],
    ['READ FIRST: ', `staff/playbooks/${role.id}.md and handbook packs ${role.skills.join(', ')}.`, 210],
    ['TOOLS you may run: ', role.tools.map(tool => commands.get(tool)).join(' | '), 435],
    ['DEFINITION OF DONE:', '', 0],
    ...role.definitionOfDone.map(item => ['- ', item, 65]),
    ['SDS RULES: ', SDS_RULES, SDS_RULES.length],
  ];
  if (isText(step)) parts.splice(1, 0, ['STEP: ', step.trim(), 36]);
  const full = parts.map(([label, value]) => label + value).join('\n');
  if (full.length <= MAX_PREAMBLE) return full;
  return parts.map(([label, value, limit]) => label + shorten(value, limit)).join('\n');
}

if (require.main === module) {
  const [check, option, ...extra] = process.argv.slice(2);
  if (check !== '--check' || (option !== undefined && option !== '--strict') || extra.length > 0) {
    console.error('Usage: node swarm/lib/staff.js --check [--strict]');
    process.exitCode = 1;
  } else {
    const { errors, warnings } = validate(undefined, { strict: option === '--strict' });
    for (const warning of warnings) console.warn(`Warning: ${warning}`);
    for (const error of errors) console.error(`Error: ${error}`);
    if (errors.length) process.exitCode = 1;
    else console.log('SDS staff roster passed validation.');
  }
}

module.exports = { load, preamble, validate };
