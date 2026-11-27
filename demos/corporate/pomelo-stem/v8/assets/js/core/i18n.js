// Runtime strings for the current page locale. The build embeds them from i18n/<lang>.json.
import {LOADER_DEFAULTS} from '../i18n-defaults.generated.js';

let table = {};

export function init() {
  const node = document.getElementById('i18n-runtime');
  try {
    table = node ? JSON.parse(node.textContent) : {};
  } catch (error) {
    table = {};
  }
}

export function t(key, vars = {}) {
  const language = (document.documentElement.lang || 'en').toLowerCase().split('-')[0];
  const defaults = LOADER_DEFAULTS[language] || LOADER_DEFAULTS.en;
  const text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : defaults[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function locale() {
  return table._intl || document.documentElement.lang || 'en';
}

export function formatPrice(amount) {
  try {
    return new Intl.NumberFormat(locale(), {style: 'currency', currency: 'MYR', currencyDisplay: 'narrowSymbol'}).format(amount);
  } catch (error) {
    return 'RM ' + Number(amount).toFixed(2);
  }
}
