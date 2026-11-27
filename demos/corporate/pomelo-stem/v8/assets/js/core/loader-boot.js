// Inlined in <head>: no module or stylesheet dependency, and content is visible by default.
(() => {
  let done = false;
  let main;
  let busy;
  let loader;
  let observer;
  function ready() {
    done = true;
    clearTimeout(delay);
    clearTimeout(safety);
    observer?.disconnect();
    if (loader) loader.hidden = true;
    document.body?.classList.remove('is-loading');
    if (main) {
      if (busy === null) main.removeAttribute('aria-busy');
      else main.setAttribute('aria-busy', busy);
    }
    main = null;
    document.removeEventListener('DOMContentLoaded', ready);
    window.removeEventListener('load', ready);
  }
  function show() {
    if (done) return;
    loader = document.getElementById('page-loader');
    if (!loader) {
      if (!observer) {
        observer = new MutationObserver(show);
        observer.observe(document.documentElement, {childList: true, subtree: true});
      }
      return;
    }
    observer?.disconnect();
    main = document.getElementById('main');
    if (main) {
      busy = main.getAttribute('aria-busy');
      main.setAttribute('aria-busy', 'true');
    }
    document.body.classList.add('is-loading');
    loader.hidden = false;
  }
  const delay = setTimeout(show, 400);
  const safety = setTimeout(ready, 8000);
  window.__pomeloV8PageReady = ready;
  document.addEventListener('DOMContentLoaded', ready, {once: true});
  window.addEventListener('load', ready, {once: true});
  window.addEventListener('pageshow', ready);
  window.addEventListener('pagehide', ready);
})();
