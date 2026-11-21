// A valid HTML lang supplies the initial language when storage has no preference.
(function () {
  'use strict';

  const root = document.documentElement;

  function read(name, allowed, fallback) {
    try {
      const value = window.localStorage.getItem('sds.' + name);
      if (allowed.includes(value)) return value;
    } catch {
      // The document defaults also work when storage is blocked.
    }
    return allowed.includes(fallback) ? fallback : allowed[0];
  }

  root.setAttribute('data-theme', read('theme', ['auto', 'light', 'dark'], 'auto'));
  root.setAttribute('data-brand', read('brand', ['none', 'forest-gold', 'gjh-classic', 'cny-red-gold'], root.getAttribute('data-default-brand')));
  root.setAttribute('lang', read('lang', ['en', 'zh-Hans', 'ms'], root.getAttribute('lang')));
  root.setAttribute('data-loading', '');
  window.setTimeout(() => {
    // Release the first-paint loader even if the runtime has not loaded.
    if (root.getAttribute('data-loading') !== '') return;
    const loader = window.SDS && window.SDS.loader;
    if (loader) loader.hide();
    else root.removeAttribute('data-loading');
  }, 2500);
}());
