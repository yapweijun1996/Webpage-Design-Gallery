(() => {
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const visual = document.querySelector('.visual-experience');
  const toggle = document.querySelector('.view-toggle');
  const world = document.querySelector('.scene-world');
  const roomHeading = document.querySelector('#room-heading');
  const rooms = ['lobby', 'newmoon', 'mili', 'gogo'];
  const labels = {lobby:'The Lobby', newmoon:'New Moon', mili:'MILI', gogo:'GOGO'};
  let current = 'lobby';

  function setRoom(room, focus = false) {
    if (!rooms.includes(room)) return;
    current = room;
    world.dataset.currentRoom = room;
    document.querySelectorAll('[data-room-panel]').forEach(panel => {
      panel.hidden = panel.dataset.roomPanel !== room;
    });
    document.querySelectorAll('[data-map-room]').forEach(button => {
      if (button.dataset.mapRoom === room) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
    roomHeading.textContent = labels[room];
    if (focus) document.querySelector(`[data-room-panel="${room}"] h2, [data-room-panel="${room}"] .store-door`)?.focus();
  }

  function setView(view) {
    root.dataset.view = view;
    const list = view === 'list';
    toggle.setAttribute('aria-pressed', String(list));
    toggle.textContent = list ? 'Visual view' : 'List view';
  }

  toggle.hidden = false;
  root.classList.add('js', 'visual-ready');
  setView(reducedMotion.matches ? 'list' : 'visual');
  setRoom(current);
  toggle.addEventListener('click', () => setView(root.dataset.view === 'list' ? 'visual' : 'list'));
  document.querySelectorAll('[data-room], [data-map-room]').forEach(button => {
    button.addEventListener('click', () => {
      const room = button.dataset.room || button.dataset.mapRoom;
      setRoom(room);
    });
  });
  document.querySelectorAll('[data-direction]').forEach(button => {
    button.addEventListener('click', () => {
      const index = rooms.indexOf(current);
      const next = button.dataset.direction === 'next' ? (index + 1) % rooms.length : (index - 1 + rooms.length) % rooms.length;
      setRoom(rooms[next]);
    });
  });
  document.querySelectorAll('[data-product]').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.dataset.product);
      panel.open = true;
      setView('list');
      panel.scrollIntoView({behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start'});
      panel.querySelector('summary').focus({preventScroll: true});
    });
  });
  document.querySelectorAll('.list-view a[href^="#sku-"]').forEach(link => {
    link.addEventListener('click', () => {
      const panel = document.querySelector(link.getAttribute('href'));
      panel.open = true;
      setRoom('newmoon');
      setView('list');
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && current !== 'lobby') {
      setView('visual');
      setRoom('lobby', true);
      return;
    }
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key) && root.dataset.view === 'visual') {
      event.preventDefault();
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const index = rooms.indexOf(current);
      setRoom(rooms[(index + (forward ? 1 : -1) + rooms.length) % rooms.length]);
    }
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) setView('list');
  });

  let pointerX = 0;
  let pointerY = 0;
  let frame = 0;
  visual.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType !== 'mouse') return;
    pointerX = (event.clientX / innerWidth - .5) * 8;
    pointerY = (event.clientY / innerHeight - .5) * 6;
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      world.style.setProperty('--look-x', `${pointerX}px`);
      world.style.setProperty('--look-y', `${pointerY}px`);
    });
  });
  visual.addEventListener('pointerleave', () => {
    world.style.removeProperty('--look-x');
    world.style.removeProperty('--look-y');
  });
})();
