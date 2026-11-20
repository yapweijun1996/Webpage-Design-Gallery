'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const settings = require('../lib/settings');

const DEFAULT_SELECTION = { runner: 'codex', model: 'gpt-6.2-sol', effort: 'medium' };
const DEFAULT_SETTINGS = {
  version: 1,
  defaults: DEFAULT_SELECTION,
  roles: { manager: {}, workers: {} },
  concurrency: { maxParallel: 12 },
  timeouts: { turnMinutes: 20 },
  channel: { language: 'zh-Hans', standingRules: '' },
};

function settingsPath(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-settings-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, 'settings.json');
}

test('exports the exact immutable allowlist and medium defaults', () => {
  assert.deepEqual(settings.ALLOWLIST, {
    runners: { codex: 'codex', pi: 'pi' },
    models: { 'gpt-6.2-sol': 'GPT 6.2 Sol', 'gpt-6.1-terra': 'GPT 6.1 Terra' },
    efforts: ['medium', 'xhigh'],
  });
  assert.deepEqual(settings.DEFAULTS, DEFAULT_SETTINGS);
  assert.throws(() => { settings.ALLOWLIST.runners.bash = 'bash'; }, TypeError);
  assert.throws(() => { settings.ALLOWLIST.models.custom = 'Custom'; }, TypeError);
  assert.throws(() => { settings.ALLOWLIST.efforts.push('low'); }, TypeError);
  assert.throws(() => { settings.DEFAULTS.defaults.effort = 'low'; }, TypeError);
  assert.deepEqual(settings.validate({}), { ok: true, errors: [], value: DEFAULT_SETTINGS });
});

test('accepts all eight runner, model, and effort combinations', () => {
  for (const runner of ['codex', 'pi']) {
    for (const model of ['gpt-6.2-sol', 'gpt-6.1-terra']) {
      for (const effort of ['medium', 'xhigh']) {
        const defaults = { runner, model, effort };
        const { ok, errors, value } = settings.validate({ defaults });
        assert.equal(ok, true);
        assert.deepEqual(errors, []);
        assert.deepEqual(value.defaults, defaults);
        assert.deepEqual(settings.resolve(value, 'worker'), defaults);
      }
    }
  }
});

for (const [field, input] of [
  ['runner', 'bash'],
  ['runner', '/usr/local/bin/codex'],
  ['runner', 'pi '],
  ['model', 'gpt-6.0'],
  ['model', 'openai-codex/gpt-6.2-sol'],
  ['model', 'gpt-6.2-sol\0'],
  ['effort', 'low'],
  ['effort', 'high'],
  ['effort', 'max'],
  ['effort', 'ultra'],
]) {
  test(`rejects nonallowlisted ${field} ${JSON.stringify(input)} in defaults and both roles`, () => {
    const selection = { [field]: input };
    const raw = { defaults: selection, roles: { manager: selection, workers: selection } };
    const { ok, errors, value } = settings.validate(raw);
    assert.equal(ok, false);
    assert.deepEqual(errors.map(error => error.path), [
      `defaults.${field}`, `roles.manager.${field}`, `roles.workers.${field}`,
    ]);
    assert.ok(errors.every(error => typeof error.message === 'string' && error.message.length > 0));
    assert.deepEqual(value, DEFAULT_SETTINGS);
    assert.deepEqual(settings.resolve(raw, 'manager'), DEFAULT_SELECTION);
    assert.deepEqual(settings.resolve(raw, 'worker'), DEFAULT_SELECTION);
  });
}

