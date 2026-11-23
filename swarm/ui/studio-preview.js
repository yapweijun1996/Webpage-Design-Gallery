(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const page = document.getElementById('page');
  const layer = document.getElementById('cursors');
  const ns = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ownerOrigin = new URL(location.href).origin;
  let linksSvg, S, send, clip, focus, picking, selected, hovered;
  let hosts = {}, cur = {}, seed = {}, order = [];
  let overlays = false;
  let ready = false, anchor;

  function node(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value != null) el.textContent = value;
    return el;
  }

  function fetchText(url) {
    return fetch(url, { cache: 'no-store', credentials: 'omit' })
      .then(response => response.ok ? response.text() : '').catch(() => '');
  }

  function build(agents) {
    S = { agents: Object.fromEntries(agents.map(agent => [agent.id, agent])) };
    const roster = S;
    const sections = [];
    ready = false;
    page.replaceChildren();
    layer.replaceChildren();
    linksSvg = stage.ownerDocument.createElementNS(ns, 'svg');
    linksSvg.setAttribute('class', 'links');
    layer.append(linksSvg);
    hosts = {};
    cur = {};
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
        hosts[id] = { el: host, timer: 0, revision: 0, html: '', css: '' };
        sections.push(load(id, false));
      }
      const cursor = node('div', 'cursor');
      cursor.style.setProperty('--c', agent.color);
      cursor.innerHTML = '<div class="in"><svg viewBox="0 0 18 22"><path d="M1 1l15 8-6.5 1.8L7 17z" fill="var(--c)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg><div class="who"><span class="name"></span><span class="act"></span><div class="bub"></div></div></div>';
      cursor.querySelector('.name').textContent = agent.name;
      layer.append(cursor);
      cur[id] = { el: cursor, t: 0, working: /^working/.test(agent.status || '') };
      seed[id] = index * 7;
    }
    Promise.all(sections).then(() => {
      if (S !== roster) return;
      ready = true;
      scrollToAnchor();
    });
  }

  function scrollToAnchor() {
    if (!ready || anchor === undefined) return;
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: 'instant' });
    else scrollTo({ top: 0, behavior: 'instant' });
    anchor = undefined;
  }

  // A cursor is visible only while its agent is really working or did something in the last 6 s (no idle ghosts).
  function touch(id, ms) { if (cur[id]) { cur[id].until = Date.now() + (ms || 6000); sweepLive(); } }
  function sweepLive() { var now = Date.now(); Object.keys(cur).forEach(function (id) { var c = cur[id]; c.el.classList.toggle('live', !!c.working || (c.until || 0) > now); }); }
  setInterval(sweepLive, 1000);
  function setAct(id, text) { var el = cur[id] && cur[id].el.querySelector('.act'); if (el) { el.textContent = text || ''; el.title = text || ''; } }

  async function load(id, animate) {
    const agent = S.agents[id], host = hosts[id];
    const revision = ++host.revision;
    const base = '/p/sections/' + id + '-' + agent.section;
    const [html, css] = await Promise.all([fetchText(base + '.html'), fetchText(base + '.bundle.css')]);
    if (hosts[id] !== host || revision !== host.revision || (html === host.html && css === host.css)) return;
    const el = host.el;
    const prevHtml = host.html, prevCss = host.css;
    const filled = html.trim().length > 60;
    el.querySelector('.stub').style.display = filled ? 'none' : '';
    if (html !== prevHtml) el.querySelector('.body').innerHTML = html;
    if (css !== prevCss) el.querySelector('style').textContent = css;
    host.html = html;
    host.css = css;
    SDS.i18n.apply();
    if (animate && filled && overlays) wipe(id);
    placeAll();
    reportView(false);
    if (animate && filled && (prevHtml.trim() || prevCss.trim())) visitChanges(id, changedElements(el, prevHtml, prevCss, css));
  }

  // ---- real change detection: compare the previous and the new fragment and find the elements that differ
  function changedElements(host, prevHtml, prevCss, newCss) {
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


  const scopeTags = 'h1,h2,h3,a,button,img,p,li,label,input,figcaption';

  function elementInfo(el, section) {
    const parts = [];
    let current = el;
    while (current && !current.classList.contains('body') && parts.length < 4) {
      const firstClass = current.classList[0];
      parts.unshift(current.localName + (firstClass ? '.' + firstClass : ''));
      current = current.parentElement;
    }
    return {
      section, tag: el.localName,
      text: (el.textContent || el.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      path: parts.join(' > ').slice(0, 200)
    };
  }

  function describe(el) {
    if (!el?.isConnected) return null;
    const host = el.closest('.host');
    const id = host?.id.slice(5);
    if (!id || hosts[id]?.el !== host || !el.closest('.body')) return null;
    const { left, top, right, bottom } = el.getBoundingClientRect();
    return { ...elementInfo(el, id), rect: { left, top, right, bottom } };
  }

  function scope() {
    const visible = [];
    const elements = [];
    for (const id of order) {
      const host = hosts[id]?.el;
      if (!host) continue;
      const rect = host.getBoundingClientRect();
      const height = Math.min(rect.bottom, clip.bottom) - Math.max(rect.top, clip.top);
      if (height >= 60 && rect.right > clip.left && rect.left < clip.right) visible.push({ id, host, height });
    }

    visible.sort((a, b) => b.height - a.height);
    for (const { id, host } of visible) {
      let count = 0;
      for (const el of host.querySelectorAll('.body :is(' + scopeTags + ')')) {
        if (count >= 6 || elements.length >= 14) break;
        const rect = el.getBoundingClientRect();
        const height = Math.min(rect.bottom, clip.bottom) - Math.max(rect.top, clip.top);
        if (rect.height > 0 && rect.right > clip.left && rect.left < clip.right && height >= rect.height * 0.5) {
          elements.push(elementInfo(el, id));
          count++;
        }
      }
    }
    return { sections: visible.map(item => item.id), elements };
  }

  let reportPending = false;
  let requestFrame = 0;
  function reportView(report) {
    if (!clip) return;
    reportPending ||= report;
    if (requestFrame) return;
    requestFrame = requestAnimationFrame(() => {
      requestFrame = 0;
      if (focus) send('scope', { ...scope(), report: reportPending });
      if (selected) send('selection', describe(selected));
      else if (hovered) send('hover', describe(hovered));
      reportPending = false;
    });
  }

  function pickTarget(event) {
    return event.target.closest?.('.host .body *');
  }
  stage.addEventListener('pointermove', event => {
    if (!picking || selected || !event.isTrusted) return;
    hovered = pickTarget(event);
    if (hovered) reportView(false);
    else send('hover', null);
  });
  stage.addEventListener('pointerleave', () => {
    hovered = null;
    if (picking && !selected) send('hover', null);
  });
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    send?.('click', null);
    if (!picking || selected) return;
    const el = pickTarget(event);
    const item = describe(el);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    selected = el;
    send('pick', item);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.isTrusted && !event.defaultPrevented && event.key === 'Escape') send?.('escape', null);
  });
  // Only owner input and owner-side viewport changes can advance Autopilot.
  let inputUntil = 0;
  for (const type of ['wheel', 'pointerdown', 'touchmove', 'keydown']) {
    addEventListener(type, event => {
      if (event.isTrusted) inputUntil = performance.now() + 900;
    }, { capture: true, passive: true });
  }
  addEventListener('scroll', () => reportView(performance.now() < inputUntil), { passive: true });
  new ResizeObserver(() => {
    placeAll();
    reportView(false);
  }).observe(page);

  function syncTheme() {
    const theme = SDS.theme.get();
    const light = theme === 'light' || (theme === 'auto' && !matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.studioTheme = light ? 'light' : 'dark';
  }
  syncTheme();
  SDS.on('themechange', syncTheme);

  function receive([type, data]) {
    switch (type) {
      case 'appearance':
        for (const key of ['theme', 'brand', 'lang']) SDS[key].set(data[key]);
        break;
      case 'roster':
        build(data);
        break;
      case 'anchor':
        anchor = data;
        scrollToAnchor();
        break;
      case 'view':
        clip = data.clip;
        focus = data.focus;
        stage.style.setProperty('--inv', Math.min(3, 1 / data.zoom));
        reportView(data.report);
        break;
      case 'overlays':
        overlays = data.overlays;
        document.body.dataset.overlays = overlays ? 'on' : 'off';
        document.body.classList.toggle('nobub', !data.bubbles);
        break;
      case 'picking':
        picking = data;
        if (!picking) selected = hovered = null;
        document.body.classList.toggle('picking', picking);
        break;
      case 'jump':
        hosts[data]?.el.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
        mark(data, data);
        reportView(true);
        break;
      case 'edit':
        if (!hosts[data]) break;
        seed[data] += 5;
        S.agents[data].target = data;
        place(data, data);
        mark(data, data);
        load(data, true);
        break;
      case 'status':
        if (!cur[data.id]) break;
        cur[data.id].working = /^working/.test(data.status);
        if (cur[data.id].working) {
          cur[data.id].pinned = false;
          S.agents[data.id].target = data.id;
        } else setAct(data.id, '');
        sweepLive();
        place(data.id, data.id);
        break;
      case 'action':
        if (!cur[data.id]) break;
        S.agents[data.id].target = data.target;
        seed[data.id] += 3;
        cur[data.id].pinned = false;
        touch(data.id);
        setAct(data.id, data.verb);
        place(data.id, data.target, true);
        mark(data.id, data.target);
        break;
      case 'thought':
        if (Date.now() - (lastTalk[data.id] || 0) > 9000) say(data.id, data.text);
        break;
      case 'talk':
        if (data.peers.length) talkLink(data.id, data.peers, data.text);
        else say(data.id, data.text, true);
        break;
    }
  }

  function connect(event) {
    if (parent === window || event.source !== parent || event.origin !== ownerOrigin ||
        event.data !== StudioPreview.handshake || event.ports.length !== 1) return;
    removeEventListener('message', connect);
    const [port] = event.ports;
    const post = port.postMessage.bind(port);
    send = (type, data) => post([type, data]);
    port.onmessage = ({ data }) => receive(data);
  }
  addEventListener('message', connect);
}());
