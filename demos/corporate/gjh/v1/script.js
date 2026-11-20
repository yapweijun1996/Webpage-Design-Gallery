// Goh Joo Hin v1 — current-section location, fragment-preserving locale links & calm image fallback.
// Shared mobile menu disclosure is initialized by ../shared/navigation.js before first paint.
(() => {
  // 1. Unified current-section indicator (styling/aria-current only; never alters focus, scroll or history).
  const navLinks = [...document.querySelectorAll('#navigation > a[href^="#"]')];
  const sectionMap = navLinks
    .map(link => ({link, id: link.hash.slice(1), target: document.getElementById(link.hash.slice(1))}))
    .filter(item => item.target);

  const hashToNavId = hash => {
    const id = decodeURIComponent((hash || '').replace(/^#/, ''));
    if (!id || id === 'top' || id === 'main') return '';
    if (id.startsWith('business')) return 'business';
    if (id === 'partnership') return 'brands';
    return sectionMap.some(item => item.id === id) ? id : '';
  };

  let activeId = '';
  let explicitLockId = '';
  let explicitLockUntil = 0;

  const setActive = id => {
    if (id === activeId) return;
    activeId = id;
    for (const {link, id: itemId} of sectionMap) {
      if (id && itemId === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };

  const lockExplicit = id => {
    explicitLockId = id;
    explicitLockUntil = Date.now() + 900;
    setActive(id);
  };

  const syncFromScroll = () => {
    if (explicitLockId && Date.now() < explicitLockUntil) {
      setActive(explicitLockId);
      return;
    }
    explicitLockId = '';
    if (window.scrollY < 120) {
      setActive('');
      return;
    }
    const bottomGap = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    if (bottomGap <= 64 && sectionMap.length) {
      setActive(sectionMap[sectionMap.length - 1].id);
      return;
    }
    const probeY = Math.min(window.innerHeight * 0.4, 340);
    let best = '';
    for (const {id, target} of sectionMap) {
      const rect = target.getBoundingClientRect();
      if (rect.top <= probeY) best = id;
    }
    setActive(best);
  };

  const syncFromHash = () => {
    const mapped = hashToNavId(window.location.hash);
    if (mapped) lockExplicit(mapped);
    else {
      explicitLockId = '';
      syncFromScroll();
    }
  };

  if (sectionMap.length) {
    let rafId = 0;
    const scheduleScrollSync = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        syncFromScroll();
      });
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(() => {
        scheduleScrollSync();
      }, {rootMargin: '-18% 0px -55% 0px', threshold: [0, 0.2, 0.5]});
      for (const {target} of sectionMap) observer.observe(target);
    }

    const releaseLock = () => { explicitLockId = ''; };
    window.addEventListener('wheel', releaseLock, {passive: true});
    window.addEventListener('touchstart', releaseLock, {passive: true});
    window.addEventListener('scroll', scheduleScrollSync, {passive: true});
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    for (const {link, id} of sectionMap) {
      link.addEventListener('click', () => lockExplicit(id));
    }
    for (const link of document.querySelectorAll('.division-index a[href^="#"], .entry-action[href^="#"]')) {
      link.addEventListener('click', () => {
        const mapped = hashToNavId(link.hash);
        if (mapped) lockExplicit(mapped);
      });
    }
    syncFromHash();
  }

  // 2. Preserve the active URL fragment when switching locale routes.
  const localeLinks = [...document.querySelectorAll('a[data-locale-link]')];
  const updateLocaleHashes = () => {
    const hash = window.location.hash;
    for (const link of localeLinks) {
      const base = link.dataset.baseHref || link.getAttribute('href').split('#')[0];
      link.dataset.baseHref = base;
      link.setAttribute('href', hash ? `${base}${hash}` : base);
    }
  };
  if (localeLinks.length) {
    updateLocaleHashes();
    window.addEventListener('hashchange', updateLocaleHashes);
    window.addEventListener('popstate', updateLocaleHashes);
    for (const link of localeLinks) {
      link.addEventListener('click', updateLocaleHashes);
    }
  }

  // 3. Calm image error fallback inside reserved aspect-ratio frames.
  const applyFallback = frame => {
    if (!frame || frame.dataset.mediaState === 'fallback') return;
    frame.dataset.mediaState = 'fallback';
    if (!frame.querySelector('.media-fallback')) {
      const message = document.createElement('p');
      message.className = 'media-fallback';
      message.textContent = frame.dataset.fallbackLabel || frame.querySelector('img')?.alt || '';
      frame.append(message);
    }
  };

  for (const frame of document.querySelectorAll('[data-media-frame]')) {
    const img = frame.querySelector('img');
    if (!img) continue;
    if (img.complete && img.naturalWidth === 0) {
      applyFallback(frame);
    } else {
      img.addEventListener('error', () => applyFallback(frame), {once: true});
    }
  }
})();
