'use strict';

const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ALLOWLIST = Object.freeze({
  runners: Object.freeze({ codex: 'codex', pi: 'pi' }),
  models: Object.freeze({ 'gpt-6.2-sol': 'GPT 6.2 Sol', 'gpt-6.1-terra': 'GPT 6.1 Terra' }),
  efforts: Object.freeze(['medium', 'xhigh']),
});

const DEFAULTS = Object.freeze({
  version: 1,
  defaults: Object.freeze({ runner: 'codex', model: 'gpt-6.2-sol', effort: 'medium' }),
  roles: Object.freeze({ manager: Object.freeze({}), workers: Object.freeze({}), research: Object.freeze({}) }),
  concurrency: Object.freeze({ maxParallel: 12 }),
  timeouts: Object.freeze({ turnMinutes: 20 }),
  channel: Object.freeze({ language: 'zh-Hans', standingRules: '' }),
  research: Object.freeze({ web: true }),
  autopilot: Object.freeze({ maxCyclesPerScreen: 2 }),
  images: Object.freeze({ provider: 'codex', model: 'gpt-image-1', quality: 'high', size: '1536x1024' }),
});

const LABELS = Object.freeze({
  runners: Object.freeze({ codex: 'Codex CLI (OpenAI)', pi: 'pi (pi.dev)' }),
  models: ALLOWLIST.models,
  efforts: Object.freeze({ medium: 'Medium', xhigh: 'xhigh' }),
});

const SELECTIONS = {
  runner: Object.keys(ALLOWLIST.runners),
  model: Object.keys(ALLOWLIST.models),
  effort: ALLOWLIST.efforts,
};
const IMAGE_SELECTIONS = {
  provider: ['codex', 'openai'],
  quality: ['auto', 'low', 'medium', 'high'],
  size: ['auto', '1024x1024', '1536x1024', '1024x1536'],
};
const IMAGE_MODEL = /^[a-z0-9][a-z0-9.\-]{1,40}$/;
const IMAGE_KEY_FIELD = /(?:^|[^a-z0-9]|api|openai|access|private|secret|bearer)(?:keys?|tokens?|secrets?|credentials?)(?:$|[^a-z0-9])/i;
const MAX_RULES_LENGTH = 1000;

function isRecord(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownValue(source, key) {
  return source != null && Object.hasOwn(source, key) ? source[key] : undefined;
}

function stripControls(value) {
  return value.replace(/\p{Cc}/gu, '');
}

function rejectImageKeys(images, errors) {
  const pending = [{ source: images, path: 'images' }];
  const seen = new Set([images]);
  for (const { source, path } of pending) {
    for (const name of Object.keys(source)) {
      const location = `${path}.${name}`;
      if (IMAGE_KEY_FIELD.test(name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))) {
        errors.push({ path: location, message: 'Image credentials must be managed outside settings.' });
        continue;
      }
      const child = source[name];
      if ((isRecord(child) || Array.isArray(child)) && !seen.has(child)) {
        seen.add(child);
        pending.push({ source: child, path: location });
      }
    }
  }
}

