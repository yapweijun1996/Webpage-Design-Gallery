/** Shelf owns presentation only. modes.js owns pause; products.js owns all bounds/assets. */
export function createShelfFocus({T, canvas, normalCamera, shelves, projection, onChange, onDetails, onAdd, onRestore}) {
  const dialog = document.querySelector('#shelf-dialog'), stage = dialog.querySelector('.shelf-stage');
  const target = document.querySelector('#shelf-target'), title = document.querySelector('#shelf-title');
  const note = document.querySelector('#shelf-status'), add = document.querySelector('#shelf-add');
  const outline = document.querySelector('#nearby-shelf-outline');
  const overlay = document.querySelector('.mall-overlay');
  const camera = normalCamera.clone();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let session = null, nearby = null, quantity = {}, transition = null;
  const project = projection.bounds, place = projection.place;
  function updateQuantity() {
    if (!session) return;
    const count = quantity[session.shelf.id] || 0;
    add.disabled = count >= 9;
    add.textContent = count >= 9 ? 'Limit reached (9)' : 'Add to demo bag';
    note.textContent = `Demo bag: ${count} · max 9. Same product on every can.`;
  }
  function reframe() {
    if (!session) return;
    const scene = canvas.getBoundingClientRect();
    Object.assign(dialog.style, {left: `${scene.left}px`, top: `${scene.top}px`, width: `${scene.width}px`, height: `${scene.height}px`});
    const area = stage.getBoundingClientRect(), {min, max} = session.shelf;
    const layout = [scene.x, scene.y, scene.width, scene.height, area.x, area.y, area.width, area.height, normalCamera.fov].join(',');
    if (session.layout === layout) return;
    session.layout = layout;
    const center = new T.Vector3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    camera.aspect = scene.width / scene.height; camera.fov = normalCamera.fov;
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    // Fit the entire depth-inclusive box, leaving room for the complete focus ring.
    const distance = Math.max((max.y - min.y) * scene.height / (Math.max(1, area.height - 32) * 2 * tangent),
      (max.x - min.x) * scene.width / (Math.max(1, area.width - 32) * 2 * tangent * camera.aspect)) + (max.z - min.z) / 2;
    camera.position.set(center.x, center.y, center.z + distance);
    // A frontal cutaway excludes aisle plants/visitor-scale foreground objects
    // without editing, cloning or disposing any shared scene geometry/material.
    camera.near = Math.max(.08, camera.position.z - max.z - .04);
    camera.lookAt(center);
    camera.setViewOffset(scene.width, scene.height,
      scene.width / 2 - (area.left + area.width / 2 - scene.left),
      scene.height / 2 - (area.top + area.height / 2 - scene.top), scene.width, scene.height);
    camera.updateProjectionMatrix();
    transition = null;
  }
  function finishClose(restoreFocus) {
    if (!session) return;
    const previous = session; session = null; transition = null;
    overlay.inert = previous.inert; canvas.tabIndex = previous.tabIndex;
    target.hidden = true;
    onRestore(previous.resized);
    onChange();
    if (restoreFocus) {
      const owner = previous.focus;
      (owner instanceof HTMLElement && owner.isConnected && owner.getClientRects().length && !owner.matches(':disabled') && !owner.closest('[hidden]') ? owner : canvas).focus({preventScroll: true});
    }
  }
  function close({focus = true} = {}) {
    if (!session) return;
    dialog.close();
    // Restore synchronously before an explicit detail/modal handoff. The queued
    // native close event must never focus an old Shelf control over the next owner.
    finishClose(focus);
  }
  dialog.addEventListener('close', () => { if (!dialog.open) finishClose(true); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  });
  document.addEventListener('keydown', event => {
    if (session && event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (!session || event.key !== 'Tab') return;
    const controls = [...document.querySelectorAll('.site-header a, .site-header button, #shelf-dialog button')]
      .filter(el => !el.disabled && el.getClientRects().length && !el.closest('[hidden]'));
    const index = controls.indexOf(document.activeElement);
    event.preventDefault();
    controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus({preventScroll: true});
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target === stage) close();
  });
  for (const id of ['shelf-back', 'shelf-close']) document.getElementById(id).addEventListener('click', () => close());
  document.querySelector('#shelf-details').addEventListener('click', () => {
    if (!session) return;
    const id = session.shelf.id; close(); onDetails(id);
  });
  add.addEventListener('click', () => { if (session && !add.disabled) onAdd(session.shelf.id); });
  target.addEventListener('click', () => { updateQuantity(); });
  new ResizeObserver(() => { if (session) reframe(); }).observe(stage);
  motion.addEventListener('change', () => { if (session) { session.layout = null; reframe(); } });
  return {
    get open() { return Boolean(session); },
    get camera() { return camera; },
    get state() { return session ? {id: session.shelf.id, bounds: session.shelf, projected: project(session.shelf, camera),
      viewProjection: new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).toArray(), transitioning: Boolean(transition)} : null; },
    openShelf(id, record) {
      if (session) return false;
      const shelf = shelves.find(item => item.id === id);
      if (!shelf || !record) return false;
      session = {shelf, focus: document.activeElement, inert: overlay.inert, tabIndex: canvas.tabIndex, resized: false};
      title.textContent = record.name;
      target.setAttribute('aria-label', `Select ${record.name} shelf. All cans are the same product.`);
      target.hidden = false; overlay.inert = true; canvas.tabIndex = -1;
      dialog.show(); updateQuantity(); reframe();
      if (!motion.matches) {
        // Animate only the presentation camera, along its safe frontal axis.
        transition = {from: camera.position.z + .7, to: camera.position.z, start: performance.now()};
      }
      outline.hidden = true;
      onChange(); document.querySelector('#shelf-close').focus({preventScroll: true});
      return true;
    },
    close,
    hideNearby() { projection.visible(outline, false); },
    focus() { if (session) document.querySelector('#shelf-close').focus({preventScroll: true}); },
    resize() { if (session) { session.resized = true; reframe(); } },
    setNearby(id) { nearby = shelves.find(item => item.id === id) || null; },
    quantities(value) { quantity = value; updateQuantity(); },
    update(view, active, nearbyActive = active) {
      if (session && active) {
        if (transition) {
          const t = motion.matches ? 1 : Math.min(1, (performance.now() - transition.start) / 240);
          camera.position.z = transition.from + (transition.to - transition.from) * t * t * (3 - 2 * t);
          camera.near = Math.max(.08, camera.position.z - session.shelf.max.z - .04);
          camera.updateProjectionMatrix();
          if (t === 1) transition = null;
        }
        place(target, project(session.shelf, camera), stage.getBoundingClientRect());
      }
      // Outline only a complete, currently visible nearby shelf; never draw a clipped target.
      const rect = canvas.getBoundingClientRect(), bounds = !session && nearbyActive && nearby ? project(nearby, view) : null;
      const visible = bounds && bounds.left >= rect.left + 4 && bounds.right <= rect.right - 4 && bounds.top >= rect.top + 4 && bounds.bottom <= rect.bottom - 4;
      place(outline, visible ? bounds : null, rect);
    },
  };
}
