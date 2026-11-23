'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { snapshot, list, rollback } = require('../lib/versions');

function project(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-versions-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function write(directory, name, text) {
  const file = path.join(directory, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function read(directory, name) {
  return fs.readFileSync(path.join(directory, name), 'utf8');
}

function storage(directory) {
  return path.join(directory, '.run', 'versions');
}

function writeDesign(directory, version) {
  write(directory, 'sections/01-hero.html', `<section>${version}</section>\n`);
  write(directory, 'sections/01-hero.type.css', `.hero { --current: ${version}; }\n`);
  write(directory, 'contract.json', `{"version":${version}}\n`);
}

function assertDesign(directory, version) {
  assert.equal(read(directory, 'sections/01-hero.html'), `<section>${version}</section>\n`);
  assert.equal(read(directory, 'sections/01-hero.type.css'), `.hero { --current: ${version}; }\n`);
  assert.equal(read(directory, 'contract.json'), `{"version":${version}}\n`);
}

test('list starts empty without creating version storage', t => {
  const directory = project(t);
  assert.deepEqual(list(directory), []);
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('snapshot, list, and rollback round trip while preserving unrelated project files', t => {
  const directory = project(t);
  const outside = ['agents.json', 'tokens.css', 'dist/index.html', '.run/metrics.jsonl', 'sections-other/01-hero.html'];
  for (const name of outside) write(directory, name, 'original');
  writeDesign(directory, 1);
  write(directory, 'sections/shared/asset.txt', 'snapshot asset');
  const first = snapshot(directory, 'Before composing');

  writeDesign(directory, 2);
  fs.rmSync(path.join(directory, 'sections/shared'), { recursive: true });
  write(directory, 'sections/02-footer.html', 'new section');
  for (const name of outside) write(directory, name, 'changed after snapshot');
  const second = snapshot(directory, 'After composing');
  const versions = list(directory);
  assert.deepEqual(versions.map(({ id, label }) => ({ id, label })), [
    { id: second, label: 'After composing' }, { id: first, label: 'Before composing' },
  ]);
  assert.ok(versions.every(({ createdAt }) => Number.isFinite(Date.parse(createdAt))));

  rollback(directory, first);
  assertDesign(directory, 1);
  assert.equal(read(directory, 'sections/shared/asset.txt'), 'snapshot asset');
  assert.equal(fs.existsSync(path.join(directory, 'sections/02-footer.html')), false);
  for (const name of outside) {
    assert.equal(read(directory, name), 'changed after snapshot');
    assert.equal(fs.existsSync(path.join(storage(directory), first, name)), false);
  }

  rollback(directory, second);
  assertDesign(directory, 2);
  assert.equal(read(directory, 'sections/02-footer.html'), 'new section');
  assert.equal(fs.existsSync(path.join(directory, 'sections/shared')), false);
  assert.deepEqual(list(directory), versions);
});

test('rollback restores the absence of a contract in pre-Fast Path projects', t => {
  const directory = project(t);
  write(directory, 'sections/01-hero.html', 'original section');
  const id = snapshot(directory, 'No initial contract');
  writeDesign(directory, 2);

  rollback(directory, id);
  assert.equal(read(directory, 'sections/01-hero.html'), 'original section');
  assert.deepEqual(fs.readdirSync(path.join(directory, 'sections')), ['01-hero.html']);
  assert.equal(fs.existsSync(path.join(directory, 'contract.json')), false);
});

test('rollback restores the absence of both paths for an empty project', t => {
  const directory = project(t);
  const id = snapshot(directory);
  writeDesign(directory, 1);
  rollback(directory, id);
  assert.equal(fs.existsSync(path.join(directory, 'sections')), false);
  assert.equal(fs.existsSync(path.join(directory, 'contract.json')), false);
});

test('only the last 20 snapshots remain, including snapshots in the same clock tick', t => {
  const directory = project(t);
  const ids = [];
  t.mock.method(Date, 'now', () => 1700000000000);
  for (let number = 1; number <= 23; number += 1) {
    writeDesign(directory, number);
    ids.push(snapshot(directory, `Version ${number}`));
  }

  const expected = ids.slice(3).reverse();
  assert.equal(new Set(ids).size, 23);
  assert.deepEqual(list(directory).map(version => version.id), expected);
  assert.deepEqual(fs.readdirSync(storage(directory)).sort(), [...expected].sort());
  assert.throws(() => rollback(directory, ids[2]), /Unknown snapshot/);
  assertDesign(directory, 23);
  rollback(directory, ids[3]);
  assertDesign(directory, 4);
});

test('restoring the oldest retained version installs it and saves the current design as undo', t => {
  const directory = project(t);
  const ids = [];
  for (let number = 1; number <= 20; number++) {
    writeDesign(directory, number);
    ids.push(snapshot(directory, `Design ${number}`));
  }
  writeDesign(directory, 21);
  write(directory, 'assets/retain.txt', 'outside both versions');

  const undo = rollback(directory, ids[0], {
    backupLabel: 'Before restore',
    canRestore: ({ id, source }) => {
      assert.equal(id, ids[0]);
      assertDesign(source, 1);
      assertDesign(directory, 21);
      return true;
    },
  });
  assertDesign(directory, 1);
  const saved = list(directory);
  assert.equal(saved.length, 20);
  assert.equal(saved[0].id, undo);
  assert.equal(saved.at(-1).id, ids[0]);
  assertDesign(path.join(storage(directory), undo), 21);
  assert.equal(read(directory, 'assets/retain.txt'), 'outside both versions');
});

test('a blocked restore does not save an undo or change live files', t => {
  const directory = project(t);
  writeDesign(directory, 1);
  const id = snapshot(directory, 'Locked design');
  writeDesign(directory, 2);

  assert.throws(() => rollback(directory, id, {
    backupLabel: 'Before restore',
    canRestore: ({ source }) => {
      assertDesign(source, 1);
      return 'The approved anchor is different.';
    },
  }), /The approved anchor is different/);
  assertDesign(directory, 2);
  assert.deepEqual(fs.readdirSync(storage(directory)), [id]);
});

test('a missing snapshot entry is rejected before replacing either live path', t => {
  const directory = project(t);
  writeDesign(directory, 1);
  const id = snapshot(directory, 'Incomplete snapshot');
  fs.rmSync(path.join(storage(directory), id, 'contract.json'));
  writeDesign(directory, 2);

  assert.throws(() => rollback(directory, id), /Incomplete snapshot/);
  assertDesign(directory, 2);
  assert.deepEqual(fs.readdirSync(storage(directory)), [id]);
});

test('failed staging copy leaves the live design intact and removes temporary files', t => {
  const directory = project(t);
  writeDesign(directory, 1);
  const id = snapshot(directory, 'Before bad snapshot file');
  const outside = 'do-not-touch.txt';
  write(directory, outside, 'outside bytes');
  fs.symlinkSync(path.join(directory, outside), path.join(storage(directory), id, 'sections', 'link'));
  writeDesign(directory, 2);

  assert.throws(() => rollback(directory, id), /Unexpected file type/);
  assertDesign(directory, 2);
  assert.equal(read(directory, outside), 'outside bytes');
  assert.deepEqual(fs.readdirSync(storage(directory)), [id]);
});

test('a failure after switching sections restores both original live entries', t => {
  const directory = project(t);
  writeDesign(directory, 1);
  const id = snapshot(directory, 'Before live changes');
  writeDesign(directory, 2);
  write(directory, 'sections/02-footer.css', 'current only');
  write(directory, 'tokens.css', 'outside');
  const rename = fs.renameSync;
  let injected = false;
  t.mock.method(fs, 'renameSync', (source, target) => {
    if (path.basename(path.dirname(source)) === 'candidate' &&
        path.basename(source) === 'contract.json' && target === path.join(directory, 'contract.json')) {
      assert.equal(read(directory, 'sections/01-hero.html'), '<section>1</section>\n');
      injected = true;
      throw new Error('Injected install failure');
    }
    return rename(source, target);
  });

  assert.throws(() => rollback(directory, id, { backupLabel: 'Before restore' }), /Injected install failure/);
  assert.equal(injected, true);
  assertDesign(directory, 2);
  assert.equal(read(directory, 'sections/02-footer.css'), 'current only');
  assert.equal(read(directory, 'tokens.css'), 'outside');
  assert.deepEqual(fs.readdirSync(storage(directory)), [id]);
});

test('snapshot and rollback reject symlinked paths and traversal ids', t => {
  const directory = project(t);
  const outside = project(t);
  write(outside, 'preserve.txt', 'original');
  fs.symlinkSync(outside, path.join(directory, 'sections'), 'dir');
  assert.throws(() => snapshot(directory, 'Symlink'), /Unexpected file type/);
  assert.throws(() => rollback(directory, '../outside'), /Invalid snapshot id/);
  assert.equal(read(outside, 'preserve.txt'), 'original');
  assert.deepEqual(fs.readdirSync(outside), ['preserve.txt']);
});
