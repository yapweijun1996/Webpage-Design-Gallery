const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const mobile = window.matchMedia('(max-width: 900px)');
document.documentElement.classList.add('js');
let lastFocusedElement = document.activeElement;

document.addEventListener('focusin', (event) => {
  lastFocusedElement = event.target;
});

document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.header')) lastFocusedElement = null;
});

function closeMenu() {
  navigation.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}

toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  navigation.classList.toggle('open', !open);
  toggle.setAttribute('aria-expanded', String(!open));
});

navigation.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  closeMenu();
  // Keep the keyboard journey at the selected section when the menu collapses.
  if (mobile.matches && link.hash) {
    document.querySelector(link.hash)?.focus({ preventScroll: true });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    toggle.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.header')) closeMenu();
});

mobile.addEventListener('change', () => {
  // CSS can hide and blur a link before the media-query change event fires.
  const focusWouldBeHidden = mobile.matches && navigation.contains(lastFocusedElement);
  closeMenu();
  if (focusWouldBeHidden) toggle.focus();
});
