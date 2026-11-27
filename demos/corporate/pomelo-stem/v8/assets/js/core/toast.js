// Toast: one module owns all toast DOM and the separate announcement nodes.
import {icon} from '../icons.generated.js';
import {t} from './i18n.js';

const ICONS = {info: 'info', success: 'check', warning: 'triangle-alert', error: 'circle-alert'};
const MAX = 3;
let region;
let live;
let alert;
let sequence = 0;

// Dwell times live only in tokens/primitives.json, separate from reduced-motion animation times.
export function toastDuration(kind = 'default') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--duration-toast-${kind}`).trim();
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
}

function regions() {
  if (region) return;
  region = document.querySelector('[data-toast-region]');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('data-toast-region', '');
    document.body.append(region);
  }
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', t('toast.region'));
  region.hidden = region.children.length === 0;
  live = document.createElement('div');
  live.className = 'visually-hidden';
  live.setAttribute('data-toast-live', '');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  alert = document.createElement('div');
  alert.className = 'visually-hidden';
  alert.setAttribute('data-toast-live', '');
  alert.setAttribute('role', 'alert');
  document.body.append(live, alert);
}

function changed() {
  region.hidden = region.children.length === 0;
  // Update floating-control clearance synchronously, before the next painted frame.
  region.dispatchEvent(new Event('toastchange'));
}

function moveFocusFrom(item) {
  if (!item.contains(document.activeElement)) return;
  const items = Array.from(region.children);
  const index = items.indexOf(item);
  const next = [...items.slice(index + 1), ...items.slice(0, index)]
    .find(candidate => !candidate.classList.contains('is-leaving'));
  const previous = item._returnFocus;
  const main = document.querySelector('#main');
  const target = next ? next.querySelector('.toast__close')
    : previous?.isConnected && previous !== document.body && previous !== document.documentElement ? previous : main;
  target?.focus({preventScroll: true});
  // An opener may still be connected but hidden or disabled.
  if (item.contains(document.activeElement) || document.activeElement === document.body) main?.focus({preventScroll: true});
}

function remove(item, immediate = false) {
  if (!item.isConnected) return;
  clearTimeout(item._timer);
  clearTimeout(item._removalTimer);
  clearTimeout(item._announcementTimer);
  const done = () => { moveFocusFrom(item); item.remove(); changed(); };
  if (immediate) { done(); return; }
  item.classList.add('is-leaving');
  moveFocusFrom(item);
  const duration = parseFloat(getComputedStyle(item).transitionDuration) || 0;
  if (duration === 0) done();
  else item._removalTimer = setTimeout(done, duration * 1000);
}

function pause(item) {
  clearTimeout(item._timer);
  if (item._deadline) item._remaining = Math.max(0, item._deadline - performance.now());
  item._deadline = 0;
}

function resume(item) {
  clearTimeout(item._timer);
  if (!item.isConnected || item._hovered || item.contains(document.activeElement) || item.classList.contains('is-leaving')) return;
  if (item._duration > 0) {
    item._deadline = performance.now() + item._remaining;
    item._timer = setTimeout(() => remove(item), item._remaining);
  }
}

function createItem() {
  const item = document.createElement('div');
  const glyph = document.createElement('span');
  glyph.className = 'toast__icon';
  const divider = document.createElement('span');
  divider.className = 'toast__divider';
  divider.setAttribute('aria-hidden', 'true');
  const text = document.createElement('div');
  text.className = 'toast__text';
  const title = document.createElement('p');
  title.className = 'toast__title';
  const detail = document.createElement('p');
  detail.className = 'toast__detail';
  text.append(title, detail);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close';
  close.append(icon('x'));
  close.addEventListener('click', () => remove(item));
  item.append(glyph, divider, text, close);
  item.addEventListener('mouseenter', () => { item._hovered = true; pause(item); });
  item.addEventListener('mouseleave', () => { item._hovered = false; resume(item); });
  item.addEventListener('focusin', (event) => {
    if (!item.contains(event.relatedTarget)) item._returnFocus = event.relatedTarget;
    pause(item);
  });
  item.addEventListener('focusout', () => queueMicrotask(() => resume(item)));
  return item;
}

function announce(item, type, message) {
  const target = type === 'error' ? alert : live;
  clearTimeout(item._announcementTimer);
  clearTimeout(target._timer);
  target.textContent = '';
  // A separate task makes even an identical replacement a fresh announcement.
  target._timer = setTimeout(() => { target.textContent = message; }, 0);
  item._announcementTimer = target._timer;
}

/**
 * toast({key, icon, type, title | titleKey | message | messageKey, detail | detailKey,
 *   vars, action: {label, onClick}, duration, sticky})
 * Same keys replace in place; identical title/detail pairs merge. Errors and sticky toasts persist.
 */
export function toast(options) {
  regions();
  const type = ICONS[options.type] ? options.type : 'info';
  const title = options.title ?? options.message ?? t(options.titleKey ?? options.messageKey, options.vars);
  const detail = options.detail ?? (options.detailKey ? t(options.detailKey, options.vars) : '');
  const key = options.key == null ? '' : String(options.key);
  const items = Array.from(region.children);
  let item = key ? items.find(existing => existing.dataset.key === key) : null;
  const identical = existing => existing.dataset.message === title && existing.dataset.detail === detail;
  item ||= items.find(identical);
  for (const existing of items) {
    if (existing !== item && identical(existing)) remove(existing, true);
  }
  if (!item) item = createItem();
  clearTimeout(item._timer);
  clearTimeout(item._removalTimer);
  item.className = `toast toast--${type}`;
  if (key) item.dataset.key = key;
  item.dataset.message = title;
  item.dataset.detail = detail;
  item._sequence = ++sequence;
  item._duration = options.sticky || type === 'error' ? toastDuration('sticky') : options.duration ?? toastDuration(options.action ? 'action' : 'default');
  item._remaining = item._duration;
  item._deadline = 0;
  item.dataset.icon = options.icon || ICONS[type];
  item.querySelector('.toast__icon').replaceChildren(icon(item.dataset.icon));
  item.querySelector('.toast__title').textContent = title;
  const description = item.querySelector('.toast__detail');
  description.textContent = detail;
  description.hidden = !detail;
  const close = item.querySelector('.toast__close');
  close.setAttribute('aria-label', t('toast.close'));
  let action = item.querySelector('.toast__action');
  if (options.action) {
    if (!action) {
      action = document.createElement('button');
      action.type = 'button';
      action.className = 'toast__action';
      item.insertBefore(action, close);
    }
    action.textContent = options.action.label;
    action.onclick = () => { remove(item); options.action.onClick(); };
  } else if (action) {
    if (action.contains(document.activeElement)) close.focus({preventScroll: true});
    action.remove();
  }
  if (!item.isConnected) region.append(item);
  // Make the new close button focusable before synchronous capacity eviction.
  region.hidden = false;
  while (region.children.length > MAX) remove(region.firstElementChild, true);
  changed();
  announce(item, type, [title, detail].filter(Boolean).join(' '));
  resume(item);
  return item;
}

export function dismissNewest() {
  const newest = region && Array.from(region.children).filter(item => !item.classList.contains('is-leaving'))
    .sort((a, b) => b._sequence - a._sequence)[0];
  if (!newest) return false;
  remove(newest);
  return true;
}

export function init() {
  regions();
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.querySelector('.dialog-backdrop')) dismissNewest();
  });
}
