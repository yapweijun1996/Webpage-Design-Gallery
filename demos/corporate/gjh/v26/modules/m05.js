document.addEventListener('gjh:ready', () => {
  const module = document.getElementById('m05');
  const track = module?.querySelector('.m05-track');
  if (!track) return;

  const previous = module.querySelector('.m05-previous');
  const next = module.querySelector('.m05-next');
  const milestones = Array.from(track.children);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tolerance = 2;
  let drag = null;

  function maxScroll() {
    return track.scrollWidth - track.clientWidth;
  }

  function syncButtons() {
    previous.setAttribute('aria-disabled', String(track.scrollLeft <= tolerance));
    next.setAttribute('aria-disabled', String(track.scrollLeft >= maxScroll() - tolerance));
  }

  function positions() {
    const first = milestones[0].getBoundingClientRect().left;
    const end = maxScroll();
    return milestones.map((milestone) => Math.min(end, milestone.getBoundingClientRect().left - first));
  }

  function scrollTo(left) {
    track.scrollTo({ left, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }

  function step(direction) {
    const stops = positions();
    const current = track.scrollLeft;
    const target = direction > 0
      ? stops.find((stop) => stop > current + tolerance)
      : stops.reverse().find((stop) => stop < current - tolerance);
    if (target !== undefined) scrollTo(target);
  }

  previous.disabled = false;
  next.disabled = false;
  previous.addEventListener('click', () => {
    if (previous.getAttribute('aria-disabled') !== 'true') step(-1);
  });
  next.addEventListener('click', () => {
    if (next.getAttribute('aria-disabled') !== 'true') step(1);
  });
  track.addEventListener('scroll', syncButtons, { passive: true });
  new ResizeObserver(syncButtons).observe(track);
  syncButtons();

  track.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowLeft': step(-1); break;
      case 'ArrowRight': step(1); break;
      case 'Home': scrollTo(0); break;
      case 'End': scrollTo(maxScroll()); break;
      default: return;
    }
    event.preventDefault();
  });

  track.addEventListener('pointerdown', (event) => {
    // Touch uses native scrolling so vertical page gestures remain available.
    if (drag || event.pointerType === 'touch' || event.button !== 0 || event.target === track) return;
    event.preventDefault();
    track.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft };
    track.setPointerCapture(event.pointerId);
  });

  track.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const delta = drag.x - event.clientX;
    if (Math.abs(delta) < 4 && !track.classList.contains('m05-dragging')) return;
    track.classList.add('m05-dragging');
    track.scrollLeft = drag.left + delta;
  });

  track.addEventListener('lostpointercapture', (event) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    if (!track.classList.contains('m05-dragging')) return;

    const current = track.scrollLeft;
    const closest = positions().reduce((best, stop) =>
      Math.abs(current - stop) < Math.abs(current - best) ? stop : best, 0);
    track.classList.remove('m05-dragging');
    scrollTo(closest);
  });
});
