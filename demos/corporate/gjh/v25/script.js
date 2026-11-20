(() => {
  document.documentElement.classList.add('js');
  const pages = [...document.querySelectorAll('.page')];
  const links = [...document.querySelectorAll('.rail a')];
  const params = new URLSearchParams(location.search);
  const staticLines = params.get('lines') === 'all' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LINE_DELAY = 1100;
  const PANEL_THRESHOLD = .55;
  if (staticLines) document.documentElement.classList.add('lines-all');

  // Each chapter plays its sound effect and speech bubbles by itself while it is on screen.
  pages.forEach((page) => {
    const items = [...page.querySelectorAll('.sfx, .bubble')];
    const live = document.createElement('div');
    live.className = 'line-announcer';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    page.querySelector('.panel').after(live);
    items.forEach((item) => item.setAttribute('aria-hidden', 'true'));

    const lead = Number(page.dataset.lead || 0);
    let shown = 0;
    let timer = null;
    let remaining;
    let deadline;

    const reveal = (announce) => {
      const item = items[shown++];
      item.classList.add('on');
      item.removeAttribute('aria-hidden');
      if (!announce) return;

      // Snapshot the line and its language so translating the panel does not replay it.
      const message = document.createElement('span');
      message.lang = document.documentElement.lang;
      message.textContent = item.textContent;
      live.replaceChildren(message);
    };

    const scheduleNext = () => {
      if (timer !== null || shown >= items.length) return;
      if (remaining === undefined) {
        const custom = items[shown].dataset.delayMs?.trim();
        const delay = custom ? Number(custom) : NaN;
        const entrance = shown === 0 ? lead : 0;
        // Preserve the immediate first beat (or the chapter's entrance lead) by default.
        const validDelay = Number.isFinite(delay) && delay >= 0 && delay <= 2_147_483_647 - entrance;
        remaining = entrance + (validDelay ? delay : shown === 0 ? 0 : LINE_DELAY);
      }
      deadline = performance.now() + remaining;
      timer = setTimeout(() => {
        timer = null;
        remaining = undefined;
        reveal(true);
        scheduleNext();
      }, remaining);
    };

    page.play = () => {
      page.classList.add('is-in', 'is-playing');
      scheduleNext();
    };
    page.pause = () => {
      page.classList.remove('is-playing');
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, deadline - performance.now());
    };
    page.showAll = () => {
      page.classList.add('is-in');
      page.pause();
      while (shown < items.length) reveal(false);
    };
  });

  // Start a chapter's lines when most of its picture is visible, and pause them when it leaves.
  if (staticLines) {
    pages.forEach((page) => page.showAll());
  } else {
    const panels = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const page = entry.target.closest('.page');
        if (entry.intersectionRatio >= PANEL_THRESHOLD) page.play(); else page.pause();
      });
    }, { threshold: PANEL_THRESHOLD });
    pages.forEach((page) => panels.observe(page.querySelector('.panel')));
  }

  // Gutter flourishes (page-turn fold, quiet gap) play once as they scroll into view.
  const gutters = [...document.querySelectorAll('[data-reveal]')];
  if (staticLines) gutters.forEach((node) => node.classList.add('is-in'));
  const reveals = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      reveals.unobserve(entry.target);
    });
  }, { threshold: .5 });
  gutters.forEach((node) => reveals.observe(node));

  // Timeline thread: the rail line fills up to the chapter in view and stays filled behind it.
  const rail = document.querySelector('.rail');
  const seen = new Map();
  let current = 0;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => seen.set(entry.target, entry.intersectionRatio));
    const [top] = [...seen.entries()].sort((a, b) => b[1] - a[1]);
    if (!top || top[1] <= 0) return;
    const chapter = Number(top[0].dataset.ch);
    if (chapter === current) return;
    current = chapter;
    rail.style.setProperty('--ch', chapter);
    links.forEach((link) => {
      const index = Number(link.dataset.ch);
      link.classList.toggle('on', index === chapter);
      link.classList.toggle('done', index < chapter);
      if (index === chapter) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    // Move only the chapter rail sideways; scrollIntoView would also tug the page vertically.
    const activeLink = links.find((link) => link.classList.contains('on'));
    const list = activeLink && activeLink.closest('ol');
    if (list) list.scrollLeft = activeLink.offsetLeft - (list.clientWidth - activeLink.offsetWidth) / 2;
  }, { threshold: [0, .25, .5, .75, 1] });
  pages.forEach((page) => observer.observe(page));

  // Keyboard: arrows or J/K change chapter.
  addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SUMMARY|BUTTON|A)$/.test(document.activeElement.tagName)) return;
    const index = pages.findIndex((page) => page.getBoundingClientRect().bottom > innerHeight * .4);
    const go = (step) => { pages[Math.max(0, Math.min(pages.length - 1, index + step))].scrollIntoView(); event.preventDefault(); };
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'j') go(1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'k') go(-1);
  });
})();
