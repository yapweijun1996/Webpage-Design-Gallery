const stops = new Map(
  Array.from(document.querySelectorAll('.stop'), (stop) => ['#' + stop.id, stop])
);
const firstStop = stops.get('#outside');
const cut = document.querySelector('.dark-cut');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let animation;

function focusHeading(stop) {
  stop.querySelector('h1, h2').focus({ preventScroll: true });
}

function focusFragment() {
  const stop = location.hash ? stops.get(location.hash) : firstStop;
  if (stop) focusHeading(stop);
}

document.querySelector('main').addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

  const link = event.target.closest('a[href^="#"]');
  if (!link) return;

  const fragment = link.getAttribute('href');
  const stop = stops.get(fragment);
  if (!stop) return;

  if (location.hash === fragment) {
    // The browser still scrolls to the fragment, but does not fire hashchange.
    requestAnimationFrame(() => focusHeading(stop));
  }

  if (!reducedMotion.matches) {
    animation?.cancel();
    // Mask the native anchor jump, then reveal the new still over 240 ms.
    animation = cut.animate([
      { opacity: 1 },
      { opacity: 1, offset: .2 },
      { opacity: 0 },
    ], { duration: 240, easing: 'ease-out' });
  }
});

reducedMotion.addEventListener('change', () => animation?.cancel());
window.addEventListener('hashchange', focusFragment);
if (location.hash) focusFragment();

if (isSecureContext && 'serviceWorker' in navigator && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The tour remains readable if offline installation is unavailable.
    });
  }, { once: true });
}
