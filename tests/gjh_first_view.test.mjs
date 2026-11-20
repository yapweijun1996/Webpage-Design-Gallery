import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import test from 'node:test';
import {gzipSync} from 'node:zlib';

import {createLoaderState} from '../demos/corporate/gjh/v11/assets/loader.js';
import R from '../demos/corporate/gjh/v11/vendor/rapier.mjs';
import {startPhysics} from '../demos/corporate/gjh/v11/assets/startup-physics.js';

const root = new URL('../demos/corporate/gjh/v11/', import.meta.url);
const data = new URL('../data/', import.meta.url);
const json = async (name, base) => JSON.parse(await readFile(new URL(name, base), 'utf8'));
const plan = await json('gjh-first-view.json', data);
const packNames = await json('gjh-startup-assets.json', data);
const entry = await readFile(new URL('index.html', root), 'utf8');
const template = entry.match(/<template id="walk-preloads">([\s\S]+?)<\/template>/)[1];
const preloads = [...template.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map(match => match[1]);
const imagePreloads = [...template.matchAll(/rel="preload" href="([^"]+)" as="image"/g)].map(match => match[1]);
const mobileConcept = /<picture class="responsive-concept"><source media="\(max-width: 600px\)" srcset="([^"]+)">(<img[^>]+>)<\/picture>/g;

