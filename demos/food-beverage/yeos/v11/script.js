const controls = document.querySelector('[data-controls]');
controls.hidden = false;
controls.addEventListener('click', event => {
  const choice = event.target.closest('[data-choice]');
  if (!choice) return;
  const format = choice.dataset.choice;
  let count = 0;
  for (const item of document.querySelectorAll('[data-formats]')) {
    for (const ticket of item.querySelectorAll('[data-container]')) {
      ticket.hidden = format !== 'all' && ticket.dataset.container !== format;
    }
    item.hidden = format !== 'all' && !item.dataset.formats.split(' ').includes(format);
    if (!item.hidden) count++;
  }
  for (const item of controls.querySelectorAll('button')) item.setAttribute('aria-pressed', String(item === choice));
  document.querySelector('#count').textContent = count + ' drinks shown';
});
