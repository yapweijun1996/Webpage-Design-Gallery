(() => {
  const root = document.documentElement;
  const visual = document.querySelector('.visual-experience');
  const toggle = document.querySelector('.view-toggle');
  const world = document.querySelector('.scene-world');
  const camera = document.querySelector('.street-camera');
  const stage = document.querySelector('.street-stage');
  const back = document.querySelector('.back-street');
  const roomHeading = document.querySelector('#room-heading');
  const dialog = document.querySelector('#product-dialog');
  const dialogContent = dialog.querySelector('.dialog-content');
  const dialogTitle = document.querySelector('#product-dialog-title');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const panels = [...world.querySelectorAll('[data-room-panel]')];
  const doors = [...world.querySelectorAll('.store-door[data-room]')];
  const mapButtons = [...visual.querySelectorAll('[data-map-room]')];
  const labels = {lobby: 'Evening street', newmoon: 'New Moon', mili: 'MILI', gogo: 'GOGO'};
  const cameraScale = 2.6;
  const travelDuration = 850;
  let current = 'lobby';
  let destination = null;
  let lastDoor = 'newmoon';
  let travelTimer = 0;
  let travelVersion = 0;
  let lookFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let product = null;

  function focusDoor(room = lastDoor) {
    doors.find(door => door.dataset.room === room)?.focus({preventScroll: true});
  }

  function focusRoom() {
    if (current === 'lobby') focusDoor();
    else panels.find(panel => panel.dataset.roomPanel === current)?.querySelector('h2')?.focus({preventScroll: true});
  }

  function resetLook() {
    cancelAnimationFrame(lookFrame);
    lookFrame = 0;
    pointerX = 0;
    pointerY = 0;
    world.style.setProperty('--look-x', '0deg');
    world.style.setProperty('--look-y', '0deg');
  }

  function setCamera(x = 0, y = 0, scale = 1, immediate = false) {
    const transition = camera.style.transition;
    if (immediate) camera.style.transition = 'none';
    camera.style.setProperty('--camera-x', `${x}%`);
    camera.style.setProperty('--camera-y', `${y}%`);
    camera.style.setProperty('--camera-scale', String(scale));
    if (immediate) {
      // Commit the neutral pose before starting a new CSS transition.
      void camera.offsetWidth;
      camera.style.transition = transition;
    }
  }

  function facadePose(room) {
    const door = doors.find(item => item.dataset.room === room);
    const cameraTransform = camera.style.transform;
    const cameraTransition = camera.style.transition;
    const stageTransform = stage.style.transform;
    const stageAnimation = stage.style.animation;
    // Measure layout, not an in-flight dolly, pointer tilt, or touch drift.
    camera.style.transition = 'none';
    camera.style.transform = 'none';
    stage.style.transform = 'none';
    stage.style.animation = 'none';
    const sceneBounds = world.getBoundingClientRect();
    const cameraBounds = camera.getBoundingClientRect();
    const facadeBounds = door.getBoundingClientRect();
    const centerX = cameraBounds.left + cameraBounds.width / 2;
    const centerY = cameraBounds.top + cameraBounds.height / 2;
    const facadeX = facadeBounds.left + facadeBounds.width / 2;
    const facadeY = facadeBounds.top + facadeBounds.height / 2;
    const x = (sceneBounds.left + sceneBounds.width / 2 - centerX - cameraScale * (facadeX - centerX)) / cameraBounds.width * 100;
    const y = (sceneBounds.top + sceneBounds.height / 2 - centerY - cameraScale * (facadeY - centerY)) / cameraBounds.height * 100;
    camera.style.transform = cameraTransform;
    stage.style.transform = stageTransform;
    stage.style.animation = stageAnimation;
    void camera.offsetWidth;
    camera.style.transition = cameraTransition;
    return {x, y};
  }

  function showRoom(room) {
    current = room;
    world.dataset.currentRoom = room;
    panels.forEach(panel => { panel.hidden = panel.dataset.roomPanel !== room; });
    mapButtons.forEach(button => {
      if (button.dataset.mapRoom === room) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
    back.hidden = room === 'lobby';
    roomHeading.textContent = labels[room];
  }

  function cancelTravel() {
    clearTimeout(travelTimer);
    travelTimer = 0;
    travelVersion += 1;
    destination = null;
    delete world.dataset.travel;
    resetLook();
  }

  function afterTravel(callback) {
    if (reducedMotion.matches) {
      callback();
      return;
    }
    const version = travelVersion;
    travelTimer = setTimeout(() => {
      travelTimer = 0;
      if (version === travelVersion && root.dataset.view === 'visual') callback();
    }, travelDuration);
  }

  function navigate(room, focus = true) {
    if (!Object.hasOwn(labels, room) || root.dataset.view !== 'visual') return;
    if (room === current && destination === null) {
      if (focus) focusRoom();
      return;
    }
    closeProduct(false);
    cancelTravel();
    destination = room;
    const previous = current;

    function enter() {
      if (room === 'lobby') {
        destination = null;
        delete world.dataset.travel;
        back.hidden = true;
        if (focus) focusDoor();
        return;
      }
      lastDoor = room;
      setCamera(0, 0, 1, true);
      const pose = facadePose(room);
      world.dataset.travel = 'enter';
      back.hidden = false;
      setCamera(pose.x, pose.y, cameraScale, reducedMotion.matches);
      afterTravel(() => {
        destination = null;
        delete world.dataset.travel;
        showRoom(room);
        if (focus) focusRoom();
      });
    }

    if (previous !== 'lobby') {
      const focusWasInRoom = panels.some(panel => panel.dataset.roomPanel === previous && panel.contains(document.activeElement));
      showRoom('lobby');
      if (focusWasInRoom || document.activeElement === back) focusDoor(previous);
      const pose = facadePose(previous);
      setCamera(pose.x, pose.y, cameraScale, true);
      world.dataset.travel = 'exit';
      back.hidden = false;
      setCamera(0, 0, 1, reducedMotion.matches);
      afterTravel(enter);
    } else {
      setCamera(0, 0, 1, true);
      enter();
    }
  }

  function restoreProduct(returnFocus = true) {
    if (!product) return;
    const {panel, parent, next, wasOpen, trigger} = product;
    product = null;
    parent.insertBefore(panel, next?.parentNode === parent ? next : null);
    panel.open = wasOpen;
    dialogTitle.textContent = 'Product details';
    if (returnFocus && root.dataset.view === 'visual' && trigger.isConnected && !trigger.closest('[hidden]')) {
      trigger.focus({preventScroll: true});
    }
  }

  function closeProduct(returnFocus = true) {
    if (dialog.open) dialog.close();
    restoreProduct(returnFocus);
  }

  function setView(view) {
    const list = view === 'list';
    const focusWasInVisual = visual.contains(document.activeElement);
    const focusWasInDialog = dialog.contains(document.activeElement);
    const focusWasInBaseline = document.activeElement.closest('#store-list, .product-panels, .story-list');
    closeProduct(false);
    cancelTravel();
    if (current === 'lobby') setCamera(0, 0, 1, true);
    back.hidden = current === 'lobby';
    root.dataset.view = list ? 'list' : 'visual';
    toggle.setAttribute('aria-pressed', String(list));
    if (list && (focusWasInVisual || focusWasInDialog)) {
      const heading = document.querySelector('#store-list h2');
      heading.tabIndex = -1;
      heading.focus({preventScroll: true});
    } else if (!list && focusWasInBaseline) {
      focusRoom();
    }
  }

  function openProduct(trigger) {
    const panel = document.getElementById(trigger.dataset.product);
    if (!(panel instanceof HTMLDetailsElement)) return;
    closeProduct(false);
    product = {panel, parent: panel.parentNode, next: panel.nextSibling, wasOpen: panel.open, trigger};
    dialogTitle.textContent = panel.querySelector('summary').textContent.trim();
    dialogContent.append(panel);
    panel.open = true;
    dialog.showModal();
  }

  function revealBaselineTarget(hash) {
    if (!hash.startsWith('#')) return;
    const target = document.getElementById(hash.slice(1));
    if (!target?.closest('#store-list, .product-panels, .story-list')) return;
    setView('list');
    if (target instanceof HTMLDetailsElement) target.open = true;
  }

  showRoom('lobby');
  root.classList.add('js', 'visual-ready');
  setView('visual');
  toggle.hidden = false;
  revealBaselineTarget(location.hash);

  toggle.addEventListener('click', () => setView(root.dataset.view === 'list' ? 'visual' : 'list'));
  visual.querySelectorAll('[data-room], [data-map-room]').forEach(button => {
    button.addEventListener('click', () => navigate(button.dataset.room || button.dataset.mapRoom));
  });
  back.addEventListener('click', () => navigate('lobby'));
  visual.querySelectorAll('[data-product]').forEach(button => {
    button.addEventListener('click', () => openProduct(button));
  });
  dialog.querySelector('.close-product').addEventListener('click', () => closeProduct());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, a[href], summary, [tabindex="0"]')]
      .filter(control => !control.disabled && control.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  dialog.addEventListener('close', () => {
    // A queued close event must not restore a newly opened product.
    if (!dialog.open) restoreProduct();
  });
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => revealBaselineTarget(link.getAttribute('href')));
  });
  addEventListener('hashchange', () => revealBaselineTarget(location.hash));

  visual.addEventListener('keydown', event => {
    if (root.dataset.view !== 'visual' || dialog.open) return;
    if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (event.key === 'Escape' && (current !== 'lobby' || destination !== null)) {
      event.preventDefault();
      navigate('lobby');
      return;
    }
    if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
    const controls = current === 'lobby' && !event.target.closest('[data-map-room]') ? doors : mapButtons;
    const active = event.target.closest('.store-door, [data-map-room]');
    const index = controls.indexOf(active);
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const next = index < 0 ? (forward ? 0 : controls.length - 1) : (index + (forward ? 1 : -1) + controls.length) % controls.length;
    event.preventDefault();
    controls[next]?.focus({preventScroll: true});
  });

  reducedMotion.addEventListener('change', () => {
    const target = destination;
    resetLook();
    if (target !== null) navigate(target);
  });
  finePointer.addEventListener('change', resetLook);
  visual.addEventListener('pointermove', event => {
    if (reducedMotion.matches || !finePointer.matches || event.pointerType !== 'mouse' || current !== 'lobby' || destination !== null || root.dataset.view !== 'visual') return;
    const bounds = visual.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)) * 1.3;
    pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) * -0.8;
    if (lookFrame) return;
    lookFrame = requestAnimationFrame(() => {
      lookFrame = 0;
      world.style.setProperty('--look-x', `${pointerX}deg`);
      world.style.setProperty('--look-y', `${pointerY}deg`);
    });
  });
  visual.addEventListener('pointerleave', resetLook);
})();
