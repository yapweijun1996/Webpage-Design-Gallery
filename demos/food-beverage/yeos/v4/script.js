const menuPhoto = document.querySelector('.board-print');
for (const entry of document.querySelectorAll('.menu details')) {
  entry.addEventListener('toggle', () => {
    if (!entry.open) return;
    const name = entry.querySelector('summary span').textContent;
    const picture = menuPhoto.querySelector('img');
    picture.src = entry.dataset.image;
    picture.alt = 'Serving illustration of ' + name;
    menuPhoto.querySelector('figcaption').textContent = name;
  });
}
