import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {AUDIO_KEY, BEAT, createAudioManager, createTramNarration, LOOKAHEAD, SHOP_SOUNDS} from
  '../demos/corporate/gjh/v11/assets/audio.js';
import {createShopInteractionTarget} from '../demos/corporate/gjh/v11/assets/interiors/shop-interactions.js';
import {tramCaptions} from '../demos/corporate/gjh/v11/assets/tram-ride.js';
import {tramCaptionCopy} from '../demos/corporate/gjh/v11/assets/tram-caption-copy.js';

class Param {
  events = [];
  setValueAtTime(value, time) { this.events.push(['set',value,time]); }
  setTargetAtTime(value, time) { this.events.push(['target',value,time]); }
  linearRampToValueAtTime(value, time) { this.events.push(['linear',value,time]); }
  exponentialRampToValueAtTime(value, time) { this.events.push(['exponential',value,time]); }
  cancelScheduledValues(time) { this.events = this.events.filter(event => event[2] < time); }
}

function rig(storage) {
  const timers = new Set(), contexts = [], delays = new Map(), frames = [];
  const calls = {buffer:0, bufferSource:0, wave:0, oscillator:0, gain:0};
  let clock = 0;
  const audio = createAudioManager({
    storage,
    now: () => clock,
    idle: callback => frames.push(callback),
    later(callback, ms) { delays.set(callback, clock + ms); return callback; },
    cancelLater: callback => delays.delete(callback),
    every(callback, period) {
      assert.equal(period,75);
      timers.add(callback);
      return callback;
    },
    stopEvery(callback) { assert(timers.delete(callback)); },
    createContext() {
      clock += .5;
      const oscillators = [], gains = [];
      function node(key) {
        return {
          [key]: new Param(), links: new Set(), started:0, stopped:0,
          connect(target) { assert(!this.links.has(target)); this.links.add(target); },
          disconnect() { this.links.clear(); },
          start() { this.started++; },
          stop() { this.stopped++; },
          setPeriodicWave(wave) { this.wave = wave; }
        };
      }
      const ctx = {
        state:'suspended', currentTime:0, destination:{}, oscillators, gains, transitions:[],
        async resume() { clock += .25; this.transitions.push('run'); this.state = 'running'; },
        async suspend() { this.transitions.push('suspend'); this.state = 'suspended'; },
        async close() { this.transitions.push('close'); this.state = 'closed'; },
        createBuffer() { calls.buffer++; clock += .8; },
        createBufferSource() { calls.bufferSource++; clock += .8; },
        createOscillator() {
          calls.oscillator++; clock += .45;
          const source = node('frequency'); oscillators.push(source); return source;
        },
        createGain() {
          calls.gain++; clock += .35;
          const gain = node('gain'); gains.push(gain); return gain;
        },
        createPeriodicWave(_, harmonics) { calls.wave++; clock += .8; return harmonics; }
      };
      contexts.push(ctx);
      return ctx;
    }
  });
  function frame(remaining = 5) {
    assert.equal(frames.length,1,'one idle slice per frame');
    const start = clock;
    frames.shift()({timeRemaining: () => remaining});
    return clock - start;
  }
  function advance(ms) {
    clock += ms;
    for (const [callback, at] of delays) {
      if (at <= clock) { delays.delete(callback); callback(); }
    }
  }
  return {audio,timers,contexts,calls,frame,advance,
    async warm(ms = 1500) {
      await Promise.resolve();
      advance(ms);
      for (let count = 0; frames.length; count++) {
        assert(count < 30,'warmup must finish');
        assert(frame() <= 1.5);
      }
    },
    tick(time) { contexts[0].currentTime = time; for (const callback of timers) callback(); }};
}

