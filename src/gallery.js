const appRoot = new URL('../', import.meta.url);
const main = document.querySelector('main');
const urlFor = (path) => new URL(path, appRoot).href;
const icon = (name) => `<svg class="gallery-icon" aria-hidden="true" focusable="false"><use href="${urlFor('assets/icons.svg')}#${name}"></use></svg>`;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const params = new URLSearchParams(location.search);

function withQuery(url, values) {
  Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
  return url;
}

function setQuery(values, push = false) {
  const url = withQuery(new URL(location.href), values);
  if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null, '', url);
}

function selectValue(control, value, fallback) {
  control.value = [...control.options].some((option) => option.value === value) ? value : fallback;
}

function initialPreviewDevice() {
  const tokens = getComputedStyle(document.documentElement);
  const matches = (name) => matchMedia(`(max-width: ${tokens.getPropertyValue(name).trim()})`).matches;
  if (matches('--breakpoint-narrow')) return 'mobile';
  return matches('--breakpoint-medium') ? 'tablet' : 'desktop';
}

function initSettings() {
  const settings = document.querySelector('.gallery-settings');
  if (!settings) return;
  const summary = settings.querySelector('summary');
  const compact = matchMedia('(max-width: 1000px)');
  const sync = () => {
    if (compact.matches && settings.contains(document.activeElement)) summary.focus();
    settings.open = !compact.matches;
  };
  sync();
  compact.addEventListener('change', sync);
  // Reveal the verified update action instead of leaving it under settings.
  window.addEventListener('wdg:updateavailable', () => {
    if (compact.matches && settings.open) {
      const restore = settings.contains(document.activeElement);
      settings.open = false;
      if (restore) summary.focus();
    }
  });
  settings.addEventListener('toggle', () => {
    if (!compact.matches) return;
    if (settings.open && document.activeElement === summary) {
      settings.querySelector('select:not([disabled])')?.focus();
    } else if (!settings.open && settings.contains(document.activeElement)) summary.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && compact.matches && settings.open) {
      settings.open = false;
      summary.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (compact.matches && settings.open && !settings.contains(event.target)) {
      const restore = settings.contains(document.activeElement);
      settings.open = false;
      if (restore) summary.focus();
    }
  });
}

