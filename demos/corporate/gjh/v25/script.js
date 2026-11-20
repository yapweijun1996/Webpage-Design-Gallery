(() => {
  document.documentElement.classList.add('js');
  const pages = [...document.querySelectorAll('.page')];
  const links = [...document.querySelectorAll('.rail a')];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const LINE_DELAY = 1100;

  // Each chapter plays its sound effect and speech bubbles by itself while it is on screen.
  pages.forEach((page) => {
    const items = [...page.querySelectorAll('.sfx, .bubble')];
    const live = document.createElement('div');
    live.setAttribute('aria-live', 'polite');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
    page.querySelector('.panel').after(live);
    let shown = 0;
    let timer = 0;
    const reveal = () => {
      if (shown >= items.length) return;
      const item = items[shown++];
      item.classList.add('on');
      live.textContent = item.textContent;
    };
    const lead = Number(page.dataset.lead || 0);
    const stop = () => { clearTimeout(timer); clearInterval(timer); timer = 0; };
    page.play = () => {
      page.classList.add('is-in');
      if (timer || shown >= items.length) return;
      // Let the chapter's own entrance (shutter lift, wide table) land before the first line.
      timer = setTimeout(() => {
        reveal();
        timer = setInterval(() => {
          reveal();
          if (shown >= items.length) stop();
        }, LINE_DELAY);
      }, shown === 0 ? lead : 0);
    };
    page.pause = stop;
    page.showAll = () => { page.classList.add('is-in'); stop(); while (shown < items.length) reveal(); };
  });
  if (calm || params.get('lines') === 'all') pages.forEach((page) => page.showAll());

  // Start a chapter's lines when most of its picture is visible, and pause them when it leaves.
  const panels = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const page = entry.target.closest('.page');
      if (entry.isIntersecting) page.play(); else page.pause();
    });
  }, { threshold: .55 });
  pages.forEach((page) => panels.observe(page.querySelector('.panel')));

  // Gutter flourishes (page-turn fold, quiet gap) play once as they scroll into view.
  const gutters = [...document.querySelectorAll('[data-reveal]')];
  if (calm || params.get('lines') === 'all') gutters.forEach((node) => node.classList.add('is-in'));
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
