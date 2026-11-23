'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { AnchorGenerationError, generateAnchor } = require('../lib/anchor-generation');
const { decodePng, encodePng } = require('../tools/anchor-qa');

const GOALS = ['Make the product hero legible and keep the layout coherent.'];
const NAMES = ['desktop', 'tablet', 'mobile'];
const WIDTHS = [1440, 768, 393];
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const WHITE = [255, 255, 255];

function patternedPng(width, height) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rgb.set(y < height / 2 ? (x < width / 2 ? RED : GREEN) : (x < width / 2 ? BLUE : WHITE),
        (y * width + x) * 3);
    }
  }
  return encodePng({ width, height, rgb });
}

function fixture(t, dimensions = WIDTHS.map(width => [width, 2])) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-anchor-generation-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 2 }));
  const projectDir = path.join(root, 'project');
  const inputs = path.join(root, 'inputs');
  fs.mkdirSync(projectDir);
  fs.mkdirSync(inputs);
  fs.writeFileSync(path.join(projectDir, 'private.txt'), 'Live project stays untouched.');
  for (const [index, name] of NAMES.entries()) {
    fs.writeFileSync(path.join(inputs, `anchor.${name}.png`), patternedPng(...dimensions[index]));
  }
  return { root, projectDir, inputs, record: path.join(root, 'runner.json') };
}

