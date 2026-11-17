// Keep the reader's place when they return from an official brand page.
const occasionLinks = [...document.querySelectorAll('#occasions article a')];
const lastOccasionKey = 'gjh-pantry-notes-last-occasion';

function markLastOccasion(href) {
  document.querySelector('[data-last-opened]')?.remove();
  const link = occasionLinks.find(item => item.href === href);
  if (!link) return;

  const note = document.createElement('small');
  note.dataset.lastOpened = '';
  note.textContent = 'Last opened';
  link.querySelector('.card-copy').append(note);
}

window.addEventListener('pageshow', () => {
  try {
    markLastOccasion(sessionStorage.getItem(lastOccasionKey));
  } catch {
    // The occasion links also work when browser storage is unavailable.
  }
});

occasionLinks.forEach(link => {
  link.addEventListener('click', () => {
    markLastOccasion(link.href);
    try {
      sessionStorage.setItem(lastOccasionKey, link.href);
    } catch {
      // The marker can still survive a normal Back navigation via bfcache.
    }
  });
});
