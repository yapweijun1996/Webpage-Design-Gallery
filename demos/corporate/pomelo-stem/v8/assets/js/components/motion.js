// Scroll reveals for blocks that start below the fold. Content stays visible if this never runs.
const TARGETS = '.section-head, .story-step, .card, .band__grid > li, .closing__inner, .service, .next-steps > *, .review-grid > *, .process > li, .facts > div, .split__copy, .accordion, .contact__primary';

export function init() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || !('IntersectionObserver' in window)) return;
  const fold = window.innerHeight;
  const pending = [];
  for (const el of document.querySelectorAll(TARGETS)) {
    if (el.closest('[hidden], dialog, [inert]') || el.getBoundingClientRect().top < fold) continue;
    const index = [...el.parentElement.children].filter((sib) => sib.matches(TARGETS)).indexOf(el);
    el.style.setProperty('--reveal-i', String(Math.max(0, Math.min(index, 3))));
    el.dataset.reveal = 'wait';
    pending.push(el);
  }
  if (!pending.length) return;

  function release(el) {
    el.dataset.reveal = 'in';
    const clean = (event) => {
      if (event && event.target !== el) return;
      el.removeEventListener('transitionend', clean);
      delete el.dataset.reveal;
      el.style.removeProperty('--reveal-i');
    };
    el.addEventListener('transitionend', clean);
  }

  const waiting = new Set(pending);
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !waiting.has(entry.target)) continue;
      waiting.delete(entry.target);
      observer.unobserve(entry.target);
      release(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

  // A fast jump (Ctrl+End, anchor links) skips blocks without ever intersecting; show those at once
  // instead of leaving blank gaps behind the reader.
  let frame = 0;
  function flushPassed() {
    frame = 0;
    for (const el of waiting) {
      if (el.getBoundingClientRect().bottom > 0) continue;
      waiting.delete(el);
      observer.unobserve(el);
      delete el.dataset.reveal;
      el.style.removeProperty('--reveal-i');
    }
    if (!waiting.size) window.removeEventListener('scroll', onScroll);
  }
  function onScroll() {
    if (!frame) frame = requestAnimationFrame(flushPassed);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  for (const el of pending) observer.observe(el);

  // Switching to reduced motion (or a screenshot tool doing so) shows everything at once.
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    observer.disconnect();
    window.removeEventListener('scroll', onScroll);
    for (const el of pending) {
      delete el.dataset.reveal;
      el.style.removeProperty('--reveal-i');
    }
  });
}
