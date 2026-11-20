function initM06Directory() {
  const directory = document.querySelector('#m06 .m06-directory');
  if (!directory) return;

  const filters = directory.querySelector('.m06-filters');
  const search = directory.querySelector('#m06-query');
  const chips = [...directory.querySelectorAll('.m06-chips button')];
  const count = directory.querySelector('.m06-count');
  const empty = directory.querySelector('.m06-empty');
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const brands = [...directory.querySelectorAll('.m06-brand')].map(card => ({
    card,
    category: card.dataset.category,
    names: [card.querySelector('h3').textContent, card.dataset.alias ?? ''].map(normalize)
  }));
  let category = 'all';

  function updateResults() {
    const query = normalize(search.value);
    let visible = 0;

    for (const brand of brands) {
      const matchesCategory = category === 'all' || category === brand.category;
      const matchesName = brand.names.some(name => name.includes(query));
      brand.card.hidden = !(matchesCategory && matchesName);
      if (!brand.card.hidden) visible += 1;
    }

    const message = `显示 ${visible} 个品牌，共 ${brands.length} 个`;
    if (count.textContent !== message) count.textContent = message;
    empty.hidden = visible !== 0;
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      category = chip.dataset.category;
      for (const option of chips) {
        option.setAttribute('aria-pressed', String(option === chip));
      }
      updateResults();
    });
  }

  search.addEventListener('input', updateResults);
  updateResults();
  filters.hidden = false;
}

document.addEventListener('gjh:ready', initM06Directory, { once: true });
if (window.GJH_READY) initM06Directory();
