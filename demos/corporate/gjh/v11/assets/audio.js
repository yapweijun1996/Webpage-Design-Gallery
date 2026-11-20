import {MOVEMENT_KEYS} from './movement.js';

// One procedural mixer shared by the mall's entry, player and lazy shop modules.
export const AUDIO_KEY = 'gjh-v11-audio-v1';
export const LOOKAHEAD = .18;
const INIT_BUDGET_MS = 1.5;
const MUSIC_DELAY_MS = 1500;
const DEFAULT_LEVELS = {music:.26, effects:.65, ambience:.30};
const SHOP_SOUNDS = Object.freeze({
  tea:'pour', drink:'pour', water:'pour', plate:'plate', bell:'bell', drawer:'drawer',
  leaf:'paper', open:'drawer', spin:'swish', sample:'pickup', lid:'lid', spread:'swish',
  press:'tick', scan:'scan', pearl:'plate', unbox:'paper', meter:'scan', pair:'pair',
  listen:'listen', try:'tick', play:'play', torch:'tick', ring:'ring', mute:null
});
export {SHOP_SOUNDS};

// Timbre, MIDI notes, duration, peak, and relative end pitch.
const SOUNDS = {
  pour:['brush',[63],.47,.047,.74], plate:['mallet',[81,88],.29,.075],
  bell:['mallet',[84,91],.46,.085], drawer:['brush',[46],.22,.07,.52],
  paper:['brush',[76],.14,.039,.66], swish:['brush',[55],.28,.052,1.56],
  lid:['triangle',[51,58],.16,.064], tick:['sine',[78],.068,.057],
  scan:['sine',[82,87],.20,.073], pair:['sine',[69,76],.27,.076],
  listen:['triangle',[48,55,62],.58,.092], play:['piano',[60,64,67],.68,.11],
  ring:['mallet',[76,83,76,83],.64,.083],
  pickup:['sine',[74,79],.12,.072], bag:['mallet',[76,81],.15,.083],
  drop:['triangle',[67,55],.15,.067], step:['brush',[36],.09,.04,.6],
  door:['brush',[51],.32,.057,.65], 'lift-ding':['mallet',[79],.24,.064],
  'floor-chime':['mallet',[79,84],.52,.095], 'tram-departure':['mallet',[72,79],.53,.093],
  'tram-station':['mallet',[79,76,72],.60,.093]
};
const HARMONICS = {
  piano:[0,1,.18,.20,.03,.085],
  mallet:[0,1,0,0,.27,0,0,.045],
  brush:[0,0,.14,-.26,0,.31,-.18,.21,-.17,.29,.12,-.28,.16,0,.21,-.12,.09]
};
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const noop = () => {};
const browserContext = () => {
  const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return Audio ? new Audio({latencyHint:'interactive'}) : null;
};

function nextIdleFrame(callback) {
  if (!globalThis.requestAnimationFrame) return setTimeout(() => callback(), 16);
  // A new frame separates slices even if the browser has more idle time now.
  requestAnimationFrame(() => {
    if (globalThis.requestIdleCallback) requestIdleCallback(callback);
    else setTimeout(() => callback(), 0);
  });
}

function pianoSeed() {
  const key = 'gjh-v11-piano-seed';
  let visitor = Math.random().toString(36).slice(2);
  try {
    const session = globalThis.sessionStorage;
    visitor = session?.getItem(key) || visitor;
    session?.setItem(key, visitor);
  } catch { /* Keep the in-memory seed. */ }
  return `${new Date().toISOString().slice(0,10)}/${visitor}`;
}

