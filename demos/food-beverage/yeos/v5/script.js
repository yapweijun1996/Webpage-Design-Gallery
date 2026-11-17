const picker = document.querySelector('#pack');
const reading = document.querySelector('.pack-reading');
const rows = [...document.querySelectorAll('tbody tr')];
function selectPack() {
  const all = picker.value === 'all';
  let available = rows.length;
  if (!all) {
    available = rows.filter(row => row.querySelector('[data-col="' + picker.value + '"]').textContent.trim() === '●').length;
  }
  for (const cell of document.querySelectorAll('[data-col]')) {
    cell.hidden = !all && picker.value !== cell.dataset.col;
  }
  document.querySelector('#match-total').textContent = available + ' / ' + rows.length;
  document.querySelector('#match-label').textContent = all ? 'Drinks in the pack guide' :
    'Drinks offered in a ' + picker.selectedOptions[0].textContent;
  document.querySelector('.match-track span').style.width = (available / rows.length * 100) + '%';
}
document.querySelector('[data-controls]').hidden = false;
reading.hidden = false;
picker.addEventListener('change', selectPack);
selectPack();
