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
const { decodePng, encodePng } = require('../tools/anchor-qa');

const SWARM = path.resolve(__dirname, '..');
const PROJECT = 'shared-proposals-e2e';
const ROUTE = '/api/shared-proposals';
const APPEARANCE = { theme: 'dark', brand: 'forest-gold', lang: 'ms', colorScheme: 'light' };
const BASE = '/* Keep the surrounding bytes. */\n:root { --dc-brand: #672436; --dc-untouched: #44aaff; }\n';
const COLORS = ['#246248', '#55448a'];
const PEER = '04-about';
const SECTIONS = {
  '02-hero.html': '<section class="s-02" id="02-hero"><h1>Shared tokens proposal hero</h1></section>\n',
  '02-hero.css': '.s-02 { height: 240px; background: #eee; } .s-02 h1 { margin: 0; }\n',
  '04-about.html': '<section class="s-04" id="04-about"><h2>Peer shared design token sample</h2></section>\n',
  '04-about.css': '.s-04 { height: 240px; background: #111; } .s-04 h2 { margin: 0; }\n' +
    '@media (prefers-color-scheme: light) { :root[data-theme=dark][data-brand=forest-gold][lang=ms] .s-04 { background: var(--dc-brand); } }\n',
};
const FIXTURE_DONE = 'Submitted the shared token value for operator review.';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function lockFixture(project) {
  const { id, dir } = anchors.create(project, {
    files: { desktop: encodePng({ width: 1440, height: 1, rgb: Buffer.alloc(1440 * 3, 255) }) },
  });
  anchors.approve(project, id, { by: 'manager' });
  anchors.lock(project, id, { version: 1, brand: 'gjh', recipe: 'corporate-landing', tokens: {}, owners: {},
    sections: [{ id: '02-hero', block: 'hero', slots: { title: 'Shared tokens proposal hero' } },
      { id: PEER, block: 'about', slots: { title: 'Peer sample' } }],
    rules: { desktop: { columns: 12 } } });
  const flow = createFlow(project);
  for (const [event, actor, extra] of [
    ['set_goals', 'manager', { goals: ['Keep the approved section composition.'] }],
    ['anchor_ready', 'system', { anchorId: id }], ['advisor_pass', 'advisor'],
    ['approve', 'manager', { anchorId: id }], ['lock', 'manager', { anchorId: id }],
  ]) {
    const result = flow.dispatch(event, { actor, ...extra });
    assert.ok(result.ok, result.error);
  }
  const contract = fs.readFileSync(path.join(dir, 'contract.json'));
  fs.writeFileSync(path.join(project, 'contract.json'), contract);
  return { id, contract };
}

