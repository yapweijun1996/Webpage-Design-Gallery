const picker = document.querySelector('#pack');
document.querySelector('[data-controls]').hidden = false;
picker.addEventListener('change', () => {
  for (const cell of document.querySelectorAll('[data-col]')) {
    cell.hidden = picker.value !== 'all' && picker.value !== cell.dataset.col;
  }
});
