// Dialog: modal, alertdialog and bottom sheet. Replaces native <details>/<dialog> and window.confirm.
import {icon} from '../icons.generated.js';
import {t} from './i18n.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
let counter = 0;
const stack = [];
const originalInert = new Map();
let wasLocked = false;
let scrollY = 0;

function syncInert() {
  const top = stack[stack.length - 1];
  for (const node of document.body.children) {
    if (node.tagName === 'SCRIPT') continue;
    if (node.matches('[data-toast-region], [data-toast-live]') && !top?.blockToasts) {
      if (originalInert.has(node)) node.inert = originalInert.get(node);
      continue;
    }
    if (!originalInert.has(node)) originalInert.set(node, node.inert);
    node.inert = top ? node !== top.backdrop : originalInert.get(node);
  }
  if (!top) originalInert.clear();
}

/**
 * open({title, content: Node, variant: 'modal' | 'alertdialog' | 'sheet', actions: [Node], onClose})
 * Returns {close}. Focus moves in, Tab is trapped, focus returns to the opener on close.
 */
export function open({title, content, variant = 'modal', actions = [], onClose} = {}) {
  const id = `dialog-title-${++counter}`;
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  const panel = document.createElement('div');
  panel.className = `dialog dialog--${variant}`;
  panel.setAttribute('role', variant === 'alertdialog' ? 'alertdialog' : 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', id);
  const head = document.createElement('div');
  head.className = 'dialog__head';
  const heading = document.createElement('h2');
  heading.className = 'dialog__title';
  heading.id = id;
  heading.textContent = title;
  head.append(heading);
  if (variant !== 'alertdialog') {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-button';
    close.setAttribute('aria-label', t('dialog.close'));
    close.append(icon('x'));
    close.addEventListener('click', () => api.close());
    head.append(close);
  }
  const body = document.createElement('div');
  body.className = 'dialog__body';
  if (content) {
    if (!content.id) content.id = `dialog-body-${counter}`;
    panel.setAttribute('aria-describedby', content.id);
    body.append(content);
  }
  panel.append(head, body);
  if (actions.length) {
    const row = document.createElement('div');
    row.className = 'dialog__actions';
    row.append(...actions);
    panel.append(row);
  }
  backdrop.append(panel);

  const target = panel.querySelector('[data-autofocus]') || panel.querySelector(FOCUSABLE) || heading;
  if (target === heading) heading.tabIndex = -1;
  const api = mount(backdrop, panel, {onClose, initialFocus: target});
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && variant !== 'alertdialog') api.close(false);
  });
  return api;
}

/** Share modal stacking, inert restoration and scroll locking with non-dismissible overlays. */
export function mount(backdrop, panel, {onClose, initialFocus = panel, opener = document.activeElement,
  dismissible = true, blockToasts = false} = {}) {
  if (!stack.length) {
    scrollY = window.scrollY;
    wasLocked = document.body.classList.contains('is-locked');
  }
  const entry = {backdrop, blockToasts, initialFocus};
  stack.push(entry);
  document.body.classList.add('is-locked');
  document.body.append(backdrop);
  syncInert();

  function onKey(event) {
    if (stack[stack.length - 1] !== entry) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (dismissible) api.close(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
    if (!items.length) { event.preventDefault(); initialFocus.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (!panel.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey);

  let closed = false;
  const api = {
    panel,
    close(result) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      const wasTop = stack[stack.length - 1] === entry;
      stack.splice(stack.indexOf(entry), 1);
      backdrop.remove();
      syncInert();
      if (!stack.length) {
        document.body.classList.toggle('is-locked', wasLocked);
        window.scrollTo(0, scrollY);
      }
      if (wasTop && opener?.isConnected && !opener.closest('[inert]')) opener.focus();
      else if (wasTop && stack.length) {
        const top = stack[stack.length - 1];
        (top.backdrop.querySelector(FOCUSABLE) || top.initialFocus).focus();
      }
      if (onClose) onClose(result);
    },
  };
  initialFocus.focus();
  return api;
}

/** confirm({title, body, confirmLabel, cancelLabel}) resolves true or false. */
export function confirm({title, body, confirmLabel, cancelLabel}) {
  return new Promise((resolve) => {
    const text = document.createElement('p');
    text.textContent = body;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button button--ghost';
    cancel.textContent = cancelLabel || t('dialog.cancel');
    cancel.dataset.autofocus = '';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'button button--primary';
    ok.textContent = confirmLabel || t('dialog.confirm');
    const handle = open({title, content: text, variant: 'alertdialog', actions: [cancel, ok],
      onClose: (result) => resolve(result === true)});
    cancel.addEventListener('click', () => handle.close(false));
    ok.addEventListener('click', () => handle.close(true));
  });
}
