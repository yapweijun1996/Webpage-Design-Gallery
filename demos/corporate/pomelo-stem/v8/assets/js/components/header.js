// Header: smart top bar and the mobile menu sheet.
import {t} from '../core/i18n.js';
import {open} from '../core/dialog.js';

export function init() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  let last = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const locked = document.body.classList.contains('is-locked');
    if (y < 48 || locked || y < last) header.classList.remove('is-hidden');
    else if (y - last > 8) header.classList.add('is-hidden');
    last = y;
  }, {passive: true});
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  const menu = header.querySelector('[data-menu-open]');
  if (!menu) return;
  menu.addEventListener('click', () => {
    const wrap = document.createElement('div');
    const nav = document.createElement('nav');
    nav.className = 'dialog-nav';
    nav.setAttribute('aria-label', t('menu.title'));
    for (const link of header.querySelectorAll('.site-nav__link')) {
      const copy = link.cloneNode(true);
      copy.className = '';
      nav.append(copy);
    }
    const langs = document.createElement('div');
    langs.className = 'dialog-langs';
    for (const link of header.querySelectorAll('.lang-switch__link')) {
      const copy = link.cloneNode(true);
      copy.className = '';
      langs.append(copy);
    }
    wrap.append(nav, langs);
    open({title: t('menu.title'), content: wrap, variant: 'sheet'});
  });
}
