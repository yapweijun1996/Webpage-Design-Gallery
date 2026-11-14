import {createCharacter} from './character.js';

export async function createPlayer(T, R, physics, scene, canvas, contactMaterial, contactPlane) {
  const character = await createCharacter(T);
  const visual = character.visual;
  scene.add(visual);
  const contact = new T.Mesh(contactPlane, contactMaterial);
  contact.rotation.x = -Math.PI / 2; contact.scale.set(1.55, 1.12, 1); scene.add(contact);
  const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-2, .89, 12));
  const capsule = physics.createCollider(R.ColliderDesc.capsule(.55, .3).setFriction(0), body);
  const controller = physics.createCharacterController(.025);
  controller.enableAutostep(.2, .28, true); controller.enableSnapToGround(.25);
  controller.setMaxSlopeClimbAngle(Math.PI / 4); controller.setMinSlopeSlideAngle(Math.PI / 3);
  const keys = new Set(); let vertical = 0, runToggle = false, stickX = 0, stickY = 0, injected = null;
  let yaw = 0, pitch = .1, drag = null, stickPointer = null, stickOrigin = null;
  const camera = new T.PerspectiveCamera(58, 1, .08, 100);
  const target = new T.Vector3(), desired = new T.Vector3(), offset = new T.Vector3(), direction = new T.Vector3(), safe = new T.Vector3();
  const ray = new R.Ray({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: -1});
  const movement = {x: 0, y: 0, z: 0}, next = {x: 0, y: 0, z: 0};
  const joystick = document.querySelector('#joystick'), thumb = joystick.querySelector('.joystick-thumb'), runButton = document.querySelector('#run-toggle');
  let isPaused = () => false;
  const resetStick = () => { stickX = stickY = 0; stickPointer = null; stickOrigin = null; thumb.style.transform = ''; joystick.classList.remove('is-floating'); };
  const clearInput = () => {
    const ids = [stickPointer, drag?.id]; keys.clear(); drag = null; resetStick();
    for (const id of ids) if (id != null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  };
  window.addEventListener('blur', clearInput);
  window.addEventListener('resize', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  document.addEventListener('focusin', event => {
    if (event.target !== canvas && event.target !== document.body) clearInput();
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) { clearInput(); return; }
    if (isPaused() ||
        (event.target !== canvas && event.target !== document.body)) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      // Space and tab retain their native page and focus semantics.
      if (event.target === canvas || event.target === document.body) event.preventDefault();
      keys.add(event.code);
    }
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  runButton.addEventListener('click', () => { runToggle = !runToggle; runButton.setAttribute('aria-pressed', String(runToggle)); runButton.textContent = runToggle ? 'Run: on' : 'Run'; });
  function dragStick(event) {
    if (!stickOrigin) return;
    const dx = event.clientX - stickOrigin.x, dy = event.clientY - stickOrigin.y;
    const distance = Math.hypot(dx, dy), strength = Math.min(1, Math.max(0, (distance - 8) / 30));
    stickX = distance ? dx / distance * strength : 0; stickY = distance ? -dy / distance * strength : 0;
    thumb.style.transform = `translate(${stickX * 18}px, ${-stickY * 18}px)`;
  }
  // Touch roles stay fixed for the lifetime of each pointer. The first canvas touch
  // moves from any origin; a second touch looks. HUD/modal targets never enter here.
  canvas.addEventListener('pointerdown', event => {
    if (isPaused() || event.button !== 0) return;
    if (event.pointerType === 'touch') {
      if (stickPointer !== null && drag) return; // Ignore a third finger.
      canvas.focus({preventScroll: true});
      if (stickPointer === null) {
        stickPointer = event.pointerId; stickOrigin = {x:event.clientX, y:event.clientY};
        const bounds = canvas.getBoundingClientRect(), size = joystick.getBoundingClientRect().width || 76;
        joystick.style.setProperty('--stick-left', `${event.clientX - bounds.left - size / 2}px`);
        joystick.style.setProperty('--stick-top', `${event.clientY - bounds.top - size / 2}px`);
        joystick.classList.add('is-floating'); dragStick(event);
      } else drag = {id:event.pointerId, x:event.clientX, y:event.clientY};
    } else {
      if (drag) return;
      canvas.focus({preventScroll: true}); drag = {id:event.pointerId, x:event.clientX, y:event.clientY};
    }
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (isPaused()) return;
    if (event.pointerId === stickPointer) { dragStick(event); return; }
    if (!drag || drag.id !== event.pointerId) return;
    yaw -= (event.clientX - drag.x) * .005; pitch = T.MathUtils.clamp(pitch + (event.clientY - drag.y) * .004, -.08, .9); drag.x = event.clientX; drag.y = event.clientY;
  });
  function releasePointer(event) {
    if (event.pointerId === stickPointer) resetStick();
    if (event.pointerId === drag?.id) drag = null;
  }
  // Capture can be revoked without pointerup/cancel (for example by another UI).
  // Clear only the affected pointer so an independent touch remains usable.
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, releasePointer);
  function update(dt) {
    if (isPaused()) { clearInput(); return; }
    const forward = injected?.forward ?? ((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + stickY);
    const right = injected?.right ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stickX);
    const running = injected?.run ?? (runToggle || keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const turning = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
    yaw += turning * (110 * Math.PI / 180) * dt;
    const length = Math.max(1, Math.hypot(forward, right)), speed = running ? 5 : 2.65;
    const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / length, dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / length;
    vertical = controller.computedGrounded() ? -.5 : Math.max(-18, vertical - 24 * dt);
    movement.x = dx * speed * dt; movement.y = vertical * dt; movement.z = dz * speed * dt;
    controller.computeColliderMovement(capsule, movement);
    const corrected = controller.computedMovement(), position = body.translation();
    next.x = position.x + corrected.x; next.y = position.y + corrected.y; next.z = position.z + corrected.z; body.setNextKinematicTranslation(next);
    const walking = Math.hypot(corrected.x, corrected.z) > .001;
    const state = walking ? running ? 'run' : 'walk' : 'idle';
    const requested = Math.hypot(forward, right) > .001 ? running ? 'run' : 'walk' : 'idle';
    character.update(state, dt, requested);
    if (walking || turning) {
      const angle = walking ? Math.atan2(-dx, -dz) : yaw, delta = Math.atan2(Math.sin(angle - visual.rotation.y), Math.cos(angle - visual.rotation.y));
      visual.rotation.y += delta * (1 - Math.exp(-14 * dt));
    }
  }
  function sync() {
    const p = body.translation(); visual.position.set(p.x, p.y - .875, p.z);
    // Clear the visual floor/rug inlays as well as the physical walking slab.
    contact.position.set(p.x, Math.max(.05, p.y - .83), p.z);
    contact.rotation.z = visual.rotation.y;
  }
  function constrain(point) {
    direction.copy(point).sub(target); const distance = direction.length(); if (!distance) return;
    direction.multiplyScalar(1 / distance);
    Object.assign(ray.origin, target); Object.assign(ray.dir, direction);
    const hit = physics.castRay(ray, distance + .32, true, undefined, undefined, capsule, body);
    if (hit) point.copy(target).addScaledVector(direction, Math.max(.18, hit.timeOfImpact - .32));
  }
  function updateCamera(dt, instant = false) {
    sync(); target.copy(visual.position); target.y += 1.24;
    const distance = canvas.clientWidth < 600 ? 5.5 : 6.5;
    offset.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance);
    desired.copy(target).add(offset); constrain(desired);
    if (instant) camera.position.copy(desired); else camera.position.lerp(desired, 1 - Math.exp(-12 * dt));
    safe.copy(camera.position); constrain(safe); camera.position.copy(safe); camera.lookAt(target);
  }
  function teleport(zone) {
    const destinations = {atrium: [-2, 12], newmoon: [-10, 2.4], mili: [0, 2.4], gogo: [10, 2.4]};
    if (!destinations[zone]) return false;
    const [x, z] = destinations[zone]; body.setTranslation({x, y: .89, z}, true); body.setNextKinematicTranslation({x, y: .89, z}); vertical = 0; yaw = 0; pitch = .1; visual.rotation.y = 0; clearInput();
    // Update broad-phase query positions before spring-arm obstruction tests.
    physics.step(); updateCamera(0, true); return true;
  }
  return {body, capsule, camera, update, sync, updateCamera, teleport, clearInput, setBagCount:character.setBagCount, startCollection:character.startCollection, cancelCollection:character.cancelCollection,
    setPaused: fn => { isPaused = fn; },
    setInput: input => { injected = input; if (Number.isFinite(input?.yaw)) yaw = input.yaw; if (Number.isFinite(input?.pitch)) pitch = T.MathUtils.clamp(input.pitch, -.08, .9); },
    get state() { const p = body.translation(); return {x: p.x, y: p.y - .875, z: p.z, animation: character.animation, yaw, facing: visual.rotation.y, pitch, character: character.state}; }
  };
}
