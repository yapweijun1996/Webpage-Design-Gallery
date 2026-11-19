(() => {
  const historySource = 'https://gjhglobal.com/about-us/';
  const directorySource = 'https://www.gjhglobal.com/explore-our-brand/';
  const shopSource = 'https://www.gjheshop.com/shop/';
  const trademarkSource = number => 'https://data.gov.sg/api/action/datastore_search?resource_id=d_6145acb2130bf781165258e76a584383&filters=%7B%22applicationNumber%22%3A%22' + number + '%22%7D&limit=1';

  // Evidence and eShop listings follow docs/gjh-multibrand-directory.md.
  const brands = [
    {
      id: 'new-moon', name: 'New Moon', category: 'food', relationship: 'House brand',
      evidence: 'IPOS lists Goh Joo Hin Pte Ltd as proprietor of the Singapore canned abalone mark filed in 1959.',
      year: 1959, source: trademarkSource('T5924841J'), shop: true,
      image: 'new-moon-medium.webp', logo: 'new-moon-logo.webp'
    },
    {
      id: 'mili', name: 'MILI', category: 'food', relationship: 'House brand',
      evidence: 'GJH identifies MILI as its second house brand, and IPOS lists Goh Joo Hin Pte Ltd as proprietor of the Class 29 mark filed in 1981.',
      year: 1981, source: trademarkSource('T8101608Z'), support: historySource, supportLabel: 'GJH company history', shop: true,
      image: 'mili-medium.webp', logo: 'mili-logo.webp'
    },
    {
      id: 'gogo', name: 'GOGO', category: 'food', relationship: 'Managed & distributed',
      evidence: 'GJH manages and distributes GOGO, and IPOS lists Goh Joo Hin Pte Ltd as proprietor of the Class 29 mark filed in 1983.',
      year: 1983, source: 'https://gjhglobal.com/gogo/', support: trademarkSource('T8300573E'), supportLabel: 'IPOS trademark record', shop: false,
      image: 'gogo-medium.webp', logo: 'gogo-logo.webp'
    },
    {
      id: 'flying-wheel', name: 'Flying Wheel', category: 'food', relationship: 'House brand',
      evidence: 'GJH includes Flying Wheel among its house brands in its company-attributed SG60 account.',
      source: 'https://www.theedgesingapore.com/SG60/heritage/tradition-inspires-tomorrow', shop: true
    },
    {
      id: 'gu-long', name: 'Gu Long', category: 'food', relationship: 'Listed brand',
      evidence: 'GJH lists Gu Long and identifies Xiamen Gulong Group as the parent of the canned-food producer.',
      source: 'https://www.gjhglobal.com/gu-long/', shop: true
    },
    {
      id: 'skippy', name: 'Skippy', category: 'food', relationship: 'Listed brand',
      evidence: 'Skippy appears in both the GJH corporate brand directory and the GJH eShop brand list.',
      source: directorySource, shop: true
    },
    {
      id: 'spam', name: 'SPAM', category: 'food', relationship: 'Distribution milestone',
      evidence: 'GJH records SPAM in its 2010 distribution milestone.',
      year: 2010, source: historySource, shop: true
    },
    {
      id: 'hormel', name: 'Hormel', category: 'food', relationship: 'Distribution milestone',
      evidence: 'GJH records Hormel in its 2010 distribution milestone.',
      year: 2010, source: historySource, shop: false
    },
    {
      id: 'california-mexico', name: 'California Mexico', category: 'food', relationship: 'Distribution milestone',
      evidence: 'GJH records California Mexico in its 2010 distribution milestone.',
      year: 2010, source: historySource, shop: true
    },
    {
      id: 'borsch-med', name: 'Borsch Med', category: 'health', relationship: 'House brand',
      evidence: 'GJH’s company history describes Borsch Med as its fifth brand in 2004.',
      year: 2004, source: historySource, shop: true, image: 'borsch-med-medium.webp', logo: 'borsch-med-logo.webp'
    },
    {
      id: 'pien-tze-huang', name: 'Pien Tze Huang', category: 'health', relationship: 'Listed brand',
      evidence: 'Pien Tze Huang appears in the GJH corporate brand directory.',
      source: directorySource, shop: false
    },
    {
      id: 'zeria', name: 'Zeria', category: 'health', relationship: 'Listed brand',
      evidence: 'Zeria appears in the GJH eShop brand list, with the corporate relationship unconfirmed.',
      source: shopSource, shop: true
    },
    {
      id: 'sony', name: 'Sony', category: 'electronics', relationship: 'Distribution milestone',
      evidence: 'GJH records a Sony personal entertainment distribution milestone in 2011.',
      year: 2011, source: historySource, shop: true, image: 'sony-medium.webp', logo: 'sony-logo.webp'
    },
    {
      id: 'lg', name: 'LG', category: 'electronics', relationship: 'Distribution milestone',
      evidence: 'GJH records a 2018 home entertainment milestone, and LG Singapore lists GJH as a participating retailer in its Sound Suite promotion from 1 to 30 November 2026.',
      year: 2018, source: historySource, support: 'https://www.lg.com/sg/tncs/lg-sound-suite-mix-and-match-promotion/',
      supportLabel: 'LG promotion terms', shop: true, image: 'lg-rail.webp'
    },
    {
      id: 'casio', name: 'Casio', category: 'electronics', relationship: 'Distribution milestone',
      evidence: 'GJH records a 2018 distribution milestone for Casio electronic musical instruments.',
      year: 2018, source: historySource, shop: true, image: 'casio-rail.webp'
    },
    {
      id: 'gp-batteries', name: 'GP Batteries', category: 'electronics', relationship: 'Distribution milestone',
      evidence: 'GJH records a 2016 GP Batteries distributorship.',
      year: 2016, source: historySource, shop: true, image: 'gp-batteries-rail.webp'
    },
    {
      id: 'gigaset', name: 'Gigaset', category: 'electronics', relationship: 'Distribution milestone',
      evidence: 'GJH records a 2006 Gigaset cordless phone distribution milestone.',
      year: 2006, source: historySource, shop: true, image: 'gigaset-rail.webp'
    }
  ];

  const toolbar = document.querySelector('.brands-toolbar');
  const search = document.querySelector('#brand-search');
  const chips = [...toolbar.querySelectorAll('[data-category]')];
  const results = document.querySelector('#brand-results');
  const empty = document.querySelector('#brand-empty');
  const dialog = document.querySelector('#brand-dialog');
  const cards = brands.map(brand => ({brand, card: document.getElementById('brand-' + brand.id)}));
  let category = '';
  let opener;
  let highlighted;
  let highlightTimer;

  const normalise = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const setText = (selector, value) => { dialog.querySelector(selector).textContent = value; };

  function render() {
    const query = normalise(search.value);
    let count = 0;
    for (const {brand, card} of cards) {
      const matches = (!category || brand.category === category) && normalise(brand.name).includes(query);
      card.hidden = !matches;
      if (matches) count += 1;
    }
    for (const chip of chips) chip.setAttribute('aria-pressed', String(category === chip.dataset.category));
    results.textContent = count === 1 ? '1 brand' : count + ' brands';
    empty.hidden = count !== 0;
  }

  function readFilters() {
    const params = new URLSearchParams(location.search);
    category = chips.find(chip => chip.dataset.category === params.get('category'))?.dataset.category || '';
    search.value = params.get('q') || '';
    render();
  }

  function saveFilters(historyMethod) {
    const url = new URL(location.href);
    for (const [key, value] of [['category', category], ['q', search.value.trim()]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href !== location.href) history[historyMethod](null, '', url);
    render();
  }

  function followHash() {
    if (location.hash === '#brand-search') {
      search.focus({preventScroll: true});
      search.scrollIntoView({block: 'start', behavior: 'instant'});
      return;
    }
    const target = cards.find(({card}) => '#' + card.id === location.hash);
    if (!target) return;
    if (target.card.hidden) {
      category = '';
      search.value = '';
      saveFilters('replaceState');
    }
    highlighted?.classList.remove('is-highlighted');
    clearTimeout(highlightTimer);
    highlighted = target.card;
    highlighted.classList.add('is-visible', 'is-highlighted');
    highlighted.scrollIntoView({block: 'start', behavior: 'instant'});
    highlightTimer = setTimeout(() => highlighted.classList.remove('is-highlighted'), 2200);
  }

  search.addEventListener('input', () => saveFilters('replaceState'));
  toolbar.addEventListener('submit', event => event.preventDefault());
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      category = chip.dataset.category;
      saveFilters('pushState');
    });
  }
  empty.querySelector('button').addEventListener('click', () => {
    category = '';
    search.value = '';
    saveFilters('pushState');
    search.focus();
  });
  addEventListener('popstate', readFilters);
  addEventListener('hashchange', followHash);
  document.querySelector('.header-tools a[href="brands.html#brand-search"]').addEventListener('click', event => {
    if (location.hash !== '#brand-search' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    followHash();
  });

  if (typeof dialog.showModal === 'function') {
    const closeButton = dialog.querySelector('[data-brand-close]');
    const year = dialog.querySelector('[data-brand-year]');
    const source = dialog.querySelector('[data-brand-source]');
    const support = dialog.querySelector('[data-brand-support]');
    const shop = dialog.querySelector('[data-brand-shop]');

    for (const {brand, card} of cards) {
      const link = card.querySelector('.stretched');
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = link;
        dialog.querySelector('[data-brand-media]').replaceChildren(card.querySelector('.brand-visual').cloneNode(true));
        setText('#brand-dialog-title', brand.name);
        setText('[data-brand-category]', card.querySelector('.brand-category').textContent);
        setText('[data-brand-relationship]', brand.relationship);
        setText('[data-brand-evidence]', brand.evidence);
        year.hidden = !brand.year;
        year.textContent = brand.year ? 'Record year · ' + brand.year : '';
        source.href = brand.source;
        support.hidden = !brand.support;
        if (brand.support) {
          support.href = brand.support;
          support.firstElementChild.textContent = brand.supportLabel;
        }
        shop.hidden = !brand.shop;
        dialog.querySelector('.brand-dialog-body').scrollTop = 0;
        dialog.showModal();
      });
    }
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      const target = opener.closest('.brand-card').hidden ? search : opener;
      target.focus({preventScroll: true});
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = dialog.querySelectorAll('button, a[href]:not([hidden])');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  toolbar.hidden = false;
  readFilters();
  followHash();
})();
