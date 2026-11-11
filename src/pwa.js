const root = new URL('../', import.meta.url);
const current = {
  version: document.querySelector('meta[name="app-version"]').content,
  build: document.querySelector('meta[name="app-build"]').content,
};
const checkButton = document.querySelector('#check-update');
const applyButton = document.querySelector('#apply-update');
const notice = document.querySelector('#update-notice');
const status = document.querySelector('#app-status');
const dialog = document.querySelector('#update-dialog');
const progress = document.querySelector('#update-progress');
const closeButton = document.querySelector('#close-update');
const chrome = document.querySelector('.app-chrome');
const topButton = document.querySelector('#scroll-top');
let registration;
let target;
let applying = false;
let checking = false;
let lastCheck = 0;
let activationTimeout;
let installPrompt;
const label = (release) => 'v' + release.version + ' · ' + release.build.slice(0, 8);

function workerVersion(worker) {
  return new Promise((resolve, reject) => {
    if (!worker) return reject(new Error('No update worker'));
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Version unavailable')); }, 3000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timeout); channel.port1.close();
      if (typeof data?.version === 'string' && typeof data?.build === 'string') resolve(data);
      else reject(new Error('Invalid version'));
    };
    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

async function offerUpdate(worker) {
  try {
    const release = await workerVersion(worker);
    if (release.build === current.build) return;
    target = release;
    document.querySelector('#update-message').textContent = 'New version ready: ' + label(release) + '. This page stays open until you choose to update.';
    applyButton.textContent = 'Update to ' + label(release);
    notice.hidden = false;
    chrome.classList.remove('is-hidden');
    status.textContent = 'Update available · ' + label(current) + ' → ' + label(release);
  } catch {
    status.textContent = 'An update was detected, but its version is unavailable. Check again shortly.';
  }
}

function settled(worker) {
  if (!worker || ['installed', 'activated'].includes(worker.state)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Update timed out')); }, 20000);
    function cleanup() { clearTimeout(timeout); worker.removeEventListener('statechange', changed); }
    function changed() {
      if (['installed', 'activated'].includes(worker.state)) { cleanup(); resolve(); }
      else if (worker.state === 'redundant') { cleanup(); reject(new Error('Update integrity check failed')); }
    }
    worker.addEventListener('statechange', changed);
    changed();
  });
}

async function checkUpdates(manual = false) {
  if (!registration || checking || applying) return;
  if (!manual && Date.now() - lastCheck < 10 * 60 * 1000) return;
  checking = true; lastCheck = Date.now(); checkButton.disabled = true;
  checkButton.textContent = 'Checking…';
  if (manual) status.textContent = 'Checking for a verified release…';
  try {
    await registration.update();
    await settled(registration.installing);
    if (registration.waiting) { await offerUpdate(registration.waiting); return; }
    const active = registration.active && await workerVersion(registration.active);
    if (active && active.build !== current.build) { await offerUpdate(registration.active); return; }
    const response = await fetch(new URL('version.json?check=' + Date.now(), root), { cache: 'no-store' });
    if (!response.ok) throw new Error('Release information unavailable');
    const latest = await response.json();
    status.textContent = latest.build === current.build
      ? 'Up to date · ' + label(current)
      : 'A new release is publishing. Its files are not ready yet; check again shortly.';
  } catch {
    status.textContent = navigator.onLine
      ? 'The update could not be verified. Your current version is safe; try again shortly.'
      : 'Offline · Reconnect to check for updates. Current version: ' + label(current);
  } finally {
    checking = false; checkButton.disabled = false; checkButton.textContent = 'Check updates';
  }
}

function updateFailed() {
  clearTimeout(activationTimeout); applying = false;
  progress.textContent = 'The update could not finish. Close this message and try again; your current page is still available.';
  closeButton.hidden = false; applyButton.disabled = false; checkButton.disabled = false;
  dialog.classList.add('has-error');
}

async function reloadVerifiedController() {
  try {
    const release = await workerVersion(navigator.serviceWorker.controller);
    if (!target || release.build !== target.build) throw new Error('Unexpected active version');
    clearTimeout(activationTimeout);
    progress.textContent = 'Reloading ' + label(release) + '…';
    requestAnimationFrame(() => location.reload());
  } catch { updateFailed(); }
}

applyButton.addEventListener('click', async () => {
  if (applying || !target || !registration) return;
  applying = true; applyButton.disabled = true; checkButton.disabled = true;
  closeButton.hidden = true; dialog.classList.remove('has-error');
  progress.textContent = 'Installing ' + label(target) + '… Your current URL will be preserved.';
  dialog.showModal();
  activationTimeout = setTimeout(updateFailed, 20000);
  try {
    if (registration.waiting) {
      const verified = await workerVersion(registration.waiting);
      if (verified.build !== target.build) throw new Error('Waiting version changed');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      await reloadVerifiedController();
    }
  } catch { updateFailed(); }
});
dialog.addEventListener('cancel', (event) => { if (applying) event.preventDefault(); });
closeButton.addEventListener('click', () => { dialog.close(); applyButton.focus(); });

function connectionState() {
  document.querySelector('#connection-notice').hidden = navigator.onLine;
  if (!navigator.onLine) status.textContent = 'Offline · Saved company browsing is available.';
}
window.addEventListener('online', () => { connectionState(); checkUpdates(true); });
window.addEventListener('offline', connectionState);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdates(); });
checkButton.addEventListener('click', () => checkUpdates(true));
connectionState();

