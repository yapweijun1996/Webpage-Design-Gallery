import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaptiveQuality, createGraphicsQuality, createRenderCadence, detectDeviceClass,
  estimateRefreshHz, isAndroidChrome, QUALITY_KEY, qualityPreference, RESOLUTION_KEY,
  resolveQuality, resolveRenderCadence}
  from '../demos/corporate/gjh/v11/assets/graphics-quality.js';

test('device classification combines platform, touch, pointer and viewport hints', () => {
  const fixtures = [
    ['iPhone portrait', {userAgent:'Mozilla (iPhone)', width:393, height:852}, 'phone'],
    ['iPhone landscape', {userAgent:'Mozilla (iPhone)', width:852, height:393}, 'phone'],
    ['Android phone', {userAgent:'Mozilla (Android 15) Chrome/131.0 Mobile', width:915, height:412}, 'phone'],
    ['Android tablet', {userAgent:'Mozilla (Android 15) Chrome/131.0', width:1230, height:800}, 'tablet'],
    ['iPad', {userAgent:'Mozilla (iPad)', width:768, height:1024}, 'tablet'],
    ['iPadOS desktop UA', {userAgent:'Mozilla (Macintosh)', platform:'MacIntel', maxTouchPoints:5,
      width:440, height:1024}, 'tablet'],
    ['Mac', {userAgent:'Mozilla (Macintosh)', platform:'MacIntel', maxTouchPoints:0, width:430}, 'desktop'],
    ['touch laptop', {platform:'Win32', maxTouchPoints:10, coarsePointer:false, width:430}, 'desktop'],
    ['coarse pointer alone', {coarsePointer:true, width:430}, 'desktop'],
    ['generic landscape phone', {maxTouchPoints:5, coarsePointer:true, width:850, height:390}, 'phone'],
    ['generic tablet', {maxTouchPoints:5, coarsePointer:true, width:800, height:1100}, 'tablet'],
  ];
  for (const [label, hints, expected] of fixtures) assert.equal(detectDeviceClass(hints), expected, label);
  assert.equal(isAndroidChrome('Mozilla (Android 15) Chrome/131.0 Mobile'), true);
  assert.equal(isAndroidChrome('Mozilla (iPhone) CriOS/131.0 Mobile'), false);
});

test('Auto chooses a starting tier and an existing Auto tier survives a resize', () => {
  assert.equal(resolveQuality({width:1440, cores:2}).tier, 'low');
  assert.equal(resolveQuality({width:1440, memory:2}).tier, 'low');
  assert.equal(resolveQuality({width:1440, cores:8, memory:8}).tier, 'detailed');
  assert.equal(resolveQuality({width:820, deviceClass:'tablet'}).tier, 'balanced');
  assert.equal(resolveQuality({width:1024, deviceClass:'phone'}).tier, 'balanced');
  assert.equal(resolveQuality({width:1440, autoTier:'balanced'}).tier, 'balanced');
  assert.equal(resolveQuality({width:1440, autoTier:'low'}).tier, 'low');
});

test('phone DPR caps respect both hardware and WebGL hints', () => {
  for (const preference of ['balanced','detailed']) {
    const phone = {preference, width:393, dpr:3, deviceClass:'phone'};
    assert.equal(resolveQuality(phone).pixelRatio, 1.5);
    for (const hints of [{cores:4}, {memory:4}, {androidChrome:true}]) {
      assert.equal(resolveQuality({...phone, ...hints}).pixelRatio, 1.25);
    }
    assert.equal(resolveQuality({...phone, androidChrome:true, highPerformanceWebGL2:true}).pixelRatio, 1.5);
    assert.equal(resolveQuality({...phone, androidChrome:true, highPerformanceWebGL2:true, cores:4}).pixelRatio, 1.25);
    assert.equal(resolveQuality({...phone, cores:0, memory:NaN}).pixelRatio, 1.5);
    assert.equal(resolveQuality({...phone, dpr:1}).pixelRatio, 1);
    assert.equal(resolveQuality({...phone, recovered:true}).pixelRatio, 1);
  }
});

test('explicit profiles retain tier, DPR and shadow eligibility', () => {
  for (const preference of ['low','balanced','detailed']) for (const width of [390,1440]) {
    for (const dpr of [1,1.5,2,3,0,NaN]) {
      const profile = resolveQuality({preference,width,dpr,cores:1,memory:1,autoTier:'low'});
      const cap = preference === 'low' ? 1 : preference === 'balanced' && width < 600 ? 1.25 : 2;
      assert.equal(profile.tier, preference);
      assert.equal(profile.pixelRatio, Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, cap));
      assert.equal(profile.shadows, preference === 'detailed' && width >= 1000);
      assert.ok(Object.isFrozen(profile));
      const recovered = resolveQuality({preference,width,dpr,recovered:true});
      assert.equal(recovered.tier, 'low');
      assert.equal(recovered.shadows, false);
      assert.ok(recovered.pixelRatio <= 1);
    }
  }
});

