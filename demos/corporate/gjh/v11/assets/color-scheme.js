// Dark (default) or light page chrome for the visitor arrivals page. The 3D mall keeps its own lighting.
const KEY = 'gjh-v11-color-scheme';
const root = document.documentElement;
const button = document.querySelector('#arrival-theme');
const label = document.querySelector('#arrival-theme-label');
const themeColor = document.querySelector('meta[name="theme-color"]');
const COLORS = {dark: '#102d26', light: '#f4f1e6'};

function apply(scheme) {
  root.dataset.colorScheme = scheme;
  themeColor?.setAttribute('content', COLORS[scheme]);
  button?.setAttribute('aria-pressed', String(scheme === 'light'));
  if (label) label.textContent = scheme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
}
let current = root.dataset.colorScheme === 'light' ? 'light' : 'dark';
apply(current);
button?.addEventListener('click', () => {
  current = current === 'light' ? 'dark' : 'light';
  apply(current);
  try { localStorage.setItem(KEY, current); } catch { /* The choice lasts for this visit only. */ }
});
window.addEventListener('storage', event => {
  if (event.key === KEY && (event.newValue === 'light' || event.newValue === 'dark')) { current = event.newValue; apply(current); }
});
