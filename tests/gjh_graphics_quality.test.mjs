import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveQuality, qualityPreference, createAdaptiveQuality, createGraphicsQuality} from '../demos/corporate/gjh/v11/assets/graphics-quality.js';

test('Auto uses conservative desktop graphics without assuming GPU capacity', () => {
  const fixtures = [
    [{cores:2,memory:8}, 'low'], [{cores:8,memory:2}, 'low'],
    [{cores:4,memory:4}, 'balanced'], [{cores:8}, 'balanced'],
    [{memory:8}, 'balanced'], [{}, 'balanced'],
    [{cores:0,memory:NaN}, 'balanced'], [{cores:Infinity,memory:8}, 'balanced'],
  ];
  for (const [hardware, wide] of fixtures) for (const width of [320,390,599,600,650,651,667,768,844,999,1000,1001,1440]) {
    const p = resolveQuality({width,dpr:3,...hardware});
    const tier = wide;
    assert.equal(p.tier, tier, JSON.stringify({hardware,width}));
    assert.equal(p.pixelRatio, tier === 'low' ? 1 : width < 600 ? 1.25 : width >= 1000 ? 1.5 : 2);
    assert.equal(p.shadows, tier === 'detailed' && width >= 1000);
    assert.ok(Object.isFrozen(p));
  }
});

test('explicit profiles and recovery use bounded DPR with truthful shadow eligibility', () => {
  for (const preference of ['low','balanced','detailed']) for (const width of [390,1440]) for (const dpr of [1,1.5,2,3,0,NaN]) {
    const p = resolveQuality({preference,width,dpr,cores:1,memory:1});
    const cap = preference === 'low' ? 1 : preference === 'balanced' && width < 600 ? 1.25 : 2;
    assert.equal(p.tier,preference);
    assert.equal(p.pixelRatio,Math.min(Number.isFinite(dpr)&&dpr>0 ? dpr : 1,cap));
    assert.equal(p.shadows,preference==='detailed' && width>=1000);
    const recovered=resolveQuality({preference,width,dpr,recovered:true});
    assert.equal(recovered.tier,'low'); assert.equal(recovered.shadows,false); assert.ok(recovered.pixelRatio<=1);
  }
});

test('storage values are allowlisted', () => {
  for (const value of [null,undefined,'','ultra','Low','{"tier":"low"}',{},1]) assert.equal(qualityPreference(value),'auto');
  for (const value of ['auto','low','balanced','detailed']) assert.equal(qualityPreference(value),value);
});

function sampleFor(controller, initial, interval, duration, start=0, active=true) {
  let tier=initial, now=start; const changes=[];
  while (now<start+duration) {
    now+=interval;
    const next=controller.sample(now,active,tier);
    if (next) { changes.push({at:now,tier:next}); tier=next; }
  }
  return {tier,now,changes};
}

test('Auto trials Detailed only after sustained 60/120 Hz and rolls back sustained slow frames', () => {
  for (const interval of [1000/60,1000/120]) {
    const controller=createAdaptiveQuality({allowDetailed:true});
    const short=sampleFor(controller,'balanced',interval,14000);
    assert.equal(short.tier,'balanced');
    const fast=sampleFor(controller,short.tier,interval,3000,short.now);
    assert.equal(fast.tier,'detailed'); assert.equal(fast.changes.length,1);
    const slow=sampleFor(controller,fast.tier,1000/30,2000,fast.now);
    assert.equal(slow.tier,'balanced'); assert.equal(slow.changes.length,1);
    const sustained=sampleFor(controller,slow.tier,1000/30,8000,slow.now);
    assert.equal(sustained.tier,'low');
  }
});

