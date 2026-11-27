// Hero 3D scene: the photo stays as the poster and the no-JS / reduced-motion / slow-network fallback.
// The viewer (three.js + 7 GLB modules, ~3 MB) loads only when the hero is visible, the page is idle and
// the connection looks good enough. Otherwise a button lets the visitor ask for it.
const DEFAULT_DELAY = 1200;

function poorConnection() {
  const connection = navigator.connection;
  return Boolean(connection && (connection.saveData || /(^|-)2g$|^3g$/.test(connection.effectiveType || '')));
}

export function init() {
  const stage = document.querySelector('[data-hero3d]');
  if (!stage) return;
  const base = stage.dataset.hero3d;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let session;
  let started = false;
  let controller;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hero3d__button button button--secondary button--small';
  button.textContent = stage.dataset.load || '';
  button.hidden = true;
  const status = document.createElement('p');
  status.className = 'hero3d__status';
  status.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'hero3d__hint';
  hint.hidden = true;
  hint.textContent = stage.dataset.hint || '';

  function setState(state) {
    stage.dataset.state = state;
    stage.setAttribute('aria-busy', String(state === 'loading'));
  }

  async function start() {
    if (started) return;
    started = true;
    button.hidden = true;
    status.textContent = stage.dataset.loading || '';
    setState('loading');
    controller = new AbortController();
    try {
      const viewer = await import('../hero3d/viewer.js');
      if (!viewer.webglAvailable()) throw new Error('WebGL unavailable');
      session = await viewer.mount(stage, { base, signal: controller.signal });
      status.textContent = '';
      hint.hidden = false;
      setState('ready');
      stage.querySelector('img')?.setAttribute('aria-hidden', 'true');
    } catch (error) {
      if (controller.signal.aborted) return;
      session?.dispose();
      started = false;
      status.textContent = stage.dataset.failed || '';
      button.hidden = false;
      setState('idle');
    }
  }

  stage.addEventListener('hero3d:lost', () => {
    controller?.abort();
    session?.dispose();
    started = false;
    hint.hidden = true;
    stage.querySelector('img')?.removeAttribute('aria-hidden');
    status.textContent = stage.dataset.failed || '';
    button.hidden = false;
    setState('idle');
  });
  button.addEventListener('click', () => { status.textContent = ''; void start(); });
  stage.append(status, hint, button);
  setState('idle');

  if (reduced.matches || poorConnection() || !window.IntersectionObserver) {
    button.hidden = false;
    return;
  }
  const arm = () => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const run = () => void start();
      if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
      else window.setTimeout(run, DEFAULT_DELAY);
    });
    observer.observe(stage);
  };
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', () => window.setTimeout(arm, DEFAULT_DELAY), { once: true });
}
