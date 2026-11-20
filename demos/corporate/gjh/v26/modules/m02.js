document.addEventListener('gjh:ready', () => {
  const root = document.querySelector('#m02 .m02-origins');
  if (!root || root.classList.contains('m02-ready')) return;

  const timeline = root.querySelector('.m02-steps');
  const buttons = [...timeline.querySelectorAll('.m02-step')];
  const panels = buttons.map(button => document.getElementById(button.getAttribute('aria-controls')));

  function showStep(activeIndex) {
    buttons.forEach((button, index) => {
      const active = index === activeIndex;
      button.setAttribute('aria-pressed', String(active));
      panels[index].hidden = !active;
    });
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => showStep(index));
  });

  showStep(0);
  timeline.hidden = false;
  root.classList.add('m02-ready');
});
