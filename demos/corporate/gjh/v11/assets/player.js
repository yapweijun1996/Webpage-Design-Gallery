export async function createPlayer(T, R, physics, scene, canvas, contactMaterial, contactPlane) {
  const {GLTFLoader} = await import('../vendor/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync('assets/shopper.glb');
  const avatar = gltf.scene;
  const bounds = new T.Box3().setFromObject(avatar), height = bounds.max.y - bounds.min.y;
  avatar.scale.setScalar(1.65 / height); avatar.position.y = -bounds.min.y * avatar.scale.y;
  // The loaded skinned character presents its face along +Z; locomotion uses -Z.
  avatar.rotation.y = Math.PI;
  const visual = new T.Group(); visual.add(avatar); scene.add(visual);
  const contact = new T.Mesh(contactPlane, contactMaterial);
  contact.rotation.x = -Math.PI / 2; contact.scale.set(1.55, 1.12, 1); scene.add(contact);
  // A view-space edge fill separates the original mesh without extra geometry,
  // shadow passes, or a light that spills onto the surrounding architecture.
  const shopperRim = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float shopperRim = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
      shopperRim = smoothstep(0.28, 1.0, shopperRim);
      outgoingLight += vec3(0.09, 0.13, 0.12) * shopperRim;
      #include <opaque_fragment>
    `);
  };
  avatar.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    // A restrained, texture-matched fill keeps the back readable in shop shadows.
    const material = object.material;
    material.emissive.setHex(0xffffff); material.emissiveMap = material.map; material.emissiveIntensity = .1;
    material.roughness = .88; material.onBeforeCompile = shopperRim;
  });
  // These rigid, T-pose arms have no elbow joints. Shorten their reach slightly
  // at the shoulder so lowered hands clear the shoes without lifting the avatar.
  avatar.getObjectByName('arm-left').scale.x = .86;
  avatar.getObjectByName('arm-right').scale.x = .86;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const armPose = new T.Euler(0, 0, 0, 'XYZ'), armRotation = new T.Quaternion(), neutralRotation = new T.Quaternion();
  const mixer = new T.AnimationMixer(avatar), actions = {};
  for (const [state, clipName] of Object.entries({idle: 'idle', walk: 'walk', run: 'sprint'})) {
    const clip = gltf.animations.find(clip => clip.name === clipName);
    if (!clip) throw new Error(`Character animation missing: ${clipName}`);
    // Bake the shoulder correction once; the mixer still owns all blending.
    // The source clips splay the arms 30–60 degrees and swing around local Y.
    // Counter the same-side leg's sagittal motion, with a relaxed arm drop.
    for (const side of ['left', 'right']) {
      const arm = clip.tracks.find(track => track.name === `arm-${side}.quaternion`);
      const leg = clip.tracks.find(track => track.name === `leg-${side}.quaternion`);
      if (leg) {
        // Keep the source gait, but avoid the rigid legs' exaggerated high kick.
        for (let frame = 0; frame < leg.times.length; frame++) {
          armRotation.fromArray(leg.values, frame * 4).slerp(neutralRotation, state === 'run' ? .2 : .4).toArray(leg.values, frame * 4);
        }
      }
      const stride = leg?.createInterpolant(new Float32Array(4));
      const drop = side === 'left' ? -1 : 1;
      for (let frame = 0; frame < arm.times.length; frame++) {
        const time = arm.times[frame];
        let swing = -.065, rest = state === 'run' ? 1.21 : 1.28;
        if (stride) {
          const rotation = stride.evaluate(time);
          const legAngle = 2 * Math.atan2(rotation[0] * (rotation[3] < 0 ? -1 : 1), Math.abs(rotation[3]));
          swing -= legAngle * (state === 'run' ? .58 : .44);
        } else if (!reducedMotion.matches) {
          const breath = Math.sin(time / clip.duration * Math.PI * 2);
          swing += breath * .012; rest += breath * .018;
        }
        armPose.set(swing, 0, drop * rest);
        armRotation.setFromEuler(armPose).toArray(arm.values, frame * 4);
      }
    }
    actions[state] = mixer.clipAction(clip);
  }
  const animationStates = ['idle', 'walk', 'run'], animationActions = animationStates.map(state => actions[state]);
  for (let i = 0; i < animationActions.length; i++) animationActions[i].setEffectiveWeight(i === 0 ? 1 : 0).play();
  let animation = 'idle'; actions.idle.paused = reducedMotion.matches; mixer.update(0);
  const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-2, .89, 12));
  const capsule = physics.createCollider(R.ColliderDesc.capsule(.55, .3).setFriction(0), body);
  const controller = physics.createCharacterController(.025);
  controller.enableAutostep(.2, .28, true); controller.enableSnapToGround(.25);
  controller.setMaxSlopeClimbAngle(Math.PI / 4); controller.setMinSlopeSlideAngle(Math.PI / 3);
  const keys = new Set(); let vertical = 0, runToggle = false, stickX = 0, stickY = 0, injected = null;
  let yaw = 0, pitch = .1, drag = null, stickPointer = null;
  const camera = new T.PerspectiveCamera(58, 1, .08, 100);
  const target = new T.Vector3(), desired = new T.Vector3(), offset = new T.Vector3(), direction = new T.Vector3(), safe = new T.Vector3();
  const ray = new R.Ray({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: -1});
  const movement = {x: 0, y: 0, z: 0}, next = {x: 0, y: 0, z: 0};
  const joystick = document.querySelector('#joystick'), thumb = joystick.querySelector('.joystick-thumb'), runButton = document.querySelector('#run-toggle');
  let isPaused = () => false;
  const clearInput = () => { keys.clear(); stickX = stickY = 0; drag = null; stickPointer = null; thumb.style.transform = ''; };
  window.addEventListener('blur', clearInput);
  document.addEventListener('keydown', event => {
    if (isPaused() || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      // Space and tab retain their native page and focus semantics.
      if (event.target === canvas || event.target === document.body) event.preventDefault();
      keys.add(event.code);
    }
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  runButton.addEventListener('click', () => { runToggle = !runToggle; runButton.setAttribute('aria-pressed', String(runToggle)); runButton.textContent = runToggle ? 'Run: on' : 'Run'; });
  function dragStick(event) {
    const bounds = joystick.getBoundingClientRect();
    const x = (event.clientX - bounds.x - bounds.width / 2) / 38, y = (event.clientY - bounds.y - bounds.height / 2) / 38;
    const length = Math.max(1, Math.hypot(x, y)); stickX = x / length; stickY = -y / length;
    thumb.style.transform = `translate(${stickX * 26}px, ${-stickY * 26}px)`;
  }
  // The joystick is drawn over, but receives touches through, the canvas. This keeps
  // touch-action:none confined to the canvas and preserves normal page zoom elsewhere.
  canvas.addEventListener('pointerdown', event => {
    if (isPaused()) return;
    canvas.focus({preventScroll: true}); canvas.setPointerCapture(event.pointerId);
    const bounds = joystick.getBoundingClientRect();
    if (event.pointerType === 'touch' && bounds.width && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
      stickPointer = event.pointerId; dragStick(event);
    } else if (!drag) drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  canvas.addEventListener('pointermove', event => {
    if (isPaused()) return;
    if (event.pointerId === stickPointer) { dragStick(event); return; }
    if (!drag || drag.id !== event.pointerId) return;
    yaw -= (event.clientX - drag.x) * .005; pitch = T.MathUtils.clamp(pitch + (event.clientY - drag.y) * .004, -.08, .9); drag.x = event.clientX; drag.y = event.clientY;
  });
  function releasePointer(event) {
    if (event.pointerId === stickPointer) { stickPointer = null; stickX = stickY = 0; thumb.style.transform = ''; }
    if (event.pointerId === drag?.id) drag = null;
  }
  canvas.addEventListener('pointerup', releasePointer); canvas.addEventListener('pointercancel', releasePointer);
  function update(dt) {
    if (isPaused()) { clearInput(); return; }
    const forward = injected?.forward ?? ((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + stickY);
    const right = injected?.right ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stickX);
    const running = injected?.run ?? (runToggle || keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const length = Math.max(1, Math.hypot(forward, right)), speed = running ? 5 : 2.65;
    const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) / length, dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) / length;
    vertical = controller.computedGrounded() ? -.5 : Math.max(-18, vertical - 24 * dt);
    movement.x = dx * speed * dt; movement.y = vertical * dt; movement.z = dz * speed * dt;
    controller.computeColliderMovement(capsule, movement);
    const corrected = controller.computedMovement(), position = body.translation();
    next.x = position.x + corrected.x; next.y = position.y + corrected.y; next.z = position.z + corrected.z; body.setNextKinematicTranslation(next);
    const walking = Math.hypot(corrected.x, corrected.z) > .001;
    const state = walking ? running ? 'run' : 'walk' : 'idle';
    if (state !== animation) {
      // Keep footfall phase when changing pace; blend from current weights so
      // quick starts and stops never restart a half-finished fade at full weight.
      if (state !== 'idle') {
        actions[state].time = animation === 'idle' ? 0
          : actions[animation].time / actions[animation].getClip().duration * actions[state].getClip().duration;
      }
      animation = state;
    }
    const blend = 1 - Math.exp(-10 * dt);
    for (let i = 0; i < animationActions.length; i++) {
      const action = animationActions[i], weight = animationStates[i] === state ? 1 : 0;
      if (action.getEffectiveWeight() === weight) continue;
      const nextWeight = T.MathUtils.lerp(action.getEffectiveWeight(), weight, blend);
      action.setEffectiveWeight(Math.abs(weight - nextWeight) < .001 ? weight : nextWeight);
    }
    if (walking) {
      const angle = Math.atan2(-dx, -dz), delta = Math.atan2(Math.sin(angle - visual.rotation.y), Math.cos(angle - visual.rotation.y));
      visual.rotation.y += delta * (1 - Math.exp(-14 * dt));
    }
    actions.idle.paused = reducedMotion.matches;
    mixer.update(dt);
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
  return {body, capsule, camera, update, sync, updateCamera, teleport, clearInput,
    setPaused: fn => { isPaused = fn; },
    setInput: input => { injected = input; if (Number.isFinite(input?.yaw)) yaw = input.yaw; if (Number.isFinite(input?.pitch)) pitch = T.MathUtils.clamp(input.pitch, -.08, .9); },
    get state() { const p = body.translation(); return {x: p.x, y: p.y - .875, z: p.z, animation, yaw, pitch}; }
  };
}
