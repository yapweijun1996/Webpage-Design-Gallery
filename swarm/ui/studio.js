(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const query = new URLSearchParams(location.search);
  const devices = { desktop: 1440, tablet: 768, mobile: 393 };
  const deviceHeights = { desktop: 900, tablet: 1024, mobile: 844 };
  const viewport = $('view');
  let S, order = [];
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

  function startEvents(onEvent, onError) {
    const stream = new EventSource('/events');
    stream.onmessage = event => onEvent(JSON.parse(event.data));
    if (onError) stream.onerror = onError;
  }

  function syncThemeAttribute(theme = SDS.theme.get()) {
    const light = theme === 'light' || (theme === 'auto' && !matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.studioTheme = light ? 'light' : 'dark';
    return light;
  }

  function appearance() {
    return { theme: SDS.theme.get(), brand: SDS.brand.get(), lang: SDS.lang.get() };
  }

  function reviewAppearance() {
    const selected = appearance();
    if (selected.theme === 'auto') selected.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return selected;
  }

  function previewAgents() {
    const catalog = Array.isArray(S.previewSections) ? new Map(S.previewSections.map(({ id, section }) => [id, section])) : null;
    const assigned = order.map(id => {
      const { section, name, color, status, target } = S.agents[id];
      return { id, section: catalog ? catalog.get(id) || '' : section, name, color, status, target };
    });
    if (catalog) {
      for (const [id, section] of catalog) {
        if (!S.agents[id]) assigned.push({ id, section, name: section, color: '#64748b', status: 'idle', target: id });
      }
    }
    return assigned;
  }

  function setState(state) {
    S = state;
    order = Object.keys(state.agents).sort();
  }

  function refreshPreview(send, event) {
    if (event.kind !== 'sections') return;
    // A layer edit is attributed to its specialist, while the file identifies the section to refresh.
    const section = /^sections[\\/](\d{2})-/.exec(event.file)?.[1] || event.id;
    const catalog = S?.previewSections;
    if (Array.isArray(catalog) ? catalog.some(({ id }) => id === section) : S?.agents[section]?.section) send('edit', section);
  }

  if (query.get('preview')) {
    const preview = node('iframe');
    preview.title = 'Actual project preview';
    document.body.className = 'studio-stage studio-device-preview';
    document.body.replaceChildren(preview);
    const requestedWidth = Number(query.get('w'));
    const requestedHeight = Number(query.get('h'));
    const capture = Number.isInteger(requestedWidth) && requestedWidth >= 200 && requestedWidth <= 3000 &&
      Number.isInteger(requestedHeight) && requestedHeight >= 200 && requestedHeight <= 4000;
    const width = capture || Object.values(devices).includes(requestedWidth) ? requestedWidth : 0;
    if (capture) document.body.classList.add('studio-preview-capture');
    function fitDevice() {
      const scale = !capture && width ? Math.min(1, innerWidth / width) : 1;
      preview.style.width = (width || innerWidth) + 'px';
      preview.style.zoom = scale;
      preview.style.height = (capture ? requestedHeight : Math.floor(innerHeight / scale)) + 'px';
    }
    fitDevice();
    addEventListener('resize', fitDevice);
    if (!readStore('sds.theme')) SDS.theme.set('dark');
    const publish = () => {
      const selected = appearance();
      for (const key of Object.keys(selected)) {
        if (query.has(key)) selected[key] = query.get(key);
      }
      syncThemeAttribute(selected.theme);
      send('appearance', selected);
    };
    const publishAnchor = () => {
      const id = location.hash.slice(1);
      send('anchor', /^[\w-]{1,100}$/.test(id) ? id : '');
    };
    const send = StudioPreview.connect(preview, null, () => {
      publish();
      if (S) send('roster', previewAgents());
      publishAnchor();
    });
    preview.src = StudioPreview.stage;
    addEventListener('hashchange', publishAnchor);
    for (const key of ['theme', 'brand', 'lang']) SDS.on(key + 'change', publish);
    addEventListener('storage', event => {
      const preference = { 'sds.theme': 'theme', 'sds.brand': 'brand', 'sds.lang': 'lang' }[event.key];
      if (preference) SDS[preference].set(event.newValue);
    });
    function publishState(state) {
      setState(state);
      send('roster', previewAgents());
    }
    if (capture) {
      // A screenshot uses one roster snapshot. An open event stream can keep headless Chrome waiting.
      fetch('/api/state').then(response => response.ok ? response.json() : null)
        .then(state => { if (state) publishState(state); });
    } else {
      startEvents(event => {
        if (event.type === 'state') publishState(event.state);
        else if (event.type === 'edit') refreshPreview(send, event);
        else if (event.type === 'asset') send('asset', event.file);
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
    return StudioPreview.stage + '?w=' + devices[device] + '&h=' + deviceHeights[device];
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
    window.StudioAnchors?.show(name === 'review', reviewAppearance);
    window.StudioComponentHistory?.show(name === 'review');
    const compareModule = enhancement('StudioCompare');
    if (name === 'review' && !compareIsMounted && compareModule) {
      $('compare').replaceChildren();
      compareModule.mount($('compare'), { getActiveSrc, connectPreview: connectComparison });
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
    if (S?.agents[id]?.section) jump(id);
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
        if (target === 'versions') openVersions(compact.matches ? $('drawerbtn') : button);
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

  const versionsDialog = $('versions-dialog');
  const versionInput = $('version-name');
  const versionList = $('version-list');
  const versionStatus = $('version-status');
  const versionDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  let versionTrigger, versionCatalog, versionPending = false, versionReading = false, versionRead = 0;

  function selectedVersion() { return versionList.querySelector('input:checked')?.value; }

  function paintVersionActions() {
    const working = versionCatalog?.busy || S?.phase === 'running' || busy;
    const blocked = !versionCatalog || versionReading || versionPending || working;
    $('version-busy').hidden = !working;
    $('version-save-button').disabled = blocked;
    $('version-restore').disabled = blocked || !selectedVersion();
  }

  async function loadVersions() {
    if (!versionsDialog.open || versionPending) return;
    const request = ++versionRead;
    versionReading = true;
    paintVersionActions();
    try {
      const { ok, json } = await api('/api/versions');
      if (request !== versionRead) return;
      if (!ok) throw new Error(json.error);
      const previous = selectedVersion();
      const hadRowFocus = versionList.contains(document.activeElement);
      versionCatalog = json;
      versionList.replaceChildren(...json.versions.map(({ id, label, createdAt }) => {
        const row = node('li');
        const choice = node('label');
        const input = node('input');
        input.type = 'radio';
        input.name = 'saved-version';
        input.value = id;
        input.checked = id === previous;
        const info = node('span');
        info.append(node('strong', '', label || 'Saved version'));
        const date = new Date(createdAt);
        if (Number.isFinite(date.getTime())) {
          const time = node('time', '', versionDate.format(date));
          time.dateTime = createdAt;
          info.append(time);
        }
        choice.append(input, info);
        row.append(choice);
        return row;
      }));
      if (hadRowFocus) (versionList.querySelector('input:checked') || versionInput).focus({ preventScroll: true });
      $('version-empty').hidden = json.versions.length > 0;
      $('version-empty').textContent = 'No saved versions yet.';
    } catch {
      if (request !== versionRead) return;
      versionCatalog = null;
      versionList.replaceChildren();
      $('version-empty').hidden = false;
      $('version-empty').textContent = 'Versions could not be loaded. Reopen this panel to try again.';
    } finally {
      if (request === versionRead) {
        versionReading = false;
        paintVersionActions();
      }
    }
  }

  function openVersions(trigger) {
    versionTrigger = trigger;
    versionStatus.textContent = '';
    showPopover(null);
    closeAsk();
    versionsDialog.showModal();
    versionInput.focus();
    loadVersions();
  }

  async function changeVersion(restore) {
    const action = $(restore ? 'version-restore' : 'version-save-button');
    if (action.disabled) return;
    const fields = restore ? { id: selectedVersion() } : { label: versionInput.value };
    versionPending = true;
    versionStatus.textContent = restore ? 'Restoring version…' : 'Saving version…';
    paintVersionActions();
    try {
      const { ok, json } = await api(restore ? '/api/rollback' : '/api/versions', 'POST', { projectId: versionCatalog.projectId, ...fields });
      if (!ok) throw new Error(json.error || 'The version change could not finish.');
      if (!restore) versionInput.value = '';
      versionStatus.textContent = restore ? 'Version restored. Your previous design was saved.' : 'Version saved.';
    } catch (error) {
      versionStatus.textContent = error.message;
    } finally {
      versionPending = false;
      paintVersionActions();
      loadVersions();
    }
  }

  $('versions-open').onclick = event => openVersions(event.currentTarget);
  $('versions-close').onclick = () => versionsDialog.close();
  versionsDialog.addEventListener('click', event => { if (event.target === versionsDialog) versionsDialog.close(); });
  versionsDialog.addEventListener('close', () => {
    versionRead += 1;
    versionReading = false;
    if (versionTrigger?.getClientRects().length) versionTrigger.focus();
  });
  versionList.addEventListener('change', paintVersionActions);
  $('version-save').onsubmit = event => { event.preventDefault(); changeVersion(false); };
  $('version-restore').onclick = () => changeVersion(true);

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

  const comparisons = new Set();
  function synchronize(send) {
    send('appearance', appearance());
    if (S) send('roster', previewAgents());
  }
  function connectComparison(comparison) {
    const send = StudioPreview.connect(comparison, null, () => synchronize(send));
    comparisons.add(send);
    return () => { send.close(); comparisons.delete(send); };
  }
  const sendPreview = StudioPreview.connect(frame, onPreviewMessage, () => {
    frame.dataset.ready = '';
    synchronize(sendPreview);
    paintOverlays();
    setPicking(picking);
    updatePreview();
  });
  function publishPreview(type, data) {
    sendPreview(type, data);
    for (const send of comparisons) send(type, data);
  }

  function syncPreviewAppearance() {
    publishPreview('appearance', appearance());
    if (autoOn) onViewChange(true);
  }
  $('themebtn').onclick = () => SDS.theme.set(document.documentElement.dataset.studioTheme === 'light' ? 'dark' : 'light');
  SDS.on('themechange', paintTheme);
  SDS.on('brandchange', syncPreviewAppearance);
  SDS.on('langchange', syncPreviewAppearance);
  if (!readStore('sds.theme')) SDS.theme.set('dark');
  paintTheme();

  function paintOverlays() {
    sendPreview('overlays', { overlays, bubbles });
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
    $('newtab').href = '/studio.html?preview=1&w=' + devices[device];
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
    $('zoom-value').value = Math.round(zoom * 100) + '%';
    $('zoom-out').disabled = zoom <= 0.15;
    $('zoom-in').disabled = zoom >= 2;
    $('fit').setAttribute('aria-pressed', String(fit));
    requestPreviewView(report === true);
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

  function closePreviewUI() {
    if ($('setdlg').open) return;
    if (activePopover) showPopover(null, true);
    else if (document.body.dataset.drawer === 'open') setDrawer(false);
    else if (!$('askpop').hidden || picking) closeAsk();
    else if (isFullscreen()) toggleFullscreen();
  }
  addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented) closePreviewUI();
  });

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
  function requestPreviewView(report = false) {
    if (!frame.getBoundingClientRect().width) return;
    sendPreview('view', { clip: visibleFrameRect(), zoom, focus: focusMode || autoOn, report });
  }

  function validScope(data) {
    if (!data || !Array.isArray(data.sections) || !Array.isArray(data.elements) || data.elements.length > 14) return null;
    if (data.sections.length > order.length) return null;
    const sections = [...new Set(data.sections)];
    if (!sections.length || !sections.every(id => typeof id === 'string' && order.includes(id) && S.agents[id].section)) return null;
    const elements = data.elements.map(item => StudioPreview.element(item, sections));
    return elements.every(Boolean) ? { primary: sections[0], sections, elements } : null;
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
    const scope = currentScope();
    if (!scope) return;
    const selected = reviewAppearance();
    const key = [scope.sections.join(','), scope.primary, selected.theme, selected.brand, selected.lang].join('|');
    if (!force && key === lastReport) return;
    lastReport = key;
    fetch('/api/focus', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...scope, appearance: selected }) }).catch(function () {});
  }
  function onViewChange(report) {
    if (!(focusMode || autoOn)) return;
    paintFocus();
    if (report) {
      clearTimeout(reportTimer);
      reportTimer = setTimeout(() => reportFocus(false), 1500);
    }
  }
  viewport.addEventListener('scroll', () => requestPreviewView(true), { passive: true });
  addEventListener('resize', () => requestPreviewView(true));
  $('focusbtn').onclick = function () {
    const open = $('focuspop').hidden;
    showPopover(open ? 'focuspop' : null);
    if (open) {
      selectWorkspace('design');
      requestPreviewView();
      paintFocus();
    }
  };
  $('swfocus').onclick = function () { if (autoOn) return; focusMode = !focusMode; writeStore('swarm.focusMode', focusMode ? '1' : '0'); scopeNow = null; requestPreviewView(); paintFocus(); };
  $('swauto').onclick = function () {
    autoOn = !autoOn; lastReport = '';
    fetch('/api/autopilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: autoOn }) }).then(function (r) { return r.json(); }).then(function (j) { ap = j; paintFocus(); reportFocus(true); }).catch(function () {});
    scopeNow = null; requestPreviewView(autoOn); paintFocus();
  };
  var squadOn = false;
  function paintSquad() { $('swsquad').setAttribute('aria-checked', squadOn ? 'true' : 'false'); }
  $('swsquad').onclick = function () { squadOn = !squadOn; paintSquad(); fetch('/api/squad', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: squadOn }) }).then(function (r) { return r.json(); }).then(function (j) { squadOn = !!j.on; paintSquad(); }).catch(function () {}); };
  fetch('/api/squad').then(function (r) { return r.json(); }).then(function (j) { squadOn = !!j.on; paintSquad(); }).catch(function () {});
  function currentScope() { return (focusMode || autoOn) ? scopeNow : null; }
  fetch('/api/autopilot').then(function (r) { return r.json(); }).then(function (j) { ap = j; autoOn = !!j.on; requestPreviewView(autoOn); paintFocus(); }).catch(function () {});

  // ---- pick an element on the page and tell its owner agent what to change, or ask why it is designed that way
  var picking = false, picked = null;
  function boxOver(item) {
    const rect = item.rect;
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
    const agent = S.agents[item.section];
    box.firstChild.textContent = item.tag + ' · ' + agent.name;
    box.style.borderColor = agent?.color || '';
    box.firstChild.style.background = agent?.color || '';
    return bounds;
  }

  function setPicking(on) {
    picking = on;
    sendPreview('picking', on);
    $('pick').setAttribute('aria-pressed', String(on));
    if (!on) {
      $('pickbox').hidden = true;
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

  function onPreviewMessage(type, data) {
    if (type === 'scope' && (focusMode || autoOn)) {
      scopeNow = validScope(data);
      onViewChange(data?.report === true);
    } else if (type === 'escape') {
      closePreviewUI();
    } else if (type === 'click' && activePopover) {
      showPopover(null);
    } else if (type === 'hover' || type === 'pick' || type === 'selection') {
      if (!picking || (type === 'selection') !== !!picked) return;
      const item = StudioPreview.element(data, order, true);
      const agent = item && S?.agents[item.section];
      if (!agent?.section) {
        if (picked) closeAsk();
        else $('pickbox').hidden = true;
        return;
      }
      if (type === 'hover') {
        boxOver(item);
        return;
      }
      if (type === 'selection' && (picked.agent !== agent || picked.item.path !== item.path)) return;
      const desc = '<' + item.tag + '> ' + (item.text ? '“' + item.text + '”' : '(no text)');
      picked = { item, agent, desc, section: agent.section };
      positionAsk();
      if (type === 'pick') {
        $('asktext').value = '';
        $('asktext').focus();
      }
    }
  }

  function positionAsk() {
    const { item, agent, desc } = picked;
    const rect = boxOver(item);
    const pop = $('askpop');
    pop.style.setProperty('--c', agent.color);
    pop.querySelector('.ah b').textContent = 'Tell ' + agent.name + ' (' + agent.section + ')';
    pop.querySelector('.ae').textContent = desc + '  ' + item.path;
    pop.hidden = false;
    const x = Math.min(Math.max(8, rect.left), innerWidth - pop.offsetWidth - 8);
    const y = rect.bottom + pop.offsetHeight + 18 <= innerHeight
      ? rect.bottom + 10 : Math.max(8, rect.top - pop.offsetHeight - 10);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  }

  function sendAsk(kind) {
    if (!picked) return;
    var t = $('asktext').value.trim();
    if (kind === 'change' && !t) { $('asktext').focus(); return; }
    var head = '@' + picked.agent.name + ' ';
    var where = 'section ' + picked.section + ', element ' + picked.desc + ' [' + picked.item.path + ']';
    var text = kind === 'change'
      ? head + 'Change request for ' + where + ': ' + t
      : head + 'Question, do not change anything, about ' + where + ': ' + (t || 'Why is it designed this way?') + ' Please answer in the channel.';
    const { section, tag, path } = picked.item;
    const scope = { sections: [picked.agent.id], elements: [{ section, tag, text: picked.item.text, path }], appearance: reviewAppearance() };
    fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from: 'owner', text: text.slice(0, 780), scope }) });
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
  let fastPreviewPending = false;

  $('fast-preview').onclick = async () => {
    const draft = $('composer').querySelector('textarea');
    if (!draft?.value.trim()) return draft?.focus();
    const value = draft.value;
    const status = $('fast-preview-status');
    fastPreviewPending = true;
    setPhase();
    status.textContent = 'Building preview…';
    try {
      const scope = currentScope();
      const { ok, json } = await api('/api/fast', 'POST', {
        text: value, projectId: S.projectId, appearance: reviewAppearance(),
        scope: scope ? { sections: scope.sections, elements: scope.elements } : undefined,
      });
      if (!ok) { status.textContent = json.error || 'The preview could not be built.'; return; }
      status.textContent = json.accepted ? 'Fast preview ready.' : 'Sent to the team.';
      if (draft.value === value) {
        draft.value = '';
        draft.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch { status.textContent = 'The preview request could not be completed.'; }
    finally { fastPreviewPending = false; setPhase(); }
  };

  function jump(id) {
    if (!S?.agents[id]?.section) return;
    selectWorkspace('design');
    requestAnimationFrame(() => sendPreview('jump', id));
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
    $('fast-preview').disabled = !connected || running || fastPreviewPending;
    $('phase').dataset.state = running && connected ? 'running' : 'idle';
    $('status-text').textContent = !connected ? 'Reconnecting' : running ? 'Running' : 'Idle';
    if (running) runningSince ||= timestamp || Date.now();
    else runningSince = 0;
    paintTimer();
    if (versionsDialog.open) paintVersionActions();
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
            body: JSON.stringify({ from: 'owner', text, scope: sc ? { sections: sc.sections, elements: sc.elements, appearance: reviewAppearance() } : undefined })
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
      setState(event.state);
      closeAsk();
      scopeNow = null;
      publishPreview('roster', previewAgents());
      updateProject();
      initChannel();
      renderLanes();
      const started = (S.feed || []).findLast(entry => S.phase === 'running'
        ? entry.type === 'phase' && entry.phase === 'running'
        : entry.type === 'busy' && entry.busy);
      setPhase(started?.ts);
      paintFocus();
      requestPreviewView();
      activityModule?.onEvent(event);
      loadVersions();
      window.StudioAnchors?.refresh();
      window.StudioComponentHistory?.refresh(busy);
      return;
    }

    activityModule?.onEvent(event);
    if (event.type === 'autopilot') {
      ap = event;
      autoOn = !!event.on;
      paintFocus();
      if (event.on && !event.primary) { lastReport = ''; requestPreviewView(true); }
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
        loadVersions();
        window.StudioAnchors?.refresh();
        window.StudioComponentHistory?.refresh();
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
        if (overlays && message.kind !== 'system' && S.agents[message.from]) {
          sendPreview('talk', { id: message.from, peers: message.kind === 'msg' ? peers : [], text: String(message.text || '').slice(0, 240) });
        }
        break;
      }
      case 'busy':
        busy = !!event.busy;
        window.SwarmChannel?.setBusy(busy);
        setPhase(event.ts);
        loadVersions();
        window.StudioAnchors?.refresh();
        window.StudioComponentHistory?.refresh(busy);
        break;
      case 'anchor':
        window.StudioAnchors?.refresh();
        break;
      case 'versions':
        loadVersions();
        window.StudioComponentHistory?.refresh();
        break;
      case 'doc':
        if (typeof event.file === 'string') window.SwarmDocs?.refresh(event.file.split('/').pop());
        break;
      case 'status':
        if (!agent) break;
        agent.status = event.status;
        sendPreview('status', { id, status: event.status });
        window.SwarmChannel?.setStatus(id, event.status);
        break;
      case 'thought':
        if (!agent) break;
        agent.thought = event.text;
        if (overlays) sendPreview('thought', { id, text: String(event.text || '').slice(0, 240) });
        break;
      case 'action':
        if (!agent) break;
        agent.action = event.verb + (event.target !== id ? ' ' + event.target : '');
        agent.target = event.target;
        if (overlays) sendPreview('action', { id, target: event.target, verb: event.verb });
        break;
      case 'edit':
        refreshPreview(publishPreview, event);
        if (event.kind === 'sections') window.StudioAnchors?.previewChanged();
        break;
      case 'asset':
        publishPreview('asset', event.file);
        window.StudioAnchors?.previewChanged();
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

  frame.src = StudioPreview.stage;
  startEvents(onEvent, () => { connected = false; setPhase(); });
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
