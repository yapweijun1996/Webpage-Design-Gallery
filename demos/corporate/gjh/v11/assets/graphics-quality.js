export const QUALITY_KEY = 'gjh-v11-graphics-quality-v1';
export const RESOLUTION_KEY = 'gjh-v11-auto-resolution-v1';
export const MALL_FRAME_BUDGETS = Object.freeze({
  low:Object.freeze({triangles:220000, calls:70}),
  balanced:Object.freeze({triangles:300000, calls:90}),
  detailed:Object.freeze({triangles:420000, calls:110})
});
const TIERS = ['low', 'balanced', 'detailed'];
const REFRESH_SAMPLE_COUNT = 120;
const WINDOW_SIZE = 90;
const MIN_SCALE = 60;
const SCALE_STEP = 5;
const RECOVERY_MS = 10000;

export const qualityPreference = value => TIERS.includes(value) ? value : 'auto';
const positive = value => Number.isFinite(value) && value > 0;

export function detectDeviceClass({userAgent = '', platform = '', maxTouchPoints = 0,
  coarsePointer = false, width = Infinity, height = Infinity} = {}) {
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent) || (/^Mac/i.test(platform) && maxTouchPoints > 1)) return 'tablet';
  if (/iPhone|iPod|Windows Phone/i.test(userAgent)) return 'phone';
  if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent) ? 'phone' : 'tablet';
  if (coarsePointer && maxTouchPoints > 0) return Math.min(width, height) < 600 ? 'phone' : 'tablet';
  return 'desktop';
}

export const isAndroidChrome = userAgent => /Android/i.test(userAgent) && /Chrome\//i.test(userAgent);

export function estimateRefreshHz(intervals) {
  const sorted = intervals.filter(positive).sort((a, b) => a - b);
  if (sorted.length < REFRESH_SAMPLE_COUNT) return null;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(1000 / median);
}

export function resolveRenderCadence(deviceClass, refreshHz) {
  const phone = deviceClass === 'phone';
  const hz = positive(refreshHz) ? refreshHz : 60;
  // Phones stay at or below 30. High-refresh tablets and desktops use the
  // integer divisor nearest the nominal 60 FPS ratio, with at least two ticks.
  const divisor = phone ? Math.ceil(hz / 30) : hz >= 100 ? Math.max(2, Math.round(hz / 60)) : 1;
  return {divisor, targetFps:hz / divisor};
}

export function resolveQuality({preference = 'auto', width, dpr = 1, cores, memory,
  recovered = false, autoTier = null, deviceClass = 'desktop', androidChrome = false, highPerformanceWebGL2 = false}) {
  const constrained = (positive(cores) && cores <= 2) || (positive(memory) && memory <= 2);
  const lowEnd = (positive(cores) && cores <= 4) || (positive(memory) && memory <= 4) ||
    (androidChrome && !highPerformanceWebGL2);
  const choice = qualityPreference(preference);
  const phone = deviceClass === 'phone';
  const initialTier = constrained ? 'low' : phone || width < 1000 ? 'balanced' : 'detailed';
  const tier = recovered ? 'low' : choice !== 'auto' ? choice : TIERS.includes(autoTier) ? autoTier : initialTier;
  let cap = 2;
  if (tier === 'low') cap = 1;
  else if (phone) cap = lowEnd ? 1.25 : 1.5;
  else if (tier === 'balanced') cap = width < 600 ? 1.25 : choice === 'auto' && width >= 1000 ? 1.5 : 2;
  return Object.freeze({preference:choice, tier, pixelRatio:Math.min(positive(dpr) ? dpr : 1, cap),
    shadows:tier === 'detailed' && width >= 1000, recovered});
}

