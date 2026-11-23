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
const { captureAnchorQA } = require('../lib/anchor-preview-qa');
const { approvedAnchor } = require('../lib/publication');
const { encodePng } = require('../tools/anchor-qa');

const SWARM = path.resolve(__dirname, '..');
const PROJECT = 'anchor-repair-fixture';
const HERO = 'sections/02-hero.css';
const PEER = ['sections/04-about.html', 'sections/04-about.css'];
const APPEARANCE = { theme: 'light', brand: 'none', lang: 'en' };
const GOALS = ['Keep the hero art structured in columns while preserving the About section.'];
// A stable strip at the section edge keeps a fractional peer crop outside the changing artwork.
const HERO_SHELL = '.s-02 { position: relative; height: 37.5vh; margin: 0; %s ' +
  'background-size: 100% calc(100% - 4px); background-repeat: no-repeat; background-color: #777; }\n' +
  '.s-02 h1 { position: absolute; inset: 6px auto auto 8px; margin: 0; color: white; font-size: 16px; }\n';
const FIXED_HERO = HERO_SHELL.replace('%s', 'background: repeating-linear-gradient(90deg, #000 0 calc(100vw / 288), #fff calc(100vw / 288) calc(100vw / 144));');
const BROKEN_HERO = HERO_SHELL.replace('%s', 'background: linear-gradient(#000 50%, #fff 50%);');
const DONE = 'Restored the approved hero structure.';

