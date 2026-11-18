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
    lastStep:state.stage === 'warm' || state.ready ? step : null
  };
}

export function createLoaderState(onChange = () => {}) {
  let completed = 0, hidden = false, contextLost = false, failed = false, dismissed = false, preparation = null;
  const skip = new AbortController();
  const snapshot = () => ({completed, total: stages.length, hidden, contextLost, failed, dismissed,
    stage: stages[completed], ready: completed === stages.length,
    preparing: (Boolean(preparation) || stages[completed] === 'warm') && completed < stages.length,
    message: failed || (completed === stages.length ? messages.at(-1) :
      contextLost ? 'Graphics were interrupted. Waiting for recovery…' :
      hidden ? 'Loading is paused until this tab is visible.' : preparation || messages[completed])});
  const notify = () => { const state = snapshot(); onChange(state); return state; };
  return {
    snapshot, skipSignal:skip.signal,
    get ready() { return completed === stages.length; },
    complete(stage) {
      if (!failed && stage === stages[completed] && (!['frame','warm'].includes(stage) || (!hidden && !contextLost))) {
        completed++;
        preparation = null;
      }
      return notify();
    },
    enterNow() { if (snapshot().preparing && !failed) skip.abort('enter-now'); },
    prepare(value) { preparation = value; return notify(); },
    visibility(value) { hidden = Boolean(value); return notify(); },
    context(value) { contextLost = Boolean(value); return notify(); },
    fail(message) { if (completed < stages.length) failed = message; return notify(); },
    dismiss() { dismissed = true; skip.abort('directory'); return notify(); }
  };
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
  const fill = document.getElementById('loader-fill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let fadeTimer, shown = 0, goal = 0, stageStart = performance.now(), raf = 0, last = {completed: 0, total: stages.length};
  // Milestones are real, so the fill eases toward the next one and creeps up to 90% of the gap while it works.
  // It never claims a stage before the stage completes.
  function frame(now) {
    raf = 0;
    const {completed, total, failed, hidden: paused} = last;
    const ready = completed === total;
    const creep = ready || failed || reduced.matches ? 0 : 0.9 * (1 - Math.exp(-(now - stageStart) / 5000));
    goal = Math.min(100, (completed + creep) / total * 100);
    shown = reduced.matches ? goal : shown + (goal - shown) * 0.12;
    if (Math.abs(goal - shown) < 0.05) shown = goal;
    fill.style.width = `${shown.toFixed(2)}%`;
    if (!overlay.hidden && !paused && !failed && (shown !== goal || !ready)) raf = requestAnimationFrame(frame);
  }
  const drive = value => { if (value.completed !== last.completed) stageStart = performance.now(); last = value; if (!raf) raf = requestAnimationFrame(frame); };
  const firstView = steps.at(-1);
  function renderText(value) {
    const labels = loaderLabels(value, document.documentElement.lang);
    status.textContent = labels.status;
    if (labels.lastStep) firstView.textContent = labels.lastStep;
  }
  const state = createLoaderState(value => {
    renderText(value);
    progress.max = value.total;
    progress.value = value.completed;
    progress.textContent = `${value.completed} of ${value.total} stages`;
    count.textContent = `${value.completed} / ${value.total}`;
    drive(value);
    // First view and Details share the last column on narrow screens.
    const segment = value.ready ? steps.length : Math.min(value.completed, steps.length - 1);
    steps.forEach((step, index) => { step.dataset.state = index < segment ? 'done' : index === segment && !value.failed ? 'current' : 'todo'; });
    retry.hidden = !value.failed;
    enterNow.hidden = !value.preparing || Boolean(value.failed);
    if (value.dismissed) {
      clearTimeout(fadeTimer);
      overlay.hidden = true;
    } else if (value.ready && !value.hidden && !value.contextLost && !value.failed && !overlay.hidden) {
      overlay.classList.add('is-fading');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        if (overlay.contains(document.activeElement))
          (document.querySelector('#experience:not([hidden]) #scene') || document.getElementById('store-list')).focus({preventScroll: true});
        overlay.hidden = true;
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250);
    } else if (!overlay.hidden) {
      clearTimeout(fadeTimer);
      overlay.classList.remove('is-fading');
    }
  });
  state.visibility(document.hidden);
  new MutationObserver(() => renderText(state.snapshot())).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  document.addEventListener('visibilitychange', () => state.visibility(document.hidden));
  retry.addEventListener('click', () => location.reload());
  enterNow.addEventListener('click', () => state.enterNow());
  document.getElementById('loader-directory').addEventListener('click', () => {
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
    if (!mode || mode === entryMode) return;
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
    }
    import('../script.bundle.js').then(() => {
      // Initial catalog sorting can move the focused card. Restore focus only while the visitor is still at entry.
      if (mode === 'directory') directoryMounted = true;
      if (entryMode === 'directory' && (document.activeElement === document.body || document.activeElement === target))
        target.focus({preventScroll:true});
    }).catch(() => state.fail('The 3D mall could not start. Retry or browse the store directory.'));
  }
  window.addEventListener('hashchange', route);
  route();
}
