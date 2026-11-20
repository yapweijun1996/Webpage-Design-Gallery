/* A version directory owns its install identity, cache and update controls. */
(() => {
  if (window.top !== window.self || !window.isSecureContext || !('serviceWorker' in navigator)) return;
  const scriptURL = document.currentScript.src;
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) return;
  const scope = new URL('./', manifestLink.href);
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('../assets/demo-pwa.css', scriptURL);
  document.head.append(stylesheet);

  const defaultCopy = {
    summary: 'Install / offline',
    preparing: 'Preparing offline access…',
    installButton: 'Install this demo',
    checkButton: 'Check for updates',
    applyButton: 'Update and reload',
    updateNotice: 'Update available',
    checking: 'Checking offline files…',
    availableOffline: 'Available offline · {release}',
    readyToUpdate: 'Ready to update to {release}. Reload when you are ready.',
    applying: 'Opening the verified update…',
    updateSlow: 'The update is taking longer than expected. Try again when ready.',
    installed: 'Installed on this device.',
    installInstructions: 'On iPhone or iPad, open in Safari and choose Share → Add to Home Screen. In other supported browsers, open the browser menu and choose Install or Add to Home screen.',
    failOnline: 'Offline files could not be verified. Check for updates to retry.',
    failOffline: 'Offline. Reconnect to check for updates.',
    backToTopLabel: 'Back to top',
  };
  let customCopy = {};
  const copyElement = document.getElementById('demo-pwa-copy');
  if (copyElement) {
    try {
      const parsed = JSON.parse(copyElement.textContent || '{}');
      if (parsed && typeof parsed === 'object') customCopy = parsed;
    } catch { /* Fall back to default English strings. */ }
  }
  const baseCopy = {...defaultCopy, ...customCopy};
  let copy = baseCopy;
  const format = (template, release) => String(template).replace('{release}', release);

  const panel = document.createElement('details');
  panel.className = 'demo-install';
  const summaryEl = document.createElement('summary');
  summaryEl.textContent = copy.summary;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'demo-install-body';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = copy.preparing;
  const actionsEl = document.createElement('div');
  actionsEl.className = 'demo-install-actions';
  const installButton = document.createElement('button');
  installButton.type = 'button';
  installButton.dataset.install = '';
  installButton.textContent = copy.installButton;
  const check = document.createElement('button');
  check.type = 'button';
  check.dataset.check = '';
  check.textContent = copy.checkButton;
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.dataset.apply = '';
  apply.hidden = true;
  apply.textContent = copy.applyButton;
  actionsEl.append(installButton, check, apply);
  bodyEl.append(status, actionsEl);
  panel.append(summaryEl, bodyEl);

  const mount = document.querySelector('[data-demo-pwa-mount]');
  if (mount) {
    mount.textContent = '';
    mount.append(panel);
  } else {
    document.body.append(panel);
  }

  const notice = document.createElement('button');
  notice.className = 'demo-update-notice';
  notice.type = 'button';
  notice.textContent = copy.updateNotice;
  notice.hidden = true;
  document.body.append(notice);
  notice.addEventListener('click', () => {
    panel.open = true;
    notice.hidden = true;
    apply.focus();
  });
  const trigger = summaryEl;
  let registration, installPrompt, pageWorker, target, timer;
  let applying = false;
  let lastCheck = Date.now();
  const owned = worker => worker && new URL(worker.scriptURL).href === new URL('sw.js', scope).href;
  const describe = info => 'v' + info.version + ' · ' + info.build.slice(0, 8);
  let statusKey = 'preparing';
  let statusRelease;
  let summaryKey = 'summary';
  const setStatus = (key, release) => {
    statusKey = key;
    statusRelease = release;
    const message = format(copy[key], release);
    if (status.textContent !== message) status.textContent = message;
  };
  const setSummary = key => {
    summaryKey = key;
    trigger.textContent = copy[key];
  };

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
    setStatus(navigator.onLine ? 'failOnline' : 'failOffline');
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
        setSummary('updateNotice');
        setStatus('readyToUpdate', describe(info));
      } else {
        pageWorker = registration.active;
        setSummary('summary');
        setStatus('availableOffline', describe(info));
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
    setStatus('checking');
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
    setStatus('applying');
    if (target.state === 'activated') { reloadOnce(); return; }
    const worker = target;
    worker.addEventListener('statechange', () => { if (worker.state === 'activated') reloadOnce(); });
    timer = setTimeout(() => {
      applying = false;
      apply.disabled = check.disabled = false;
      setStatus('updateSlow');
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
    setStatus('installed');
  });
  installButton.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = undefined;
      try { await prompt.prompt(); await prompt.userChoice; } catch { fail(); }
    } else {
      setStatus('installInstructions');
    }
  });

  const topButton = document.createElement('button');
  topButton.className = 'demo-back-top';
  topButton.type = 'button';
  topButton.textContent = '↑';
  topButton.setAttribute('aria-label', copy.backToTopLabel);
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
  const contentHeader = header?.querySelector('nav') && !document.querySelector('canvas') && !header.hasAttribute('data-static-header');
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
  document.addEventListener('demo-pwa-copy-change', event => {
    copy = {...baseCopy, ...event.detail};
    setSummary(summaryKey);
    setStatus(statusKey, statusRelease);
    installButton.textContent = copy.installButton;
    check.textContent = copy.checkButton;
    apply.textContent = copy.applyButton;
    notice.textContent = copy.updateNotice;
    topButton.setAttribute('aria-label', copy.backToTopLabel);
  });
  window.addEventListener('scroll', scrollControls, {passive: true});
  panel.addEventListener('toggle', updateTop);
  register().catch(fail);
})();
