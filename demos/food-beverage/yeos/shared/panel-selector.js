const controls = document.querySelector('[data-controls]');
const buttons = [...controls.querySelectorAll('button')];
const panels = [...document.querySelectorAll('[data-panel]')];
function show(key) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.choice === key));
  for (const panel of panels) panel.hidden = panel.dataset.panel !== key;
}
controls.hidden = false;
show(buttons.find(button => button.getAttribute('aria-pressed') === 'true').dataset.choice);
controls.addEventListener('click', event => {
  const button = event.target.closest('[data-choice]');
  if (button) show(button.dataset.choice);
});
