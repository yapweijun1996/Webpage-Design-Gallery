'use strict';

const screens = [...document.querySelector('main').children];
const input = document.querySelector('#query');
const matches = document.querySelector('#matches');
const status = document.querySelector('#status');
const index = document.querySelector('#brand-index');
const entries = [...index.querySelectorAll('[data-name]')];
const triggers = {
  finder: document.querySelector('#find-trigger'),
  ingredients: document.querySelector('#ingredient-trigger')
};
let visibleScreen;
let results = [];
let active = -1;

function showScreen() {
  const screen = screens.find(item => '#' + item.id === location.hash) || screens[0];
  const previous = visibleScreen;
  visibleScreen = screen;
  for (const item of screens) {
    item.hidden = item !== screen;
    item.classList.toggle('arrived', item === screen && Boolean(previous));
  }
  window.scrollTo(0, 0);
  if (screen.id === 'finder') input.focus({ preventScroll: true });
  if (screen.id === 'ingredients') document.querySelector('#ingredient-heading').focus({ preventScroll: true });
  if (screen.id === 'cover' && previous) triggers[previous.id]?.focus({ preventScroll: true });
}

function setActive(position) {
  active = position;
  input.removeAttribute('aria-activedescendant');
  for (const [i, option] of [...matches.children].entries()) {
    option.setAttribute('aria-selected', String(i === active));
    if (i === active) input.setAttribute('aria-activedescendant', option.id);
  }
}

function updateResults() {
  const query = input.value.trim().toLowerCase();
  const rank = entry => entry.dataset.name.toLowerCase() === query ? 0 : 1;
  results = query ? entries.filter(entry => {
    const terms = [entry.dataset.name, ...(entry.dataset.ingredients || '').split('|')];
    return terms.some(term => term.toLowerCase().includes(query));
  }).sort((left, right) => rank(left) - rank(right)) : [];

  matches.replaceChildren(...results.map((entry, i) => {
    const option = document.createElement('li');
    option.id = 'match-' + i;
    option.setAttribute('role', 'option');
    option.textContent = entry.dataset.name;
    return option;
  }));
  setActive(-1);
  matches.hidden = !results.length;
  input.setAttribute('aria-expanded', String(Boolean(results.length)));
  status.textContent = !query ? 'Enter a few letters to find a brand.'
    : results.length ? results.length + (results.length === 1 ? ' match.' : ' matches.')
    : 'No matches. Try another name or open the index.';
}

function selectResult(i) {
  if (results[i]) {
    setActive(i);
    results[i].click();
  }
}

input.addEventListener('input', updateResults);
input.addEventListener('keydown', event => {
  if (!results.length || event.isComposing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const next = event.key === 'ArrowDown' ? active + 1 : active <= 0 ? results.length - 1 : active - 1;
    setActive(next % results.length);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    selectResult(Math.max(0, active));
  }
});
matches.addEventListener('click', event => {
  const option = event.target.closest('[role="option"]');
  if (option) selectResult([...matches.children].indexOf(option));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.isComposing && visibleScreen.id !== 'cover') {
    event.preventDefault();
    location.hash = 'cover';
  }
});

document.querySelector('#search').hidden = false;
index.open = false;
updateResults();
window.addEventListener('hashchange', showScreen);
showScreen();