test('stored tier values are allowlisted', () => {
  for (const value of [null,undefined,'','ultra','Low','{"tier":"low"}',{},1]) assert.equal(qualityPreference(value),'auto');
  for (const value of ['auto','low','balanced','detailed']) assert.equal(qualityPreference(value),value);
});

function series(targetFps, allowTierDowngrade = true) {
  const controller = createAdaptiveQuality(targetFps);
  let now = 0, tier = 'detailed';
  const events = [];
  return {
    feed(frameTime, duration, callbackMs = 8) {
      const end = now + duration;
      for (let i = 0; now < end; i++) {
        const frameMs = typeof frameTime === 'function' ? frameTime(i) : frameTime;
        now += frameMs;
        const change = controller.sample(now, frameMs, callbackMs, tier, allowTierDowngrade);
        if (change) {
          tier = change.tier ?? tier;
          events.push({at:now, ...change});
        }
      }
    },
    pause(ms) { now += ms; controller.reset(now); },
    events,
    get now() { return now; },
    get scale() { return controller.renderScale; },
    get tier() { return tier; },
  };
}

test('steady 16 ms at 60 FPS, occasional 40 ms spikes and 20 ms at 30 FPS preserve full resolution', () => {
  const desktop = series(60);
  desktop.feed(16, 12000);
  desktop.feed(i => i % 45 === 0 ? 40 : 16, 12000);
  assert.deepEqual(desktop.events, []);
  const phone = series(30);
  phone.feed(20, 18000);
  assert.deepEqual(phone.events, []);
});

test('adaptive quality uses the effective native cadence to detect missed refreshes', () => {
  const {targetFps} = resolveRenderCadence('desktop', 75);
  const desktop = series(targetFps);
  desktop.feed(1000/75, 12000);
  assert.deepEqual(desktop.events, []);
  desktop.feed(i => i % 4 === 0 ? 2000/75 : 1000/75, 12000);
  assert.ok(desktop.scale < 1);
});

test('sustained 25 ms at 60 FPS lowers resolution in small steps, then lowers one tier at a time', () => {
  const result = series(60);
  result.feed(25, 60000);
  const floorIndex = result.events.findIndex(event => event.renderScale === .6);
  assert.ok(floorIndex >= 0);
  assert.deepEqual(result.events.slice(0, floorIndex + 1).map(event => event.renderScale),
    [.95,.9,.85,.8,.75,.7,.65,.6]);
  const tierEvents = result.events.slice(floorIndex + 1);
  assert.deepEqual(tierEvents.map(event => event.tier), ['balanced','low']);
  assert.ok(tierEvents[0].at - result.events[floorIndex].at >= 5000);
  assert.ok(tierEvents[1].at - tierEvents[0].at >= 5000);
  result.feed(16, 45000);
  assert.equal(result.tier, 'low');
  assert.ok(result.scale > .6);
});

test('a manual tier keeps scaling and never automatically downgrades', () => {
  const result = series(60, false);
  result.feed(25, 60000);
  assert.equal(result.scale, .6);
  assert.equal(result.tier, 'detailed');
  assert.ok(result.events.every(event => !event.tier));
});

test('recovery requires 10 seconds of headroom and backs off after a failed increase', () => {
  const result = series(60);
  result.feed(25, 3000);
  assert.equal(result.scale, .95);
  result.feed(1000/60, 15000, 15); // Reaches the cap with little CPU headroom.
  assert.equal(result.scale, .95);
  result.feed(1000/60, 10000);
  assert.equal(result.scale, .95);
  result.feed(1000/60, 2500);
  assert.equal(result.scale, 1);
  result.feed(25, 4000);
  assert.equal(result.scale, .95);
  result.pause(500);
  result.feed(1000/60, 20000);
  assert.equal(result.scale, .95);
  result.feed(1000/60, 15000);
  assert.equal(result.scale, 1);
});

test('sampling interruptions clear overload timers and exclude settling frames', () => {
  const result = series(60);
  result.feed(25, 2500);
  assert.equal(result.scale, 1);
  result.pause(5000);
  result.feed(25, 2500);
  assert.equal(result.scale, 1);
  result.feed(25, 1800);
  assert.equal(result.scale, .95);
});

test('refresh estimation uses 120 active rAF intervals and takes their median', () => {
  const intervals = Array.from({length:120}, (_, i) => i % 5 === 0 ? 100 : (1000 / 75) + (i % 2 ? .04 : -.04));
  assert.equal(estimateRefreshHz(intervals.slice(1)), null);
  assert.equal(estimateRefreshHz(intervals), 75);

  const cadence = createRenderCadence('desktop');
  for (let i = 0; i < 100; i++) cadence.observe(i * 10, false);
  for (let i = 100; i < 200; i++) cadence.observe(i * 10, true);
  assert.equal(cadence.refreshHz, null);
  cadence.observe(2000, false);
  for (let i = 0; i < 120; i++) cadence.observe(3000 + i * 1000 / 120, true);
  assert.equal(cadence.refreshHz, null);
  assert.equal(cadence.capped, false);
  assert.equal(cadence.observe(4000, true), true);
  assert.equal(cadence.refreshHz, 120);
  assert.equal(cadence.capped, true);
});