test('slow, isolated spikes and paused intervals do not masquerade as sustained headroom', () => {
  const controller=createAdaptiveQuality();
  const slow=sampleFor(controller,'balanced',1000/30,8000);
  assert.equal(slow.tier,'low');
  const reset=controller.sample(slow.now+20,false,slow.tier); assert.equal(reset,null);
  const good=sampleFor(controller,slow.tier,1000/60,8000,slow.now+20);
  assert.equal(good.tier,'low');
  controller.sample(good.now+100,false,good.tier);
  const restarted=sampleFor(controller,good.tier,1000/60,8000,good.now+100);
  assert.equal(restarted.tier,'low');
  const isolated=createAdaptiveQuality();
  let now=0,tier='balanced';
  for(let i=0;i<400;i++) { now+=i===240?300:1000/60; tier=isolated.sample(now,true,tier)||tier; }
  assert.equal(tier,'balanced');
});

test('dynamic tier never overrides explicit preferences or recovery', () => {
  for (const preference of ['low','balanced','detailed']) {
    assert.equal(resolveQuality({preference,width:1440,dpr:2,autoTier:'low'}).tier,preference);
    assert.equal(resolveQuality({preference,width:1440,dpr:2,autoTier:'detailed'}).tier,preference);
    assert.equal(resolveQuality({preference,width:1440,dpr:2,recovered:true,autoTier:'detailed'}).tier,'low');
  }
  assert.equal(resolveQuality({preference:'auto',width:1440,dpr:3,autoTier:'detailed'}).pixelRatio,2);
  assert.equal(resolveQuality({preference:'auto',width:1440,dpr:2,autoTier:'bad'}).tier,'balanced');
});

test('Auto does not trial Detailed until explicitly gated on', () => {
  const result=sampleFor(createAdaptiveQuality(),'balanced',1000/60,60000);
  assert.equal(result.tier,'balanced'); assert.deepEqual(result.changes,[]);
});

test('stationary load may downgrade but cannot alone establish upgrade headroom', () => {
  const stationary=createAdaptiveQuality({allowDetailed:true}); let tier='balanced',now=0;
  for(let i=0;i<1800;i++) { now+=1000/60; tier=stationary.sample(now,true,tier,false)||tier; }
  assert.equal(tier,'balanced');
  const slow=createAdaptiveQuality(); tier='balanced'; now=0;
  for(let i=0;i<250;i++) { now+=1000/30; tier=slow.sample(now,true,tier,false)||tier; }
  assert.equal(tier,'low');
});

test('isolated first-view stalls and their catch-up frames do not downgrade Auto', () => {
  const frame = 1000/75;
  const intervals = [...Array(300).fill(frame), 240, ...Array(23).fill(frame), 2427, 53, ...Array(400).fill(frame)];
  for (const initial of ['balanced', 'detailed']) {
    const controller = createAdaptiveQuality({allowDetailed:true});
    let now = 0;
    for (const interval of intervals) {
      now += interval;
      assert.equal(controller.sample(now, true, initial, false), null, `${initial} at ${now}ms`);
    }
  }
});

test('sustained 34ms frames still downgrade balanced Auto after a stall', () => {
  const controller = createAdaptiveQuality({allowDetailed:true});
  const normal = sampleFor(controller, 'balanced', 1000/75, 4000);
  assert.equal(controller.sample(normal.now + 2427, true, 'balanced'), null);
  const slow = sampleFor(controller, 'balanced', 34, 6000, normal.now + 2427);
  assert.equal(slow.tier, 'low');
  assert.equal(slow.changes.length, 1);
});

test('a sustained run of foreground stalls downgrades but one isolated stall does not', () => {
  let now=0,tier='balanced'; const repeated=createAdaptiveQuality();
  for(let i=0;i<60;i++) { now+=(i%3===2?1200:1000/60); tier=repeated.sample(now,true,tier,true)||tier; }
  assert.equal(tier,'low');
  now=0; tier='balanced'; const once=createAdaptiveQuality();
  for(let i=0;i<500;i++) { now+=i===240?2500:1000/60; tier=once.sample(now,true,tier,true)||tier; }
  assert.equal(tier,'balanced');
});

