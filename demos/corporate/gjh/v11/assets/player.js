import {createCharacter} from './character.js';

export async function createPlayer(T, R, physics, scene, canvas, contactMaterial, contactPlane, seats = []) {
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
  let seated = false, pushing=false;
  // A conservative full-turn footprint encloses avatar and cart. No sweeping corners.
  const walkingShape=new R.Capsule(.55,.3), cartShape=new R.Cylinder(.85,1.4);
  let seat=null, seatPhase='idle', seatTime=0, seatFrom=null, seatStartAngle=0, seatStartWeight=0;
  const reduceSeatMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let yaw = 0, pitch = .1, drag = null, stickPointer = null, stickOrigin = null;
  let actionView=null,cameraDistance=null;
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
    if(actionView)actionView.settled=true;
    yaw -= (event.clientX - drag.x) * .005; pitch = T.MathUtils.clamp(pitch + (event.clientY - drag.y) * .004, -.08, .9); drag.x = event.clientX; drag.y = event.clientY;
  });
  function releasePointer(event) {
    if (event.pointerId === stickPointer) resetStick();
    if (event.pointerId === drag?.id) drag = null;
  }
  // Capture can be revoked without pointerup/cancel (for example by another UI).
  // Clear only the affected pointer so an independent touch remains usable.
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, releasePointer);
  function beginActionView(kind,targetYaw){
    const previous=actionView?.previous||{yaw,pitch};actionView={kind,previous,fromYaw:yaw,fromPitch:pitch,targetYaw,elapsed:0,settled:false};
    if(reduceSeatMotion()){yaw=targetYaw;pitch=.1;actionView.settled=true;}
  }
  function restoreActionView(){if(!actionView)return;yaw=actionView.previous.yaw;pitch=actionView.previous.pitch;actionView=null;}
  function updateActionView(dt){if(!actionView||actionView.settled)return;if(keys.has('KeyQ')||keys.has('KeyE')){actionView.settled=true;return;}actionView.elapsed+=dt;const t=Math.min(1,actionView.elapsed/.35),e=t*t*(3-2*t),v=actionView;const delta=Math.atan2(Math.sin(v.targetYaw-v.fromYaw),Math.cos(v.targetYaw-v.fromYaw));yaw=v.fromYaw+delta*e;pitch=v.fromPitch+(.1-v.fromPitch)*e;if(t===1)v.settled=true;}
  function startCollection(prop,id){if(seated||!character.startCollection(prop,id))return false;beginActionView('collection',visual.rotation.y+Math.PI+.55);return true;}
  function cancelCollection(){character.cancelCollection();if(actionView?.kind==='collection')restoreActionView();}
  function update(dt) {
    if (isPaused()) { clearInput(); return; }
    updateActionView(dt);
    if(seated){updateSeat(dt);yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*(110*Math.PI/180)*dt;character.update('idle',dt);return;}
    const forward = injected?.forward ?? ((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + stickY);
    const right = injected?.right ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stickX);
    if(actionView?.kind==='collection'&&Math.hypot(forward,right)>.1)cancelCollection();
    const running = !pushing && (injected?.run ?? (runToggle || keys.has('ShiftLeft') || keys.has('ShiftRight')));
    const turning = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
    yaw += turning * (110 * Math.PI / 180) * dt;
    const length = Math.max(1, Math.hypot(forward, right)), speed = pushing ? 1.8 : running ? 5 : 2.65;
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
    if(actionView?.kind==='collection'&&!character.state.collection.active)restoreActionView();
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
    const normalDistance=canvas.clientWidth<600?5.5:6.5,requestedDistance=actionView?3:normalDistance;
    cameraDistance=instant||reduceSeatMotion()?requestedDistance:T.MathUtils.lerp(cameraDistance??normalDistance,requestedDistance,1-Math.exp(-6*dt));
    const distance=cameraDistance;
    offset.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance);
    desired.copy(target).add(offset); constrain(desired);
    if (instant) camera.position.copy(desired); else camera.position.lerp(desired, 1 - Math.exp(-12 * dt));
    safe.copy(camera.position); constrain(safe); camera.position.copy(safe); camera.lookAt(target);
  }
  function setCart(value) {
    if(!value){pushing=false;character.setCart(false);capsule.setShape(walkingShape);controller.enableAutostep(.2,.28,true);clearInput();injected=null;return true;}
    if(pushing)return true;
    if(seated||!character.state.cart.available)return false;
    const p=body.translation();
    if(physics.intersectionWithShape(p,{x:0,y:0,z:0,w:1},cartShape,undefined,undefined,capsule,body))return false;
    pushing=true;capsule.setShape(cartShape);controller.disableAutostep();character.setCart(true);clearInput();injected=null;character.update('idle',0);physics.step();return true;
  }
  const rotation={x:0,y:0,z:0,w:1};
  function clearAt(position,ignoreBench=false){return !physics.intersectionWithShape(position,rotation,walkingShape,undefined,undefined,capsule,body,ignoreBench?c=>c.handle!==seat.collider:undefined);}
  function clearPath(from,to,ignoreBench=false){const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/.08));for(let i=0;i<=steps;i++){const t=i/steps;if(!clearAt({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t},ignoreBench))return false;}return true;}
  function moveSeat(position){body.setTranslation(position,true);body.setNextKinematicTranslation(position);}
  function finishStand(){moveSeat({x:seat.exitX,y:.91,z:seat.exitZ});seated=false;seatPhase='idle';seat=null;restoreActionView();character.setSeated(false);capsule.setEnabled(true);clearInput();injected=null;vertical=0;}
  function updateSeat(dt){
    if(seatPhase==='seated')return;
    seatTime+=dt;const duration=seatPhase==='align'?.35:.85,t=Math.min(1,seatTime/duration),e=t*t*(3-2*t);
    const end=seatPhase==='sit'?{x:seat.x,y:seat.y+.875,z:seat.z}:{x:seat.exitX,y:.91,z:seat.exitZ};
    moveSeat({x:seatFrom.x+(end.x-seatFrom.x)*e,y:seatFrom.y+(end.y-seatFrom.y)*e,z:seatFrom.z+(end.z-seatFrom.z)*e});
    const delta=Math.atan2(Math.sin(seat.angle-seatStartAngle),Math.cos(seat.angle-seatStartAngle));visual.rotation.y=seatStartAngle+delta*e;
    character.setSeatProgress(seatPhase==='sit'?e:seatPhase==='stand'?seatStartWeight*(1-e):0);
    if(t===1){if(seatPhase==='align'){seatPhase='sit';seatTime=0;seatFrom={...body.translation()};seatStartAngle=seat.angle;}else if(seatPhase==='sit'){seatPhase='seated';character.setSeated(true);}else finishStand();}
  }
  function sit(id) {
    if(seated||pushing)return false;const candidate=seats.find(s=>s.id===id),p=body.translation();if(!candidate)return false;
    if(Math.hypot(p.x-candidate.exitX,p.z-candidate.exitZ)>1.1||(p.z-candidate.z)*candidate.facing>-.25)return false;
    seat=candidate;const exit={x:seat.exitX,y:.91,z:seat.exitZ},target={x:seat.x,y:seat.y+.875,z:seat.z};
    if(!clearPath(p,exit)||!clearPath(exit,target,true)){seat=null;return false;}
    clearInput();injected=null;cancelCollection();seated=true;capsule.setEnabled(false);seatStartAngle=visual.rotation.y;seatTime=0;seatFrom={...p};seatPhase='align';seatStartWeight=0;beginActionView('seat',seat.angle+Math.PI+seat.cameraOffset);vertical=0;
    if(reduceSeatMotion()){moveSeat(target);visual.rotation.y=seat.angle;seatPhase='seated';character.setSeated(true);}
    character.update('idle',0);physics.step();updateCamera(0,reduceSeatMotion());return true;
  }
  function stand(instant=false) {
    if(!seated)return false;if(seatPhase==='stand'&&!instant)return true;
    const position={x:seat.exitX,y:.91,z:seat.exitZ};
    if(!clearAt(position)||!clearPath(body.translation(),position,true))return false;
    clearInput();injected=null;seatFrom={...body.translation()};seatStartAngle=visual.rotation.y;seatStartWeight=character.state.seatWeight;seatTime=0;seatPhase='stand';
    if(instant||reduceSeatMotion())finishStand();
    character.update('idle',0);physics.step();updateCamera(0,instant||reduceSeatMotion());return true;
  }
  function teleport(zone) {
    const destinations = {atrium: [-2, 12], newmoon: [-10, 2.4], mili: [0, 2.4], gogo: [10, 2.4]};
    if (!destinations[zone]) return false;
    setCart(false);restoreActionView();seated=false;seatPhase='idle';seat=null;character.setSeated(false);capsule.setEnabled(true);
    const [x, z] = destinations[zone]; body.setTranslation({x, y: .89, z}, true); body.setNextKinematicTranslation({x, y: .89, z}); vertical = 0; yaw = 0; pitch = .1; visual.rotation.y = 0; clearInput();
    // Update broad-phase query positions before spring-arm obstruction tests.
    physics.step(); updateCamera(0, true); return true;
  }
  return {body, capsule, camera, sit, stand, setCart, update, sync, updateCamera, teleport, clearInput, setBagCount:character.setBagCount, startCollection, cancelCollection,
    setPaused: fn => { isPaused = fn; },
    setInput: input => { injected = input; if (Number.isFinite(input?.yaw)) yaw = input.yaw; if (Number.isFinite(input?.pitch)) pitch = T.MathUtils.clamp(input.pitch, -.08, .9); },
    get state() { const p = body.translation(); return {x: p.x, y: p.y - .875, z: p.z, seated, cameraFocus:actionView?.kind||null,cameraDistance, seatPhase, seatId:seat?.id||null, seatName:seat?.name||null, pushing, animation: character.animation, yaw, facing: visual.rotation.y, pitch, character: character.state}; }
  };
}
