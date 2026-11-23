'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { PassThrough, Readable } = require('node:stream');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { compileFunction } = require('node:vm');
const { createChat } = require('../lib/chat');
const { projectPath, projectIdentity, ProjectInputError, ProjectBusyError, withProjectLock } = require('../lib/project-init');

const serverFile = path.join(__dirname, '../server.js');
const serverRequire = createRequire(serverFile);
const loadServer = compileFunction(fs.readFileSync(serverFile, 'utf8'), ['require', '__dirname', 'process', 'console'], { filename: serverFile });
const roster = [{ id: '01', name: 'Sample Worker', section: 'hero', color: '#123abc', lane: 'Build the hero.' }];
const savedMessage = { id: 1, from: 'system', to: [], kind: 'system', text: 'Saved message.' };

function fixture(t, { existing = true, environment = {} } = {}) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-init-test-')));
  const root = path.join(tmp, 'swarm');
  const project = path.join(root, 'projects', 'fixture');
  function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  write(path.join(root, 'template', 'agents.json'), JSON.stringify(roster));
  write(path.join(root, 'template', 'brief.md'), 'Default brief.');
  write(path.join(root, 'template', 'CONTRACT.md'), 'Lanes\n{{LANES}}');
  write(path.join(root, 'staff', 'handbook.md'), 'Sample handbook.');
  write(path.join(root, 'design-system', 'tokens.css'), ':root {}');
  const tokens = path.join(tmp, 'design-canvas', 'tokens.css');
  write(tokens, ':root {}');
  if (existing) {
    write(path.join(project, 'brief.md'), 'Existing brief.');
    write(path.join(project, 'sections', '01-hero.html'), '<section>Existing work.</section>');
    write(path.join(project, 'channel.jsonl'), `${JSON.stringify(savedMessage)}\n`);
  }

  let handler;
  let child;
  let watchError;
  const watchers = [];
  const spawns = [];
  const channels = [];
  const errors = [];
  const mocks = {
    http: { createServer(fn) { handler = fn; return { listen() {} }; } },
    fs: { ...fs, watch(dir) {
      if (watchError) throw watchError;
      assert.equal(dir, project);
      const watcher = { closed: false, close() { this.closed = true; } };
      watchers.push(watcher);
      return watcher;
    } },
    './lib/chat': { createChat(options) {
      const channel = createChat(options);
      channels.push(channel);
      return channel;
    } },
    child_process: { spawnSync() {}, spawn(_command, _args, options) {
      assert.ok(fs.existsSync(path.join(project, 'channel.md')));
      child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough() });
      spawns.push({ options, child });
      child.kill = () => child.emit('close', 1);
      return child;
    } }
  };
  t.after(() => {
    child?.kill();
    for (const channel of channels) channel.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
  loadServer(id => mocks[id] ?? serverRequire(id), root, { env: { SWARM_PROJECT: 'fixture', ...environment }, on() {} },
    { ...console, error: (...message) => errors.push(message) });

  async function request(url, input) {
    const req = typeof input === 'string' ? Readable.from([Buffer.from(input)]) : (input ?? Readable.from([]));
    Object.assign(req, { url, method: input === undefined ? 'GET' : 'POST', headers: { host: 'localhost', 'content-type': 'application/json' } });
    const response = {};
    await handler(req, {
      writeHead(status) { response.status = status; },
      end(body) { response.body = JSON.parse(body); }
    });
    return response;
  }

  const target = { project: 'fixture', projectId: projectIdentity(project) };
  return { root, project, tokens, write, request, target, watchers, spawns, errors, failWatcher(error) { watchError = error; } };
}

async function assertPreviousProject(f) {
  assert.equal(fs.readFileSync(path.join(f.project, 'sections', '01-hero.html'), 'utf8'), '<section>Existing work.</section>');
  assert.equal(fs.readFileSync(path.join(f.project, 'brief.md'), 'utf8'), 'Existing brief.');
  assert.equal((await f.request('/api/state')).body.brief, 'Existing brief.');
  assert.deepEqual((await f.request('/api/chat')).body.messages, [savedMessage]);
  assert.deepEqual(fs.readdirSync(path.dirname(f.project)), ['fixture']);
  assert.equal(f.watchers[0].closed, false);
}

test('starts a fresh project with the bundled roster format and ready channel files', async t => {
  const f = fixture(t, { existing: false });
  assert.equal((await f.request('/api/state')).body.brief, 'Default brief.');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.project, 'agents.json'), 'utf8')), roster);
  assert.ok(fs.existsSync(path.join(f.project, 'channel.md')));
  assert.deepEqual(fs.readdirSync(path.dirname(f.project)), ['fixture']);
});