test('repeated missed refresh intervals cause a downgrade', () => {
  const controller=createAdaptiveQuality(); let now=0,tier='balanced';
  for(let i=0;i<600;i++) { now+=i%3===2?33.4:16.7; tier=controller.sample(now,true,tier,true)||tier; }
  assert.equal(tier,'low');
});

test('sustained threshold is asymmetric and a slow transition does not flap on isolated spikes', () => {
  assert.equal(sampleFor(createAdaptiveQuality(),'balanced',20,8000).tier,'balanced');
  assert.equal(sampleFor(createAdaptiveQuality(),'balanced',20.1,8000).tier,'low');
  const controller=createAdaptiveQuality();
  const slow=sampleFor(controller,'balanced',1000/30,8000);
  assert.equal(slow.tier,'low');
  const fast=sampleFor(controller,slow.tier,1000/60,17000,slow.now);
  assert.equal(fast.tier,'balanced'); assert.equal(fast.changes.length,1);
  const held=sampleFor(controller,fast.tier,1000/60,6000,fast.now);
  assert.equal(held.tier,'balanced'); assert.equal(held.changes.length,0);
});

test('manual preferences and recovered mode never adapt or rewrite storage', () => {
  const keys=['document','window','navigator','localStorage'];
  const originals=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let listener, saved='auto', writes=0, callbacks=0, quality;
  const select={value:'',addEventListener(type,callback){if(type==='change') listener=callback;}};
  const status={textContent:''};
  try {
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:id=>id==='graphics-quality'?select:status}});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{devicePixelRatio:2}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{hardwareConcurrency:8,deviceMemory:8}});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>saved,setItem:(key,value)=>{saved=value;writes++;}}});
    quality=createGraphicsQuality(()=>{callbacks++;quality.resolve(1440);}); quality.resolve(1440);
    assert.match(status.textContent,/Auto: Balanced/);
    // Ineligible frames model hidden, blurred, modal and interrupted states.
    for(let now=0;now<20000;now+=1000/30) quality.sample(now,false,true);
    assert.equal(quality.state.tier,'balanced'); assert.equal(callbacks,0); assert.equal(writes,0);
    for(let now=20000;now<28000;now+=1000/30) quality.sample(now,true,true);
    assert.equal(quality.state.tier,'low'); assert.equal(saved,'auto'); assert.equal(writes,0); assert.equal(callbacks,1);
    assert.match(status.textContent,/Auto: Low.*shows fewer ambient visitors/);
    select.value='detailed'; listener(); assert.equal(saved,'detailed'); assert.equal(writes,1);
    assert.match(status.textContent,/Detailed/);
    for(let now=28000;now<68000;now+=1000/30) quality.sample(now,true,true);
    assert.equal(quality.state.tier,'detailed'); assert.equal(callbacks,2); assert.equal(writes,1);
    quality.recover();quality.resolve(1440);
    for(let now=68000;now<108000;now+=1000/60) quality.sample(now,true,true);
    assert.equal(quality.state.tier,'low'); assert.equal(writes,1);
  } finally {
    for(const key of keys) if(originals[key]) Object.defineProperty(globalThis,key,originals[key]); else delete globalThis[key];
  }
});

test('failed Detailed trials roll back promptly and back off repeated retries', () => {
  const controller=createAdaptiveQuality({allowDetailed:true});
  let result=sampleFor(controller,'balanced',1000/60,16000);
  assert.equal(result.tier,'detailed');
  let start=result.now;
  result=sampleFor(controller,result.tier,40,2200,result.now);
  assert.equal(result.tier,'balanced');assert.ok(result.changes[0].at-start<2000);
  controller.reset(); // Interruptions clear samples, but retain the retry cooldown.
  result=sampleFor(controller,result.tier,1000/60,28000,result.now);assert.equal(result.tier,'balanced');
  result=sampleFor(controller,result.tier,1000/60,6000,result.now);assert.equal(result.tier,'detailed');
  start=result.now;result=sampleFor(controller,result.tier,40,2200,result.now);
  assert.equal(result.tier,'balanced');assert.ok(result.changes[0].at-start<2000);
  result=sampleFor(controller,result.tier,1000/60,57000,result.now);assert.equal(result.tier,'balanced');
  result=sampleFor(controller,result.tier,1000/60,7000,result.now);assert.equal(result.tier,'detailed');
});

