(() => {
  document.documentElement?.classList.add('js');

  function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    const mobile = window.matchMedia('(max-width: 900px)');
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setOpen = (open) => toggle.setAttribute('aria-expanded', String(open));

    toggle.addEventListener('click', () => setOpen(mobile.matches && !isOpen()));
    nav.addEventListener('click', (event) => {
      if (event.target?.closest?.('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isOpen()) return;
      setOpen(false);
      toggle.focus({ preventScroll: true });
    });
    mobile.addEventListener('change', () => setOpen(false));

    if (!('IntersectionObserver' in window)) return;
    const destinations = [...nav.querySelectorAll('.nav-link[href^="#"]')]
      .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
      .filter(({ section }) => section)
      .reverse();
    if (!destinations.length) return;

    let readingSection;
    let atBottom = false;
    function updateCurrent() {
      const current = atBottom && location.hash !== readingSection?.link.hash ? destinations[0] : readingSection;
      destinations.forEach(({ link }) => {
        if (link === current?.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    // The final section can be visible without reaching the reading line.
    function checkBottom() {
      const { scrollHeight, clientHeight } = document.documentElement;
      const bottom = scrollHeight > clientHeight && window.scrollY + clientHeight >= scrollHeight - 1;
      if (atBottom === bottom) return;
      atBottom = bottom;
      updateCurrent();
    }

    let observer;
    function observeReadingLine() {
      observer?.disconnect();
      const height = Math.max(1, Math.round(window.innerHeight));
      const scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const line = Math.max(0, Math.round(Math.min(height - 1, scrollPadding + 48)));
      // A narrow band marks the point at which a section becomes current.
      observer = new IntersectionObserver(() => {
        readingSection = destinations.find(({ section }) => section.getBoundingClientRect().top <= line + 1);
        updateCurrent();
      }, { rootMargin: `-${line}px 0px -${height - line - 1}px 0px` });
      destinations.forEach(({ section }) => observer.observe(section));
      checkBottom();
    }

    observeReadingLine();
    window.addEventListener('resize', observeReadingLine);
    window.addEventListener('scroll', checkBottom, { passive: true });
    window.addEventListener('hashchange', updateCurrent);
  }

  function initBrands() {
    const brands = document.getElementById('brands');
    const filters = brands?.querySelector('.filter-row');
    if (!filters) return;

    const chips = [...filters.querySelectorAll('button[data-filter]')];
    const categories = new Set(chips.map((chip) => chip.dataset.filter));
    const cards = [...brands.querySelectorAll('.brand-card[data-division]')];
    let status = brands.querySelector('.filter-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'caption filter-status';
      filters.after(status);
    }
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    let current = 'all';
    let count = cards.length;
    let countMessage;
    function announceCount() {
      status.textContent = countMessage?.replace('{count}', count) ??
        `${count} ${count === 1 ? 'brand' : 'brands'} shown`;
    }

    function applyFilter(filter) {
      if (!categories.has(filter)) return;
      current = filter;
      chips.forEach((chip) => {
        chip.setAttribute('aria-pressed', String(chip.dataset.filter === current));
      });
      count = 0;
      cards.forEach((card) => {
        card.hidden = current !== 'all' && card.dataset.division !== current;
        if (!card.hidden) count += 1;
      });
      announceCount();
    }

    chips.forEach((chip) => chip.addEventListener('click', () => applyFilter(chip.dataset.filter)));
    document.querySelectorAll('.sign-card[data-division]').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        applyFilter(card.dataset.division);
      });
    });

    function applyHash() {
      const category = location.hash.match(/^#(?:brands-)?(food|electronics|health)$/)?.[1];
      if (!category || !categories.has(category)) return;
      applyFilter(category);
      brands.scrollIntoView();
    }

    document.addEventListener('gjh:languagechange', (event) => {
      countMessage = event.detail?.brandCount;
      announceCount();
    });
    applyFilter(current);
    applyHash();
    window.addEventListener('hashchange', applyHash);
  }

  function initBrief() {
    const form = document.getElementById('brief');
    if (!form) return;

    const company = form.querySelector('#brief-company');
    const market = form.querySelector('#brief-market');
    const category = form.querySelector('#brief-category');
    const output = form.querySelector('.brief-output');
    const copy = form.querySelector('.copy-brief');
    if (output) output.lang = 'en-SG';
    const englishOptions = (select) => new Map(
      Array.from(select?.options ?? [], (option) => [option.value, option.textContent.trim()])
    );
    const markets = englishOptions(market);
    const categories = englishOptions(category);
    const englishMessages = {
      briefRequired: 'Enter your company name and choose a market and category.',
      briefCopied: 'Enquiry brief copied.',
      briefSelected: 'Press your device’s copy command to copy the selected brief.',
    };
    let messages = englishMessages;
    let draft = '';
    let feedback = '';
    const status = document.createElement('span');
    status.className = 'caption brief-status';
    status.setAttribute('role', 'status');
    copy?.after(status);

    function showFeedback(key) {
      feedback = key;
      status.textContent = messages[key] ?? '';
    }

    function setDraft(text) {
      draft = text;
      if (output) output.textContent = draft;
      if (copy) copy.hidden = !draft;
      showFeedback('');
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = company?.value.trim();
      const marketLabel = markets.get(market?.value);
      const categoryLabel = categories.get(category?.value);
      const missing = [
        [company, name],
        [market, market?.value && marketLabel],
        [category, category?.value && categoryLabel],
      ].filter(([, value]) => !value);
      missing.forEach(([field]) => field?.setAttribute('aria-invalid', 'true'));
      if (missing.length) {
        setDraft('');
        showFeedback('briefRequired');
        missing[0][0]?.focus();
        return;
      }
      const marketSentence = market.value === 'other'
        ? 'We’d like to discuss another market and can share the details.'
        : `Our target market is ${marketLabel}.`;
      setDraft(`Hello, I’m contacting you on behalf of ${name} about distribution. Our product category is ${categoryLabel}. ${marketSentence} Could you share the next steps?`);
    });
    form.addEventListener('input', (event) => {
      event.target?.removeAttribute?.('aria-invalid');
      setDraft('');
    });
    copy?.addEventListener('click', async () => {
      if (!draft || !output) return;
      const text = draft;
      try {
        await navigator.clipboard.writeText(text);
        if (draft === text) showFeedback('briefCopied');
      } catch {
        if (draft !== text) return;
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(output);
        selection.removeAllRanges();
        selection.addRange(range);
        showFeedback('briefSelected');
      }
    });
    document.addEventListener('gjh:languagechange', (event) => {
      messages = { ...englishMessages, ...event.detail };
      showFeedback(feedback);
    });
  }

  function initBackToTop() {
    const link = document.querySelector('.to-top');
    if (!link) return;
    const update = () => {
      link.hidden = window.scrollY <= window.innerHeight;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function init() {
    initNavigation();
    initBrands();
    initBrief();
    initBackToTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
