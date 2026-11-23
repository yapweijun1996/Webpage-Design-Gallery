'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { setImmediate: nextTurn } = require('node:timers/promises');
const test = require('node:test');
const { build } = require('../lib/ownership');
const I = require('../lib/integrator');

const HEADER = 'sections/01-header.html';
const HEADER_CSS = 'sections/01-header.css';
const HERO = 'sections/02-hero.html';
const LAYER = 'sections/01-header.layout.css';
const ASSET = 'assets/generated/01-header-nav.svg';
const ANCHOR = 'anchors/v001/anchor.desktop.png';
const STORE = '.run/component-snapshots';
const header = text => `<header id="01-header" class="s-01">${text}</header>\n`;
const hero = text => `<section id="02-hero" class="s-02"><h1>${text}</h1></section>\n`;
const originalCss = '.s-01 { display: block; }\n';
const fixture = {
  [HEADER]: header('Original header'), [HEADER_CSS]: originalCss,
  [HERO]: hero('Original hero'), 'sections/02-hero.css': '.s-02 { display: block; }\n',
  'sections/03-brands.html': '<section id="03-brands" class="s-03"></section>\n',
  'sections/03-brands.css': '.s-03 { display: block; }\n',
  'sections/04-footer.html': '<footer id="04-footer" class="s-04"></footer>\n',
  'sections/04-footer.css': '.s-04 { display: block; }\n',
  'brief.md': 'Project brief', 'tokens.css': ':root {}\n', 'contract.json': '{}',
  'agents.json': '[]', 'ownership.json': '{}', [ANCHOR]: 'immutable image',
  'design-system/tokens.json': '{}', 'notes/01.md': 'Header notes', 'notes/02.md': 'Hero notes',
  'chat/01.jsonl': '', 'chat/02.jsonl': '', '.run/secret': 'private',
};
const agents = [
  { id: '01', section: 'header' }, { id: '02', section: 'hero' },
  { id: '03', section: 'brands' }, { id: '04', section: 'footer' },
];
const manifest = build({ agents });
const launchManifest = () => build({ agents: [{ id: '00' }, ...agents], launchContext: true });

