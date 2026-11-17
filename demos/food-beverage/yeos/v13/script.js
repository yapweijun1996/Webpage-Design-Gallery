const dial = document.querySelector('.dial');
const face = dial.querySelector('img');
const positions = [...dial.querySelectorAll('a')];
function preview(link) {
  const profile = document.getElementById(link.hash.slice(1));
  const photo = profile.querySelector('img');
  face.src = photo.getAttribute('src');
  face.alt = photo.alt;
  document.querySelector('#dial-name').textContent = profile.querySelector('h2').textContent;
  for (const item of positions) item.classList.toggle('on-dial', item === link);
}
for (const link of positions) {
  link.addEventListener('pointerenter', () => preview(link));
  link.addEventListener('focus', () => preview(link));
}
document.querySelector('.dial-reading').hidden = false;
preview(positions.find(link => link.hash === location.hash) || positions[5]);
