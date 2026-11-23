'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { promisify } = require('node:util');
const { encodePng } = require('../tools/anchor-qa');

const SHOT = path.join(__dirname, '../tools/shot.js');
const LOCAL_PREVIEW = 'http://127.0.0.1:8000/studio.html?preview=1#01-hero';
const run = promisify(execFile);
const executableFixture = { skip: process.platform === 'win32' };

function fixture(t, mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-shot-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binary = path.join(root, 'chrome');
  const reference = path.join(root, 'reference.png');
  const proof = path.join(root, 'chrome.json');
  const terminated = path.join(root, 'terminated');
  const out = path.join(root, 'output.png');
  const png = encodePng({ width: 393, height: 844, rgb: Buffer.alloc(393 * 844 * 3, 42) });
  fs.writeFileSync(reference, png);
  fs.writeFileSync(out, 'previous capture');
  fs.writeFileSync(binary, `#!/usr/bin/env node
const fs = require('node:fs');
const option = name => process.argv.find(arg => arg.startsWith('--' + name + '=')).split('=').slice(1).join('=');
const profile = option('user-data-dir');
const output = option('screenshot');
const png = fs.readFileSync(process.env.SHOT_REFERENCE);
process.on('SIGTERM', () => fs.writeFileSync(process.env.SHOT_TERMINATED, 'SIGTERM'));
fs.mkdirSync(profile);
fs.writeFileSync(output, png.subarray(0, -12));
fs.writeFileSync(process.env.SHOT_PROOF, JSON.stringify({ profile, output, pid: process.pid }));
if (process.env.SHOT_TEST_MODE === 'truncated') process.exit(1);
if (process.env.SHOT_TEST_MODE === 'complete') {
  setTimeout(() => fs.appendFileSync(output, png.subarray(-12)), 150);
}
setInterval(() => {}, 1000);
`, { mode: 0o700 });
  const env = {
    ...process.env, CHROME_BIN: binary, SHOT_REFERENCE: reference, SHOT_PROOF: proof,
    SHOT_TEST_MODE: mode, SHOT_TERMINATED: terminated,
  };
  return {
    png, out, proof, terminated,
    start: () => run(process.execPath, [SHOT, LOCAL_PREVIEW, '393', '844', out], { env, timeout: 8000 }),
    assertCleanup() {
      const { profile, output, pid } = JSON.parse(fs.readFileSync(proof, 'utf8'));
      assert.equal(fs.existsSync(profile), false);
      assert.equal(fs.existsSync(output), false);
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    },
  };
}

test('writes the complete PNG and reaps Chrome even when Chrome ignores SIGTERM', executableFixture, async t => {
  const shot = fixture(t, 'complete');
  const { stdout } = await shot.start();
  assert.match(stdout, /393x844/);
  assert.deepEqual(fs.readFileSync(shot.out), shot.png);
  assert.equal(fs.readFileSync(shot.terminated, 'utf8'), 'SIGTERM');
  shot.assertCleanup();
});

test('rejects a partial PNG and preserves the previous destination on Chrome failure', executableFixture, async t => {
  const shot = fixture(t, 'truncated');
  await assert.rejects(shot.start(), error => error.code === 3 && /before writing a complete PNG/.test(error.stderr));
  assert.equal(fs.readFileSync(shot.out, 'utf8'), 'previous capture');
  shot.assertCleanup();
});

test('cancelling a capture reaps Chrome and removes its temporary profile', executableFixture, async t => {
  const shot = fixture(t, 'pending');
  const result = shot.start();
  const rejected = assert.rejects(result, error => error.code === 3 && /Interrupted by SIGTERM/.test(error.stderr));
  const deadline = performance.now() + 5000;
  while (!fs.existsSync(shot.proof) && performance.now() < deadline) await delay(25);
  result.child.kill('SIGTERM');
  await rejected;
  assert.equal(fs.readFileSync(shot.out, 'utf8'), 'previous capture');
  shot.assertCleanup();
});
