// Runtime strings for the current page locale. The build embeds them from i18n/<lang>.json.
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
  const text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
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
