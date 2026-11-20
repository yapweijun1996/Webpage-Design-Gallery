import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {composePianoPhrase, createPianoPiece} from '../demos/corporate/gjh/v11/assets/piano-composer.js';
import {createPianoSampler, PIANO_SAMPLES, PIANO_VOICES} from '../demos/corporate/gjh/v11/assets/piano-sampler.js';

const demo = new URL('../demos/corporate/gjh/v11/', import.meta.url);
const file = (name, root = demo) => readFileSync(new URL(name,root),'utf8');

test('seeded piano generates varied eight-bar phrases with bounded notes and a complete meter', () => {
  const zones = ['courtyard','newmoon','upper','christmas','tram'];
  const signature = phrase => phrase.map(({bass,melody}) =>
    [bass,melody].map(hand => hand.map(({note,beats}) => [note,beats])));
  for (const zone of zones) {
    for (let seed = 0; seed < 20; seed++) {
      const piece = createPianoPiece(seed,zone);
      assert(piece.bpm >= 58 && piece.bpm <= 84);
      const first = composePianoPhrase(piece,0);
      assert.deepEqual(first,composePianoPhrase(createPianoPiece(seed,zone),0));
      assert.notDeepEqual(signature(first),signature(composePianoPhrase(createPianoPiece(seed + 100,zone),0)));
      let previous = first;
      for (let index = 1; index < 12; index++) {
        const phrase = composePianoPhrase(piece,index);
        assert.notDeepEqual(signature(previous),signature(phrase));
        assert.equal(phrase.length,8);
        assert(phrase.some(bar => bar.melody.some(event => event.note === null)));
        for (const {beats,bass,melody} of phrase) {
          for (const hand of [bass,melody]) {
            let cursor = 0;
            for (const event of hand) {
              assert.equal(event.beat,cursor);
              assert(event.note === null || (Number.isInteger(event.note) && event.note >= 36 && event.note <= 96));
              assert(event.velocity > 0 && event.velocity < .4);
              cursor += event.beats;
            }
            assert.equal(cursor,beats);
            assert.equal(beats,4);
          }
        }
        previous = phrase;
      }
    }
  }
});

