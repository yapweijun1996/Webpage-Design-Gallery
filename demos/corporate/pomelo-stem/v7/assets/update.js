(function () {
  'use strict';
  var panel = document.querySelector('[data-update]');
  if (!panel) return;
  var output = panel.querySelector('[data-status]');
  var retry = panel.querySelector('[data-retry]');
  var apply = panel.querySelector('[data-apply]');
  var current = panel.dataset.version;
  var key = 'pomelo-v7-expected-version';
  var available = '';
  var pending = false;
  var showVerified = false;
  async function check() {
    if (pending) return;
    pending = true; panel.classList.add('checking'); retry.disabled = true; apply.hidden = true; output.textContent = panel.dataset.checking;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    try {
      var url = new URL(panel.dataset.manifest, location.href);
      url.searchParams.set('check', Date.now().toString());
      var response = await fetch(url.href, {cache:'no-store', credentials:'same-origin', signal:controller.signal});
      if (!response.ok) throw new Error('Release unavailable');
      var release = await response.json();
      if (!release || !/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error('Invalid release');
      if (release.version === current) output.textContent = panel.dataset.current;
      else {
        var a = release.version.split('.').map(Number), b = current.split('.').map(Number);
        var newer = a.some(function (n, i) { return n > b[i] && a.slice(0, i).every(function (x, j) { return x === b[j]; }); });
        if (!newer) throw new Error('Older release');
        available = release.version; output.textContent = panel.dataset.available + ' v' + available; apply.hidden = false;
      }
    } catch (_) { output.textContent = panel.dataset.error; }
    finally { clearTimeout(timer); pending = false; panel.classList.remove('checking'); retry.disabled = false; }
  }
  function awaitState(worker, state, timeout) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { cleanup(); reject(new Error('Worker timeout')); }, timeout);
      function cleanup() { clearTimeout(timer); worker.removeEventListener('statechange', changed); }
      function changed() {
        if (worker.state === state) { cleanup(); resolve(); }
        else if (worker.state === 'redundant') { cleanup(); reject(new Error('Worker redundant')); }
      }
      worker.addEventListener('statechange', changed); changed();
    });
  }
  function workerIdentity(worker) {
    return new Promise(function (resolve, reject) {
      var channel = new MessageChannel();
      var timer = setTimeout(function () { channel.port1.close(); reject(new Error('Worker identity timeout')); }, 5000);
      channel.port1.onmessage = function (event) { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      worker.postMessage({type:'GET_VERSION'}, [channel.port2]);
    });
  }
  async function verifyParent(worker, registration) {
    var response = await fetch(new URL('version.json?check=' + Date.now(), registration.scope), {cache:'no-store', credentials:'same-origin'});
    if (!response.ok) throw new Error('Gallery release unavailable');
    var release = await response.json();
    var actual = await workerIdentity(worker);
    if (!release || !actual || !release.build || release.build !== actual.build || release.version !== actual.version) throw new Error('Gallery worker mismatch');
  }
  async function prepareParentWorker() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    var registration = await navigator.serviceWorker.getRegistration(location.href);
    if (!registration) throw new Error('Worker unavailable');
    await registration.update();
    if (!registration.waiting && registration.installing) await awaitState(registration.installing, 'installed', 15000);
    var waiting = registration.waiting;
    if (!waiting) {
      // A newly activated worker may not yet control this page. A reload will use it.
      if (registration.active && registration.active !== navigator.serviceWorker.controller) { await verifyParent(registration.active, registration); return; }
      throw new Error('New worker not ready');
    }
    await verifyParent(waiting, registration);
    var activated = awaitState(waiting, 'activated', 20000);
    waiting.postMessage({type:'SKIP_WAITING'});
    await activated;
  }
  panel.addEventListener('toggle', function () { if (panel.open) { if (showVerified) { showVerified = false; return; } check(); } });
  retry.addEventListener('click', check);
  apply.addEventListener('click', async function () {
    if (!available || pending) return;
    if (document.querySelector('form[data-dirty="true"]') && !window.confirm(panel.dataset.confirm)) return;
    pending = true; retry.disabled = true; apply.disabled = true; output.textContent = panel.dataset.checking;
    try {
      await prepareParentWorker();
      sessionStorage.setItem(key, available);
      var url = new URL(location.href); url.searchParams.set('refresh', Date.now().toString()); location.assign(url.href);
    } catch (_) { output.textContent = panel.dataset.unverified; pending = false; retry.disabled = false; apply.disabled = false; }
  });
  document.querySelectorAll('form').forEach(function (form) { form.addEventListener('input', function () { form.dataset.dirty = 'true'; }); });
  function verifyReload() {
    var expected;
    try { expected = sessionStorage.getItem(key); sessionStorage.removeItem(key); } catch (_) { return; }
    if (!expected) return;
    var stylesheet = document.querySelector('link[rel="stylesheet"]');
    var verified = expected === current && document.documentElement.dataset.pomeloBoot === 'ready' && document.documentElement.dataset.pomeloApp === 'ready' && stylesheet && stylesheet.sheet;
    showVerified = true; panel.open = true; output.textContent = verified ? panel.dataset.updated : panel.dataset.unverified; apply.hidden = true;
    var url = new URL(location.href); url.searchParams.delete('refresh'); history.replaceState(null, '', url.href);
  }
  if (document.readyState === 'complete') verifyReload(); else window.addEventListener('load', verifyReload, {once:true});
})();
