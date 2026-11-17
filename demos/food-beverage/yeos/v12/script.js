const journal = document.querySelector('#journal');
const drink = document.querySelector('#drink');
const entry = document.querySelector('#entry');
const message = document.querySelector('#saved');
const prefix = 'yeos-tasting-notebook:';
const drafts = new Map();
const requested = new URLSearchParams(location.search).get('drink');
if ([...drink.options].some(option => option.value === requested)) drink.value = requested;
let active = drink.value;
function loadSaved() {
  document.querySelector('#journal-drink').textContent = drink.selectedOptions[0].textContent;
  document.querySelector('#journal-portrait').src = '../v1/assets/' + active + '.webp';
  try {
    entry.value = drafts.get(active) ?? localStorage.getItem(prefix + active) ?? '';
    message.textContent = drafts.has(active) ? 'Unsaved changes.' : entry.value ? 'Saved note loaded.' : '';
  } catch {
    entry.value = drafts.get(active) || '';
    message.textContent = 'Device storage is unavailable. Keep a copy of your note.';
  }
}
journal.hidden = false;
loadSaved();
drink.addEventListener('change', () => {
  active = drink.value;
  loadSaved();
});
entry.addEventListener('input', () => {
  drafts.set(active, entry.value);
  message.textContent = 'Unsaved changes.';
});
journal.addEventListener('submit', event => {
  event.preventDefault();
  try {
    if (entry.value.trim()) localStorage.setItem(prefix + active, entry.value);
    else localStorage.removeItem(prefix + active);
    drafts.delete(active);
    message.textContent = entry.value.trim() ? 'Saved on this device.' : 'Note cleared.';
  } catch {
    message.textContent = 'Unable to save. Copy your note before leaving.';
  }
});
