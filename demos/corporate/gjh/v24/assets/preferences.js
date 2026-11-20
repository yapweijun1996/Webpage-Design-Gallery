/* GJH v24 preferences: theme toggle, language menu and page translation.
   English text in the HTML and page scripts is the stable message key; the
   dictionaries assets/i18n-<language>.json map it to Simplified Chinese and Malay.
   A MutationObserver translates content that page scripts render later. */
(() => {
  const root = document.documentElement;
  const LANGUAGES = {
    en: {code: 'EN', name: 'English', lang: 'en-SG'},
    'zh-Hans': {code: '中文', name: '简体中文', lang: 'zh-Hans-SG'},
    ms: {code: 'BM', name: 'Bahasa Melayu', lang: 'ms-MY'},
  };
  const ATTRIBUTES = ['aria-label', 'alt', 'placeholder', 'title'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg', 'CODE']);
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Session only. */ } },
  };
  const originals = new WeakMap();
  const dictionaries = {en: {messages: {}, patterns: []}};
  let language = 'en';
  let observer;

  function lookup(source) {
    const text = source.trim().replace(/\s+/g, ' ');
    if (!text || language === 'en') return source;
    const pack = dictionaries[language];
    let result = pack?.messages[text];
    // Counts rendered by page scripts ("17 brands") use anchored patterns with $1 placeholders.
    if (result === undefined && pack) {
      for (const [expression, replacement] of pack.patterns) {
        if (expression.test(text)) { result = text.replace(expression, replacement); break; }
      }
    }
    if (result === undefined) return source;
    return source.slice(0, source.indexOf(source.trimStart())) + result + source.slice(source.trimEnd().length);
  }

  // Keep the English source per node and slot so switching never translates a translation.
  function render(node, slot, read, write) {
    const current = read();
    let slots = originals.get(node);
    if (!slots) { slots = new Map(); originals.set(node, slots); }
    const previous = slots.get(slot);
    const source = previous && current === previous.output ? previous.source : current;
    const output = lookup(source);
    slots.set(slot, {source, output});
    if (output !== current) write(output);
  }

  function translateTree(start) {
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          return SKIP.has(node.nodeName) || node.closest('[data-no-translate]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        }
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const visit = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        render(node, 'text', () => node.nodeValue, value => { node.nodeValue = value; });
        return;
      }
      for (const name of ATTRIBUTES) {
        if (node.hasAttribute(name)) render(node, name, () => node.getAttribute(name), value => node.setAttribute(name, value));
      }
    };
    if (start.nodeType === Node.TEXT_NODE) {
      if (start.nodeValue.trim() && !start.parentElement?.closest('script, style, svg, [data-no-translate]')) visit(start);
      return;
    }
    if (start.nodeType !== Node.ELEMENT_NODE || start.closest('[data-no-translate]')) return;
    visit(start);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) visit(node);
  }

  function translatePage() {
    observer?.disconnect();
    translateTree(document.body);
    const title = document.querySelector('title');
    if (title) render(title, 'text', () => title.textContent, value => { title.textContent = value; });
    const description = document.querySelector('meta[name="description"]');
    if (description) render(description, 'content', () => description.content, value => { description.content = value; });
    observe();
  }

  function observe() {
    observer ??= new MutationObserver(records => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === 'characterData') translateTree(record.target);
        else if (record.type === 'attributes') translateTree(record.target);
        else record.addedNodes.forEach(node => translateTree(node));
      }
      observe();
    });
    observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES});
  }

  async function load(code) {
    if (dictionaries[code]) return dictionaries[code];
    const response = await fetch(`assets/i18n-${code}.json`);
    if (!response.ok) throw new Error(`Dictionary ${code}: ${response.status}`);
    const data = await response.json();
    dictionaries[code] = {
      messages: data.messages,
      patterns: Object.entries(data.patterns || {}).map(([expression, replacement]) => [new RegExp(expression), replacement]),
    };
    return dictionaries[code];
  }

  function syncLanguageControls() {
    const meta = LANGUAGES[language];
    root.lang = meta.lang;
    document.querySelectorAll('.lang-code').forEach(code => { code.textContent = meta.code; });
    document.querySelectorAll('.lang-toggle').forEach(button => {
      button.setAttribute('aria-label', `Language: ${meta.name}`);
      button.dataset.noTranslate = '';
    });
    document.querySelectorAll('[data-lang]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.lang === language));
    });
  }

  async function setLanguage(code, persist = false) {
    if (!LANGUAGES[code]) code = 'en';
    try {
      if (code !== 'en') await load(code);
    } catch {
      code = 'en'; // A missing dictionary leaves the English page intact.
    }
    language = code;
    if (persist) storage.set('wdg.language', code);
    syncLanguageControls();
    translatePage();
  }

  function setTheme(theme, persist = false) {
    root.dataset.theme = theme === 'light' ? 'light' : 'dark';
    if (persist) storage.set('wdg.gjh-v24.theme', root.dataset.theme);
    document.querySelectorAll('.theme-toggle').forEach(button => {
      const light = root.dataset.theme === 'light';
      button.setAttribute('aria-pressed', String(light));
      button.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.dataset.theme === 'light' ? '#f5f0e8' : '#080808');
  }

  function initLanguageMenu(menu) {
    const toggle = menu.querySelector('.lang-toggle');
    const list = menu.querySelector('.lang-list');
    const close = (returnFocus = false) => {
      list.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus();
    };
    toggle.addEventListener('click', () => {
      const open = list.hidden;
      list.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) (list.querySelector('[aria-pressed="true"]') || list.querySelector('button')).focus();
    });
    list.addEventListener('click', event => {
      const button = event.target.closest('[data-lang]');
      if (!button) return;
      close(true);
      setLanguage(button.dataset.lang, true);
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !list.hidden) { event.stopPropagation(); close(true); }
      if (!['ArrowDown', 'ArrowUp'].includes(event.key) || list.hidden) return;
      const items = [...list.querySelectorAll('button')];
      const index = items.indexOf(document.activeElement);
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
      event.preventDefault();
    });
    document.addEventListener('click', event => { if (!menu.contains(event.target)) close(); });
    menu.addEventListener('focusout', event => { if (!menu.contains(event.relatedTarget)) close(); });
  }

  function start() {
    document.querySelectorAll('.lang-menu').forEach(initLanguageMenu);
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true));
    });
    setTheme(root.dataset.theme);
    setLanguage(storage.get('wdg.language') || 'en');
    // Keep tabs, the gallery and the v11 mall in step.
    addEventListener('storage', event => {
      if (event.key === 'wdg.language') setLanguage(event.newValue || 'en');
      if (event.key === 'wdg.gjh-v24.theme') setTheme(event.newValue);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