async function firstView(phone = false) {
  // Follow the declared walk modules through their complete static import graph.
  const files = new Set(['index.html']);
  const queue = [...preloads, ...imagePreloads, ...plan.criticalFiles];
  const html = phone ? entry.replace(
    mobileConcept,
    (_, src, img) => img.replace(/\bsrc="[^"]+"/, `src="${src}"`)
  ) : entry;
  for (const tag of html.matchAll(/<(?:img|script|link)\b[^>]*>/g)) {
    if (/loading="lazy"|rel="related"/.test(tag[0])) continue;
    const path = tag[0].match(/\b(?:src|href)="([^"#:]+)"/)?.[1];
    if (path) queue.push(path);
  }
  for (const path of queue) {
    if (files.has(path)) continue;
    files.add(path);
    if (!/\.(?:js|mjs)$/.test(path)) continue;
    const url = new URL(path, root);
    const source = await readFile(url, 'utf8');
    for (const [, dependency] of source.matchAll(/^(?:import|export)(?:\s+[^;]*?\s+from)?\s*["'](\.[^"']+)["']/gm)) {
      const resolved = new URL(dependency, url);
      assert.ok(resolved.href.startsWith(root.href), `Unexpected module boundary: ${resolved.href}`);
      queue.push(resolved.href.slice(root.href.length));
    }
  }
  return files;
}

test('the declared entry dependencies fit the compressed first-view budget on phone and desktop', async t => {
  assert.deepEqual(preloads, plan.walkPreloads);
  assert.deepEqual(imagePreloads, plan.walkImagePreloads);
  for (const phone of [true, false]) {
    const files = await firstView(phone);
    let wire = 0, raw = 0, wireWithRawWasm = 0;
    for (const path of files) {
      const bytes = await readFile(new URL(path, root));
      const encoded = /\.(?:js|mjs|html|css|svg|json|webmanifest|wasm)$/.test(path)
        ? gzipSync(bytes, {level:6}).length : bytes.length;
      raw += bytes.length;
      wire += encoded;
      wireWithRawWasm += path.endsWith('.wasm') ? bytes.length : encoded;
    }
    t.diagnostic(JSON.stringify({phone, requests:files.size, rawBytes:raw, gzipWireBytes:wire, gzipExceptWasmBytes:wireWithRawWasm}));
    assert.ok(wire <= plan.maxWireBytes, `${wire} > ${plan.maxWireBytes}`);
  }
});

test('the four entry illustrations use low-priority mobile sources with full-size desktop fallbacks', async () => {
  const responsive = [...entry.matchAll(mobileConcept)];
  let bytes = 0;
  for (const name of ['wayfinding', 'newmoon-hotpot', 'mili-noodles', 'gogo-toast']) {
    const src = `assets/concept-${name}.webp`;
    const small = `assets/concept-${name}-480.webp`;
    const pictures = responsive.filter(([, , img]) => img.includes(`src="${src}"`));
    const uses = entry.split(`src="${src}"`).length - 1;
    assert.ok(uses > 0);
    assert.equal(pictures.length, uses, src);
    for (const [, source, img] of pictures) {
      assert.equal(source, small);
      assert.match(img, /decoding="async" fetchpriority="low"/);
      if (!img.includes('alt="Illustrated wayfinding signs in the mall"')) assert.match(img, /loading="lazy"/);
    }
    bytes += (await readFile(new URL(small, root))).length;
  }
  assert.ok(bytes <= 90_000, `Phone concept illustrations total ${bytes} bytes`);
});

test('optional assets exist, have lazy entry points and stay out of the first-view downloads', async () => {
  const eager = await firstView();
  for (const {path,loader,trigger} of plan.deferred) {
    const implementation = await readFile(new URL(loader, root), 'utf8');
    assert.ok(implementation.includes(trigger), `${path} has no deferred loader`);
    let names = [path];
    if (path.endsWith('/*.glb')) {
      const directory = path.split('*')[0];
      names = (await readdir(new URL(directory, root))).filter(name => name.endsWith('.glb'))
        .map(name => directory + name);
    } else if (path.endsWith('#placed')) {
      const registry = await json('gjh-interior-additions.json', data);
      names = registry.assets.filter(asset => asset.placed)
        .map(asset => `assets/${asset.asset_id.replaceAll('-', '_')}.glb`);
      assert.equal(names.length, 11);
    }
    assert.ok(names.length, path);
    for (const name of names) {
      await readFile(new URL(name, root));
      assert.ok(!eager.has(name) && !packNames.includes(name.slice('assets/'.length)), name);
      assert.ok(!entry.match(new RegExp(`(?:src|href)="${name}"`)), name);
    }
  }
  assert.ok(packNames.includes('gjh-tripo-entry.glb'));
  assert.ok(packNames.includes('elevator/low.glb'));
  assert.ok(!eager.has('assets/elevator/low.glb'));
  assert.doesNotMatch(entry, /rel="preload"[^>]+as="font"/);
});

test('without a browser, real Rapier bytes stream before the entry gate and the directory stays usable', async t => {
  const original = await readFile(new URL('vendor/rapier_bg.wasm', root));
  const engine = createLoaderState();
  const received = [];
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url.href, new URL('vendor/rapier_bg.wasm', root).href);
    return new Response(new ReadableStream({
      start(stream) {
        stream.enqueue(original.subarray(0, 10000));
        stream.enqueue(original.subarray(10000));
        stream.close();
      }
    }));
  });

  const bytes = await startPhysics((loaded, total) => received.push([loaded,total]));
  await R.init(bytes);
  const physics = new R.World({x:0,y:-24,z:0});
  t.after(() => physics.free());
  const body = physics.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 2, 0));
  physics.createCollider(R.ColliderDesc.ball(.25).setDensity(1), body);
  for (let step = 0; step < 10; step++) physics.step();
  assert.ok(body.translation().y < 2);
  assert.deepEqual(received, [[10000, original.length], [original.length, original.length]]);
  for (const stage of ['physics', 'scene', 'models']) {
    engine.complete(stage);
    assert.equal(engine.snapshot().preparing, false);
    engine.enterNow();
    assert.equal(engine.skipSignal.aborted, false);
  }
  engine.complete('frame');
  assert.equal(engine.snapshot().preparing, true);
  engine.enterNow();
  assert.equal(engine.skipSignal.reason, 'enter-now');
  const directory = createLoaderState();
  directory.dismiss();
  assert.equal(directory.skipSignal.reason, 'directory');
});