if ('serviceWorker' in navigator && window.isSecureContext) {
  checkButton.hidden = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) reloadVerifiedController();
    else if (navigator.serviceWorker.controller) offerUpdate(navigator.serviceWorker.controller);
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'CHECK_FOR_UPDATE') checkUpdates();
  });
  navigator.serviceWorker.register(new URL('sw.js', root), { scope: root.pathname, updateViaCache: 'none' }).then((value) => {
    registration = value;
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      settled(installing).then(() => { if (registration.waiting) offerUpdate(registration.waiting); }).catch(() => {
        status.textContent = 'New release files could not be verified. The current version remains available.';
      });
    });
    if (registration.waiting) offerUpdate(registration.waiting);
    checkUpdates();
    setInterval(() => { if (!document.hidden) checkUpdates(); }, 10 * 60 * 1000);
  }).catch(() => {
    status.textContent = 'Offline installation is unavailable. You can continue browsing online.';
    checkButton.hidden = true;
  });
} else {
  status.textContent = 'Version ' + label(current) + ' · Automatic update checks require a supported browser over HTTPS.';
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); installPrompt = event;
  document.querySelector('#install-app').hidden = false;
});
document.querySelector('#install-app').addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null; document.querySelector('#install-app').hidden = true;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null; document.querySelector('#install-app').hidden = true;
  status.textContent = 'Gallery installed · ' + label(current);
});

// Show an honest placeholder instead of a broken full-size screenshot offline.
document.addEventListener('error', (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.src.includes('/screenshots/') || image.dataset.unavailable) return;
  image.dataset.unavailable = 'true'; image.hidden = true;
  const message = document.createElement('p'); message.className = 'preview-unavailable';
  message.textContent = 'This full-size screenshot needs a connection. Reconnect and reopen the preview.';
  image.insertAdjacentElement('afterend', message);
}, true);

new ResizeObserver(() => document.documentElement.style.setProperty('--app-chrome-height', chrome.offsetHeight + 'px')).observe(chrome);
let lastY = window.scrollY;
let movement = 0;
window.addEventListener('scroll', () => {
  const y = Math.max(0, window.scrollY);
  const delta = y - lastY;
  movement = Math.sign(delta) === Math.sign(movement) ? movement + delta : delta;
  const forced = chrome.contains(document.activeElement) || !notice.hidden || dialog.open;
  if (y < 48 || forced || movement < -12) chrome.classList.remove('is-hidden');
  else if (movement > 24) chrome.classList.add('is-hidden');
  topButton.hidden = y < window.innerHeight || dialog.open;
  lastY = y;
}, { passive: true });
chrome.addEventListener('focusin', () => chrome.classList.remove('is-hidden'));
topButton.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  document.querySelector('.site-identity').focus({ preventScroll: true });
});
