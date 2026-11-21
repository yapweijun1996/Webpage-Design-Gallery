(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search);
  const previewMode = query.get('preview');
  const previewUrl = '/studio.html?preview=1';
  const devices = { desktop: 1440, tablet: 768, mobile: 393 };
  const deviceHeights = { desktop: 900, tablet: 1024, mobile: 844 };
  const viewport = $('view');
  let stage, page, layer, linksSvg, S;
  let hosts = {}, cur = {}, hash = {}, seed = {}, order = [];
  let zoom = 1, overlays = false, bubbles = true;

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function node(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value != null) el.textContent = value;
    return el;
  }

  function hh(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; }
  function fetchText(u) { return fetch(u + '?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }); }

  function makeStage() {
    stage = node('div');
    stage.id = 'stage';
    page = node('div');
    page.id = 'page';
    layer = node('div');
    layer.id = 'cursors';
    layer.setAttribute('aria-hidden', 'true');
    stage.append(page, layer);
    document.body.className = 'studio-stage';
    document.body.replaceChildren(stage);
  }

  function build(state) {
    S = state;
    page.replaceChildren();
    layer.replaceChildren();
    linksSvg = stage.ownerDocument.createElementNS(ns, 'svg');
    linksSvg.setAttribute('class', 'links');
    layer.append(linksSvg);
    hosts = {};
    cur = {};
    hash = {};
    seed = {};
    order = Object.keys(S.agents).sort();
    for (const [index, id] of order.entries()) {
      const agent = S.agents[id];
      if (agent.section) {
        const host = node('div', 'host');
        host.id = 'host-' + id;
        host.style.setProperty('--c', agent.color);
        host.append(node('div', 'stub', agent.name + ' · ' + agent.section), node('style'), node('div', 'body'));
        page.append(host);
        hosts[id] = { el: host, timer: 0 };
        load(id, false);
      }
      if (previewMode) continue;
      const cursor = node('div', 'cursor');
      cursor.style.setProperty('--c', agent.color);
      cursor.innerHTML = '<div class="in"><svg viewBox="0 0 18 22"><path d="M1 1l15 8-6.5 1.8L7 17z" fill="var(--c)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg><div class="who"><span class="name"></span><span class="act"></span><div class="bub"></div></div></div>';
      cursor.querySelector('.name').textContent = agent.name;
      layer.append(cursor);
      cur[id] = { el: cursor, t: 0, working: /^working/.test(agent.status || '') };
      seed[id] = index * 7;
    }
    if (!previewMode) {
      updateProject();
      initChannel();
      renderLanes();
      const started = (state.feed || []).findLast(event => state.phase === 'running'
        ? event.type === 'phase' && event.phase === 'running'
        : event.type === 'busy' && event.busy);
      setPhase(started?.ts);
      onViewChange(false);
    }
  }

  // A cursor is visible only while its agent is really working or did something in the last 6 s (no idle ghosts).
  function touch(id, ms) { if (cur[id]) { cur[id].until = Date.now() + (ms || 6000); sweepLive(); } }
  function sweepLive() { var now = Date.now(); Object.keys(cur).forEach(function (id) { var c = cur[id]; c.el.classList.toggle('live', !!c.working || (c.until || 0) > now); }); }
  setInterval(sweepLive, 1000);
  function actText(e) {
    var cmd = String(e.cmd || '');
    var m = /(?:sections|notes|discussion|chat|inbox)\/[\w.\-]+|[\w\-]+\.(?:md|html|css|jsonl|json|js)\b/.exec(cmd);
    if (m) return e.verb + ' ' + m[0];
    return 'running ' + cmd.replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').slice(0, 26);
  }
  function setAct(id, text) { var el = cur[id] && cur[id].el.querySelector('.act'); if (el) { el.textContent = text || ''; el.title = text || ''; } }

  function load(id, animate) {
    var a = S.agents[id], host = hosts[id], base = '/p/sections/' + id + '-' + a.section;
    return Promise.all([fetchText(base + '.html'), fetchText(base + '.css')]).then(function (r) {
      if (hosts[id] !== host) return;
      var h = hh(r[0] + '|' + r[1]); if (hash[id] === h) return; hash[id] = h;
      var el = hosts[id].el, filled = r[0].trim().length > 60;
      var prevHtml = el.querySelector('.body').innerHTML, prevCss = el.querySelector('style').textContent;
      el.querySelector('.stub').style.display = filled ? 'none' : '';
      el.querySelector('.body').innerHTML = r[0]; el.querySelector('style').textContent = r[1];
      stage.ownerDocument.defaultView.SDS?.i18n?.apply();
      if (animate && filled && overlays) wipe(id);
      placeAll();
      if (animate && filled && (prevHtml.trim() || prevCss.trim())) visitChanges(id, changedElements(el, prevHtml, r[0], prevCss, r[1]));
    });
  }

  // ---- real change detection: compare the previous and the new fragment and find the elements that differ
  function changedElements(host, prevHtml, newHtml, prevCss, newCss) {
    var out = [], body = host.querySelector('.body'), tp = document.createElement('template');
    tp.innerHTML = prevHtml;
    function add(n) { if (n && n.nodeType === 1 && out.indexOf(n) < 0 && out.length < 12) out.push(n); }
    function attrs(n) { return Array.prototype.map.call(n.attributes, function (x) { return x.name + '=' + x.value; }).join(';'); }
    function walk(a, b) {
      if (!b) return;
      if (!a) { add(b.nodeType === 1 ? b : b.parentNode); return; }
      if (a.nodeType !== b.nodeType) { add(b.nodeType === 1 ? b : b.parentNode); return; }
      if (b.nodeType === 3) { if (a.nodeValue !== b.nodeValue) add(b.parentNode); return; }
      if (b.nodeType !== 1) return;
      if (a.tagName !== b.tagName || attrs(a) !== attrs(b)) { add(b); return; }
      var n = Math.max(a.childNodes.length, b.childNodes.length);
      for (var i = 0; i < n; i++) walk(a.childNodes[i], b.childNodes[i]);
    }
    var ca = tp.content.childNodes, cb = body.childNodes, n = Math.max(ca.length, cb.length);
    for (var i = 0; i < n; i++) walk(ca[i], cb[i]);
    if (prevCss !== newCss) {
      var old = {}; prevCss.split('}').forEach(function (r) { old[r.trim()] = 1; });
      newCss.split('}').forEach(function (r) {
        r = r.trim(); if (!r || old[r] || r.charAt(0) === '@') return;
        var sel = r.slice(0, r.indexOf('{')); if (!sel) return;
        sel.split(',').forEach(function (one) { try { var q = host.querySelectorAll(one.trim().replace(/::?[\w-]+(\([^)]*\))?\s*$/, '')); for (var k = 0; k < Math.min(q.length, 2); k++) add(q[k]); } catch (_) {} });
      });
    }
    return out;
  }
  function localPos(el) { var x = 0, y = 0, n = el; while (n && n !== stage) { x += n.offsetLeft || 0; y += n.offsetTop || 0; n = n.offsetParent; } return { x: x, y: y }; }
  // The cursor hops over the really changed elements, one by one, and each gets an outline in the agent colour.
  function visitChanges(id, els) {
    var c = cur[id]; if (!c || !els.length) return;
    var color = S.agents[id].color;
    c.pinned = true; setAct(id, 'editing ' + els.length + ' element' + (els.length > 1 ? 's' : ''));
    touch(id, els.length * 420 + 4000);
    els.forEach(function (n, i) {
      setTimeout(function () {
        if (!n.isConnected) return;
        var p = localPos(n); c.el.style.left = (p.x + 10) + 'px'; c.el.style.top = (p.y + 4) + 'px';
        if (overlays && !reducedMotion.matches) {
          n.animate([{ outline: '2px solid ' + color, outlineOffset: '2px' },
            { outline: '2px solid transparent', outlineOffset: '2px' }], { duration: 1400, easing: 'steps(1, end)' });
        }
      }, i * 420);
    });
  }

  function wipe(id) {
    var el = hosts[id].el, body = el.querySelector('.body');
    if (reducedMotion.matches) return;
    body.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1300, easing: 'cubic-bezier(.2,.7,.2,1)' });
    var s = document.createElement('div'); s.className = 'scan'; el.appendChild(s);
    var h = el.offsetHeight;
    var an = s.animate([{ top: '0px', opacity: 1 }, { top: Math.max(h - 3, 0) + 'px', opacity: 1 }, { top: Math.max(h - 3, 0) + 'px', opacity: 0 }], { duration: 1500, easing: 'cubic-bezier(.2,.7,.2,1)' });
    an.onfinish = function () { s.remove(); };
  }

  function mark(id, target) {
    var h = hosts[target]; if (!h) return;
    h.el.style.setProperty('--c', S.agents[id].color); h.el.classList.add('editing');
    clearTimeout(h.timer); h.timer = setTimeout(function () { h.el.classList.remove('editing'); }, 2600);
  }
  function pulse(id) { mark(id, id); }

  function place(id, target, force) {
    if (!cur[id]) return;
    if (cur[id] && cur[id].pinned && !force) return;
    var h = hosts[target || S.agents[id].target || id]; if (!h) return;
    var idx = order.indexOf(id), w = stage.clientWidth || 1000, th = h.el.offsetHeight || 100;
    var x = 12 + (idx % 5) * (w * 0.16) + (idx >= 5 ? w * 0.07 : 0);
    var y = h.el.offsetTop + 10 + (seed[id] * 53 % Math.max(th - 70, 30));
    cur[id].el.style.left = x + 'px'; cur[id].el.style.top = y + 'px';
  }
  function placeAll() { if (S) order.forEach(function (id) { place(id); }); }

  // Agent-to-agent talk: a dashed line between the two cursors for a few seconds, so the discussion is visible on the page.
  function talkLink(from, tos, text) {
    var a = cur[from]; if (!a || !S.agents[from]) return;
    var names = [];
    touch(from, 7000);
    place(from, S.agents[from].target || from, true);
    tos.forEach(function (t) {
      var b = cur[t]; if (!b || t === from || !S.agents[t]) return;
      names.push(S.agents[t].name); touch(t, 7000);
      if (!b.pinned) place(t, t, true);
      setTimeout(function () {
        if (!linksSvg) return;
        var x1 = parseFloat(a.el.style.left) + 9, y1 = parseFloat(a.el.style.top) + 11, x2 = parseFloat(b.el.style.left) + 9, y2 = parseFloat(b.el.style.top) + 11;
        if (isNaN(x1 + y1 + x2 + y2)) return;
        var ns = 'http://www.w3.org/2000/svg', col = S.agents[from]?.color;
        if (!col || a !== cur[from] || b !== cur[t]) return;
        var ln = stage.ownerDocument.createElementNS(ns, 'line'); ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2); ln.setAttribute('stroke', col);
        var dot = stage.ownerDocument.createElementNS(ns, 'circle'); dot.setAttribute('cx', x2); dot.setAttribute('cy', y2); dot.setAttribute('r', 6); dot.setAttribute('fill', col);
        linksSvg.appendChild(ln); linksSvg.appendChild(dot);
        setTimeout(function () { ln.remove(); dot.remove(); }, 6600);
      }, 520);
    });
    if (names.length) say(from, '\u2192 ' + names.join(', ') + ': ' + text, true);
  }

  var lastTalk = {};
  function say(id, text, fromChat) {
    var c = cur[id]; if (!c) return;
    if (fromChat) lastTalk[id] = Date.now();
    c.el.querySelector('.bub').textContent = text; c.el.classList.add('talk');
    clearTimeout(c.t); c.t = setTimeout(function () { c.el.classList.remove('talk'); }, 9000);
  }


  function startEvents(onEvent, onError) {
    const stream = new EventSource('/events');
    stream.onmessage = event => onEvent(JSON.parse(event.data));
    if (onError) stream.onerror = onError;
  }

  function syncThemeAttribute() {
    const theme = SDS.theme.get();
    const light = theme === 'light' || (theme === 'auto' && !matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.studioTheme = light ? 'light' : 'dark';
    return light;
  }

  if (previewMode) {
    syncThemeAttribute();
    SDS.on('themechange', syncThemeAttribute);
    const requestedWidth = Number(query.get('w'));
    // The comparison frame can be narrower than the selected device. Keep its
    // content viewport at the requested width before the comparison scales it.
    if (previewMode === '1' && Object.values(devices).includes(requestedWidth)) {
      document.body.className = 'studio-stage studio-device-preview';
      const preview = node('iframe');
      preview.title = 'Actual project preview';
      preview.src = previewUrl;
      preview.style.width = requestedWidth + 'px';
      document.body.replaceChildren(preview);
      const fitDevice = () => {
        const scale = Math.min(1, innerWidth / requestedWidth);
        preview.style.zoom = scale;
        preview.style.height = Math.floor(innerHeight / scale) + 'px';
      };
      fitDevice();
      addEventListener('resize', fitDevice);
      return;
    }
    makeStage();
    if (previewMode !== 'embedded') {
      startEvents(event => {
        if (event.type === 'state') build(event.state);
        else if (event.type === 'edit' && event.kind === 'sections' && hosts[event.id]) load(event.id, false);
      });
      addEventListener('storage', event => {
        const preference = { 'sds.theme': 'theme', 'sds.brand': 'brand', 'sds.lang': 'lang' }[event.key];
        if (preference) SDS[preference].set(event.newValue);
      });
    }
    return;
  }

  // Shell icons are static paths; labels and badges stay in their existing buttons.
  var ICON = {
    panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/>',
    pick: '<path d="M14 4.1 12 6M5.1 8l-2.9-.8M6 12l-1.9 2M7.2 2.2 8 5.1M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
    look: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.8-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.4-10-8.4Z"/>',
    swarm: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3 3m7-3-3 3m-7 7 3-3m7 3-3-3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    folder: '<path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    tasks: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2m-6 7 2 2 4-4m-6 8h6"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-15a3 3 0 0 1 0 6m5 9v-2a4 4 0 0 0-3-4"/>',
    versions: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    assets: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 4-4 3 3 5-6 4 5"/>',
    prompt: '<path d="m21 3-7 18-4-7-7-4 18-7Zm0 0L10 14"/>',
    compare: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18"/>',
    activity: '<path d="M2 12h4l3-7 5 14 3-7h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19"/>',
    moon: '<path d="M20.9 13.3A9 9 0 0 1 10.7 3.1 9 9 0 1 0 20.9 13.3Z"/>',
    sliders: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    desktop: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v3m-4 0h8"/>',
    tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 17h2"/>',
    mobile: '<rect x="8" y="3" width="8" height="18" rx="2"/><path d="M11 17h2"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14m-7-7v14"/>',
    fit: '<path d="M9 3H3v6m12-6h6v6m0 6v6h-6m-6 0H3v-6"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
    fullscreen: '<path d="M8 3H3v5m13-5h5v5m0 8v5h-5M3 16v5h5"/>',
    minimize: '<path d="M3 8h5V3m8 0v5h5m0 8h-5v5m-8 0v-5H3"/>',
    external: '<path d="M14 3h7v7m0-7-9 9m6 1v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
  };

  function setIcon(el, name) {
    el.querySelector(':scope > .studio-icon')?.remove();
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'studio-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICON[name];
    el.prepend(svg);
  }

  document.querySelectorAll('[data-icon]').forEach(el => setIcon(el, el.dataset.icon));
  setIcon($('askx'), 'close');
  const compact = matchMedia('(max-width: 900px)');
  const frame = $('preview-frame');
  let device = { 393: 'mobile', 768: 'tablet', 1440: 'desktop' }[readStore('swarm.studio.device')];
  let deviceChosen = !!device;
  let fit = true;
  let inspectorCollapsed = readStore('swarm.studio.inspector') === 'closed';
  let rightWidth = Number(readStore('swarm.studio.rightWidth')) || 344;
  let inspectorTab = 'activity';
  let compareIsMounted = false;
  let settingsReady = false;
  let unread = 0;

  function api(path, method, body) {
    return fetch(path, {
      method: method || 'GET',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(async response => ({ ok: response.ok, json: await response.json() }));
  }

  function updateSettingsPlacement() {
    const inline = document.body.dataset.workspace === 'team' && !$('setdlg').open;
    const root = $('setroot');
    const parent = inline ? $('team-settings') : $('setdlg');
    if (root.parentElement !== parent) parent.append(root);
    if (!inline && !$('setdlg').open) {
      window.SwarmSettings?.close();
      return;
    }
    if (!window.SwarmSettings) {
      root.textContent = 'Settings are unavailable.';
      return;
    }
    if (settingsReady) {
      SwarmSettings.open();
      return;
    }
    SwarmSettings.init({
      root,
      load: () => api('/api/settings').then(r => r.json),
      save: settings => api('/api/settings', 'PUT', settings).then(r => r.ok
        ? { ok: true, settings: r.json.settings }
        : { ok: false, errors: r.json.errors || [{ path: '', message: 'Save failed' }] }),
      test: query => api('/api/settings/test', 'POST', query).then(r => r.json),
      team: {
        load: () => api('/api/team').then(r => r.json),
        save: agents => api('/api/team', 'PUT', { agents }).then(r => r.ok
          ? { ok: true, agents: r.json.agents }
          : { ok: false, errors: r.json.errors || [{ path: '', message: r.json.error === 'busy' ? 'The team is working. Try again when it finishes.' : 'Save failed' }] })
      }
    });
    settingsReady = true;
  }

  let settingsTrigger;
  function openSettings(trigger) {
    settingsTrigger = trigger.closest('#viewmenu') ? $('viewbtn') : trigger;
    showPopover(null);
    $('setdlg').showModal();
    $('setbtn').setAttribute('aria-expanded', 'true');
    updateSettingsPlacement();
    $('setclose').focus();
  }
  $('setbtn').onclick = event => openSettings(event.currentTarget);
  $('model').onclick = event => openSettings(event.currentTarget);
  $('setclose').onclick = () => $('setdlg').close();
  $('setdlg').addEventListener('click', event => {
    const bounds = $('setdlg').getBoundingClientRect();
    if (event.target === $('setdlg') && event.clientX < bounds.left) $('setdlg').close();
  });
  $('setdlg').addEventListener('close', () => {
    $('setbtn').setAttribute('aria-expanded', 'false');
    updateSettingsPlacement();
    if (settingsTrigger?.getClientRects().length) settingsTrigger.focus();
  });

  function setRightWidth(width, persist) {
    rightWidth = Math.min(520, Math.max(320, width));
    document.body.style.setProperty('--studio-right', rightWidth + 'px');
    $('resize-handle').setAttribute('aria-valuenow', rightWidth);
    if (persist) writeStore('swarm.studio.rightWidth', rightWidth);
  }
  const handle = $('resize-handle');
  let drag;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, width: rightWidth };
    handle.setPointerCapture(event.pointerId);
    handle.setAttribute('data-resizing', '');
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) setRightWidth(Math.round(drag.width + drag.x - event.clientX));
  });
  handle.addEventListener('lostpointercapture', () => {
    drag = null;
    handle.removeAttribute('data-resizing');
    setRightWidth(rightWidth, true);
  });
  handle.addEventListener('keydown', event => {
    const values = { ArrowLeft: rightWidth + 16, ArrowRight: rightWidth - 16, Home: 320, End: 520 };
    if (!Object.hasOwn(values, event.key)) return;
    event.preventDefault();
    setRightWidth(values[event.key], true);
  });
  setRightWidth(rightWidth);

  function paintUnread() {
    const badge = $('unread');
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  }

  function setInspectorCollapsed(collapsed, persist) {
    inspectorCollapsed = collapsed;
    document.body.dataset.inspector = collapsed ? 'closed' : 'open';
    $('panel').setAttribute('aria-expanded', String(!collapsed));
    $('panel').setAttribute('aria-label', collapsed ? 'Expand activity panel' : 'Collapse activity panel');
    if (!collapsed) { unread = 0; paintUnread(); }
    if (persist) writeStore('swarm.studio.inspector', collapsed ? 'closed' : 'open');
  }
  $('panel').onclick = () => setInspectorCollapsed(!inspectorCollapsed, true);
  setInspectorCollapsed(inspectorCollapsed);

  function setSidebarCollapsed(collapsed) {
    document.body.dataset.sidebar = collapsed ? 'collapsed' : 'open';
    $('side-toggle').setAttribute('aria-expanded', String(!collapsed));
    $('side-toggle').setAttribute('aria-label', collapsed ? 'Expand project navigation' : 'Collapse project navigation');
    writeStore('swarm.studio.sidebar', document.body.dataset.sidebar);
  }
  $('side-toggle').onclick = () => setSidebarCollapsed(document.body.dataset.sidebar !== 'collapsed');
  setSidebarCollapsed(readStore('swarm.studio.sidebar') === 'collapsed');

  function setDrawer(open, restoreFocus = true) {
    if (open) showPopover(null);
    document.body.dataset.drawer = open ? 'open' : 'closed';
    $('drawerbackdrop').hidden = !open;
    $('drawerbtn').setAttribute('aria-expanded', String(open));
    const sidebar = $('sidebar');
    if (open) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
    }
    ['top', 'workspace', 'inspector', 'resize-handle', 'mobile-tabs'].forEach(id => { $(id).inert = open; });
    if (open) $('drawerclose').focus();
    else if (restoreFocus && compact.matches) $('drawerbtn').focus();
  }
  $('drawerbtn').onclick = () => setDrawer(true);
  $('drawerclose').onclick = () => setDrawer(false);
  $('drawerbackdrop').onclick = () => setDrawer(false);

  function enhancement(name) {
    return typeof window[name] === 'object' && typeof window[name]?.mount === 'function' ? window[name] : null;
  }

  const activityModule = enhancement('StudioActivity');
  if (activityModule) {
    activityModule.mount({
      progress: $('progress'), team: $('activity-team'), activity: $('activity'), artifacts: $('artifacts'),
      onOpenAgent: openAgent
    });
  }

  function getActiveSrc() {
    return previewUrl + '&w=' + devices[device] + '&h=' + deviceHeights[device];
  }

  function selectWorkspace(name, mobilePane = 'preview') {
    const previous = document.body.dataset.workspace;
    document.body.dataset.workspace = name;
    document.body.dataset.mobilePane = mobilePane;
    ['design', 'team', 'review'].forEach(mode => { $(mode).hidden = mode !== name; });
    paintSelection('[data-workspace-tab]', 'workspaceTab', name, 'aria-selected');
    paintSelection('[data-mobile-view]', 'mobileView', name === 'team' ? 'team' : name === 'design' ? mobilePane : '', 'aria-current');
    const nav = name === 'team' ? 'agents' : name === 'review' ? 'versions' : mobilePane === 'activity' ? 'tasks' : 'overview';
    paintSelection('[data-nav]', 'nav', nav, 'aria-current');
    const roster = name === 'team' ? $('workspace-roster') : $('inspector-roster');
    if ($('activity-team').parentElement !== roster) roster.append($('activity-team'));
    if (previous !== name) updateSettingsPlacement();
    const compareModule = enhancement('StudioCompare');
    if (name === 'review' && !compareIsMounted && compareModule) {
      $('compare').replaceChildren();
      compareModule.mount($('compare'), { getActiveSrc });
      compareIsMounted = true;
    } else if (name !== 'review' && compareIsMounted) {
      compareModule.destroy();
      compareIsMounted = false;
    }
    if (name !== 'design' || mobilePane !== 'preview') closeAsk();
    if (mobilePane === 'activity') {
      unread = 0;
      paintUnread();
    }
    if (name === 'design' && mobilePane === 'preview') requestAnimationFrame(updatePreview);
  }

  function selectInspector(name) {
    inspectorTab = name;
    ['activity', 'logs', 'artifacts'].forEach(key => { $(key + '-pane').hidden = key !== name; });
    paintSelection('[data-inspector-tab]', 'inspectorTab', name, 'aria-selected');
    if (name === 'logs') $('logs-dot').hidden = true;
  }

  function paintSelection(selector, field, value, attribute) {
    document.querySelectorAll(selector).forEach(button => {
      const selected = button.dataset[field] === value;
      if (attribute === 'aria-selected') {
        button.setAttribute(attribute, String(selected));
        button.tabIndex = selected ? 0 : -1;
      } else if (selected) button.setAttribute(attribute, 'page');
      else button.removeAttribute(attribute);
    });
  }

  function bindTabs(id, datasetKey, select) {
    const tabs = Array.from($(id).querySelectorAll('[role="tab"]'));
    tabs.forEach((button, index) => {
      button.onclick = () => select(button.dataset[datasetKey]);
      button.addEventListener('keydown', event => {
        const keys = { Home: 0, End: tabs.length - 1, ArrowRight: index + 1, ArrowLeft: index - 1 };
        if (!Object.hasOwn(keys, event.key)) return;
        event.preventDefault();
        const target = tabs[(keys[event.key] + tabs.length) % tabs.length];
        target.click();
        target.focus();
      });
    });
  }
  bindTabs('workspace-tabs', 'workspaceTab', selectWorkspace);
  bindTabs('inspector-tabs', 'inspectorTab', selectInspector);
  document.querySelectorAll('[data-mobile-view]').forEach(button => {
    button.onclick = () => {
      const target = button.dataset.mobileView;
      if (target === 'team') selectWorkspace('team');
      else if (target === 'activity') showInspector(inspectorTab);
      else selectWorkspace('design');
    };
  });

  function showInspector(tab) {
    selectWorkspace('design', 'activity');
    if (!compact.matches) setInspectorCollapsed(false);
    selectInspector(tab);
  }

  function openAgent(id) {
    if (hosts[id]) jump(id);
    else {
      selectWorkspace('team');
      const lane = Array.from($('lanes').children).find(item => item.dataset.agent === id);
      lane?.focus();
    }
  }

  document.querySelectorAll('[data-nav]').forEach(button => {
    button.onclick = () => {
      const target = button.dataset.nav;
      if (compact.matches) setDrawer(false);
      if (target === 'settings') {
        openSettings(compact.matches ? $('drawerbtn') : button);
        return;
      }
      if (target === 'tasks') showInspector('activity');
      else if (target === 'assets') showInspector('artifacts');
      else if (target === 'agents') selectWorkspace('team');
      else {
        selectWorkspace('design');
        if (target === 'versions') $('versions').focus();
      }
      paintSelection('[data-nav]', 'nav', target, 'aria-current');
    };
  });
  $('quick-prompt').onclick = () => {
    if (compact.matches) setDrawer(false, false);
    selectWorkspace('design');
    $('composer').querySelector('textarea')?.focus();
  };
  function openReview() {
    if (document.body.dataset.drawer === 'open') setDrawer(false);
    showPopover(null);
    selectWorkspace('review');
    $('review').querySelector('h2').focus({ preventScroll: true });
  }
  $('review').querySelector('h2').tabIndex = -1;
  $('quick-compare').onclick = $('compare-btn').onclick = $('menu-review').onclick = openReview;

  const popovers = { viewmenu: 'viewbtn', look: 'lookbtn', focuspop: 'focusbtn' };
  let activePopover;
  function showPopover(id, restoreFocus = false) {
    const last = activePopover;
    activePopover = id;
    for (const [popover, trigger] of Object.entries(popovers)) {
      $(popover).hidden = id !== popover;
      $(trigger).setAttribute('aria-expanded', String(id === popover));
    }
    if (id) $(id).querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    else if (restoreFocus && last) {
      const button = $(popovers[last]);
      (button.getClientRects().length ? button : $('viewbtn')).focus();
    }
  }
  $('viewbtn').onclick = () => showPopover(activePopover === 'viewmenu' ? null : 'viewmenu');
  $('lookbtn').onclick = () => showPopover(activePopover === 'look' ? null : 'look');
  document.addEventListener('click', event => {
    if (activePopover && !$(activePopover).contains(event.target) &&
      !Object.values(popovers).some(id => $(id).contains(event.target))) showPopover(null);
  });

  function paintTheme() {
    const light = syncThemeAttribute();
    setIcon($('themebtn'), light ? 'moon' : 'sun');
    $('themebtn').setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    syncPreviewAppearance();
  }

  function syncPreviewAppearance() {
    const frameSDS = frame.contentWindow?.SDS;
    for (const key of ['theme', 'brand', 'lang']) frameSDS?.[key].set(SDS[key].get());
  }
  $('themebtn').onclick = () => SDS.theme.set(document.documentElement.dataset.studioTheme === 'light' ? 'dark' : 'light');
  SDS.on('themechange', paintTheme);
  SDS.on('brandchange', syncPreviewAppearance);
  SDS.on('langchange', syncPreviewAppearance);
  if (!readStore('sds.theme')) SDS.theme.set('dark');
  paintTheme();

  function paintOverlays() {
    if (stage) {
      stage.ownerDocument.body.dataset.overlays = overlays ? 'on' : 'off';
      stage.ownerDocument.body.classList.toggle('nobub', !bubbles);
    }
    $('agents-overlay').setAttribute('aria-checked', String(overlays));
    $('bub').disabled = !overlays;
    $('bub').setAttribute('aria-checked', String(bubbles));
  }
  $('agents-overlay').onclick = () => { overlays = !overlays; paintOverlays(); };
  $('bub').onclick = () => { bubbles = !bubbles; paintOverlays(); };

  function setDevice(name, persist) {
    device = name;
    fit = true;
    if (persist) {
      deviceChosen = true;
      writeStore('swarm.studio.device', devices[device]);
    }
    document.querySelectorAll('[data-device]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.device === name));
    });
    $('device-size').value = devices[device] + ' px';
    $('newtab').href = getActiveSrc();
    updatePreview(persist === true);
  }
  function autoDevice() {
    if (!deviceChosen) setDevice(innerWidth <= 520 ? 'mobile' : compact.matches ? 'tablet' : 'desktop');
  }
  function updatePreview(report = false) {
    const width = devices[device];
    const style = getComputedStyle(viewport);
    const w = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const h = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (!width || w <= 0 || h <= 0) return;
    if (fit) zoom = Math.min(1, w / width);
    frame.style.width = width + 'px';
    frame.style.height = Math.floor(h / zoom) + 'px';
    frame.style.setProperty('--preview-zoom', zoom);
    stage?.style.setProperty('--inv', Math.min(3, 1 / zoom));
    $('zoom-value').value = Math.round(zoom * 100) + '%';
    $('zoom-out').disabled = zoom <= 0.15;
    $('zoom-in').disabled = zoom >= 2;
    $('fit').setAttribute('aria-pressed', String(fit));
    placeAll();
    onPreviewScroll(report === true);
  }
  function changeZoom(delta) {
    fit = false;
    zoom = Math.min(2, Math.max(0.15, zoom + delta));
    updatePreview(true);
  }
  function visibleFrameRect() {
    const outer = viewport.getBoundingClientRect();
    const inner = frame.getBoundingClientRect();
    return {
      top: Math.max(0, (outer.top - inner.top) / zoom),
      left: Math.max(0, (outer.left - inner.left) / zoom),
      bottom: Math.min(inner.height, outer.bottom - inner.top) / zoom,
      right: Math.min(inner.width, outer.right - inner.left) / zoom
    };
  }
  document.querySelectorAll('[data-device]').forEach(button => { button.onclick = () => setDevice(button.dataset.device, true); });
  $('zoom-out').onclick = () => changeZoom(-0.1);
  $('zoom-in').onclick = () => changeZoom(0.1);
  $('fit').onclick = () => { fit = true; updatePreview(true); };
  const previewShell = $('preview-shell');
  function isFullscreen() {
    return document.fullscreenElement === previewShell || previewShell.classList.contains('is-fullscreen');
  }
  function paintFullscreen() {
    const on = isFullscreen();
    const popoverParent = document.fullscreenElement === previewShell ? previewShell : document.body;
    for (const id of ['pickbox', 'askpop']) {
      if ($(id).parentElement !== popoverParent) popoverParent.append($(id));
    }
    $('fullscreen').setAttribute('aria-pressed', String(on));
    $('fullscreen').setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
    setIcon($('fullscreen'), on ? 'minimize' : 'fullscreen');
    updatePreview();
  }
  async function toggleFullscreen() {
    if (document.fullscreenElement === previewShell) await document.exitFullscreen();
    else if (previewShell.classList.contains('is-fullscreen')) previewShell.classList.remove('is-fullscreen');
    else {
      try { await previewShell.requestFullscreen(); }
      catch (_) { previewShell.classList.add('is-fullscreen'); }
    }
    paintFullscreen();
  }
  $('fullscreen').onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', paintFullscreen);

  function handleEscape(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || $('setdlg').open) return;
    if (activePopover) showPopover(null, true);
    else if (document.body.dataset.drawer === 'open') setDrawer(false);
    else if (!$('askpop').hidden || picking) closeAsk();
    else if (isFullscreen()) toggleFullscreen();
  }
  addEventListener('keydown', handleEscape);

  function updateCompactLayout() {
    const parent = compact.matches ? $('menu-tools') : $('top-tools');
    if ($('viewer-tools').parentElement !== parent) parent.append($('viewer-tools'));
    if (!compact.matches && document.body.dataset.drawer === 'open') setDrawer(false, false);
    autoDevice();
  }
  compact.addEventListener('change', updateCompactLayout);
  matchMedia('(max-width: 520px)').addEventListener('change', autoDevice);
  // ---- screen focus and autopilot: the team works only on the sections that are on screen
  var focusMode = false, autoOn = false, scopeNow = null, ap = null, reportTimer = 0, lastReport = '';
  focusMode = readStore('swarm.focusMode') === '1';
  var SCOPE_TAGS = { H1: 1, H2: 1, H3: 1, A: 1, BUTTON: 1, IMG: 1, P: 1, LI: 1, LABEL: 1, INPUT: 1, FIGCAPTION: 1 };
  function computeScope() {
    if (!S || !stage || !$('preview-frame').getBoundingClientRect().width) return null;
    var vr = visibleFrameRect(), found = [], els = [];
    order.forEach(function (id) {
      var h = hosts[id]; if (!h) return;
      var r = h.el.getBoundingClientRect(), vis = Math.min(r.bottom, vr.bottom) - Math.max(r.top, vr.top);
      if (vis >= 60 && r.height > 0 && r.right > vr.left && r.left < vr.right) found.push({ id: id, vis: vis, host: h.el });
    });
    if (!found.length) return null;
    found.sort(function (a, b) { return b.vis - a.vis; });
    found.forEach(function (f) {
      var n = 0;
      f.host.querySelectorAll('.body *').forEach(function (el) {
        if (n >= 6 || !SCOPE_TAGS[el.tagName]) return;
        var r = el.getBoundingClientRect(), vv = Math.min(r.bottom, vr.bottom) - Math.max(r.top, vr.top);
        if (r.height > 0 && r.right > vr.left && r.left < vr.right && vv >= r.height * 0.5 && els.length < 14) { n++; els.push({ section: f.id, tag: el.tagName.toLowerCase(), text: (el.textContent || el.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 60), path: pathOf(el) }); }
      });
    });
    return { primary: found[0].id, sections: found.map(function (f) { return f.id; }), elements: els };
  }
  function scopeLabel(sc) { return sc.sections.map(function (id) { return id + ' ' + (S.agents[id].section || ''); }).join(', '); }
  function paintFocus() {
    var on = focusMode || autoOn, chip = $('focuschip');
    $('focusbtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('swfocus').setAttribute('aria-checked', focusMode || autoOn ? 'true' : 'false');
    $('swauto').setAttribute('aria-checked', autoOn ? 'true' : 'false');
    var txt = '';
    if (autoOn) txt = '<b>Autopilot</b> \u00b7 ' + (ap && ap.primary ? ap.primary + ' ' + (S?.agents[ap.primary]?.section || '') + ' \u00b7 round ' + (ap.cycle || 0) + '/' + (ap.max || 2) + ' \u00b7 ' + (ap.status || '') : 'watching your screen');
    else if (focusMode) txt = '<b>Focus</b> \u00b7 ' + (scopeNow ? scopeLabel(scopeNow) : 'your requests only involve the sections on screen');
    chip.hidden = !on; if (on) chip.innerHTML = txt.replace(/&/g, '&amp;').replace(/<(?!\/?b>)/g, '&lt;');
    $('prompt-scope').hidden = !on || !scopeNow;
    if (on && scopeNow) $('prompt-scope').textContent = 'Scope: ' + scopeLabel(scopeNow);
    $('fstatus').textContent = autoOn ? (ap ? ap.status : 'on') : (focusMode ? 'Focus is on: ' + (scopeNow ? scopeLabel(scopeNow) : '') : 'Off');
  }
  function reportFocus(force) {
    if (!autoOn || !S) return;
    var sc = computeScope(); if (!sc) return;
    var key = sc.sections.join(',') + '|' + sc.primary; if (!force && key === lastReport) return; lastReport = key;
    fetch('/api/focus', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sc) }).catch(function () {});
  }
  function onViewChange(report) {
    if (!(focusMode || autoOn)) return;
    scopeNow = computeScope();
    paintFocus();
    if (report) {
      clearTimeout(reportTimer);
      reportTimer = setTimeout(() => reportFocus(false), 1500);
    }
  }
  viewport.addEventListener('scroll', () => onPreviewScroll(true), { passive: true });
  addEventListener('resize', () => onViewChange(true));
  $('focusbtn').onclick = function () {
    const open = $('focuspop').hidden;
    showPopover(open ? 'focuspop' : null);
    if (open) {
      selectWorkspace('design');
      scopeNow = computeScope();
      paintFocus();
    }
  };
  $('swfocus').onclick = function () { if (autoOn) return; focusMode = !focusMode; writeStore('swarm.focusMode', focusMode ? '1' : '0'); scopeNow = computeScope(); paintFocus(); };
  $('swauto').onclick = function () {
    autoOn = !autoOn; lastReport = '';
    fetch('/api/autopilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: autoOn }) }).then(function (r) { return r.json(); }).then(function (j) { ap = j; paintFocus(); reportFocus(true); }).catch(function () {});
    scopeNow = computeScope(); paintFocus();
  };
  var squadOn = false;
  function paintSquad() { $('swsquad').setAttribute('aria-checked', squadOn ? 'true' : 'false'); }
  $('swsquad').onclick = function () { squadOn = !squadOn; paintSquad(); fetch('/api/squad', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: squadOn }) }).then(function (r) { return r.json(); }).then(function (j) { squadOn = !!j.on; paintSquad(); }).catch(function () {}); };
  fetch('/api/squad').then(function (r) { return r.json(); }).then(function (j) { squadOn = !!j.on; paintSquad(); }).catch(function () {});
  function currentScope() { return (focusMode || autoOn) ? computeScope() : null; }
  fetch('/api/autopilot').then(function (r) { return r.json(); }).then(function (j) { ap = j; autoOn = !!j.on; onViewChange(false); }).catch(function () {});

  // ---- pick an element on the page and tell its owner agent what to change, or ask why it is designed that way
  var picking = false, picked = null, hoverEl = null;
  function pathOf(el) {
    var parts = [], n = el, body = n.closest('.body');
    while (n && n !== body && parts.length < 4) {
      var t = n.tagName.toLowerCase(), c = (n.className && typeof n.className === 'string') ? n.className.trim().split(/\s+/)[0] : '';
      parts.unshift(t + (c ? '.' + c : '')); n = n.parentElement;
    }
    return parts.join(' > ');
  }
  function ownerOf(el) { var host = el.closest('.host'); if (!host) return null; var id = host.id.replace('host-', ''); return S && S.agents[id] ? S.agents[id] : null; }
  function describe(el) { var txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60); return '<' + el.tagName.toLowerCase() + '> ' + (txt ? '\u201c' + txt + '\u201d' : '(no text)'); }
  function boxOver(el) {
    const rect = el.getBoundingClientRect();
    const clip = visibleFrameRect();
    const frame = $('preview-frame').getBoundingClientRect();
    const bounds = {
      left: frame.left + Math.max(rect.left, clip.left) * zoom,
      top: frame.top + Math.max(rect.top, clip.top) * zoom,
      right: frame.left + Math.min(rect.right, clip.right) * zoom,
      bottom: frame.top + Math.min(rect.bottom, clip.bottom) * zoom
    };
    const box = $('pickbox');
    box.hidden = bounds.right <= bounds.left || bounds.bottom <= bounds.top;
    if (box.hidden) return bounds;
    Object.assign(box.style, {
      left: bounds.left + 'px', top: bounds.top + 'px',
      width: bounds.right - bounds.left + 'px', height: bounds.bottom - bounds.top + 'px'
    });
    const agent = ownerOf(el);
    box.firstChild.textContent = el.tagName.toLowerCase() + (agent ? ' · ' + agent.name : '');
    box.style.borderColor = agent?.color || '';
    box.firstChild.style.background = agent?.color || '';
    return bounds;
  }

  function setPicking(on) {
    picking = on;
    stage?.ownerDocument.body.classList.toggle('picking', on);
    $('pick').setAttribute('aria-pressed', String(on));
    if (!on) {
      $('pickbox').hidden = true;
      hoverEl = null;
    }
  }

  function closeAsk() {
    $('askpop').hidden = true;
    picked = null;
    setPicking(false);
  }

  $('pick').onclick = function () {
    const enable = !picking;
    showPopover(null);
    selectWorkspace('design');
    closeAsk();
    setPicking(enable);
  };

  function onPreviewPointer(e) {
    if (!picking || !$('askpop').hidden) return;
    hoverEl = e.target.closest?.('.host .body *') || null;
    if (hoverEl) boxOver(hoverEl);
    else $('pickbox').hidden = true;
  }

  function onPreviewClick(e) {
    if (!picking) return;
    const el = e.target.closest?.('.host .body *');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const agent = ownerOf(el);
    if (!agent) return;
    picked = { el, agent, path: pathOf(el), desc: describe(el), section: agent.section };
    positionAsk();
    $('asktext').value = '';
    $('asktext').focus();
  }

  function positionAsk() {
    const { el, agent, desc, path } = picked;
    const rect = boxOver(el);
    const pop = $('askpop');
    pop.style.setProperty('--c', agent.color);
    pop.querySelector('.ah b').textContent = 'Tell ' + agent.name + ' (' + agent.section + ')';
    pop.querySelector('.ae').textContent = desc + '  ' + path;
    pop.hidden = false;
    const x = Math.min(Math.max(8, rect.left), innerWidth - pop.offsetWidth - 8);
    const y = rect.bottom + pop.offsetHeight + 18 <= innerHeight
      ? rect.bottom + 10 : Math.max(8, rect.top - pop.offsetHeight - 10);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  }

  function onPreviewScroll(report) {
    if (picked?.el.isConnected) positionAsk();
    else if (hoverEl?.isConnected) boxOver(hoverEl);
    onViewChange(report);
  }
  function sendAsk(kind) {
    if (!picked) return;
    var t = $('asktext').value.trim();
    if (kind === 'change' && !t) { $('asktext').focus(); return; }
    var head = '@' + picked.agent.name + ' ';
    var where = 'section ' + picked.section + ', element ' + picked.desc + ' [' + picked.path + ']';
    var text = kind === 'change'
      ? head + 'Change request for ' + where + ': ' + t
      : head + 'Question, do not change anything, about ' + where + ': ' + (t || 'Why is it designed this way?') + ' Please answer in the channel.';
    fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: 'owner', text: text.slice(0, 780), scope: { sections: [picked.agent.id], elements: [{ section: picked.agent.id, tag: picked.el.tagName.toLowerCase(), text: (picked.el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), path: picked.path }] } }) });
    closeAsk();
    showInspector('logs');
  }
  $('askpop').addEventListener('submit', function (e) { e.preventDefault(); sendAsk('change'); });
  $('askwhy').onclick = function () { sendAsk('why'); };
  $('askx').onclick = closeAsk;


  let lastRoster;
  let busy = false;
  let connected = false;
  let runningSince = 0;

  function jump(id) {
    if (!hosts[id]) return;
    selectWorkspace('design');
    requestAnimationFrame(() => {
      hosts[id]?.el.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start', container: 'nearest' });
      if (hosts[id]) pulse(id);
    });
  }

  function updateProject() {
    $('project-name').textContent = S.project || 'Swarm project';
    $('model').textContent = S.model || '';
    $('model').hidden = !S.model;
  }

  function renderLanes() {
    const list = $('lanes');
    list.replaceChildren();
    for (const id of order) {
      const agent = S.agents[id];
      const row = node('div');
      row.dataset.agent = id;
      row.tabIndex = -1;
      const name = node('dt', '', agent.name);
      if (agent.title) name.append(node('span', '', ' · ' + agent.title));
      row.append(name, node('dd', '', agent.lane || agent.section || ''));
      list.append(row);
    }
  }

  function setPhase(timestamp) {
    const running = S?.phase === 'running' || busy;
    $('phase').dataset.state = running && connected ? 'running' : 'idle';
    $('status-text').textContent = !connected ? 'Reconnecting' : running ? 'Running' : 'Idle';
    if (running) runningSince ||= timestamp || Date.now();
    else runningSince = 0;
    paintTimer();
  }

  function paintTimer() {
    const timer = $('timer');
    timer.hidden = !runningSince || !connected;
    if (timer.hidden) return;
    const seconds = Math.max(0, Math.floor((Date.now() - runningSince) / 1000));
    timer.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    timer.dateTime = 'PT' + seconds + 'S';
  }

  function initChannel() {
    const agents = order.map(id => {
      const { name, section, color } = S.agents[id];
      return { id, name, section, color };
    });
    const roster = JSON.stringify(agents);
    if (window.SwarmChannel && roster !== lastRoster) {
      lastRoster = roster;
      SwarmChannel.init({
        root: $('chan'), agents, onJump: jump,
        send(text) {
          const sc = currentScope();
          return fetch('/api/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ from: 'owner', text, scope: sc ? { sections: sc.sections, elements: sc.elements } : undefined })
          });
        }
      });
      // Keep the channel instance and its draft together while docking its native form below the preview.
      const form = $('chan').querySelector('.swarm-channel__composer');
      if (form) $('composer').replaceChildren(form);
      fetch('/api/chat?since=0', { cache: 'no-store' }).then(response => response.json()).then(result => {
        if (lastRoster === roster) SwarmChannel.setHistory(result.messages || []);
      }).catch(() => {});
    }
    const recentBusy = (S.feed || []).findLast(event => event.type === 'busy');
    busy = recentBusy ? !!recentBusy.busy : S.phase === 'running';
    window.SwarmChannel?.setBusy(busy);
    order.forEach(id => window.SwarmChannel?.setStatus(id, S.agents[id].status || ''));
  }

  function onEvent(event) {
    connected = true;
    if (event.type === 'state') {
      build(event.state);
      activityModule?.onEvent(event);
      return;
    }

    activityModule?.onEvent(event);
    if (event.type === 'autopilot') {
      ap = event;
      autoOn = !!event.on;
      paintFocus();
      if (event.on && !event.primary) { lastReport = ''; reportFocus(true); }
      return;
    }
    if (!S) return;

    const id = event.id;
    const agent = S.agents[id];
    switch (event.type) {
      case 'settings':
        S.model = event.model;
        updateProject();
        break;
      case 'round':
        S.round = event.round;
        break;
      case 'phase':
        S.phase = event.phase;
        setPhase(event.ts);
        break;
      case 'chat': {
        const message = event.msg;
        if (!message) break;
        window.SwarmChannel?.add(message);
        if (inspectorTab !== 'logs') $('logs-dot').hidden = false;
        if (message.kind !== 'system' && (compact.matches ? !($('inspector').getClientRects().length) : inspectorCollapsed)) {
          unread += 1;
          paintUnread();
        }
        const peers = (message.to || []).filter(peer => peer !== message.from && peer !== '00' && S.agents[peer]?.section);
        if (message.kind === 'msg' && S.agents[message.from]?.section && peers.length) talkLink(message.from, peers, message.text);
        else if (cur[message.from] && message.kind !== 'system') say(message.from, message.text, true);
        break;
      }
      case 'busy':
        busy = !!event.busy;
        window.SwarmChannel?.setBusy(busy);
        setPhase(event.ts);
        break;
      case 'doc':
        if (typeof event.file === 'string') window.SwarmDocs?.refresh(event.file.split('/').pop());
        break;
      case 'status':
        if (!agent) break;
        agent.status = event.status;
        cur[id].working = /^working/.test(event.status);
        if (cur[id].working) { cur[id].pinned = false; agent.target = id; }
        else setAct(id, '');
        window.SwarmChannel?.setStatus(id, event.status);
        sweepLive();
        place(id, id);
        break;
      case 'thought':
        if (!agent) break;
        agent.thought = event.text;
        if (Date.now() - (lastTalk[id] || 0) > 9000) say(id, event.text);
        break;
      case 'action':
        if (!agent) break;
        agent.action = event.verb + (event.target !== id ? ' ' + event.target : '');
        agent.target = event.target;
        seed[id] += 3;
        cur[id].pinned = false;
        touch(id);
        setAct(id, actText(event));
        place(id, event.target, true);
        mark(id, event.target);
        break;
      case 'edit':
        if (event.kind !== 'sections' || !hosts[id]) break;
        seed[id] += 5;
        agent.target = id;
        place(id, id);
        mark(id, id);
        load(id, true);
        break;
    }
  }

  window.SwarmDocs?.init({
    root: $('docs'), base: '/p/',
    files: ['review.md', 'decisions.md', 'direction.md', 'review1.md', 'review2.md']
  });
  updateCompactLayout();
  if (deviceChosen) setDevice(device);
  new ResizeObserver(updatePreview).observe(viewport);
  setInterval(paintTimer, 1000);

  frame.addEventListener('load', function connectFrame() {
    const doc = frame.contentDocument;
    if (!doc?.getElementById('stage')) return;
    frame.removeEventListener('load', connectFrame);
    stage = doc.getElementById('stage');
    page = doc.getElementById('page');
    layer = doc.getElementById('cursors');
    frame.dataset.ready = '';
    syncPreviewAppearance();
    paintOverlays();
    setPicking(picking);
    stage.addEventListener('pointermove', onPreviewPointer);
    stage.addEventListener('click', onPreviewClick, true);
    stage.addEventListener('pointerleave', () => { if (!picked) $('pickbox').hidden = true; });
    doc.addEventListener('keydown', handleEscape);
    doc.addEventListener('click', () => { if (activePopover) showPopover(null); });
    frame.contentWindow.addEventListener('scroll', () => onPreviewScroll(true), { passive: true });
    new ResizeObserver(() => { placeAll(); onPreviewScroll(false); }).observe(page);
    updatePreview();
    startEvents(onEvent, () => { connected = false; setPhase(); });
  });
  frame.src = '/studio.html?preview=embedded';
  // ---- tooltips that follow the cursor (data-tip-title + data-tip); keyboard focus shows them next to the control
  (function () {
    var tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    var cur = null;
    function fill(el) { var t = el.getAttribute('data-tip-title'), d = el.getAttribute('data-tip'); tip.textContent = ''; if (t) { var b = document.createElement('b'); b.textContent = t; tip.appendChild(b); } var sp = document.createElement('span'); sp.textContent = d || ''; tip.appendChild(sp); }
    function place(x, y) { var w = tip.offsetWidth, h = tip.offsetHeight, nx = x + 14, ny = y + 20; if (nx + w > innerWidth - 8) nx = x - w - 14; if (nx < 8) nx = 8; if (ny + h > innerHeight - 8) ny = y - h - 14; if (ny < 8) ny = 8; tip.style.transform = 'translate(' + Math.round(nx) + 'px,' + Math.round(ny) + 'px)'; }
    function hide() { cur = null; tip.classList.remove('on'); }
    document.addEventListener('pointerover', function (e) { if (e.pointerType === 'touch') return; var el = e.target.closest && e.target.closest('[data-tip]'); if (!el) return; cur = el; fill(el); tip.classList.add('on'); place(e.clientX, e.clientY); });
    document.addEventListener('pointermove', function (e) { if (cur) place(e.clientX, e.clientY); });
    document.addEventListener('pointerout', function (e) { if (cur && !(e.relatedTarget && cur.contains(e.relatedTarget))) hide(); });
    document.addEventListener('pointerdown', hide);
    document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('[data-tip]'); if (!el || !el.matches(':focus-visible')) return; cur = el; fill(el); tip.classList.add('on'); var r = el.getBoundingClientRect(); place(r.left, r.bottom); });
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  })();


})();
