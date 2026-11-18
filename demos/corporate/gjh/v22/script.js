const chapters = document.querySelector('.chapters');
const menu = document.querySelector('#mobile-menu');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const sheet = document.querySelector('#enquiry-sheet');
const sheetHeading = document.querySelector('#sheet-heading');
const fields = document.querySelector('#enquiry-fields');
const brandOptions = [...fields.querySelectorAll('[name="enquiry-brand"]')];
const product = document.querySelector('#enquiry-product');
const requirements = document.querySelector('#enquiry-requirements');
const featuredProduct = document.querySelector('#featured-sku').textContent.trim();
const preview = document.querySelector('#enquiry-preview');
const copyButton = document.querySelector('#copy-enquiry');
const status = document.querySelector('#copy-status');
const fallback = document.querySelector('#copy-fallback');
const draft = document.querySelector('#enquiry-draft');
let opener;
let automaticProduct = false;
let copyAttempt = 0;

function headingOf(section) {
  return document.getElementById(section?.getAttribute('aria-labelledby'));
}

function focusFragment() {
  const target = document.getElementById(location.hash.slice(1));
  if (!target || target.id === 'top') return;
  const heading = headingOf(target) || target;
  target.classList.remove('is-entering');
  chapters.classList.add('is-navigating');
  target.scrollIntoView({block: 'start'});
  heading.focus({preventScroll: true});
  requestAnimationFrame(() => chapters.classList.remove('is-navigating'));
}

function selectedBrand() {
  return brandOptions.find(option => option.checked)?.value || '';
}

function updatePreview() {
  copyAttempt += 1;
  fallback.hidden = true;
  status.textContent = '';
  const text = [
    ['Brand', selectedBrand()],
    ['Product', product.value.trim()],
    ['Requirements', requirements.value.trim()],
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n');
  preview.textContent = text || 'Add enquiry details to prepare your message.';
  copyButton.disabled = !text;
}

function fitSheet() {
  const viewport = window.visualViewport;
  if (!viewport || !sheet.open) return;
  sheet.style.setProperty('--sheet-viewport', `${viewport.height}px`);
  const obscured = document.documentElement.clientHeight - viewport.height - viewport.offsetTop;
  sheet.style.setProperty('--sheet-obscured-bottom', `${Math.max(0, obscured)}px`);
}

function openSheet(trigger) {
  if (typeof sheet.showModal !== 'function') return false;
  try {
    sheet.showModal();
  } catch {
    return false;
  }
  opener = trigger;
  const brand = trigger.dataset.enquire;
  if (brand && (brand !== selectedBrand() || (brand === 'New Moon' && !product.value.trim()))) {
    brandOptions.find(option => option.value === brand).checked = true;
    automaticProduct = brand === 'New Moon';
    product.value = automaticProduct ? featuredProduct : '';
  }
  fitSheet();
  sheet.querySelector('.sheet-body').scrollTop = 0;
  updatePreview();
  sheetHeading.focus({preventScroll: true});
  return true;
}

function selectDraft() {
  draft.focus();
  draft.select();
}

fields.addEventListener('input', event => {
  if (event.target === product) automaticProduct = false;
  if (event.target.name === 'enquiry-brand' && automaticProduct && selectedBrand() !== 'New Moon') {
    product.value = '';
    automaticProduct = false;
  }
  updatePreview();
});

copyButton.addEventListener('click', async () => {
  const text = preview.textContent;
  updatePreview();
  const attempt = copyAttempt;
  try {
    await navigator.clipboard.writeText(text);
    if (attempt === copyAttempt && sheet.open) status.textContent = 'Details copied.';
  } catch {
    if (attempt !== copyAttempt || !sheet.open) return;
    draft.value = text;
    fallback.hidden = false;
    status.textContent = 'Copy the selected text manually.';
    selectDraft();
  }
});
document.querySelector('#select-draft').addEventListener('click', selectDraft);
document.querySelector('#close-sheet').addEventListener('click', () => sheet.close());
sheet.addEventListener('close', () => {
  copyAttempt += 1;
  if (!opener) return;
  const rect = opener.getBoundingClientRect();
  const visible = rect.width && rect.height && document.elementFromPoint(
    rect.left + rect.width / 2, rect.top + rect.height / 2
  );
  if (visible && opener.contains(visible)) {
    opener.focus({preventScroll: true});
  } else {
    const heading = headingOf(opener.closest('section')) || opener;
    heading.focus();
  }
  opener = null;
});
window.visualViewport?.addEventListener('resize', fitSheet);
window.visualViewport?.addEventListener('scroll', fitSheet);

if (typeof sheet.showModal === 'function') {
  for (const trigger of document.querySelectorAll('[data-enquire]')) {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.removeAttribute('aria-describedby');
  }
}

document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link) return;

  if (link.closest('#mobile-menu')) menu.open = false;
  if (link.hasAttribute('data-enquire') && openSheet(link)) {
    event.preventDefault();
  } else if (link.getAttribute('href').startsWith('#') && link.hash !== '#top') {
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    focusFragment();
  }
});

menu.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !menu.open) return;
  event.preventDefault();
  menu.open = false;
  menu.querySelector('summary').focus();
});

const chapterSections = [...chapters.querySelectorAll('.chapter')];

if ('ResizeObserver' in window) {
  function fitChapters() {
    for (const chapter of chapterSections) {
      const fits = chapter.clientHeight <= document.documentElement.clientHeight + 1;
      chapter.classList.toggle('can-pin', fits);
    }
  }
  const resizeObserver = new ResizeObserver(fitChapters);
  chapterSections.forEach(chapter => resizeObserver.observe(chapter));
  window.addEventListener('resize', fitChapters);
}

if ('IntersectionObserver' in window) {
  const entrances = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting) continue;
      entrances.unobserve(target);
      if (!motion.matches && !target.matches(':target, :focus-within')) target.classList.add('is-entering');
    }
  }, {threshold: 0.12});
  chapterSections.forEach(chapter => entrances.observe(chapter));
}
chapters.addEventListener('focusin', event => event.target.closest('.chapter')?.classList.remove('is-entering'));
window.addEventListener('hashchange', focusFragment);
if (location.hash) focusFragment();
