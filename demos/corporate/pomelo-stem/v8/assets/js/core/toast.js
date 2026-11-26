// Toast: one module and one live region per page. Nobody else creates toast DOM.
import {icon} from '../icons.generated.js';
import {t} from './i18n.js';

const ICONS = {info: 'info', success: 'check', warning: 'triangle-alert', error: 'circle-alert'};
const MAX = 3;
let region;
let live;
let alert;

function regions() {
  if (region) return;
  region = document.querySelector('[data-toast-region]');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    document.body.append(region);
  }
  live = document.createElement('div');
  live.className = 'visually-hidden';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  alert = document.createElement('div');
  alert.className = 'visually-hidden';
  alert.setAttribute('role', 'alert');
  document.body.append(live, alert);
}

function remove(item) {
  if (!item.isConnected) return;
  clearTimeout(item._timer);
  item.classList.add('is-leaving');
  const done = () => item.remove();
  const duration = parseFloat(getComputedStyle(item).transitionDuration) || 0;
  if (duration === 0) done(); else setTimeout(done, duration * 1000 + 50);
}

function arm(item, duration) {
  clearTimeout(item._timer);
  if (duration > 0) item._timer = setTimeout(() => remove(item), duration);
}

/**
 * toast({type, message | messageKey, vars, action: {label, onClick}, duration, sticky})
 * Errors and sticky toasts stay until dismissed. Identical messages merge.
 */
export function toast(options) {
  regions();
  const type = ICONS[options.type] ? options.type : 'info';
  const message = options.message || t(options.messageKey, options.vars);
  for (const existing of region.children) {
    if (existing.dataset.message === message) {
      arm(existing, existing._duration);
      return existing;
    }
  }
  while (region.children.length >= MAX) remove(region.firstElementChild);
  const sticky = options.sticky || type === 'error';
  const duration = sticky ? 0 : options.duration || (options.action ? 6000 : 4000);
  const item = document.createElement('div');
  item.className = `toast toast--${type}`;
  item.dataset.message = message;
  item._duration = duration;
  const glyph = document.createElement('span');
  glyph.className = 'toast__icon';
  glyph.append(icon(ICONS[type]));
  const text = document.createElement('p');
  text.className = 'toast__text';
  text.textContent = message;
  item.append(glyph, text);
  if (options.action) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'toast__action';
    action.textContent = options.action.label;
    action.addEventListener('click', () => { remove(item); options.action.onClick(); });
    item.append(action);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close';
  close.setAttribute('aria-label', t('toast.close'));
  close.append(icon('x'));
  close.addEventListener('click', () => remove(item));
  item.append(close);
  item.addEventListener('mouseenter', () => clearTimeout(item._timer));
  item.addEventListener('mouseleave', () => arm(item, duration));
  item.addEventListener('focusin', () => clearTimeout(item._timer));
  item.addEventListener('focusout', () => arm(item, duration));
  region.append(item);
  (type === 'error' ? alert : live).textContent = message;
  arm(item, duration);
  return item;
}

export function dismissNewest() {
  if (region && region.lastElementChild) {
    remove(region.lastElementChild);
    return true;
  }
  return false;
}

export function init() {
  regions();
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.querySelector('.dialog-backdrop')) dismissNewest();
  });
}
