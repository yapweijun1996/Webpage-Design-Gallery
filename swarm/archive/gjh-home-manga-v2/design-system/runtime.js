// A valid HTML lang is the language default. Change events report committed preferences. The shell registers the worker.
(function () {
  'use strict';

  const root = document.documentElement;
  const preferences = {
    theme: { attribute: 'data-theme', values: ['auto', 'light', 'dark'], fallback: 'auto' },
    brand: { attribute: 'data-brand', values: ['none', 'forest-gold', 'gjh-classic'], fallback: root.getAttribute('data-default-brand') },
    lang: { attribute: 'lang', values: Object.freeze(['en', 'zh-Hans', 'ms']), fallback: root.getAttribute('lang') }
  };
  const names = Object.keys(preferences);
  const controls = names.map(name => '[data-sds-' + name + ']').join(',');
  const values = {};

  function media(query) {
    return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
  }

  const darkScheme = media('(prefers-color-scheme: dark)');
  let languageQueue;
  let revealObserver;
  let stopInitialLoader;

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function readPreference(name) {
    const preference = preferences[name];
    try {
      const saved = window.localStorage.getItem('sds.' + name);
      if (preference.values.includes(saved)) return saved;
    } catch {
      // Use the document defaults when storage is blocked.
    }
    return preference.values.includes(preference.fallback) ? preference.fallback : preference.values[0];
  }

  function syncControls(name) {
    const attribute = 'data-sds-' + name;
    for (const control of document.querySelectorAll('[' + attribute + ']')) {
      control.setAttribute('aria-pressed', String(control.getAttribute(attribute) === values[name]));
    }
    for (const select of document.querySelectorAll('select[data-sds-select="' + name + '"]')) {
      select.value = values[name];
    }
  }

  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && typeof window.getComputedStyle === 'function') {
      const color = window.getComputedStyle(root).getPropertyValue('--sds-color-bg').trim();
      if (color) meta.setAttribute('content', color);
    }
  }

  function emitThemeChange() {
    const theme = values.theme;
    const resolvedTheme = theme === 'auto' ? (darkScheme && darkScheme.matches ? 'dark' : 'light') : theme;
    emit('themechange', { theme, resolvedTheme });
  }

  function translate() {
    const i18n = window.SDS.i18n;
    if (!i18n || typeof i18n.apply !== 'function') return;
    const lang = values.lang;

    if (typeof i18n.load !== 'function') {
      i18n.apply();
      return;
    }

    async function loadAndApply() {
      if (values.lang !== lang) return;
      try {
        await i18n.load(lang);
        if (values.lang === lang) i18n.apply();
      } catch {
        // An unavailable catalog must leave the page usable.
      }
    }

    // Serialize loads because i18n owns the active catalog.
    languageQueue = languageQueue ? languageQueue.then(loadAndApply) : loadAndApply();
  }

  function setPreference(name, value) {
    const preference = preferences[name];
    if (!preference.values.includes(value) || value === values[name]) return;
    values[name] = value;
    root.setAttribute(preference.attribute, value);
    try {
      window.localStorage.setItem('sds.' + name, value);
    } catch {
      // The in-memory selection and DOM remain usable.
    }
    syncControls(name);
    if (name === 'lang') translate();
    else syncThemeColor();

    if (name === 'theme') emitThemeChange();
    else emit(name + 'change', { [name]: value });
  }

  function clickPreference(event) {
    const target = event.target;
    const element = target && (target.closest ? target : target.parentElement);
    const control = element && element.closest(controls);
    if (!control) return;
    for (const name of names) {
      const value = control.getAttribute('data-sds-' + name);
      if (!preferences[name].values.includes(value)) continue;
      event.preventDefault();
      setPreference(name, value);
      return;
    }
  }

  function changePreference(event) {
    const select = event.target;
    if (!select || !select.matches || !select.matches('select[data-sds-select]')) return;
    const name = select.getAttribute('data-sds-select');
    if (names.includes(name)) setPreference(name, select.value);
  }

  function showLoader() {
    if (stopInitialLoader) stopInitialLoader();
    // The first-paint timeout leaves an explicitly shown loader in place.
    root.setAttribute('data-loading', 'manual');
  }

  function hideLoader() {
    root.removeAttribute('data-loading');
    if (stopInitialLoader) stopInitialLoader();
  }

  function prepareInitialLoader() {
    if (!root.hasAttribute('data-loading')) return;
    const timeout = window.setTimeout(hideLoader, 2500);
    const cleanups = [];
    let active = true;
    stopInitialLoader = () => {
      active = false;
      stopInitialLoader = undefined;
      window.clearTimeout(timeout);
      cleanups.forEach(cleanup => cleanup());
    };

    return function waitForFirstPaint() {
      function waitForContent() {
        if (!active) return;
        const pending = [];
        if (document.fonts) pending.push(document.fonts.ready.catch(() => {}));
        const viewportHeight = window.innerHeight || root.clientHeight;
        for (const image of document.querySelectorAll('img')) {
          if (image.complete) continue;
          const rect = image.getBoundingClientRect();
          if (rect.top >= viewportHeight || rect.bottom <= 0 || rect.bottom <= rect.top) continue;
          pending.push(new Promise(resolve => {
            function settled() {
              image.removeEventListener('load', settled);
              image.removeEventListener('error', settled);
              resolve();
            }
            cleanups.push(settled);
            image.addEventListener('load', settled);
            image.addEventListener('error', settled);
          }));
        }
        Promise.all(pending).then(() => {
          if (active) hideLoader();
        });
      }

      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => window.requestAnimationFrame(waitForContent));
      }
    };
  }

  function initReveal() {
    if (window.CSS && typeof window.CSS.supports === 'function' && window.CSS.supports('animation-timeline', 'view()')) return;
    const reducedMotion = media('(prefers-reduced-motion: reduce)');
    if ((reducedMotion && reducedMotion.matches) || typeof window.IntersectionObserver !== 'function') return;
    if (!revealObserver) {
      revealObserver = new window.IntersectionObserver((entries, observer) => {
        if (reducedMotion && reducedMotion.matches) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          observer.unobserve(entry.target);
        }
      });
    }
    for (const element of document.querySelectorAll('[data-reveal]:not([data-revealed])')) {
      revealObserver.observe(element);
    }
  }

  function serviceWorkerContainer() {
    try {
      return window.navigator && window.navigator.serviceWorker;
    } catch {
      // Some sandboxed documents cannot access the container.
    }
  }

  const serviceWorkers = serviceWorkerContainer();
  const watchedWorkers = new WeakSet();
  let registration;
  let announcedWorker;
  let requestedWorker;
  let reloading = false;

  function announceUpdate() {
    const waiting = registration.waiting;
    if (waiting && waiting !== announcedWorker) {
      announcedWorker = waiting;
      emit('updateavailable');
    }
  }

  function watchInstallation() {
    const worker = registration.installing;
    if (worker && !watchedWorkers.has(worker)) {
      watchedWorkers.add(worker);
      worker.addEventListener('statechange', announceUpdate);
    }
    announceUpdate();
  }

  function watchRegistration(candidate) {
    if (candidate && candidate !== registration) {
      if (registration) registration.removeEventListener('updatefound', watchInstallation);
      registration = candidate;
      registration.addEventListener('updatefound', watchInstallation);
      watchInstallation();
    }
    return registration;
  }

  async function getRegistration() {
    if (registration || !serviceWorkers) return registration;
    return watchRegistration(await serviceWorkers.getRegistration());
  }

  async function checkUpdate() {
    const current = await getRegistration();
    if (!current) return;
    await current.update();
    watchInstallation();
  }

  async function applyUpdate() {
    const current = await getRegistration();
    const waiting = current && current.waiting;
    if (!waiting || waiting === requestedWorker || reloading) return;
    serviceWorkers.addEventListener('controllerchange', reloadAfterUpdate);
    requestedWorker = waiting;
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      requestedWorker = undefined;
      throw error;
    }
  }

  function reloadAfterUpdate() {
    if (!requestedWorker || reloading) return;
    reloading = true;
    window.location.reload();
  }

  function initUpdates() {
    if (!serviceWorkers) return;
    getRegistration().catch(() => {});
    Promise.resolve(serviceWorkers.ready).then(watchRegistration).catch(() => {});
  }

  const completeInitialLoader = prepareInitialLoader();
  const SDS = window.SDS || {};
  SDS.version = '1.0.0';
  for (const name of names) {
    const preference = preferences[name];
    values[name] = readPreference(name);
    root.setAttribute(preference.attribute, values[name]);
    SDS[name] = { get: () => values[name], set: value => setPreference(name, value) };
  }
  SDS.lang.list = preferences.lang.values;
  SDS.loader = { show: showLoader, hide: hideLoader };
  SDS.reveal = { init: initReveal };
  SDS.on = (name, fn) => window.addEventListener(name, fn);
  SDS.off = (name, fn) => window.removeEventListener(name, fn);
  SDS.update = { check: checkUpdate, apply: applyUpdate };
  window.SDS = SDS;

  if (root.hasAttribute('data-viewport-lock')) {
    document.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });
  }

  function initialize() {
    names.forEach(syncControls);
    syncThemeColor();
    translate();
    document.addEventListener('click', clickPreference);
    document.addEventListener('change', changePreference);
    if (darkScheme) {
      const onSystemThemeChange = () => {
        if (values.theme !== 'auto') return;
        syncThemeColor();
        emitThemeChange();
      };
      if (darkScheme.addEventListener) darkScheme.addEventListener('change', onSystemThemeChange);
      else if (darkScheme.addListener) darkScheme.addListener(onSystemThemeChange);
    }
    initReveal();
    if (completeInitialLoader) completeInitialLoader();
    emit('ready');
    initUpdates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    window.setTimeout(initialize, 0);
  }
}());
