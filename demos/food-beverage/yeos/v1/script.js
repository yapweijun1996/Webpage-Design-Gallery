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
