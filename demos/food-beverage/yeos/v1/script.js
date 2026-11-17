const filterGroup = document.querySelector('.filters');
const cards = Array.from(document.querySelectorAll('.drink'));
const filterStatus = document.querySelector('#filter-status');

function selectFamily(family) {
  let count = 0;
  for (const card of cards) {
    card.hidden = family !== 'all' && card.dataset.family !== family;
    if (!card.hidden) count += 1;
  }
  for (const button of filterGroup.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === family));
  }
  filterStatus.textContent = count + ' drinks shown.';
}

filterGroup.addEventListener('click', event => {
  const button = event.target.closest('button[data-filter]');
  if (button) selectFamily(button.dataset.filter);
});
filterGroup.hidden = false;

const controls = document.querySelector('.slide-controls');
const photo = document.querySelector('#featured-image');
const caption = document.querySelector('#featured-link');
const slides = [
  { card: document.querySelector('#chrysanthemum'), src: photo.getAttribute('src'), alt: photo.alt },
  { card: document.querySelector('#soy'), alt: 'A glass of soy milk with soy beans' },
  { card: document.querySelector('#lychee'), alt: 'A glass of lychee drink with lychees' }
];
let current = 0;
controls.addEventListener('click', event => {
  const button = event.target.closest('[data-step]');
  if (!button) return;
  current = (current + Number(button.dataset.step) + slides.length) % slides.length;
  const slide = slides[current];
  photo.src = slide.src || slide.card.querySelector('img').getAttribute('src');
  photo.alt = slide.alt;
  caption.textContent = slide.card.querySelector('h3').textContent;
  caption.hash = slide.card.id;
  controls.querySelector('.slide-count').textContent = (current + 1) + ' / ' + slides.length;
});
controls.hidden = false;

function revealLinkedDrink() {
  const card = cards.find(item => '#' + item.id === location.hash);
  if (card && card.hidden) {
    selectFamily('all');
    card.scrollIntoView();
  }
}
caption.addEventListener('click', () => {
  if (slides[current].card.hidden) selectFamily('all');
});
window.addEventListener('hashchange', revealLinkedDrink);

const picker = document.querySelector('#pair-picker');
const selectors = [...picker.querySelectorAll('select')];
const drinks = new Map(cards.map(card => [card.id, card]));
for (const select of selectors) {
  for (const card of cards) select.add(new Option(card.querySelector('h3').textContent, card.id));
}
selectors[1].value = 'soy';

function renderComparison() {
  const selected = selectors.map(select => drinks.get(select.value));
  const names = selected.map(card => card.querySelector('h3').textContent);
  selectors.forEach((select, i) => {
    for (const option of select.options) option.disabled = option.value === selectors[1 - i].value;
    picker.querySelectorAll('thead th')[i + 1].textContent = names[i];
  });
  const body = picker.querySelector('tbody');
  body.replaceChildren();
  for (const format of ['carton', 'can', 'bottle']) {
    const row = body.insertRow();
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = format[0].toUpperCase() + format.slice(1);
    row.append(label);
    for (const card of selected) {
      const sizes = [...card.querySelectorAll('[data-format="' + format + '"] span')];
      row.insertCell().textContent = sizes.map(size => size.textContent).join(' / ') || 'Not listed';
    }
  }
  document.querySelector('#pack-status').textContent = 'Comparing ' + names.join(' and ') + '.';
}
for (const select of selectors) select.addEventListener('change', renderComparison);
renderComparison();
picker.hidden = false;
