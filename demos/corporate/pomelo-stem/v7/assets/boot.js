(function () {
  try {
    var saved = localStorage.getItem('pomelo-v7-theme');
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch (_) { document.documentElement.dataset.theme = 'light'; }
  document.documentElement.dataset.pomeloBoot = 'ready';
  document.documentElement.classList.add('booting');
  setTimeout(function () { document.documentElement.classList.remove('booting'); }, 3000);
})();
