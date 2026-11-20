// Page chrome follows the color preference. The 3D décor has separate settings.
const KEY = 'gjh-v11-color-scheme';
const root = document.documentElement;
const button = document.querySelector('#arrival-theme');
const label = document.querySelector('#arrival-theme-label');
const themeColor = document.querySelector('meta[name="theme-color"]');
const system = window.matchMedia('(prefers-color-scheme: dark)');
const options = [...document.querySelectorAll('[data-menu-theme]')];
const COLORS = {dark: '#102d26', light: '#f4f1e6'};

let current = root.dataset.colorScheme === 'light' ? 'light' : 'dark';
try {
  if (localStorage.getItem(KEY) === 'system') current = 'system';
} catch { /* The choice lasts for this visit only. */ }
function apply() {
  const scheme = current === 'system' ? (system.matches ? 'dark' : 'light') : current;
  root.dataset.colorScheme = scheme;
  themeColor?.setAttribute('content', COLORS[scheme]);
  button?.setAttribute('aria-pressed', String(scheme === 'light'));
  if (label) label.textContent = scheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  for (const option of options) {
    const checked = option.dataset.menuTheme === current;
    option.setAttribute('aria-checked', String(checked));
    option.tabIndex = checked ? 0 : -1;
  }
}
function choose(preference) {
  current = preference;
  apply();
  try { localStorage.setItem(KEY, preference); } catch { /* Session only. */ }
}
apply();
button?.addEventListener('click', () => choose(root.dataset.colorScheme === 'light' ? 'dark' : 'light'));
for (const option of options) option.addEventListener('click', () => choose(option.dataset.menuTheme));
system.addEventListener('change', () => { if (current === 'system') apply(); });
window.addEventListener('storage', event => {
  if (event.key === KEY && ['light', 'dark', 'system'].includes(event.newValue)) {
    current = event.newValue;
    apply();
  }
});
