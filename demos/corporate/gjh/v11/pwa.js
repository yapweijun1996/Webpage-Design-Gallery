import {initMallLanguage} from './assets/mall-language.js';
import './assets/color-scheme.js';
import {icon} from './assets/icons.js';

initMallLanguage();

/* V11 owns only its scoped offline fallback. Live mall resources stay network-only. */
(() => {
  const root = new URL('../../../../', location.href);
  const install = document.querySelector('#mall-install');
  const check = document.querySelector('#mall-check-update');
  const checks = [...document.querySelectorAll('[data-mall-check]')];
  const setChecking = disabled => checks.forEach(button => { button.disabled = disabled; });
  const sceneStatus = document.querySelector('[data-mall-check-status]');
  const currentBadge = document.querySelector('#menu-update-current');
  const arrivalStatus = document.querySelector('#arrival-update-status');
  const status = document.querySelector('#mall-app-status');
  const connection = document.querySelector('#mall-connection-notice');
  const notice = document.querySelector('#mall-update-notice');
  const update = document.querySelector('#mall-apply-update');
  const message = document.querySelector('#mall-update-message');
  install.prepend(icon('download', {size:18}));
  check.prepend(icon('refresh', {size:18}));
  const updateIcon = icon('refresh', {size:18});
  update.prepend(updateIcon);
  const workerURL = new URL('./pwa-sw.js', location.href).href;
  let registration, prompt, checking = false, applying = false, lastCheck = 0, nextWorker = null;
  let failedWorker = null, noUpdateFound = false;
  const updateFailed = 'Update failed, retry.';
  let hadMallController = navigator.serviceWorker?.controller?.scriptURL === workerURL;

  function showVersion(release) {
    if (typeof release?.version !== 'string') return;
    document.querySelectorAll('[data-mall-version]').forEach(label => { label.textContent = 'v' + release.version; });
  }
  function setCheckStatus(text) {
    status.textContent = text;
    sceneStatus.textContent = text;
    if (arrivalStatus) arrivalStatus.textContent = text;
  }
  function showCurrent() {
    const current = noUpdateFound && Boolean(registration?.active) && notice.hidden && connection.hidden;
    currentBadge.hidden = !current;
    if (current) sceneStatus.textContent = 'Up to date.';
  }
  function connectionState(connected) {
    connection.hidden = connected;
    if (!connected) currentBadge.hidden = true;
    if (!applying) update.disabled = !connected;
  }

  function version(worker) {
    return new Promise((resolve, reject) => {
      if (!worker) return reject(new Error('Worker unavailable'));
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Version timed out')); }, 3000);
      channel.port1.onmessage = ({data}) => {
        clearTimeout(timer); channel.port1.close();
        if (typeof data?.build === 'string' && typeof data?.version === 'string') resolve(data);
        else reject(new Error('Invalid version'));
      };
      worker.postMessage({type:'GET_VERSION'}, [channel.port2]);
    });
  }
  function offer(worker, otherTab = false) {
    // The first install can briefly be "waiting" before it becomes active.
    if (!otherTab && (!registration?.active || registration.active === worker)) return;
    nextWorker = worker;
    noUpdateFound = false;
    currentBadge.hidden = true;
    sceneStatus.textContent = 'Update available.';
    message.textContent = otherTab ? 'The mall was updated in another tab. Reload when you are ready.' : 'A mall update is ready. Your demo bag stays in this tab.';
    update.textContent = otherTab ? 'Reload' : 'Update now';
    update.prepend(updateIcon);
    notice.hidden = false;
    const releaseWorker = worker || registration?.active;
    version(releaseWorker).then(release => {
      if (nextWorker !== worker) return;
      const number = document.createElement('bdi');
      number.textContent = 'v' + release.version;
      if (!update.querySelector('bdi')) update.append(' ', number);
    }).catch(() => { /* Keep the manual update action when metadata is unavailable. */ });
  }
  async function checkForUpdates(manual = false) {
    if (!registration || checking || applying || (!manual && Date.now() - lastCheck < 600000)) return;
    checking = true; lastCheck = Date.now(); setChecking(true);
    if (manual) setCheckStatus('Checking for updates…');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      let response;
      try { response = await fetch(new URL('version.json?check=' + Date.now(), root), {cache:'no-store', signal:controller.signal}); }
      catch (error) { connectionState(false); throw error; }
      finally { clearTimeout(timer); }
      if (!response.ok || response.redirected) { connectionState(false); throw new Error('Connection unavailable'); }
      connectionState(true);
      failedWorker = null;
      await registration.update();
      const worker = registration.installing;
      if (worker && worker.state !== 'installed' && worker.state !== 'redundant') {
        await new Promise((resolve, reject) => {
          const timer=setTimeout(() => { worker.removeEventListener('statechange', changed); reject(new Error('Update timed out')); }, 20000);
          function changed() { if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') { clearTimeout(timer); worker.removeEventListener('statechange',changed); worker.state === 'redundant' ? reject(new Error('Verification failed')) : resolve(); } }
          worker.addEventListener('statechange', changed); changed();
        });
      }
      if (registration.waiting) offer(registration.waiting);
      else if (failedWorker) setCheckStatus(updateFailed);
      else {
        noUpdateFound = true;
        showCurrent();
        if (manual) setCheckStatus('No verified update is waiting.');
      }
    } catch {
      noUpdateFound = false;
      currentBadge.hidden = true;
      setCheckStatus(failedWorker || connection.hidden ? updateFailed : 'Connection unavailable. Reconnect and try again.');
    } finally { checking = false; setChecking(false); }
  }
  function waitForController(worker) {
    const workers = navigator.serviceWorker;
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => finish(new Error('Controller change timed out')), 20000);
      function finish(error) {
        clearTimeout(timer);
        channel.port1.close();
        workers.removeEventListener('controllerchange', changed);
        worker.removeEventListener('statechange', checkFailure);
        if (error) reject(error);
        else resolve();
      }
      function changed() {
        if (workers.controller === worker) finish();
      }
      function checkFailure() {
        if (worker.state === 'redundant') finish(new Error('Activation failed'));
      }
      channel.port1.onmessage = ({data}) => {
        if (data?.type === 'UPDATE_FAILED') finish(new Error('Verification failed'));
      };
      workers.addEventListener('controllerchange', changed);
      worker.addEventListener('statechange', checkFailure);
      if (workers.controller === worker) changed();
      else if (registration.waiting === worker) {
        try { worker.postMessage({type: 'SKIP_WAITING'}, [channel.port2]); }
        catch (error) { finish(error); }
      } else checkFailure();
    });
  }

  update.addEventListener('click', async () => {
    if (applying) return;
    if (document.querySelector('dialog[open]')) { message.textContent = 'Close the open dialog before updating.'; return; }
    applying = true; update.disabled = true; setChecking(true);
    message.textContent = 'Updating the mall… Your demo bag stays in this tab.';
    try {
      const worker = nextWorker || navigator.serviceWorker.controller;
      const expected = await version(worker);
      if (nextWorker) await waitForController(worker);
      if (navigator.serviceWorker.controller !== worker) throw new Error('Unexpected controller');
      // The key is scoped to this mall build, so a later release can also reload once.
      const key = 'gjh-v11-update-reloads:' + workerURL + ':' + expected.build;
      let reloads = 0;
      try {
        reloads = Number(sessionStorage.getItem(key)) || 0;
        if (reloads < 1) sessionStorage.setItem(key, String(reloads + 1));
      } catch { /* The applying flag guards this page if browser storage is blocked. */ }
      if (reloads >= 1) throw new Error('Update already reloaded');
      location.reload();
    } catch {
      applying = false; update.disabled = !connection.hidden; setChecking(false);
      message.textContent = updateFailed;
    }
  });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; install.hidden = false; });
  install.addEventListener('click', async () => {
    if (!prompt) return;
    try { await prompt.prompt(); await prompt.userChoice; } catch { status.textContent = 'Use your browser menu to install the mall.'; }
    prompt = null; install.hidden = true;
  });
  window.addEventListener('appinstalled', () => { prompt = null; install.hidden = true; status.textContent = 'GJH Virtual Mall was installed.'; });
  window.addEventListener('offline', () => { connectionState(false); status.textContent = 'Connection unavailable. Reconnect to browse the mall and its products.'; });
  window.addEventListener('online', async () => {
    status.textContent = 'Checking the connection…';
    if (registration) { checkForUpdates(true); return; }
    try {
      const response = await fetch(new URL('version.json?check=' + Date.now(), root), {cache:'no-store'});
      if (!response.ok || response.redirected) throw new Error('Connection unavailable');
      connectionState(true); status.textContent = 'Connection restored. Offline support is unavailable in this browser.';
    } catch { connectionState(false); status.textContent = 'Connection unavailable. Reconnect to browse the mall and its products.'; }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdates(); });
  checks.forEach(button => button.addEventListener('click', () => checkForUpdates(true)));
  fetch(new URL('version.json', root), {cache:'no-store'}).then(response => response.ok ? response.json() : null)
    .then(release => { if (!registration?.active) showVersion(release); }).catch(() => {});
  if (!navigator.onLine) connectionState(false);
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'CHECK_FOR_UPDATE') checkForUpdates();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (navigator.serviceWorker.controller?.scriptURL !== workerURL) return;
      if (hadMallController && !applying) offer(null,true);
      hadMallController = true;
      status.textContent = 'The mall requires a connection. An offline reconnect screen is saved on this device.';
    });
    navigator.serviceWorker.register(workerURL, {scope:'./', updateViaCache:'none'}).then(value => {
      registration = value; setChecking(false);
      value.addEventListener('updatefound', () => {
        const worker = value.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && value.waiting) offer(value.waiting);
          if (worker.state === 'redundant') {
            failedWorker = worker;
            noUpdateFound = false;
            currentBadge.hidden = true;
            setCheckStatus(value.active ? updateFailed : 'Offline support is unavailable. You can continue browsing online.');
          }
        });
      });
      if (value.waiting) offer(value.waiting);
      status.textContent = 'The mall requires a connection. Preparing offline help…';
      navigator.serviceWorker.ready.then(ready => {
        if (ready.scope === value.scope && ready.active) {
          version(ready.active).then(showVersion).catch(() => {});
          showCurrent();
          status.textContent = 'The mall requires a connection. An offline reconnect screen is saved on this device.';
        }
      }).catch(() => { status.textContent = 'Offline support is unavailable. You can continue browsing online.'; });
      checkForUpdates();
    }).catch(() => { setCheckStatus('Offline support is unavailable. You can continue browsing online.'); });
  } else setCheckStatus('Use HTTPS and a supported browser to enable offline support.');
})();
