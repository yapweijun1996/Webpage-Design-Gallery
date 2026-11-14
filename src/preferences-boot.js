// Apply appearance before CSS paints; blocked storage must never block the gallery.
(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  let choice = 'system';
  try { choice = localStorage.getItem('wdg.theme') || choice; } catch { /* Session-only preference. */ }
  if (!['light', 'dark', 'system'].includes(choice)) choice = 'system';
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
})();
