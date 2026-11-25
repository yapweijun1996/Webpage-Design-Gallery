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
  document.querySelectorAll('[data-demo-form]').forEach(function (form) {
    var fields = form.querySelector('[data-demo-fields]');
    var result = form.querySelector('[data-demo-result]');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      result.textContent = form.dataset.result;
      result.hidden = false;
    });
    fields.disabled = false;
  });
  document.querySelectorAll('[data-product-tour]').forEach(function (tour) {
    var tablist = tour.querySelector('[data-tour-tabs]');
    var tabs = Array.from(tour.querySelectorAll('[data-tour-tab]'));
    var panels = Array.from(tour.querySelectorAll('[data-tour-panel]'));
    function show(index, focus) {
      tabs.forEach(function (tab, i) { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      panels.forEach(function (panel, i) { panel.hidden = i !== index; });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { show(index, false); });
      tab.addEventListener('keydown', function (event) {
        var next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault(); show(next, true);
      });
    });
    function syncOrientation() { tablist.setAttribute('aria-orientation', matchMedia('(max-width: 900px)').matches ? 'horizontal' : 'vertical'); }
    syncOrientation(); window.addEventListener('resize', syncOrientation);
    show(0, false); tour.classList.add('tour-enabled'); tablist.hidden = false;
  });
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
