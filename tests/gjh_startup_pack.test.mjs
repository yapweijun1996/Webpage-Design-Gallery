import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../demos/corporate/gjh/v11/assets/', import.meta.url);
const names = JSON.parse(await readFile(new URL('../data/gjh-startup-assets.json', import.meta.url), 'utf8'));
const pack = await readFile(new URL('startup-assets.pack', root));
let sequence = 0;
const loader = () => import(new URL(`startup-asset-pack.js?test=${sequence++}`, root));
const response = value => new Response(value, {status: 200});

test('one shared pack returns byte-identical models and releases its cached bytes', async () => {
  const originalFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (String(url).endsWith('/startup-assets.pack')) return response(pack);
    return response(await readFile(new URL(url)));
  };
  try {
    const {fetchStartupAsset, releaseStartupAssetPack} = await loader();
    const loaded = await Promise.all(names.map(async name => {
      const value = await fetchStartupAsset(new URL(name, root));
      return Buffer.from(await value.arrayBuffer());
    }));
    for (let i = 0; i < names.length; i++) assert.deepEqual(loaded[i], await readFile(new URL(names[i], root)));
    assert.equal(calls.length, 1);
    releaseStartupAssetPack();
    const direct = await fetchStartupAsset(new URL(names[0], root));
    assert.deepEqual(Buffer.from(await direct.arrayBuffer()), await readFile(new URL(names[0], root)));
    assert.equal(calls.length, 2);
    assert.ok(calls[1].endsWith('/' + names[0]));
  } finally { globalThis.fetch = originalFetch; }
});

test('a missing, malformed or truncated pack falls back to the original model', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const failure of ['missing', 'malformed', 'truncated']) {
      const calls = [];
      globalThis.fetch = async url => {
        calls.push(String(url));
        if (String(url).endsWith('/startup-assets.pack')) {
          if (failure === 'missing') throw Error('unavailable');
          return response(failure === 'malformed' ? Buffer.from('not a pack') : pack.subarray(0, pack.length - 10));
        }
        return response(await readFile(new URL(url)));
      };
      const {fetchStartupAsset} = await loader();
      const value = await fetchStartupAsset(new URL(names[0], root));
      assert.deepEqual(Buffer.from(await value.arrayBuffer()), await readFile(new URL(names[0], root)));
      assert.equal(calls.length, 2, failure);
      assert.ok(calls[1].endsWith('/' + names[0]));
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('one cancelled caller does not cancel a different caller sharing the pack', async () => {
  const originalFetch = globalThis.fetch;
  let finish, calls = 0;
  globalThis.fetch = () => { calls++; return new Promise(resolve => { finish = () => resolve(response(pack)); }); };
  try {
    const {fetchStartupAsset} = await loader();
    const controller = new AbortController();
    const cancelled = fetchStartupAsset(new URL(names[0], root), {signal: controller.signal});
    const surviving = fetchStartupAsset(new URL(names[1], root));
    controller.abort();
    await assert.rejects(cancelled, {name: 'AbortError'});
    finish();
    assert.deepEqual(Buffer.from(await (await surviving).arrayBuffer()), await readFile(new URL(names[1], root)));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