test('rejects invalid initialization options and roster content while retaining the live project', async t => {
  const f = fixture(t);
  const agents = path.join(f.root, 'sample-roster.json');
  f.write(agents, JSON.stringify({ workers: roster }));
  for (const route of ['/api/init', '/api/run']) {
    for (const body of ['{"brief":', '[]', ...[{ brief: 42 }, { agents: false }, { agents }].map(input => JSON.stringify({ ...f.target, ...input }))]) {
      assert.equal((await f.request(route, body)).status, 400);
    }
  }
  await assertPreviousProject(f);
  assert.deepEqual(f.errors, []);
});

test('both initialization routes preserve the project when the expected identity is missing or different', async t => {
  const f = fixture(t);
  for (const route of ['/api/init', '/api/run']) {
    for (const wrong of [{}, { project: 'another-project' }, { projectId: 'different-checkout' }]) {
      const target = Object.keys(wrong).length ? { ...f.target, ...wrong } : {};
      assert.equal((await f.request(route, JSON.stringify({ ...target, brief: 'New brief.' }))).status, 400);
      await assertPreviousProject(f);
    }
  }
  assert.deepEqual(f.errors, []);
});

test('the CLI refuses a port occupied by another project or checkout and targets the matching server', async t => {
  const requests = [];
  const target = { project: 'fixture', projectId: projectIdentity(projectPath(path.join(__dirname, '..'), 'fixture')) };
  let served = { project: 'another-project', projectId: 'different-project' };
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, body: body && JSON.parse(body) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.method === 'GET' ? served : { ok: true }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const start = (...flags) => promisify(execFile)(process.execPath, [path.join(__dirname, '../cli.js'), 'start', '--port', String(server.address().port), ...flags], {
    env: { ...process.env, SWARM_PROJECT: 'fixture' },
    timeout: 10000,
  });

  await assert.rejects(start('--brief', 'New brief.'), /does not serve project fixture/);
  served = { project: 'fixture', projectId: 'different-checkout' };
  await assert.rejects(start('--keep'), /does not serve project fixture/);
  assert.deepEqual(requests.splice(0).map(({ method, url }) => [method, url]), [['GET', '/api/state'], ['GET', '/api/state']]);

  served = target;
  await start('--brief', 'New brief.');
  assert.deepEqual(requests.map(({ method, url }) => [method, url]), [['GET', '/api/state'], ['POST', '/api/init']]);
  assert.deepEqual(requests[1].body, { ...target, brief: 'New brief.' });
});

test('preserves the live project on staging and activation failures and allows a retry', async t => {
  const f = fixture(t);
  fs.unlinkSync(f.tokens);
  assert.equal((await f.request('/api/init', JSON.stringify({ ...f.target, brief: 'Replacement brief.' }))).status, 500);
  await assertPreviousProject(f);
  f.write(f.tokens, ':root {}');

  // Fail after promotion, while opening the watch handle for the replacement.
  f.failWatcher(new Error('Synthetic watcher failure'));
  assert.equal((await f.request('/api/run', JSON.stringify({ ...f.target, brief: 'Replacement brief.' }))).status, 500);
  await assertPreviousProject(f);
  assert.equal(f.errors.length, 2);
  f.failWatcher(undefined);

  const agents = path.join(f.root, 'sample-roster.json');
  const customRoster = [{ ...roster[0], title: 'Sample Designer', runner: 'codex', effort: 'medium' }];
  f.write(agents, JSON.stringify(customRoster));
  assert.deepEqual(await f.request('/api/init', JSON.stringify({ ...f.target, brief: 'Replacement brief.', agents })), { status: 200, body: { ok: true } });
  const state = (await f.request('/api/state')).body;
  assert.equal(state.phase, 'ready');
  assert.equal(state.brief, 'Replacement brief.');
  assert.equal(state.agents['01'].title, 'Sample Designer');
  assert.equal(f.watchers[0].closed, true);
  assert.equal(f.watchers[1].closed, false);
  assert.deepEqual((await f.request('/api/chat')).body.messages, []);
  assert.deepEqual(fs.readdirSync(path.dirname(f.project)), ['fixture']);
});

