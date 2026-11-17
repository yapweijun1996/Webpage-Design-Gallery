/** Rendering policy only: downloads, scene content and simulation are unchanged. */
export const QUALITY_KEY = 'gjh-v11-graphics-quality-v1';
const CHOICES = new Set(['auto', 'low', 'balanced', 'detailed']);
export const qualityPreference = value => CHOICES.has(value) ? value : 'auto';

export function resolveQuality({preference = 'auto', width, dpr = 1, cores, memory, recovered = false, autoTier = null}) {
  const hint = value => Number.isFinite(value) && value > 0;
  const constrained = (hint(cores) && cores <= 2) || (hint(memory) && memory <= 2);
  const choice = qualityPreference(preference);
  // CPU/RAM hints do not establish GPU capacity; leave Detailed as an explicit choice.
  const tier = recovered ? 'low' : choice !== 'auto' ? choice : ['low','balanced','detailed'].includes(autoTier) ? autoTier : constrained ? 'low' : 'balanced';
  const cap = tier === 'low' ? 1 : tier === 'balanced' && width < 600 ? 1.25 : tier === 'balanced' && choice === 'auto' && width >= 1000 ? 1.5 : 2;
  return Object.freeze({preference: choice, tier, pixelRatio: Math.min(hint(dpr) ? dpr : 1, cap),
    shadows: tier === 'detailed' && width >= 1000, recovered});
}

// Sample continuous foreground rendering. Upgrades require representative
// movement; four-second windows and a cooldown prevent transient flapping.
export function createAdaptiveQuality({allowDetailed=false}={}) {
  const tiers=['low','balanced','detailed'];
  let last=null, warmUntil=0, start=0, count=0, slow=0, slowTime=0, fast=0, busy=0, goodWindows=0, changedAt=-Infinity;
  function reset() { last=null; start=0; count=slow=slowTime=fast=busy=goodWindows=0; }
  return {
    reset,
    sample(now, active, tier, moving=true) {
      if (!active || !Number.isFinite(now) || !tiers.includes(tier)) { reset(); return null; }
      if (last===null) { last=now; warmUntil=now+3000; return null; }
      const elapsed=now-last; last=now;
      // Explicit lifecycle interruptions reset the sampler; a long foreground
      // frame remains evidence, but cannot trigger a downgrade by itself.
      if (elapsed<=0) { reset(); return null; }
      if (now<warmUntil) return null;
      if (!count) start=now-elapsed;
      count++; if (elapsed>20) { slow++; slowTime+=Math.min(elapsed,4000); } if (elapsed<=18.5) fast++; if (moving) busy++;
      if (now-start<4000 || count<8) return null;
      const bad=slow>=3 && (slow/count>=.25 || slowTime/(now-start)>=.5), good=fast/count>=.9 && busy/count>=.5;
      goodWindows=good?goodWindows+1:0;
      count=slow=slowTime=fast=busy=0; start=0;
      const index=tiers.indexOf(tier);
      const ceiling=allowDetailed?2:1;
      const next=bad&&index>0?tiers[index-1]:goodWindows>=3&&now-changedAt>=10000&&index<ceiling?tiers[index+1]:null;
      if (next) { changedAt=now; reset(); return next; }
      return null;
    }
  };
}

export function createGraphicsQuality(onChange) {
  const select = document.getElementById('graphics-quality');
  const status = document.getElementById('graphics-quality-status');
  let preference = 'auto', recovered = false, profile, autoTier = null;
  const adaptive=createAdaptiveQuality();
  try { preference = qualityPreference(localStorage.getItem(QUALITY_KEY)); } catch { /* Optional preference storage. */ }
  select.value = preference;
  select.addEventListener('change', () => {
    preference = qualityPreference(select.value); recovered = false; autoTier=null; adaptive.reset();
    try { localStorage.setItem(QUALITY_KEY, preference); } catch { /* The selection still applies to this page. */ }
    onChange();
  });
  return {
    recover() { recovered = true; preference = 'low'; autoTier=null; adaptive.reset(); select.value = 'low'; },
    resetSampling() { adaptive.reset(); },
    sample(now, active, moving) {
      if (preference!=='auto' || recovered || !profile) { adaptive.reset(); return; }
      const next=adaptive.sample(now,active,profile.tier,moving);
      if (next) { autoTier=next; onChange(); }
    },
    resolve(width) {
      profile = resolveQuality({preference, width, dpr: window.devicePixelRatio,
        cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, recovered, autoTier});
      const name = profile.tier[0].toUpperCase() + profile.tier.slice(1);
      status.textContent = `${recovered ? 'Low after graphics recovery' : preference === 'auto' ? `Auto: ${name}` : name}. ${profile.shadows ? 'Real-time shadows on.' : 'Real-time shadows off.'} ${profile.tier === 'low' ? 'Softer image; less rendering work.' : 'Resolution follows the screen within a fixed limit.'}${preference === 'auto' && !recovered ? ' Auto currently uses up to Balanced; choose Detailed manually.' : ''} Downloads and products stay the same.`;
      return profile;
    },
    get state() { return profile; },
  };
}
