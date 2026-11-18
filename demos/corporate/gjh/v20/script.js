const filters = document.querySelector('#brand-filters');
const brands = document.querySelectorAll('.brand-card[data-category]');
const enquiry = document.querySelector('#enquiry');
const brandField = document.querySelector('#enquiry-brand');
const productField = document.querySelector('#enquiry-product');
const requirementsField = document.querySelector('#enquiry-requirements');
const copyButton = document.querySelector('#copy-enquiry');
const copyStatus = document.querySelector('#enquiry-status');
const fallback = document.querySelector('#copy-fallback');
const draft = document.querySelector('#enquiry-draft');

function filterBrands(category) {
  for (const button of filters.querySelectorAll('[data-filter]')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === category));
  }
  for (const brand of brands) {
    brand.hidden = category !== 'all' && brand.dataset.category !== category;
  }
}

filters.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (button) filterBrands(button.dataset.filter);
});

for (const shortcut of document.querySelectorAll('[data-shortcut]')) {
  shortcut.addEventListener('click', () => {
    const target = document.getElementById(shortcut.hash.slice(1));
    if (target.hidden) filterBrands(target.dataset.category);
    target.focus({preventScroll: true});
  });
}

function clearDraft() {
  fallback.hidden = true;
  copyStatus.textContent = '';
}

for (const link of document.querySelectorAll('[data-enquire]')) {
  link.addEventListener('click', () => {
    const source = document.getElementById(link.dataset.enquire);
    const brand = source.dataset.brandCard ? document.getElementById(source.dataset.brandCard) : source;
    brandField.value = brand.querySelector('h3').textContent;
    productField.value = source === brand ? '' : source.querySelector('h2').textContent;
    clearDraft();
    enquiry.focus({preventScroll: true});
  });
}

function selectDraft() {
  draft.focus();
  draft.select();
}

function enquiryText() {
  return [
    ['Brand', brandField.value],
    ['Product', productField.value],
    ['Purchase requirements', requirementsField.value]
  ].map(([label, value]) => `${label}: ${value.trim()}`).join('\n');
}

copyButton.addEventListener('click', async () => {
  clearDraft();
  try {
    await navigator.clipboard.writeText(enquiryText());
    copyStatus.textContent = 'Paste the copied details into the Message field.';
  } catch {
    draft.value = enquiryText();
    fallback.hidden = false;
    copyStatus.textContent = 'Copy the selected text, then paste it into the Message field.';
    selectDraft();
  }
});

document.querySelector('#select-draft').addEventListener('click', selectDraft);
document.querySelector('#enquiry-fields').addEventListener('input', clearDraft);
document.querySelector('#enquiry-fields').hidden = false;
filters.hidden = false;
copyButton.hidden = false;
