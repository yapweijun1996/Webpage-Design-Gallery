document.addEventListener('gjh:ready', () => {
  const root = document.getElementById('m07');
  const records = root?.querySelector('[data-m07-records]');
  const replay = root?.querySelector('[data-m07-replay]');
  if (!records || !replay) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const format = new Intl.NumberFormat('zh-Hans');
  const counters = Array.from(records.querySelectorAll('[data-m07-count]'), (display) => {
    const finalText = display.textContent;
    const accessibleValue = document.createElement('span');
    accessibleValue.className = 'm07-sr-only';
    accessibleValue.textContent = finalText;
    display.before(accessibleValue);
    display.setAttribute('aria-hidden', 'true');
    return { display, finalText, value: Number(finalText.replaceAll(',', '')) };
  });
  let frame = 0;
  let observer;

  function restoreValues() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    for (const { display, finalText } of counters) display.textContent = finalText;
  }

  function play() {
    observer?.disconnect();
    if (motion.matches) return;
    restoreValues();
    let start;

    function tick(now) {
      start ??= now;
      const progress = Math.min((now - start) / 850, 1);
      if (progress === 1) {
        restoreValues();
        return;
      }

      const eased = 1 - (1 - progress) ** 3;
      for (const { display, value } of counters) {
        display.textContent = format.format(Math.round(value * eased));
      }
      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
  }

  function syncMotion() {
    replay.hidden = motion.matches;
    if (motion.matches) restoreValues();
  }

  replay.addEventListener('click', play);
  motion.addEventListener('change', syncMotion);
  syncMotion();

  if (!motion.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) play();
    }, { threshold: 0.25 });
    observer.observe(records);
  }
}, { once: true });
