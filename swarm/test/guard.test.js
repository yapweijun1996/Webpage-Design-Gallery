'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const guard = require('../lib/guard');

const WORKER_GLOBS = ['sections/02-*.html', 'sections/02-*.css', 'notes/02.md', 'discussion/02.md', 'chat/02.jsonl'];

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-guard-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(dir, file, content = 'initial') {
  const absolute = path.join(dir, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
  return absolute;
}

test('violations report unowned edits, additions and deletions and accept worker ownership globs', t => {
  const dir = tempDir(t);
  const owned = ['sections/02-hero.html', 'sections/02-hero.css', 'notes/02.md', 'discussion/02.md'];
  for (const file of [...owned, 'sections/03-other.html', 'decisions.md', 'unchanged.md']) write(dir, file);
  const before = guard.snapshot(dir);
  assert.deepEqual(guard.violations(before, before, WORKER_GLOBS), []);

  for (const file of [...owned.slice(0, 3), 'sections/03-other.html']) write(dir, file, 'updated copy');
  for (const file of ['discussion/02.md', 'decisions.md']) fs.unlinkSync(path.join(dir, file));
  for (const file of [
    'sections/02-new.html', 'sections/02-hero/detail.html', 'sections/02-fakeXhtml', 'sections/02-render.js',
    'sections/020-extra.html', 'elsewhere/sections/02-hero.html', 'notes/03.md',
  ]) write(dir, file);

  const after = guard.snapshot(dir);
  assert.deepEqual(guard.violations(before, after, WORKER_GLOBS), [
    'decisions.md', 'elsewhere/sections/02-hero.html', 'notes/03.md', 'sections/02-fakeXhtml',
    'sections/02-hero/detail.html', 'sections/02-render.js', 'sections/020-extra.html', 'sections/03-other.html',
  ]);
  assert.ok(guard.violations(before, after, []).includes('sections/02-new.html'));
  assert.ok(!after.has('discussion/02.md'));
});

test('root ignores cover chat, channel files, checkpoint and dist', t => {
  const dir = tempDir(t);
  const ignored = ['chat/02.jsonl', 'chat/03.jsonl', 'channel.md', 'channel.jsonl', '.checkpoint', 'dist/assets/page.css'];
  for (const file of [...ignored, 'backup/chat/log.jsonl', 'backup/dist/page.html', 'channel-guide.md']) write(dir, file);
  const before = guard.snapshot(dir);
  assert.deepEqual([...before.keys()].sort(), ['backup/chat/log.jsonl', 'backup/dist/page.html', 'channel-guide.md']);

  for (const file of [...ignored.slice(1), 'backup/chat/log.jsonl']) write(dir, file, 'changed content');
  fs.unlinkSync(path.join(dir, ignored[0]));
  write(dir, 'dist/new.html');
  write(dir, 'channel.notes/extra.md');
  const after = guard.snapshot(dir);
  assert.deepEqual(guard.violations(before, after, []), ['backup/chat/log.jsonl']);
});

test('manager globs match only their prescribed paths', t => {
  const dir = tempDir(t);
  const before = guard.snapshot(dir);
  for (const file of [
    'direction.md', 'decisions.md', 'review.md', 'review2.md', 'review-notes.md', 'chat/00.jsonl',
    'notes/00.md', 'review/nested.md', 'reviewer.txt',
  ]) write(dir, file);
  assert.deepEqual(guard.violations(before, guard.snapshot(dir), [
    'direction.md', 'decisions.md', 'review*.md', 'chat/00.jsonl',
  ]), ['notes/00.md', 'review/nested.md', 'reviewer.txt']);
});

test('hashes detect same-size edits with the same mtime and stop at one MiB', t => {
  const dir = tempDir(t);
  const note = write(dir, 'notes/03.md', 'aaa');
  write(dir, 'at-limit.data', Buffer.alloc(1024 * 1024));
  write(dir, 'over-limit.data', Buffer.alloc(1024 * 1024 + 1));
  const timestamp = new Date('2025-01-01T00:00:00Z');
  fs.utimesSync(note, timestamp, timestamp);
  const before = guard.snapshot(dir);
  assert.match(before.get('notes/03.md').hash, /^[a-f0-9]{64}$/);
  assert.match(before.get('at-limit.data').hash, /^[a-f0-9]{64}$/);
  assert.equal(before.get('over-limit.data').hash, undefined);
  assert.equal(before.get('over-limit.data').size, 1024 * 1024 + 1);

  fs.writeFileSync(note, 'bbb');
  fs.utimesSync(note, timestamp, timestamp);
  const after = guard.snapshot(dir);
  assert.equal(after.get('notes/03.md').size, before.get('notes/03.md').size);
  assert.equal(after.get('notes/03.md').mtimeMs, before.get('notes/03.md').mtimeMs);
  assert.deepEqual(guard.violations(before, after, []), ['notes/03.md']);
});

test('snapshots record symlink changes without traversing their targets', t => {
  const dir = tempDir(t);
  const outside = tempDir(t);
  const link = path.join(dir, 'link');
  write(outside, 'outside.md');
  fs.symlinkSync(outside, link);
  const before = guard.snapshot(dir);
  assert.deepEqual([...before.keys()], ['link']);
  write(outside, 'outside.md', 'changed');
  assert.deepEqual(guard.violations(before, guard.snapshot(dir), []), []);

  fs.unlinkSync(link);
  fs.symlinkSync('../missing', link);
  assert.deepEqual(guard.violations(before, guard.snapshot(dir), []), ['link']);
});

test('two snapshots and a comparison stay within a practical budget for 500 files', t => {
  const dir = tempDir(t);
  for (let index = 0; index < 500; index++) write(dir, `sections/02-item-${index}.html`);

  const start = performance.now();
  const before = guard.snapshot(dir);
  write(dir, 'sections/02-item-0.html', 'owned update');
  write(dir, 'notes/03.md', 'unowned addition');
  const after = guard.snapshot(dir);
  const violations = guard.violations(before, after, WORKER_GLOBS);
  const elapsed = performance.now() - start;

  assert.equal(before.size, 500);
  assert.equal(after.size, 501);
  assert.deepEqual(violations, ['notes/03.md']);
  assert.ok(elapsed < 5000, `Snapshots and comparison took ${elapsed.toFixed(1)} ms`);
});