function initCompanies() {
  const cards = [...document.querySelectorAll('.company-card')];
  const search = document.querySelector('#company-search');
  const category = document.querySelector('#category-filter');
  const sort = document.querySelector('#company-sort');
  const grid = document.querySelector('.company-grid');
  const pages = document.querySelector('.pagination');
  const perPage = 12;
  let currentPage = 1;
  function restore() {
    const state = new URLSearchParams(location.search);
    search.value = state.get('q') || '';
    selectValue(category, state.get('category'), '');
    selectValue(sort, state.get('sort'), 'name');
    currentPage = Math.max(1, Number.parseInt(state.get('page'), 10) || 1);
  }
  restore();
  sort.closest('label').hidden = cards.length < 2;
  function searchText(text) {
    return text.trim().toLowerCase().replace(/['‘’]/g, '');
  }
  function update(reset = true, push = false) {
    if (reset) currentPage = 1;
    const query = searchText(search.value);
    const matches = cards.filter((card) => searchText(card.dataset.search + ' ' + card.textContent).includes(query) && (!category.value || card.dataset.categories.split(' ').includes(category.value)));
    matches.sort((a, b) => sort.value === 'designs' ? Number(b.dataset.count) - Number(a.dataset.count) || a.dataset.name.localeCompare(b.dataset.name) : a.dataset.name.localeCompare(b.dataset.name));
    const pageCount = Math.ceil(matches.length / perPage);
    currentPage = Math.max(1, Math.min(currentPage, pageCount || 1));
    setQuery({ q: search.value.trim(), category: category.value, sort: sort.value === 'name' ? '' : sort.value, page: currentPage > 1 ? String(currentPage) : '' }, push);
    cards.forEach((card) => { card.hidden = true; });
    matches.forEach((card, index) => { grid.append(card); card.hidden = index < (currentPage - 1) * perPage || index >= currentPage * perPage; });
    document.querySelector('.empty-results').hidden = matches.length > 0;
    const shown = Math.min(perPage, Math.max(0, matches.length - (currentPage - 1) * perPage));
    document.querySelector('.results-status').textContent = `Showing ${shown} of ${matches.length} matching ${matches.length === 1 ? 'company' : 'companies'}`;
    document.querySelector('.results-status').classList.toggle('visually-hidden', cards.length === 1 && !query && !category.value);
    pages.replaceChildren();
    if (pageCount > 1) {
      for (const [label, next, disabled] of [['Previous', currentPage - 1, currentPage === 1], ['Next', currentPage + 1, currentPage === pageCount]]) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = label; button.disabled = disabled;
        button.addEventListener('click', () => { currentPage = next; update(false, true); document.querySelector('#companies-heading').focus(); });
        pages.append(button);
      }
      const summary = document.createElement('span'); summary.textContent = `Page ${currentPage} of ${pageCount}`; pages.prepend(summary);
    }
  }
  document.querySelector('#companies-heading').tabIndex = -1;
  search.addEventListener('input', () => update()); category.addEventListener('change', () => update()); sort.addEventListener('change', () => update());
  document.querySelector('[data-reset]').addEventListener('click', () => { search.value = ''; category.value = ''; update(); search.focus(); });
  window.addEventListener('popstate', () => { restore(); update(false); });
  window.addEventListener('wdg:languagechange', () => update(false));
  update(false);
}

function initCompany() {
  const cards = [...document.querySelectorAll('.design-card')];
  if (cards.length < 2) return;
  const style = document.querySelector('#style-filter');
  const sort = document.querySelector('#design-sort');
  const selected = new Set();
  const compare = document.querySelector('#compare-selected');
  const tray = document.querySelector('.compare-tray');
  new ResizeObserver(() => document.documentElement.style.setProperty('--compare-tray-height', tray.hidden ? '0px' : tray.offsetHeight + 'px')).observe(tray);
  const company = document.querySelector('.design-section').dataset.company;
  function syncNavigation() {
    const [left, right] = selected;
    const state = { left, right, style: style.value, sort: sort.value === 'curated' ? '' : sort.value };
    setQuery(state);
    if (right) compare.href = withQuery(new URL('compare/index.html', appRoot), { company, ...state }).href;
    else compare.removeAttribute('href');
  }
  function updateSelection() {
    const choices = [...selected];
    document.querySelector('#selection-count').textContent = `${choices.length} of 2 selected`;
    document.querySelector('#selection-names').textContent = choices.length === 2 ? 'Ready to compare. Remove a design to choose another.' : choices.length ? 'Choose one more design. Selections stay when you filter.' : 'Choose two designs from this collection.';
    const items = document.querySelector('#selection-items');
    items.replaceChildren();
    choices.forEach((id) => {
      const card = cards.find((item) => item.dataset.design === id);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = card.dataset.title + ' ×';
      button.setAttribute('aria-label', 'Remove ' + card.dataset.title + ' from comparison');
      button.addEventListener('click', () => {
        selected.delete(id); updateSelection();
        const next = items.querySelector('button') || card.querySelector('input');
        if (!card.hidden || items.querySelector('button')) next.focus();
        else style.focus();
      });
      items.append(button);
    });
    tray.hidden = choices.length === 0;
    tray.classList.toggle('has-selection', choices.length > 0);
    cards.forEach((card) => {
      const input = card.querySelector('input');
      input.checked = selected.has(input.value); input.disabled = choices.length === 2 && !input.checked;
      card.classList.toggle('selected', input.checked);
    });
    compare.setAttribute('aria-disabled', String(choices.length !== 2));
    compare.tabIndex = choices.length === 2 ? 0 : -1;
    syncNavigation();
    document.querySelector('#clear-selection').disabled = choices.length === 0;
  }
  function restoreCollection() {
    const state = new URLSearchParams(location.search);
    selectValue(style, state.get('style'), '');
    selectValue(sort, state.get('sort'), 'curated');
    selected.clear();
    for (const key of ['left', 'right']) {
      const version = state.get(key);
      if (cards.some((card) => card.dataset.design === version)) selected.add(version);
    }
    updateSelection();
    filter();
  }
  function filter() {
    syncNavigation();
    let visible = 0;
    const ordered = [...cards].sort((a, b) => sort.value === 'title' ? a.dataset.title.localeCompare(b.dataset.title) : Number(a.dataset.order) - Number(b.dataset.order));
    ordered.forEach((card) => { document.querySelector('.design-grid').append(card); card.hidden = !!style.value && !card.dataset.styles.split(' ').includes(style.value); if (!card.hidden) visible += 1; });
    document.querySelector('.results-status').textContent = `Showing ${visible} of ${cards.length} designs`;
    document.querySelector('.empty-results').hidden = visible > 0;
  }
  cards.forEach((card) => card.querySelector('input').addEventListener('change', (event) => {
    if (event.target.checked && selected.size < 2) selected.add(event.target.value);
    else selected.delete(event.target.value);
    updateSelection();
  }));
  style.addEventListener('change', filter); sort.addEventListener('change', filter);
  document.querySelector('[data-reset]').addEventListener('click', () => { style.value = ''; filter(); style.focus(); });
  document.querySelector('#clear-selection').addEventListener('click', () => {
    selected.clear(); updateSelection(); style.focus();
  });
  compare.addEventListener('click', (event) => { if (selected.size !== 2) event.preventDefault(); });
  window.addEventListener('popstate', restoreCollection);
  restoreCollection();
}

async function catalog() {
  const responses = await Promise.all(['companies', 'designs'].map((name) => fetch(urlFor(`data/${name}.json`))));
  if (responses.some((response) => !response.ok)) throw new Error('The design collection could not be loaded.');
  const [companies, designs] = await Promise.all(responses.map((response) => response.json()));
  return { companies, designs };
}

function errorState(container, message) {
  container.innerHTML = `<div class="empty-results error-state"><h2>Let’s find another direction.</h2><p>${escape(message)}</p><a class="primary-link" href="${urlFor('index.html')}">Browse companies ${icon('arrow-right')}</a></div>`;
}

async function initDesign() {
  const container = document.querySelector('#detail-content');
  try {
    const { companies, designs } = await catalog();
    const company = companies.find((item) => item.id === params.get('company'));
    const design = designs.find((item) => item.companyId === company?.id && item.version === params.get('design'));
    if (!company || !design) throw new Error('This design could not be found. Choose a company to explore its available designs.');
    document.title = `${design.title} — ${company.name} design concept`;
    document.querySelector('#detail-breadcrumb').innerHTML = `<a href="${urlFor(`companies/${company.slug}/index.html`)}">${escape(company.name)}</a> / ${escape(design.title)}`;
    container.innerHTML = `<section class="detail-intro"><div><p class="eyebrow">${escape(company.name)} / ${escape(design.version.toUpperCase())}</p><h1>${escape(design.title)}</h1><p class="muted">${escape(design.description)}</p><div class="company-tags">${design.styles.map((style) => `<span>${escape(style)}</span>`).join('')}<span>Independent concept</span></div></div><a class="primary-link" href="${urlFor(design.demoPath)}">Open live demo ${icon('arrow-up-right')}</a></section><div class="detail-screen"><div class="device-control" role="group" aria-label="Screenshot device">${['desktop', 'tablet', 'mobile'].map((device) => `<button type="button" data-device="${device}" aria-pressed="${device === 'desktop'}">${device}</button>`).join('')}</div><div class="detail-image" tabindex="0" role="region" aria-label="Design screenshot. Use arrow keys to scroll."><img id="detail-screenshot" alt="${escape(design.title)} desktop screenshot"></div></div><div class="detail-meta"><div><strong>Company</strong><p>${escape(company.legalName)}</p></div><div><strong>Version</strong><p>${escape(design.version.toUpperCase())}</p></div><div><strong>Preview sizes</strong><p>1440 / 768 / 390px</p></div><div><strong>Gallery</strong><p><a href="${urlFor(`companies/${company.slug}/index.html`)}">All ${escape(company.name)} designs ${icon('arrow-right')}</a></p></div></div><aside class="concept-note"><p>${escape(design.disclaimer)} Screenshots show the captured design; open the live demo to explore its interactions.</p></aside>`;
    const image = document.querySelector('#detail-screenshot');
    function show(device) {
      const screenshot = design.screenshots[device]; image.src = urlFor(screenshot.path); image.width = screenshot.width; image.height = screenshot.height; image.alt = `${design.title} ${device} screenshot`; image.dataset.device = device;
      container.querySelectorAll('button[data-device]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.device === device)));
    }
    image.addEventListener('error', () => { image.alt = 'Screenshot unavailable. Please open the live demo.'; });
    container.querySelectorAll('button[data-device]').forEach((button) => button.addEventListener('click', () => show(button.dataset.device)));
    show(initialPreviewDevice());
  } catch (error) { errorState(container, error.message); }
}

async function initCompare() {
  const container = document.querySelector('#compare-content');
  document.querySelector('#compare-company').hidden = false;
  container.querySelector('.loading-message').hidden = false;
  try {
    const { companies, designs } = await catalog();
    const company = companies.find((item) => item.id === params.get('company'));
    const choices = ['left', 'right'].map((side) => designs.find((design) => design.companyId === company?.id && design.version === params.get(side)));
    if (!company || choices.some((design) => !design) || choices[0].id === choices[1].id) throw new Error('Choose two different designs from the same company to compare.');
    document.querySelector('#compare-company').textContent = company.name;
    const collection = urlFor(`companies/${company.slug}/index.html`);
    const style = params.get('style');
    const back = document.querySelector('#compare-back');
    back.href = withQuery(new URL(collection), {
      left: choices[0].version, right: choices[1].version,
      style: designs.some((design) => design.companyId === company.id && design.styles.includes(style)) ? style : '',
      sort: params.get('sort') === 'title' ? 'title' : ''
    }).href;
    back.textContent = `Back to ${company.name} designs`;
    document.querySelector('#compare-breadcrumb').textContent = company.name + ' / Compare';
    document.title = `${choices[0].title} vs ${choices[1].title} — ${company.name}`;
    container.innerHTML = `<div class="compare-toolbar"><div class="device-control" role="group" aria-label="Preview device">${['desktop', 'tablet', 'mobile'].map((device) => `<button type="button" data-device="${device}" aria-pressed="${device === 'desktop'}">${device}</button>`).join('')}</div><label class="sync-control"><input type="checkbox" id="sync-scroll">Sync scroll</label><label class="mode-control">View<select id="compare-mode"><option value="live">Live demos</option><option value="screenshots">Screenshots</option></select></label></div><p class="compare-help">Live previews scale to fit. Scroll each preview independently, or enable sync scroll to compare relative page positions.</p><p class="visually-hidden" id="compare-status" role="status" aria-live="polite"></p><div class="compare-grid">${choices.map((design, index) => `<section class="compare-panel" aria-label="${escape(design.title)} preview"><div class="compare-panel-header"><div><span class="version-badge">${escape(design.version.toUpperCase())}</span><h2>${escape(design.title)}</h2></div><a href="${urlFor(design.demoPath)}">Open demo ${icon('arrow-up-right')}</a></div><div class="frame-stage" data-panel="${index}"><iframe title="${escape(design.title)} live demo" src="${urlFor(design.demoPath)}"></iframe></div><div class="screenshot-stage" hidden><img alt="${escape(design.title)} comparison screenshot"></div><div class="panel-footer"><span data-size-label></span><button type="button" data-fullscreen="${index}">Fullscreen preview</button></div></section>`).join('')}</div><p class="small-note">Independent concepts. Sync scroll matches relative page position; different section heights can result in different content being visible.</p>`;
    const frames = [...container.querySelectorAll('iframe')];
    const sizes = { desktop: [1440, 900], tablet: [768, 1024], mobile: [390, 844] };
    let device = initialPreviewDevice(); let mode = 'live'; let syncing = false;
    const sync = document.querySelector('#sync-scroll');
    function resize() {
      const [width, height] = sizes[device];
      container.querySelectorAll('.frame-stage').forEach((stage) => {
        const frame = stage.querySelector('iframe'); const scale = Math.min(1, stage.clientWidth / width);
        stage.style.height = `${height * scale}px`; frame.style.width = `${width}px`; frame.style.height = `${height}px`; frame.style.transform = `scale(${scale})`; frame.style.left = `${Math.max(0, (stage.clientWidth - width * scale) / 2)}px`;
      });
    }
    function update() {
      container.querySelectorAll('button[data-device]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.device === device)));
      container.querySelectorAll('.compare-panel').forEach((panel, index) => {
        panel.querySelector('.frame-stage').hidden = mode !== 'live'; panel.querySelector('.screenshot-stage').hidden = mode === 'live';
        if (mode === 'screenshots') {
          const image = panel.querySelector('.screenshot-stage img');
          const source = urlFor(choices[index].screenshots[device].path);
          if (image.src !== source) image.src = source;
        }
        panel.querySelector('[data-size-label]').textContent = `${sizes[device][0]}px ${device} preview`;
        panel.querySelector('[data-fullscreen]').disabled = mode !== 'live' || !document.fullscreenEnabled;
      });
      sync.disabled = mode !== 'live'; resize();
      document.querySelector('#compare-status').textContent = `${device} ${mode === 'live' ? 'live previews' : 'screenshots'} selected`;
    }
    frames.forEach((frame, index) => frame.addEventListener('load', () => {
      const win = frame.contentWindow;
      // Official-site links leave the preview in a new tab, preserving the comparison.
      try {
        win.document.querySelectorAll('a[href]').forEach((link) => {
          if (link.href === collection) {
            link.href = back.href; link.target = '_top';
          } else if (new URL(link.href).origin !== location.origin) {
            link.target = '_blank'; link.rel = 'noopener noreferrer';
          }
        });
      } catch {
        document.querySelector('#compare-status').textContent = 'This preview has left the gallery. Use Open demo to return to the original design.';
        return;
      }
      win.addEventListener('scroll', () => {
        if (!sync.checked || syncing || mode !== 'live') return;
        const other = frames[1 - index].contentWindow;
        let ratio; let target;
        try {
          ratio = win.scrollY / Math.max(1, win.document.documentElement.scrollHeight - win.innerHeight);
          target = ratio * (other.document.documentElement.scrollHeight - other.innerHeight);
        } catch { return; }
        if (Math.abs(other.scrollY - target) < 2) return;
        syncing = true; other.scrollTo({ top: target, behavior: 'instant' }); requestAnimationFrame(() => { syncing = false; });
      }, { passive: true });
    }));
    container.querySelectorAll('button[data-device]').forEach((button) => button.addEventListener('click', () => { device = button.dataset.device; update(); }));
    document.querySelector('#compare-mode').addEventListener('change', (event) => { mode = event.target.value; update(); });
    container.querySelectorAll('[data-fullscreen]').forEach((button) => button.addEventListener('click', async () => {
      try { await frames[Number(button.dataset.fullscreen)].parentElement.requestFullscreen(); }
      catch { document.querySelector('#compare-status').textContent = 'Fullscreen is unavailable. Use Open demo for a full-size view.'; }
    }));
    new ResizeObserver(resize).observe(container.querySelector('.compare-grid'));
    document.addEventListener('fullscreenchange', resize);
    update();
  } catch (error) {
    document.querySelector('#compare-company').textContent = 'Comparison unavailable.';
    errorState(container, error.message);
  }
}

initSettings();

if (main?.dataset.page === 'companies') initCompanies();
if (main?.dataset.page === 'company') initCompany();
if (main?.dataset.page === 'design') initDesign();
if (main?.dataset.page === 'compare') initCompare();