function fakeCodex({ launches, colors, done }) {
  const fs = require('node:fs');
  const path = require('node:path');
  const prompt = fs.readFileSync(0, 'utf8');
  const [, label, id] = /^STEP: ([^\n|]+) \| AGENT: (\d{2})$/.exec(prompt.split('\n', 1)[0]);
  const cwd = process.cwd();
  const record = { label, id, cwd };
  if (id === '00') {
    const posts = label === 'Triage' ? [{ kind: 'assign', to: ['02'], task: 'Propose the next token value.', text: 'Inspect shared styling.' }] : [];
    console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ swarmChannel: posts }) } }));
  } else if (id === '02' && label === 'Work') {
    const previous = fs.readFileSync(launches, 'utf8').trim().split('\n').map(JSON.parse);
    const n = previous.filter(entry => entry.label === 'Work').length;
    record.token = colors[n];
    record.proposalGuidance = prompt.includes('write token-proposal.json');
    record.lockedGuidance = prompt.includes('Follow locked anchor');
    if (!record.token || !record.proposalGuidance || !record.lockedGuidance) throw new Error('Incorrect token proposal assignment.');
    fs.writeFileSync(path.join(cwd, 'token-proposal.json'), JSON.stringify([{ name: '--dc-brand', value: record.token }]));
    fs.appendFileSync(path.join(cwd, 'chat/02.jsonl'), JSON.stringify({ kind: 'done', text: done }) + '\n');
  }
  fs.appendFileSync(launches, JSON.stringify(record) + '\n');
  console.log(JSON.stringify({ type: 'turn.completed' }));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer().once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-shared-proposals-e2e-')));
  const swarm = path.join(root, 'swarm');
  const project = path.join(swarm, 'projects', PROJECT);
  const launches = path.join(root, 'launches.jsonl');
  const runner = path.join(root, 'fake-codex');
  let server, closed, launchError;
  let logs = '';
  t.after(async () => {
    server?.kill('SIGTERM');
    await closed;
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 2 });
  });
  fs.mkdirSync(path.join(project, 'sections'), { recursive: true });
  fs.copyFileSync(path.join(SWARM, 'server.js'), path.join(swarm, 'server.js'));
  fs.cpSync(path.join(SWARM, 'template'), path.join(swarm, 'template'), { recursive: true });
  for (const directory of ['lib', 'staff', 'design-system', 'tools', 'ui']) {
    fs.symlinkSync(path.join(SWARM, directory), path.join(swarm, directory), 'dir');
  }
  fs.symlinkSync(path.join(SWARM, '../design-canvas'), path.join(root, 'design-canvas'), 'dir');
  fs.writeFileSync(path.join(project, 'brief.md'), 'Shared token review integration fixture.');
  fs.writeFileSync(path.join(project, 'agents.json'), JSON.stringify([
    { id: '02', name: 'Hero', title: 'Hero Designer', color: '#123abc', section: 'hero', lane: 'Maintain the hero.' },
    { id: '04', name: 'About', title: 'About Designer', color: '#456def', section: 'about', lane: 'Maintain About.' },
  ]));
  fs.writeFileSync(path.join(project, 'tokens.css'), BASE);
  for (const [file, contents] of Object.entries(SECTIONS)) fs.writeFileSync(path.join(project, 'sections', file), contents);
  const anchor = lockFixture(project);
  fs.writeFileSync(runner, `#!/usr/bin/env node\n(${fakeCodex})(${JSON.stringify({ launches, colors: COLORS, done: FIXTURE_DONE })});\n`, { mode: 0o700 });

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(swarm, 'server.js')], {
    env: { PATH: [path.dirname(process.execPath), process.env.PATH].filter(Boolean).join(path.delimiter),
      ...(process.env.CHROME_BIN ? { CHROME_BIN: process.env.CHROME_BIN } : {}), SWARM_TEST: '1',
      SWARM_PORT: String(port), SWARM_PROJECT: PROJECT, SWARM_CODEX: runner, SWARM_SETTINGS: path.join(root, 'settings.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  closed = new Promise(resolve => server.once('close', resolve));
  server.once('error', error => { launchError = error; });
  for (const pipe of [server.stdout, server.stderr]) pipe.on('data', data => { logs = (logs + data).slice(-5000); });

  let token;
  async function request(url, { body, status = 200, grant = true, png = false } = {}) {
    const headers = { 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'empty' };
    if (body) headers['content-type'] = 'application/json';
    if (grant && token) headers['x-swarm-anchor-token'] = token;
    const method = body ? 'POST' : 'GET';
    const reply = await fetch(origin + url, { method, headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const payload = png && reply.ok ? Buffer.from(await reply.arrayBuffer()) : await reply.json();
    assert.equal(reply.status, status, `${method} ${url}: ${JSON.stringify(payload).slice(0, 600)}\n${logs}`);
    if (png && reply.ok) assert.equal(reply.headers.get('content-type'), 'image/png');
    return payload;
  }
  async function poll(name, read) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      assert.equal(server.exitCode, null, logs);
      try {
        const result = await read();
        if (result) return result;
      } catch (error) { if (error.cause?.code !== 'ECONNREFUSED') throw error; }
      await delay(50);
    }
    assert.fail(`Timed out waiting for ${name}.\n${logs}`);
  }
  const initial = await poll('server startup', () => request('/api/state'));
  ({ token } = await request('/api/anchor/session'));
  return {
    project, anchor, launches, request, poll, projectId: initial.projectId,
    decide: (decision, proposal, options) => request(ROUTE + '/' + decision, {
      body: { projectId: initial.projectId, id: proposal.id, reviewRevision: proposal.reviewRevision },
      ...options,
    }),
  };
}

function checkVisibleFiles(f, tokens) {
  assert.equal(fs.readFileSync(path.join(f.project, 'tokens.css'), 'utf8'), tokens);
  for (const [file, contents] of Object.entries(SECTIONS)) {
    assert.equal(fs.readFileSync(path.join(f.project, 'sections', file), 'utf8'), contents);
  }
  assert.deepEqual(fs.readFileSync(path.join(f.project, 'contract.json')), f.anchor.contract);
  assert.equal(fs.existsSync(path.join(f.project, 'token-proposal.json')), false);
}

test('a normal worker can propose a shared token, but only an operator can publish its reviewed impact', {
  skip: process.env.SWARM_SHARED_PROPOSALS_E2E_TEST !== '1' && 'Set SWARM_SHARED_PROPOSALS_E2E_TEST=1 to run the complete Chrome and HTTP workflow.',
  timeout: 220000,
}, async t => {
  const f = await fixture(t);
  const evidenceDir = process.env.SWARM_SHARED_PROPOSALS_EVIDENCE;
  function save(file, data) {
    if (!evidenceDir) return;
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, file), data);
  }
  async function propose(number) {
    await f.request('/api/chat', { body: { from: 'owner', text: 'Propose the next reviewed shared style value.',
      scope: { sections: ['02'], appearance: APPEARANCE } } });
    return f.poll('pending proposal', async () => {
      const list = await f.request(ROUTE);
      return !list.busy && list.proposals.length === number && list.proposals.find(record => record.status === 'pending');
    });
  }

  const pending = await propose(1);
  checkVisibleFiles(f, BASE);
  assert.deepEqual([pending.workerId, pending.sectionId, pending.projectId, pending.anchor.id], ['02', '02-hero', f.projectId, f.anchor.id]);
  assert.deepEqual(pending.appearance, APPEARANCE);
  assert.equal(pending.before, BASE);
  assert.equal(pending.after, BASE.replace('#672436', COLORS[0]));
  await f.decide('review', pending, { grant: false, status: 403 });
  await f.decide('approve', pending, { status: 409 });
  const { proposal: reviewed } = await f.decide('review', pending);
  assert.equal(reviewed.status, 'reviewed');
  assert.equal(reviewed.impact.ok, true, JSON.stringify(reviewed.impact.problems));
  assert.deepEqual(reviewed.impact.widths, [393, 768, 1440]);
  assert.notEqual(reviewed.reviewRevision, pending.reviewRevision);
  assert.equal(reviewed.impact.perSection.find(({ id }) => id === '02-hero').changed, false);
  assert.equal(reviewed.impact.perSection.find(({ id }) => id === PEER).changed, true);
  checkVisibleFiles(f, BASE);
  save('review.json', JSON.stringify(reviewed, null, 2));

  for (const { width, height, viewport } of reviewed.impact.perWidth) {
    const base = `${ROUTE}/${pending.id}/evidence/${reviewed.reviewRevision}/${width}`;
    const peer = reviewed.impact.perSection.find(({ id }) => id === PEER).widths.find(view => view.width === width);
    for (const [side, rgb] of [['before', [103, 36, 54]], ['after', [36, 98, 72]]]) {
      const view = await f.request(`${base}/${side}`, { png: true });
      assert.equal(sha256(view), viewport[side]);
      const decoded = decodePng(view);
      assert.deepEqual([decoded.width, decoded.height], [width, height]);
      const crop = await f.request(`${base}/${side}?section=${PEER}`, { png: true });
      assert.equal(sha256(crop), peer[side].sha256);
      assert.deepEqual([...decodePng(crop).rgb.subarray(-3)], rgb);
      save(`${width}-${side}.png`, view);
      save(`${width}-${side}-about.png`, crop);
    }
    await f.request(`${base}/after?section=07-unknown`, { status: 404 });
  }
  await f.decide('approve', reviewed, { grant: false, status: 403 });
  await f.decide('approve', pending, { status: 409 });
  checkVisibleFiles(f, BASE);
  const { proposal: approved } = await f.decide('approve', reviewed);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.impact.digest, reviewed.impact.digest);
  checkVisibleFiles(f, pending.after);

  const second = await propose(2);
  const tokens = path.join(f.project, 'tokens.css');
  const stale = pending.after + '/* Changed after the worker proposal. */\n';
  fs.writeFileSync(tokens, stale);
  const outdated = await f.decide('review', second, { status: 409 });
  assert.match(outdated.error, /stylesheet changed/i);
  checkVisibleFiles(f, stale);
  fs.writeFileSync(tokens, pending.after);
  const { proposal: rejected } = await f.decide('reject', second);
  assert.equal(rejected.status, 'rejected');
  checkVisibleFiles(f, pending.after);

  const work = fs.readFileSync(f.launches, 'utf8').trim().split('\n').map(JSON.parse).filter(({ label }) => label === 'Work');
  assert.deepEqual(work.map(({ id, token }) => [id, token]), [['02', COLORS[0]], ['02', COLORS[1]]]);
  assert.ok(work.every(({ cwd, lockedGuidance, proposalGuidance }) => path.dirname(cwd) === path.join(f.project, '.run', 'ws') && lockedGuidance && proposalGuidance));
  assert.deepEqual(fs.readdirSync(path.join(f.project, '.run', 'ws')), []);
  const chat = await f.request('/api/chat');
  assert.equal(chat.messages.filter(({ from, kind, text }) => from === '02' && kind === 'done' && text === FIXTURE_DONE).length, 2);
  save('outcome.json', JSON.stringify({ digest: reviewed.impact.digest, outcomes: [approved.status, rejected.status],
    anchorId: f.anchor.id, contractSha256: sha256(f.anchor.contract), widths: reviewed.impact.widths }, null, 2));
});
