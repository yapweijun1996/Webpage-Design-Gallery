/* GJH v24 shared behaviour: header state, mobile menu, cinematic reveal and hero parallax.
   Every page loads this file; page-specific behaviour lives in assets/page-*.js. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', scrollY > 24);
    update();
    addEventListener('scroll', update, {passive: true});

    const toggle = header.querySelector('.menu-toggle');
    const nav = header.querySelector('#site-nav');
    if (!toggle || !nav) return;
    const compact = matchMedia('(max-width: 1100px)');
    const setOpen = (open, returnFocus = false) => {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) nav.querySelector('a')?.focus({preventScroll: true});
      if (!open && returnFocus) toggle.focus({preventScroll: true});
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && header.classList.contains('is-open')) setOpen(false, true);
    });
    document.addEventListener('focusin', event => {
      if (header.classList.contains('is-open') && !header.contains(event.target)) setOpen(false);
    });
    compact.addEventListener('change', () => { if (!compact.matches) setOpen(false); });
  }

  function initReveal() {
    const items = [...document.querySelectorAll('[data-reveal]')];
    if (!items.length) return;
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, {rootMargin: '0px 0px -8% 0px', threshold: 0.12});
    items.forEach(item => observer.observe(item));
    // Content must never stay hidden if the observer is slow (e.g. print or a background tab).
    addEventListener('beforeprint', () => items.forEach(item => item.classList.add('is-visible')));
  }

  function initParallax() {
    const layers = [...document.querySelectorAll('[data-parallax]')];
    if (!layers.length) return;
    let frame = 0;
    const render = () => {
      frame = 0;
      if (reduceMotion.matches) {
        layers.forEach(layer => layer.style.removeProperty('--parallax'));
        return;
      }
      for (const layer of layers) {
        const rect = layer.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > innerHeight) continue;
        const speed = Number(layer.dataset.parallax) || 0.15;
        layer.style.setProperty('--parallax', `${Math.round(-rect.top * speed)}px`);
      }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(render); };
    addEventListener('scroll', request, {passive: true});
    addEventListener('resize', request);
    reduceMotion.addEventListener('change', request);
    render();
  }

  const start = () => { initHeader(); initReveal(); initParallax(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
