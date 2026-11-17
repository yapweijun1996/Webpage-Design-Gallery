const form = document.querySelector('#tally');
form.hidden = false;
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const guests = document.querySelector('#guests').valueAsNumber;
  const serving = document.querySelector('#serve').valueAsNumber;
  const size = Number(document.querySelector('#size').value);
  const volume = guests * serving;
  const count = Math.ceil(volume / size);
  const spare = count * size - volume;
  const kind = document.querySelector('#size').selectedOptions[0].textContent.split(' ').at(-1);
  document.querySelector('#pack-quantity').textContent = count.toLocaleString('en-SG');
  document.querySelector('#pack-unit').textContent = kind + (count === 1 ? '' : 's');
  document.querySelector('#pack-capacity').textContent = size + ' mL each';
  document.querySelector('#estimate').textContent = volume.toLocaleString('en-SG') + ' mL planned · ' + count + (count === 1 ? ' pack' : ' packs') + ' of ' + size + ' mL · ' + spare + ' mL spare.';
});
