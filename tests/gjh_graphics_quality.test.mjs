import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveQuality, qualityPreference} from '../demos/corporate/gjh/v11/assets/graphics-quality.js';

test('Auto separates constrained, missing and capable hardware deterministically', () => {
  const fixtures = [
    [{cores:2,memory:8}, 'low'], [{cores:8,memory:2}, 'low'],
    [{cores:4,memory:4}, 'detailed'], [{cores:8}, 'balanced'],
    [{memory:8}, 'balanced'], [{}, 'balanced'],
    [{cores:0,memory:NaN}, 'balanced'], [{cores:Infinity,memory:8}, 'balanced'],
  ];
  for (const [hardware, wide] of fixtures) for (const width of [320,390,599,600,650,651,667,768,844,999,1000,1001,1440]) {
    const p = resolveQuality({width,dpr:3,...hardware});
    const tier = wide === 'detailed' && width < 1000 ? 'balanced' : wide;
    assert.equal(p.tier, tier, JSON.stringify({hardware,width}));
    assert.equal(p.pixelRatio, tier === 'low' ? 1 : tier === 'balanced' && width < 600 ? 1.25 : 2);
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
