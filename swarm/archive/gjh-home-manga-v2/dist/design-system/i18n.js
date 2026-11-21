// Only en uses inline templates; regional English catalogs use ordinary plural lookup.
(function (window, document) {
  'use strict';

  const selector = '[data-i18n], [data-i18n-attr]';
  const locales = { en: 'en-SG', 'zh-Hans': 'zh-Hans-SG', ms: 'ms-MY' };
  const originals = new WeakMap();
  const missing = new Set();
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  let language = 'en';
  let locale = locales.en;
  let messages = {};
  let pluralRules = new Intl.PluralRules(locale);
  let latestLoad = 0;

  async function load(lang) {
    if (typeof lang !== 'string') throw new TypeError('Expected an SDS language tag');
    const [code] = Intl.getCanonicalLocales(lang);
    const request = ++latestLoad;
    let next = {};
    if (code !== 'en') {
      const url = `i18n/${code}.json`;
      try {
        const response = await window.fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const catalog = await response.json();
        next = catalog && catalog.messages;
        if (!next || typeof next !== 'object' || Array.isArray(next)
          || Object.values(next).some(value => typeof value !== 'string')) {
          throw new Error('expected a messages object with string values');
        }
      } catch (error) {
        throw new Error(`Could not load SDS catalog ${url}: ${error.message}`);
      }
    }

    if (request !== latestLoad) return;
    language = code;
    locale = has(locales, code) ? locales[code] : code;
    pluralRules = new Intl.PluralRules(locale);
    messages = next;
    missing.clear();
    document.documentElement.lang = code;
  }

  function interpolate(template, vars) {
    return template.replace(/\{([\w.-]+)\}/g, (token, name) => (
      vars && has(vars, name) ? String(vars[name]) : token
    ));
  }

  function message(key, vars) {
    if (language === 'en') return undefined;
    const candidates = [key];
    if (vars && has(vars, 'n') && Number.isFinite(vars.n)) {
      candidates.unshift(`${key}.${pluralRules.select(vars.n)}`, `${key}.other`);
    }
    for (const candidate of candidates) {
      if (has(messages, candidate) && messages[candidate] !== '') return messages[candidate];
    }
    missing.add(key);
    return undefined;
  }

  function t(key, vars) {
    const template = message(key, vars);
    return interpolate(template === undefined ? key : template, vars);
  }

  function readVars(element) {
    try {
      const vars = JSON.parse(element.getAttribute('data-i18n-vars'));
      if (vars && typeof vars === 'object' && !Array.isArray(vars)) return vars;
    } catch {
      // Invalid variables leave placeholders intact.
    }
    return undefined;
  }

  function render(element, values, attr, key, vars) {
    const current = attr ? element.getAttribute(attr) : element.textContent;
    if (!values.has(attr)) values.set(attr, current);
    const translated = message(key, vars);
    const template = translated === undefined ? values.get(attr) : translated;
    const output = template === null ? null : interpolate(template, vars);
    if (current === output) return;
    if (!attr) element.textContent = output;
    else if (output === null) element.removeAttribute(attr);
    else element.setAttribute(attr, output);
  }

  function applyElement(element) {
    let values = originals.get(element);
    if (!values) {
      values = new Map();
      originals.set(element, values);
    }
    const vars = readVars(element);
    const key = element.getAttribute('data-i18n');
    if (key) render(element, values, null, key, vars);

    const attributes = element.getAttribute('data-i18n-attr');
    if (!attributes) return;
    for (const pair of attributes.split(';')) {
      const binding = /^([\w-]+)\s*:\s*([a-z0-9.-]+)$/.exec(pair.trim());
      if (binding) render(element, values, binding[1], binding[2], vars);
    }
  }

  function apply(root = document) {
    if (root.nodeType === 1 && root.matches(selector)) applyElement(root);
    for (const element of root.querySelectorAll(selector)) applyElement(element);
  }

  window.SDS = window.SDS || {};
  window.SDS.i18n = {
    load,
    apply,
    t,
    missing,
    format: {
      number: (n, opts) => new Intl.NumberFormat(locale, opts).format(n),
      date: (d, opts) => new Intl.DateTimeFormat(locale, opts).format(d),
      currency: (n, code = 'SGD') => new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(n),
    },
  };

  if (typeof window.MutationObserver === 'function') {
    const observer = new window.MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.isConnected) apply(node);
        }
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }
})(window, document);
