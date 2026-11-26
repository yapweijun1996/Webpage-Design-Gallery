// Versioned update button. Version SSOT: release.json. Nothing updates without a click.
import {t} from './i18n.js';
import {toast} from './toast.js';
import {confirm} from './dialog.js';

const THROTTLE = 10 * 60 * 1000;
const TIMEOUT = 8000;
const APPLY_TIMEOUT = 12000;
let button;
let status;
let current;
let available = '';
let lastCheck = 0;
let busy = false;

export function compare(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  }
  return 0;
}

function root() {
  const meta = document.querySelector('meta[name="pomelo-root"]');
  return new URL(meta ? meta.content : './', document.baseURI);
}

function setState(state, message) {
  button.dataset.state = state;
  button.disabled = state === 'applying';
  const version = state === 'available' ? available : current;
  button.querySelector('.update-button__chip').textContent = t('update.chip', {version});
  button.setAttribute('aria-label', state === 'available' ? t('update.apply') + ' · ' + t('update.available', {version: available}) : t('update.label', {version: current}));
  if (message !== undefined) status.textContent = message;
}

async function fetchRelease() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const url = new URL('release.json', root());
    url.searchParams.set('t', Date.now());
    const response = await fetch(url, {cache: 'no-store', signal: controller.signal});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function check({manual = false} = {}) {
  if (busy || button.dataset.state === 'applying') return;
  busy = true;
  lastCheck = Date.now();
  setState('checking', t('update.checking'));
  try {
    const remote = await fetchRelease();
    if (compare(remote.version, current) > 0) {
      available = remote.version;
      setState('available', t('update.available', {version: available}));
      button.classList.remove('is-pulse');
      void button.offsetWidth;
      button.classList.add('is-pulse');
      toast({type: 'info', message: t('update.available', {version: available}), sticky: true,
        action: {label: t('update.apply'), onClick: apply}});
    } else {
      setState('current', t('update.current', {version: current}));
      if (manual) toast({type: 'success', message: t('update.current', {version: current})});
      setTimeout(() => { if (button.dataset.state === 'current') setState('idle'); }, 3000);
    }
  } catch (error) {
    setState('error', t('update.error'));
    if (manual) toast({type: 'error', message: t('update.error'), action: {label: t('update.retry'), onClick: () => check({manual: true})}});
  } finally {
    busy = false;
  }
}

function waitForWaiting(registration) {
  if (registration.waiting) return Promise.resolve(registration.waiting);
  return new Promise((resolve) => {
    const worker = registration.installing;
    if (!worker) { resolve(null); return; }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') resolve(registration.waiting || worker);
      if (worker.state === 'redundant') resolve(null);
    });
  });
}

export async function apply() {
  if (button.dataset.state === 'applying') return;
  const dirty = document.querySelector('[data-dirty="true"]');
  if (dirty) {
    const ok = await confirm({title: t('update.unsavedTitle'), body: t('update.unsavedBody'), confirmLabel: t('update.apply')});
    if (!ok) return;
  }
  setState('applying', t('update.applying'));
  const fail = setTimeout(() => setState('error', t('update.error')), APPLY_TIMEOUT);
  let reloaded = false;
  const reload = () => { if (!reloaded) { reloaded = true; clearTimeout(fail); window.location.reload(); } };
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration(root().href) : null;
    if (!registration) { reload(); return; }
    await registration.update();
    const waiting = await waitForWaiting(registration);
    if (!waiting) { reload(); return; }
    navigator.serviceWorker.addEventListener('controllerchange', reload, {once: true});
    waiting.postMessage({type: 'SKIP_WAITING'});
  } catch (error) {
    clearTimeout(fail);
    setState('error', t('update.error'));
  }
}

export function init() {
  button = document.querySelector('[data-update]');
  status = document.querySelector('[data-update-status]');
  if (!button || !status) return;
  current = document.querySelector('meta[name="pomelo-version"]').content;
  setState('idle');
  button.addEventListener('click', () => {
    if (button.dataset.state === 'available') apply();
    else check({manual: true});
  });
  if (location.protocol.startsWith('http')) {
    setTimeout(() => check(), 1500);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > THROTTLE) check();
    });
  }
}