function write(dir, relative, data) {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function read(dir, relative) {
  return fs.readFileSync(path.join(dir, relative), 'utf8');
}

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-integrator-'));
  const project = path.join(root, 'project');
  const workspaces = [];
  for (const [relative, bytes] of Object.entries(fixture)) write(project, relative, bytes);
  t.after(() => {
    try {
      for (const ws of workspaces) I.close(ws);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
  return { root, project, open(id = '01', ownership = manifest, options) {
    const ws = I.open(project, id, ownership, options);
    workspaces.push(ws);
    return ws;
  } };
}

function rejection(result, code, relative) {
  assert.equal(result.ok, false);
  assert.deepEqual(result.merged, []);
  assert.equal(result.snapshotId, null);
  assert.deepEqual(result.rejected.map(item => [item.code, item.path]), [[code, relative]]);
  assert.ok(result.rejected[0].message);
}

test('isolates a writable Header workspace and merges only its hashed additions, changes and removals', t => {
  const { project, open } = setup(t);
  const ws = open();
  assert.equal(ws.dir, path.join(fs.realpathSync.native(project), '.run/ws', ws.id));
  assert.deepEqual(ws.base[HEADER], { sha256: createHash('sha256').update(fixture[HEADER]).digest('hex') });
  assert.deepEqual(I.diff(ws), { added: [], changed: [], removed: [] });
  for (const file of [HERO, 'tokens.css', 'brief.md', ANCHOR, 'design-system/tokens.json']) {
    assert.equal(read(ws.dir, file), fixture[file]);
  }
  for (const file of ['agents.json', 'ownership.json', 'notes/02.md', 'chat/02.jsonl', '.run/secret']) {
    assert.equal(fs.existsSync(path.join(ws.dir, file)), false, file);
  }

  write(ws.dir, HEADER, header('Header revision'));
  write(ws.dir, LAYER, '.s-01 > nav { display: flex; }\n');
  write(ws.dir, ASSET, '<svg/>');
  fs.unlinkSync(path.join(ws.dir, 'notes/01.md'));
  assert.equal(read(project, HEADER), fixture[HEADER]);
  assert.deepEqual(I.diff(ws), { added: [ASSET, LAYER], changed: [HEADER], removed: ['notes/01.md'] });
  assert.deepEqual(I.validate(ws, manifest), { ok: true, violations: [] });
  const result = I.merge(project, ws, manifest);
  assert.equal(result.ok, true);
  assert.ok(result.snapshotId);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.merged, [ASSET, 'notes/01.md', HEADER, LAYER]);
  assert.equal(read(project, HEADER), header('Header revision'));
  assert.equal(read(project, ASSET), '<svg/>');
  assert.equal(fs.existsSync(path.join(project, 'notes/01.md')), false);
  for (const file of [HERO, 'sections/03-brands.html', 'sections/04-footer.html', 'tokens.css']) {
    assert.equal(read(project, file), fixture[file]);
  }
  I.close(ws);
  assert.equal(fs.existsSync(ws.dir), false);
  assert.throws(() => I.diff(ws), /closed workspace/);
});

test('launch copies only needed readonly context and stages a fresh worker outbox', t => {
  const { project, open } = setup(t);
  const active = launchManifest();
  const outbox = 'chat/01.jsonl';
  const oldPosts = '{"text":"Already accepted"}\n';
  const newPosts = '{"text":"New handoff"}\n';
  const readonly = {
    'channel.md': 'Previous conversation', 'staff/handbook/qa.md': 'Verify the section',
    'notes/02.md': 'Hero notes', 'discussion/02.md': 'Hero proposal', 'inbox/01.md': 'Owner request',
    'assets/reference pack/新月.png': 'shared asset', [ANCHOR]: fixture[ANCHOR],
    'i18n/ms.json': '{"messages":{"heading":"Tajuk"}}',
  };
  const privateFiles = {
    'inbox/02.md': 'Another worker inbox', 'channel.jsonl': 'Canonical log',
    'notes/99.md': 'Retired notes', 'chat/02.jsonl': 'Another worker outbox',
    'chat/.offsets.json': '{}', 'names.json': '{}', 'skills.json': '{}',
    'skills/local/SKILL.md': 'Resolver input', 'dist/index.html': 'Runtime bundle', '.run/secret': 'private',
    'i18n/local.md': 'Not a preview catalog',
  };
  for (const [file, data] of Object.entries({ ...readonly, ...privateFiles, [outbox]: oldPosts })) write(project, file, data);
  const ws = open('01', active);
  for (const [file, data] of Object.entries(readonly)) {
    assert.equal(read(ws.dir, file), data, file);
    const source = fs.statSync(path.join(project, file));
    const copy = fs.statSync(path.join(ws.dir, file));
    assert.notEqual(copy.ino, source.ino, file);
    assert.equal(copy.nlink, 1, file);
    assert.equal(copy.mode & 0o777, 0o400, file);
  }
  for (const file of Object.keys(privateFiles)) assert.equal(fs.existsSync(path.join(ws.dir, file)), false, file);
  assert.deepEqual(I.diff(ws), { added: [], changed: [], removed: [] });
  assert.equal(I.workerOutbox(ws).length, 0);

  fs.appendFileSync(path.join(ws.dir, outbox), newPosts);
  write(ws.dir, 'discussion/01.md', 'Header proposal');
  write(ws.dir, HEADER, header('Accepted header'));
  assert.equal(I.workerOutbox(ws).toString('utf8'), newPosts);
  const result = I.merge(project, ws, active);
  assert.equal(result.ok, true);
  assert.deepEqual(result.merged, ['discussion/01.md', HEADER]);
  assert.equal(read(project, outbox), oldPosts);
  assert.equal(read(project, 'channel.jsonl'), privateFiles['channel.jsonl']);
  assert.equal(read(project, 'discussion/01.md'), 'Header proposal');
});

test('launch freezes ownership and limits the worker transport to 64 KiB', t => {
  const { project, open } = setup(t);
  const active = launchManifest();
  write(project, 'inbox/01.md', 'Original instruction');
  const first = open('01', active);
  const inbox = 'inbox/01.md';
  fs.chmodSync(path.join(first.dir, inbox), 0o600);
  write(first.dir, inbox, 'Edited instruction');
  active.owned[inbox] = '01';
  rejection(I.merge(project, first, active), 'shared', inbox);
  assert.equal(read(project, inbox), 'Original instruction');

  const second = open('01', launchManifest());
  const workerBox = 'chat/01.jsonl';
  write(second.dir, workerBox, 'x'.repeat(64 * 1024 + 1));
  assert.throws(() => I.workerOutbox(second), /byte limit/);
  rejection(I.merge(project, second, launchManifest()), 'size', workerBox);
  assert.equal(read(project, workerBox), fixture[workerBox]);
});

test('Manager launch publishes planning documents and has no live outbox', t => {
  const { project, open } = setup(t);
  const active = launchManifest();
  write(project, 'chat/00.jsonl', 'Archived Manager input');
  write(project, 'inbox/00.md', 'Owner direction for the Manager');
  write(project, 'discussion/01.md', 'Header proposal');
  const ws = open('00', active);
  assert.equal(I.workerOutbox(ws), null);
  assert.equal(fs.existsSync(path.join(ws.dir, 'chat/00.jsonl')), false);
  assert.equal(read(ws.dir, 'discussion/01.md'), 'Header proposal');
  assert.equal(read(ws.dir, 'inbox/00.md'), 'Owner direction for the Manager');
  write(ws.dir, 'direction.md', 'Direction');
  write(ws.dir, 'review1.md', 'Review');
  write(ws.dir, 'research.md', 'Research');
  const result = I.merge(project, ws, active);
  assert.equal(result.ok, true);
  assert.deepEqual(result.merged, ['direction.md', 'research.md', 'review1.md']);
  assert.equal(read(project, 'chat/00.jsonl'), 'Archived Manager input');
});

test('pins selected Pi skill files in the launch workspace without copying private or unselected content', async t => {
  const { project, open } = setup(t);
  const selected = 'skills/review-layout';
  const original = '# Review the assigned layout';
  write(project, `${selected}/SKILL.md`, original);
  write(project, `${selected}/.history/1.0.0.md`, 'Previous content');
  write(project, `${selected}/.ignore`, 'Ignored names');
  write(project, 'skills/unselected/SKILL.md', 'Unselected instructions');
  const local = fs.realpathSync.native(path.join(project, selected));
  const builtin = fs.realpathSync.native(path.join(__dirname, '../skills/accessibility'));
  const ws = open('01', launchManifest(), { skillDirs: [local, builtin] });
  assert.ok(Object.isFrozen(ws.skillDirs));
  assert.deepEqual(ws.skillDirs, ['review-layout', 'accessibility'].map(id => path.join(ws.dir, '.launch-skills', id)));
  assert.equal(read(ws.skillDirs[0], 'SKILL.md'), original);
  assert.equal(read(ws.skillDirs[1], 'SKILL.md'), read(builtin, 'SKILL.md'));
  assert.deepEqual(fs.readdirSync(ws.skillDirs[0]), ['SKILL.md']);
  assert.equal(fs.existsSync(path.join(ws.dir, 'skills')), false);
  assert.equal(fs.statSync(path.join(ws.skillDirs[0], 'SKILL.md')).mode & 0o777, 0o400);
  assert.deepEqual(I.diff(ws), { added: [], changed: [], removed: [] });
  assert.throws(() => open('01', launchManifest(), { skillDirs: [path.dirname(local)] }), /Invalid selected skill directory/);

  write(project, `${selected}/SKILL.md`, '# New instructions');
  assert.equal(read(ws.skillDirs[0], 'SKILL.md'), original);
  fs.chmodSync(path.join(ws.skillDirs[0], 'SKILL.md'), 0o600);
  write(ws.skillDirs[0], 'SKILL.md', '# Changed inside the runner');
  const result = await I.publish(project, ws, { accept: () => assert.fail('Skill edits must fail before acceptance') });
  rejection(result, 'forbidden', '.launch-skills/review-layout/SKILL.md');
  assert.equal(read(project, `${selected}/SKILL.md`), '# New instructions');
});

test('checks the exact rendered candidate and publishes only the checked bytes and private posts', async t => {
  const { project, open } = setup(t);
  const outbox = 'chat/01.jsonl';
  const posts = '{"text":"Header is ready."}\n';
  const catalog = 'i18n/ms.json';
  const context = {
    [catalog]: '{"messages":{"heading":"Tajuk"}}',
    'design-system/themes.css': ':root { --background: white; }',
    'assets/generated/03-brands-cover.webp': 'Existing image',
    'anchors/v001/meta.json': '{"id":"v001"}',
    'anchors/flow.json': '{"state":"locked"}',
  };
  for (const [file, data] of Object.entries(context)) write(project, file, data);
  fs.chmodSync(path.join(project, ANCHOR), 0o444);
  const ws = open('01', launchManifest());
  write(ws.dir, HEADER, header('Checked header'));
  write(ws.dir, ASSET, '<svg/>');
  write(ws.dir, outbox, posts);
  let parent;
  const result = await I.publish(project, ws, { anchorId: 'v001', async accept(review) {
    const { before, after } = review;
    parent = path.dirname(before);
    assert.notEqual(after, before);
    assert.notEqual(before, project);
    assert.equal(path.dirname(after), parent);
    assert.equal(review.anchorId, 'v001');
    assert.equal(review.workerId, '01');
    assert.equal(review.outbox, posts);
    assert.deepEqual(review.changed, [ASSET, HEADER]);
    assert.deepEqual(review.sections, ['01-header']);
    assert.ok(Object.isFrozen(review) && Object.isFrozen(review.changed) && Object.isFrozen(review.sections));
    for (const dir of [before, after]) {
      for (const [file, data] of Object.entries(context)) assert.equal(read(dir, file), data);
      for (const file of [outbox, '.run/secret', 'channel.md', 'agents.json', 'anchors/log.jsonl']) {
        assert.equal(fs.existsSync(path.join(dir, file)), false, file);
      }
      assert.equal(read(dir, 'contract.json'), fixture['contract.json']);
      assert.equal(fs.statSync(path.join(dir, ANCHOR)).mode & 0o777, 0o444);
    }
    assert.equal(read(before, HEADER), fixture[HEADER]);
    assert.equal(read(after, HEADER), header('Checked header'));
    assert.equal(fs.existsSync(path.join(before, ASSET)), false);
    assert.equal(read(after, ASSET), '<svg/>');
    await nextTurn();
    assert.equal(read(project, HEADER), fixture[HEADER]);
    assert.equal(read(project, outbox), '');
    return { ok: true };
  } });
  assert.equal(result.ok, true);
  assert.ok(result.snapshotId);
  assert.deepEqual(result.merged, [ASSET, HEADER]);
  assert.equal(result.outbox.toString(), posts);
  assert.equal(read(project, outbox), '');
  assert.equal(read(project, HEADER), header('Checked header'));
  assert.equal(fs.existsSync(parent), false);
  rejection(await I.publish(project, ws, { accept: () => assert.fail('May not publish one launch twice') }), 'busy', '');
});

test('checks docs and outbox-only publication without allocating render copies', async t => {
  const { project, open } = setup(t);
  const ws = open('01', launchManifest());
  write(ws.dir, 'discussion/01.md', 'Ready for the next wave.');
  write(ws.dir, 'chat/01.jsonl', '{"text":"Ready."}\n');
  const denied = await I.publish(project, ws, { accept({ before, after, sections, outbox }) {
    assert.equal(before, null);
    assert.equal(after, null);
    assert.deepEqual(sections, []);
    assert.equal(outbox, '{"text":"Ready."}\n');
    return { ok: false, rejected: [{ code: 'closed', path: '', message: 'The owner closed the run.' }] };
  } });
  rejection(denied, 'closed', '');
  assert.equal(denied.outbox, null);
  assert.equal(fs.existsSync(path.join(project, 'discussion/01.md')), false);
  assert.equal(fs.existsSync(path.join(project, STORE)), false);
  const accepted = await I.publish(project, ws, { accept: () => ({ ok: true }) });
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.merged, ['discussion/01.md']);
  assert.equal(read(project, 'discussion/01.md'), 'Ready for the next wave.');
});

for (const [surface, relative, mutate] of [
  ['live peer', HERO, ({ project }) => write(project, HERO, hero('A newer peer edit'))],
  ['live anchor state', 'anchors/flow.json', ({ project }) => write(project, 'anchors/flow.json', '{"state":"goals"}')],
  ['accepted preview', HEADER, ({ after }) => write(after, HEADER, header('Rendered from different bytes'))],
  ['worker edit', HEADER, ({ ws }) => write(ws.dir, HEADER, header('Changed during review'))],
  ['worker post', 'chat/01.jsonl', ({ ws }) => write(ws.dir, 'chat/01.jsonl', '{"text":"Newer post"}\n')],
]) {
  test(`rejects a pending acceptance if its ${surface} changes`, async t => {
    const { project, open } = setup(t);
    const ws = open('01', launchManifest());
    write(ws.dir, HEADER, header('Candidate header'));
    let parent;
    const result = await I.publish(project, ws, { async accept({ before, after }) {
      parent = path.dirname(before);
      await nextTurn();
      mutate({ after, project, ws });
      return { ok: true };
    } });
    rejection(result, 'stale', relative);
    assert.equal(result.outbox, null);
    assert.equal(read(project, HEADER), fixture[HEADER]);
    assert.equal(fs.existsSync(path.join(project, STORE)), false);
    assert.equal(fs.existsSync(parent), false);
  });
}

test('uses the project lock for the commit after acceptance', async t => {
  const { project, open } = setup(t);
  const ws = open('01', launchManifest());
  const lock = path.join(path.dirname(project), '.project.init');
  write(ws.dir, HEADER, header('Candidate header'));
  const result = await I.publish(project, ws, { accept() {
    fs.mkdirSync(lock);
    return { ok: true };
  } });
  rejection(result, 'busy', '');
  assert.equal(read(project, HEADER), fixture[HEADER]);
  assert.equal(fs.existsSync(path.join(project, STORE)), false);
  assert.equal(fs.statSync(lock).isDirectory(), true);
  fs.rmdirSync(lock);
  assert.equal((await I.publish(project, ws, { accept: () => ({ ok: true }) })).ok, true);
});

for (const [relative, code] of [[HERO, 'foreign'], ['tokens.css', 'shared'], [ANCHOR, 'forbidden'],
  ['agents.json', 'forbidden'], ['.run/escape', 'forbidden']]) {
  test(`rejects ${relative} as ${code} and leaves the entire batch unchanged`, t => {
    const { project, open } = setup(t);
    const ws = open();
    write(ws.dir, HEADER, header('Allowed in isolation'));
    write(ws.dir, relative, 'Unauthorized change');
    assert.equal(I.validate(ws, manifest).violations[0].code, code);
    rejection(I.merge(project, ws, manifest, { approved: true }), code, relative);
    assert.equal(read(project, HEADER), fixture[HEADER]);
    if (Object.hasOwn(fixture, relative)) assert.equal(read(project, relative), fixture[relative]);
    else assert.equal(fs.existsSync(path.join(project, relative)), false);
    assert.equal(fs.existsSync(path.join(project, STORE)), false);
  });
}

test('the first workspace to merge an overlapping path wins even if the desired hashes match', t => {
  const { project, open } = setup(t);
  const first = open();
  const second = open();
  write(first.dir, HEADER, header('New header'));
  write(second.dir, HEADER, header('New header'));
  write(second.dir, LAYER, '.s-01 { display: grid; }');
  assert.equal(I.merge(project, first, manifest).ok, true);
  rejection(I.merge(project, second, manifest), 'overlap', HEADER);
  assert.equal(read(project, HEADER), header('New header'));
  assert.equal(fs.existsSync(path.join(project, LAYER)), false);
});

test('rejects an independently changed live file as stale and accepts identical content idempotently', t => {
  const { project, open } = setup(t);
  const ws = open();
  write(project, HEADER, header('External edit'));
  write(ws.dir, HEADER, header('Workspace edit'));
  rejection(I.merge(project, ws, manifest), 'stale', HEADER);
  assert.equal(read(project, HEADER), header('External edit'));

  write(ws.dir, HEADER, header('External edit'));
  assert.deepEqual(I.merge(project, ws, manifest), { ok: true, merged: [], rejected: [], snapshotId: null });
});

for (const [relative, content] of [
  [HEADER_CSS, '.s-02 .title { display: none; }'],
  [LAYER, '@media (min-width: 30em) { .s-01, body { display: none; } }'],
  [HEADER, '<header id="01-header" class="s-01"><style>body { display: none; }</style></header>'],
]) {
  test(`rejects out-of-scope selectors in ${relative} before touching the live project`, t => {
    const { project, open } = setup(t);
    const ws = open();
    write(ws.dir, ASSET, '<svg/>');
    write(ws.dir, relative, content);
    const result = I.merge(project, ws, manifest);
    rejection(result, 'scope', relative);
    assert.equal(read(project, HEADER), fixture[HEADER]);
    assert.equal(read(project, HEADER_CSS), originalCss);
    assert.equal(fs.existsSync(path.join(project, STORE)), false);
    assert.equal(fs.existsSync(path.join(project, ASSET)), false);
  });
}

test('applies the file size cap in bytes and rejects malformed CSS', t => {
  const { project, open } = setup(t);
  const ws = open();
  write(ws.dir, LAYER, '.s-01 { content: "汉"; }');
  const maxFileBytes = read(ws.dir, LAYER).length;
  rejection(I.merge(project, ws, manifest, { maxFileBytes }), 'size', LAYER);
  write(ws.dir, LAYER, '.s-01 { display: grid;');
  rejection(I.merge(project, ws, manifest), 'invalid-css', LAYER);
  assert.equal(fs.existsSync(path.join(project, LAYER)), false);
  write(ws.dir, LAYER, '/* } */ .s-01::after { content: "[}"; }');
  assert.equal(I.merge(project, ws, manifest).ok, true);
});

test('a mid-merge failure undoes additions and removals and permits retry', t => {
  const { project, open } = setup(t);
  const ws = open();
  const liveProject = fs.realpathSync.native(project);
  write(ws.dir, ASSET, '<svg/>');
  fs.unlinkSync(path.join(ws.dir, HEADER_CSS));
  write(ws.dir, HEADER, header('Header revision'));
  fs.chmodSync(path.join(project, HEADER_CSS), 0o640);
  const rename = fs.renameSync;
  let attempted = false;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === path.join(liveProject, HEADER)) {
      attempted = true;
      assert.equal(read(project, ASSET), '<svg/>');
      assert.equal(fs.existsSync(path.join(project, HEADER_CSS)), false);
      assert.equal(fs.readdirSync(path.join(project, STORE)).filter(name => !name.startsWith('.')).length, 1);
      throw Object.assign(new Error('Injected rename failure'), { code: 'EIO' });
    }
    return rename(from, to);
  });
  rejection(I.merge(project, ws, manifest), 'io', '');
  assert.equal(attempted, true);
  assert.equal(read(project, HEADER), fixture[HEADER]);
  assert.equal(read(project, HEADER_CSS), originalCss);
  assert.equal(fs.statSync(path.join(project, HEADER_CSS)).mode & 0o777, 0o640);
  assert.equal(fs.existsSync(path.join(project, 'assets')), false);
  assert.deepEqual(fs.readdirSync(path.join(project, STORE)), []);
  t.mock.restoreAll();
  assert.equal(I.merge(project, ws, manifest).ok, true);
});

