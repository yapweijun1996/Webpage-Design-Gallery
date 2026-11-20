import {startStartupPack, startupPackBytes} from './startup-asset-pack.js';
import {physicsBytes, startPhysics} from './startup-physics.js';
import {setupDemoBag} from './demo-bag.js';
import {icon} from './icons.js';
import {mallAudio} from './audio.js';
import {browserDeviceClass, resolveQuality, savedQualityPreference} from './graphics-quality.js';

// Each unit is a completed startup milestone, not an estimate of bytes or time.
const stages = ['physics', 'scene', 'models', 'frame', 'warm'];
// mall-language.js owns the selected language and publishes it on <html>.
const details = {
  en:['Preparing the mall details…', 'Details'],
  'zh-Hans':['正在准备商场细节…', '细节'],
  ms:['Menyediakan butiran pusat beli-belah…', 'Butiran']
};
const messages = [
  'Starting the physics engine…',
  'Building the mall scene…',
  'Preparing the visitor and models…',
  'Rendering the first scene…',
  details.en[0],
  'The mall is ready.'
];

export function loaderLabels(state, language) {
  const [status, step] = details[language] ?? details.en;
  return {
    status:state.message === details.en[0] ? status : state.message,
    lastStep:step
  };
}

export function createLoaderState(onChange = () => {}) {
  let completed = 0, hidden = false, contextLost = false, failed = false, dismissed = false, immediate = false;
  const skip = new AbortController();
  let downloads = null;
  const snapshot = () => ({completed, total: stages.length, hidden, contextLost, failed, dismissed, immediate,
    downloads, stage: stages[completed], ready: completed === stages.length,
    preparing: stages[completed] === 'warm',
    message: failed || (completed === stages.length ? messages.at(-1) :
      contextLost ? 'Graphics were interrupted. Waiting for recovery…' :
      hidden ? 'Loading is paused until this tab is visible.' : messages[completed])});
  const notify = () => { const state = snapshot(); onChange(state); return state; };
  return {
    snapshot, skipSignal:skip.signal,
    get ready() { return completed === stages.length; },
    complete(stage, skipFade = false) {
      if (!failed && stage === stages[completed] && (!['frame','warm'].includes(stage) || (!hidden && !contextLost))) {
        completed++;
        if (stage === 'warm') immediate = skipFade;
      }
      return notify();
    },
    enterNow() { if (snapshot().preparing && !failed) skip.abort('enter-now'); },
    download(value) { downloads = value; return notify(); },
    visibility(value) { hidden = Boolean(value); return notify(); },
    context(value) { contextLost = Boolean(value); return notify(); },
    fail(message) { if (completed < stages.length) failed = message; return notify(); },
    dismiss() { dismissed = true; skip.abort('directory'); return notify(); }
  };
}

export function bindLoaderAudioGestures(root, overlay, enterNow, audio = mallAudio) {
  const prepare = event => {
    if (event.isTrusted && !root.hidden) audio.prepareForLoader();
  };
  root.getElementById('arrival-walk').addEventListener('click', prepare);
  enterNow.addEventListener('click', event => {
    if (!overlay.hidden && !enterNow.hidden) prepare(event);
  });
  for (const type of ['pointerdown', 'touchstart']) root.addEventListener(type, event => {
    if (root.body.hasAttribute('data-arrivals')) prepare(event);
  }, {capture:true, passive:true});
}

