// Remembers the chosen language. Locale URLs stay the source of truth; nothing redirects automatically.
const KEY = 'pomelo-v8-lang';

export function init() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-lang]');
    if (!link) return;
    try { localStorage.setItem(KEY, link.dataset.lang); } catch (error) { /* storage blocked */ }
  });
}
