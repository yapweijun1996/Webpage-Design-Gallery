'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const { promisify } = require('node:util');
const { createImageRoute } = require('../lib/image-routes');

const runFile = promisify(execFile);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvxkAAAAASUVORK5CYII=', 'base64');
const WEBP = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
const TOKEN = 'fixture-turn';

function generatePng({ outFile }, bytes = PNG) {
  fs.writeFileSync(outFile, bytes);
  return { ok: true, ms: 42 };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(t, options = {}) {
  const projectDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-image-api-')));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const turn = { root: path.join(projectDir, '.run', 'ws', 'fixture'), base: '02-hero', pending: 0 };
  fs.mkdirSync(turn.root, { recursive: true });
  const turns = new Map([[TOKEN, turn]]);
  let busy = false;
  let ownerWrites = 0;
  const generated = [];
  const route = createImageRoute({
    projectDir, turns, busy: () => busy || ownerWrites > 0,
    settings: options.settings || (() => ({ provider: 'openai', model: 'test-model', quality: 'high', size: '1536x1024' })),
    key: () => 'fixture-key',
    generate(args) {
      generated.push(args);
      return (options.generate || generatePng)(args);
    },
    convert: options.convert,
    startWrite() {
      ownerWrites += 1;
      return () => { ownerWrites -= 1; };
    },
  });
  const request = (token, body = { name: '02-hero-image', prompt: 'Test image' }) => {
    const req = Readable.from([JSON.stringify(body)]);
    req.headers = token === undefined ? {} : { 'x-swarm-image-turn': token };
    return route(req, {}, (_, status, payload) => ({ status, payload }));
  };
  return { projectDir, turns, turn, generated, request, setBusy: value => { busy = value; }, writes: () => ownerWrites };
}

test('idle owner generation preserves provider settings and publishes WebP with the existing response', async t => {
  const f = fixture(t, {
    convert(png, webp) {
      assert.deepEqual(fs.readFileSync(png), PNG);
      assert(!png.startsWith(f.projectDir + path.sep));
      fs.writeFileSync(webp, WEBP);
      return true;
    },
  });
  const result = await f.request(undefined, { name: '02-HERO-IMAGE', prompt: 'Test image', size: '1024x1024' });
  assert.deepEqual(result, { status: 200, payload: { ok: true, path: 'assets/generated/02-hero-image.webp', bytes: WEBP.length, ms: 42 } });
  const { outFile, ...args } = f.generated[0];
  assert.deepEqual(args, { apiKey: 'fixture-key', model: 'test-model', quality: 'high', size: '1024x1024', prompt: 'Test image' });
  assert.deepEqual(fs.readFileSync(path.join(f.projectDir, result.payload.path)), WEBP);
  assert.deepEqual(fs.readdirSync(path.join(f.projectDir, 'assets', 'generated')), ['02-hero-image.webp']);
  assert.equal(fs.existsSync(path.dirname(outFile)), false);
  assert.equal(f.writes(), 0);
});

test('a scoped running turn publishes its image to its workspace and invalid scopes never generate', async t => {
  const f = fixture(t);
  f.setBusy(true);
  assert.equal((await f.request()).status, 409);
  assert.equal((await f.request('unknown')).status, 403);
  assert.equal((await f.request('')).status, 403);
  assert.equal((await f.request(TOKEN, { name: '03-other-image', prompt: 'Test image' })).status, 403);
  assert.equal((await f.request(TOKEN, { name: '02-heroic-image', prompt: 'Test image' })).status, 403);
  assert.equal(f.generated.length, 0);
  const result = await f.request(TOKEN);
  assert.equal(result.status, 200);
  assert.deepEqual(fs.readFileSync(path.join(f.turn.root, result.payload.path)), PNG);
  assert.equal(fs.existsSync(path.join(f.projectDir, 'assets')), false);
  assert.equal(f.turn.pending, 0);
  assert.equal(f.writes(), 0);
});

test('canceling a turn while the provider is running leaves no image or recreated workspace', async t => {
  const entered = deferred();
  const resume = deferred();
  const f = fixture(t, {
    async generate(args) {
      entered.resolve();
      await resume.promise;
      return generatePng(args);
    },
  });
  const response = f.request(TOKEN);
  await entered.promise;
  assert.equal(f.turn.pending, 1);
  f.turns.delete(TOKEN);
  fs.rmSync(f.turn.root, { recursive: true });
  resume.resolve();
  assert.equal((await response).status, 403);
  assert.equal(f.turn.pending, 0);
  assert.equal(fs.existsSync(f.turn.root), false);
  assert.equal(fs.existsSync(path.dirname(f.generated[0].outFile)), false);
  assert.equal(fs.existsSync(path.join(f.projectDir, 'assets')), false);
});

test('an image awaiting WebP conversion still belongs to its original registered turn', async t => {
  const entered = deferred();
  const resume = deferred();
  const f = fixture(t, {
    async convert(_png, webp) {
      entered.resolve();
      await resume.promise;
      fs.writeFileSync(webp, WEBP);
      return true;
    },
  });
  const pending = f.request(TOKEN);
  await entered.promise;
  const replacement = { ...f.turn, pending: 0 };
  f.turns.set(TOKEN, replacement);
  resume.resolve();
  assert.equal((await pending).status, 403);
  assert.equal(fs.existsSync(path.join(f.turn.root, 'assets')), false);
  assert.equal(f.turn.pending, 0);
  assert.equal(replacement.pending, 0);
});

test('owner reservation spans generation and release on failure', async t => {
  const entered = deferred();
  const resume = deferred();
  const f = fixture(t, {
    async generate() {
      entered.resolve();
      await resume.promise;
      return { ok: false, error: 'Mock provider failure.' };
    },
  });
  const pending = f.request();
  await entered.promise;
  assert.equal(f.writes(), 1);
  assert.equal((await f.request()).status, 409);
  resume.resolve();
  assert.deepEqual(await pending, { status: 502, payload: { ok: false, error: 'Mock provider failure.' } });
  assert.equal(f.writes(), 0);
  assert.equal(fs.existsSync(path.join(f.projectDir, 'assets')), false);
});

test('a destination must stay inside the original workspace and use regular directories and files', async t => {
  const phase = deferred();
  const resume = deferred();
  const f = fixture(t, {
    async generate(args) {
      phase.resolve();
      await resume.promise;
      return generatePng(args);
    },
  });
  const outside = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-image-unrelated-')));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(f.turn.root, 'assets'));
  assert.equal((await f.request(TOKEN)).status, 409);
  fs.unlinkSync(path.join(f.turn.root, 'assets'));
  const assets = path.join(f.turn.root, 'assets', 'generated');
  fs.mkdirSync(assets, { recursive: true });
  const reference = path.join(assets, '02-hero-image.png');
  const unaffected = path.join(outside, 'original');
  fs.writeFileSync(unaffected, 'original content');
  fs.symlinkSync(unaffected, reference);
  assert.equal((await f.request(TOKEN)).status, 409);
  fs.unlinkSync(reference);
  assert.equal(f.generated.length, 0);

  const pending = f.request(TOKEN);
  await phase.promise;
  const previous = f.turn.root + '-previous';
  fs.renameSync(f.turn.root, previous);
  fs.mkdirSync(f.turn.root);
  resume.resolve();
  assert.equal((await pending).status, 409);
  assert.deepEqual(fs.readdirSync(f.turn.root), []);
  assert.deepEqual(fs.readdirSync(path.join(previous, 'assets', 'generated')), []);
  assert.equal(fs.readFileSync(unaffected, 'utf8'), 'original content');
});

test('conversion failure retains PNG, while invalid provider data and oversized workspace images are rejected', async t => {
  const converted = fixture(t, { convert: () => false });
  assert.match((await converted.request(TOKEN)).payload.path, /\.png$/);
  const invalid = fixture(t, { generate: args => generatePng(args, Buffer.alloc(100)) });
  assert.equal((await invalid.request(TOKEN)).status, 502);
  assert.equal(fs.existsSync(path.join(invalid.turn.root, 'assets')), false);
  const oversized = fixture(t, { generate: args => generatePng(args, Buffer.concat([PNG, Buffer.alloc(1024 * 1024)])) });
  assert.equal((await oversized.request(TOKEN)).status, 422);
  assert.equal(fs.existsSync(path.join(oversized.turn.root, 'assets')), false);
});

test('the provider setting, request size, and shared 30 requests per hour cap apply before generation', async t => {
  const disabled = fixture(t, { settings: () => ({ provider: 'codex' }) });
  assert.equal((await disabled.request()).status, 409);
  assert.equal(disabled.generated.length, 0);
  const f = fixture(t);
  assert.equal((await f.request(undefined, { name: '02-hero-image', prompt: 'x'.repeat(32 * 1024) })).status, 413);
  for (let n = 0; n < 30; n += 1) {
    const result = await f.request(n % 2 ? TOKEN : undefined);
    assert.equal(result.status, 200);
  }
  assert.equal((await f.request()).status, 429);
  assert.equal((await f.request(TOKEN)).status, 429);
  assert.equal(f.generated.length, 30);
});

test('image helper forwards the turn to the loopback route and refuses redirects', async t => {
  const observed = [];
  let redirect = false;
  const server = http.createServer((req, res) => {
    observed.push({ url: req.url, token: req.headers['x-swarm-image-turn'] });
    req.resume();
    if (redirect && req.url === '/api/image') res.writeHead(307, { location: '/redirected' }).end();
    else res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const tool = path.join(__dirname, '..', 'tools', 'gen-image.js');
  const args = [tool, '--name', '02-hero-image', '--prompt', 'Test image'];
  const env = { ...process.env, SWARM_PORT: String(server.address().port), SWARM_IMAGE_TURN: TOKEN };
  const run = () => runFile(process.execPath, args, { env, timeout: 5000 });

  assert.deepEqual(JSON.parse((await run()).stdout), { ok: true });
  redirect = true;
  await assert.rejects(run(), { code: 1 });
  assert.deepEqual(observed, [{ url: '/api/image', token: TOKEN }, { url: '/api/image', token: TOKEN }]);
});
