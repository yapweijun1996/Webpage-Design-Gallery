'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const settings = require('../lib/settings');

const DEFAULT_SELECTION = { runner: 'codex', model: 'gpt-6.2-sol', effort: 'medium' };
const DEFAULT_IMAGES = { provider: 'codex', model: 'gpt-image-2', quality: 'high', size: '1536x1024' };
const DEFAULT_SETTINGS = {
  version: 1,
  defaults: DEFAULT_SELECTION,
  roles: { manager: {}, workers: {}, research: {} },
  concurrency: { maxParallel: 12 },
  timeouts: { turnMinutes: 20 },
  channel: { language: 'zh-Hans', standingRules: '' },
  research: { web: true },
  autopilot: { maxCyclesPerScreen: 2 },
  images: DEFAULT_IMAGES,
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
  assert.throws(() => { settings.DEFAULTS.research.web = false; }, TypeError);
  assert.throws(() => { settings.DEFAULTS.autopilot.maxCyclesPerScreen = 5; }, TypeError);
  assert.throws(() => { settings.DEFAULTS.images.provider = 'openai'; }, TypeError);
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

test('validates web research and each allowed autopilot cycle count', () => {
  for (const web of [true, false]) {
    for (const maxCyclesPerScreen of [1, 2, 3, 4, 5]) {
      const research = { web };
      const autopilot = { maxCyclesPerScreen };
      assert.deepEqual(settings.validate({ research, autopilot }), {
        ok: true, errors: [], value: { ...DEFAULT_SETTINGS, research, autopilot },
      });
    }
  }
});

test('rejects wrong research and autopilot types and out-of-range cycle counts', () => {
  for (const group of [null, undefined, [], true, 2, 'object']) {
    const result = settings.validate({ research: group, autopilot: group });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(error => error.path), ['research', 'autopilot']);
    assert.deepEqual(result.value, DEFAULT_SETTINGS);
  }
  for (const [group, key, invalidValues] of [
    ['research', 'web', [null, undefined, 'true', 'false', 0, 1, [], {}]],
    ['autopilot', 'maxCyclesPerScreen', [null, undefined, '2', false, [], {}, -1, 0, 6, 2.5, NaN, Infinity]],
  ]) {
    for (const value of invalidValues) {
      const result = settings.validate({ [group]: { [key]: value } });
      assert.equal(result.ok, false);
      assert.deepEqual(result.errors.map(error => error.path), [`${group}.${key}`]);
      assert.deepEqual(result.value, DEFAULT_SETTINGS);
    }
  }
});

test('validates image provider, quality and size independently of runner selection', () => {
  for (const provider of ['codex', 'openai']) {
    for (const quality of ['auto', 'low', 'medium', 'high']) {
      for (const size of ['auto', '1024x1024', '1536x1024', '1024x1536']) {
        const images = { provider, model: 'gpt-image-2.1', quality, size };
        const raw = { images };
        assert.deepEqual(settings.validate(raw), { ok: true, errors: [], value: { ...DEFAULT_SETTINGS, images } });
        assert.deepEqual(settings.resolve(raw, 'worker'), DEFAULT_SELECTION);
      }
    }
  }
  for (const model of ['a0', '1' + 'a'.repeat(40)]) {
    assert.equal(settings.validate({ images: { model } }).value.images.model, model);
  }
});

test('rejects invalid image values without coercion and reports exact paths', () => {
  for (const images of [null, undefined, [], 'images', false]) {
    const result = settings.validate({ images });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(error => error.path), ['images']);
    assert.deepEqual(result.value.images, DEFAULT_IMAGES);
  }
  for (const [key, invalidValues] of [
    ['provider', [null, 'pi', 'OpenAI', ['codex']]],
    ['model', [undefined, 23, {}, 'a', 'a'.repeat(42), '-image', 'GPT-image', 'gpt_image', 'gpt/image', 'gpt-image\n']],
    ['quality', [null, 'standard', 'high ', ['auto']]],
    ['size', [3, '1024X1024', '512x512', { width: 1024 }]],
  ]) {
    for (const value of invalidValues) {
      const result = settings.validate({ images: { [key]: value } });
      assert.equal(result.ok, false);
      assert.deepEqual(result.errors.map(error => error.path), [`images.${key}`]);
      assert.deepEqual(result.value.images, DEFAULT_IMAGES);
    }
  }
});

test('rejects image credential fields without returning or persisting their values', t => {
  const file = settingsPath(t);
  const baseline = { images: { provider: 'openai' } };
  assert.equal(settings.save(file, baseline).ok, true);
  const original = fs.readFileSync(file, 'utf8');
  const fakeSecret = 'fake-image-credential-value';
  const fields = ['key', 'apiKey', 'api_key', 'API-KEY', 'openaiKey', 'accessToken', 'secret'];
  const images = { ...baseline.images, ...Object.fromEntries(fields.map(name => [name, fakeSecret])) };
  images.extra = [{ openai_api_key: fakeSecret }];
  const raw = { images };
  const result = settings.save(file, raw);
  const paths = fields.map(name => `images.${name}`).concat('images.extra.0.openai_api_key');
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(error => error.path), paths);
  assert.equal(JSON.stringify(result).includes(fakeSecret), false);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  const publicSettings = settings.publicView(raw).settings;
  assert.deepEqual(publicSettings.images, { ...DEFAULT_IMAGES, ...baseline.images });
  fs.writeFileSync(file, JSON.stringify(raw));
  const loaded = settings.load(file);
  assert.deepEqual(loaded.warnings.map(warning => warning.split(':')[0]), paths);
  assert.deepEqual(loaded.settings, publicSettings);
  assert.equal(JSON.stringify(loaded).includes(fakeSecret), false);
});

