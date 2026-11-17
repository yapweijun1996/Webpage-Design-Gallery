/* A version directory owns its install identity, cache and update controls. */
(() => {
  if (window.top !== window.self || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  const scriptURL = document.currentScript.src;
  const scope = new URL('./', document.querySelector('link[rel="manifest"]').href);
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../assets/demo-pwa.css', scriptURL);
  document.head.append(stylesheet);

  const panel = document.createElement('details');
  panel.className = 'demo-install';
  panel.innerHTML = '<summary>Install / offline</summary><div class="demo-install-body">' +
    '<p role="status" aria-live="polite">Preparing offline access…</p>' +
    '<div class="demo-install-actions"><button type="button" data-install>Install this demo</button>' +
    '<button type="button" data-check>Check for updates</button>' +
    '<button type="button" data-apply hidden>Update and reload</button></div></div>';
  document.body.append(panel);
  const notice = document.createElement('button');
  notice.className = 'demo-update-notice';
  notice.type = 'button';
  notice.textContent = 'Update available';
  notice.hidden = true;
  document.body.append(notice);
  notice.addEventListener('click', () => {
    panel.open = true;
    notice.hidden = true;
    apply.focus();
  });
  const status = panel.querySelector('[role=status]');
  const installButton = panel.querySelector('[data-install]');
  const check = panel.querySelector('[data-check]');
  const apply = panel.querySelector('[data-apply]');
  const trigger = panel.querySelector('summary');
  let registration, installPrompt, pageWorker, target, timer;
  let applying = false;
  let lastCheck = Date.now();
  const owned = worker => worker && new URL(worker.scriptURL).href === new URL('sw.js', scope).href;
  const describe = info => 'v' + info.version + ' · ' + info.build.slice(0, 8);

  function identify(worker) {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Version unavailable')); }, 3500);
      channel.port1.onmessage = ({data}) => {
        clearTimeout(timeout);
        channel.port1.close();
        if (data?.version && data?.build) resolve(data);
        else reject(new Error('Invalid release'));
      };
      worker.postMessage({type: 'GET_VERSION'}, [channel.port2]);
    });
  }

  function fail() {
    status.textContent = navigator.onLine ? 'Offline files could not be verified. Check for updates to retry.' :
      'Offline. Reconnect to check for updates.';
  }

  async function showState() {
    if (!registration || applying) return;
    try {
      const worker = registration.waiting || registration.active;
      if (!worker) return;
      const info = await identify(worker);
      if (registration.waiting || (pageWorker && pageWorker !== registration.active)) {
        target = worker;
        apply.hidden = false;
        notice.hidden = panel.open;
        trigger.textContent = 'Update available';
        status.textContent = 'Ready to update to ' + describe(info) + '. Reload when you are ready.';
      } else {
        pageWorker = registration.active;
        status.textContent = 'Available offline · ' + describe(info);
      }
    } catch { fail(); }
  }

  function watch(worker) {
    if (!worker) return;
    const changed = () => {
      if (worker.state === 'redundant') fail();
      if (worker.state === 'installed' || worker.state === 'activated') void showState();
    };
    worker.addEventListener('statechange', changed);
    changed();
  }

  async function register() {
    registration = await navigator.serviceWorker.register(new URL('sw.js', scope), {
      scope: scope.href, updateViaCache: 'none'
    });
    const controller = navigator.serviceWorker.controller;
    if (!pageWorker && owned(controller)) pageWorker = controller;
    registration.addEventListener('updatefound', () => watch(registration.installing));
    watch(registration.installing);
    await showState();
  }

  async function checkUpdate() {
    if (check.disabled || applying) return;
    check.disabled = true;
    lastCheck = Date.now();
    status.textContent = 'Checking offline files…';
    try {
      if (!registration?.active) await register();
      else await registration.update();
      if (!registration.installing) await showState();
    } catch { fail(); }
    finally { check.disabled = false; }
  }

  function reloadOnce() {
    if (!applying) return;
    applying = false;
    clearTimeout(timer);
    location.reload();
  }
  apply.addEventListener('click', () => {
    if (!target || applying) return;
    applying = true;
    apply.disabled = check.disabled = true;
    status.textContent = 'Opening the verified update…';
    if (target.state === 'activated') { reloadOnce(); return; }
    const worker = target;
    worker.addEventListener('statechange', () => { if (worker.state === 'activated') reloadOnce(); });
    timer = setTimeout(() => {
      applying = false;
      apply.disabled = check.disabled = false;
      status.textContent = 'The update is taking longer than expected. Try again when ready.';
    }, 15000);
    worker.postMessage({type: 'SKIP_WAITING'});
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) reloadOnce();
    else void showState();
  });
  check.addEventListener('click', checkUpdate);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > 600000) void checkUpdate();
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) installButton.hidden = true;
  window.addEventListener('appinstalled', () => {
    installPrompt = undefined;
    installButton.hidden = true;
    status.textContent = 'Installed on this device.';
  });
  installButton.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = undefined;
      try { await prompt.prompt(); await prompt.userChoice; } catch { fail(); }
    } else {
      status.textContent = 'On iPhone or iPad, open in Safari and choose Share → Add to Home Screen. In other supported browsers, open the browser menu and choose Install or Add to Home screen.';
    }
  });

  const topButton = document.createElement('button');
  topButton.className = 'demo-back-top';
  topButton.type = 'button';
  topButton.textContent = '↑';
  topButton.setAttribute('aria-label', 'Back to top');
  topButton.hidden = true;
  document.body.append(topButton);
  topButton.addEventListener('click', () => {
    const first = document.querySelector('main h1, h1');
    if (first) { if (!first.hasAttribute('tabindex')) first.tabIndex = -1; first.focus({preventScroll: true}); }
    window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  });
  const updateTop = () => {
    topButton.hidden = window.scrollY <= window.innerHeight || panel.open || !notice.hidden ||
      panel.getBoundingClientRect().top < window.innerHeight;
  };
  // Keep navigation reachable while reading on phones. Full-screen scenes own their HUD.
  const header = document.querySelector('body > header');
  const mobile = matchMedia('(max-width: 650px)');
  const contentHeader = header?.querySelector('nav') && !document.querySelector('canvas');
  let previousY = window.scrollY;
  if (contentHeader) {
    const background = getComputedStyle(header).backgroundColor;
    const color = background === 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.body).backgroundColor : background;
    header.style.setProperty('--demo-nav-surface', color);
    header.classList.add('demo-reading-header');
  }
  function scrollControls() {
    updateTop();
    if (!contentHeader || !mobile.matches) return;
    const y = window.scrollY;
    if (Math.abs(y - previousY) < 10 && y > 48) return;
    const engaged = header.contains(document.activeElement) || header.querySelector('[aria-expanded="true"]') ||
      document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])');
    header.classList.toggle('demo-header-away', !engaged && y > 48 && y > previousY);
    previousY = y;
  }
  window.addEventListener('scroll', scrollControls, {passive: true});
  panel.addEventListener('toggle', updateTop);
  register().catch(fail);
})();
