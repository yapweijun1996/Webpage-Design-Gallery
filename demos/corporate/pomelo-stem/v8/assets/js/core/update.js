// Versioned update button. Version SSOT: release.json. Nothing updates without a click.
import {t} from './i18n.js';
import {toast} from './toast.js';
import {confirm} from './dialog.js';
import {hasUnsavedInput} from './unsaved.js';
import {show as showLoader} from './loader.js';

const THROTTLE = 10 * 60 * 1000;
const TIMEOUT = 8000;
const APPLY_TIMEOUT = 12000;
const RELOAD_TIMEOUT = 3000;
let button;
let status;
let current;
let currentBuild;
let available = '';
let lastCheck = 0;
let busy = false;
let applying = false;

export function compare(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  }
  return 0;
}

export function isNewRelease(remote, local) {
  const order = compare(remote.version, local.version);
  return order > 0 || (order === 0 && remote.build !== local.build);
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
  if (busy || applying) return;
  busy = true;
  lastCheck = Date.now();
  setState('checking', t('update.checking'));
  try {
    const remote = await fetchRelease();
    if (isNewRelease(remote, {version: current, build: currentBuild})) {
      available = remote.version;
      setState('available', t('update.available', {version: available}));
      button.classList.remove('is-pulse');
      void button.offsetWidth;
      button.classList.add('is-pulse');
      toast({key: 'update', type: 'info', messageKey: 'toast.updateAvailable.title', detailKey: 'toast.updateAvailable.detail', vars: {version: available},
        action: {label: t('update.apply'), onClick: apply}});
    } else {
      setState('current', t('update.current', {version: current}));
      if (manual) toast({key: 'update', type: 'success', messageKey: 'toast.updateCurrent.title', detailKey: 'toast.updateCurrent.detail', vars: {version: current}});
      setTimeout(() => { if (button.dataset.state === 'current') setState('idle'); }, 3000);
    }
  } catch (error) {
    setState('error', t('update.error'));
    if (manual) toast({key: 'update', type: 'error', messageKey: 'toast.updateError.title', detailKey: 'toast.updateError.detail', action: {label: t('update.retry'), onClick: () => check({manual: true})}});
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
  if (applying) return;
  applying = true;
  let loaderOptions;
  let loader;
  let cancelled = false;
  let reloading = false;
  let reloadClaim;
  let claimTimer;
  let fail;
  function hideLoader() {
    const handle = loader;
    loader = null;
    handle?.close();
  }
  function releaseReload() {
    clearTimeout(claimTimer);
    if (reloadClaim && window.__pomeloV8Reloading === reloadClaim) delete window.__pomeloV8Reloading;
  }
  function cleanup() {
    clearTimeout(fail);
    navigator.serviceWorker?.removeEventListener('controllerchange', reload);
  }
  function failAttempt() {
    if (cancelled) return;
    cancelled = true;
    cleanup();
    applying = false;
    releaseReload();
    setState('error', t('update.error'));
    try { hideLoader(); } catch (error) { /* Still restore the update control if closing fails. */ }
    button.focus();
    toast({key: 'update', type: 'error', messageKey: 'toast.updateError.title', detailKey: 'toast.updateError.detail',
      action: {label: t('update.retry'), onClick: apply}});
  }
  async function reload() {
    if (cancelled || reloading) return;
    reloading = true;
    try {
      cleanup();
      // Consent must be usable above the loader; restore it only if consent is accepted.
      if (hasUnsavedInput()) hideLoader();
      if (!await canReload()) {
        hideLoader();
        cancelled = true;
        applying = false;
        available = available || current;
        setState('available', t('update.available', {version: available}));
        button.focus();
        return;
      }
      if (!cancelled) {
        if (!loader) loader = showLoader(loaderOptions);
        // Keep a watchdog in case navigation is blocked or reload throws.
        fail = setTimeout(failAttempt, APPLY_TIMEOUT);
        const claim = window.__pomeloV8Reloading;
        if (!(claim && Date.now() - claim.timestamp < RELOAD_TIMEOUT)) {
          reloadClaim = {owner: 'update', timestamp: Date.now()};
          window.__pomeloV8Reloading = reloadClaim;
          claimTimer = setTimeout(releaseReload, RELOAD_TIMEOUT);
          window.location.reload();
        }
      }
    } catch (error) {
      failAttempt();
    }
  }
  try {
    if (!await canReload()) { applying = false; return; }
    setState('applying', t('update.applying'));
    fail = setTimeout(failAttempt, APPLY_TIMEOUT);
    loaderOptions = {title: t('loader.updateTitle', {version: available || current}),
      detail: t('loader.updateDetail'), returnFocus: button};
    loader = showLoader(loaderOptions);
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration(root().href) : null;
    if (cancelled) return;
    if (!registration) { await reload(); return; }
    await registration.update();
    if (cancelled) return;
    const waiting = await waitForWaiting(registration);
    if (cancelled) return;
    if (!waiting) { await reload(); return; }
    navigator.serviceWorker.addEventListener('controllerchange', reload, {once: true});
    waiting.postMessage({type: 'SKIP_WAITING'});
  } catch (error) {
    failAttempt();
  }
}

async function canReload() {
  if (!hasUnsavedInput()) return true;
  return confirm({title: t('update.unsavedTitle'), body: t('update.unsavedBody'), confirmLabel: t('update.apply')});
}

export function init() {
  button = document.querySelector('[data-update]');
  status = document.querySelector('[data-update-status]');
  if (!button || !status) return;
  current = document.querySelector('meta[name="pomelo-version"]').content;
  currentBuild = document.querySelector('meta[name="pomelo-build"]').content;
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