test('rollback restores the component files and preserves an unrelated later merge', t => {
  const { project, open } = setup(t);
  const headerWs = open();
  const heroWs = open('02');
  write(headerWs.dir, HEADER, header('Updated header'));
  write(headerWs.dir, ASSET, '<svg/>');
  fs.unlinkSync(path.join(headerWs.dir, HEADER_CSS));
  const headerMerge = I.merge(project, headerWs, manifest);
  assert.equal(headerMerge.ok, true);
  write(heroWs.dir, HERO, hero('Updated hero'));
  assert.equal(I.merge(project, heroWs, manifest).ok, true);

  assert.throws(() => I.rollback(project, headerMerge.snapshotId, { paths: [HEADER, HERO] }), /belong/);
  assert.throws(() => I.rollback(project, headerMerge.snapshotId, { paths: ['../outside'] }), /belong/);
  assert.throws(() => I.rollback(project, '../outside'), /Invalid snapshot ID/);
  assert.equal(read(project, HEADER), header('Updated header'));
  const subset = I.rollback(project, headerMerge.snapshotId, { paths: [ASSET] });
  assert.deepEqual(subset.restored, [ASSET]);
  assert.equal(fs.existsSync(path.join(project, ASSET)), false);
  assert.equal(read(project, HEADER), header('Updated header'));
  const restored = I.rollback(project, headerMerge.snapshotId);
  assert.deepEqual(restored.restored, [HEADER_CSS, HEADER]);
  assert.equal(read(project, HEADER), fixture[HEADER]);
  assert.equal(read(project, HEADER_CSS), originalCss);
  assert.equal(read(project, HERO), hero('Updated hero'));
});

