const pantry = document.querySelector('#pantry');
const openShelf = document.querySelector('#open');
const label = document.querySelector('#label');
const sections = [pantry, openShelf, label];
const fallback = pantry.querySelector('.handle');
const handle = document.createElement('button');
handle.type = 'button';
handle.className = fallback.className;
handle.setAttribute('aria-label', fallback.getAttribute('aria-label'));
handle.setAttribute('aria-controls', 'open');
handle.append(...fallback.childNodes);
fallback.replaceWith(handle);

const turn = document.querySelector('#turn');
const front = document.querySelector('#tin-front');
const back = document.querySelector('#tin-back');
turn.hidden = false;

function face(reverse) {
  front.hidden = reverse;
  back.hidden = !reverse;
  turn.firstChild.textContent = reverse ? 'Show front ' : 'Turn tin ';
  document.querySelector('#open-title').innerHTML = reverse
    ? 'Check the<br><em>other side.</em>' : 'Recognise<br><em>this tin?</em>';
}

function displaySection(moveFocus) {
  const next = sections.find(section => '#' + section.id === location.hash) || pantry;
  for (const section of sections) section.hidden = section !== next;
  face(false);
  openShelf.classList.toggle('revealed', next === openShelf && moveFocus);
  if (moveFocus) {
    next.querySelector('h1, h2').focus({preventScroll:true});
    window.scrollTo(0, 0);
  }
}
window.addEventListener('hashchange', () => displaySection(true));
displaySection(Boolean(location.hash));

turn.addEventListener('click', () => {
  face(back.hidden);
  document.querySelector('#open-title').focus({preventScroll:true});
});

let gesture = null;
let suppressClick = false;
handle.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, dragged:false};
  handle.setPointerCapture(event.pointerId);
  pantry.classList.add('dragging');
});

function track(event) {
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (Math.hypot(dx, dy) >= 5) gesture.dragged = true;
  const pull = Math.max(0, Math.min(72, dy));
  pantry.style.setProperty('--pull', pull + 'px');
  return pull;
}

handle.addEventListener('pointermove', event => {
  if (gesture?.id === event.pointerId) track(event);
});

function release(event) {
  if (gesture?.id !== event.pointerId) return;
  const completed = event.type === 'pointerup';
  const pull = completed ? track(event) : 0;
  suppressClick = !completed || gesture.dragged;
  gesture = null;
  pantry.classList.remove('dragging');
  pantry.style.removeProperty('--pull');
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  if (pull > 36) location.hash = 'open';
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  handle.addEventListener(type, release);
}
handle.addEventListener('click', event => {
  if (event.detail === 0 || !suppressClick) location.hash = 'open';
  suppressClick = false;
});
