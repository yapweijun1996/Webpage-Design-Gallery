'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const K = require('../lib/skills');
const staff = require('../staff/staff.json').positions;

const BUILTINS = path.join(__dirname, '..', 'skills');
const HANDBOOK = path.join(__dirname, '..', 'staff', 'handbook');
const ART = 'art-director';
const HERO = 'hero-designer';

function project(t) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'swarm-skills-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function skillDir(root, id) {
  return path.join(root, 'skills', id);
}

function skillFile(root, id) {
  return path.join(skillDir(root, id), 'SKILL.md');
}

function writeSkill(root, id, source) {
  const file = skillFile(root, id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  return file;
}

function save(projectDir, id, extra = {}) {
  return K.save({ projectDir, id, description: 'Use this skill to check a local workflow.', body: '# Local workflow\n', ...extra });
}

function check(result) {
  assert.equal(result.ok, true, result.errors?.join('\n'));
}

function rejects(result) {
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
}

test('migration creates the ten exact handbook bodies with valid metadata and leaves them intact on rerun', t => {
  const workspace = project(t);
  fs.mkdirSync(path.join(workspace, 'lib'));
  fs.copyFileSync(require.resolve('../lib/skills'), path.join(workspace, 'lib', 'skills.js'));
  fs.copyFileSync(require.resolve('../lib/staff'), path.join(workspace, 'lib', 'staff.js'));
  fs.cpSync(path.dirname(HANDBOOK), path.join(workspace, 'staff'), { recursive: true });
  const isolated = require(path.join(workspace, 'lib', 'skills.js'));
  const ids = fs.readdirSync(HANDBOOK).filter(file => file.endsWith('.md')).map(file => file.slice(0, -3)).sort();
  assert.equal(ids.length, 10);
  assert.deepEqual(isolated.migrate(), { ok: true, created: ids });
  assert.deepEqual(K.list().map(skill => skill.id), ids);
  for (const id of ids) {
    const migrated = isolated.get(id);
    assert.equal(migrated.body, fs.readFileSync(path.join(HANDBOOK, `${id}.md`), 'utf8'));
    assert.deepEqual(migrated.meta.roles, staff.filter(role => role.skills.includes(id)).map(role => role.id));
    assert.equal(migrated.meta.name, id);
    assert.equal(migrated.meta.enabled, true);
    assert.ok(migrated.meta.description.length <= 300 && migrated.meta.description.length > 0);
    assert.deepEqual(fs.readFileSync(skillFile(workspace, id)), fs.readFileSync(path.join(BUILTINS, id, 'SKILL.md')));
  }
  const sample = skillFile(workspace, ids[0]);
  const edited = fs.readFileSync(sample, 'utf8') + '\nLocal edit preserved on migration.\n';
  fs.writeFileSync(sample, edited);
  assert.deepEqual(isolated.migrate(), { ok: true, created: [] });
  assert.equal(fs.readFileSync(sample, 'utf8'), edited);
});

test('save and get round-trip Markdown and list exposes the documented metadata', t => {
  const projectDir = project(t);
  const id = 'local-review';
  const description = 'Check "quoted" text: commas, #, and Unicode 检查.';
  const body = '\n# Review\r\n\r\n```sh\r\nprintf "example"\r\n```\r\n';
  check(save(projectDir, id, { description, body, roles: [HERO], version: '2.7.9-beta.1+build.3', tags: ['ui, qa', 'a]b'] }));
  const { meta, body: saved } = K.get(id, { projectDir });
  assert.equal(saved, body);
  const { tags, ...summary } = meta;
  assert.deepEqual(tags, ['ui, qa', 'a]b']);
  assert.deepEqual(summary, {
    id, name: id, description, version: '2.7.9-beta.1+build.3', roles: [HERO], source: 'project', enabled: true,
    bytes: fs.statSync(skillFile(projectDir, id)).size,
  });
  assert.deepEqual(K.list({ projectDir }).find(skill => skill.id === id), summary);
  assert.equal(K.get(id), null);
  assert.equal(K.get('no-such-skill', { projectDir }), null);
});

test('every edit and state change bumps patch and keeps the preceding exact text', t => {
  const projectDir = project(t);
  const id = 'review-notes';
  const file = skillFile(projectDir, id);
  const history = path.join(path.dirname(file), '.history');
  check(save(projectDir, id, { roles: [HERO], version: '2.7.9-beta.1+build.3' }));
  const first = fs.readFileSync(file);
  assert.equal(fs.existsSync(history), false);

  check(save(projectDir, id, { body: '# Updated\n' }));
  const second = fs.readFileSync(file);
  assert.equal(K.get(id, { projectDir }).meta.version, '2.7.10');
  assert.deepEqual(K.get(id, { projectDir }).meta.roles, [HERO]);
  assert.deepEqual(fs.readFileSync(path.join(history, '2.7.9-beta.1+build.3.md')), first);

  check(K.setEnabled({ projectDir, id, enabled: false }));
  assert.equal(K.get(id, { projectDir }).meta.enabled, false);
  assert.equal(K.get(id, { projectDir }).meta.version, '2.7.11');
  assert.deepEqual(fs.readFileSync(path.join(history, '2.7.10.md')), second);
  check(K.setEnabled({ projectDir, id, enabled: false }));
  assert.equal(K.get(id, { projectDir }).meta.version, '2.7.11');
  check(K.setEnabled({ projectDir, id, enabled: true }));
  assert.equal(K.get(id, { projectDir }).meta.version, '2.7.12');
  assert.deepEqual(fs.readdirSync(history).sort(), ['2.7.10.md', '2.7.11.md', '2.7.9-beta.1+build.3.md']);
});

test('overriding, disabling and removing a project copy leaves the builtin intact', t => {
  const projectDir = project(t);
  const id = 'ui-ux-core';
  const file = path.join(BUILTINS, id, 'SKILL.md');
  const original = fs.readFileSync(file);
  const otherProject = project(t);
  rejects(K.remove({ projectDir, id }));
  check(K.setEnabled({ projectDir, id, enabled: false }));
  assert.equal(K.get(id, { projectDir }).meta.source, 'project');
  assert.equal(K.get(id, { projectDir }).meta.enabled, false);
  assert.equal(K.get(id, { projectDir: otherProject }).meta.enabled, true);
  assert.ok(!K.resolve({ projectDir, position: ART }).ids.includes(id));
  assert.deepEqual(fs.readFileSync(path.join(skillDir(projectDir, id), '.history', '1.0.0.md')), original);

  check(save(projectDir, id, { body: '# Project-specific guidance', enabled: true }));
  assert.equal(K.get(id, { projectDir }).body, '# Project-specific guidance');
  assert.equal(K.list({ projectDir }).filter(skill => skill.id === id).length, 1);
  assert.equal(K.resolve({ projectDir, position: ART, runner: 'pi' }).dirs[0], skillDir(projectDir, id));

  check(K.remove({ projectDir, id }));
  assert.equal(K.get(id, { projectDir }).meta.source, 'builtin');
  assert.equal(K.resolve({ projectDir, position: ART, runner: 'pi' }).dirs[0], path.join(BUILTINS, id));
  assert.deepEqual(fs.readFileSync(file), original);
  rejects(K.remove({ projectDir, id }));
});

test('position defaults come from staff.json and only explicit assignments are persisted', t => {
  const projectDir = project(t);
  const byPosition = Object.fromEntries(staff.map(role => [role.id, role.skills]));
  assert.deepEqual(K.assignments({ projectDir }), { byPosition, byWorker: {} });
  assert.equal(fs.existsSync(path.join(projectDir, 'skills.json')), false);
  for (const role of staff) {
    assert.deepEqual(K.resolve({ projectDir, position: role.id }).ids, role.skills, role.id);
  }
  check(K.assign({ projectDir, target: { position: HERO }, ids: [] }));
  assert.deepEqual(K.assignments({ projectDir }), { byPosition: { ...byPosition, [HERO]: [] }, byWorker: {} });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(projectDir, 'skills.json'), 'utf8')), {
    byPosition: { [HERO]: [] }, byWorker: {},
  });
});