test('sampler is lazy, defers busy frames, decodes one file per frame and limits concurrent voices', async () => {
  const frames = [], fetched = [], sources = [], levels = [], decoded = [];
  let finishDecode, inFlight = 0;
  const context = {
    decodeAudioData(bytes) {
      assert.equal(++inFlight,1,'only one native decode can be pending');
      decoded.push(bytes);
      return new Promise(resolve => {
        finishDecode = () => { inFlight--; resolve(bytes); };
      });
    },
    createGain() {
      const envelope = [];
      levels.push(envelope);
      return {connect() {}, disconnect() {}, gain:{
        setValueAtTime: (...args) => envelope.push(args),
        linearRampToValueAtTime: (...args) => envelope.push(args)
      }};
    },
    createBufferSource() {
      const source = {playbackRate:{}, connect() {}, disconnect() {}, start() {}, stop() {}};
      sources.push(source);
      return source;
    }
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const sampler = createPianoSampler(context, {
    idle: callback => frames.push(callback),
    fetchSample: async url => {
      fetched.push(url.pathname.split('/').at(-1));
      return {ok:true, arrayBuffer:async () => new ArrayBuffer(1)};
    }
  });
  assert.equal(sampler.ready,false);
  assert.equal(sampler.play({},49,1,1,.3,12),false);
  assert.deepEqual(fetched,[]);
  const load = sampler.load();
  assert.equal(sampler.load(),load);
  await flush();
  assert.deepEqual(fetched,PIANO_SAMPLES.map(name => name + '.mp3'));
  assert.equal(frames.length,1);
  frames.shift()({timeRemaining: () => 0});
  assert.equal(decoded.length,0);
  for (const index of PIANO_SAMPLES.keys()) {
    assert.equal(frames.length,1);
    frames.shift()({timeRemaining: () => 3});
    await flush();
    assert.equal(decoded.length,index + 1);
    assert.equal(inFlight,1);
    assert.equal(frames.length,0,'the next slice waits for the active decode');
    assert.equal(sampler.ready,false);
    finishDecode();
    await flush();
  }
  await load;
  assert.equal(sampler.ready,true);
  for (const limit of Object.values(PIANO_VOICES)) {
    for (let i = 0; i < limit; i++) assert(sampler.play({},49,1,1,.3,limit));
    assert.equal(sampler.play({},49,1,1,.3,limit),false);
    sources.at(-1).onended();
    assert(sampler.play({},50,1,1,.3,limit));
    sampler.stop();
  }
  assert.equal(sources[0].buffer,decoded[0]);
  assert.equal(sources[0].playbackRate.value,2 ** (1/12));
  assert.equal(sources.at(-1).buffer,decoded[1]);
  assert.deepEqual(levels[0].at(-1),[0,2.12]);
});

test('re-enabling music waits for the native decode from the canceled load', async () => {
  const frames = [];
  const decodes = [];
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const sampler = createPianoSampler({
    decodeAudioData: () => new Promise(resolve => decodes.push(resolve))
  }, {
    idle: callback => frames.push(callback),
    fetchSample: async () => ({ok:true, arrayBuffer:async () => new ArrayBuffer(1)})
  });
  const first = sampler.load();
  await flush();
  frames.shift()();
  await flush();
  assert.equal(decodes.length,1);
  sampler.cancelLoad();
  const second = sampler.load();
  await flush();
  assert.equal(frames.length,0);
  decodes.shift()({});
  await first;
  await flush();
  assert.equal(frames.length,1);
  frames.shift()();
  await flush();
  assert.equal(decodes.length,1);
  sampler.cancelLoad();
  decodes.shift()({});
  await second;
  assert.equal(sampler.ready,false);
});

test('Menu keeps named sound toggles and the Mix disclosure with the original bus hooks', () => {
  for (const markup of [file('index.html'),file('../templates/gallery/gjh-v11-index.html',import.meta.url)]) {
    const controls = markup.match(/<div class="menu-card mall-audio"[\s\S]*?<\/details>/)[0];
    assert.match(controls,/role="group" aria-labelledby="mall-sound-heading"/);
    assert.match(controls,/<button [^>]*id="mall-music"[^>]*aria-pressed="false"/);
    assert.match(controls,/<button [^>]*id="mall-speaker"[^>]*aria-pressed="false" aria-keyshortcuts="M"/);
    assert.match(controls,/<span id="mall-music-label">Background music<\/span>/);
    assert.match(controls,/<p id="mall-music-title"[^>]* hidden>/);
    assert.match(controls,/<details class="menu-mix"><summary>Mix/);
    assert.deepEqual([...controls.matchAll(/data-audio-bus="([^"]+)"/g)].map(match => match[1]),
      ['master','music','effects','ambience']);
    assert.doesNotMatch(controls,/checkbox|hud-control|mall-music-toggle/);
    assert.match(markup,/Piano samples: Salamander Grand Piano V3 by Alexander Holm/);
  }
  const css = file('style.css');
  assert.match(css,/\.menu-switch-row,[^{]+\{[^}]*min-height:var\(--size-control\)/);
  assert.match(css,/\.mall-audio input\[type="range"\]\{[^}]*accent-color:var\(--gold\)/);
});

test('all 12 piano files have build-scoped runtime cache entries only', () => {
  const worker = file('pwa-sw.js');
  const entries = name => JSON.parse(worker.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`))[1]);
  const paths = entries('LAZY_ASSETS').map(entry => entry.path).filter(path => path.includes('/piano/'));
  assert.deepEqual(paths.sort(),PIANO_SAMPLES.map(name => `assets/audio/piano/${name}.mp3`).sort());
  assert(entries('PRECACHE').every(entry => !entry.path.includes('/piano/')));
  assert(!file('assets/startup-asset-pack.js').includes('/piano/'));
});