test('checks for an active run again after a concurrent initialization body arrives', async t => {
  const f = fixture(t, { environment: { PATH: '/usr/bin', SWARM_PORT: '8821', OPENAI_API_KEY: 'fixture-key', FAKE_FAIL_AGENT: '01' } });
  const delayedBody = new PassThrough();
  const delayed = f.request('/api/init', delayedBody);
  assert.deepEqual(await f.request('/api/run', JSON.stringify({ ...f.target, brief: 'Run brief.' })), { status: 200, body: { ok: true } });
  delayedBody.end(JSON.stringify({ ...f.target, brief: 'Later brief.' }));
  assert.equal((await delayed).status, 409);
  const state = (await f.request('/api/state')).body;
  assert.equal(state.phase, 'running');
  assert.equal(state.brief, 'Run brief.');
  assert.equal(fs.readFileSync(path.join(f.project, 'brief.md'), 'utf8'), 'Run brief.');
  assert.deepEqual(f.spawns[0].options.env, { PATH: '/usr/bin', SWARM_PORT: '8821' });
  assert.deepEqual(f.errors, []);
  await f.request('/api/stop', '{}');
});

test('the scoped Studio appearance reaches the preview URL in the running agent prompt', async t => {
  const f = fixture(t);
  const response = await f.request('/api/chat', JSON.stringify({
    from: 'owner',
    text: 'Review this section.',
    scope: { sections: ['01'], appearance: { theme: 'light', brand: 'forest-gold', lang: 'ms', extra: 'ignored' } },
  }));
  assert.equal(response.status, 200);
  const prompt = f.spawns[0].child.stdin.read().toString();
  const previewLink = prompt.match(/Inspect the same live rendering as Studio at `([^`]+)`/)?.[1];
  assert.equal(previewLink, 'http://127.0.0.1:8800/studio.html?preview=1&theme=light&brand=forest-gold&lang=ms');
  assert.match(prompt, /^STEP: Triage/);
  assert.match(prompt, /Review this section\.$/);
  f.spawns[0].child.emit('close', 0);
});

test('requires a single name and a real directory for the project transaction', t => {
  const f = fixture(t);
  assert.throws(() => projectPath(f.root, 'Project Name'), ProjectInputError);
  const alias = projectPath(f.root, 'alias');
  fs.symlinkSync(f.project, alias, 'dir');
  assert.throws(() => withProjectLock(alias, () => assert.fail('Transaction entered for an alias')), ProjectInputError);
  assert.equal(fs.readFileSync(path.join(f.project, 'brief.md'), 'utf8'), 'Existing brief.');
});

test('restores the original directory when the staged promotion fails', async t => {
  const f = fixture(t);
  assert.throws(() => withProjectLock(f.project, (_exists, replace) => {
    replace(next => fs.rmdirSync(next), () => assert.fail('Unpromoted project was opened'));
  }), { code: 'ENOENT' });
  await assertPreviousProject(f);
});

test('holds the project lock during staging and activation and releases it on success', async t => {
  const f = fixture(t);
  assert.equal(projectPath(f.root, 'fixture'), f.project);
  function assertLocked() {
    assert.throws(() => withProjectLock(f.project, () => assert.fail('Second transaction entered')), ProjectBusyError);
  }
  withProjectLock(f.project, (exists, replace) => {
    assert.equal(exists, true);
    replace(next => {
      assertLocked();
      assert.equal(fs.readFileSync(path.join(f.project, 'brief.md'), 'utf8'), 'Existing brief.');
      f.write(path.join(next, 'brief.md'), 'Replacement brief.');
    }, () => {
      assertLocked();
      assert.equal(fs.readFileSync(path.join(f.project, 'brief.md'), 'utf8'), 'Replacement brief.');
    });
  });
  assert.deepEqual(fs.readdirSync(path.dirname(f.project)), ['fixture']);
});
