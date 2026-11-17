// Each unit is a completed startup milestone, not an estimate of bytes or time.
const stages = ['physics', 'scene', 'models', 'frame'];
const messages = [
  'Starting the physics engine…',
  'Building the mall scene…',
  'Preparing the visitor and models…',
  'Rendering the first scene…',
  'The mall is ready.'
];

export function createLoaderState(onChange = () => {}) {
  let completed = 0, hidden = false, contextLost = false, failed = false, dismissed = false, preparation = null;
  const snapshot = () => ({completed, total: stages.length, hidden, contextLost, failed, dismissed,
    ready: completed === stages.length, preparing: Boolean(preparation) && completed < stages.length, message: failed || (completed === stages.length ? messages[4] :
      contextLost ? 'Graphics were interrupted. Waiting for recovery…' :
      hidden ? 'Loading is paused until this tab is visible.' : preparation || messages[completed])});
  const notify = () => { const state = snapshot(); onChange(state); return state; };
  return {
    snapshot,
    complete(stage) {
      if (!failed && stage === stages[completed] && (stage !== 'frame' || (!hidden && !contextLost))) completed++;
      return notify();
    },
    prepare(value) { preparation = value; return notify(); },
    visibility(value) { hidden = Boolean(value); return notify(); },
    context(value) { contextLost = Boolean(value); return notify(); },
    fail(message) { if (completed < stages.length) failed = message; return notify(); },
    dismiss() { dismissed = true; return notify(); }
  };
}

// This module is also loaded independently of the main application bundle so a
// failed startup import can leave the static directory and retry controls usable.
if (typeof document !== 'undefined') {
  const overlay = document.getElementById('app-loader');
  const status = document.getElementById('loader-status');
  const progress = document.getElementById('loader-progress');
  const count = document.getElementById('loader-count');
  const retry = document.getElementById('loader-retry');
  const enterNow = document.getElementById('loader-enter-now');
  let fadeTimer;
  const state = createLoaderState(value => {
    status.textContent = value.message;
    progress.value = value.completed;
    progress.textContent = `${value.completed} of ${value.total} stages`;
    count.textContent = `${value.completed} / ${value.total}`;
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
  document.addEventListener('visibilitychange', () => state.visibility(document.hidden));
  retry.addEventListener('click', () => location.reload());
  enterNow.addEventListener('click', () => state.complete('frame'));
  document.getElementById('loader-directory').addEventListener('click', () => {
    state.dismiss();
    document.getElementById('store-list').focus({preventScroll: true});
  });
  window.mallLoader = state;
  import('../script.bundle.js').catch(() => state.fail('The 3D mall could not start. Retry or browse the store directory.'));
}
