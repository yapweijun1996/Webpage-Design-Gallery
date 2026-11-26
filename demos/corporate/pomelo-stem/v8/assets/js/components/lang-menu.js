// A disclosure of ordinary locale links. Locale URLs remain the source of truth.
const KEY = 'pomelo-v8-lang';
let menu;
let button;
let list;

function fitPanel() {
  list.style.removeProperty('--lang-menu-shift');
  const rect = list.getBoundingClientRect();
  const gutter = parseFloat(getComputedStyle(list).paddingInlineStart);
  const shift = Math.max(gutter - rect.left, Math.min(0, document.documentElement.clientWidth - gutter - rect.right));
  list.style.setProperty('--lang-menu-shift', `${shift}px`);
}

export function syncLinks(root = document) {
  for (const link of root.querySelectorAll('a[data-lang]')) {
    const url = new URL(link.href);
    url.hash = window.location.hash;
    link.href = url.href;
  }
}

function setOpen(expanded) {
  if (!menu) return;
  if (expanded) {
    syncLinks(menu);
    fitPanel();
  }
  button.setAttribute('aria-expanded', String(expanded));
  list.inert = !expanded;
  list.setAttribute('aria-hidden', String(!expanded));
  menu.dataset.state = expanded ? 'open' : 'closed';
}

export function close() {
  setOpen(false);
}

export function init() {
  menu = document.querySelector('[data-lang-menu]');
  if (!menu) return;
  button = menu.querySelector('button');
  list = menu.querySelector('ul');
  setOpen(false);
  list.hidden = false;
  button.hidden = false;
  fitPanel();
  window.addEventListener('resize', () => { close(); fitPanel(); });
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    setOpen(true);
    const current = list.querySelector('[aria-current="true"]') || list.querySelector('a');
    current.focus({preventScroll: true});
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
    close();
    button.focus({preventScroll: true});
  });
  menu.addEventListener('focusout', (event) => {
    if (!menu.contains(event.relatedTarget)) close();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.contains(event.target)) close();
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) close();
    const link = event.target.closest('a[data-lang]');
    if (!link) return;
    syncLinks();
    try { localStorage.setItem(KEY, link.dataset.lang); } catch (error) { /* storage blocked */ }
  });
  syncLinks();
  window.addEventListener('hashchange', () => syncLinks());
}
