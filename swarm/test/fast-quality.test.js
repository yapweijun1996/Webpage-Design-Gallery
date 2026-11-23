'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const anchors = require('../lib/anchors');
const { createFlow } = require('../lib/anchorflow');
const { compose } = require('../lib/composer');

const SWARM = path.resolve(__dirname, '..');
const HERO = 'Approved Fast Path hero for quality review';
const NOTE = 'Verified the approved hero and its published preview.';
const DONE = 'The approved hero passed the fixture quality review.';
const SUMMARY = 'The Fast Path quality review is complete.';
const REQUEST = 'Build a corporate landing page for GJH';
const SECTIONS = ['01-header', '02-hero', '03-brands', '04-about', '05-enquiry', '06-footer'];
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAABaAAAAACCAAAAACLJyRWAAAAGklEQVR4nO3BgQAAAADDoPlTX+EAVQEAAL8BC0IAARLjJg4AAAAASUVORK5CYII=',
  'base64',
);

function freePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer().once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const { port } = listener.address();
      listener.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function lockTestAnchor(project, seed) {
  const { contract } = compose({ recipe: 'corporate-landing', brand: 'gjh', outDir: seed });
  contract.sections[1].slots.title = HERO;
  const { id, dir } = anchors.create(project, { files: { desktop: PNG } });
  anchors.approve(project, id, { by: 'manager' });
  anchors.lock(project, id, { ...contract, rules: { desktop: { columns: 12 } } });
  const flow = createFlow(project);
  for (const [event, actor, extra] of [
    ['set_goals', 'manager', { goals: [HERO] }],
    ['anchor_ready', 'system', { anchorId: id }],
    ['advisor_pass', 'advisor'],
    ['approve', 'manager', { anchorId: id }],
    ['lock', 'manager', { anchorId: id }],
  ]) {
    const result = flow.dispatch(event, { actor, ...extra });
    assert.equal(result.ok, true, result.error);
  }
  return fs.readFileSync(path.join(dir, 'contract.json'));
}

async function fakeCodex({ log, hero, note, done, summary }) {
  const fs = require('node:fs');
  const path = require('node:path');
  const { createHash } = require('node:crypto');
  const args = process.argv.slice(2);
  const cwd = args[args.indexOf('-C') + 1];
  try {
    const prompt = fs.readFileSync(0, 'utf8');
    const [, label, id] = /^STEP: (Triage|Discuss|Decide|Work|Review|Summary) \| AGENT: (\d{2})$/.exec(prompt.split('\n', 1)[0]);
    const workspaceBytes = fs.readFileSync(path.join(cwd, 'contract.json'));
    const url = `http://127.0.0.1:${process.env.SWARM_PORT}/p/dist/preview.html`;
    const preview = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const page = await preview.text();
    fs.appendFileSync(log, JSON.stringify({
      label, id, cwd, actualCwd: process.cwd(), status: preview.status, hasHero: page.includes(hero),
      hash: createHash('sha256').update(workspaceBytes).digest('hex'),
      seesFastGuidance: prompt.includes('A Fast Path preview already renders the request.'),
      seesHeroAssignment: prompt.includes('Review the live hero section.'),
      scope: /In-scope sections: ([\d, ]+)\./.exec(prompt)?.[1],
    }) + '\n');

    if (id === '00') {
      const posts = label === 'Triage' ? [
        { kind: 'assign', to: ['02'], text: 'Review the composed hero.', task: 'Review the live hero section.' },
        { kind: 'assign', to: ['08'], text: 'Review removed section 08.', task: 'Review removed section 08.' },
      ] : label === 'Summary' ? [{ kind: 'msg', to: ['owner'], text: summary }] : [];
      console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ swarmChannel: posts }) } }));
    } else if (id === '02' && label === 'Work') {
      fs.writeFileSync(path.join(cwd, 'notes', '02.md'), note + '\n');
      fs.appendFileSync(path.join(cwd, 'chat', '02.jsonl'), JSON.stringify({ kind: 'done', text: done }) + '\n');
    }
  } catch (error) {
    fs.appendFileSync(log, JSON.stringify({ error: error.message }) + '\n');
    process.exitCode = 1;
  }
}