test('resolution selects enabled role-compatible assignments and worker additions only', t => {
  const projectDir = project(t);
  check(save(projectDir, 'unused-skill', { body: 'Unassigned marker' }));
  check(save(projectDir, 'shared-pick', { body: 'Position and worker marker' }));
  check(save(projectDir, 'hero-only', { roles: [HERO] }));
  check(save(projectDir, 'worker-pick', { body: 'Worker marker' }));
  check(save(projectDir, 'disabled-pick', { enabled: false }));
  check(K.assign({ projectDir, target: { position: ART }, ids: ['shared-pick', 'hero-only', 'disabled-pick'] }));
  check(K.assign({ projectDir, target: { worker: '00' }, ids: ['worker-pick', 'shared-pick', 'worker-pick'] }));
  check(K.assign({ projectDir, target: { position: HERO }, ids: ['hero-only'] }));

  const input = { projectDir, position: ART, workerId: '00', runner: 'pi' };
  const result = K.resolve(input);
  assert.deepEqual(result.ids, ['shared-pick', 'worker-pick']);
  assert.deepEqual(result.dirs, result.ids.map(id => skillDir(projectDir, id)));
  assert.match(result.text, /Position and worker marker[\s\S]+Worker marker/);
  assert.doesNotMatch(result.text, /Unassigned marker|hero-only|disabled-pick/);
  assert.deepEqual(K.resolve({ ...input, runner: 'codex' }), { ...result, dirs: [] });
  assert.deepEqual(K.resolve({ projectDir, position: HERO }).ids, ['hero-only']);
  assert.deepEqual(K.resolve({ projectDir, position: ART, workerId: 'someone-else' }).ids, ['shared-pick']);
  assert.deepEqual(K.resolve({ projectDir, workerId: 'unknown' }), { dirs: [], text: '', ids: [] });
  assert.deepEqual(K.resolve({ projectDir, position: 'unknown' }).ids, []);

  check(K.remove({ projectDir, id: 'worker-pick' }));
  assert.deepEqual(K.resolve(input).ids, ['shared-pick']);
  rejects(K.remove({ projectDir, id: 'worker-pick' }));
});

