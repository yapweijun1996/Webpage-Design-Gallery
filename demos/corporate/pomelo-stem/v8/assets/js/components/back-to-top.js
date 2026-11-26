// Scroll-derived visibility, toast-stack clearance and focus after returning to the top.
export function init() {
  const button = document.querySelector('[data-back-to-top]');
  if (!button) return;
  const region = document.querySelector('[data-toast-region]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false;
  let finishAtTop;
  let cancelReturn = () => {};

  function sync() {
    pending = false;
    const threshold = 1.5 * window.innerHeight;
    const tall = document.documentElement.scrollHeight - window.innerHeight > threshold;
    const visible = tall && window.scrollY > threshold && !document.body.classList.contains('is-locked');
    button.inert = !visible;
    button.setAttribute('aria-hidden', String(!visible));
    button.dataset.state = visible ? 'visible' : 'hidden';
    if (finishAtTop && window.scrollY <= 0) finishAtTop();
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(sync);
  }

  function syncToasts() {
    if (region) {
      const height = region.getBoundingClientRect().height;
      const gap = parseFloat(getComputedStyle(region).rowGap) || 0;
      button.style.setProperty('--back-to-top-lift', `${height > 0 ? height + gap : 0}px`);
    }
    schedule();
  }

  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', syncToasts);
  window.addEventListener('load', schedule);
  window.addEventListener('pageshow', () => requestAnimationFrame(schedule));
  new MutationObserver(schedule).observe(document.body, {attributes: true, attributeFilter: ['class']});
  const sizes = new ResizeObserver(syncToasts);
  if (region) {
    region.addEventListener('toastchange', syncToasts);
    sizes.observe(region);
  }
  sizes.observe(document.body);
  syncToasts();
  sync();

  button.addEventListener('click', () => {
    cancelReturn();
    let timeout;
    function cleanup() {
      clearTimeout(timeout);
      document.removeEventListener('scrollend', onEnd);
      finishAtTop = null;
    }
    function finish() {
      const reachedTop = window.scrollY <= 0;
      cleanup();
      if (!reachedTop) return;
      const target = document.querySelector('main h1') || document.getElementById('main');
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({preventScroll: true});
    }
    function onEnd() {
      if (window.scrollY <= 0) finish();
    }
    cancelReturn = cleanup;
    finishAtTop = finish;
    document.addEventListener('scrollend', onEnd);
    timeout = setTimeout(finish, 3000);
    window.scrollTo({top: 0, behavior: reduced.matches ? 'auto' : 'smooth'});
    schedule();
  });
}