export function createRenderCadence(deviceClass) {
  const intervals = [];
  let refreshHz = null, lastSample = null, lastDraw = null;
  let policy = resolveRenderCadence(deviceClass, refreshHz);
  return {
    get refreshHz() { return refreshHz; },
    get targetFps() { return policy.targetFps; },
    get capped() { return policy.divisor > 1; },
    reset() { lastDraw = lastSample = null; intervals.length = 0; },
    observe(now, active) {
      if (refreshHz !== null) return false;
      if (!active) { lastSample = null; intervals.length = 0; return false; }
      if (lastSample !== null && now > lastSample) intervals.push(now - lastSample);
      lastSample = now;
      if (intervals.length < REFRESH_SAMPLE_COUNT) return false;
      refreshHz = estimateRefreshHz(intervals);
      policy = resolveRenderCadence(deviceClass, refreshHz);
      intervals.length = 0;
      return true;
    },
    take(now) {
      const elapsed = lastDraw === null ? 1000 / policy.targetFps : now - lastDraw;
      if (refreshHz) {
        // Anchor each draw to a real refresh. After a missed callback, wait
        // a full divisor again instead of catching up with a short frame.
        const refreshes = Math.max(1, Math.round(elapsed * refreshHz / 1000));
        if (refreshes < policy.divisor) return 0;
        lastDraw = now;
        return refreshes * 1000 / refreshHz;
      }
      if (policy.divisor > 1 && elapsed + .8 < 1000 / policy.targetFps) return 0;
      lastDraw = now;
      return elapsed;
    }
  };
}

// Pure decision over a rolling window. Quantized slot timings measure cadence
// independently of display refresh jitter. Submission time supplies a second
// headroom signal when the cap hides faster frames.
export function decideAdaptiveQuality(state, samples, {now, targetFps, tier, allowTierDowngrade}) {
  const budget = 1000 / targetFps;
  const percentile80 = key => samples.map(sample => sample[key]).sort((a, b) => a - b)[Math.ceil(samples.length * .8) - 1];
  const cadence = percentile80('frameMs');
  // Limit the influence of a single long frame on the miss rate.
  const mean = samples.reduce((total, {frameMs}) => total + Math.min(frameMs, budget * 2), 0) / samples.length;
  const overloaded = cadence > budget * 1.06 || mean > budget * 1.04;
  const headroom = mean <= budget * 1.01 && cadence <= budget * 1.01 && percentile80('callbackMs') <= budget * .8;
  const slowSince = overloaded ? state.slowSince ?? now : null;
  const fastSince = headroom ? state.fastSince ?? now : null;
  const next = {...state, slowSince, fastSince};
  const {scale, raisedAt, recoveryDelay} = state;
  if (slowSince !== null) {
    const slowMs = now - slowSince;
    if (scale > MIN_SCALE && slowMs >= 750) {
      return {...next, scale:scale - SCALE_STEP,
        recoveryDelay:now - raisedAt < 15000 ? Math.min(60000, recoveryDelay * 3) : recoveryDelay};
    }
    if (scale === MIN_SCALE && allowTierDowngrade && slowMs >= 5000 && TIERS.indexOf(tier) > 0) {
      return {...next, lowerTier:TIERS[TIERS.indexOf(tier) - 1]};
    }
  }
  if (scale < 100 && fastSince !== null && now - fastSince >= recoveryDelay) {
    return {...next, scale:scale + SCALE_STEP, raisedAt:now};
  }
  return next;
}

export function createAdaptiveQuality(targetFps) {
  const samples = [];
  let cursor = 0, firstSample, nextCheck, ignoreUntil = 0;
  let state = {scale:100, raisedAt:-Infinity, recoveryDelay:RECOVERY_MS, slowSince:null, fastSince:null};

  function reset(now, settleMs = 500) {
    samples.length = 0;
    cursor = 0;
    firstSample = nextCheck = null;
    ignoreUntil = now + settleMs;
    state.slowSince = state.fastSince = null;
  }

  return {
    reset,
    restoreScale(now) {
      state.scale = 100;
      state.raisedAt = -Infinity;
      state.recoveryDelay = RECOVERY_MS;
      reset(now);
    },
    get renderScale() { return state.scale / 100; },
    sample(now, frameMs, callbackMs, tier, allowTierDowngrade, currentTargetFps = targetFps) {
      if (now < ignoreUntil || !positive(frameMs)) return null;
      firstSample ??= now;
      samples[cursor] = {frameMs, callbackMs};
      cursor = (cursor + 1) % WINDOW_SIZE;
      if (now < nextCheck || (samples.length < WINDOW_SIZE && (samples.length < 8 || now - firstSample < 3000))) return null;
      nextCheck = now + 250;
      const {lowerTier, ...next} = decideAdaptiveQuality(state, samples, {now, targetFps:currentTargetFps, tier, allowTierDowngrade});
      const scaleChanged = next.scale !== state.scale;
      state = next;
      if (!scaleChanged && !lowerTier) return null;
      reset(now);
      return lowerTier ? {tier:lowerTier} : {renderScale:state.scale / 100};
    }
  };
}

