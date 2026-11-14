const root = new URL('../', import.meta.url);
const supported = ['en', 'zh-Hans', 'ms'];
const attributes = ['aria-label', 'title', 'alt', 'placeholder'];
const originals = new WeakMap();
let bundles = {};
let language = 'en';
let observer;
let patterns = [];
const translations = new Map();
const storage = {
  get(key) { try { return localStorage.getItem('wdg.' + key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem('wdg.' + key, value); return true; } catch { return false; } },
};
const locale = () => ({ en: 'en-SG', 'zh-Hans': 'zh-Hans-SG', ms: 'ms-MY' }[language]);
export const formatNumber = (value) => new Intl.NumberFormat(locale()).format(value);
export const formatDate = (value, options = {}) => new Intl.DateTimeFormat(locale(), options).format(value);
export const formatCurrency = (value, currency = 'SGD') => new Intl.NumberFormat(locale(), { style: 'currency', currency }).format(value);

function translate(source) {
  const cacheKey = language + ':' + source;
  if (translations.has(cacheKey)) return translations.get(cacheKey);
  const pack = bundles[language] || bundles.en;
  if (!pack) return source;
  const text = source.trim().replace(/\s+/g, ' ');
  let result = Object.hasOwn(pack.messages, text) ? pack.messages[text] : undefined;
  if (result === undefined) {
    for (const { key, names, expression, fallback } of patterns) {
      const match = text.match(expression);
      if (!match) continue;
      result = (pack.patterns[key] || fallback).replace(/\{(\w+)\}/g, (_, name) => {
        const value = match[names.indexOf(name) + 1];
        return /^\d+$/.test(value) ? formatNumber(Number(value)) : (Object.hasOwn(pack.messages, value) ? pack.messages[value] : value);
      });
      break;
    }
  }
  if (result === undefined) return source;
  const output = source.slice(0, source.indexOf(source.trimStart())) + result + source.slice(source.trimEnd().length);
  if (translations.size > 2000) translations.clear();
  translations.set(cacheKey, output);
  return output;
}

// English source strings are the stable message keys. Retain them independently
// of rendered translations so switching language never translates a translation.
function renderValue(node, key, read, write) {
  const current = read();
  let values = originals.get(node);
  if (!values) { values = new Map(); originals.set(node, values); }
  const previous = values.get(key);
  const source = previous && current === previous.output ? previous.source : current;
  const output = translate(source);
  values.set(key, { source, output });
  if (output !== current) write(output);
}
function render() {
  observer?.disconnect();
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent.trim() && !node.parentElement.closest('script, style, noscript, textarea, [translate="no"]') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) {
    const node = walker.currentNode;
    renderValue(node, 'text', () => node.textContent, (value) => { node.textContent = value; });
  }
  document.querySelectorAll(attributes.map((name) => '[' + name + ']').join(',')).forEach((element) => {
    if (element.closest('[translate="no"]')) return;
    attributes.forEach((name) => {
      if (element.hasAttribute(name)) renderValue(element, name, () => element.getAttribute(name), (value) => element.setAttribute(name, value));
    });
  });
  observer?.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
}
function appearance(choice) {
  if (!['system', 'light', 'dark'].includes(choice)) choice = 'system';
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  const theme = document.querySelector('#theme-select');
  if (theme) theme.value = choice;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.querySelector('.site-header')).backgroundColor;
}
function setLanguage(value) {
  language = supported.includes(value) ? value : 'en';
  document.documentElement.lang = language;
  document.querySelector('#language-select').value = language;
  render();
  window.dispatchEvent(new Event('wdg:languagechange'));
}
async function init() {
  const controls = document.querySelector('.gallery-preferences');
  appearance(document.documentElement.dataset.themeChoice || 'system');
  document.querySelector('#theme-select').addEventListener('change', (event) => {
    const saved = storage.set('theme', event.target.value);
    appearance(event.target.value);
    document.querySelector('#preferences-status').textContent = saved ? 'Preferences saved.' : 'Preferences apply to this tab. Storage is unavailable.';
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => appearance(document.documentElement.dataset.themeChoice));
  const entries = await Promise.all(supported.map(async (code) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(new URL(`locales/${code}.json`, root), { signal: controller.signal });
        if (!response.ok) throw new Error('Language unavailable');
        const pack = await response.json();
        if (![pack.messages, pack.patterns].every((map) => map && typeof map === 'object' && !Array.isArray(map)) || Object.values({ ...pack.messages, ...pack.patterns }).some((value) => typeof value !== 'string')) throw new Error('Invalid language pack');
        return [code, pack];
      } finally { clearTimeout(timer); }
    } catch { return [code, null]; }
  }));
  bundles = Object.fromEntries(entries);
  // English markup remains usable if language resources are unavailable.
  if (!bundles.en) {
    const available = Object.values(bundles).find(Boolean);
    bundles.en = { messages: {}, patterns: Object.fromEntries(Object.keys(available?.patterns || {}).map((key) => [key, key])) };
  }
  patterns = Object.entries(bundles.en.patterns).sort(([a], [b]) => b.replace(/\{\w+\}/g, '').length - a.replace(/\{\w+\}/g, '').length).map(([key, fallback]) => {
    const names = [];
    const expression = key.split(/(\{\w+\})/).map((part) => {
      if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+?)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return { key, fallback, names, expression: new RegExp('^' + expression + '$') };
  });
  let queued = false;
  observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; render(); });
  });
  const preferred = storage.get('language') || 'en';
  setLanguage(bundles[preferred] ? preferred : 'en');
  document.querySelector('#language-select').addEventListener('change', (event) => {
    const choice = event.target.value;
    setLanguage(bundles[choice] ? choice : 'en');
    const saved = storage.set('language', language);
    const message = document.querySelector('#preferences-status');
    message.textContent = bundles[choice] ? (saved ? 'Preferences saved.' : 'Preferences apply to this tab. Storage is unavailable.') : 'Language unavailable. English is shown; try again after reconnecting.';
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'wdg.theme') appearance(event.newValue);
    if (event.key === 'wdg.language') setLanguage(bundles[event.newValue] ? event.newValue : 'en');
  });
  controls.hidden = false;
  document.documentElement.dataset.preferencesReady = 'true';
}
init();
