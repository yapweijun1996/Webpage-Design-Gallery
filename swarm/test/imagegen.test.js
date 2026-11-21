'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSecrets } = require('../lib/secrets');
const { generate, testKey } = require('../lib/imagegen');

const KEY = 'sk-test_' + 'a'.repeat(30);
const PNG = Buffer.alloc(200, 7);

test('secrets: validate, store privately, never expose the key in status', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sw-sec-')), 'secrets.json');
  const s = createSecrets(f);
  assert.equal(s.setOpenAIKey('nope').ok, false);
  assert.equal(s.openAIKeyStatus().set, false);
  assert.deepEqual(s.setOpenAIKey(KEY), { ok: true, last4: KEY.slice(-4) });
  assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  const st = s.openAIKeyStatus();
  assert.deepEqual(Object.keys(st).sort(), ['last4', 'set']);
  assert.ok(!JSON.stringify(st).includes(KEY));
  assert.equal(s.getOpenAIKey(), KEY);
  s.removeOpenAIKey();
  assert.equal(s.getOpenAIKey(), '');
});

test('generate: sends the key as a bearer header only, writes the file, returns no key', async () => {
  let seen;
  const fetchImpl = async (url, opts) => { seen = { url, opts }; return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: PNG.toString('base64') }] }) }; };
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sw-img-')), 'a', 'x.png');
  const r = await generate({ apiKey: KEY, prompt: 'a warm market at dusk', outFile: out, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(fs.readFileSync(out).length, 200);
  assert.equal(seen.opts.headers.authorization, 'Bearer ' + KEY);
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.model, 'gpt-image-1'); assert.equal(body.n, 1);
  assert.ok(!JSON.stringify(r).includes(KEY));
});

test('generate: errors never leak the key, bad input is rejected before any request', async () => {
  let calls = 0;
  const bad = async () => { calls += 1; return { ok: false, status: 401, json: async () => ({ error: { message: 'Incorrect API key provided: ' + KEY } }) }; };
  const r = await generate({ apiKey: KEY, prompt: 'valid prompt', fetchImpl: bad });
  assert.equal(r.ok, false); assert.ok(!r.error.includes(KEY)); assert.equal(r.status, 401);
  const before = calls;
  for (const o of [{ prompt: 'x' }, { prompt: 'ok ok', model: 'BAD MODEL' }, { prompt: 'ok ok', size: '9x9' }, { prompt: 'ok ok', quality: 'ultra' }]) assert.equal((await generate({ apiKey: KEY, fetchImpl: bad, ...o })).ok, false);
  assert.equal(calls, before);
  assert.equal((await generate({ apiKey: '', prompt: 'ok ok' })).ok, false);
  const thrower = async () => { throw new Error('network down ' + KEY); };
  const t = await generate({ apiKey: KEY, prompt: 'ok ok', fetchImpl: thrower });
  assert.ok(!t.ok && !t.error.includes(KEY));
});

test('testKey: ok and failure messages are clean', async () => {
  assert.equal((await testKey({ apiKey: KEY, fetchImpl: async () => ({ ok: true }) })).ok, true);
  const r = await testKey({ apiKey: KEY, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'bad ' + KEY } }) }) });
  assert.equal(r.ok, false); assert.ok(!r.message.includes(KEY));
  assert.equal((await testKey({ apiKey: '' })).ok, false);
});