export function createGraphicsQuality(onChange) {
  const select = document.getElementById('graphics-quality');
  const autoResolution = document.getElementById('auto-resolution');
  const status = document.getElementById('graphics-quality-status');
  const deviceClass = detectDeviceClass({userAgent:navigator.userAgent, platform:navigator.platform,
    maxTouchPoints:navigator.maxTouchPoints, coarsePointer:window.matchMedia('(pointer: coarse)').matches,
    width:window.innerWidth, height:window.innerHeight});
  const cadence = createRenderCadence(deviceClass);
  const androidChrome = isAndroidChrome(navigator.userAgent);
  const adaptive = createAdaptiveQuality(cadence.targetFps);
  let preference = 'auto', recovered = false, profile, autoTier = null;
  let tierDowngrades = 0, pendingDowngrade = null, highPerformanceWebGL2 = false;
  let autoEnabled = true;
  try {
    preference = qualityPreference(localStorage.getItem(QUALITY_KEY));
    autoEnabled = localStorage.getItem(RESOLUTION_KEY) !== 'off';
  } catch { /* Optional preference storage. */ }
  select.value = preference;
  autoResolution.checked = autoEnabled;
  select.addEventListener('change', () => {
    preference = qualityPreference(select.value);
    recovered = false;
    pendingDowngrade = null;
    adaptive.reset(performance.now());
    try { localStorage.setItem(QUALITY_KEY, preference); } catch { /* Applies for this session. */ }
    onChange();
  });
  autoResolution.addEventListener('change', () => {
    autoEnabled = autoResolution.checked;
    adaptive.restoreScale(performance.now());
    try { localStorage.setItem(RESOLUTION_KEY, autoEnabled ? 'on' : 'off'); } catch { /* Applies for this session. */ }
    onChange('resolution');
  });

  function updateStatus() {
    const name = profile.tier[0].toUpperCase() + profile.tier.slice(1);
    const rate = Number(cadence.targetFps.toFixed(1));
    const pacing = cadence.capped ? `${rate} FPS cap.` : cadence.refreshHz ? `${cadence.refreshHz} Hz native refresh.` : 'Native refresh.';
    status.textContent = `${recovered ? 'Low after graphics recovery' : preference === 'auto' ? `Auto: ${name}` : name}. ${pacing} ${Math.round(profile.renderScale * 100)}% resolution. ${profile.shadows ? 'Real-time shadows on.' : 'Real-time shadows off.'}`;
  }

  function apply(next) {
    const renderScale = adaptive.renderScale;
    profile = Object.freeze({...next, renderScale, pixelRatio:next.basePixelRatio * renderScale});
    if (preference === 'auto' && pendingDowngrade === profile.tier) {
      tierDowngrades++;
      pendingDowngrade = null;
    }
    updateStatus();
    return profile;
  }

  return {
    deviceClass, androidChrome, cadence,
    get targetFps() { return cadence.targetFps; },
    get refreshHz() { return cadence.refreshHz; },
    observeRefresh(now, active) {
      if (cadence.observe(now, active)) {
        adaptive.reset(now);
        if (profile) updateStatus();
      }
    },
    setWebGLHint(value) { highPerformanceWebGL2 = value; },
    recover() {
      recovered = true;
      preference = select.value = 'low';
      pendingDowngrade = null;
      adaptive.reset(performance.now());
    },
    resetSampling(now = performance.now()) { adaptive.reset(now); },
    sample(now, frameMs, callbackMs, active) {
      if (!active || !autoEnabled || !profile) {
        adaptive.reset(now);
        return;
      }
      const next = adaptive.sample(now, frameMs, callbackMs, profile.tier, preference === 'auto' && !recovered, cadence.targetFps);
      if (next?.tier) autoTier = pendingDowngrade = next.tier;
      if (next) onChange(next.tier ? 'tier' : 'resolution');
    },
    resolve(width) {
      const next = resolveQuality({preference, width, dpr:window.devicePixelRatio, cores:navigator.hardwareConcurrency,
        memory:navigator.deviceMemory, recovered, autoTier, deviceClass, androidChrome, highPerformanceWebGL2});
      if (preference === 'auto') autoTier ??= next.tier;
      return Object.freeze({...next, basePixelRatio:next.pixelRatio, pixelRatio:next.pixelRatio * adaptive.renderScale});
    },
    apply,
    get tierDowngrades() { return tierDowngrades; },
    get state() { return profile; },
  };
}