test('rejects incorrect types without coercion and reports leaf paths', () => {
  const result = settings.validate({
    version: '1',
    defaults: { runner: ['pi'], model: { toString: () => 'gpt-6.1-terra' }, effort: null },
    roles: { manager: [], workers: false },
    concurrency: { maxParallel: '12' },
    timeouts: { turnMinutes: true },
    channel: { language: ['en'], standingRules: 40 },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(error => error.path).sort(), [
    'channel.language', 'channel.standingRules', 'concurrency.maxParallel', 'defaults.effort',
    'defaults.model', 'defaults.runner', 'roles.manager', 'roles.workers', 'timeouts.turnMinutes', 'version',
  ]);
  assert.deepEqual(result.value, DEFAULT_SETTINGS);
});

test('rejects non-object roots and sections', () => {
  for (const root of [null, undefined, false, [], 'settings', 5, new Date()]) {
    const { ok, errors, value } = settings.validate(root);
    assert.equal(ok, false);
    assert.deepEqual(errors.map(error => error.path), ['$']);
    assert.deepEqual(value, DEFAULT_SETTINGS);
  }
  const result = settings.validate({ defaults: false, roles: null, concurrency: [], timeouts: '20', channel: 0 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(error => error.path).sort(), ['channel', 'concurrency', 'defaults', 'roles', 'timeouts']);
  assert.deepEqual(result.value, DEFAULT_SETTINGS);
});

test('drops prototype keys and treats prototype members as invalid choices', () => {
  const raw = JSON.parse(`{
    "__proto__": {"swarmSettingsPolluted": true},
    "constructor": {"prototype": {"swarmSettingsPolluted": true}},
    "defaults": {
      "runner": "__proto__",
      "model": "constructor",
      "effort": "toString",
      "__proto__": {"runner": "pi"},
      "constructor": {"prototype": {"runner": "pi"}}
    },
    "roles": {
      "__proto__": {"manager": {"runner": "pi"}},
      "workers": {"__proto__": {"effort": "xhigh"}, "constructor": {"effort": "xhigh"}}
    },
    "channel": {"__proto__": {"language": "en"}}
  }`);
  const { ok, errors, value } = settings.validate(raw);
  assert.equal(ok, false);
  assert.deepEqual(errors.map(error => error.path), ['defaults.runner', 'defaults.model', 'defaults.effort']);
  assert.deepEqual(value, DEFAULT_SETTINGS);
  assert.equal(Object.prototype.swarmSettingsPolluted, undefined);
  assert.equal(Object.hasOwn(value, '__proto__'), false);
  assert.equal(Object.hasOwn(value.defaults, 'constructor'), false);
  assert.equal(Object.hasOwn(value.roles.workers, 'constructor'), false);
  assert.deepEqual(settings.resolve({ defaults: Object.create({ runner: 'pi' }) }, 'worker'), DEFAULT_SELECTION);
});

test('rejects huge strings at every restricted field', () => {
  const huge = 'x'.repeat(100_000);
  const { ok, errors, value } = settings.validate({
    defaults: { runner: huge, model: huge, effort: huge },
    channel: { language: huge, standingRules: huge },
  });
  assert.equal(ok, false);
  assert.deepEqual(errors.map(error => error.path).sort(),
    ['channel.language', 'channel.standingRules', 'defaults.effort', 'defaults.model', 'defaults.runner']);
  assert.ok(errors.every(error => error.message.length < 200));
  assert.deepEqual(value, DEFAULT_SETTINGS);
});

test('strips C0 and C1 controls from standing rules and enforces a 1000-character limit', () => {
  const channel = { language: 'en', standingRules: '\u0000Keep\u0009 it\u001b brief.\u000a\u007f\u0085\u009f' };
  assert.deepEqual(settings.validate({ channel }).value.channel, { language: 'en', standingRules: 'Keep it brief.' });
  assert.equal(settings.validate({ channel }).ok, true);
  const standingRules = '改'.repeat(1000);
  const atLimit = settings.validate({ channel: { standingRules } });
  assert.equal(atLimit.ok, true);
  assert.equal(atLimit.value.channel.standingRules, standingRules);
  const overLimit = settings.validate({ channel: { standingRules: standingRules + 'x' } });
  assert.equal(overLimit.ok, false);
  assert.deepEqual(overLimit.errors.map(error => error.path), ['channel.standingRules']);
  assert.equal(overLimit.value.channel.standingRules, '');
});

test('enforces both integer bounds for concurrency and timeouts', () => {
  for (const [maxParallel, turnMinutes] of [[1, 1], [16, 60]]) {
    const { ok, value } = settings.validate({ concurrency: { maxParallel }, timeouts: { turnMinutes } });
    assert.equal(ok, true);
    assert.equal(value.concurrency.maxParallel, maxParallel);
    assert.equal(value.timeouts.turnMinutes, turnMinutes);
  }
  for (const [maxParallel, turnMinutes] of [[0, 0], [17, 61], [1.5, 20.5], [NaN, Infinity]]) {
    const { ok, errors, value } = settings.validate({ concurrency: { maxParallel }, timeouts: { turnMinutes } });
    assert.equal(ok, false);
    assert.deepEqual(errors.map(error => error.path), ['concurrency.maxParallel', 'timeouts.turnMinutes']);
    assert.deepEqual(value, DEFAULT_SETTINGS);
  }
});

test('loads missing files with fresh defaults and no warnings', t => {
  const file = settingsPath(t);
  const result = settings.load(file);
  assert.deepEqual(result, { settings: DEFAULT_SETTINGS, warnings: [] });
  result.settings.defaults.effort = 'xhigh';
  assert.deepEqual(settings.load(file), { settings: DEFAULT_SETTINGS, warnings: [] });
  assert.equal(fs.existsSync(file), false);
});

test('loads corrupt JSON with default settings and a warning', t => {
  const file = settingsPath(t);
  fs.writeFileSync(file, '{"defaults":');
  const result = settings.load(file);
  assert.deepEqual(result.settings, DEFAULT_SETTINGS);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /invalid JSON/i);
});

test('returns defaults and a warning for a filesystem read error', t => {
  const file = settingsPath(t);
  fs.mkdirSync(file);
  const result = settings.load(file);
  assert.deepEqual(result.settings, DEFAULT_SETTINGS);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /could not read settings/i);
});

