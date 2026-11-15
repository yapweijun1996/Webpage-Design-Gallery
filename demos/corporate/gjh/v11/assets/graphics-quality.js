/** Rendering policy only: downloads, scene content and simulation are unchanged. */
export const QUALITY_KEY = 'gjh-v11-graphics-quality-v1';
const CHOICES = new Set(['auto', 'low', 'balanced', 'detailed']);
export const qualityPreference = value => CHOICES.has(value) ? value : 'auto';

export function resolveQuality({preference = 'auto', width, dpr = 1, cores, memory, recovered = false}) {
  const hint = value => Number.isFinite(value) && value > 0;
  const constrained = (hint(cores) && cores <= 2) || (hint(memory) && memory <= 2);
  const capable = hint(cores) && cores >= 4 && hint(memory) && memory >= 4;
  const choice = qualityPreference(preference);
  const tier = recovered ? 'low' : choice !== 'auto' ? choice : constrained ? 'low' : width >= 1000 && capable ? 'detailed' : 'balanced';
  const cap = tier === 'low' ? 1 : tier === 'balanced' && width < 600 ? 1.25 : 2;
  return Object.freeze({preference: choice, tier, pixelRatio: Math.min(hint(dpr) ? dpr : 1, cap),
    shadows: tier === 'detailed' && width >= 1000, recovered});
}

export function createGraphicsQuality(onChange) {
  const select = document.getElementById('graphics-quality');
  const status = document.getElementById('graphics-quality-status');
  let preference = 'auto', recovered = false, profile;
  try { preference = qualityPreference(localStorage.getItem(QUALITY_KEY)); } catch { /* Optional preference storage. */ }
  select.value = preference;
  select.addEventListener('change', () => {
    preference = qualityPreference(select.value); recovered = false;
    try { localStorage.setItem(QUALITY_KEY, preference); } catch { /* The selection still applies to this page. */ }
    onChange();
  });
  return {
    recover() { recovered = true; preference = 'low'; select.value = 'low'; },
    resolve(width) {
      profile = resolveQuality({preference, width, dpr: window.devicePixelRatio,
        cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, recovered});
      const name = profile.tier[0].toUpperCase() + profile.tier.slice(1);
      status.textContent = `${recovered ? 'Low after graphics recovery' : preference === 'auto' ? `Auto: ${name}` : name}. ${profile.shadows ? 'Real-time shadows on.' : 'Real-time shadows off.'} ${profile.tier === 'low' ? 'Softer image; less rendering work.' : 'Resolution follows the screen within a fixed limit.'} Downloads and products stay the same.`;
      return profile;
    },
    get state() { return profile; },
  };
}