test('native tablet and desktop cadence below 100 Hz and integer caps on high-refresh displays and phones', () => {
  const cases = [
    ['tablet',60,1,60], ['desktop',75,1,75], ['tablet',90,1,90], ['desktop',99,1,99],
    ['desktop',100,2,50], ['tablet',120,2,60], ['desktop',144,2,72],
    ['phone',60,2,30], ['phone',90,3,30], ['phone',120,4,30], ['phone',144,5,28.8]
  ];
  for (const [device, refresh, divisor, targetFps] of cases) {
    assert.deepEqual(resolveRenderCadence(device, refresh), {divisor, targetFps});
    const cadence = createRenderCadence(device);
    for (let i = 0; i <= 120; i++) cadence.observe(i * 1000 / refresh, true);
    const timings = Array.from({length:refresh * 20}, (_, i) => cadence.take(i * 1000 / refresh)).filter(Boolean);
    assert.equal(timings.length, targetFps * 20, `${device} on ${refresh} Hz`);
    assert.ok(timings.every(ms => Math.abs(ms - 1000 / targetFps) < 1e-9));
  }
});

test('missed refreshes never trigger a short catch-up draw and resume keeps the measured rate', () => {
  const cadence = createRenderCadence('desktop');
  for (let i = 0; i <= 120; i++) cadence.observe(i * 1000 / 120, true);
  assert.equal(cadence.take(0), 1000/60);
  assert.equal(cadence.take(1000/120), 0);
  assert.equal(cadence.take(25), 25);
  assert.equal(cadence.take(4000/120), 0);
  assert.equal(cadence.take(5000/120), 1000/60);
  cadence.reset();
  assert.equal(cadence.refreshHz, 120);
  assert.equal(cadence.take(10001), 1000/60);
});

test('graphics settings keep manual tier and Auto resolution independent and persist explicit choices', () => {
  const keys = ['document','window','navigator','localStorage'];
  const originals = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
  const control = () => ({addEventListener(_, callback) { this.change = callback; }});
  const select = control(), resolution = control(), status = {};
  const elements = {'graphics-quality':select, 'auto-resolution':resolution, 'graphics-quality-status':status};
  const stored = new Map();
  const globals = {
    document:{getElementById:id => elements[id]},
    window:{innerWidth:1440, innerHeight:900, devicePixelRatio:2, matchMedia:() => ({matches:false})},
    navigator:{hardwareConcurrency:8, deviceMemory:8},
    localStorage:{getItem:key => stored.get(key), setItem:(key,value) => stored.set(key,value)},
  };
  try {
    for (const key of keys) Object.defineProperty(globalThis,key,{configurable:true,value:globals[key]});
    const quality = createGraphicsQuality(() => quality.apply(quality.resolve(1440)));
    quality.apply(quality.resolve(1440));
    assert.equal(quality.deviceClass, 'desktop');
    assert.equal(quality.targetFps, 60);
    assert.equal(quality.refreshHz, null);
    for (let i = 0; i <= 120; i++) quality.observeRefresh(i * 1000 / 75, true);
    assert.equal(quality.refreshHz, 75);
    assert.equal(quality.targetFps, 75);
    assert.equal(resolution.checked, true);
    assert.equal(quality.state.tier, 'detailed');

    for (let now = 1000; now < 65000; now += 25) quality.sample(now, 25, 8, true);
    assert.equal(quality.state.tier, 'low');
    assert.equal(quality.state.renderScale, .6);
    assert.equal(quality.state.pixelRatio, .6);
    assert.equal(quality.tierDowngrades, 2);
    assert.equal(stored.size, 0);

    select.value = 'detailed';
    select.change();
    assert.equal(stored.get(QUALITY_KEY), 'detailed');
    assert.equal(quality.state.tier, 'detailed');
    assert.equal(quality.state.pixelRatio, 1.2);
    resolution.checked = false;
    resolution.change();
    assert.equal(stored.get(RESOLUTION_KEY), 'off');
    for (let now = 65000; now < 95000; now += 25) quality.sample(now, 25, 8, true);
    assert.equal(quality.state.tier, 'detailed');
    assert.equal(quality.state.renderScale, 1);

    resolution.checked = true;
    resolution.change();
    for (let now = 95000; now < 150000; now += 25) quality.sample(now, 25, 8, true);
    assert.equal(quality.state.tier, 'detailed');
    assert.equal(quality.state.renderScale, .6);
    assert.equal(quality.tierDowngrades, 2);
    assert.match(status.textContent, /Detailed. 75 Hz native refresh. 60% resolution/);
    quality.recover();
    quality.apply(quality.resolve(1440));
    assert.equal(quality.state.tier, 'low');
    assert.equal(quality.state.shadows, false);
    assert.equal(stored.get(QUALITY_KEY), 'detailed');
  } finally {
    for (const key of keys) {
      if (originals[key]) Object.defineProperty(globalThis,key,originals[key]);
      else delete globalThis[key];
    }
  }
});