test('drops extra keys from a file at every schema level', t => {
  const file = settingsPath(t);
  fs.writeFileSync(file, JSON.stringify({
    extra: true,
    defaults: { model: 'gpt-6.1-terra', argv: ['--unsafe'] },
    roles: { extra: {}, manager: { runner: 'pi', extra: true }, workers: { extra: true } },
    concurrency: { maxParallel: 8, extra: true },
    timeouts: { extra: true },
    channel: { extra: true },
  }));
  assert.deepEqual(settings.load(file), {
    settings: {
      ...DEFAULT_SETTINGS,
      defaults: { ...DEFAULT_SELECTION, model: 'gpt-6.1-terra' },
      roles: { manager: { runner: 'pi' }, workers: {} },
      concurrency: { maxParallel: 8 },
    },
    warnings: [],
  });
});

test('warns about individual invalid fields while preserving valid role overrides', t => {
  const file = settingsPath(t);
  const raw = {
    version: 2,
    defaults: { model: 'gpt-6.1-terra', effort: 'xhigh' },
    roles: { manager: { runner: 'pi', effort: 'high' }, workers: { runner: false, model: 'gpt-6.2-sol' } },
    concurrency: { maxParallel: 0 },
    channel: { language: 'en', standingRules: 'a'.repeat(1001) },
  };
  fs.writeFileSync(file, JSON.stringify(raw));
  const result = settings.load(file);
  assert.deepEqual(result.warnings.map(warning => warning.split(':')[0]).sort(),
    ['channel.standingRules', 'concurrency.maxParallel', 'roles.manager.effort', 'roles.workers.runner', 'version']);
  assert.deepEqual(result.settings, {
    ...DEFAULT_SETTINGS,
    defaults: { runner: 'codex', model: 'gpt-6.1-terra', effort: 'xhigh' },
    roles: { manager: { runner: 'pi' }, workers: { model: 'gpt-6.2-sol' } },
    channel: { language: 'en', standingRules: '' },
  });
  assert.deepEqual(settings.resolve(raw, '00'), { runner: 'pi', model: 'gpt-6.1-terra', effort: 'xhigh' });
  assert.deepEqual(settings.resolve(raw, '09'), { runner: 'codex', model: 'gpt-6.2-sol', effort: 'xhigh' });
});

test('resolves named roles and agent IDs with and without overrides', () => {
  for (const role of ['manager', 'worker', '00', '01', '12', 'A']) {
    assert.deepEqual(settings.resolve({}, role), DEFAULT_SELECTION);
  }
  const raw = { defaults: { model: 'gpt-6.1-terra' }, roles: { manager: { runner: 'pi' }, workers: { effort: 'xhigh' } } };
  for (const role of ['manager', '00']) {
    assert.deepEqual(settings.resolve(raw, role), { runner: 'pi', model: 'gpt-6.1-terra', effort: 'medium' });
  }
  for (const role of ['worker', '01', '12', 'A', 'constructor', '__proto__']) {
    assert.deepEqual(settings.resolve(raw, role), { runner: 'codex', model: 'gpt-6.1-terra', effort: 'xhigh' });
  }
});

test('saves normalized settings in nested directories with mode 0600', t => {
  const file = path.join(path.dirname(settingsPath(t)), '.run', 'nested', 'settings.json');
  const expected = { ...DEFAULT_SETTINGS, channel: { language: 'en', standingRules: 'Be concise.' } };
  const result = settings.save(file, { channel: { language: 'en', standingRules: 'Be\u0000 concise.', extra: 'drop' } });
  assert.deepEqual(result, { ok: true, errors: [], settings: expected });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  fs.chmodSync(file, 0o644);
  assert.equal(settings.save(file, {}).ok, true);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(settings.load(file), { settings: DEFAULT_SETTINGS, warnings: [] });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['settings.json']);
});