test('first gesture only constructs and resumes the context, then setup stays within the idle slice budget', async () => {
  const {audio,calls,contexts,timers,frame,advance,warm} = rig();
  audio.setActive(true);
  await warm(0);
  assert.equal(contexts.length,0,'coefficients can be prepared before the gesture');
  audio.unlock();
  assert.deepEqual(calls,{buffer:0,bufferSource:0,wave:0,oscillator:0,gain:0});
  assert.deepEqual(audio.performanceReport(),{audioInitMs:.75,audioInitSliceMaxMs:0});
  assert.deepEqual(contexts[0].transitions,['run']);
  assert.equal(timers.size,0);
  await Promise.resolve();
  assert.equal(frame(1),0,'a busy frame defers setup');
  assert.equal(calls.gain,0);
  await warm(0);
  assert.equal(calls.gain,7,'master, two buses and four effects voices');
  assert.equal(calls.wave,3);
  assert.equal(timers.size,0);
  advance(1000);
  await warm(0);
  assert.equal(timers.size,0);
  advance(500);
  await warm(0);
  assert.equal(timers.size,1);
  assert(contexts[0].oscillators.every(voice => !voice.frequency.events.length),
    'the first score tick is separate from setup');
  const {audioInitSliceMaxMs} = audio.performanceReport();
  assert(audioInitSliceMaxMs > 0 && audioInitSliceMaxMs <= 1.5);
  audio.dispose();
});
function memoryStorage() {
  const rows = new Map();
  return {getItem:key => rows.get(key), setItem:(key,value) => rows.set(key,value)};
}

test('a Low phone can lazily play an effect before its pool is prewarmed', async () => {
  const {audio,frame,calls,warm,timers} = rig();
  audio.setPolicy(true,true,false);
  audio.setActive(true);
  await warm(0);
  audio.unlock();
  await Promise.resolve();
  frame(); // Master.
  frame(); // Effects bus.
  assert.equal(calls.oscillator,0);
  assert.equal(typeof audio.shop('press'),'function');
  assert.equal(calls.oscillator,1);
  await warm();
  assert.equal(calls.oscillator,2);
  assert.equal(calls.gain,5);
  assert.equal(timers.size,0);
  audio.dispose();
});

test('gesture creates one context, prime is silent, and mute/hidden gate the entire mixer', async () => {
  const storage = memoryStorage(), {audio,timers,contexts,tick,warm} = rig(storage);
  audio.play('bag');
  assert.equal(contexts.length,0);
  audio.unlock(true);
  const [ctx] = contexts;
  assert.equal(timers.size,0);
  assert.equal(audio.state.musicPlaying,false);
  audio.setActive(true);
  await warm();
  assert.equal(audio.state.musicPlaying,true);
  assert.equal(timers.size,1);
  audio.unlock();
  assert.equal(contexts.length,1);
  tick(0);
  audio.setHidden(true);
  assert.equal(ctx.state,'suspended');
  assert.equal(ctx.gains[0].gain.value,0);
  assert.equal(timers.size,0);
  assert.equal(audio.state.musicPlaying,false);
  audio.play('bag');
  audio.setMuted(true);
  audio.setHidden(false);
  assert.equal(ctx.state,'suspended');
  assert.equal(timers.size,0);
  audio.setMuted(false);
  assert.equal(ctx.state,'running');
  await warm(0);
  assert.equal(timers.size,1);
  audio.setActive(false);
  assert.equal(ctx.state,'suspended');
  assert.equal(timers.size,0);
  audio.dispose();
  await Promise.resolve();
  assert.equal(ctx.state,'closed');
  assert.equal(timers.size,0);
});

test('persists mute, demo mute, explicit music and independent bus levels', async () => {
  const storage = memoryStorage();
  const original = rig(storage).audio;
  original.setMuted(true);
  original.setDemoMuted(true);
  original.setMusic(true);
  original.setVoice(true);
  original.setVolume('ambience',.13);
  original.setVolume('effects',0);
  original.setVolume('music',.37);
  const {audio,contexts,timers,warm} = rig(storage);
  assert.deepEqual(JSON.parse(storage.getItem(AUDIO_KEY)), {
    muted:true, demoMuted:true, music:true, voice:true, levels:{music:.37,effects:0,ambience:.13}
  });
  audio.setPolicy(true,true,true);
  audio.setActive(true);
  audio.unlock();
  assert.equal(contexts.length,0);
  assert.equal(timers.size,0);
  assert.equal(audio.state.demoMuted,true);
  assert.equal(audio.state.voice,true);
  audio.setMuted(false);
  audio.unlock();
  await warm();
  assert.equal(audio.state.musicPlaying,true);
  assert.equal(audio.shop('listen'),undefined);
  audio.dispose();
});