test('catalog sorts IDs and resolution preserves assignment order across repeated reads', t => {
  const projectDir = project(t);
  for (const id of ['zz-first', 'aa-last', 'mm-middle']) check(save(projectDir, id));
  const ids = K.list({ projectDir }).map(skill => skill.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.deepEqual(ids.filter(id => /^(aa|mm|zz)-/.test(id)), ['aa-last', 'mm-middle', 'zz-first']);
  check(K.assign({ projectDir, target: { position: HERO }, ids: ['zz-first', 'aa-last'] }));
  check(K.assign({ projectDir, target: { worker: '02' }, ids: ['mm-middle', 'zz-first'] }));
  const options = { projectDir, position: HERO, workerId: '02', runner: 'codex' };
  const result = K.resolve(options);
  assert.deepEqual(result.ids, ['zz-first', 'aa-last', 'mm-middle']);
  assert.deepEqual(K.resolve(options), result);
});

test('text budget shares space across skills without shrinking the resolved ID or pi directory lists', t => {
  const projectDir = project(t);
  const ids = ['lengthy-first', 'lengthy-second'];
  check(save(projectDir, ids[0], { body: 'A'.repeat(8000) }));
  check(save(projectDir, ids[1], { body: 'B'.repeat(8000) }));
  check(K.assign({ projectDir, target: { position: ART }, ids }));
  const options = { projectDir, position: ART, runner: 'pi' };
  const truncated = K.resolve({ ...options, budget: 120 });
  assert.deepEqual(truncated.ids, ids);
  assert.equal(truncated.dirs.length, 2);
  assert.equal(truncated.text.length, 120);
  assert.match(truncated.text, /## Skill: lengthy-first\nA+\n\n## Skill: lengthy-second\nB+$/);
  assert.equal(K.resolve(options).text.length, 3000);
  assert.deepEqual(K.resolve({ ...options, budget: 0 }), { ...truncated, text: '' });
  assert.deepEqual(K.resolve({ ...options, budget: 1 }), { ...truncated, text: '' });
});

test('reads conventional YAML metadata with block lists and applies optional defaults', t => {
  const projectDir = project(t);
  const id = 'yaml-skill';
  writeSkill(projectDir, id, [
    '---', 'name: yaml-skill # name', 'description: >-', '  Use this skill', '  for YAML entries.',
    'roles:', `  - ${HERO}`, 'tags: [local, "comma, inside"]', '__proto__:', '  polluted: true',
    'constructor: ignored', 'prototype: ignored', '---', '# Content', '',
  ].join('\n'));
  const { meta, body } = K.get(id, { projectDir });
  assert.equal(meta.description, 'Use this skill for YAML entries.');
  assert.equal(meta.enabled, true);
  assert.equal(meta.version, '1.0.0');
  assert.deepEqual(meta.roles, [HERO]);
  assert.deepEqual(meta.tags, ['local', 'comma, inside']);
  assert.equal(Object.hasOwn(meta, '__proto__'), false);
  assert.equal(Object.hasOwn(meta, 'constructor'), false);
  assert.equal(body, '# Content\n');
});

test('validates IDs, fields, version, role IDs and assignment targets before writing', t => {
  const projectDir = project(t);
  const victim = path.join(projectDir, 'SKILL.md');
  fs.writeFileSync(victim, 'untouched');
  for (const id of ['../', '../victim', 'aa/../../victim', 'aa\\victim', '/etc', 'a', 'a'.repeat(41),
    'Uppercase', 'name\n', 'constructor', 'prototype', '__proto__']) {
    rejects(save(projectDir, id));
    assert.equal(K.get(id, { projectDir }), null);
    rejects(K.setEnabled({ projectDir, id, enabled: true }));
    rejects(K.remove({ projectDir, id }));
  }
  for (const extra of [{ description: '' }, { body: [] }, { roles: ['bogus-role'] }, { roles: ART },
    { enabled: 'true' }, { tags: [{ tag: 'test' }] }, { version: '../victim' }, { version: '1.01.1' }, { version: '1.0.0-01' }]) {
    rejects(save(projectDir, 'new-skill', extra));
  }
  for (const target of [{ position: 'missing' }, { worker: '../victim' }, { worker: 'constructor' },
    { worker: '00', position: ART }, Object.create({ worker: '00' })]) {
    rejects(K.assign({ projectDir, target, ids: ['ui-ux-core'] }));
  }
  rejects(K.assign({ projectDir, target: { position: ART }, ids: ['missing-skill'] }));
  rejects(K.assign({ projectDir, target: { position: ART }, ids: ['../victim'] }));
  const builtinProject = path.join(__dirname, '..');
  rejects(save(builtinProject, 'not-builtin'));
  assert.equal(fs.readFileSync(victim, 'utf8'), 'untouched');
  assert.equal(fs.existsSync(path.join(projectDir, 'skills')), false);
  assert.equal(fs.existsSync(path.join(projectDir, 'skills.json')), false);
});

test('rejects symlinked project roots, ancestors and skills roots', t => {
  const outer = project(t);
  const actual = project(t);
  const child = path.join(actual, 'child');
  fs.mkdirSync(child);
  check(save(actual, 'local-skill'));
  check(save(child, 'local-skill'));
  const alias = path.join(outer, 'alias');
  fs.symlinkSync(actual, alias, 'dir');
  fs.symlinkSync(path.join(actual, 'skills'), path.join(outer, 'skills'), 'dir');
  for (const projectDir of [alias, path.join(alias, 'child'), outer]) {
    assert.equal(K.get('local-skill', { projectDir }), null);
    assert.deepEqual(K.list({ projectDir }), []);
    rejects(save(projectDir, 'local-skill', { body: 'unsafe write' }));
    rejects(K.remove({ projectDir, id: 'local-skill' }));
  }
  assert.equal(K.get('local-skill', { projectDir: actual }).body, '# Local workflow\n');
  assert.equal(K.get('local-skill', { projectDir: child }).body, '# Local workflow\n');
});

test('rejects symlinked skill directories, files and edit history without touching targets', t => {
  const projectDir = project(t);
  const outside = project(t);
  const outsideFile = writeSkill(outside, 'ui-ux-core', 'untouched');
  const id = 'ui-ux-core';
  const dir = skillDir(projectDir, id);
  fs.mkdirSync(path.dirname(dir));
  fs.symlinkSync(path.dirname(outsideFile), dir, 'dir');
  assert.equal(K.get(id, { projectDir }), null);
  assert.ok(!K.list({ projectDir }).some(skill => skill.id === id));
  assert.ok(!K.resolve({ projectDir, position: ART, runner: 'pi' }).ids.includes(id));
  rejects(save(projectDir, id));
  rejects(K.remove({ projectDir, id }));
  fs.unlinkSync(dir);

  fs.mkdirSync(dir);
  const file = path.join(dir, 'SKILL.md');
  fs.symlinkSync(outsideFile, file);
  assert.equal(K.get(id, { projectDir }), null);
  rejects(K.setEnabled({ projectDir, id, enabled: false }));
  rejects(K.remove({ projectDir, id }));
  fs.unlinkSync(file);

  check(save(projectDir, id));
  const history = path.join(dir, '.history');
  const localData = fs.readFileSync(file);
  fs.rmSync(history, { recursive: true });
  fs.symlinkSync(outside, history, 'dir');
  rejects(save(projectDir, id));
  rejects(K.remove({ projectDir, id }));
  fs.unlinkSync(history);
  fs.mkdirSync(history);
  fs.symlinkSync(outsideFile, path.join(history, '1.0.1.md'));
  rejects(save(projectDir, id));
  assert.deepEqual(fs.readFileSync(file), localData);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'untouched');
});

test('rejects symlinked assignment files and pi ignore files', t => {
  const projectDir = project(t);
  const outside = project(t);
  const target = path.join(outside, 'skills.json');
  fs.writeFileSync(target, '{"byPosition":{},"byWorker":{}}');
  const assignmentFile = path.join(projectDir, 'skills.json');
  fs.symlinkSync(target, assignmentFile);
  assert.deepEqual(K.assignments({ projectDir }), { byPosition: {}, byWorker: {} });
  assert.deepEqual(K.resolve({ projectDir, position: ART }).ids, []);
  rejects(K.assign({ projectDir, target: { position: ART }, ids: [] }));
  assert.equal(fs.readFileSync(target, 'utf8'), '{"byPosition":{},"byWorker":{}}');

  fs.unlinkSync(assignmentFile);
  const id = 'pi-skill';
  check(save(projectDir, id));
  check(K.assign({ projectDir, target: { position: ART }, ids: [id] }));
  fs.symlinkSync(target, path.join(skillDir(projectDir, id), '.ignore'));
  assert.deepEqual(K.resolve({ projectDir, position: ART, runner: 'pi' }), { dirs: [], text: '', ids: [] });
});

test('caps descriptions, bodies, raw files and assignments at their storage boundaries', t => {
  const projectDir = project(t);
  check(save(projectDir, 'limit-skill', { description: 'A'.repeat(300), body: '汉'.repeat(8000) }));
  assert.equal(K.get('limit-skill', { projectDir }).body.length, 8000);
  rejects(save(projectDir, 'limit-skill', { description: 'A'.repeat(301) }));
  rejects(save(projectDir, 'limit-skill', { body: 'a'.repeat(8001) }));
  rejects(save(projectDir, 'limit-skill', { tags: ['a'.repeat(9000)] }));
  assert.equal(K.get('limit-skill', { projectDir }).meta.version, '1.0.0');
  writeSkill(projectDir, 'long-body', '---\nname: long-body\ndescription: Valid\n---\n' + 'a'.repeat(8001));
  writeSkill(projectDir, 'long-file', '---\nname: long-file\ndescription: Valid\n---\n' + 'a'.repeat(40_000));
  writeSkill(projectDir, 'long-header', '---\nname: long-header\ndescription: Valid\n# ' + 'x'.repeat(8192) + '\n---\n');
  for (const id of ['long-file', 'long-body', 'long-header']) assert.equal(K.get(id, { projectDir }), null);
  fs.writeFileSync(path.join(projectDir, 'skills.json'), ' '.repeat(65_537));
  assert.deepEqual(K.resolve({ projectDir, position: ART }).ids, []);
  rejects(K.assign({ projectDir, target: { position: ART }, ids: [] }));
});

test('drops prototype keys from stored assignments and filters invalid or absent skill IDs', t => {
  const projectDir = project(t);
  const file = path.join(projectDir, 'skills.json');
  fs.writeFileSync(file, '{"__proto__":{"polluted":true},"byPosition":{"art-director":["ui-ux-core","../escape","missing-id","__proto__"]},'
    + '"byWorker":{"__proto__":["qa-verification"],"constructor":["qa-verification"],"prototype":["qa-verification"],"00":["ui-ux-core"]}}');
  const stored = K.assignments({ projectDir });
  assert.deepEqual(stored.byWorker, { '00': ['ui-ux-core'] });
  assert.deepEqual(stored.byPosition[ART], ['ui-ux-core', 'missing-id']);
  assert.deepEqual(K.resolve({ projectDir, workerId: 'constructor' }).ids, []);
  assert.deepEqual(K.resolve({ projectDir, position: ART, workerId: '00' }).ids, ['ui-ux-core']);
  check(K.assign({ projectDir, target: { worker: '00' }, ids: [] }));
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /__proto__|constructor|prototype/);
  assert.equal({}.polluted, undefined);
});