function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer().once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function write(root, name, data) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function read(root, name) {
  return fs.readFileSync(path.join(root, name));
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixtureContract(breakpoints) {
  const rules = { columns: 12, typeScale: [16, 24], spacingScale: [8, 16], palette: ['#000', '#fff'], imagery: 'Striped hero artwork' };
  return { version: 1, brand: 'gjh', recipe: 'corporate-landing', tokens: {}, owners: {},
    sections: [{ id: '02-hero', block: 'hero', slots: { title: 'Repair hero' } },
      { id: '04-about', block: 'about', slots: { title: 'Peer content' } }],
    rules: Object.fromEntries(breakpoints.map(name => [name, rules])) };
}

async function fakeCodex({ log, release, css, done }) {
  const fs = require('node:fs');
  const path = require('node:path');
  const { createHash } = require('node:crypto');
  const { setTimeout: sleep } = require('node:timers/promises');
  const emit = event => process.stdout.write(JSON.stringify(event) + '\n');
  const prompt = fs.readFileSync(0, 'utf8');
  if (prompt.includes('Swarm Design Advisor')) {
    const text = JSON.stringify({ verdict: 'pass', score: 100, findings: ['The approved hero uses localized structure.'] });
    emit({ type: 'item.completed', item: { type: 'agent_message', text } });
    emit({ type: 'turn.completed' });
    return;
  }

  const steps = /^STEP: ([^\n|]+) \| AGENT: (\d{2})$/.exec(prompt.split('\n', 1)[0]);
  const [, label, id] = steps || [];
  const cwd = process.cwd();
  try {
    fs.appendFileSync(log, JSON.stringify({ label, id, cwd,
      contractHash: createHash('sha256').update(fs.readFileSync(path.join(cwd, 'contract.json'))).digest('hex'),
      followsLockedAnchor: prompt.includes('Follow locked anchor'),
      targetPrompt: prompt.includes('Visual QA requested a repair of 02-hero against locked anchor'),
    }) + '\n');
    if (label !== 'Work' || id !== '02') throw new Error('Unexpected quality runner role.');
    const until = Date.now() + 60000;
    while (!fs.existsSync(release) && Date.now() < until) await sleep(25);
    if (!fs.existsSync(release)) throw new Error('Fixture repair was not released.');
    fs.writeFileSync(path.join(cwd, 'sections', '02-hero.css'), css);
    fs.appendFileSync(path.join(cwd, 'chat', '02.jsonl'), JSON.stringify({ kind: 'done', text: done }) + '\n');
    emit({ type: 'turn.completed' });
  } catch (error) {
    fs.appendFileSync(log, JSON.stringify({ error: error.message }) + '\n');
    process.exitCode = 1;
  }
}

async function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-anchor-repair-e2e-')));
  const swarm = path.join(root, 'swarm');
  const project = path.join(swarm, 'projects', PROJECT);
  const launches = path.join(root, 'launches.jsonl');
  const release = path.join(root, 'release');
  const runner = path.join(root, 'fake-codex');
  let server, closed, spawnError;
  let logs = '';
  t.after(async () => {
    server?.kill('SIGTERM');
    await closed;
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 2 });
  });

  fs.mkdirSync(swarm);
  fs.copyFileSync(path.join(SWARM, 'server.js'), path.join(swarm, 'server.js'));
  fs.cpSync(path.join(SWARM, 'template'), path.join(swarm, 'template'), { recursive: true });
  for (const directory of ['lib', 'staff', 'design-system', 'tools', 'ui']) {
    fs.symlinkSync(path.join(SWARM, directory), path.join(swarm, directory), 'dir');
  }
  fs.symlinkSync(path.join(SWARM, '../design-canvas'), path.join(root, 'design-canvas'), 'dir');
  write(project, 'brief.md', 'Anchor repair integration fixture.');
  write(project, 'agents.json', JSON.stringify([
    { id: '02', name: 'Hero', title: 'Hero Designer', color: '#123abc', section: 'hero', lane: 'Maintain the hero.' },
    { id: '04', name: 'About', title: 'About Designer', color: '#456def', section: 'about', lane: 'Maintain About.' },
  ]));
  write(project, 'tokens.css', read(SWARM, '../design-canvas/tokens.css'));
  write(project, 'sections/02-hero.html', '<section class="s-02" id="02-hero"><h1>Repair hero</h1></section>\n');
  write(project, HERO, FIXED_HERO);
  write(project, PEER[0], '<section class="s-04" id="04-about"><h2>Peer content</h2></section>\n');
  write(project, PEER[1], '.s-04 { min-height: 62.5vh; background: #777; margin: 0; }\n' +
    '.s-04 h2 { display: block; margin: 0; padding: 20px; color: white; }\n');
  const script = { log: launches, release, css: FIXED_HERO, done: DONE };
  fs.writeFileSync(runner, `#!/usr/bin/env node\n(${fakeCodex})(${JSON.stringify(script)});\n`, { mode: 0o700 });

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(swarm, 'server.js')], {
    env: { PATH: [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
      ...(process.env.CHROME_BIN ? { CHROME_BIN: process.env.CHROME_BIN } : {}),
      SWARM_TEST: '1', SWARM_CODEX: runner, SWARM_PORT: String(port), SWARM_PROJECT: PROJECT,
      SWARM_SETTINGS: path.join(root, 'settings.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  closed = new Promise(resolve => server.once('close', resolve));
  server.once('error', error => { spawnError = error; });
  for (const pipe of [server.stdout, server.stderr]) pipe.on('data', data => { logs = (logs + data).slice(-5000); });

  let token;
  let projectId;
  async function request(route, body, timeout = 10000) {
    const headers = { 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'empty' };
    const method = body ? 'POST' : 'GET';
    if (body) {
      headers['content-type'] = 'application/json';
      headers['x-swarm-anchor-token'] = token;
    }
    const response = await fetch(origin + route, { headers, method, signal: AbortSignal.timeout(timeout),
      body: body && JSON.stringify({ projectId, ...body }) });
    const data = await response.json();
    assert.equal(response.status, 200, `${method} ${route}: ${JSON.stringify(data).slice(0, 600)}\n${logs}`);
    return data;
  }

  async function poll(description, timeout, readValue) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (spawnError) throw spawnError;
      assert.equal(server.exitCode, null, logs);
      try {
        const result = await readValue();
        if (result) return result;
      } catch (error) { if (error.cause?.code !== 'ECONNREFUSED') throw error; }
      await delay(50);
    }
    assert.fail(`Timed out waiting for ${description}.\n${logs}`);
  }

  ({ projectId } = await poll('Swarm startup', 10000, () => request('/api/state')));
  const state = () => request('/api/anchor/state');
  ({ token } = await request('/api/anchor/session'));
  const post = (action, body, timeout) => request('/api/anchor/' + action, body, timeout);
  async function importAndLock(files) {
    const imported = await post('import', { files: Object.fromEntries(Object.entries(files)
      .map(([name, bytes]) => [name, bytes.toString('base64')])) });
    assert.equal(imported.flow.state, 'advisor_review');
    const anchorId = imported.flow.anchorId;
    const meta = imported.anchors.find(anchor => anchor.id === anchorId);
    const input = { anchorId, sha256: meta.files['anchor.desktop.png'].sha256 };
    assert.equal((await post('advisor', input)).flow.state, 'awaiting_approval');
    assert.equal((await post('approve', input)).flow.approved, true);
    const locked = await post('lock', { ...input, contract: fixtureContract(Object.keys(files)) });
    assert.equal(locked.flow.state, 'locked');
    return input;
  }

  return { project, origin, post, poll, state, importAndLock, request, launches, release };
}

test('a scoped QA failure repairs only its owner and repeats visual QA before final sign-off', {
  skip: process.env.SWARM_ANCHOR_REPAIR_CHROME_TEST !== '1' && 'Set SWARM_ANCHOR_REPAIR_CHROME_TEST=1 to run the isolated Chrome server fixture.',
  timeout: 240000,
}, async t => {
  const f = await fixture(t);
  assert.equal((await f.post('goals', { goals: GOALS })).flow.state, 'generating');

  // A temporary fixture anchor gives the production Studio capturer access to the intended layout.
  const seed = encodePng({ width: 1440, height: 2, rgb: Buffer.alloc(1440 * 2 * 3) });
  const initial = await f.importAndLock({ desktop: seed });
  const studio = new URL('/studio.html?preview=1&theme=light&brand=none&lang=en', f.origin);
  const capture = await captureAnchorQA({ projectDir: f.project, anchor: approvedAnchor(f.project),
    previewUrl: () => studio, includeEvidence: true, signal: AbortSignal.timeout(90000) });
  assert.ok(capture.evidence.desktop?.screenshot, 'Desktop desired-layout capture is missing.');
  assert.ok(capture.evidence.tablet?.screenshot, 'Tablet desired-layout capture is missing.');
  assert.equal((await f.post('unlock', { ...initial, reason: 'Install actual preview reference captures.' })).flow.state, 'generating');
  const anchor = await f.importAndLock({
    desktop: capture.evidence.desktop.screenshot, tablet: capture.evidence.tablet.screenshot,
  });
  const locked = read(f.project, 'contract.json');
  const peer = PEER.map(file => read(f.project, file));
  write(f.project, HERO, BROKEN_HERO);

  const first = await f.post('qa', { anchorId: anchor.anchorId, appearance: APPEARANCE }, 110000);
  const notes = first.qa?.breakpoints.map(({ name, status, score, report, geometry }) =>
    ({ name, status, score, palette: report?.palette?.distance, geometry }));
  assert.equal(first.qa?.ok, false, JSON.stringify(notes));
  assert.equal(first.flow.qaRevisions, 1);
  assert.ok(['queued', 'running'].includes(first.qa?.repair?.status), JSON.stringify({ repair: first.qa?.repair, notes }));
  assert.equal(first.qa.repair.sectionId, '02-hero');
  assert.equal(first.qa.repair.ownerId, '02');
  assert.ok(first.qa.breakpoints.filter(({ status }) => status === 'fail').length >= 2);
  assert.equal(read(f.project, HERO).toString(), BROKEN_HERO);
  assert.equal(fs.existsSync(path.join(f.project, 'integration', 'log.jsonl')), false);

  const running = await f.poll('a running private repair', 15000, async () => {
    const state = await f.state();
    return state.qa?.repair?.status === 'running' && fs.existsSync(f.launches) && state;
  });
  const launched = fs.readFileSync(f.launches, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(launched.map(({ id, label }) => [id, label]), [['02', 'Work']]);
  assert.equal(path.dirname(launched[0].cwd), path.join(f.project, '.run', 'ws'));
  assert.equal(launched[0].contractHash, digest(locked));
  assert.equal(launched[0].followsLockedAnchor, true);
  assert.equal(launched[0].targetPrompt, true);
  assert.equal(running.flow.state, 'implementing');

  fs.writeFileSync(f.release, '');
  const finished = await f.poll('automatic passing QA', 120000, async () => {
    const state = await f.state();
    const status = state.qa?.repair?.status;
    if (['failed', 'no-change', 'cancelled', 'skipped'].includes(status)) {
      const { messages } = await f.request('/api/chat');
      assert.fail(JSON.stringify({ repair: state.qa.repair, messages: messages.map(({ text }) => text) }));
    }
    return state.flow.state === 'final_review' && state.qa?.ok && !state.qa?.stale && !state.busy && state;
  });
  assert.equal(finished.flow.qaRevisions, 1);
  assert.equal(finished.flow.anchorId, anchor.anchorId);
  assert.equal(finished.flow.approved, true);
  assert.equal(finished.qa.repair?.status, 'published');
  assert.deepEqual(finished.qa.breakpoints.map(({ status }) => status), ['pass', 'pass', 'missing']);
  assert.equal(read(f.project, HERO).toString(), FIXED_HERO);
  assert.deepEqual(PEER.map(file => read(f.project, file)), peer);
  assert.deepEqual(read(f.project, 'contract.json'), locked);
  const audit = read(f.project, 'integration/log.jsonl').toString().trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(audit.map(({ owner, anchorId, anchorContractSha256, paths }) =>
    ({ owner, anchorId, anchorContractSha256, paths })), [{
    owner: '02', anchorId: anchor.anchorId, anchorContractSha256: digest(locked), paths: [HERO],
  }]);
  const { messages } = await f.request('/api/chat');
  assert.deepEqual(messages.filter(({ kind }) => kind === 'done').map(({ from, text }) => [from, text]), [['02', DONE]]);
  assert.equal(fs.existsSync(launched[0].cwd), false);
});
