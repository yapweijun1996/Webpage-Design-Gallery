(function () {
  try {
    var language = localStorage.getItem('pomelo-v7-language');
    var page = location.pathname.match(/\/v7\/(index|commerce|how-it-works|services|about|contact)\.html$/);
    if ((language === 'zh' || language === 'ms') && page) {
      var target = new URL(language + '/' + page[1] + '.html', location.href);
      target.search = location.search; target.hash = location.hash;
      location.replace(target.href);
      return;
    }
    var saved = localStorage.getItem('pomelo-v7-theme');
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } catch (_) { document.documentElement.dataset.theme = 'light'; }
  document.documentElement.dataset.pomeloBoot = 'ready';
  document.documentElement.classList.add('booting');
  setTimeout(function () { document.documentElement.classList.remove('booting'); }, 3000);
})();