test('the running server publishes Fast Path before assigning quality work only to composed sections', { timeout: 20000 }, async t => {
  const fixture = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-fast-quality-')));
  const swarm = path.join(fixture, 'swarm');
  const project = path.join(swarm, 'projects', 'fast-quality');
  const log = path.join(fixture, 'launches.jsonl');
  const runner = path.join(fixture, 'fake-codex.js');
  let server;
  let exited;
  let launchError;
  let serverLogs = '';
  t.after(async () => {
    server?.kill('SIGTERM');
    await exited;
    fs.rmSync(fixture, { recursive: true, force: true });
  });

  fs.mkdirSync(swarm);
  fs.copyFileSync(path.join(SWARM, 'server.js'), path.join(swarm, 'server.js'));
  fs.cpSync(path.join(SWARM, 'template'), path.join(swarm, 'template'), { recursive: true });
  for (const source of ['lib', 'staff', 'design-system', 'tools', 'ui']) {
    fs.symlinkSync(path.join(SWARM, source), path.join(swarm, source), 'dir');
  }
  fs.symlinkSync(path.join(SWARM, '../design-canvas'), path.join(fixture, 'design-canvas'), 'dir');
  const config = JSON.stringify({ log, hero: HERO, note: NOTE, done: DONE, summary: SUMMARY });
  fs.writeFileSync(runner, `#!/usr/bin/env node\n(${fakeCodex.toString()})(${config});\n`, { mode: 0o700 });

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(swarm, 'server.js')], {
    env: { PATH: [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
      SWARM_TEST: '1', SWARM_PORT: String(port), SWARM_PROJECT: 'fast-quality', SWARM_CODEX: runner,
      SWARM_SETTINGS: path.join(fixture, 'settings.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  exited = new Promise(resolve => server.once('close', resolve));
  server.once('error', error => { launchError = error; });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLogs = (serverLogs + chunk).slice(-4000); });

  async function poll(name, read) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      assert.equal(server.exitCode, null, serverLogs);
      try {
        const value = await read();
        if (value) return value;
      } catch (error) {
        if (error.cause?.code !== 'ECONNREFUSED') throw error;
      }
      await delay(25);
    }
    assert.fail(`Timed out waiting for ${name}. ${serverLogs}`);
  }

  async function request(route, body) {
    const requestOptions = body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {};
    const response = await fetch(origin + route, { ...requestOptions, signal: AbortSignal.timeout(10000) });
    assert.ok(response.ok, `${route} returned ${response.status}. ${!response.ok ? await response.text() : ''}`);
    return response.json();
  }

  const initial = await poll('Swarm startup', () => request('/api/state'));
  assert.ok(initial.previewSections.some(({ id }) => id === '08'));
  const locked = lockTestAnchor(project, path.join(fixture, 'anchor-seed'));
  const hash = createHash('sha256').update(locked).digest('hex');
  const result = await request('/api/fast', { projectId: initial.projectId, text: REQUEST });
  assert.equal(result.accepted, true);
  assert.equal(result.qualityQueued, true);
  assert.ok(result.snapshotId);
  assert.deepEqual(fs.readFileSync(path.join(project, 'contract.json')), locked);

  const ended = await poll('completion of the quality turn', async () => {
    const state = await request('/api/state');
    return state.phase === 'ready' && state;
  });
  assert.deepEqual(ended.previewSections.map(({ id, section }) => `${id}-${section}`), SECTIONS);
  const launches = fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(launches.map(({ id, label }) => [id, label]), [
    ['00', 'Triage'], ['02', 'Discuss'], ['00', 'Decide'], ['02', 'Work'], ['00', 'Review'], ['00', 'Summary'],
  ]);
  for (const launch of launches) {
    assert.equal(path.dirname(launch.cwd), path.join(project, '.run', 'ws'));
    assert.equal(launch.actualCwd, launch.cwd);
    assert.equal(launch.status, 200);
    assert.equal(launch.hasHero, true);
    assert.equal(launch.hash, hash);
    assert.equal(launch.seesFastGuidance, true);
    assert.equal(launch.scope, '01, 02, 03, 04, 05, 06');
  }
  assert.equal(launches.find(({ label }) => label === 'Work').seesHeroAssignment, true);
  assert.deepEqual(fs.readFileSync(path.join(project, 'contract.json')), locked);
  assert.equal(fs.readFileSync(path.join(project, 'notes', '02.md'), 'utf8'), NOTE + '\n');
  assert.equal(fs.readFileSync(path.join(project, 'notes', '08.md'), 'utf8'), '');
  assert.equal(fs.existsSync(path.join(project, 'chat', '02.jsonl')), false);
  assert.deepEqual(fs.readdirSync(path.join(project, '.run', 'ws')), []);

  const { messages } = await request('/api/chat');
  assert.deepEqual(messages.find(({ id }) => id === result.id).scope.sections, ['01', '02', '03', '04', '05', '06']);
  const assignments = messages.filter(({ from, kind }) => from === '00' && kind === 'assign');
  assert.ok(assignments.some(({ text, to }) => text === 'Review the composed hero.' && to.includes('02')));
  assert.ok(assignments.some(({ text }) => text === 'Review removed section 08.'));
  assert.deepEqual(messages.filter(({ kind }) => kind === 'done').map(({ from, text }) => [from, text]), [['02', DONE]]);
  assert.ok(messages.some(({ from, text }) => from === '00' && text === SUMMARY));
  assert.deepEqual(fs.readFileSync(path.join(project, 'channel.jsonl'), 'utf8').trim().split('\n')
    .map(line => JSON.parse(line)), messages);
});