test('Low phone, reduced motion and data saver policy leave the music clock and graph idle', async () => {
  for (const policy of [[true,true,false],[false,false,true]]) {
    const {audio,timers,contexts,tick,warm} = rig();
    audio.setPolicy(...policy);
    audio.setActive(true);
    audio.unlock();
    await warm();
    tick(0);
    const ctx = contexts[0];
    assert.equal(timers.size,0);
    assert.equal(ctx.gains.length,policy[0] ? 5 : 7);
    assert(ctx.oscillators.every(voice => voice.frequency.events.length === 0));
    audio.setMusic(true);
    await warm();
    const musicBus = ctx.gains.find(bus => bus.gain.value === .26);
    tick(.075);
    assert.equal(timers.size,1);
    assert.equal(musicBus.links.size,1);
    audio.setMusic(false);
    assert.equal(timers.size,0);
    assert.equal(musicBus.links.size,0);
    audio.dispose();
  }
  const {audio,contexts,timers,tick,warm} = rig();
  audio.setPolicy(true,false,false);
  audio.setActive(true);
  audio.unlock();
  await warm();
  tick(0);
  assert.equal(timers.size,1);
  audio.setPolicy(true,true,false);
  assert.equal(timers.size,0);
  assert.equal(contexts[0].gains.find(bus => bus.gain.value === .26).links.size,0);
  audio.dispose();
});

test('72 BPM lookahead maintains the swung grid across the eight-bar seam', async () => {
  const {audio,contexts,tick,warm} = rig();
  audio.setPolicy(true,false,false);
  audio.setActive(true);
  audio.unlock();
  await warm();
  const ctx = contexts[0];
  tick(0);
  const bass = ctx.oscillators[2].frequency;
  const hats = () => ctx.oscillators[5]?.frequency.events;
  assert.equal(bass.events[0][2],.026);
  assert.deepEqual(hats(),[]);
  for (let time = .075; time < 29; time += .075) {
    tick(time);
    for (const oscillator of ctx.oscillators) {
      for (const [kind,,at] of oscillator.frequency.events) {
        if (kind === 'set') assert(at <= time + LOOKAHEAD + .0121, at);
      }
    }
  }
  assert(Math.abs(hats()[0][2] - (.026 + .58 * BEAT)) < 1e-8);
  assert(bass.events.length > 32);
  for (let i = 1; i < bass.events.length; i++) {
    assert(Math.abs(bass.events[i][2] - bass.events[i-1][2] - BEAT) < 1e-8);
  }
  assert.equal(bass.events[0][1],bass.events[32][1]);
  audio.dispose();
});

test('shop effects and narration duck the same music bus, then restore its volume', async () => {
  const {audio,contexts,tick,warm} = rig();
  audio.setActive(true);
  audio.unlock();
  await warm();
  tick(0);
  const music = contexts[0].gains.find(bus => bus.gain.value === .26).gain;
  const stop = audio.shop('play');
  assert.equal(typeof stop,'function');
  assert.equal(music.events.at(-1)[1],.26 * .32);
  tick(.45);
  assert.equal(music.events.at(-1)[1],.26 * .32);
  tick(1);
  assert.equal(music.events.at(-1)[1],.26);
  audio.setCaptionDucking(true);
  audio.setSpeechDucking(true);
  tick(4);
  assert.equal(music.events.at(-1)[1],.26 * .32);
  audio.setSpeechDucking(false);
  assert.equal(music.events.at(-1)[1],.26 * .32);
  audio.setCaptionDucking(false);
  assert.equal(music.events.at(-1)[1],.26);
  audio.dispose();
});

test('phone caps the pool at six voices, cancels effects and disconnects every node on disposal', async () => {
  const {audio,contexts,tick,warm} = rig();
  audio.setPolicy(true,false,false);
  audio.setActive(true);
  audio.unlock();
  await warm();
  const ctx = contexts[0], [effect1,effect2] = ctx.oscillators;
  tick(0);
  audio.rail(true);
  const stop = audio.shop('ring');
  assert.equal(effect1.frequency.events.length,1);
  assert.equal(effect2.frequency.events.length,4);
  assert.equal(typeof audio.shop('plate'),'function', 'station and shop cues can reclaim the rail voice');
  assert.equal(audio.shop('listen'),undefined,'third concurrent foreground voice is refused');
  stop();
  assert.equal([...effect2.links][0].gain.events.at(-1)[1],0);
  for (let time = .075; time < 9; time += .075) {
    tick(time);
    audio.walk(.9);
    audio.play('door');
    audio.rail(true);
    audio.rail(false);
  }
  assert.equal(ctx.oscillators.length,6);
  assert.equal(ctx.gains.length,10);
  assert(ctx.oscillators.every(oscillator => oscillator.started === 1));
  audio.dispose();
  audio.dispose();
  await Promise.resolve();
  assert(ctx.oscillators.every(oscillator => oscillator.stopped === 1 && !oscillator.links.size));
  assert(ctx.gains.every(gain => !gain.links.size));
  assert.equal(ctx.transitions.filter(value => value === 'close').length,1);
});