test('one long Detailed frame does not trigger an emergency rollback', () => {
  const controller=createAdaptiveQuality({allowDetailed:true});
  let result=sampleFor(controller,'balanced',1000/60,16000);
  assert.equal(result.tier,'detailed');
  assert.equal(controller.sample(result.now+1300,true,result.tier,true),null);
  assert.equal(controller.sample(result.now+1316.7,true,result.tier,true),null);
  result=sampleFor(controller,result.tier,1000/60,4000,result.now+1316.7);
  assert.equal(result.tier,'detailed');
});

test('production Auto trials Detailed after sustained moving frames and leaves preferences alone', () => {
  const keys=['document','window','navigator','localStorage'];
  const originals=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let saved='auto',writes=0,quality;
  const select={value:'',addEventListener(){}};const status={textContent:''};
  try {
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:id=>id==='graphics-quality'?select:status}});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{devicePixelRatio:2}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{hardwareConcurrency:8,deviceMemory:8}});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>saved,setItem:()=>{writes++;}}});
    quality=createGraphicsQuality(()=>quality.resolve(1440));quality.resolve(1440);
    for(let now=0;now<25000;now+=1000/60)quality.sample(now,true,false);
    assert.equal(quality.state.tier,'balanced');
    for(let now=25000;now<43000;now+=1000/60)quality.sample(now,true,true);
    assert.equal(quality.state.tier,'detailed');assert.equal(quality.state.shadows,true);assert.match(status.textContent,/Auto: Detailed/);
    assert.equal(saved,'auto');assert.equal(writes,0);
    for(let now=43000;now<45500;now+=40)quality.sample(now,true,true);
    assert.equal(quality.state.tier,'balanced');assert.equal(saved,'auto');assert.equal(writes,0);
  } finally {for(const key of keys)if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}
});

test('mobile holds quality at 24 FPS and above but downgrades sustained 23 FPS', () => {
  for (const initial of ['balanced','detailed']) for (const fps of [24,25,30]) {
    const controller=createAdaptiveQuality({allowDetailed:true}); let tier=initial, now=0;
    for(let i=0;i<480;i++) { now+=1000/fps; tier=controller.sample(now,true,tier,true,true)||tier; }
    assert.equal(tier,initial,`${initial} at ${fps} FPS`);
  }
  for (const initial of ['balanced','detailed']) {
    const controller=createAdaptiveQuality({allowDetailed:true}); let tier=initial, now=0;
    for(let i=0;i<300;i++) { now+=1000/23; tier=controller.sample(now,true,tier,true,true)||tier; }
    assert.notEqual(tier,initial,`${initial} at 23 FPS`);
  }
});

test('mobile Detailed tolerates both phases of uneven 24 FPS and an isolated stall', () => {
  for (const initial of ['balanced','detailed']) for (const phase of [0,1]) for (let spike=1;spike<250;spike++) {
    const controller=createAdaptiveQuality({allowDetailed:true}); let tier=initial, now=0;
    for(let i=0;i<320;i++) {
      now += i===spike ? 1000 : ((i+phase)%2===0 ? 1000/30 : 50);
      tier=controller.sample(now,true,tier,true,true)||tier;
    }
    assert.equal(tier,initial,`${initial} alternating phase ${phase}, spike ${spike}`);
  }
});

