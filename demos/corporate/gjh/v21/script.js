const filters = document.querySelector('#brand-filters');
const cards = document.querySelectorAll('.brand-card');
const brandStatus = document.querySelector('#brand-status');
const enquiry = document.querySelector('#enquiry');
const fields = document.querySelector('#enquiry-fields');
const brand = document.querySelector('#enquiry-brand');
const product = document.querySelector('#enquiry-product');
const requirements = document.querySelector('#enquiry-requirements');
const copyButton = document.querySelector('#copy-enquiry');
const fallback = document.querySelector('#copy-fallback');
const draft = document.querySelector('#enquiry-draft');
const menu = document.querySelector('#mobile-menu');
let copyAttempt = 0;

function filterBrands(category) {
  for (const button of filters.querySelectorAll('[data-filter]')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === category));
  }

  let count = 0;
  for (const card of cards) {
    card.hidden = category !== 'all' && card.dataset.category !== category;
    if (!card.hidden) count += 1;
  }
  brandStatus.textContent = count === 1 ? '1 brand shown.' : `${count} brands shown.`;
}

filters.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (button && button.getAttribute('aria-pressed') !== 'true') filterBrands(button.dataset.filter);
});

function resetCopy() {
  fallback.hidden = true;
  copyAttempt += 1;
  return copyAttempt;
}

function headingOf(card) {
  return document.getElementById(card.getAttribute('aria-labelledby'));
}

function followFragment(event, link, target, focusTarget = target) {
  event.preventDefault();
  if (window.location.hash !== link.hash) window.history.pushState(null, '', link.hash);
  target.scrollIntoView({block: 'start'});
  focusTarget.focus({preventScroll: true});
}

document.addEventListener('click', event => {
  // Let modified clicks and new tabs follow the original fragment links.
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const shortcut = event.target.closest('[data-shortcut]');
  const enquiryLink = event.target.closest('[data-enquire]');

  if (shortcut) {
    const card = document.getElementById(shortcut.hash.slice(1));
    if (card.hidden) filterBrands('all');
    followFragment(event, shortcut, card, headingOf(card));
  } else if (enquiryLink) {
    const source = document.getElementById(enquiryLink.dataset.enquire);
    const brandCard = source.dataset.brandCard ? document.getElementById(source.dataset.brandCard) : source;
    brand.value = headingOf(brandCard).textContent;
    product.value = source === brandCard ? '' : headingOf(source).textContent;
    resetCopy();
    followFragment(event, enquiryLink, enquiry);
  }
});

function selectDraft() {
  draft.focus();
  draft.select();
}

copyButton.addEventListener('click', async () => {
  const attempt = resetCopy();
  const text = [
    `Brand: ${brand.value.trim()}`,
    `Product: ${product.value.trim()}`,
    `Purchase requirements: ${requirements.value.trim()}`
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    if (attempt !== copyAttempt) return;
    draft.value = text;
    fallback.hidden = false;
    selectDraft();
  }
});

document.querySelector('#select-draft').addEventListener('click', selectDraft);
fields.addEventListener('input', resetCopy);
filters.hidden = false;
copyButton.hidden = false;

menu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !menu.open) return;
  event.preventDefault();
  menu.open = false;
  menu.querySelector('summary').focus();
});

menu.querySelector('nav').addEventListener('click', event => {
  if (event.target.closest('a')) menu.open = false;
});

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting || !target.classList.contains('reveal')) continue;
      observer.unobserve(target);
      target.classList.add('is-revealed');
    }
  }, {threshold: 0.1});

  function finishReveal(target) {
    const block = target?.closest('.reveal') || target?.querySelector('.reveal');
    if (!block) return;
    observer.unobserve(block);
    block.classList.remove('reveal', 'is-revealed');
  }

  function finishAnchorReveal() {
    finishReveal(document.getElementById(window.location.hash.slice(1)));
  }

  finishAnchorReveal();
  for (const block of document.querySelectorAll('.reveal')) {
    if (block.getBoundingClientRect().top >= window.innerHeight) observer.observe(block);
  }

  document.addEventListener('focusin', event => finishReveal(event.target));
  window.addEventListener('hashchange', finishAnchorReveal);
}
