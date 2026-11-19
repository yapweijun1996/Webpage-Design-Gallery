import {rideTime,sampleRide} from './elevator-ride.js';
import {createCharacter} from './character.js';
import {spatial, courtyardArrival} from './spatial.js';
import {liftLayout} from './lift-layout.js';
import {expandedLayout, expandedStoreArrival} from './expanded-layout.js';
import {isShelfInReach} from './visitor-v2-contact.js';
import {
  chaseDistance, clampCameraPitch, createCameraController, DEFAULT_PITCH, easeCameraValue, firstPersonFov,
  limitCameraByFloor, neutralFramingWeight, positionTramChase, sweepCameraClearance
} from './camera-controller.js';
import {advanceVelocity, interpolate, interpolateAngle, MOVEMENT, stickStrength} from './movement.js';
import {createPlayerTram, tramBoardReason} from './tram-ride.js';
import {seatEyeHeight} from './tram-layout.js';
import {isInFrontOfSeat} from './seat-placements.js';

const CAMERA_LIFTS = [1.1, 2.2];
const ZOOM_STEP = .2;
const CHASE_NEAR = .08;
const EYE_HEIGHT = 1.55;
const EYE_CLEARANCE = .16;

export function playerCameraFraming(model, expanded, width, height) {
  const tripo = model === 'gjh-tripo-visitor', mobile = width < 600;
  let fov = mobile ? 68 : tripo ? 64 : 58;
  if (expanded && mobile && width < height) {
    const portraitFov = 2 * Math.atan(Math.tan(Math.PI / 6) * height / width) * 180 / Math.PI;
    fov = Math.min(100, Math.max(fov, portraitFov));
  }
  return {
    fov,
    distance: expanded ? (mobile ? 5 : 5.2) : (mobile ? 5.5 : 6.5),
    height: tripo ? 1.65 : 0,
    lookAhead: tripo ? 1.7 : 0
  };
}