function validate(input) {
  const errors = [];

  function field(source, key, location, accepts, message) {
    if (!Object.hasOwn(source, key)) return undefined;
    const value = source[key];
    if (accepts(value)) return value;
    errors.push({ path: location, message });
    return undefined;
  }

  function record(source, key, location = key) {
    return field(source, key, location, isRecord, 'Expected an object.') ?? {};
  }

  function selection(source, location) {
    const selected = {};
    for (const [key, allowed] of Object.entries(SELECTIONS)) {
      const value = field(source, key, `${location}.${key}`, candidate => allowed.includes(candidate),
        `Expected one of ${allowed.join(', ')}.`);
      if (value !== undefined) selected[key] = value;
    }
    return selected;
  }

  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'Expected a settings object.' }], value: structuredClone(DEFAULTS) };
  }

  const defaults = record(input, 'defaults');
  const roles = record(input, 'roles');
  const concurrency = record(input, 'concurrency');
  const timeouts = record(input, 'timeouts');
  const channel = record(input, 'channel');
  const research = record(input, 'research');
  const autopilot = record(input, 'autopilot');
  const imageInput = record(input, 'images');
  const version = field(input, 'version', 'version', value => value === DEFAULTS.version,
    `Expected version ${DEFAULTS.version}.`);
  const maxParallel = field(concurrency, 'maxParallel', 'concurrency.maxParallel',
    value => Number.isInteger(value) && value >= 1 && value <= 16, 'Expected an integer from 1 to 16.');
  const turnMinutes = field(timeouts, 'turnMinutes', 'timeouts.turnMinutes',
    value => Number.isInteger(value) && value >= 1 && value <= 60, 'Expected an integer from 1 to 60.');
  const language = field(channel, 'language', 'channel.language',
    value => value === 'zh-Hans' || value === 'en', 'Expected zh-Hans or en.');
  const standingRules = field(channel, 'standingRules', 'channel.standingRules',
    value => typeof value === 'string' && value.length <= MAX_RULES_LENGTH,
    `Expected a string of at most ${MAX_RULES_LENGTH} characters.`);
  const web = field(research, 'web', 'research.web',
    value => typeof value === 'boolean', 'Expected a boolean.');
  const maxCyclesPerScreen = field(autopilot, 'maxCyclesPerScreen', 'autopilot.maxCyclesPerScreen',
    value => Number.isInteger(value) && value >= 1 && value <= 5, 'Expected an integer from 1 to 5.');
  const images = { ...DEFAULTS.images };
  for (const [key, allowed] of Object.entries(IMAGE_SELECTIONS)) {
    images[key] = field(imageInput, key, `images.${key}`, value => allowed.includes(value),
      `Expected one of ${allowed.join(', ')}.`) ?? images[key];
  }
  images.model = field(imageInput, 'model', 'images.model', value => typeof value === 'string' && IMAGE_MODEL.test(value),
    'Expected 2 to 41 lowercase letters, digits, periods or hyphens, starting with a letter or digit.') ?? images.model;
  rejectImageKeys(imageInput, errors);

  const value = {
    version: version ?? DEFAULTS.version,
    defaults: { ...DEFAULTS.defaults, ...selection(defaults, 'defaults') },
    roles: {
      manager: selection(record(roles, 'manager', 'roles.manager'), 'roles.manager'),
      workers: selection(record(roles, 'workers', 'roles.workers'), 'roles.workers'),
      research: selection(record(roles, 'research', 'roles.research'), 'roles.research'),
    },
    concurrency: { maxParallel: maxParallel ?? DEFAULTS.concurrency.maxParallel },
    timeouts: { turnMinutes: turnMinutes ?? DEFAULTS.timeouts.turnMinutes },
    channel: {
      language: language ?? DEFAULTS.channel.language,
      standingRules: stripControls(standingRules ?? DEFAULTS.channel.standingRules),
    },
    research: { web: web ?? DEFAULTS.research.web },
    autopilot: { maxCyclesPerScreen: maxCyclesPerScreen ?? DEFAULTS.autopilot.maxCyclesPerScreen },
    images,
  };
  return { ok: errors.length === 0, errors, value };
}

function load(filePath) {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const warnings = [];
    if (error instanceof SyntaxError) {
      warnings.push('Settings file contains invalid JSON.');
    } else if (error.code !== 'ENOENT') {
      warnings.push(`Could not read settings (${error.code || 'unknown error'}).`);
    }
    return { settings: structuredClone(DEFAULTS), warnings };
  }

  const { value, errors } = validate(input);
  return { settings: value, warnings: errors.map(error => `${error.path}: ${error.message}`) };
}

function save(filePath, input) {
  const { ok, errors, value } = validate(input);
  if (!ok) return { ok, errors, settings: null };

  let temporary;
  try {
    const directory = path.dirname(filePath);
    fs.mkdirSync(directory, { recursive: true });
    const candidate = path.join(directory, `.settings-${randomUUID()}.tmp`);
    const fd = fs.openSync(candidate, 'wx', 0o600);
    temporary = candidate;
    try {
      fs.fchmodSync(fd, 0o600);
      fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n', 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, filePath);
    return { ok: true, errors: [], settings: value };
  } catch (error) {
    if (temporary) {
      try {
        fs.unlinkSync(temporary);
      } catch {
        // Preserve the original write error.
      }
    }
    return {
      ok: false,
      errors: [{ path: '$', message: `Could not save settings (${error.code || 'unknown error'}).` }],
      settings: null,
    };
  }
}

function resolve(settings, role) {
  const { value } = validate(settings);
  const override = role === 'manager' || role === '00' ? value.roles.manager : role === 'research' ? value.roles.research : value.roles.workers;
  return { ...value.defaults, ...override };
}

function preamble(settings) {
  const inputChannel = ownValue(settings, 'channel');
  const channel = isRecord(inputChannel) ? inputChannel : DEFAULTS.channel;
  const language = ownValue(channel, 'language') === 'en' ? 'English' : 'Mandarin Chinese (普通话)';
  const instruction = `Channel language: ${language}. Use it for channel messages. Keep code, file names and page copy in English.`;
  const standingRules = ownValue(channel, 'standingRules');
  if (typeof standingRules !== 'string') return instruction;
  const rules = stripControls(standingRules).slice(0, MAX_RULES_LENGTH).trim();
  return rules ? `${instruction}\n\nOwner instructions (standing rules):\n${rules}` : instruction;
}

function publicView(settings) {
  return { settings: validate(settings).value, allowlist: ALLOWLIST, labels: LABELS };
}

function envOverrides(env = process.env) {
  if (ownValue(env, 'SWARM_TEST') !== '1') return {};
  const overrides = {};
  const model = ownValue(env, 'SWARM_MODEL');
  const effort = ownValue(env, 'SWARM_EFFORT');
  if (SELECTIONS.model.includes(model)) overrides.model = model;
  if (SELECTIONS.effort.includes(effort)) overrides.effort = effort;
  return overrides;
}

module.exports = { ALLOWLIST, DEFAULTS, validate, load, save, resolve, preamble, publicView, envOverrides };
