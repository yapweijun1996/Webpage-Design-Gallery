const bay = document.getElementById('bay');
const checklists = [...document.querySelectorAll('.checklist')];
const sharedFields = ['item', 'date', 'caseSize'];
let previousSector;

function updateNote(section) {
  const form = section.querySelector('form');
  const retail = section.id === 'retail';
  const numbers = {};
  for (const input of form.querySelectorAll('[inputmode="numeric"]')) {
    const raw = input.value.trim();
    const number = Number(raw);
    const valid = /^[0-9]+$/.test(raw) && Number.isSafeInteger(number) && number > 0;
    const missing = !raw && input.name !== 'caseSize' && input.dataset.visited;
    const error = raw && !valid ? 'Enter a whole number greater than zero.'
      : missing ? 'Enter a quantity to estimate cases.' : '';
    document.getElementById(input.id + '-error').textContent = error;
    input.setAttribute('aria-invalid', String(Boolean(error)));
    numbers[input.name] = valid ? number : null;
  }

  const { packs, covers, yield: portions, caseSize } = numbers;
  const required = retail ? packs : covers && portions && Math.ceil(covers / portions);
  let estimate = '';
  if (required && caseSize) {
    const cases = Math.ceil(required / caseSize);
    const extra = (caseSize - required % caseSize) % caseSize;
    const yieldStep = retail ? '' : covers + ' covers ÷ ' + portions + ' portions per pack → ';
    estimate = yieldStep + required + ' packs ÷ ' + caseSize + ' packs per case → ' +
      cases + ' whole ' + (cases === 1 ? 'case' : 'cases') + ', leaving ' + extra + ' spare packs.';
  }
  form.querySelector('output').textContent = estimate;
  const quantity = retail ? ['Shelf quantity in packs — ' + (packs ?? 'To confirm')]
    : ['Menu covers — ' + (covers ?? 'To confirm'), 'Usable portions per pack — ' + (portions ?? 'To confirm')];
  section.querySelector('pre').textContent = [
    (retail ? 'Retail' : 'Foodservice') + ' enquiry',
    'Item — ' + (form.elements.namedItem('item').value.trim() || 'To confirm'),
    (retail ? 'Replenishment' : 'Service') + ' date — ' + (form.elements.date.value || 'To confirm'),
    ...quantity,
    caseSize ? 'Packs per case — ' + caseSize : 'Please confirm packs per case.',
    estimate,
    'Please confirm case configuration and availability.'
  ].filter(Boolean).join('\n');
}

for (const section of checklists) {
  const form = section.querySelector('form');
  section.querySelector('.review').hidden = false;
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => updateNote(section));
  form.addEventListener('focusout', event => {
    event.target.dataset.visited = 'true';
    updateNote(section);
  });
  section.querySelector('.save').addEventListener('click', () => {
    const note = section.querySelector('pre').textContent;
    const url = URL.createObjectURL(new Blob([note + '\n'], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = section.id + '-buying-note.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
}

function showView(moveFocus) {
  const selected = checklists.find(section => '#' + section.id === location.hash);
  if (selected && previousSector && previousSector !== selected) {
    const source = previousSector.querySelector('form');
    const target = selected.querySelector('form');
    target.reset();
    for (const name of sharedFields) target.elements.namedItem(name).value = source.elements.namedItem(name).value;
    for (const field of target.elements) delete field.dataset.visited;
  }
  bay.hidden = Boolean(selected);
  for (const section of checklists) section.hidden = section !== selected;
  if (selected) {
    updateNote(selected);
    previousSector = selected;
  }
  if (moveFocus) {
    const heading = selected ? selected.querySelector('h2') : bay.querySelector('h1');
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

showView(false);
window.addEventListener('hashchange', () => showView(true));