// This module is also loaded independently of the main application bundle so a
// failed startup import can leave the static directory and retry controls usable.
if (typeof document !== 'undefined') {
  const overlay = document.getElementById('app-loader');
  const status = document.getElementById('loader-status');
  const progress = document.getElementById('loader-progress');
  const count = document.getElementById('loader-count');
  const steps = [...document.querySelectorAll('.app-loader-steps li')];
  const retry = document.getElementById('loader-retry');
  const enterNow = document.getElementById('loader-enter-now');
  const motion = document.getElementById('loader-motion');
  const directory = document.getElementById('loader-directory');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const deviceClass = browserDeviceClass();
  const {tier} = resolveQuality({deviceClass, preference:savedQualityPreference(),
    width:innerWidth, cores:navigator.hardwareConcurrency, memory:navigator.deviceMemory});
  mallAudio.setPolicy(deviceClass === 'phone', tier === 'low', reduced.matches || navigator.connection?.saveData === true);
  bindLoaderAudioGestures(document, overlay, enterNow);
  const detailsStep = steps.find(step => step.dataset.stage === 'warm');
  let lastProgress;
  let fadeTimer, restoreFocus = false, previousStatus, previousStep;
  const motionKey = 'gjh-v11-loader-motion-paused';
  let userPaused = false;
  try { userPaused = sessionStorage.getItem(motionKey) === 'true'; } catch { /* Use this page's preference. */ }
  function renderMotion(value) {
    overlay.toggleAttribute('data-pending-motion', !value.failed && !value.ready && !value.dismissed && !value.contextLost);
    overlay.toggleAttribute('data-motion-paused', Boolean(userPaused || value.hidden || value.contextLost || value.failed));
    const hidden = reduced.matches || Boolean(value.failed);
    if (hidden && document.activeElement === motion) (value.failed ? retry : directory).focus({preventScroll:true});
    motion.hidden = hidden;
  }
  function motionLabel() {
    motion.textContent = userPaused ? 'Resume motion' : 'Pause motion';
  }
  function renderText(value) {
    const labels = loaderLabels(value, document.documentElement.lang);
    if (previousStatus !== labels.status) {
      status.textContent = labels.status;
      previousStatus = labels.status;
    }
    if (previousStep !== labels.lastStep) {
      detailsStep.textContent = labels.lastStep;
      previousStep = labels.lastStep;
    }
  }
  const state = createLoaderState(value => {
    renderText(value);
    overlay.toggleAttribute('data-failed', Boolean(value.failed));
    if (overlay.dataset.completed !== String(value.completed)) {
      overlay.dataset.completed = value.completed;
      steps.forEach((step, index) => {
        step.dataset.state = index < value.completed ? 'done' : index === value.completed ? 'current' : 'todo';
      });
    }
    const transfer = value.completed < 2 && !value.failed ? value.downloads : null;
    const [loaded, total] = transfer ?? [value.completed, value.total];
    const mb = bytes => (bytes / 1_000_000).toFixed(1);
    const label = transfer ? `${mb(loaded)} of ${mb(total)} MB` : `${loaded} / ${total}`;
    if (label !== lastProgress) {
      lastProgress = label;
      count.textContent = label;
    }
    progress.max = total;
    progress.value = loaded;
    progress.textContent = transfer ? label : `${loaded} of ${total} stages`;
    overlay.style.setProperty('--loader-progress', Math.min(1, loaded / total));
    // Hiding Enter now can move focus to the body before the fade completes.
    if (value.ready && overlay.contains(document.activeElement)) restoreFocus = true;
    retry.hidden = !value.failed;
    renderMotion(value);
    enterNow.hidden = !value.preparing || Boolean(value.failed || value.hidden || value.contextLost);
    if (value.dismissed) {
      clearTimeout(fadeTimer);
      overlay.hidden = true;
    } else if (value.ready && !value.hidden && !value.contextLost && !value.failed && !overlay.hidden) {
      overlay.classList.add('is-fading');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        const active = document.activeElement;
        if (overlay.contains(active) || (restoreFocus && active === document.body))
          (document.querySelector('#experience:not([hidden]) #scene') || document.getElementById('store-list')).focus({preventScroll: true});
        overlay.hidden = true;
      }, value.immediate || reduced.matches || userPaused ? 0 : 250);
    } else if (!overlay.hidden) {
      clearTimeout(fadeTimer);
      overlay.classList.remove('is-fading');
    }
  });
  state.visibility(document.hidden);
  motionLabel();
  motion.addEventListener('click', () => {
    userPaused = !userPaused;
    try { sessionStorage.setItem(motionKey, String(userPaused)); } catch { /* Use this page's preference. */ }
    motionLabel();
    renderMotion(state.snapshot());
  });
  reduced.addEventListener('change', () => renderMotion(state.snapshot()));
  new MutationObserver(() => renderText(state.snapshot())).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  document.addEventListener('visibilitychange', () => state.visibility(document.hidden));
  enterNow.addEventListener('click', () => state.enterNow());
  directory.addEventListener('click', () => {
    state.dismiss();
    document.getElementById('store-list').focus({preventScroll: true});
  });
  window.mallLoader = state;
  // The 3D mall is a game surface: block text selection and the touch long-press callout, but keep form fields usable.
  const experienceRoot = document.getElementById('experience');
  const isField = event => Boolean((event.target.parentElement || event.target).closest?.('input,textarea,select,[contenteditable]'));
  experienceRoot?.addEventListener('selectstart', event => { if (!isField(event)) event.preventDefault(); });
  experienceRoot?.addEventListener('contextmenu', event => { if (matchMedia('(pointer: coarse)').matches && !isField(event)) event.preventDefault(); });
  const entrance = document.getElementById('mall-arrivals');
  const header = document.querySelector('.site-header');
  const secondary = document.querySelector('.site-secondary');
  const tabs = secondary.querySelector('.site-tabs');
  const homeTab = tabs.querySelector('[href="#mall-arrivals"]');
  const shopsTab = tabs.querySelector('[href="#store-list"]');
  const wordmark = header.querySelector('.wordmark');
  const settings = secondary.querySelector('.site-settings');
  const compactHeader = matchMedia('(max-width: 650px)');
  function placeHeaderControls() {
    const active = document.activeElement;
    const restoreFocus = tabs.contains(active) || settings.contains(active);
    if (compactHeader.matches) secondary.append(tabs, settings);
    else {
      wordmark.after(tabs);
      header.querySelector('#bag-open').before(settings);
    }
    secondary.hidden = !compactHeader.matches;
    if (restoreFocus) active.focus({preventScroll: true});
  }
  for (const target of settings.querySelectorAll('.site-theme-icon')) target.append(icon('theme', {size:18}));
  setupDemoBag();
  placeHeaderControls();
  compactHeader.addEventListener('change', placeHeaderControls);
  for (const link of [wordmark, homeTab]) link.addEventListener('click', event => {
    if (location.hash === link.hash && document.body.hasAttribute('data-arrivals') &&
        !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      window.scrollTo({top: 0, behavior: 'instant'});
    }
  });
  document.documentElement.classList.add('mall-routing');
  let entryMode = 'arrivals';
  let directoryWithinWalk = false;
  let directoryMounted = false;
  let pendingReturn;
  function route() {
    const hash = location.hash;
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    const mode = !hash || target === entrance ? 'arrivals' :
      hash === '#experience' || hash === '#scene' ? 'walk' :
      target && document.getElementById('store-list').contains(target) ? 'directory' : null;
    pendingReturn?.disconnect();
    if (mode === 'walk' && entryMode === 'walk' && directoryWithinWalk) {
      directoryWithinWalk = false;
      const toggle = document.getElementById('view-toggle');
      const returnToWalk = () => {
        if (toggle.hidden || !document.getElementById('experience').hidden) return;
        toggle.click();
        document.getElementById('scene').focus();
        pendingReturn?.disconnect();
      };
      if (toggle.hidden) {
        pendingReturn = new MutationObserver(returnToWalk);
        pendingReturn.observe(toggle, {attributes:true, attributeFilter:['hidden']});
      }
      returnToWalk();
      return;
    }
    if (!mode) return;
    const arrivals = mode === 'arrivals';
    (arrivals ? shopsTab : homeTab).removeAttribute('aria-current');
    (arrivals ? homeTab : shopsTab).setAttribute('aria-current', 'page');
    if (mode === entryMode) {
      if (arrivals && hash) window.scrollTo({top: 0, behavior: 'instant'});
      return;
    }
    if (mode === 'arrivals' && entryMode === 'directory') {
      // The directory has no active renderer. Its return need not reload the document.
      entryMode = 'arrivals';
      document.body.setAttribute('data-arrivals','');
      delete document.body.dataset.entryMode;
      entrance.hidden = false;
      document.getElementById('arrival-products').focus({preventScroll:true});
      window.scrollTo(0,0);
      return;
    }
    if (mode === 'walk' && directoryMounted) { location.reload(); return; }
    // A mode switch from a running document releases its renderer and resets the loader.
    // Keeping the fragment lets native Back, Forward and the existing Retry button replay the choice.
    if (entryMode === 'walk' && mode === 'directory') {
      // Dismissing a partially loaded world keeps its preload queue and progress.
      directoryWithinWalk = true;
      state.dismiss();
      const toggle = document.getElementById('view-toggle');
      if (document.getElementById('store-list').hidden && !toggle.hidden) toggle.click();
      target.focus({preventScroll:true});
      target.scrollIntoView({block:'start'});
      return;
    }
    if (entryMode !== 'arrivals') { location.reload(); return; }
    entryMode = mode;
    entrance.hidden = true;
    document.body.removeAttribute('data-arrivals');
    document.body.dataset.entryMode = mode;
    if (mode === 'directory') {
      state.dismiss();
      if (directoryMounted) {
        const search = document.getElementById('product-search');
        search.value = '';
        document.getElementById('product-category').value = 'all';
        document.querySelector('[data-store-filter="all"]')?.click();
        search.dispatchEvent(new Event('input', {bubbles:true}));
      }
      target.focus({preventScroll:true});
      target.scrollIntoView({block:'start'});
    } else {
      overlay.hidden = false;
      document.getElementById('loader-directory').focus();
      const pack = [0, startupPackBytes], physics = [0, physicsBytes];
      const report = (entry, loaded, total) => {
        entry[0] = loaded;
        entry[1] = total;
        state.download([pack[0] + physics[0], pack[1] + physics[1]]);
      };
      report(pack, ...pack);
      startPhysics((loaded, total) => report(physics, loaded, total));
      startStartupPack((loaded, total) => report(pack, loaded, total));
      const hints = document.getElementById('walk-preloads');
      if (hints) document.head.append(hints.content.cloneNode(true));
    }
    import('../script.bundle.js').then(() => {
      // Initial catalog sorting can move the focused card. Restore focus only while the visitor is still at entry.
      if (mode === 'directory') directoryMounted = true;
      if (entryMode === 'directory' && (document.activeElement === document.body || document.activeElement === target))
        target.focus({preventScroll:true});
    }).catch(() => {
      state.fail('The 3D mall could not start. Retry or browse the store directory.');
      if (overlay.hidden) window.dispatchEvent(new Event('mall-loader-failed'));
    });
  }
  window.addEventListener('hashchange', route);
  route();
}