test('forbids workspace symlinks, hardlinks and file-to-directory substitutions', t => {
  const { root, project, open } = setup(t);
  const ws = open();
  const outside = path.join(root, 'outside');
  fs.writeFileSync(outside, 'Outside contents');
  fs.unlinkSync(path.join(ws.dir, HEADER));
  fs.symlinkSync(outside, path.join(ws.dir, HEADER));
  rejection(I.merge(project, ws, manifest), 'forbidden', HEADER);
  fs.unlinkSync(path.join(ws.dir, HEADER));
  fs.linkSync(outside, path.join(ws.dir, HEADER));
  rejection(I.merge(project, ws, manifest), 'forbidden', HEADER);
  fs.unlinkSync(path.join(ws.dir, HEADER));
  fs.mkdirSync(path.join(ws.dir, HEADER));
  rejection(I.merge(project, ws, manifest), 'forbidden', HEADER);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'Outside contents');
  assert.equal(read(project, HEADER), fixture[HEADER]);
});

test('forbids symlink substitutions in live parents and storage before reading or writing through them', t => {
  const { root, project, open } = setup(t);
  const outside = path.join(root, 'outside');
  const alias = path.join(root, 'project-alias');
  fs.mkdirSync(outside);
  const ws = open();
  fs.symlinkSync(project, alias, 'dir');
  assert.throws(() => I.open(`${alias}/`, '01', manifest), /Unsafe path/);
  write(ws.dir, ASSET, '<svg/>');
  fs.symlinkSync(outside, path.join(project, 'assets'), 'dir');
  rejection(I.merge(project, ws, manifest), 'forbidden', ASSET);
  assert.throws(() => open(), /Unsafe path/);
  fs.unlinkSync(path.join(project, 'assets'));

  fs.symlinkSync(outside, path.join(project, STORE), 'dir');
  rejection(I.merge(project, ws, manifest), 'forbidden', STORE);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.existsSync(path.join(project, ASSET)), false);
});

