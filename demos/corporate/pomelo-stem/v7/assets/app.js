(function () {
  'use strict';
  var root = document.documentElement;
  root.dataset.pomeloApp = 'ready';
  var theme = document.querySelector('[data-theme-toggle]');
  function syncTheme() {
    if (!theme) return;
    var dark = root.dataset.theme === 'dark';
    theme.setAttribute('aria-pressed', String(dark));
    theme.setAttribute('aria-label', dark ? theme.dataset.light : theme.dataset.dark);
    theme.setAttribute('title', dark ? theme.dataset.light : theme.dataset.dark);
  }
  if (theme) theme.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('pomelo-v7-theme', root.dataset.theme); } catch (_) {}
    syncTheme();
  });
  syncTheme();
  document.querySelectorAll('[data-locale]').forEach(function (link) { link.addEventListener('click', function () { try { localStorage.setItem('pomelo-v7-language', link.dataset.locale); } catch (_) {} }); });
  document.querySelectorAll('details.panel').forEach(function (panel) {
    panel.addEventListener('toggle', function () {
      if (panel.open) document.querySelectorAll('details.panel[open]').forEach(function (other) { if (other !== panel) other.open = false; });
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') document.querySelectorAll('details.panel[open]').forEach(function (panel) { panel.open = false; panel.querySelector('summary').focus(); });
  });
  window.addEventListener('load', function () { root.classList.remove('booting'); }, { once: true });
})();
