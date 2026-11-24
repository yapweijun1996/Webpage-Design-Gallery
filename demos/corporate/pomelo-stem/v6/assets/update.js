(function () {
  'use strict';
  var control = document.querySelector('.update-control');
  if (!control) return;
  var status = control.querySelector('[data-update-status]');
  var retry = control.querySelector('[data-update-retry]');
  var apply = control.querySelector('[data-update-apply]');
  var current = control.dataset.current;
  var available = '';
  var busy = false;
  var key = 'pomelo-v6-expected-update';

  function message(text) { status.textContent = text; }
  function setBusy(value) {
    busy = value;
    control.classList.toggle('is-checking', value);
    retry.disabled = value;
  }
  function greater(a, b) {
    var aa = a.split('.').map(Number), bb = b.split('.').map(Number);
    for (var i = 0; i < 3; i++) {
      if (aa[i] !== bb[i]) return aa[i] > bb[i];
    }
    return false;
  }
  async function check() {
    if (busy) return;
    setBusy(true);
    retry.hidden = true;
    apply.hidden = true;
    available = '';
    message(control.dataset.checking);
    var abort = new AbortController();
    var timer = setTimeout(function () { abort.abort(); }, 8000);
    try {
      var url = new URL(control.dataset.manifest, location.href);
      url.searchParams.set('check', Date.now().toString());
      var response = await fetch(url.href, {cache: 'no-store', credentials: 'same-origin', signal: abort.signal});
      if (!response.ok) throw new Error('Network response');
      var data = await response.json();
      if (!data || typeof data.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(data.version)) throw new Error('Invalid version');
      if (data.version === current) {
        message(control.dataset.currentMessage);
      } else if (greater(data.version, current)) {
        available = data.version;
        message(control.dataset.available + ' · ' + control.dataset.latest + ': v' + available);
        apply.hidden = false;
      } else {
        throw new Error('Older version');
      }
    } catch (error) {
      message(control.dataset.error);
      retry.hidden = false;
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }
  // A single open panel prevents neighboring menus from obscuring each other.
  document.querySelectorAll('.languages, .update-control, .menu').forEach(function (panel) {
    panel.addEventListener('toggle', function () {
      if (!panel.open) return;
      document.querySelectorAll('.languages[open], .update-control[open], .menu[open]').forEach(function (other) {
        if (other !== panel) other.open = false;
      });
    });
  });
  control.addEventListener('toggle', function () {
    if (!control.open) return;
    if (control.dataset.verifiedResult) {
      message(control.dataset.verifiedResult);
      delete control.dataset.verifiedResult;
      return;
    }
    check();
  });
  retry.addEventListener('click', check);
  apply.addEventListener('click', function () {
    if (!available) return;
    if (/showcase\.html$/.test(location.pathname) && !window.confirm(control.dataset.confirm)) return;
    try { sessionStorage.setItem(key, available); }
    catch (error) { message(control.dataset.unverified); return; }
    var url = new URL(location.href);
    url.searchParams.set('pomelo-update', available);
    url.searchParams.set('refresh', Date.now().toString());
    location.replace(url.href);
  });
  function verifyAfterReload() {
    var expected;
    try { expected = sessionStorage.getItem(key); }
    catch (error) { return; }
    if (!expected) return;
    try { sessionStorage.removeItem(key); } catch (error) {}
    var styles = Array.from(document.querySelectorAll('link[rel=stylesheet][integrity]'));
    var boot = document.documentElement.dataset.pomeloBoot === 'ready';
    var app = document.documentElement.dataset.pomeloApp === 'ready';
    var verified = expected === current && boot && app && styles.length === 2 && styles.every(function (link) { return !!link.sheet; });
    control.open = true;
    // Opening the panel after reload must not immediately replace the verification result.
    control.dataset.verifiedResult = verified ? control.dataset.success : control.dataset.unverified;
    message(control.dataset.verifiedResult);
    retry.hidden = verified;
    var url = new URL(location.href);
    url.searchParams.delete('pomelo-update');
    url.searchParams.delete('refresh');
    history.replaceState(null, '', url.href);
  }
  if (document.readyState === 'complete') verifyAfterReload();
  else window.addEventListener('load', verifyAfterReload, {once: true});
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      document.querySelectorAll('.languages[open],.update-control[open],.menu[open]').forEach(function (item) {
        item.open = false;
        item.querySelector('summary').focus();
      });
    }
  });
})();