export function createAudioManager({
  createContext = browserContext, storage, now = () => performance.now(),
  idle = nextIdleFrame, fetchSample, seed, later = (callback, ms) => setTimeout(callback, ms),
  cancelLater = id => clearTimeout(id),
  every = (callback, ms) => setInterval(callback, ms), stopEvery = id => clearInterval(id)
} = {}) {
  let saved;
  try { saved = JSON.parse(storage?.getItem(AUDIO_KEY) ?? 'null'); } catch { /* Session only. */ }
  const levels = {...DEFAULT_LEVELS};
  for (const bus of Object.keys(levels)) {
    const level = saved?.levels?.[bus];
    if (Number.isFinite(level) && level >= 0 && level <= 1) levels[bus] = level;
  }
  let muted = saved?.muted === true, demoMuted = saved?.demoMuted === true;
  let musicChoice = typeof saved?.music === 'boolean' ? saved.music : null;
  let voiceChoice = saved?.voice === true, narrationStop = noop;
  let active = false, hidden = false, activated = false, disposed = false, unavailable = false;
  let phone = false, low = false;
  let pendingCreation = false, effectRequested = false, awaitingControls = false;
  let context, master, timer, wanted, transitionId = 0, serial = 0;
  const buses = {}, coefficients = {}, waves = {}, voices = [];
  const timbres = Object.keys(HARMONICS);
  let prepared = 0, waveIndex = 0, pendingIdle = false, musicDelay, unlockedAt;
  let readyForMusic = false, audioInitMs = null, audioInitSliceMaxMs = 0;
  let audioCreateMs = null, audioCreateDuring = null, audioCreateFrame = null;
  const effectLimit = () => phone ? 6 : 8;
  const listeners = new Set();
  let zone = 'atrium', theme = 'everyday', tram = false;
  let pianoModules, composer, samplerModule, sampler;
  let scoreBar, barNumber = 0, phrase, phraseIndex, phrasePiece, phraseBar, playingPiece;
  const pieces = new Map();
  let stride = 0, railVoice, duckUntil = 0, captionDucking = false, speechDucking = false, musicDucked = false;
  const musicEnabled = () => musicChoice === true;
  const audible = () => active && activated && !muted && !hidden && !disposed;
  const canResume = () => audible() && !awaitingControls;
  const deferCreation = () => phone && low;
  const canCreate = () => !context && !muted && !hidden && !disposed && !unavailable;
  const waitingForLowSound = () => active && deferCreation() && (awaitingControls || canCreate());
  const wantsSound = () => effectRequested || (musicEnabled() && levels.music > 0);
  const running = () => audible() && !unavailable && wanted === true && context?.state === 'running';
  const wantsMusic = () => running() && musicEnabled() && levels.music > 0;
  const musicPlaying = () => timer !== undefined;

  function publish() {
    for (const listener of listeners) listener();
  }
  function save() {
    try {
      storage?.setItem(AUDIO_KEY, JSON.stringify({muted,demoMuted,music:musicChoice,voice:voiceChoice,levels}));
    } catch { /* Session only. */ }
  }
  function gain(bus, level) {
    const now = context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(level, now, .025);
  }
  function applyDuck(now) {
    const ducked = captionDucking || speechDucking || now < duckUntil;
    if (ducked === musicDucked) return;
    musicDucked = ducked;
    gain(buses.music, levels.music * (ducked ? .32 : 1));
  }
  function silence(voice) {
    if (!context) return;
    const now = context.currentTime;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(0, now);
    voice.until = now;
    voice.token = 0;
    if (railVoice === voice) railVoice = null;
  }
  function voiceAt(index) {
    if (voices[index]) return voices[index];
    const oscillator = context.createOscillator(), envelope = context.createGain();
    envelope.gain.value = 0;
    oscillator.connect(envelope);
    oscillator.start();
    return voices[index] = {oscillator,envelope,until:0,token:0};
  }
  function note(bus, timbre, start, duration, peak, pitch, endPitch, token = 0, notes = null, slot = null) {
    const first = slot ?? 4;
    const limit = slot === null ? effectLimit() : slot + 1;
    let index = first;
    while (index < limit && voices[index]?.until > (slot === null ? context.currentTime : start)) index++;
    if (index === limit && slot === null && timbre !== 'rail' && duration > .10) {
      // Keep footsteps and rail hum from swallowing a shop or station cue.
      for (let candidate = first; candidate < limit; candidate++) {
        if (voices[candidate].quiet) { index = candidate; silence(voices[index]); break; }
      }
    }
    if (index === limit) return;
    const voice = voiceAt(index);
    const {oscillator, envelope} = voice;
    if (voice.bus !== bus) {
      if (voice.bus) envelope.disconnect();
      envelope.connect(buses[bus]);
      voice.bus = bus;
    }
    if (voice.timbre !== timbre) {
      if (Object.hasOwn(HARMONICS, timbre)) {
        oscillator.setPeriodicWave(waves[timbre]);
      } else oscillator.type = timbre === 'rail' ? 'sine' : timbre;
      voice.timbre = timbre;
    }
    const {frequency} = oscillator;
    frequency.cancelScheduledValues(start);
    if (timbre === 'rail') {
      frequency.setValueAtTime(hz(pitch), start);
      envelope.gain.setTargetAtTime(peak, start, .12);
    } else {
      const count = notes?.length ?? 1, length = duration / count;
      for (let i = 0; i < count; i++) {
        const at = start + i * length;
        frequency.setValueAtTime(hz(notes?.[i] ?? pitch), at);
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(peak * (1 - .12 * i), at + (timbre === 'brush' ? .018 : .008));
        envelope.gain.exponentialRampToValueAtTime(.001, at + length - .014);
        envelope.gain.linearRampToValueAtTime(0, at + length);
      }
      if (endPitch) frequency.exponentialRampToValueAtTime(hz(pitch) * endPitch, start + duration);
    }
    voice.quiet = timbre === 'rail' || duration === SOUNDS.step[2];
    voice.until = start + duration;
    voice.token = token;
    return voice;
  }
  function currentPiece() {
    const place = tram ? 'tram' : zone === 'newmoon' || zone === 'upper' ? zone :
      theme === 'christmas' ? theme : 'courtyard';
    if (!composer) return;
    if (!pieces.has(place)) pieces.set(place, composer.createPianoPiece(seed ??= pianoSeed(), place));
    return pieces.get(place);
  }
  function beginBar(start) {
    const piece = currentPiece();
    const {BARS_PER_PHRASE, composePianoBars} = composer;
    const index = Math.floor(barNumber / BARS_PER_PHRASE);
    if (phrasePiece !== piece || phraseIndex !== index) {
      phrase = composePianoBars(piece, index);
      phrasePiece = piece;
      phraseIndex = index;
      phraseBar = 0;
    }
    const offset = barNumber++ % BARS_PER_PHRASE;
    let bar;
    // Preserve the phrase position when the visitor changes zones mid-phrase.
    do { bar = phrase.next().value; } while (phraseBar++ < offset);
    const beatSeconds = 60 / piece.bpm;
    const end = start + bar.beats * beatSeconds;
    const events = [...bar.bass, ...bar.melody].filter(event => event.note !== null)
      .sort((left,right) => left.beat - right.beat);
    return {start,end,beatSeconds,events,index:0,sampled:sampler?.ready,piece};
  }
  function scheduleNote(event, start, bar) {
    const sustain = event.beats * bar.beatSeconds + .16;
    const duration = Math.min(sustain, bar.end - start);
    if (bar.sampled) {
      const {PIANO_RELEASE, PIANO_VOICES} = samplerModule;
      sampler.play(buses.music, event.note, start, duration - PIANO_RELEASE, event.velocity,
        phone ? PIANO_VOICES.phone : PIANO_VOICES.desktop);
      return;
    }
    const slot = voices.findIndex((voice,index) => index < 4 && voice.until <= start);
    if (slot >= 0) note('music','piano',start,duration,event.velocity * .26,event.note,0,0,null,slot);
  }
  function schedule() {
    if (!musicPlaying() || !wantsMusic()) return;
    const now = context.currentTime, horizon = now + LOOKAHEAD;
    applyDuck(now);
    if (scoreBar?.end < now) scoreBar = null;
    scoreBar ??= beginBar(now + .026);
    for (;;) {
      if (scoreBar.start <= now && playingPiece !== scoreBar.piece) {
        playingPiece = scoreBar.piece;
        publish();
      }
      const event = scoreBar.events[scoreBar.index];
      if (event) {
        const start = scoreBar.start + event.beat * scoreBar.beatSeconds;
        if (start > horizon) break;
        if (start >= now) scheduleNote(event, start, scoreBar);
        scoreBar.index++;
      } else {
        if (scoreBar.end > horizon) break;
        scoreBar = beginBar(scoreBar.end);
      }
    }
    // Give the opening bar to the oscillator before requesting any MP3s.
    sampler ??= samplerModule?.createPianoSampler(context, {idle, fetchSample});
    void sampler?.load();
  }
  function syncClock() {
    if (timer !== undefined && !wantsMusic()) {
      stopEvery(timer);
      timer = undefined;
      buses.music.disconnect();
      scoreBar = playingPiece = null;
      sampler?.stop();
      for (const voice of voices) if (voice?.bus === 'music') silence(voice);
    }
    if (!musicEnabled()) sampler?.cancelLoad();
  }
  function createBus(bus) {
    const output = context.createGain();
    output.gain.value = levels[bus];
    if (bus !== 'music') output.connect(master);
    buses[bus] = output;
  }
  function warmupTask() {
    if (!active || hidden || disposed || unavailable) return;
    if (prepared < timbres.length) return () => {
      const timbre = timbres[prepared++];
      const harmonics = HARMONICS[timbre];
      coefficients[timbre] = [new Float32Array(harmonics.length), Float32Array.from(harmonics)];
    };
    if (!running()) return;
    if (!master) return () => {
      master = context.createGain();
      master.gain.value = .75;
      master.connect(context.destination);
    };
    if (!buses.effects) return () => createBus('effects');
    if (!buses.ambience) return () => createBus('ambience');
    if (waveIndex < timbres.length) return () => {
      const timbre = timbres[waveIndex++];
      waves[timbre] = context.createPeriodicWave(...coefficients[timbre]);
      delete coefficients[timbre];
    };
    for (let slot = 4; slot < effectLimit(); slot++) {
      if (!voices[slot]) return () => voiceAt(slot);
    }
    if (!readyForMusic || !wantsMusic() || musicPlaying()) return;
    if (!pianoModules) return () => { void prefetchMusic(); };
    if (!composer) return;
    if (!buses.music) return () => createBus('music');
    for (let slot = 0; slot < 4; slot++) {
      if (!voices[slot]) return () => voiceAt(slot);
    }
    return () => {
      applyDuck(context.currentTime);
      buses.music.connect(master);
      timer = every(schedule, 75);
    };
  }
  function queueWarmup() {
    if (pendingIdle || !warmupTask()) return;
    pendingIdle = true;
    idle(deadline => {
      pendingIdle = false;
      const work = warmupTask();
      if (!work) return;
      if (!deadline || deadline.timeRemaining() >= INIT_BUDGET_MS) {
        // Web Audio calls are atomic. Issue at most one setup task per frame.
        const start = now();
        const wasPlaying = musicPlaying();
        try { work(); } catch { markUnavailable(); }
        if (musicPlaying() !== wasPlaying) publish();
        audioInitSliceMaxMs = Math.max(audioInitSliceMaxMs, now() - start);
      }
      queueWarmup();
    });
  }
  function audioStateChanged() {
    if (disposed) return;
    syncClock();
    if (wantsMusic() && !readyForMusic && musicDelay === undefined) {
      const remaining = MUSIC_DELAY_MS - (now() - unlockedAt);
      musicDelay = later(() => {
        readyForMusic = true;
        queueWarmup();
      }, Math.max(0, remaining));
    }
    queueWarmup();
    publish();
  }
  function prefetchMusic() {
    pianoModules ??= new Promise(resolve => {
      idle(() => {
        if (disposed) { resolve(); return; }
        const score = import('./piano-composer.js').then(module => {
          if (disposed) return;
          composer = module;
          queueWarmup();
          if (musicEnabled()) publish();
        }, noop);
        const samples = import('./piano-sampler.js').then(module => { samplerModule = module; }, noop);
        resolve(Promise.all([score, samples]));
      });
    });
    return pianoModules;
  }
  function setContextRunning(play) {
    wanted = play;
    const id = ++transitionId;
    const firstResume = play && unlockedAt === undefined;
    if (firstResume) unlockedAt = now();
    const transition = play ? context.resume() : context.suspend();
    if (firstResume) audioInitMs = audioCreateMs + (now() - unlockedAt);
    void transition.then(() => {
      if (id === transitionId) audioStateChanged();
    }, () => {
      if (id === transitionId && !disposed) {
        wanted = undefined;
        audioStateChanged();
      }
    });
  }
  function sync() {
    if (!audible()) {
      narrationStop();
      stride = duckUntil = 0;
    }
    if (context) {
      const play = canResume();
      if (wanted !== play || (play && context.state === 'interrupted')) {
        if (master) master.gain.value = play ? .75 : 0;
        if (!play) for (const voice of voices) if (voice) silence(voice);
        setContextRunning(play);
      }
    }
    audioStateChanged();
  }
  function closeContext() {
    if (!context) return;
    sampler?.cancelLoad();
    context.onstatechange = null;
    railVoice = null;
    for (const voice of voices) if (voice) {
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.envelope.disconnect();
    }
    Object.values(buses).forEach(bus => bus.disconnect());
    master?.disconnect();
    void context.close().catch(noop);
    context = null;
  }
  function markUnavailable() {
    unavailable = true;
    syncClock();
    closeContext();
    queueMicrotask(audioStateChanged);
  }
  function prepareContext(during, frame) {
    const start = now();
    audioCreateDuring = during;
    audioCreateFrame = frame;
    try {
      context = createContext();
    } catch {
      markUnavailable();
    } finally {
      audioInitMs = audioCreateMs = now() - start;
    }
    if (!context) {
      if (!unavailable) markUnavailable();
      return;
    }
    context.onstatechange = audioStateChanged;
    if (during === 'gesture') return;
    try {
      // A user-activated constructor may start the context automatically.
      setContextRunning(false);
    } catch {
      markUnavailable();
    }
  }
  function prepareForLoader(frame = 0) {
    if (canCreate() && (!deferCreation() || wantsSound())) prepareContext('loader', frame);
  }
  function primeLowContext(frame) {
    if (!deferCreation() || !canCreate()) return;
    prepareContext('loader', frame);
    awaitingControls = Boolean(context) && !wantsSound();
  }
  function scheduleCreation(isStationary, getFrame) {
    if (pendingCreation || !active || !canCreate() || deferCreation()) return;
    pendingCreation = true;
    idle(deadline => {
      pendingCreation = false;
      if (!active || !canCreate() || deferCreation()) return;
      if (!isStationary() || (deadline && deadline.timeRemaining() < INIT_BUDGET_MS)) {
        scheduleCreation(isStationary, getFrame);
        return;
      }
      prepareContext('idle', getFrame());
      if (activated) unlock({allowCreate:false});
    });
  }
  function unlock({allowCreate = true, frame = 0} = {}) {
    if (disposed || unavailable || (activated && wanted === true && context?.state === 'running')) return;
    activated = true;
    if (!canResume()) return;
    if (allowCreate && !deferCreation() && canCreate()) prepareContext('gesture', frame);
    if (!context) return;
    try {
      // Call resume inside the user gesture for browser autoplay policy.
      setContextRunning(true);
    } catch {
      markUnavailable();
    }
  }
  function prepareForControls(frame, explicit = false) {
    if (active && (explicit || wantsSound())) {
      awaitingControls = false;
      if (canCreate()) prepareContext('gesture', frame);
    }
    unlock({allowCreate:false});
  }
  function sceneGesture(event, isStationary, frame) {
    if (!event.isTrusted || event.repeat || (event.type === 'keydown' &&
        (event.ctrlKey || event.metaKey || event.altKey))) return;
    const canCreateOnGesture = event.type === 'click' ||
      (event.type === 'keydown' && !MOVEMENT_KEYS.includes(event.code));
    unlock({allowCreate:canCreateOnGesture && isStationary(), frame});
  }
  function requestEffect() {
    if (waitingForLowSound()) effectRequested = true;
  }
  function duck(seconds) {
    if (!running()) return;
    duckUntil = Math.max(duckUntil, context.currentTime + seconds);
    if (musicPlaying()) applyDuck(context.currentTime);
  }
  function play(sound, bus = 'effects', cancellable = false) {
    if (!levels[bus] || !Object.hasOwn(SOUNDS,sound)) return;
    requestEffect();
    if (!running() || !buses[bus]) return;
    const [timbre, notes, duration, peak, slide] = SOUNDS[sound];
    if (Object.hasOwn(HARMONICS, timbre) && !waves[timbre]) return;
    const token = cancellable ? ++serial : 0;
    const voice = note(bus,timbre,context.currentTime + .009,duration,peak,notes[0],slide,token,
      notes.length > 1 ? notes : null);
    if (voice && cancellable) return () => {
      for (const voice of voices) if (voice?.token === token) silence(voice);
    };
  }
  function shop(effect) {
    const sound = SHOP_SOUNDS[effect];
    if (demoMuted || !sound) return;
    const stop = play(sound, 'effects', true);
    if (stop) duck(SOUNDS[sound][2] + .18);
    return stop;
  }
  function setVolume(bus, value) {
    if (!Object.hasOwn(levels,bus) || !Number.isFinite(value)) return;
    levels[bus] = Math.min(1,Math.max(0,value));
    if (context && buses[bus]) gain(buses[bus], levels[bus] * (bus === 'music' && musicDucked ? .32 : 1));
    save(); audioStateChanged();
  }
  return {
    performanceReport() { return {audioInitMs, audioInitSliceMaxMs, audioCreateMs, audioCreateDuring, audioCreateFrame}; },
    get demoMuted() { return demoMuted; },
    get canNarrate() { return audible() && voiceChoice; },
    get state() { return {muted,demoMuted,musicEnabled:musicEnabled(),musicPlaying:musicPlaying(),
      musicTitle:musicEnabled() ? (playingPiece ?? currentPiece())?.title ?? '' : '',
      voice:voiceChoice,levels:{...levels},available:!unavailable}; },
    subscribe(listener) { listeners.add(listener); listener(); return () => listeners.delete(listener); },
    prefetchMusic, prepareForLoader, primeLowContext, scheduleCreation, prepareForControls, sceneGesture, unlock, play, shop, duck, setVolume,
    setMuted(value) { muted = value; save(); sync(); },
    setMusic(value) { musicChoice = value; save(); sync(); },
    setDemoMuted(value) {
      demoMuted = value;
      if (value && context) for (const voice of voices) if (voice?.token) silence(voice);
      save();
    },
    setVoice(value) { voiceChoice = value; if (!value) narrationStop(); save(); publish(); },
    onNarrationStop(stop) { narrationStop = stop; },
    setCaptionDucking(value) {
      if (captionDucking === value) return;
      captionDucking = value;
      if (musicPlaying()) applyDuck(context.currentTime);
    },
    setSpeechDucking(value) { speechDucking = value; if (musicPlaying()) applyDuck(context.currentTime); },
    setActive(value) {
      if (active === value) return;
      active = value;
      if (!value) captionDucking = false;
      sync();
    },
    setHidden(value) { if (hidden !== value) { hidden = value; sync(); } },
    setPolicy(isPhone, isLow) {
      if (phone === isPhone && low === isLow) return;
      if (isPhone && context) for (let i = 6; i < voices.length; i++) if (voices[i]) silence(voices[i]);
      phone = isPhone; low = isLow;
      if (!deferCreation()) awaitingControls = false;
      sync();
    },
    setZone(value) { if (zone !== value) { zone = value; if (!playingPiece && musicEnabled()) publish(); } },
    setTheme(value) { if (theme !== value) { theme = value; if (!playingPiece && musicEnabled()) publish(); } },
    setTram(value) { if (tram !== value) { tram = value; if (!playingPiece && musicEnabled()) publish(); } },
    walk(distance) {
      if (!distance || !levels.effects || (!running() && !waitingForLowSound())) return;
      stride += distance;
      if (stride >= .79) { stride %= .79; play('step'); }
    },
    rail(moving) {
      if (moving && levels.ambience) requestEffect();
      if (moving && !railVoice && running() && buses.ambience && levels.ambience) {
        railVoice = note('ambience','rail',context.currentTime + .009,Infinity,.023,42);
      } else if (!moving && railVoice) {
        const now = context.currentTime;
        railVoice.envelope.gain.cancelScheduledValues(now);
        railVoice.envelope.gain.setTargetAtTime(0,now,.045);
        railVoice.until = now + .17;
        railVoice = null;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      syncClock();
      narrationStop();
      cancelLater(musicDelay);
      listeners.clear();
      closeContext();
    }
  };
}

let storage;
try { storage = globalThis.localStorage; } catch { /* Session only. */ }
export const mallAudio = createAudioManager({storage});

export function createTramNarration(audio, getSpeech, Utterance) {
  const available = Boolean(getSpeech && Utterance);
  let speech, current = null, spoken = '', voices = [];
  function selectSystemVoice() {
    try {
      speech ??= getSpeech();
      voices = speech?.getVoices?.() ?? [];
    } catch { /* Use the browser's default voice. */ }
  }
  function stop() {
    if (current) {
      current.onend = current.onerror = null;
      current = null;
      speech.cancel();
      audio.setSpeechDucking(false);
    }
    spoken = '';
  }
  audio.onNarrationStop(stop);
  return {
    available, stop, selectSystemVoice,
    read(key, text, language) {
      if (!available || !audio.canNarrate || key === spoken) return;
      stop();
      spoken = key;
      try {
        speech ??= getSpeech();
        if (!speech) return;
        const utterance = new Utterance(text);
        current = utterance;
        utterance.lang = language === 'zh-Hans' ? 'zh-Hans' : language === 'ms' ? 'ms' : 'en-SG';
        const locale = utterance.lang.toLowerCase();
        const family = locale.split('-')[0];
        utterance.voice = voices.find(voice => voice.lang.toLowerCase() === locale) ??
          voices.find(voice => voice.lang.toLowerCase().split('-')[0] === family) ?? null;
        utterance.volume = .75;
        utterance.rate = .93;
        utterance.onend = utterance.onerror = () => {
          if (current !== utterance) return;
          current = null;
          audio.setSpeechDucking(false);
        };
        audio.setSpeechDucking(true);
        speech.speak(utterance);
      } catch { stop(); }
    }
  };
}
