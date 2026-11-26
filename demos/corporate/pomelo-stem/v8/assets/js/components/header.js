// Header: smart top bar and the mobile menu sheet.
import {t} from '../core/i18n.js';
import {open} from '../core/dialog.js';
import {close as closeLanguages, syncLinks} from './lang-menu.js';

export function init() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  let last = window.scrollY;
  let pending = false;
  function syncScroll() {
    const y = window.scrollY;
    const locked = document.body.classList.contains('is-locked');
    const focused = header.contains(document.activeElement);
    const languageOpen = header.querySelector('[data-lang-menu] button[aria-expanded="true"]');
    header.toggleAttribute('data-scrolled', y > 8);
    if (y < 48 || locked || focused || languageOpen || y < last) header.classList.remove('is-hidden');
    else if (y - last > 8) header.classList.add('is-hidden');
    last = y;
    pending = false;
  }
  syncScroll();
  window.addEventListener('pageshow', syncScroll);
  window.addEventListener('scroll', () => {
    if (!pending) {
      pending = true;
      requestAnimationFrame(syncScroll);
    }
  }, {passive: true});
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  for (const query of ['(min-width: 480px)', '(min-width: 768px)', '(min-width: 1024px)']) {
    window.matchMedia(query).addEventListener('change', closeLanguages);
  }

  const menu = header.querySelector('[data-menu-open]');
  if (!menu) return;
  menu.addEventListener('click', () => {
    closeLanguages();
    syncLinks(header);
    const wrap = document.createElement('div');
    wrap.className = 'dialog-menu';
    const nav = document.createElement('nav');
    nav.className = 'dialog-nav';
    nav.setAttribute('aria-label', t('menu.title'));
    for (const link of header.querySelectorAll('.site-nav__link')) {
      const copy = link.cloneNode(true);
      copy.className = '';
      nav.append(copy);
    }
    const langs = document.createElement('nav');
    langs.className = 'dialog-langs';
    langs.setAttribute('aria-label', t('lang.label'));
    for (const link of header.querySelectorAll('[data-lang-option]')) {
      const copy = link.cloneNode(true);
      langs.append(copy);
    }
    const theme = header.querySelector('[data-theme-toggle]').cloneNode(true);
    theme.className = 'button button--ghost dialog-theme';
    theme.append(document.createTextNode(t('menu.theme')));
    wrap.append(nav, langs, theme);
    open({title: t('menu.title'), content: wrap, variant: 'sheet'});
  });
}
