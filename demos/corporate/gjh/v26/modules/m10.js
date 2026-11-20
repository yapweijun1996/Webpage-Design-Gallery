document.addEventListener('gjh:ready', () => {
  const ledger = document.querySelector('#m10 .m10-ledger');
  if (!ledger) return;

  const toolbar = ledger.querySelector('.m10-toolbar');
  const filter = toolbar.querySelector('#m10-filter');
  const result = toolbar.querySelector('.m10-result');
  const chapters = Array.from(ledger.querySelectorAll('.m10-chapter'), (chapter) => ({
    chapter,
    count: chapter.querySelector('.m10-count'),
    claims: Array.from(chapter.querySelectorAll('.m10-claim')),
  }));

  function updateFilter() {
    let matches = 0;
    let firstMatch;
    let hasOpenMatch = false;

    for (const { chapter, count, claims } of chapters) {
      let chapterMatches = 0;
      for (const claim of claims) {
        const visible = filter.value === 'all' || claim.dataset.evidence === filter.value;
        claim.hidden = !visible;
        if (visible) chapterMatches += 1;
      }

      chapter.hidden = chapterMatches === 0;
      count.textContent = `${chapterMatches} 项`;
      count.hidden = false;
      matches += chapterMatches;

      if (chapterMatches > 0) {
        firstMatch ??= chapter;
        hasOpenMatch ||= chapter.open;
      }
    }

    if (filter.value !== 'all' && firstMatch && !hasOpenMatch) {
      firstMatch.open = true;
    }
    result.textContent = `共 ${matches} 项`;
  }

  updateFilter();
  toolbar.hidden = false;
  filter.addEventListener('change', updateFilter);
}, { once: true });
