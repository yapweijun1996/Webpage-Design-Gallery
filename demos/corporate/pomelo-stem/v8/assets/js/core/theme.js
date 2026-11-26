// Light / dark theme. The inline boot script in <head> applies a saved choice before first paint.
import {t} from './i18n.js';
import {toast, toastDuration} from './toast.js';

const KEY = 'pomelo-v8-theme';

function current() {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function init() {
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (error) { /* storage blocked: still switch for this view */ }
    toast({key: 'theme', icon: next === 'dark' ? 'moon' : 'sun', type: 'info',
      message: t(next === 'dark' ? 'theme.dark' : 'theme.light'), duration: toastDuration('theme')});
  });
}