function fakeCodex(t, f, actions = {}, { code = 0, event = 'turn.completed', pause = 0 } = {}) {
  const program = path.join(f.root, 'codex');
  const previous = { SWARM_TEST: process.env.SWARM_TEST, SWARM_CODEX: process.env.SWARM_CODEX };
  process.env.SWARM_TEST = '1';
  process.env.SWARM_CODEX = program;
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  fs.writeFileSync(program, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const prompt = fs.readFileSync(0, 'utf8');
const cwd = fs.realpathSync(process.cwd());
const filesBefore = fs.readdirSync(cwd);
const inputs = ${JSON.stringify(f.inputs)};
const actions = ${JSON.stringify(actions)};
for (const file of fs.readdirSync(inputs)) {
  if (actions[file] === 'missing') continue;
  if (actions[file] === 'invalid') fs.writeFileSync(file, 'a non-PNG payload'.repeat(6));
  else if (actions[file] === 'symlink') fs.symlinkSync(path.join(inputs, file), file);
  else if (actions[file] === 'hardlink') fs.linkSync(path.join(inputs, file), file);
  else fs.copyFileSync(path.join(inputs, file), file);
}
fs.writeFileSync(${JSON.stringify(f.record)}, JSON.stringify({ cwd, filesBefore, args: process.argv.slice(2), prompt, pid: process.pid }));
setTimeout(() => {
  console.log(JSON.stringify({ type: ${JSON.stringify(event)} }));
  process.exitCode = ${code};
}, ${pause});
`, { mode: 0o700 });
  return {
    defaults: { runner: 'pi', model: 'gpt-6.2-sol', effort: 'medium' },
    roles: { workers: { model: 'gpt-6.1-terra', effort: 'xhigh' } },
    images: { provider: 'openai', model: 'fixture-image-model' },
  };
}

function readRecord(f) {
  return JSON.parse(fs.readFileSync(f.record, 'utf8'));
}

async function waitForRunner(f) {
  const deadline = Date.now() + 5000;
  while (!fs.existsSync(f.record) && Date.now() < deadline) await delay(20);
  return readRecord(f);
}

function colors(image) {
  function pixel(x, y) {
    const offset = (y * image.width + x) * 3;
    return Array.from(image.rgb.subarray(offset, offset + 3));
  }
  return [pixel(0, 0), pixel(image.width - 1, 0), pixel(0, image.height - 1), pixel(image.width - 1, image.height - 1)];
}

test('isolates the configured Codex image specialist and preserves the separate references at exact widths', async t => {
  const dimensions = [[720, 450], [960, 1279], [786, 1688]];
  const f = fixture(t, dimensions);
  const runnerSettings = fakeCodex(t, f);
  const result = await generateAnchor({ ...f, goals: GOALS, runnerSettings });
  assert.equal(result.model, 'codex:gpt-6.1-terra');
  assert.deepEqual(Object.keys(result.files), NAMES);
  for (const [index, name] of NAMES.entries()) {
    const [sourceWidth, sourceHeight] = dimensions[index];
    const reference = decodePng(result.files[name]);
    assert.equal(reference.width, WIDTHS[index]);
    assert.equal(reference.height, Math.round(sourceHeight * WIDTHS[index] / sourceWidth));
    assert.deepEqual(colors(reference), [RED, GREEN, BLUE, WHITE]);
  }
  const record = readRecord(f);
  assert.notEqual(record.cwd, f.projectDir);
  assert.deepEqual(record.filesBefore, []);
  assert.ok(record.args.includes('gpt-6.1-terra'));
  assert.ok(record.args.includes('model_reasoning_effort=xhigh'));
  assert.ok(record.args.includes('workspace-write'));
  assert.ok(record.args.includes('--ephemeral'));
  assert.ok(record.args.includes(record.cwd));
  assert.ok(!record.args.includes('fixture-image-model'));
  for (const [index, name] of NAMES.entries()) {
    assert.ok(record.prompt.includes(`${name}: ${WIDTHS[index]}x`));
    assert.ok(record.prompt.includes(`anchor.${name}.png`));
  }
  assert.ok(record.prompt.includes(JSON.stringify(GOALS)));
  assert.match(record.prompt, /built-in Codex image generation tool/);
  assert.equal(fs.existsSync(record.cwd), false);
  assert.deepEqual(fs.readdirSync(f.projectDir), ['private.txt']);
});

test('keeps an already-valid native-width reference byte-identical', async t => {
  const f = fixture(t);
  const runnerSettings = fakeCodex(t, f);
  const { files } = await generateAnchor({ ...f, goals: GOALS, runnerSettings });
  for (const name of NAMES) assert.deepEqual(files[name], fs.readFileSync(path.join(f.inputs, `anchor.${name}.png`)));
});

for (const action of ['missing', 'invalid', 'symlink', 'hardlink']) {
  test(`rejects the staged image when it is ${action} and removes the private workspace`, async t => {
    const f = fixture(t);
    const runnerSettings = fakeCodex(t, f, { 'anchor.mobile.png': action });
    await assert.rejects(generateAnchor({ ...f, goals: GOALS, runnerSettings }), error =>
      error instanceof AnchorGenerationError && error.status === 502 && /valid mobile PNG/.test(error.message));
    assert.equal(fs.existsSync(readRecord(f).cwd), false);
    assert.deepEqual(fs.readdirSync(f.projectDir), ['private.txt']);
  });
}

test('rejects an image whose aspect ratio cannot fit the height limit without cropping', async t => {
  const f = fixture(t, [[10, 20], [768, 2], [393, 2]]);
  const runnerSettings = fakeCodex(t, f);
  await assert.rejects(generateAnchor({ ...f, goals: GOALS, runnerSettings }), {
    status: 502, message: /desktop reference is taller than 2400 px/,
  });
});

for (const [name, options] of [
  ['a failed runner exit', { code: 4 }], ['a failed turn with exit zero', { event: 'turn.failed' }],
  ['missing turn completion', { event: 'thread.started' }],
]) {
  test(`rejects ${name} despite staged images`, async t => {
    const f = fixture(t);
    const runnerSettings = fakeCodex(t, f, {}, options);
    await assert.rejects(generateAnchor({ ...f, goals: GOALS, runnerSettings }), {
      status: 502, message: /configured Codex image generator did not complete/,
    });
    assert.equal(fs.existsSync(readRecord(f).cwd), false);
  });
}

test('rejects unapproved runner settings and invalid goals before launches', async t => {
  const f = fixture(t);
  const runnerSettings = fakeCodex(t, f);
  await assert.rejects(generateAnchor({ ...f, goals: [], runnerSettings }), { status: 400 });
  runnerSettings.roles.workers.model = 'unapproved-model';
  await assert.rejects(generateAnchor({ ...f, goals: GOALS, runnerSettings }), { status: 409 });
  assert.equal(fs.existsSync(f.record), false);
});

test('canceling a generation with all images staged still stops the runner and discards its output', async t => {
  const f = fixture(t);
  const runnerSettings = fakeCodex(t, f, {}, { pause: 4000 });
  const controller = new AbortController();
  const cancelled = new Error('Owner cancelled image generation.');
  const pending = generateAnchor({ ...f, goals: GOALS, runnerSettings, signal: controller.signal });
  const failure = assert.rejects(pending, error => error === cancelled);
  let record;
  try { record = await waitForRunner(f); }
  finally { controller.abort(cancelled); }
  await failure;
  assert.throws(() => process.kill(record.pid, 0), { code: 'ESRCH' });
  assert.equal(fs.existsSync(record.cwd), false);
  assert.deepEqual(fs.readdirSync(f.projectDir), ['private.txt']);
});

test('discarded output cannot be returned for a replacement project directory', async t => {
  const f = fixture(t);
  const runnerSettings = fakeCodex(t, f, {}, { pause: 400 });
  const pending = generateAnchor({ ...f, goals: GOALS, runnerSettings });
  const rejected = assert.rejects(pending, { status: 409, message: /anchor project changed/ });
  const launched = await waitForRunner(f);
  fs.renameSync(f.projectDir, path.join(f.root, 'old-project'));
  fs.mkdirSync(f.projectDir);
  await rejected;
  assert.equal(fs.existsSync(launched.cwd), false);
});