test('loads missing files with fresh defaults and no warnings', t => {
  const file = settingsPath(t);
  const result = settings.load(file);
  assert.deepEqual(result, { settings: DEFAULT_SETTINGS, warnings: [] });
  result.settings.defaults.effort = 'xhigh';
  assert.deepEqual(settings.load(file), { settings: DEFAULT_SETTINGS, warnings: [] });
  assert.equal(fs.existsSync(file), false);
});

test('loads older files with research, autopilot and image defaults and no warnings', t => {
  const file = settingsPath(t);
  const legacy = { ...DEFAULT_SETTINGS, defaults: { ...DEFAULT_SELECTION, runner: 'pi' } };
  delete legacy.research;
  delete legacy.autopilot;
  delete legacy.images;
  fs.writeFileSync(file, JSON.stringify(legacy));
  assert.deepEqual(settings.load(file), {
    settings: { ...DEFAULT_SETTINGS, ...legacy },
    warnings: [],
  });
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
    research: { web: false, extra: true },
    autopilot: { maxCyclesPerScreen: 1, extra: true },
    images: { quality: 'low', extra: { futureOption: true } },
  }));
  assert.deepEqual(settings.load(file), {
    settings: {
      ...DEFAULT_SETTINGS,
      defaults: { ...DEFAULT_SELECTION, model: 'gpt-6.1-terra' },
      roles: { manager: { runner: 'pi' }, workers: {}, research: {} },
      concurrency: { maxParallel: 8 },
      research: { web: false },
      autopilot: { maxCyclesPerScreen: 1 },
      images: { ...DEFAULT_IMAGES, quality: 'low' },
    },
    warnings: [],
  });
});

test('warns about individual invalid fields while preserving valid role overrides', t => {
  const file = settingsPath(t);
  const raw = {
    version: 2,
    defaults: { model: 'gpt-6.1-terra', effort: 'xhigh' },
    roles: { manager: { runner: 'pi', effort: 'high' }, workers: { runner: false, model: 'gpt-6.2-sol' }, research: {} },
    concurrency: { maxParallel: 0 },
    channel: { language: 'en', standingRules: 'a'.repeat(1001) },
    research: { web: 'false' },
    autopilot: { maxCyclesPerScreen: 12 },
  };
  fs.writeFileSync(file, JSON.stringify(raw));
  const result = settings.load(file);
  assert.deepEqual(result.warnings.map(warning => warning.split(':')[0]).sort(),
    ['autopilot.maxCyclesPerScreen', 'channel.standingRules', 'concurrency.maxParallel', 'research.web',
      'roles.manager.effort', 'roles.workers.runner', 'version']);
  assert.deepEqual(result.settings, {
    ...DEFAULT_SETTINGS,
    defaults: { runner: 'codex', model: 'gpt-6.1-terra', effort: 'xhigh' },
    roles: { manager: { runner: 'pi' }, workers: { model: 'gpt-6.2-sol' }, research: {} },
    channel: { language: 'en', standingRules: '' },
  });
  assert.deepEqual(settings.resolve(raw, '00'), { runner: 'pi', model: 'gpt-6.1-terra', effort: 'xhigh' });
  assert.deepEqual(settings.resolve(raw, '09'), { runner: 'codex', model: 'gpt-6.2-sol', effort: 'xhigh' });
});

test('resolves named roles and agent IDs with and without overrides', () => {
  for (const role of ['manager', 'worker', '00', '01', '12', 'A']) {
    assert.deepEqual(settings.resolve({}, role), DEFAULT_SELECTION);
  }
  const raw = { defaults: { model: 'gpt-6.1-terra' }, roles: { manager: { runner: 'pi' }, workers: { effort: 'xhigh' }, research: {} } };
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

test('preserves nondefault research, autopilot and image settings through a save and load', t => {
  const file = settingsPath(t);
  const input = {
    research: { web: false }, autopilot: { maxCyclesPerScreen: 5 },
    images: { provider: 'openai', model: 'gpt-image-2', quality: 'medium', size: '1024x1536' },
  };
  const expected = { ...DEFAULT_SETTINGS, ...input };
  assert.deepEqual(settings.save(file, input), { ok: true, errors: [], settings: expected });
  assert.deepEqual(settings.load(file), { settings: expected, warnings: [] });
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
  const raw = { defaults: { runner: 'pi', extra: true }, research: { web: false }, extra: true };
  const view = settings.publicView(raw);
  assert.deepEqual(view, {
    settings: { ...DEFAULT_SETTINGS, defaults: { ...DEFAULT_SELECTION, runner: 'pi' }, research: { web: false } },
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

test('the research role can use a different runner than the workers', () => {
  const input = { roles: { workers: { runner: 'pi' }, research: { runner: 'codex', model: 'gpt-6.1-terra', effort: 'xhigh' } } };
  const checked = settings.validate(input);
  assert.equal(checked.ok, true);
  assert.deepEqual(settings.resolve(input, 'worker'), { runner: 'pi', model: 'gpt-6.2-sol', effort: 'medium' });
  assert.deepEqual(settings.resolve(input, 'research'), { runner: 'codex', model: 'gpt-6.1-terra', effort: 'xhigh' });
  assert.deepEqual(settings.resolve(input, 'manager'), { runner: 'codex', model: 'gpt-6.2-sol', effort: 'medium' });
  assert.equal(settings.validate({ roles: { research: { runner: 'omp' } } }).ok, false);
  assert.equal(settings.validate({ roles: { research: { effort: 'low' } } }).ok, false);
});