export async function createPlayer(T, R, physics, scene, canvas, contactMaterial, contactPlane, seats = [], cameraObstacles = [], expanded = false, prepareModel, portrait) {
  const character = await createCharacter(T, prepareModel, portrait);
  const model = character.state.model;
  const visual = character.visual;
  scene.add(visual);
  const contact = new T.Mesh(contactPlane, contactMaterial);
  contact.rotation.x = -Math.PI / 2; contact.scale.set(1.55, 1.12, 1); scene.add(contact);
  const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-2, .89, 12));
  const capsule = physics.createCollider(R.ColliderDesc.capsule(.55, .3).setFriction(0), body);
  const controller = physics.createCharacterController(.025);
  controller.enableAutostep(MOVEMENT.stepHeight, .28, true); controller.enableSnapToGround(.25);
  controller.setMaxSlopeClimbAngle(Math.PI / 4); controller.setMinSlopeSlideAngle(Math.PI / 3);
  const keys = new Set(); let vertical = 0, runToggle = false, stickX = 0, stickY = 0, injected = null;
  let seated = false, pushing=false, elevatorTravel=null;
  // Keep the push proxy narrow enough to clear a 2.48 m opening.
  const walkingShape=new R.Capsule(.55,.3), cartShape=new R.Cylinder(.85,MOVEMENT.cartRadius);
  let seat=null, seatPhase='idle', seatTime=0, seatFrom=null, seatExit=null, seatStartAngle=0, seatStartWeight=0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduceSeatMotion=()=>reducedMotion.matches;
  let yaw = 0, facing = 0, previousYaw = 0, previousFacing = 0, previousPosition = null;
  let drag = null, stick = null, stickOrigin = null, pinch = null, pinchTimer = 0;
  let actionView=null,cameraDistance=null,cameraOccluded=false,productApproach=null,productHome=null;
  const walkingView = createCameraController();
  let view = walkingView, beforeTram = null, tramCameraDistance = null;
  const camera = new T.PerspectiveCamera(58, 1, CHASE_NEAR, 100);
  let renderedMode = 'third-person', eyeFov = firstPersonFov(0), eyeFovInitialized = false;
  let renderedPitch = DEFAULT_PITCH;
  const target = new T.Vector3(), desired = new T.Vector3(), offset = new T.Vector3(), direction = new T.Vector3(), safe = new T.Vector3();
  const sightline = new T.Vector3();
  let lodViewportHeight = canvas.clientHeight;
  let framing = playerCameraFraming(model, expanded, canvas.clientWidth, canvas.clientHeight);
  const cameraBall=new R.Ball(.22),cameraRotation={x:0,y:0,z:0,w:1};
  const anchor=new T.Vector3(),candidateAnchor=new T.Vector3(),probe=new T.Vector3();
  let cameraLift=0,cameraClearance=0,cameraRadius=.22;
  const movement = {x: 0, y: 0, z: 0}, next = {x: 0, y: 0, z: 0};
  const velocity = {x: 0, z: 0};
  let collisionMs = 0, cameraQueryMs = 0, collisions = 0;
  const joystick = document.querySelector('#joystick'), thumb = joystick.querySelector('.joystick-thumb'), runButton = document.querySelector('#run-toggle');
  const cameraControls = document.querySelector('#camera-controls');
  const zoomIn = document.querySelector('#camera-zoom-in'), zoomOut = document.querySelector('#camera-zoom-out');
  const viewToggle = document.querySelector('#camera-view-toggle');
  let isPaused = () => false;
  const chaseRequired = () => Boolean(actionView || (seated && !beforeTram) || pushing || elevatorTravel);
  const cameraMode = () => view.mode(chaseRequired());
  const currentPitch = () => actionView?.pitch ?? view.pitch(chaseRequired());
  function setPitch(value) {
    if (actionView) actionView.pitch = clampCameraPitch(value, 'third-person');
    else view.setPitch(value, chaseRequired());
  }
  function toggleView() {
    if (isPaused() || !view.toggle(chaseRequired())) return;
    updateCamera(0);
  }
  function adjustZoom(delta) {
    if (isPaused() || (beforeTram && !view.firstPerson) || !view.adjust(delta, chaseRequired())) return;
    if (reducedMotion.matches) updateCamera(0, true);
  }
  zoomIn.addEventListener('click', () => adjustZoom(ZOOM_STEP));
  zoomOut.addEventListener('click', () => adjustZoom(-ZOOM_STEP));
  viewToggle.addEventListener('click', toggleView);
  cameraControls.addEventListener('click', event => {
    // Pointer users can walk or use the right stick immediately after changing view.
    if (event.detail > 0 && event.target.closest('button')) canvas.focus({preventScroll: true});
  });
  canvas.addEventListener('wheel', event => {
    if (isPaused() || chaseRequired() || event.metaKey) return;
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    if (!event.deltaY) return;
    event.preventDefault();
    // Chromium delivers trackpad pinches as wheel events with ctrlKey set.
    adjustZoom(T.MathUtils.clamp(-event.deltaY * multiplier * (event.ctrlKey ? .01 : .0025), -.5, .5));
  }, {passive: false});
  let trackpadScale = 0;
  // WebKit exposes trackpad pinch as a gesture. Touch pointers own screen pinches.
  canvas.addEventListener('gesturestart', event => {
    if (isPaused() || chaseRequired() || stick || drag?.touch || pinch) return;
    event.preventDefault();
    trackpadScale = 1;
  }, {passive: false});
  canvas.addEventListener('gesturechange', event => {
    if (!trackpadScale || isPaused() || chaseRequired() || !Number.isFinite(event.scale) || event.scale <= 0) return;
    event.preventDefault();
    adjustZoom(Math.log(event.scale / trackpadScale));
    trackpadScale = event.scale;
  }, {passive: false});
  canvas.addEventListener('gestureend', () => { trackpadScale = 0; });
  const resetStick = () => { stickX = stickY = 0; stick = null; stickOrigin = null; thumb.style.transform = ''; joystick.classList.remove('is-floating'); };
  function takePinch() {
    clearTimeout(pinchTimer); pinchTimer = 0;
    const previous = pinch; pinch = null;
    return previous;
  }
  function releaseCapture(id) {
    if (id != null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  const clearInput = () => {
    const pair = takePinch(), dragId = drag?.id, stickId = stick?.id;
    keys.clear(); velocity.x = velocity.z = 0; drag = null; trackpadScale = 0;
    if (stick) resetStick();
    releaseCapture(dragId); releaseCapture(stickId);
    releaseCapture(pair?.first.id); releaseCapture(pair?.second.id);
  };
  window.addEventListener('blur', clearInput);
  window.addEventListener('resize', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  document.addEventListener('focusin', event => {
    if (event.target !== canvas && event.target !== document.body) clearInput();
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) { clearInput(); return; }
    if (isPaused() || event.defaultPrevented) return;
    const sceneFocused = event.target === canvas || event.target === document.body;
    if (sceneFocused || cameraControls.contains(event.target) ||
        (beforeTram && event.target.closest?.('#tram-ride-hud'))) {
      if (event.code === 'KeyV') {
        event.preventDefault();
        if (!event.repeat) toggleView();
        return;
      }
      const zoomInKey = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
      if (zoomInKey || event.key === '-' || event.code === 'NumpadSubtract') {
        event.preventDefault();
        adjustZoom(zoomInKey ? ZOOM_STEP : -ZOOM_STEP);
        return;
      }
    }
    if (!sceneFocused) return;
    if (cameraMode() === 'third-person' && (event.code === 'PageUp' || event.code === 'PageDown')) {
      event.preventDefault();
      if (actionView) actionView.settled = true;
      setPitch(currentPitch() + (event.code === 'PageUp' ? -.12 : .12));
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      // Space and tab retain their native page and focus semantics.
      if (event.target === canvas || event.target === document.body) event.preventDefault();
      keys.add(event.code);
    }
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  const fullScreenControl = document.querySelector('#fullscreen-joystick');
  const stickPreferenceKey = 'gjh.v11.fullscreenJoystick';
  try { fullScreenControl.checked = localStorage.getItem(stickPreferenceKey) === 'true'; } catch {}
  fullScreenControl.addEventListener('change', () => {
    clearInput();
    try { localStorage.setItem(stickPreferenceKey, String(fullScreenControl.checked)); } catch {}
  });
  runButton.setAttribute('aria-pressed', String(runToggle));
  runButton.addEventListener('click', () => {
    runToggle = !runToggle;
    runButton.setAttribute('aria-pressed', String(runToggle));
  });
  function dragStick() {
    if (!stickOrigin) return;
    const dx = stick.x - stickOrigin.x, dy = stick.y - stickOrigin.y;
    const distance = Math.hypot(dx, dy), strength = stickStrength(distance, stick.pad.width / 2);
    if (strength) stick.pinchEligible = false;
    stickX = distance ? dx / distance * strength : 0; stickY = distance ? -dy / distance * strength : 0;
    thumb.style.transform = `translate(${stickX * 18}px, ${-stickY * 18}px)`;
  }
  function look(dx, dy) {
    if (!dx && !dy) return;
    if(actionView)actionView.settled=true;
    yaw -= dx * .005; previousYaw -= dx * .005;
    if (dy) setPitch(currentPitch() + dy * (cameraMode() === 'first-person' ? .004 : .006));
  }
  function beginPinch(first, second, pending) {
    const dx = second.x - first.x, dy = second.y - first.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    pinch = {first, second, distance, pending, axisX: dx / distance, axisY: dy / distance,
      firstX: first.x, firstY: first.y, secondX: second.x, secondY: second.y};
    if (!pending) drag = null;
  }
  function retainStickAndLook() {
    const pair = takePinch();
    stick.pinchEligible = false;
    dragStick();
    look(drag.x - pair.secondX, drag.y - pair.secondY);
  }
  function movePinch(point, event) {
    point.x = event.clientX; point.y = event.clientY;
    if (pinch.pending) {
      // Full-screen movement keeps its two-finger roles unless both touches
      // move in opposing directions along the line joining them.
      const {first, second, firstX, firstY, secondX, secondY, axisX, axisY} = pinch;
      const firstDx = first.x - firstX, firstDy = first.y - firstY;
      const secondDx = second.x - secondX, secondDy = second.y - secondY;
      const a = firstDx * axisX + firstDy * axisY, b = secondDx * axisX + secondDy * axisY;
      if (Math.abs(a) >= 6 && Math.abs(b) >= 6 && a * b < 0) {
        clearTimeout(pinchTimer); pinchTimer = 0;
        pinch.pending = false; resetStick(); drag = null;
      } else {
        if ((Math.abs(a) >= 6 && Math.abs(b) >= 6) ||
            Math.abs(firstDx * axisY - firstDy * axisX) >= 12 ||
            Math.abs(secondDx * axisY - secondDy * axisX) >= 12) retainStickAndLook();
        else if (!pinchTimer) pinchTimer = setTimeout(retainStickAndLook, 90);
        return;
      }
    }
    const distance = Math.max(1, Math.hypot(pinch.first.x - pinch.second.x, pinch.first.y - pinch.second.y));
    adjustZoom(Math.log(distance / pinch.distance));
    pinch.distance = distance;
  }
  canvas.addEventListener('pointerdown', event => {
    if (isPaused() || event.button !== 0) return;
    if (event.pointerType === 'touch') {
      trackpadScale = 0;
      if (pinch) return;
      const box = stick?.pad ?? joystick.getBoundingClientRect();
      const onPad = box.width > 0 && event.clientX >= box.left && event.clientX <= box.right &&
        event.clientY >= box.top && event.clientY <= box.bottom;
      const point = {id:event.pointerId, x:event.clientX, y:event.clientY, touch:true, pinchEligible:!onPad};
      if (!stick && (onPad || fullScreenControl.checked)) {
        stick = point; stick.pad = box;
        if (fullScreenControl.checked) {
          stickOrigin = {x:event.clientX, y:event.clientY};
          const bounds = canvas.getBoundingClientRect();
          joystick.style.setProperty('--stick-left', `${event.clientX - bounds.left - box.width / 2}px`);
          joystick.style.setProperty('--stick-top', `${event.clientY - bounds.top - box.height / 2}px`);
          joystick.classList.add('is-floating');
        } else {
          stickOrigin = {x:box.left + box.width / 2, y:box.top + box.height / 2};
        }
        dragStick();
      } else if (!drag) {
        drag = point;
        if (stick?.pinchEligible && fullScreenControl.checked && !onPad && !chaseRequired()) beginPinch(stick, drag, true);
      } else if (!stick && drag.touch && !onPad && !chaseRequired()) {
        beginPinch(drag, point, false);
      } else return;
      canvas.focus({preventScroll: true});
    } else {
      if (drag) return;
      canvas.focus({preventScroll: true}); drag = {id:event.pointerId, x:event.clientX, y:event.clientY};
    }
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (isPaused()) return;
    if (pinch?.first.id === event.pointerId) { movePinch(pinch.first, event); return; }
    if (pinch?.second.id === event.pointerId) { movePinch(pinch.second, event); return; }
    if (stick?.id === event.pointerId) { stick.x = event.clientX; stick.y = event.clientY; dragStick(); return; }
    if (!drag || drag.id !== event.pointerId) return;
    look(event.clientX - drag.x, event.clientY - drag.y); drag.x = event.clientX; drag.y = event.clientY;
  });
  function releasePointer(event) {
    if (pinch && (pinch.first.id === event.pointerId || pinch.second.id === event.pointerId)) {
      if (pinch.pending) {
        if (event.type === 'pointerup') retainStickAndLook(); else takePinch();
      }
      else {
        const {first, second} = takePinch();
        drag = event.pointerId === first.id ? second : first;
      }
    }
    if (event.pointerId === stick?.id) resetStick();
    if (event.pointerId === drag?.id) drag = null;
  }
  // Capture can be revoked without pointerup/cancel (for example by another UI).
  // Clear only the affected pointer so an independent touch remains usable.
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, releasePointer);
  function beginActionView(kind,targetYaw){
    const previousYaw = actionView?.previousYaw ?? yaw;
    const fromPitch = clampCameraPitch(currentPitch(), 'third-person');
    actionView = {kind, previousYaw, fromYaw:yaw, fromPitch, pitch:fromPitch, targetYaw, elapsed:0, settled:false};
    if(reduceSeatMotion()){yaw=targetYaw;actionView.pitch=DEFAULT_PITCH;actionView.settled=true;}
  }
  function restoreActionView(){if(!actionView)return;yaw=actionView.previousYaw;actionView=null;}
  function updateActionView(dt){if(!actionView||actionView.settled)return;if(keys.has('KeyQ')||keys.has('KeyE')){actionView.settled=true;return;}actionView.elapsed+=dt;const t=Math.min(1,actionView.elapsed/.35),e=t*t*(3-2*t),v=actionView;const delta=Math.atan2(Math.sin(v.targetYaw-v.fromYaw),Math.cos(v.targetYaw-v.fromYaw));yaw=v.fromYaw+delta*e;v.pitch=v.fromPitch+(DEFAULT_PITCH-v.fromPitch)*e;if(t===1)v.settled=true;}
  function startCollection(prop,id){if(seated||!character.startCollection(prop,id))return false;beginActionView('collection',facing+Math.PI+.55);return true;}
  function cancelCollection(){productApproach=null;character.cancelCollection();if(['collection','product'].includes(actionView?.kind))restoreActionView();}
  let gamepad = null;
  function update(dt) {
    previousPosition = body.translation();
    previousFacing = facing; previousYaw = yaw;
    sync();
    if (isPaused()) { clearInput(); return; }
    const wasRidingTram = Boolean(beforeTram);
    const tramPose = tram?.update(dt);
    if (tramPose) {
      const heading = tramPose.heading + Math.PI;
      yaw += interpolateAngle(facing, heading, 1) - facing;
      facing = heading;
      body.setNextKinematicTranslation({x:tramPose.x, y:seat.floor + .89, z:tramPose.z});
      character.update('idle', dt, 'idle', 1, seat);
      return;
    }
    if (wasRidingTram) return; // The station exit already placed the body this tick.
    if (elevatorTravel) {
      const trip = elevatorTravel;
      const before=trip.phase;
      const skip = reduceSeatMotion() || trip.skip;
      trip.elapsed=skip ? rideTime.exit : Math.min(rideTime.exit,trip.elapsed+dt);
      sampleRide(trip.elapsed,trip);
      if (before!==trip.phase) trip.elevator.setRiding?.(trip.phase==='ride');
      trip.elevator.pose(trip);
      moveSeat(trip.position);
      const stepping=trip.elapsed>rideTime.open && trip.elapsed<rideTime.board || trip.elapsed>rideTime.reopen;
      const gait = stepping ? 'walk' : 'idle';
      const rate = stepping ? approachRate(trip.position, dt) : 1;
      if (skip) resetInterpolation();
      sync(); character.update(gait,dt,gait,rate);
      if(!trip.chimed && trip.elapsed>=rideTime.arrive){trip.chimed=true;trip.chime?.();}
      if(trip.elapsed>=rideTime.exit){
        trip.elevator.finishRide();elevatorTravel=null;capsule.setEnabled(true);vertical=0;
        restoreActionView();clearInput();injected=null;
      }
      return;
    }
    updateActionView(dt);
    if(gamepad){yaw-=gamepad.lookX*1.9*dt;if(gamepad.lookY)setPitch(currentPitch()+gamepad.lookY*1.4*dt);}
    if(seated){updateSeat(dt);yaw+=((keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0))*MOVEMENT.turnRate*dt;updateSeatCharacter(dt);return;}
    if(productApproach){
      const a=productApproach,t=Math.min(1,(a.elapsed+=dt)/.45),e=t*t*(3-2*t);
      moveSeat({x:a.from.x+(a.to.x-a.from.x)*e,y:.91,z:a.from.z+(a.to.z-a.from.z)*e});
      facing=0;sync();character.update('walk',dt,'walk',approachRate(body.translation(),dt));
      if(t===1){productApproach=null;if(a.returning)character.returnProduct();}
      return;
    }
    // A transfer owns the hands and position until the item reaches its destination.
    if(character.productPhase === 'pickup' || character.productPhase === 'return'){
      character.update('idle',dt);
      if (view.firstPerson && actionView?.kind === 'product' &&
          (character.productPhase === 'held' || character.productPhase === 'empty')) restoreActionView();
      return;
    }
    const forward = injected?.forward ?? ((keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + stickY + (gamepad?.forward||0));
    const right = injected?.right ?? ((keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stickX + (gamepad?.right||0));
    if(actionView?.kind==='product'){
      if(view.firstPerson||Math.hypot(forward,right)>.1||character.productPhase==='empty')restoreActionView();
    }
    if(actionView?.kind==='collection'&&Math.hypot(forward,right)>.1)cancelCollection();
    if(actionView?.kind==='elevator'&&Math.hypot(forward,right)>.1)restoreActionView();
    const running = !pushing && (injected?.run ?? ((stick !== null && runToggle) || keys.has('ShiftLeft') || keys.has('ShiftRight')));
    const turning = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
    yaw += turning * MOVEMENT.turnRate * dt;
    const speed = pushing ? MOVEMENT.cart
      : stick ? (running ? MOVEMENT.touchRun : MOVEMENT.touchWalk)
      : (running ? MOVEMENT.desktopRun : MOVEMENT.desktopWalk);
    advanceVelocity(velocity, forward, right, yaw, speed, dt);
    vertical = controller.computedGrounded() ? -.5 : Math.max(-18, vertical - 24 * dt);
    movement.x = velocity.x * dt; movement.y = vertical * dt; movement.z = velocity.z * dt;
    const queryStart = performance.now();
    controller.computeColliderMovement(capsule, movement);
    const corrected = controller.computedMovement();
    collisionMs += performance.now() - queryStart;
    // Ground contact contributes to Rapier's collision count on every walk tick.
    // Count only ticks where geometry materially changes the horizontal movement.
    if (Math.hypot(corrected.x - movement.x, corrected.z - movement.z) > .002) collisions++;
    const position = body.translation();
    next.x = position.x + corrected.x; next.y = position.y + corrected.y; next.z = position.z + corrected.z;
    body.setNextKinematicTranslation(next);
    const distance = Math.hypot(corrected.x, corrected.z);
    const walking = distance > .001;
    const state = walking ? running ? 'run' : 'walk' : 'idle';
    const requested = Math.hypot(forward, right) > .001 ? running ? 'run' : 'walk' : 'idle';
    const referenceSpeed = pushing ? MOVEMENT.cart : running ? MOVEMENT.runClipSpeed : MOVEMENT.walkClipSpeed;
    const playbackRate = dt > 0 ? distance / dt / referenceSpeed : 1;
    if (cameraMode() === 'first-person') facing = yaw;
    else if (walking || turning) {
      const angle = walking ? Math.atan2(-corrected.x, -corrected.z) : yaw;
      facing = interpolateAngle(facing, angle, 1 - Math.exp(-14 * dt));
    }
    visual.rotation.y = facing;
    character.update(state, dt, requested, playbackRate);
    if(actionView?.kind==='collection'&&!character.state.collection.active)restoreActionView();
  }
  function approachRate(position, dt) {
    if (!dt) return 1;
    return Math.hypot(position.x-previousPosition.x, position.z-previousPosition.z) / dt / MOVEMENT.walkClipSpeed;
  }
  function sync(alpha = 1) {
    tramCameraDistance = tram?.sync(alpha);
    const p = body.translation();
    const from = previousPosition ?? p;
    const x = interpolate(from.x, p.x, alpha), y = interpolate(from.y, p.y, alpha), z = interpolate(from.z, p.z, alpha);
    visual.position.set(x, y - .875, z);
    const angle = alpha === 1 ? facing : interpolateAngle(previousFacing, facing, alpha);
    visual.rotation.y = angle;
    // Clear the visual floor/rug inlays as well as the physical walking slab.
    contact.position.set(x, Math.max(.05, y - .83), z);
    contact.rotation.z = angle;
  }
  function resetInterpolation() {
    previousPosition = null;
    previousYaw = yaw; previousFacing = facing;
  }
  function sweepCamera(origin, point, minimumY) {
    direction.copy(point).sub(origin);
    const distance = direction.length();
    if (distance < 1e-6) return 0;
    direction.multiplyScalar(1 / distance);
    const length = limitCameraByFloor(origin.y, direction.y, distance, minimumY);
    if (!length) return 0;
    const start = performance.now();
    const bounded = sweepCameraClearance(physics, origin, cameraRotation, direction, cameraBall, length, capsule, body, cameraObstacles);
    cameraQueryMs += performance.now() - start;
    return bounded;
  }
  function cameraCandidate(lift, out, minimumY, seatView) {
    candidateAnchor.copy(target); candidateAnchor.y += lift;
    // The seat target can start inside the bench. Use its authored raised pivot.
    if (lift && !seatView) candidateAnchor.y = target.y + sweepCamera(target, candidateAnchor, minimumY);
    out.copy(candidateAnchor).add(offset);
    const length = sweepCamera(candidateAnchor, out, minimumY);
    out.copy(candidateAnchor).addScaledVector(direction, length);
    return length;
  }
  function resizeCamera(width, height) {
    framing = playerCameraFraming(model, expanded, width, height);
    lodViewportHeight = height;
    camera.aspect = width / height;
    projectCamera(renderedMode === 'first-person', true);
  }
  function projectCamera(firstPerson, resized = false) {
    const fov = firstPerson ? eyeFov : framing.fov;
    // Keep even a wide near plane inside the head of the walking capsule.
    const near = firstPerson ? Math.min(CHASE_NEAR, EYE_CLEARANCE / Math.hypot(1, Math.tan(fov * Math.PI / 360) * Math.hypot(1, camera.aspect))) : CHASE_NEAR;
    if (!resized && camera.fov === fov && camera.near === near) return;
    camera.fov = fov; camera.near = near;
    camera.updateProjectionMatrix();
  }
  function presentView(mode, occluded, required) {
    const firstPerson = mode === 'first-person';
    if (cameraOccluded !== occluded || renderedMode !== mode) {
      cameraOccluded = occluded;
      character.setCameraOccluded(occluded, firstPerson);
    }
    contact.visible = !firstPerson;
    const presentation = firstPerson ? mode : occluded ? 'close' : mode;
    if (canvas.dataset.cameraView !== presentation) canvas.dataset.cameraView = presentation;
    if (viewToggle.disabled !== required) viewToggle.disabled = required;
    const zoomDisabled = required || (Boolean(beforeTram) && !firstPerson);
    if (zoomIn.disabled !== zoomDisabled) zoomIn.disabled = zoomOut.disabled = zoomDisabled;
    if (renderedMode !== mode) viewToggle.setAttribute('aria-pressed', String(firstPerson));
    renderedMode = mode;
  }
  function updateCamera(dt, instant = false, alpha = 1) {
    sync(alpha);
    const viewYaw = alpha === 1 ? yaw : interpolateAngle(previousYaw, yaw, alpha);
    const required = chaseRequired(), mode = view.mode(required), firstPerson = mode === 'first-person';
    const zoom = view.zoom(required), immediate = instant || reducedMotion.matches;
    const pitch = currentPitch();
    if (firstPerson) {
      if (character.productPhase === 'held') visual.rotation.y = viewYaw;
      eyeFov = easeCameraValue(eyeFov, firstPersonFov(zoom), dt, immediate || !eyeFovInitialized);
      eyeFovInitialized = true;
      projectCamera(true);
      camera.position.copy(visual.position);
      camera.position.y = beforeTram ? seatEyeHeight : visual.position.y + EYE_HEIGHT;
      const cosPitch = Math.cos(pitch);
      sightline.set(-Math.sin(viewYaw) * cosPitch, -Math.sin(pitch), -Math.cos(viewYaw) * cosPitch).add(camera.position);
      camera.lookAt(sightline);
      cameraLift = cameraClearance = 0; cameraRadius = EYE_CLEARANCE;
      presentView(mode, true, required);
      character.frameCarry?.(camera);
      return;
    }
    projectCamera(false);
    target.copy(visual.position); target.y += 1.24 - .34 * character.seatWeight;
    if (beforeTram && tramCameraDistance != null) {
      positionTramChase(camera, tramCameraDistance, target);
      cameraLift = 0; cameraClearance = camera.position.distanceTo(target);
      presentView(mode, false, required);
      character.updateLOD?.(camera, lodViewportHeight);
      return;
    }
    const seatView = actionView?.kind === 'seat';
    const requestedDistance = actionView && !seatView ? 3 : chaseDistance(framing.distance, zoom);
    // View-mode changes cut directly to a swept position.
    const changedMode = renderedMode !== mode;
    renderedPitch = easeCameraValue(renderedPitch, pitch, dt, immediate || changedMode);
    cameraDistance = easeCameraValue(cameraDistance ?? requestedDistance, requestedDistance, dt, immediate || changedMode);
    // Enclose the near-plane corners, including wide landscape viewports.
    cameraRadius=Math.max(.22,camera.near*Math.tan(camera.fov*Math.PI/360)*Math.hypot(1,camera.aspect)+.08);
    cameraBall.radius=cameraRadius;
    const sinPitch = Math.sin(renderedPitch), cosPitch = Math.cos(renderedPitch);
    offset.set(Math.sin(viewYaw)*cosPitch, sinPitch, Math.cos(viewYaw)*cosPitch).multiplyScalar(cameraDistance);
    // Keep the Tripo entrance framing near neutral and orbit the avatar at both extremes.
    const closeFraming = T.MathUtils.clamp((cameraDistance - 1) / 2, 0, 1);
    const framingWeight = closeFraming * neutralFramingWeight(renderedPitch);
    const orbitHeight = seatView ? Math.max(.9, framing.height * .7) : actionView ? 0 : framing.height * framingWeight;
    // The walking level also bounds the camera where the upper floor has no slab.
    const floor = elevatorTravel?.height ?? (visual.position.y > liftLayout.upper / 2 ? liftLayout.upper : 0);
    const minimumY = floor + cameraRadius + .04;
    let length = cameraCandidate(orbitHeight, desired, minimumY, seatView);
    anchor.copy(candidateAnchor);
    const preferredY = anchor.y;
    const floorLimited = limitCameraByFloor(preferredY, sinPitch, cameraDistance, minimumY);
    // A floor-limited arm is already at the requested low angle. Lift only to clear geometry.
    if (length < Math.min(floorLimited - .05, cameraLift ? 2.4 : 2)) {
      for (const height of CAMERA_LIFTS) {
        const available = cameraCandidate(orbitHeight + height, probe, minimumY, seatView);
        if (available > length + .25) {
          length = available; desired.copy(probe); anchor.copy(candidateAnchor);
        }
        if (length >= 2.4) break;
      }
    }
    cameraLift = anchor.y - preferredY;
    safe.copy(camera.position).lerp(desired,immediate||changedMode?1:1-Math.exp(-12*dt));
    const allowed=sweepCamera(anchor,safe,minimumY);safe.copy(anchor).addScaledVector(direction,allowed);
    // A newly blocked interpolation must contract immediately to a known clear candidate.
    if(allowed<.9&&length>=2)safe.copy(desired);
    const lookAhead=actionView?0:framing.lookAhead * framingWeight;
    sightline.copy(target);
    sightline.x-=Math.sin(viewYaw)*lookAhead;sightline.z-=Math.cos(viewYaw)*lookAhead;
    camera.position.copy(safe);camera.lookAt(sightline);
    cameraClearance=camera.position.distanceTo(target);
    // In a genuinely enclosed corner no third-person view fits. Hide only the local
    // presentation until clearance returns; never change collision or gameplay ownership.
    presentView(mode, cameraClearance < (cameraOccluded && !changedMode ? 1.45 : 1.15), required);
    character.updateLOD?.(camera, lodViewportHeight);
  }
  function cartCapability() {
    if(expanded&&body.translation().y-.875>liftLayout.upper/2)return {allowed:false,disabled:true,sceneDisabled:true,reasonCode:'upper-landing',reason:'The upper landing is visitor-only. Return to the ground floor before using the cart.'};
    if(elevatorTravel)return {allowed:false,disabled:false,sceneDisabled:false,reasonCode:'elevator-travel',reason:'Wait for the elevator to stop.'};
    if(character.state.physicalProduct&&character.state.physicalProduct.phase!=='empty')return {allowed:false,disabled:false,sceneDisabled:false,reasonCode:'held-product',reason:'Return the held product to its shelf or add it to your bag before using the cart.'};
    if(seated)return {allowed:false,disabled:true,sceneDisabled:false,reasonCode:'seated',reason:'Stand up before using the cart.'};
    return {allowed:Boolean(character.state.cart.available),disabled:!character.state.cart.available,sceneDisabled:!character.state.cart.available,reasonCode:character.state.cart.available?null:'unavailable',reason:character.state.cart.available?null:'The 3D cart is unavailable. Your bag selection is unchanged.'};
  }
  function setCart(value) {
    if(value&&!cartCapability().allowed)return false;
    if ((elevatorTravel || character.state.physicalProduct?.phase!=='empty' && character.state.physicalProduct) && value) return false;
    if(!value){pushing=false;character.setCart(false);capsule.setShape(walkingShape);controller.enableAutostep(MOVEMENT.stepHeight,.28,true);clearInput();injected=null;return true;}
    if(pushing)return true;
    if(seated||!character.state.cart.available)return false;
    const p=body.translation();
    if(physics.intersectionWithShape(p,{x:0,y:0,z:0,w:1},cartShape,undefined,undefined,capsule,body))return false;
    pushing=true;capsule.setShape(cartShape);controller.disableAutostep();character.setCart(true);clearInput();injected=null;sync();character.update('idle',0);return true;
  }
  const rotation={x:0,y:0,z:0,w:1};
  function clearAt(position,ignoreBench=false){return !physics.intersectionWithShape(position,rotation,walkingShape,undefined,undefined,capsule,body,ignoreBench?c=>c.handle!==seat.collider:undefined);}
  function clearPath(from,to,ignoreBench=false){const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/.08));for(let i=0;i<=steps;i++){const t=i/steps;if(!clearAt({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t},ignoreBench))return false;}return true;}
  function moveSeat(position){body.setTranslation(position,true);body.setNextKinematicTranslation(position);}
  const seatBodyTarget = seat => ({x:seat.x, y:seat.floor+.89, z:seat.z});
  function updateSeatCharacter(dt) {
    sync();
    character.update('idle', dt, 'idle', 1, seat);
  }
  function finishStand(){moveSeat(seatExit);seated=false;seatPhase='idle';seat=null;seatExit=null;restoreActionView();character.setSeated(false);capsule.setEnabled(true);clearInput();injected=null;vertical=0;}
  function updateSeat(dt){
    if(seatPhase==='seated')return;
    seatTime+=dt;const duration=seatPhase==='align'?.35:.85,t=Math.min(1,seatTime/duration),e=t*t*(3-2*t);
    const end=seatPhase==='sit'?seatBodyTarget(seat):seatExit;
    moveSeat({x:seatFrom.x+(end.x-seatFrom.x)*e,y:seatFrom.y+(end.y-seatFrom.y)*e,z:seatFrom.z+(end.z-seatFrom.z)*e});
    const delta=Math.atan2(Math.sin(seat.angle-seatStartAngle),Math.cos(seat.angle-seatStartAngle));facing=seatStartAngle+delta*e;
    character.setSeatProgress(seatPhase==='sit'?e:seatPhase==='stand'?seatStartWeight*(1-e):0);
    if(t===1){if(seatPhase==='align'){seatPhase='sit';seatTime=0;seatFrom={...body.translation()};seatStartAngle=seat.angle;}else if(seatPhase==='sit'){seatPhase='seated';character.setSeated(true);}else finishStand();}
  }
  function sit(id) {
    if(seated||pushing||elevatorTravel||character.state.physicalProduct&&character.state.physicalProduct.phase!=='empty')return false;const candidate=seats.find(s=>s.id===id),p=body.translation();if(!candidate)return false;
    if(Math.abs(p.y-.875-candidate.floor)>.5||Math.hypot(p.x-candidate.exitX,p.z-candidate.exitZ)>candidate.clearance.interactionRadius||!isInFrontOfSeat(candidate,p))return false;
    seat=candidate;const exit={x:seat.exitX,y:seat.floor+.91,z:seat.exitZ},target=seatBodyTarget(seat);
    if(!clearPath(p,exit)||!clearPath(exit,target,true)){seat=null;return false;}
    seatExit=exit;clearInput();injected=null;cancelCollection();seated=true;capsule.setEnabled(false);seatStartAngle=facing;seatTime=0;seatFrom={...p};seatPhase='align';seatStartWeight=0;beginActionView('seat',seat.angle+Math.PI);vertical=0;
    if(reduceSeatMotion()){moveSeat(target);facing=seat.angle;seatPhase='seated';character.setSeated(true);}
    resetInterpolation();updateSeatCharacter(0);updateCamera(0,reduceSeatMotion());return true;
  }
  function stand(instant=false) {
    if(!seated||beforeTram)return false;if(seatPhase==='stand'&&!instant)return true;
    const from=body.translation();
    const position=[0, -.45, .45].map(offset=>({x:seat.exitX+offset,y:seat.floor+.91,z:seat.exitZ}))
      .find(point=>clearAt(point)&&clearPath(from,point,true));
    if(!position)return false;
    seatExit=position;
    clearInput();injected=null;seatFrom={...body.translation()};seatStartAngle=facing;seatStartWeight=character.state.seatWeight;seatTime=0;seatPhase='stand';
    if(instant||reduceSeatMotion())finishStand();
    resetInterpolation();updateSeatCharacter(0);updateCamera(0,instant||reduceSeatMotion());return true;
  }
  function teleport(zone) {
    if (elevatorTravel || beforeTram) return false;
    const destination = zone === 'atrium' ? (expanded ? expandedLayout.courtyardArrival : courtyardArrival) : expanded && zone === 'entry' ? expandedLayout.entrance : expanded ? expandedStoreArrival(zone) : spatial.arrival(zone);
    if (!destination) return false;
    productApproach=null;
    const carryingProduct=character.state.physicalProduct?.held;
    if(!carryingProduct){productHome=null;character.resetProduct?.();}
    setCart(false);restoreActionView();seated=false;seatPhase='idle';seat=null;seatExit=null;character.setSeated(false);capsule.setEnabled(true);
    const {x, z} = destination; body.setTranslation({x, y: .89, z}, true); body.setNextKinematicTranslation({x, y: .89, z}); vertical = 0; yaw = destination.yaw || 0; facing = yaw; clearInput();
    if(carryingProduct){sync();character.update('idle',0);}
    resetInterpolation(); updateCamera(0, true); return true;
  }
  function useElevator(elevator,chime) {
    const p=body.translation();
    const from=p.y-.875>elevator.upper/2?elevator.upper:0;
    if(seated||pushing||elevatorTravel||character.state.physicalProduct&&character.state.physicalProduct.phase!=='empty'||Math.abs(p.y-.875-from)>.35)return false;
    if(elevator.expanded){
      if(productApproach||Math.hypot(p.x-elevator.exit.x,p.z-elevator.exit.z)>elevator.radius)return false;
      if(elevator.state.calling||elevator.state.riding)return false;
      if(elevator.state.docked!==from)return elevator.call(from);
      if(!clearPath(p,{x:elevator.x,y:from+.89,z:elevator.z}))return false;
    } else if(Math.hypot(p.x-elevator.x,p.z-elevator.z)>1.45)return false;
    clearInput();injected=null;cancelCollection();vertical=0;capsule.setEnabled(false);
    beginActionView('elevator',Math.PI/2);elevator.setRiding?.('boarding');
    elevatorTravel={elevator,x:elevator.x,z:elevator.z,startX:p.x,startZ:p.z,
      exitX:elevator.exit?.x??elevator.x,exitZ:elevator.exit?.z??elevator.z,
      from,to:from?0:elevator.upper,elapsed:0,phase:'board',height:from,position:{x:p.x,y:p.y,z:p.z},
      groundDoor:0,upperDoor:0,skip:false,chimed:false,chime,setHeight:elevator.setHeight};
    return true;
  }
  function skipRide(){if(elevatorTravel)elevatorTravel.skip=true;}
  function interruptGraphics() {
    if (!elevatorTravel) return;
    const trip = elevatorTravel;
    // Graphics fallback must not retain a disabled capsule or resume an old trip.
    const height = body.translation().y - .89;
    const floor = Math.abs(height - trip.from) <= Math.abs(height - trip.to) ? trip.from : trip.to;
    if(trip.elevator?.expanded)trip.elevator.setRiding(false);
    elevatorTravel = null; trip.setHeight(floor);
    moveSeat({x:trip.elevator?.exit.x??trip.x, y:floor + .89, z:trip.elevator?.exit.z??trip.z});
    capsule.setEnabled(true); vertical = 0; clearInput(); injected = null;
    restoreActionView(); resetInterpolation(); updateCamera(0, true);
  }
  const tram = createPlayerTram({
    expanded, search:globalThis.location?.search, T, scene,
    getPosition: () => body.translation(),
    getBoardReason: () => tramBoardReason({pushing, seated, elevatorTravel, productApproaching:productApproach,
      character:character.state}),
    clearPath,
    enterSeat(rideSeat, pose) {
      clearInput(); injected = null; cancelCollection(); vertical = 0;
      beforeTram = {yaw, facing, cameraDistance, eyeFov, eyeFovInitialized};
      view = createCameraController(() => null);
      if (walkingView.firstPerson) view.toggle();
      seat = rideSeat; seated = true; seatPhase = 'seated';
      capsule.setEnabled(false);
      moveSeat(seatBodyTarget(seat));
      yaw = facing = pose.heading + Math.PI;
      character.setSeated(true);
      resetInterpolation();
    },
    exitSeat(position) {
      seatExit = position;
      finishStand();
      ({yaw, facing, cameraDistance, eyeFov, eyeFovInitialized} = beforeTram);
      beforeTram = null;
      view = walkingView;
      resetInterpolation();
      character.update('idle', 0);
    }
  });
  return {body, capsule, camera, get visual() { return visual; }, get npcSource() { return character.npcSource; }, sit, stand, setCart, cartCapability, interruptGraphics, update, sync, resetInterpolation, updateCamera, resizeCamera, teleport, useElevator, skipRide, clearInput, setBagCount:character.setBagCount, startCollection, cancelCollection,
    emote: (name, options) => !seated && !elevatorTravel && !productApproach && (character.emote?.(name, options) ?? false),
    dispose() { tram?.dispose(); character.dispose?.(); },
    renderShelf(draw) {
      // The visitor can stand directly in front of the selected shelf. Exclude
      // only that presentation during the draw; retain all authored/gameplay state.
      const visible = visual.visible, contactVisible = contact.visible;
      visual.visible = contact.visible = false;
      try { draw(); } finally { visual.visible = visible; contact.visible = contactVisible; }
    },
    pickProduct: token=>{
      const from=body.translation(),home=token?.approach;
      if(!home||Math.hypot(from.x-home.x,from.z-home.z)>home.radius||!clearPath(from,{x:home.x,y:.91,z:home.z}))return false;
      const reduced=reduceSeatMotion(),ok=character.pickProduct({...token,approachDelay:reduced?0:.45});
      if(ok){productHome=home;if(reduced){moveSeat({x:home.x,y:.91,z:home.z});facing=0;resetInterpolation();sync();character.update('idle',0);}else productApproach={from:{...from},to:home,elapsed:0};clearInput();injected=null;beginActionView('product',-Math.PI/2+.5);}return ok;
    },
    returnProduct: ()=>{
      const from=body.translation();
      if(!productHome||!character.state.physicalProduct?.held||productApproach||
        !isShelfInReach({x:from.x,y:from.y-.875,z:from.z},productHome)||
        !clearPath(from,{x:productHome.x,y:.91,z:productHome.z}))return false;
      if(reduceSeatMotion()){moveSeat({x:productHome.x,y:.91,z:productHome.z});facing=0;resetInterpolation();sync();character.returnProduct();character.update('idle',0);}else productApproach={from:{...from},to:productHome,elapsed:0,returning:true};clearInput();injected=null;beginActionView('product',-Math.PI/2+.5);return true;
    },
    bagProduct(id){
      if(productApproach||!character.bagProduct?.(id,reduceSeatMotion()))return false;
      productHome=null;clearInput();injected=null;
      if(actionView?.kind==='product')restoreActionView();
      character.update('idle',0);
      return true;
    },
    customize: changes => character.customize?.(changes),
    setPaused: fn => { isPaused = fn; },
    setGamepadInput: input => { gamepad = input; },
    setInput: input => { injected = input; if (Number.isFinite(input?.yaw)) previousYaw = yaw = input.yaw; if (Number.isFinite(input?.pitch)) setPitch(input.pitch); },
    get collisionTicks() { return collisions; },
    sampleMovement() {
      const {x,z} = body.translation();
      return {x,z,visualX:visual.position.x,visualZ:visual.position.z,
        cameraDistance:cameraClearance,requestedCameraDistance:cameraDistance,collisionTicks:collisions};
    },
    takeQueryTimings(out) {
      out.physicsMs += collisionMs;
      out.cameraMs += cameraQueryMs;
      collisionMs = cameraQueryMs = 0;
    },
    get chaseFov() { return framing.fov; },
    refreshCameraMode() {
      if (renderedMode !== cameraMode() || viewToggle.disabled !== chaseRequired()) updateCamera(0);
    },
    cameraState(shelfOpen) {
      const required = Boolean(shelfOpen || chaseRequired());
      return {mode: view.mode(required), zoom: view.zoom(required)};
    },
    get state() { const p = body.translation(); const state = {x: p.x, y: p.y - .875, z: p.z, cameraOccluded, capsuleEnabled:capsule.isEnabled(), productApproaching:Boolean(productApproach), seated, elevatorTravel: Boolean(elevatorTravel), elevatorPhase:elevatorTravel?.phase||null, cartCapability:cartCapability(), cameraFocus:actionView?.kind||null,cameraDistance,cameraObstruction:{lift:cameraLift,distance:cameraClearance,radius:cameraRadius,avatarVisible:!cameraOccluded}, seatPhase, seatId:seat?.id||null, seatName:seat?.name||null, pushing, animation: character.animation, yaw, facing, pitch: currentPitch(), character: character.state};
      if (tram) {
        Object.defineProperty(state, 'tram', {value:tram.controls});
        state.tramRide = tram.controls.state;
      }
      return state;
    }
  };
}
