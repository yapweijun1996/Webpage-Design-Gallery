/* Parser-blocking and tiny: apply the stored theme and language before first paint.
   Theme is this edition's own choice (dark by default). Language is shared with the
   gallery and the v11 mall through wdg.language. Blocked storage falls back to defaults. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  let theme = 'dark';
  let language = 'en';
  try {
    theme = localStorage.getItem('wdg.gjh-v24.theme') || theme;
    language = localStorage.getItem('wdg.language') || language;
  } catch { /* Defaults only. */ }
  root.dataset.theme = theme === 'light' ? 'light' : 'dark';
  if (['zh-Hans', 'ms'].includes(language)) root.lang = language === 'ms' ? 'ms-MY' : 'zh-Hans-SG';
})();