test('mobile promotion still needs sustained near-60 FPS movement and respects retry backoff', () => {
  const controller=createAdaptiveQuality({allowDetailed:true}); let tier='balanced',now=0;
  for(let i=0;i<600;i++){ now+=1000/30;tier=controller.sample(now,true,tier,true,true)||tier; }
  assert.equal(tier,'balanced');
  for(let i=0;i<1100;i++){ now+=1000/60;tier=controller.sample(now,true,tier,false,true)||tier; }
  assert.equal(tier,'balanced');
  for(let i=0;i<1100;i++){ now+=1000/60;tier=controller.sample(now,true,tier,true,true)||tier; }
  assert.equal(tier,'detailed');
  for(let i=0;i<60;i++){now+=1000/23;tier=controller.sample(now,true,tier,true,true)||tier;}
  assert.equal(tier,'balanced');
  for(let i=0;i<1000;i++){now+=1000/60;tier=controller.sample(now,true,tier,true,true)||tier;}
  assert.equal(tier,'balanced');
});

test('production detects width and coarse-pointer mobile mode only when resolving', () => {
  const keys=['document','window','navigator','localStorage'];
  const originals=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let quality, queryCount=0, width=900; const coarse={matches:true};
  const select={value:'',addEventListener(){}}; const status={textContent:''};
  try {
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:id=>id==='graphics-quality'?select:status}});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{devicePixelRatio:2,matchMedia:()=>{queryCount++;return coarse;}}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{hardwareConcurrency:8,deviceMemory:8}});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem(){}}});
    quality=createGraphicsQuality(()=>quality.resolve(width));quality.resolve(width);
    for(let now=0;now<10000;now+=40)quality.sample(now,true,true);
    assert.equal(quality.state.tier,'low', 'phones stay on Low in Auto');
    assert.equal(queryCount,1);
    coarse.matches=false; width=1440; quality.resolve(width);
    for(let now=10000;now<18000;now+=40)quality.sample(now,true,true);
    assert.equal(quality.state.tier,'low');
    assert.equal(queryCount,1);
  } finally {for(const key of keys)if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}
});

test('mobile rejects sustained uneven 23 FPS for either refresh phase', () => {
  for (const initial of ['balanced','detailed']) for (const phase of [0,1]) {
    const controller=createAdaptiveQuality({allowDetailed:true}); let tier=initial,now=0;
    for(let i=0;i<360;i++) {
      now+=(i+phase)%2===0 ? 1000/30 : 2*1000/23-1000/30;
      tier=controller.sample(now,true,tier,true,true)||tier;
    }
    assert.notEqual(tier,initial,`${initial} uneven 23 FPS, phase ${phase}`);
  }
});

test('650px width uses mobile policy without a coarse pointer', () => {
  const keys=['document','window','navigator','localStorage'];
  const originals=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let quality,width=650; const select={value:'',addEventListener(){}}; const status={textContent:''};
  try {
    Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:id=>id==='graphics-quality'?select:status}});
    Object.defineProperty(globalThis,'window',{configurable:true,value:{devicePixelRatio:2,matchMedia:()=>({matches:false})}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{hardwareConcurrency:8,deviceMemory:8}});
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem(){}}});
    quality=createGraphicsQuality(()=>quality.resolve(width));quality.resolve(width);
    for(let now=0;now<10000;now+=40)quality.sample(now,true,true);
    assert.equal(quality.state.tier,'low', 'phones stay on Low in Auto');
    width=651;quality.resolve(width);
    for(let now=10000;now<18000;now+=40)quality.sample(now,true,true);
    assert.equal(quality.state.tier,'low');
  } finally {for(const key of keys)if(originals[key])Object.defineProperty(globalThis,key,originals[key]);else delete globalThis[key];}
});

test('Auto on a phone stays on Low, while an explicit choice still applies', () => {
  assert.equal(resolveQuality({preference:'auto',width:393,dpr:3,mobile:true}).tier,'low');
  assert.equal(resolveQuality({preference:'auto',width:393,dpr:3,mobile:true,autoTier:'balanced'}).tier,'low');
  assert.equal(resolveQuality({preference:'auto',width:393,dpr:3,mobile:true}).pixelRatio,1);
  assert.equal(resolveQuality({preference:'balanced',width:393,dpr:3,mobile:true}).tier,'balanced');
  assert.equal(resolveQuality({preference:'auto',width:1440,dpr:2}).tier,'balanced');
});