test('rejects invalid saves and preserves the existing file', t => {
  const file = settingsPath(t);
  assert.equal(settings.save(file, { defaults: { runner: 'pi' } }).ok, true);
  const original = fs.readFileSync(file, 'utf8');
  const result = settings.save(file, { defaults: { effort: 'low' } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(error => error.path), ['defaults.effort']);
  assert.equal(result.settings, null);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('keeps the old bytes and removes the temporary file when rename fails', t => {
  const file = settingsPath(t);
  assert.equal(settings.save(file, { defaults: { runner: 'pi' } }).ok, true);
  const original = fs.readFileSync(file, 'utf8');
  let pendingWrite;
  const rename = t.mock.method(fs, 'renameSync', (source, destination) => {
    pendingWrite = {
      source,
      destination,
      mode: fs.statSync(source).mode & 0o777,
      incoming: JSON.parse(fs.readFileSync(source, 'utf8')),
      current: fs.readFileSync(destination, 'utf8'),
    };
    throw Object.assign(new Error('Injected rename failure'), { code: 'EIO' });
  });
  const result = settings.save(file, { defaults: { effort: 'xhigh' } });
  assert.equal(rename.mock.callCount(), 1);
  assert.equal(pendingWrite.destination, file);
  assert.notEqual(pendingWrite.source, file);
  assert.equal(path.dirname(pendingWrite.source), path.dirname(file));
  assert.equal(pendingWrite.mode, 0o600);
  assert.equal(pendingWrite.incoming.defaults.effort, 'xhigh');
  assert.equal(pendingWrite.current, original);
  assert.equal(result.ok, false);
  assert.equal(result.settings, null);
  assert.match(result.errors[0].message, /EIO/);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['settings.json']);
});

test('includes the channel language and English code and copy requirements in prompts', () => {
  const mandarin = settings.preamble({ channel: { language: 'zh-Hans' } });
  assert.match(mandarin, /Channel language: Mandarin Chinese \(普通话\)/);
  assert.match(mandarin, /Keep code, file names and page copy in English/);
  assert.doesNotMatch(mandarin, /Owner instructions/);
  assert.equal(settings.preamble({ channel: { language: 'invalid' } }), mandarin);
  const english = settings.preamble({ channel: { language: 'en' } });
  assert.match(english, /Channel language: English/);
  assert.match(english, /Keep code, file names and page copy in English/);
});

test('labels, sanitizes, and caps owner standing rules in prompts', () => {
  const prompt = settings.preamble({ channel: { language: 'en', standingRules: '\u0000Keep status brief.' } });
  assert.match(prompt, /Owner instructions \(standing rules\):\nKeep status brief\.$/);
  assert.doesNotMatch(prompt, /\u0000/);
  const longRule = 'a'.repeat(1000);
  const capped = settings.preamble({ channel: { language: 'zh-Hans', standingRules: longRule + 'TRUNCATE' } });
  assert.equal(capped.split('Owner instructions (standing rules):\n')[1], longRule);
  assert.doesNotMatch(capped, /TRUNCATE/);
});

test('exposes normalized settings, the allowlist, and labels in the public view', () => {
  const raw = { defaults: { runner: 'pi', extra: true }, extra: true };
  const view = settings.publicView(raw);
  assert.deepEqual(view, {
    settings: { ...DEFAULT_SETTINGS, defaults: { ...DEFAULT_SELECTION, runner: 'pi' } },
    allowlist: settings.ALLOWLIST,
    labels: {
      runners: { codex: 'Codex CLI (OpenAI)', pi: 'pi (pi.dev)' },
      models: { 'gpt-6.2-sol': 'GPT 6.2 Sol', 'gpt-6.1-terra': 'GPT 6.1 Terra' },
      efforts: { medium: 'Medium', xhigh: 'xhigh' },
    },
  });
  view.settings.defaults.runner = 'codex';
  assert.equal(raw.defaults.runner, 'pi');
});

test('ignores environment overrides unless explicitly enabled with the string 1', () => {
  const env = { SWARM_MODEL: 'gpt-6.1-terra', SWARM_EFFORT: 'xhigh' };
  for (const testFlag of [undefined, '', '0', 'true', '01', '1 ', true, 1]) {
    assert.deepEqual(settings.envOverrides({ ...env, SWARM_TEST: testFlag }), {});
  }
  assert.deepEqual(settings.envOverrides(Object.assign(Object.create({ SWARM_TEST: '1' }), env)), {});
  assert.deepEqual(settings.envOverrides({ ...env, SWARM_TEST: '1' }), { model: 'gpt-6.1-terra', effort: 'xhigh' });
});

test('filters out nonallowlisted test environment values', () => {
  assert.deepEqual(settings.envOverrides({ SWARM_TEST: '1', SWARM_MODEL: 'constructor', SWARM_EFFORT: 'low' }), {});
  assert.deepEqual(settings.envOverrides({ SWARM_TEST: '1', SWARM_MODEL: 'gpt-6.2-sol', SWARM_EFFORT: 'ultra' }),
    { model: 'gpt-6.2-sol' });
  assert.deepEqual(settings.envOverrides({ SWARM_TEST: '1', SWARM_MODEL: ['gpt-6.1-terra'], SWARM_EFFORT: 'medium' }),
    { effort: 'medium' });
});