test('never follows a replaced workspace root and only closes the workspace link', t => {
  const { root, project, open } = setup(t);
  const ws = open();
  const outside = path.join(root, 'outside');
  fs.renameSync(ws.dir, outside);
  fs.symlinkSync(outside, ws.dir, 'dir');
  rejection(I.merge(project, ws, manifest), 'forbidden', `.run/ws/${ws.id}`);
  I.close(ws);
  assert.equal(fs.lstatSync(ws.dir, { throwIfNoEntry: false }), undefined);
  assert.equal(read(outside, HEADER), fixture[HEADER]);
});

test('rejects unsafe filenames and forged workspace handles without changing the live project', t => {
  const { project, open } = setup(t);
  const ws = open();
  write(ws.dir, 'sections\\01-header.css', 'Alternate separator');
  rejection(I.merge(project, ws, manifest), 'forbidden', 'sections\\01-header.css');
  fs.unlinkSync(path.join(ws.dir, 'sections\\01-header.css'));
  write(ws.dir, '__proto__/tokens.css', 'Prototype path');
  rejection(I.merge(project, ws, manifest), 'forbidden', '__proto__');
  assert.throws(() => I.merge(project, { ...ws, base: JSON.parse('{"__proto__":{"sha256":"fake"}}') }, manifest),
    /Unknown or closed workspace/);
  assert.equal(read(project, HEADER_CSS), originalCss);
  assert.equal(Object.hasOwn({}, 'sha256'), false);
});