test('every documented sound-producing shop action resolves to a mapped synthesis patch', async () => {
  const doc = JSON.parse(readFileSync(new URL('../docs/gjh-v11-interior-program.json',import.meta.url)));
  const seen = new Set();
  const {audio,contexts,tick,warm} = rig();
  audio.setActive(true);
  audio.unlock();
  await warm();
  for (const store of doc.stores) {
    for (const item of store.items) {
      const {shopAction} = createShopInteractionTarget(store.id,store,item);
      if (item.a11y.action) assert(shopAction.effect,item.id);
      if (!shopAction.effect) continue;
      assert(Object.hasOwn(SHOP_SOUNDS,shopAction.effect),item.id);
      seen.add(shopAction.effect);
    }
  }
  assert.equal(doc.stores.length,17);
  assert.deepEqual([...seen].sort(),Object.keys(SHOP_SOUNDS).sort());
  for (const [index,effect] of [...seen].entries()) {
    tick(index * 2);
    assert.equal(typeof audio.shop(effect),effect === 'mute' ? 'undefined' : 'function',effect);
  }
  assert(contexts[0].oscillators.some(voice => voice.frequency.events.length));
  audio.dispose();
});

test('optional narration selects the page language and cancels on caption change, pause, mute or hiding', () => {
  const {audio} = rig();
  audio.setActive(true);
  audio.unlock();
  const utterances = [], cancels = [];
  const voice = {lang:'en-SG'};
  let speechAccesses = 0, lookups = 0;
  const speech = {
    speak:utterance => utterances.push(utterance), cancel:() => cancels.push(true),
    getVoices() { lookups++; return [voice]; }
  };
  class Utterance { constructor(text) { this.text = text; } }
  const narration = createTramNarration(audio,() => { speechAccesses++; return speech; },Utterance);
  narration.read('one','Caption','en');
  assert.equal(utterances.length,0);
  assert.equal(speechAccesses,0);
  assert.equal(lookups,0);
  narration.selectSystemVoice();
  audio.setVoice(true);
  narration.read('one','Caption','en');
  narration.read('one','Caption','en');
  assert.equal(utterances.length,1);
  assert.equal(utterances[0].lang,'en-SG');
  assert.equal(utterances[0].voice,voice);
  assert.equal(lookups,1);
  narration.read('two','内容','zh-Hans');
  assert.equal(cancels.length,1);
  assert.equal(utterances.at(-1).lang,'zh-Hans');
  narration.stop(); // Pause, Skip and End share this command path.
  assert.equal(cancels.length,2);
  narration.read('three','Keterangan','ms');
  assert.equal(utterances.at(-1).lang,'ms');
  audio.setMuted(true);
  assert.equal(cancels.length,3);
  narration.read('three','Keterangan','ms');
  assert.equal(utterances.length,3);
  audio.setMuted(false);
  narration.read('three','Keterangan','ms');
  audio.setHidden(true);
  assert.equal(cancels.length,4);
  audio.dispose();
  for (const caption of tramCaptions) {
    assert.equal(tramCaptionCopy(caption,'en').feature,caption.feature);
    assert.match(tramCaptionCopy(caption,'zh-Hans').feature,/\p{Script=Han}/u);
    assert.notEqual(tramCaptionCopy(caption,'ms').feature,caption.feature);
  }
});

test('no-browser smoke supports absent media APIs and denied storage', () => {
  const storage = {
    getItem() { throw Error('blocked'); },
    setItem() { throw Error('blocked'); }
  };
  const audio = createAudioManager({storage});
  assert.equal(createTramNarration(audio).available,false);
  audio.setActive(true);
  audio.unlock();
  audio.setVolume('music',0);
  audio.play('floor-chime');
  audio.rail(true);
  audio.walk(5);
  audio.shop('pour');
  audio.setHidden(true);
  assert.equal(audio.state.available,false);
  assert.equal(audio.state.musicPlaying,false);
  audio.dispose();
});
