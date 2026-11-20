import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {AUDIO_KEY, createAudioManager, createTramNarration, LOOKAHEAD, SHOP_SOUNDS} from
  '../demos/corporate/gjh/v11/assets/audio.js';
import {composePianoPhrase, createPianoPiece} from '../demos/corporate/gjh/v11/assets/piano-composer.js';
import {createShopInteractionTarget} from '../demos/corporate/gjh/v11/assets/interiors/shop-interactions.js';
import {tramCaptions} from '../demos/corporate/gjh/v11/assets/tram-ride.js';
import {tramCaptionCopy} from '../demos/corporate/gjh/v11/assets/tram-caption-copy.js';
import {bindLoaderAudioGestures} from '../demos/corporate/gjh/v11/assets/loader.js';

class Param {
  events = [];
  setValueAtTime(value, time) { this.events.push(['set',value,time]); }
  setTargetAtTime(value, time) { this.events.push(['target',value,time]); }
  linearRampToValueAtTime(value, time) { this.events.push(['linear',value,time]); }
  exponentialRampToValueAtTime(value, time) { this.events.push(['exponential',value,time]); }
  cancelScheduledValues(time) { this.events = this.events.filter(event => event[2] < time); }
}

function rig(storage, constructorMs = .5, fetchSample) {
  const timers = new Set(), contexts = [], delays = new Map(), frames = [];
  const calls = {buffer:0, bufferSource:0, wave:0, oscillator:0, gain:0};
  let clock = 0, prefetched = false;
  const audio = createAudioManager({
    storage, fetchSample, seed: 'test visitor',
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
      clock += constructorMs;
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
        ...(fetchSample && {async decodeAudioData() { return {}; }}),
        createBufferSource() {
          calls.bufferSource++;
          return {...node('playbackRate')};
        },
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
    return runFrame(remaining);
  }
  function runFrame(remaining = 5) {
    const start = clock;
    for (const callback of frames.splice(0)) callback({timeRemaining: () => remaining});
    return clock - start;
  }
  function advance(ms) {
    clock += ms;
    for (const [callback, at] of delays) {
      if (at <= clock) { delays.delete(callback); callback(); }
    }
  }
  return {audio,timers,contexts,calls,frame,runFrame,advance,
    async warm(ms = 1500) {
      if (audio.state.musicEnabled && !prefetched) {
        const prefetch = audio.prefetchMusic();
        assert(runFrame() <= 1.5);
        await prefetch;
        prefetched = true;
      }
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
  audio.setMusic(true);
  audio.setActive(true);
  await warm(0);
  assert.equal(contexts.length,0,'coefficients can be prepared before the gesture');
  audio.unlock();
  assert.deepEqual(calls,{buffer:0,bufferSource:0,wave:0,oscillator:0,gain:0});
  assert.deepEqual(audio.performanceReport(),{audioInitMs:.75,audioInitSliceMaxMs:0,
    audioCreateMs:.5,audioCreateDuring:'gesture',audioCreateFrame:0});
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

test('arrival clicks and touches and Enter now construct only during entry', () => {
  function target() {
    const listeners = new Map();
    return {
      hidden:false,
      addEventListener: (type, listener) => listeners.set(type, listener),
      fire: (type, isTrusted = true) => listeners.get(type)({type,isTrusted})
    };
  }
  for (const [route, event] of [
    ['arrival','click'], ['root','touchstart'], ['root','pointerdown'], ['enterNow','click']
  ]) {
    const {audio,contexts} = rig(undefined, 400);
    const arrival = target(), enterNow = target(), root = target(), overlay = {hidden:true};
    let onArrivals = false;
    root.getElementById = id => { assert.equal(id,'arrival-walk'); return arrival; };
    root.body = {hasAttribute: name => name === 'data-arrivals' && onArrivals};
    bindLoaderAudioGestures(root, overlay, enterNow, audio);
    root.fire('pointerdown');
    enterNow.fire('click');
    arrival.fire('click', false);
    assert.equal(contexts.length,0);
    onArrivals = route !== 'enterNow';
    overlay.hidden = onArrivals;
    const trigger = {arrival,root,enterNow}[route];
    trigger.fire(event);
    trigger.fire(event);
    assert.equal(contexts.length,1,route);
    assert.equal(contexts[0].state,'suspended');
    assert.equal(audio.performanceReport().audioCreateDuring,'loader');
    audio.dispose();
  }
});

test('deep-link fallback waits for a stationary idle frame after a movement gesture', () => {
  const {audio,contexts,runFrame} = rig(undefined, 400);
  let stationary = true, frame = 10;
  const isStationary = () => stationary;
  const schedule = () => audio.scheduleCreation(isStationary, () => frame);
  schedule();
  runFrame();
  assert.equal(contexts.length,0,'loader still up');
  audio.setActive(true);
  schedule();
  schedule();
  audio.sceneGesture({isTrusted:true,type:'keydown',code:'KeyW'}, isStationary, frame);
  assert.equal(contexts.length,0,'the key arrives before movement is visible to the idle guard');
  stationary = false;
  runFrame();
  assert.equal(contexts.length,0,'movement started before the idle callback');
  stationary = true;
  runFrame(0);
  assert.equal(contexts.length,0,'idle callback has no time remaining');
  frame++;
  assert(runFrame() >= 400);
  assert.equal(contexts.length,1);
  assert.equal(audio.performanceReport().audioCreateMs,400);
  assert.equal(audio.performanceReport().audioCreateDuring,'idle');
  assert.equal(audio.performanceReport().audioCreateFrame,11);
  assert.equal(contexts[0].state,'running');
  audio.dispose();
});

test('Low phone scene key and pointer events leave context construction to the audio controls', async () => {
  const {audio,contexts,calls,warm,runFrame} = rig(undefined, 400);
  const isStationary = () => true;
  audio.setPolicy(true,true);
  audio.prepareForLoader();
  audio.setActive(true);
  audio.scheduleCreation(isStationary, () => 1);
  await warm(0);
  audio.prepareForControls(2);
  assert.equal(contexts.length,0,'Tools opened before any sound was wanted');
  for (const [type, code] of [['keydown','KeyW'], ['keydown','Enter'], ['pointerdown'], ['pointerup'], ['click']]) {
    audio.sceneGesture({type, code, isTrusted:true}, isStationary, 3);
    audio.walk(2);
    audio.play('door');
    assert.equal(audio.shop('listen'),undefined);
    runFrame();
    assert.equal(contexts.length,0,type);
    assert.equal(calls.oscillator,0,type);
  }
  assert.equal(audio.performanceReport().audioCreateMs,null);
  audio.prepareForControls(4);
  assert.equal(contexts.length,1,'opening Tools consumes the deferred sound request');
  assert.equal(audio.performanceReport().audioCreateMs,400);
  assert.equal(audio.performanceReport().audioCreateDuring,'gesture');
  assert.equal(audio.performanceReport().audioCreateFrame,4);
  audio.dispose();
});

test('Low phone can explicitly enable music before any effect is requested', () => {
  const {audio,contexts} = rig(undefined, 400);
  audio.setPolicy(true,true);
  audio.prepareForLoader();
  audio.setActive(true);
  assert.equal(contexts.length,0);
  audio.setMusic(true);
  assert.equal(contexts.length,0);
  audio.prepareForControls(3, true);
  assert.equal(contexts.length,1);
  assert.equal(contexts[0].state,'running');
  assert.equal(audio.performanceReport().audioCreateDuring,'gesture');
  audio.dispose();
});

test('Low phone prepares a suspended context behind the loader without requesting piano samples', async () => {
  let requests = 0;
  const {audio,contexts,warm,tick,runFrame} = rig(undefined, 400, () => {
    requests++;
    return {ok:false};
  });
  audio.setPolicy(true,true);
  audio.primeLowContext(2);
  assert.equal(contexts.length,1);
  assert.equal(contexts[0].state,'suspended');
  assert.equal(audio.performanceReport().audioCreateDuring,'loader');
  audio.setActive(true);
  const prefetch = audio.prefetchMusic();
  runFrame();
  await prefetch;
  await warm(0);
  assert.equal(audio.state.musicEnabled,false);
  audio.sceneGesture({isTrusted:true,type:'click'}, () => true, 3);
  audio.prepareForControls(3);
  assert.equal(contexts[0].state,'suspended','opening Tools alone keeps audio suspended');
  audio.setMusic(true);
  audio.prepareForControls(4,true);
  assert.equal(contexts.length,1);
  assert.equal(contexts[0].state,'running');
  await warm();
  assert.equal(requests,0,'music prepares the oscillator graph first');
  tick(0);
  assert.equal(requests,12);
  audio.dispose();
});

test('a Low phone can lazily play an effect before its pool is prewarmed', async () => {
  const {audio,frame,calls,warm,timers} = rig();
  audio.setPolicy(true,true);
  audio.setActive(true);
  await warm(0);
  audio.prepareForControls(1, true);
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

test('loader creates one suspended context and the first scene gesture resumes it', async () => {
  const storage = memoryStorage(), {audio,timers,contexts,tick,warm} = rig(storage, 400);
  audio.play('bag');
  assert.equal(contexts.length,0);
  audio.prepareForLoader();
  audio.prepareForLoader();
  const [ctx] = contexts;
  assert.equal(contexts.length,1);
  assert.deepEqual(ctx.transitions,['suspend']);
  assert.equal(audio.performanceReport().audioCreateMs,400);
  assert.equal(audio.performanceReport().audioCreateDuring,'loader');
  assert.equal(audio.performanceReport().audioCreateFrame,0);
  assert.equal(timers.size,0);
  assert.equal(audio.state.musicPlaying,false);
  audio.setMusic(true);
  audio.setActive(true);
  assert.equal(ctx.state,'suspended');
  audio.sceneGesture({isTrusted:true,type:'keydown',code:'KeyW'}, () => false, 5);
  assert.equal(ctx.state,'running');
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
  assert.equal(original.state.levels.master,.75);
  original.setVolume('master',.55);
  original.setVolume('ambience',.13);
  original.setVolume('effects',0);
  original.setVolume('music',.37);
  const {audio,contexts,timers,warm} = rig(storage);
  assert.deepEqual(JSON.parse(storage.getItem(AUDIO_KEY)), {
    muted:true, demoMuted:true, music:true, voice:true, levels:{master:.55,music:.37,effects:0,ambience:.13}
  });
  audio.setPolicy(true,true);
  audio.setActive(true);
  audio.unlock();
  assert.equal(contexts.length,0);
  assert.equal(timers.size,0);
  assert.equal(audio.state.demoMuted,true);
  assert.equal(audio.state.voice,true);
  assert.equal(audio.state.levels.master,.55);
  audio.setMuted(false);
  audio.prepareForControls(1, true);
  await warm();
  assert.equal(audio.state.musicPlaying,true);
  const master = contexts[0].gains.find(node => node.links.has(contexts[0].destination));
  assert.equal(master.gain.value,.55);
  audio.setVolume('master',.23);
  assert.deepEqual(master.gain.events.at(-1).slice(0,2), ['target',.23]);
  assert.equal(audio.shop('listen'),undefined);
  audio.dispose();
});

test('all device policies start with Music off and load samples only after opt-in', async () => {
  for (const policy of [[true,true],[true,false],[false,false]]) {
    const requests = [];
    const {audio,timers,contexts,tick,warm,calls} = rig(undefined,.5, async url => {
      requests.push(url);
      return {ok:false};
    });
    audio.setPolicy(...policy);
    audio.setActive(true);
    audio.prepareForControls(1, true);
    await warm();
    const ctx = contexts[0];
    assert.equal(audio.state.musicEnabled,false);
    assert.equal(timers.size,0);
    assert.equal(ctx.gains.length,policy[0] ? 5 : 7);
    assert.equal(requests.length,0);
    audio.setMusic(true);
    await warm();
    const musicBus = ctx.gains.find(bus => bus.gain.value === .26);
    tick(.075);
    assert.equal(requests.length,12);
    assert.equal(timers.size,1);
    assert.equal(musicBus.links.size,1);
    assert.equal(calls.bufferSource,0);
    assert(ctx.oscillators.some(voice => voice.frequency.events.length),'fallback plays after fetch failure');
    audio.setMusic(false);
    assert.equal(timers.size,0);
    assert.equal(musicBus.links.size,0);
    audio.dispose();
  }
});

test('lookahead keeps the beat grid across generated phrases without looping the score', async () => {
  const {audio,contexts,tick,warm} = rig();
  audio.setPolicy(true,false);
  audio.setMusic(true);
  audio.setActive(true);
  audio.unlock();
  await warm();
  const musicVoices = contexts[0].oscillators.slice(2);
  const piece = createPianoPiece('test visitor','courtyard');
  const seconds = 60 / piece.bpm;
  const phrases = [composePianoPhrase(piece,0),composePianoPhrase(piece,1)].flat();
  const planned = new Set(phrases.flatMap((bar,index) => [...bar.bass,...bar.melody]
    .filter(event => event.note !== null)
    .map(event => Math.round((.026 + (index * 4 + event.beat) * seconds) * 1e6))));
  const seen = new Set();
  let time = 0;
  for (; time < 56 * seconds; time += .075) {
    tick(time);
    for (const oscillator of musicVoices) {
      for (const [kind,,at] of oscillator.frequency.events) {
        if (kind !== 'set') continue;
        const rounded = Math.round(at * 1e6);
        assert(at <= time + LOOKAHEAD + 1e-8, at);
        assert(planned.has(rounded), at);
        seen.add(rounded);
      }
    }
  }
  assert(seen.has(Math.round((.026 + 32 * seconds) * 1e6)), 'phrase boundary stays on the audio clock');
  const cutoff = Math.round((time - .075 + LOOKAHEAD) * 1e6);
  assert.deepEqual(seen,new Set([...planned].filter(at => at <= cutoff)));
  audio.dispose();
});

test('the sampler takes over at the next bar after all samples decode', async () => {
  let respond;
  const response = new Promise(resolve => { respond = resolve; });
  const {audio,tick,warm,runFrame,calls} = rig(undefined,.5, () => response);
  audio.setActive(true);
  audio.setMusic(true);
  audio.unlock();
  await warm();
  tick(0);
  assert.equal(calls.bufferSource,0,'undecoded score uses oscillators');
  respond({ok:true,arrayBuffer:async () => new ArrayBuffer(1)});
  const flush = () => new Promise(resolve => setImmediate(resolve));
  for (let i = 0; i < 12; i++) {
    await flush();
    runFrame();
  }
  await flush();
  const boundary = .026 + 4 * 60 / createPianoPiece('test visitor','courtyard').bpm;
  for (let time = .075; time < boundary - LOOKAHEAD; time += .075) tick(time);
  assert.equal(calls.bufferSource,0,'readiness does not alter a bar already scheduled');
  tick(boundary - LOOKAHEAD / 2);
  assert(calls.bufferSource > 0, 'the next downbeat uses samples');
  audio.dispose();
});

test('shop effects and narration duck the same music bus, then restore its volume', async () => {
  const {audio,contexts,tick,warm} = rig();
  audio.setMusic(true);
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
  audio.setPolicy(true,false);
  audio.setMusic(true);
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
  audio.setPolicy(true,true);
  audio.prepareForLoader();
  audio.setActive(true);
  audio.sceneGesture({isTrusted:true,type:'keydown',code:'KeyW'}, () => false, 1);
  assert.equal(audio.performanceReport().audioCreateMs,null);
  audio.prepareForControls(2, true);
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
