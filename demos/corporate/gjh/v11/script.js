import {restroomAt} from './assets/restroom-layout.js';
import {readStandardGamepad,gamepadMotion} from '../../../../assets/onboarding/gamepad.js';
import {createPerformanceMonitor} from './assets/performance-monitor.js';
import {createPerformancePanel} from './assets/performance-panel.js';
import {createFrameTrace, createProgramTrace} from './assets/frame-trace.js';
import {createUI} from './assets/ui.js';
import {createGraphicsQuality, MALL_FRAME_BUDGETS, usesPortraitAtlas} from './assets/graphics-quality.js';
import {createModes} from './assets/modes.js';
import {setupOriginalTin} from './assets/original-tin.js';
import {spatial, storeAt} from './assets/spatial.js';
import {expandedLayout, expandedStoreAt, expandedStoreArrival} from './assets/expanded-layout.js';
import {allowMallLightWash, createMallAtmosphere} from './assets/mall-atmosphere.js';
import {createArrivalChime} from './assets/elevator-chime.js';
import {liftLayout} from './assets/lift-layout.js';
import {createModelWarmup} from './assets/model-warmup.js';
import {createWarmReport, createWarmRunner, createTierQueue, prepareEntryFrame, prepareTier} from './assets/scene-warmup.js';
import {emptyInteriorReport} from './assets/interiors/warmup.js';
import {createFixedClock, MOVEMENT, FIXED_STEP as STEP} from './assets/movement.js';
import {shouldOpenStoreDoor} from './assets/auto-door.js';
import {createInteractionRegistry} from './assets/interaction-registry.js';
import {createSpatialHud} from './assets/ux-spatial-hud.js';
import {createMallHud} from './assets/hud-coordinator.js';
import {storeDestinations} from './assets/store-destinations.js';
import {icon} from './assets/icons.js';
import {tramRoute} from './assets/tram-layout.js';
import {tramEnabled} from './assets/tram-ride.js';
import {createTestWalk} from './assets/test-walk.js';
for (const slot of document.querySelectorAll('[data-icon]')) {
  const svg = icon(slot.dataset.icon, {size: 18});
  if (slot.id) slot.append(svg);
  else slot.replaceWith(svg);
}
for (const [selector, name, size] of [
  ['#mall-map > summary', 'map-pin', 22],
  ['#keyboard-help > summary', 'help-circle', 18],
  ['#mall-theme-open', 'theme', 18],
  ['#directory-theme-open', 'theme', 18],
]) {
  document.querySelector(selector).prepend(icon(name, {size}));
}
document.querySelector('#interaction-point').append(icon('map-pin', {size: 18}));
const startupFlags = new URLSearchParams(location.search);
const expanded = startupFlags.get('layout') !== 'classic';
const liftEnabled = startupFlags.get('visitor') !== 'v1';
const testEnabled = startupFlags.get('test') === '1' || Boolean(window.__GJH_TEST);
document.body.classList.toggle('is-expanded', expanded);

const arrivalChime = createArrivalChime();
const skipRide = document.getElementById('skip-lift-ride');
skipRide.addEventListener('click',()=>{player?.skipRide();canvas.focus({preventScroll:true});});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const startupOverlay = document.getElementById('app-loader');
let greetedOnArrival = false, pageEnded = false;
let ready = false, player, world, physics, renderer, elevator, manual = false, frame = 0, last = 0, frames = 0;
const fixedClock = createFixedClock();
const movementTimings = {physicsMs:0,cameraMs:0};
const movementHistory = new Array(300);
let movementFrame = 0;
let three, frameTrace, programTrace;
let modelWarmup, tierQueue, requestedProfile;
let warmRunner = null, warmKey, warmReport = createWarmReport(), sceneWarmFirst = true, entryPresentation;
let lightWash=false;
let productControl=null,shelfFocus=null,guidance=null,mallTheme=null,brandWallStarted=false,atmosphere=null,npcs=null,spatialHud=null;
let themeStage = null;
let themeMidnightTimer;
let initialized = false, fatal = false, contextLost = false, interrupted = false, restorePending = false, contextWaiter;
let graphicsStatus = 'initializing', losses = 0, validations = 0;
let markFirstFrame;
const firstFrame = new Promise(resolve => { markFirstFrame = resolve; });
let renderWidth = 0, renderHeight = 0, viewportWidth = innerWidth, viewportHeight = innerHeight;
const quality = createGraphicsQuality(change => {
  if (change === 'resolution' && quality.state) {
    requestedProfile = quality.resolve(renderWidth);
    scheduleTier();
    requestRender();
  } else resize();
});
let renderRequested = false, forceRender = false, enteredAt = null;
let simulationMs = 0, simulationSteps = 0;
// Visibility does not imply focus; only an actual focus event clears blur suppression.
let selectedInteraction = null, interactionDistance = Infinity, windowBlurred = false, interactions;
let shopActionsLoad, shopActionsAttemptZone, shopActionsTime, testWalk;
let lastPreloadUpdate = -Infinity, initialPreloadStarted = null, preloadSettled = !expanded;
function hideGuidance() { guidance?.hide(); shelfFocus?.hideNearby(); ui.clearGuidance(); spatialHud?.suspend(); }
let pendingFloorRide;
let nearby = null, currentZone = 'atrium', wasRiding = false;
function clearTransientState(event) {
  testWalk?.cancel('Test movement interrupted by a mode or focus change');
  if (event.kind === 'interrupt') pendingFloorRide = undefined;
  quality.resetSampling();
  simulationMs = simulationSteps = 0;
  hideGuidance();
  mallHud.suspend();
  player?.clearInput();
  player?.setInput(null);
  // Overlays suspend the collection/action camera. Real interruptions cancel the
  // transient demo gesture; physical shelf products remain owned by the player.
  const interaction=player?.state;
  if (event.kind === 'interrupt' && (!interaction?.character.physicalProduct?.held || interaction.productApproaching)) player?.cancelCollection();
  manual = false; fixedClock.reset(); player?.resetInterpolation(); last = performance.now();
}
const modes = createModes({onCleanup: clearTransientState,
  onEnter(mode) { document.body.dataset.mode = mode; }});
const ui = createUI(expanded), canvas = document.querySelector('#scene');
const destinations = storeDestinations(expanded).map(store => ({
  ...store, arrival: expanded ? expandedStoreArrival(store.id) : store.arrival,
}));
const mallHud = createMallHud({destinations, expanded:expanded && liftEnabled, scene: canvas, announce: ui.announce,
  subscribeBag: ui.onBagChange, subscribeInspect: ui.onProductInspect});
const performanceMonitor = createPerformanceMonitor();
performanceMonitor.setEnabled(true);
let measuringFrames = false, lastMetricsUpdate = -Infinity, maxFrameUploadMs = 0;
function movementReport() {
  const percentile = index => {
    const values = movementHistory.map(frame => frame[index]).filter(Number.isFinite).sort((a,b) => a-b);
    return values[Math.ceil(values.length * .95) - 1] ?? null;
  };
  return {frames:Math.min(movementFrame,movementHistory.length), physicsP95Ms:percentile(0),
    cameraQueryP95Ms:percentile(1), collisionTicks:player?.collisionTicks ?? 0};
}
function performanceReport() {
  return {
    ...performanceMonitor.snapshot(),
    movement: movementReport(),
    renderScale: quality.state?.renderScale ?? 1,
    targetFps: quality.targetFps,
    refreshHz: quality.refreshHz,
    deviceClass: quality.deviceClass,
    tierDowngrades: quality.tierDowngrades,
    signage: world?.signage?.report() ?? {modelsLoaded:0,signs:0,drawCalls:0,triangles:0,textureMB:0,previousTextureMB:0,atlasPx:0,phoneProof:null,tier:quality.state?.tier??'low'},
    interiors: world?.interiors?.report() ?? emptyInteriorReport(quality.state?.tier ?? 'low'),
    capturedAt: new Date().toISOString(),
    timeOrigin: performance.timeOrigin,
    version: document.querySelector('[data-mall-version]')?.textContent.trim() || null,
    layout: expanded ? 'expanded' : 'classic',
    ...(programTrace && {programTrace:programTrace.report()}),
    ...(frameTrace && {frameTrace:frameTrace.report()}),
    uploads: {...(modelWarmup?.report() ?? {lateAdditions:0,pendingUploads:0}), maxFrameUploadMs},
    warm: {...warmReport, upperLevel:world?.upperWarmStatus ?? null},
    viewport: {width: viewportWidth, height: viewportHeight, pixelRatio: renderer?.getPixelRatio()},
    graphics: {tier: quality.state?.tier, contextLosses: losses, restorations: validations}
  };
}
const performancePanel = createPerformancePanel({
  snapshot: () => performanceMonitor.snapshot(), report: performanceReport
});
function pausePerformance() {
  if (!measuringFrames) return;
  measuringFrames = false;
  performanceMonitor.pause();
  performancePanel.reset();
  lastMetricsUpdate = -Infinity;
}
spatialHud = createSpatialHud({expanded});
const spatialTargetName = document.getElementById('nearby-name');
const spatialInspectButton = document.getElementById('inspect');
let lastSpatialSample = -Infinity;
function updateSpatialHud() {
  const now = performance.now();
  if (!player || now - lastSpatialSample < 100) return;
  lastSpatialSample = now;
  const p = player.state;
  spatialHud.update({position:p, zone:currentZone, interaction:selectedInteraction,
    distance:interactionDistance, targetLabel:spatialTargetName.textContent,
    travelling:Boolean(p.elevatorTravel), usable:!spatialInspectButton.disabled,
    active:ready && !modes.paused() && !windowBlurred && !document.hidden &&
      document.body.classList.contains('is-3d') && ['explore', 'cart'].includes(modes.current()) &&
      !p.character.collection.active && !p.productApproaching});
}
function syncMode(signals = ui.modeSignals()) {
  if (modes.current() === 'shelf' && !signals.shelfOpen) modes.request(modes.layers().at(-2), 'Shelf closed');
  modes.observe({...signals, seated: Boolean(player?.state.seated),
    cartActive: Boolean(player?.state.character?.cart?.active)});
  document.body.dataset.mode = modes.current();
  ui.projectMode(modes.current());
  if (!['explore', 'cart'].includes(modes.current())) hideGuidance();
  updateSpatialHud();
}
ui.onModeState(syncMode);
setupOriginalTin(ui);
syncMode();
// Optional appearance imports cannot block required scene initialization.
async function loadOptionalThemeModule(loader) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(loader),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Optional theme module timed out')), 2000); }),
    ]);
  } finally { clearTimeout(timer); }
}

let previousGamepadInspect=false;
// Screen-space bounds are derived from visible render meshes, including the
// currently animated avatar, rather than from nominal layout dimensions.
function heroVisibility(number) {
  if (!three || !world || !player || !expanded) return null;
  const T=three, camera=player.camera, rect=canvas.getBoundingClientRect();
  const project = root => {
    if (!root) return null;
    for (let p=root; p; p=p.parent) if (!p.visible) return null;
    root.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false);
    const out={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity,inFront:true};
    const point=new T.Vector3();
    function projectBounds(bounds, matrix) {
      if (!bounds || bounds.isEmpty()) return;
      for (const x of [bounds.min.x,bounds.max.x])
        for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
          point.set(x,y,z).applyMatrix4(matrix).project(camera);
          if (point.z < -1 || point.z > 1) out.inFront=false;
          const px=rect.left+(point.x+1)*rect.width/2, py=rect.top+(1-point.y)*rect.height/2;
          out.left=Math.min(out.left,px); out.right=Math.max(out.right,px);
          out.top=Math.min(out.top,py); out.bottom=Math.max(out.bottom,py);
        }
    }
    function visit(object) {
      if (!object.visible) return;
      if (object.isMesh && object.geometry) {
        if (object.isSkinnedMesh) {
          object.computeBoundingBox();
          projectBounds(object.boundingBox, object.matrixWorld);
        } else {
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          projectBounds(object.geometry.boundingBox, object.matrixWorld);
        }
      }
      for (const child of object.children) visit(child);
    }
    projectBounds(root.userData.fixtureBounds, root.matrixWorld);
    if (root.userData.fallbackVisible) projectBounds(root.userData.fallbackBounds, root.matrixWorld);
    visit(root);
    return Number.isFinite(out.left) ? out : null;
  };
  if (number == null) {
    const position=player.body.translation();
    const nearest=expandedLayout.slots.filter(slot=>Number(slot.number)>=4).map(slot=>({
      slot, distance:Math.hypot(position.x-(slot.minX+slot.maxX)/2,position.z-(slot.minZ+slot.maxZ)/2)
    })).sort((a,b)=>a.distance-b.distance)[0];
    number=nearest?.slot.number;
  }
  const id=String(number).padStart(2,'0');
  const hero=world.scene.getObjectByName(`S${id} hero display`);
  if (!hero) return null;
  return Object.freeze({number:id, hero:project(hero), avatar:project(player.visual),
    loaded:hero.userData.modelReady === true});
}
const snapshot = () => Object.freeze({...(player?.state || {}), modelPreload:world?.modelPreload || null, mode: modes.current(), zone: currentZone, nearby, furnishings: world?.furnishings || null, shell: world?.shell || null,
  illegalCount: modes.illegalCount(), modeHistory: modes.history(), modeLayers: modes.layers(), paused: modes.paused(),
  elevator:elevator?.state||null, elevatorModel:elevator?.kit?{tier:elevator.kit.tier,status:elevator.kit.status}:null, restrooms:world?.restrooms?.state??null, amenities: world?.amenities || null,
  npcs: npcs?.state || null,
  renderBudget: atmosphere ? {...atmosphere.state} : null,
  theme: mallTheme?.state() || null,
  themeDecorations: world?.scene.children.filter(item=>item.userData.mallThemeDecoration).map(item=>item.userData.mallThemeDecoration) || [],
  productAssets: world?.productAssets || null, shelves: world?.shelves || [], shelf: shelfFocus?.state || null,
  brandPlaqueCount: world?.scene.getObjectByName('Seventeen brand wall plaques')?.geometry.index?.count / 6 || 0,
  interaction: selectedInteraction ? {id: selectedInteraction.id, x: selectedInteraction.x, y: selectedInteraction.y ?? 0, z: selectedInteraction.z, radius: selectedInteraction.radius, distance: interactionDistance} : null,
  get heroVisibility() { return heroVisibility(); },
  camera: player ? {position: player.camera.position.toArray(), quaternion: player.camera.quaternion.toArray(), fov: player.camera.fov, aspect: player.camera.aspect} : null,
  graphics: Object.freeze({status: graphicsStatus, losses, validations, initialized, quality: quality.state,
    sceneId: world?.scene.uuid || null, cameraId: player?.camera.uuid || null, sceneChildren: world?.scene.children.length || 0,
    shadows: Boolean(renderer?.shadowMap.enabled), buffer: renderer ? [canvas.width, canvas.height] : null}),
  gpu: renderer ? {...renderer.info.memory} : null,
  seats:world?.seats?.map(({id,name,x,y,z,exitX,exitZ,facing,bounds})=>({id,name,x,y,z,exitX,exitZ,facing,
    bounds:{min:{...bounds.min},max:{...bounds.max}}}))||[],
  doors: Object.freeze(Object.fromEntries((world?.doors || []).map(door => [door.zone, door.open]))),
  drawCalls: renderer?.info.render.calls || 0, renderTriangles: renderer?.info.render.triangles || 0,
  rendererResources: Object.freeze({geometries: renderer?.info.memory.geometries || 0, textures: renderer?.info.memory.textures || 0}), frames, reducedMotion: reducedMotion.matches,
  roomSigns: Object.freeze((world?.roomSigns || []).map(({zone, mesh, left, right, top, bottom}) => Object.freeze({zone, visible: mesh.visible, left, right, top, bottom}))),
  pixelRatio: renderer?.getPixelRatio() || 1, hidden: document.hidden});
testWalk = testEnabled ? createTestWalk({
  position: () => player.body.translation(),
  setInput: input => player.setInput(input),
  snapshot
}) : null;
function canTest() { return canPlayEmote(); }
function resumeTestSimulation() {
  if (!manual) return;
  manual = false;
  fixedClock.reset();
  player.resetInterpolation();
  player.setInput(null);
}
async function startTestWalk(x, z, speed, face = false) {
  if (!canTest()) throw new Error('Enter and focus the 3D mall before running a test command');
  const pose = player.state;
  if (pose.elevatorTravel || pose.seated || pose.tramRide?.active || pose.productApproaching) {
    throw new Error('The player is busy');
  }
  resumeTestSimulation();
  player.clearInput();
  const maxSpeed = pose.pushing ? MOVEMENT.cart : MOVEMENT.desktopWalk;
  return testWalk.start(x, z, speed ?? Math.min(2.5, maxSpeed), maxSpeed, face);
}
const testAPI = testEnabled ? {
  testWalkTo: (x, z, {speed} = {}) => startTestWalk(x, z, speed),
  testFaceTo: (x, z) => startTestWalk(x, z, undefined, true),
  testPress(action) {
    if (!['interact', 'next', 'drop', 'ride'].includes(action)) throw new RangeError('Unknown test action: ' + action);
    if (!canTest()) return false;
    resumeTestSimulation();
    let handled = false;
    if (action === 'next') handled = interactions.cycle(1);
    else if (action === 'drop') handled = interactions.dispatch(interactions.get('drop', 'held-product'));
    else if (action === 'interact' || selectedInteraction?.kind === 'tram') handled = interactNearby();
    updateHUD(); requestRender();
    return Boolean(handled);
  },
  testUpperPoints: () => world?.interactables
    .filter(item => item.y === liftLayout.upper && (item.seat || item.id.startsWith('brand-plaque-')))
    .map(({id, x, z, seat}) => ({id, x, z, name:seat?.name})) ?? [],
  testShopActions: () => shopActionsLoad ?? null,
  testShopState: id => interactions?.shopState(id),
  testProps: () => world?.interactables.physicsProps?.sample(),
  testTramRouteLength: () => tramRoute.length,
  testTramState: () => player?.tramState,
  testTramCarVisible() {
    const car = world?.scene.getObjectByName('Mall tram');
    if (!car?.visible) return false;
    const camera = player.camera;
    const frustum = new three.Frustum().setFromProjectionMatrix(
      new three.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
    // The real carriage is a Group of meshes, so test its world-space box instead of one geometry.
    return frustum.intersectsBox(new three.Box3().setFromObject(car));
  },
  testSetTramSpeed(multiplier) {
    if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 12) throw new RangeError('Expected tram speed multiplier 1–12');
    if (!player?.state.tram) return false;
    player.state.tram.setSpeedMultiplier(multiplier);
    return true;
  },
} : {};
Object.defineProperty(window, '__mall', {value: Object.freeze({
  ...testAPI,
  performanceReport,
  movementSample: () => player && {...player.sampleMovement(),frames},
  emote(name) {
    if (!canPlayEmote()) return false;
    greetOnArrival();
    return player.emote(name);
  },
  get ready() { return ready; }, get state() { return snapshot(); },
  get mode() { return modes.current(); },
  get camera() { return player ? Object.freeze(player.cameraState(shelfFocus?.open)) : null; },
  heroVisibility(number) { return heroVisibility(number); },
  teleport(zone) {
    if (!ready || !player.teleport(zone)) return false;
    testWalk?.cancel('Test movement interrupted by teleport');
    quality.resetSampling(); updateHUD(); requestRender(); return true;
  },
  setInput(input) {
    if (!ready || modes.paused()) return;
    testWalk?.cancel('Test movement interrupted by manual input');
    if (manual && input === null) { fixedClock.reset(); player.resetInterpolation(); }
    manual = input !== null;
    const clean = input === null ? null : {forward: Math.max(-1, Math.min(1, Number(input.forward) || 0)), right: Math.max(-1, Math.min(1, Number(input.right) || 0)), run: Boolean(input.run)};
    if (clean && Number.isFinite(input.yaw)) clean.yaw = input.yaw;
    if (clean && Number.isFinite(input.pitch)) clean.pitch = input.pitch;
    player.setInput(clean);
  },
  step(ms) {
    if (!ready || !Number.isFinite(ms) || document.hidden || modes.paused()) return snapshot();
    testWalk?.cancel('Test movement interrupted by manual step');
    manual = true;
    quality.resetSampling();
    const count = Math.max(0, Math.min(600, Math.floor(ms / (STEP * 1000))));
    for (let i = 0; i < count; i++) tick();
    // Diagnostics return the draw counts for this exact simulated pose.
    player.updateCamera(count * STEP); greetOnArrival();
    render();
    // Also submit the final pose in a presentation callback. Synchronous steps
    // can be batched inside one task, outside the browser's paint cycle.
    requestRender();
    return snapshot();
  }
}), writable: false});
function updateHUD() {
  const p = player.state;
  if (skipRide.hidden===p.elevatorTravel) skipRide.hidden=!p.elevatorTravel;
  const zone = elevator && p.y > elevator.upper / 2 ? 'upper' : (expanded ? restroomAt(p.x,p.z) ?? expandedStoreAt(p.x,p.z) : storeAt(p.x,p.z))?.id || 'atrium';
  if (zone !== currentZone || Boolean(p.elevatorTravel) !== wasRiding) quality.resetSampling();
  currentZone = zone;
  wasRiding = Boolean(p.elevatorTravel);
  if(expanded&&currentZone==='upper'&&!brandWallStarted){
    brandWallStarted=true;
    world.ensureBrandWall().then(({records})=>{ui.setBrandStories(records);updateHUD();})
      .catch(error=>console.error('Upper deck brand wall could not load:',error));
  }
  const selection = interactions.nearest(p, {travelling: Boolean(p.elevatorTravel), player: p, zone});
  selectedInteraction = selection.item; interactionDistance = selection.distance;
  nearby = selectedInteraction?.id || null;
  productControl?.update(p, interactions.productTarget(selectedInteraction), !selectedInteraction?.shopAction?.productId);
  shelfFocus?.setNearby(nearby);
  ui.update({zone: currentZone, x: p.x, z: p.z, yaw:p.yaw, nearby, interaction:selectedInteraction, collectionActive:p.character.collection.active||p.productApproaching,isSeated:p.seated,seatPhase:p.seatPhase,seatName:p.seatName,elevatorState:elevator?.expanded?elevator.state:null,elevatorUpper:elevator?.upper,hasHeldProduct:Boolean(productControl&&p.character.physicalProduct.held)});
}
function canPlayEmote() {
  return ready && !document.hidden && !windowBlurred && !modes.paused() &&
    startupOverlay.hidden && document.body.classList.contains('is-3d');
}
function greetOnArrival() {
  if (greetedOnArrival || !canPlayEmote()) return;
  if (player.state.character.model !== 'gjh-tripo-visitor' || reducedMotion.matches) {
    greetedOnArrival = true;
  } else if (!player.state.cameraOccluded) {
    greetedOnArrival = player.emote('wave', {arrival: true});
  }
}
const fixedTick = () => tick(false);
function tick(refreshHud = true) {
  if (modes.paused() || expanded && windowBlurred) return;
  const p = player.state;
  const doorsStart = performance.now();
  world.restrooms?.update(STEP,p);
  for (const door of world.doors) {
    if (door.advance) { door.advance(p, STEP, reducedMotion.matches); continue; }
    const open = shouldOpenStoreDoor(door, p) || (door.open > 0 && door.occupied());
    door.targetOpen = open;
    const next = reducedMotion.matches ? Number(open) : Math.max(0, Math.min(1, door.open + (open ? 1 : -1) * STEP * 3));
    if (next === door.open) continue;
    door.open = next;
    for (const leaf of door.leaves) {
      const x = door.x + leaf.side * (1.16 + door.open * 2.28);
      leaf.group.position.x = x;
      leaf.body.setNextKinematicTranslation({x, y: 1.8, z: .05});
    }
  }
  movementTimings.physicsMs += performance.now() - doorsStart;
  testWalk?.beforeTick();
  elevator?.update?.(STEP,p); player.update(STEP);
  const physicsStart = performance.now();
  physics.step();
  movementTimings.physicsMs += performance.now() - physicsStart;
  testWalk?.afterTick();
  if (pendingFloorRide?.phase === 'calling' && !elevator.calling) {
    const {target, arrival} = pendingFloorRide;
    const result = rideElevator({target});
    pendingFloorRide = result.riding && arrival ? {target, arrival, phase:'riding'} : undefined;
    ui.announce(result.reason || 'Elevator travelling to the other level.');
  } else if (pendingFloorRide?.phase === 'riding' && !player.state.elevatorTravel) {
    const {target, arrival} = pendingFloorRide;
    pendingFloorRide = undefined;
    if (Math.abs(player.state.y - target) < .35) {
      updateHUD();
      arrival();
    }
  }
  if (npcs) {
    const start = frameTrace?.start();
    npcs.update(STEP,player.state,reducedMotion.matches);
    frameTrace?.end('crowd.update', start);
  }
  if (refreshHud) updateHUD();
}
let lastGuidanceSample = -Infinity, projectedTarget = null;
function requestRender(force = false) {
  renderRequested = true;
  forceRender ||= force;
  resume();
}
function render(force = false) {
  if (ready && !document.hidden && (force || !modes.paused() || modes.current() === 'shelf')) {
    sizeDrawingBuffer();
    if (!shelfFocus?.open) player.refreshCameraMode();
    const camera = shelfFocus?.open ? shelfFocus.camera : player.camera;
    camera.updateMatrixWorld();
    const pose = player.state;
    const matrix = camera.matrixWorld.elements;
    const now = performance.now();
    if (expanded && !startupOverlay.hidden) shopActionsTime = undefined;
    if (expanded && startupOverlay.hidden) {
      if (!shopActionsLoad && (['newmoon','mili','gogo'].includes(currentZone) || /^planned-space-(0[4-9]|1[0-7])$/.test(currentZone)) && shopActionsAttemptZone !== currentZone) {
        shopActionsAttemptZone = currentZone;
        shopActionsLoad = import('./assets/interiors/shop-interactions.js')
          .then(async ({installShopInteractions}) => {
            if (pageEnded || fatal) return;
            const targets = await installShopInteractions(three, world.scene, interactions, ui.announce, () => quality.state?.tier);
            if (pageEnded || fatal) return;
            updateHUD(); requestRender();
            if (!testEnabled) return;
            const nativeSeats = world.seats.flatMap(seat => {
              const stool = seat.id.match(/^newmoon-tasting-stool-([12])$/);
              const item = stool ? 'S01-stools1' + stool[1] : seat.id;
              if (!/^S0[13]-stools/.test(item)) return [];
              return [{id:seat.id, item, x:seat.x, z:seat.z, standing:{x:seat.exitX,z:seat.exitZ},
                zone:stool ? 'newmoon' : 'gogo', slot:item.slice(0,3), label:'Sit', done:'', seat:true}];
            });
            return [...targets.map(({id, x, z, standing, shopAction:{zone, slot, label, done, productId}}) =>
              ({id, item:id, x, z, standing, zone, slot, label, done, productId})), ...nativeSeats];
          })
          .catch(error => { shopActionsLoad = null; console.error('Shop actions unavailable:', error); });
      } else if (!shopActionsLoad && currentZone !== shopActionsAttemptZone) shopActionsAttemptZone = undefined;
      if (interactions.advanceShopActions(currentZone, Math.min(.1, (now-(shopActionsTime ?? now))/1000), reducedMotion.matches)) updateHUD();
      shopActionsTime = now;
    }
    mallHud.update({position: pose, zone: currentZone, travelling: pose.elevatorTravel,
      liftDocked: expanded && elevator?.height === 0 && !elevator.calling,
      enabled: !windowBlurred && !modes.paused() && document.body.classList.contains('is-3d') && startupOverlay.hidden,
      now, forward: {x: -matrix[8], z: -matrix[10]}});
    const guiding = !windowBlurred && ['explore', 'cart'].includes(modes.current()) && !pose.character.collection.active;
    const label = ui.updateGuidance(selectedInteraction, interactionDistance, guiding);
    const target = label && selectedInteraction.id;
    if (target !== projectedTarget) {
      shelfFocus?.hideNearby();
      guidance?.hide();
      projectedTarget = target;
    }
    if (shelfFocus?.open) shelfFocus.update(camera, true, false);
    else if (label && (quality.state?.tier !== 'low' || now - lastGuidanceSample >= 100)) {
      lastGuidanceSample = now;
      shelfFocus?.update(camera, true, true);
      guidance?.update(selectedInteraction, label, camera, true);
    }
    const tier = quality.state?.tier;
    elevator?.setDrawTier?.(tier);
    const detailed = expanded && quality.state?.shadows && renderWidth >= 1000;
    // Retain the direct pass until the Detailed interiors have their linear
    // programs. A downgrade can use the already warmed direct pass immediately.
    const detailedReady = detailed && world.interiors?.activeTier === 'detailed';
    if (expanded) renderer.shadowMap.enabled = detailedReady;
    world.updateShopLods(pose, renderer.shadowMap.enabled, tier, camera,
      canvas.height, Boolean(shelfFocus?.open), lightWash, reducedMotion.matches);
    atmosphere?.update(pose,now,tier);
    const signStart = frameTrace?.start();
    world.updateSigns(camera, canvas, reducedMotion);
    frameTrace?.end('signage.update', signStart);
    const draw=()=>{
      world.interiors?.beginFrame();
      try {
        atmosphere.render(camera, detailedReady && Math.abs(pose.y) < 5, npcs,
          expanded ? MALL_FRAME_BUDGETS[tier] : undefined);
      } finally { world.interiors?.endFrame(); }
    };
    const warmPhase = warmReport.background ?? warmReport.reason;
    programTrace?.sample('pre-draw', warmPhase, currentZone);
    programTrace?.player(pose);
    if (shelfFocus?.open) player.renderShelf(draw);
    else if (expanded && tier === 'low') world.drawWithPlayerContact(player.contactShadow,draw);
    else draw();
    programTrace?.sample('live', warmPhase, currentZone);
    frames++;
    if (window.__sceneReady) ui.offerFirstGuide();
    return pose;
  }
}
function updateModelPreload(now) {
  if (!expanded || now-lastPreloadUpdate < 1000) return;
  lastPreloadUpdate=now;
  const node=document.getElementById('model-preload-status'), state=world?.modelPreload;
  if (!node || !state) return;
  const models=Object.values(state.models), furnishings=Object.values(world.furnishings);
  const visitorLod=player.state.character.lod;
  const lodStatus=visitorLod ? (visitorLod.available?'loaded':visitorLod.failed?'fallback':'pending') : 'loaded';
  const assets=models.concat(Object.values(state.sceneModels),furnishings.map(item => item.status),lodStatus);
  if(elevator?.kit)assets.push(elevator.kit.status);
  const done=assets.filter(status => status==='loaded'||status==='fallback').length;
  const failed=assets.filter(status => status==='fallback').length;
  const ready=done===assets.length && state.settled===state.total;
  preloadSettled=ready;
  node.hidden=false;
  const zh=document.documentElement.lang?.startsWith('zh');
  node.textContent=ready ? (failed ? (zh?'商店模型准备完成，部分模型不可用。':'Shop models prepared; some assets are unavailable.') : (zh?'商店模型已准备完成，首次显示仍可能需要一些时间。':'Shop models prepared. First views may still take time to render.')) :
    (zh?`正在准备商店模型（${done}/${assets.length}）。您可等待或立即进入。`:`Preparing shop models (${done}/${assets.length}). You can wait or enter now.`);
  if (initialPreloadStarted !== null && !window.mallLoader?.snapshot().ready) {
    if (ready || now-initialPreloadStarted >= 30000) {
      initialPreloadStarted=null;
    } else window.mallLoader?.prepare(node.textContent);
  }
}
function tierWork(profile, report, startup = false) {
  const screenPixel = () => !startupOverlay.hidden || (!manual && !modes.paused()) ? 1 : 0;
  return prepareTier({T:three, renderer, world, player, expanded, elevator, atmosphere, modelWarmup,
    width:renderWidth, height:renderHeight, screenPixel, applyProfile, frameTrace, startup}, profile, report);
}
function tierKey(profile) {
  return [profile.tier,profile.shadows,profile.pixelRatio,profile.preference,renderWidth,renderHeight].join('/');
}
function scheduleTier() {
  const profile=requestedProfile, active=quality.state;
  if(!profile || !ready || contextLost || pageEnded)return;
  const key=tierKey(profile);
  if (warmRunner) {
    if (warmRunner.blocking || warmKey === key) return;
    warmRunner.stop('superseded');
  }
  if(profile.tier===active.tier && profile.shadows===active.shadows &&
     (!world.signage || world.signage.getTier()===profile.tier) &&
     (!world.interiors || world.interiors.activeTier===profile.tier)){
    const width = Math.floor(renderWidth*profile.pixelRatio), height = Math.floor(renderHeight*profile.pixelRatio);
    if (expanded && profile.shadows && !atmosphere.postPrepared(width,height)) {
      void tierQueue.request(key, function* () {
        yield* atmosphere.preparePost(width,height,()=>!manual && !modes.paused() ? 1 : 0);
        applyProfile(profile);
        requestRender();
      }).catch(error=>console.warn('Mall render target preparation interrupted',error));
    } else {
      tierQueue.cancel();
      world.interiors?.setTier(profile.tier);
      applyProfile(profile);
    }
    return;
  }
  void tierQueue.request(key,()=>tierWork(profile,createWarmReport())).catch(error=>{
    console.warn('Mall graphics tier preparation interrupted',error);
  });
}
function cancelEntryPresentation() {
  entryPresentation?.return();
  entryPresentation = null;
}
function advanceStartupWarm() {
  const loader = window.mallLoader;
  if (!loader || loader.ready || contextLost || restorePending || pageEnded) return false;
  if (loader.skipSignal.aborted) initialPreloadStarted = null;
  if (initialPreloadStarted !== null) return false;
  if (loader.snapshot().stage === 'frame') loader.complete('frame');
  if (loader.snapshot().stage !== 'warm') return false;
  if (!warmRunner) {
    const {tier} = requestedProfile;
    warmReport = createWarmReport();
    warmReport.reason = 'running';
    warmKey = tierKey(requestedProfile);
    warmRunner = createWarmRunner(tierWork(requestedProfile,warmReport,true), warmReport, {
      budgetMs:tier === 'low' ? 8 : tier === 'balanced' ? 10 : 12,
      signal:loader.skipSignal,
      lost:() => renderer.getContext().isContextLost(),
      onRelease(result) {
        if (result.reason !== 'context-loss' && !pageEnded && !fatal) {
          if (result.reason === 'enter-now' && !loader.snapshot().dismissed) {
            entryPresentation = prepareEntryFrame(renderer.getContext(), () => render(true));
          } else loader.complete('warm', result.skipped || result.ms >= 5750);
        }
      },
      onFinish(result) {
        warmRunner = null;
        if ((result.reason === 'complete' || result.background === 'complete') && loader.ready) scheduleTier();
      }
    });
  }
  if (entryPresentation) {
    if (loader.snapshot().dismissed) {
      cancelEntryPresentation();
      loader.complete('warm', true);
    } else {
      const step = entryPresentation.next();
      if (step.done) {
        entryPresentation = null;
        warmReport.presentation = step.value;
        if (step.value.reason !== 'context-loss') loader.complete('warm', true);
      }
    }
    return true;
  }
  if (!warmRunner.blocking) return false;
  warmRunner.runFrame();
  if (warmRunner?.blocking) warmModels(player.state, false);
  return true;
}
function warmModels(pose, background = true) {
  if (!pose || document.hidden || contextLost || restorePending || pageEnded) return 0;
  const {physicalProduct, collection} = pose.character;
  const stableSeat = pose.seatPhase === 'idle' || pose.seatPhase === 'seated';
  const stableProduct = !physicalProduct || ['empty','held'].includes(physicalProduct.phase);
  if (!stableSeat || !stableProduct || pose.elevatorTravel || pose.productApproaching || collection.active) return 0;
  const started = performance.now();
  const remaining = () => Math.max(0, 4 - (performance.now() - started));
  const traceStart = frameTrace?.start();
  const runner = background && warmRunner;
  const sceneFirst = runner && sceneWarmFirst;
  if (runner) sceneWarmFirst = !sceneWarmFirst;
  if (sceneFirst) runner.runFrame(Math.min(2, remaining()));
  const roomsStart = frameTrace?.start();
  const roomMs = world.interiors?.runFrame(remaining()) ?? 0;
  frameTrace?.end('interiors.install', roomsStart);
  const modelsStart = frameTrace?.start();
  const modelMs = modelWarmup.runFrame(true, remaining());
  frameTrace?.end('models.upload', modelsStart);
  if (runner && !sceneFirst) runner.runFrame(remaining());
  frameTrace?.end('warm.slice', traceStart);
  const elapsed = runner || roomMs > 0 || modelMs > 0 ? performance.now() - started : 0;
  maxFrameUploadMs = Math.max(maxFrameUploadMs, elapsed);
  return elapsed;
}
function animate(now) {
  frame = 0;
  if (!ready || document.hidden) return;
  frame = requestAnimationFrame(animate);
  updateModelPreload(now);
  if (advanceStartupWarm()) {
    last = now;
    fixedClock.reset();
    quality.resetSampling(now);
    return;
  }
  const entered = startupOverlay.hidden && document.body.classList.contains('is-3d');
  if (entered) enteredAt ??= now;
  quality.observeRefresh(now, entered && !windowBlurred);
  const advancing = !manual && !modes.paused() && !(expanded && windowBlurred);
  const elapsed = (now - last) / 1000;
  if (!advancing) fixedClock.reset();
  last = now;
  const callbackStart = performance.now();
  const pad=testWalk?.active ? null : readStandardGamepad();
  const consumed=ui.handleGamepad(pad);
  const inspectPressed=Boolean(pad?.buttons[0]?.pressed);
  const focused=document.activeElement===canvas||document.activeElement===document.body;
  if(!manual)player.setGamepadInput(!consumed&&!ui.paused()&&focused?gamepadMotion(pad):null);
  if(inspectPressed&&!previousGamepadInspect&&!consumed&&!ui.paused()&&focused&&nearby){
    player.clearInput();
    if(player.state.seated){player.stand();updateHUD();}else ui.inspectNearby(nearby);
  }
  previousGamepadInspect=inspectPressed;
  const simulationStart = performance.now();
  let steps = 0;
  if (advancing && !modes.paused()) {
    steps = fixedClock.advance(elapsed, fixedTick);
    if (steps) updateHUD();
  }
  simulationSteps += steps;
  simulationMs += performance.now() - simulationStart;
  // Drawing can skip refreshes while the simulation still consumes fixed steps.
  const slotMs = quality.cadence.take(now);
  if (!slotMs) return;

  const live = advancing && !modes.paused() || modes.current() === 'shelf';
  // Direct-pass warm-up submits a scissored draw to the default framebuffer.
  // Its non-preserved back buffer must be covered by a live draw before paint.
  const uploadMs = live || renderRequested && (forceRender || !modes.paused()) ? warmModels(player.state) : 0;
  let pose, callbackMs = 0;
  if (live || renderRequested) {
    // Tier preparation can exercise one real screen pixel. The live scene
    // covers it in this same animation callback, before presentation.
    const renderStart = performance.now();
    const force = forceRender;
    renderRequested = forceRender = false;
    if (advancing && !modes.paused() && !shelfFocus?.open) {
      player.updateCamera(Math.min(.1, slotMs / 1000), false, fixedClock.alpha);
      greetOnArrival();
    }
    pose = render(force);
    if (pose) testWalk?.presented();
    const renderEnd = performance.now();
    callbackMs = renderEnd - callbackStart;
    if (pose && live && !windowBlurred && startupOverlay.hidden) {
      measuringFrames = true;
      player.takeQueryTimings(movementTimings);
      movementHistory[movementFrame++ % movementHistory.length] = [movementTimings.physicsMs, movementTimings.cameraMs];
      performanceMonitor.frame(now, renderer.info, {
        simulationMs, renderMs: renderEnd - renderStart, uploadMs,
        callbackMs, steps: simulationSteps, zone: currentZone, x: pose.x, z: pose.z, tier: quality.state?.tier,
        renderScale: quality.state?.renderScale, width: canvas.width, height: canvas.height
      });
      if (now - lastMetricsUpdate >= 1000) {
        performancePanel.update(performanceMonitor.snapshot({includeHistory:false}));
        lastMetricsUpdate = now;
      }
    } else pausePerformance();
  } else pausePerformance();
  player.takeQueryTimings(movementTimings);
  movementTimings.physicsMs = movementTimings.cameraMs = 0;
  simulationMs = simulationSteps = 0;
  quality.sample(now, slotMs, callbackMs, Boolean(pose && advancing && !pose.elevatorTravel &&
    !warmRunner && !tierQueue?.pending && !uploadMs && preloadSettled && entered &&
    now - enteredAt >= 3000 && !windowBlurred && document.hasFocus() && !contextLost &&
    ['explore','cart'].includes(modes.current())));
}
function resume() {
  if (ready && !frame && !document.hidden) {
    last = performance.now();
    fixedClock.reset();
    quality.cadence.reset();
    frame = requestAnimationFrame(animate);
  }
}
function fallback(message, terminal = true) {
  if (terminal) window.mallLoader?.fail(message);
  if (terminal) { fatal = true; graphicsStatus = 'failed'; cancelEntryPresentation(); world?.interiors?.dispose(); modelWarmup?.dispose(); markFirstFrame(); }
  pausePerformance();
  hideGuidance();
  ready = false; window.__sceneFailed = true; window.__sceneReady = false;
  shelfFocus?.close();
  cancelAnimationFrame(frame); frame = 0; modes.interrupt('fallback'); ui.fallback(message);
}
function rideElevator(options) {
  if (!ready || !elevator) return {reason:'The elevator is unavailable right now. Please try again.'};
  manual = false;
  player.setInput(null);
  const result = player.useElevator(elevator, arrivalChime.play, options);
  if (result.riding) arrivalChime.unlock();
  return result;
}
function requestFloorRide(upper, arrival) {
  const target = upper ? liftLayout.upper : 0;
  const result = rideElevator({approach:true, target});
  if (result.calling) {
    pendingFloorRide = {target, arrival, phase:'calling'};
    // Unlock during the map tap, before the automatic boarding tick.
    arrivalChime.unlock();
  } else if (result.riding && arrival) {
    pendingFloorRide = {target, arrival, phase:'riding'};
  }
  if (ready) { updateHUD(); requestRender(); }
  return result;
}
ui.onTeleport(zone => {
  if (!ready || player.state.elevatorTravel || !(expanded ? expandedStoreArrival(zone) : spatial.arrival(zone))) return false;
  pendingFloorRide = undefined;
  manual = false; player.cancelCollection(); player.setInput(null);
  if (!player.teleport(zone)) return false;
  quality.resetSampling(); updateHUD(); requestRender(); canvas.focus({preventScroll: true}); return true;
});
ui.onSeat((sit,id)=>{if(!ready)return;player.clearInput();manual=false;if(sit)npcs?.releaseSeat(id);const ok=sit?player.sit(id):player.stand();updateHUD();requestRender();return ok;});
ui.onView(visual => { if (visual) { last = performance.now(); requestRender(); } else {player?.setCart(false);if(player?.state.seated)player.stand(true);player?.clearInput();player?.cancelCollection();if(player)updateHUD();} });
ui.onShopCycle(() => { if (interactions.cycle(1)) { updateHUD(); requestRender(); } });
function interactNearby() {
  if (!nearby) return false;
  player.clearInput();
  return player.state.seated && !selectedInteraction?.shopAction?.seated ?
    player.stand() : ui.inspectNearby(nearby);
}
document.addEventListener('keydown', event => {
  if (modes.paused() || event.defaultPrevented) return;
  if (event.code === 'Escape') {
    if (interactions?.cancelShopAction()) { event.preventDefault(); updateHUD(); requestRender(); return; }
    if (player?.state.seated) { player.stand(); updateHUD(); }
    player?.cancelCollection();
  }
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      (event.target !== canvas && event.target !== document.body)) return;
  if (event.code === 'BracketRight' || event.code === 'BracketLeft') {
    if (interactions?.cycle(event.code === 'BracketRight' ? 1 : -1)) {
      event.preventDefault(); updateHUD(); requestRender();
    }
  }
  if (event.code === 'KeyF' && nearby) {
    event.preventDefault(); interactNearby();
    updateHUD(); requestRender();
  }
});
window.addEventListener('blur', () => { windowBlurred = true; pausePerformance();hideGuidance(); shelfFocus?.close(); modes.interrupt('window blur'); });
window.addEventListener('focus', () => { windowBlurred = false; quality.resetSampling(); if (ready) { updateHUD(); requestRender(); } });
window.addEventListener('resize', () => { modes.interrupt('viewport resize'); resize(); });
function scheduleThemeMidnight() {
  clearTimeout(themeMidnightTimer);
  if (!ready || !mallTheme || pageEnded) return;
  const now = new Date();
  const midnight = new Date(now).setHours(24, 0, 0, 0);
  themeMidnightTimer = setTimeout(refreshCalendarTheme, midnight - now);
}
function refreshCalendarTheme() {
  scheduleThemeMidnight();
  if (ready && !pageEnded) void mallTheme?.refresh();
}
window.addEventListener('pageshow', refreshCalendarTheme);
document.addEventListener('visibilitychange', () => {
  warmRunner?.visibility(document.hidden);
  if (document.hidden) { pausePerformance();if(ready)mallTheme?.cancel();hideGuidance(); shelfFocus?.close(); modes.interrupt('document hidden'); cancelAnimationFrame(frame); frame = 0; }
  else { if (ready) { quality.resetSampling(); refreshCalendarTheme(); updateHUD(); requestRender(); } else validateRestoration(); resume(); }
});
canvas.addEventListener('webglcontextlost', event => {
  quality.resetSampling();
  window.mallLoader?.context(true);
  event.preventDefault(); contextLost = true; interrupted = true; restorePending = true; losses++;
  cancelEntryPresentation();
  warmRunner?.stop('context-loss');
  tierQueue?.cancel();
  world?.interiors?.invalidate();
  modelWarmup?.invalidate();
  mallTheme?.suspend();
  // Retire the reflection target and NPC bone textures against their original context.
  atmosphere?.releaseEnvironment();
  atmosphere?.invalidatePost();
  npcs?.clearVisitors();
  player?.interruptGraphics(); elevator?.interrupt?.();
  if (!fatal) graphicsStatus = 'lost';
  fallback(fatal ? 'The 3D mall is unavailable. All stores and verified products remain available in list view. Reload the page to retry 3D.' : 'The 3D graphics context was interrupted. All stores and verified products remain available in list view. You can reload to retry, or wait for graphics recovery.', false);
});
canvas.addEventListener('webglcontextrestored', () => {
  window.mallLoader?.context(false);
  contextLost = false;
  // Our listener predates Three r170's At handler. Its synchronous St rebuild
  // replaces renderer.info/shadowMap. A microtask can run between native event
  // listeners, so use a later task, bound to this loss epoch.
  const epoch = losses;
  setTimeout(() => { if (epoch !== losses || contextLost) return; restorePending = false; contextWaiter?.(); validateRestoration(); }, 0);
});
async function waitForContext(context) {
  while (contextLost || context.isContextLost()) await new Promise(resolve => { contextWaiter = resolve; });
  contextWaiter = null;
}
function resize() {
  if (!renderer || !player) return;
  // The fallback hides the canvas. Keep the restored buffer/camera sized for
  // the next explicit entry, without showing or focusing the hidden experience.
  const viewportChanged = viewportWidth !== innerWidth || viewportHeight !== innerHeight;
  const width = canvas.clientWidth || (viewportChanged ? innerWidth : renderWidth) || innerWidth;
  const height = canvas.clientHeight || (viewportChanged ? Math.max(1, innerHeight - document.querySelector('.site-header').offsetHeight) : renderHeight) || innerHeight;
  const resized = width !== renderWidth || height !== renderHeight;
  if (resized || viewportChanged) quality.resetSampling();
  viewportWidth = innerWidth; viewportHeight = innerHeight;
  if (!width || !height) return;
  if (resized) {
    renderWidth = width; renderHeight = height;
    player.resizeCamera(width, height);
    if (shelfFocus?.open) shelfFocus.resize(); else player.updateCamera(0, true);
  }
  requestedProfile=quality.resolve(width);
  if(!ready || !quality.state || !window.mallLoader?.ready) {
    if(!warmRunner)applyProfile(requestedProfile);
  } else {
    scheduleTier();
  }
  requestRender();
}
function applyProfile(profile) {
  profile = quality.apply(profile);
  themeStage?.setTier?.(profile.tier);
  void elevator?.kit?.select(profile.tier);
  void player?.setTramTier?.(profile.tier);
  npcs?.setQuality({tier:profile.tier,mobile:renderWidth<1000,enabled:new URLSearchParams(location.search).get('npcs')!=='off'});
  if (!contextLost) renderer.shadowMap.enabled = profile.shadows;
}
function sizeDrawingBuffer() {
  const {pixelRatio} = quality.state;
  if (renderer.getPixelRatio() !== pixelRatio || canvas.width !== Math.floor(renderWidth * pixelRatio) ||
      canvas.height !== Math.floor(renderHeight * pixelRatio)) {
    renderer.setDrawingBufferSize(renderWidth, renderHeight, pixelRatio);
  }
}
function validateRestoration() {
  if (!initialized || fatal || contextLost || restorePending || !interrupted || ready || document.hidden) return;
  graphicsStatus = 'validating';
  try {
    quality.recover(); world.signage?.recover(); resize();
    const gl = renderer.getContext();
    if (gl.isContextLost()) return;
    renderer.shadowMap.type = three.PCFSoftShadowMap;
    frameTrace?.watchShadowMap();
    try { atmosphere?.restoreEnvironment(); } catch { /* Reflections are optional after recovery. */ }
    world.prepareUpperLevel();
    if (mallTheme && (!world.applyMallTheme(mallTheme.definition()) || (elevator?.applyMallTheme && !elevator.applyMallTheme(mallTheme.definition())))) throw new Error('Theme restoration failed');
    atmosphere?.applyTheme(mallTheme?.definition());
    atmosphere?.update(player.state,undefined,quality.state?.tier);
    player.camera.updateMatrixWorld();
    sizeDrawingBuffer();
    world.updateShopLods(player.state, renderer.shadowMap.enabled, quality.state?.tier, player.camera, canvas.height, false, lightWash, reducedMotion.matches);
    world.updateSigns(player.camera, canvas, reducedMotion);
    renderer.render(world.scene, player.camera);
    // A real submitted scene and nonempty framebuffer must precede availability.
    // No physics tick or UI transition is needed for this offscreen validation.
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (gl.isContextLost()) return;
    if (gl.getError() !== gl.NO_ERROR || renderer.info.render.calls === 0 || !pixel.slice(0, 3).some(Boolean))
      throw new Error('Restored scene frame unavailable');
    validations++; frames++; ready = true; graphicsStatus = 'available';
    if (window.mallLoader?.ready) scheduleTier();
    markFirstFrame();
    window.__sceneFailed = false; window.__sceneReady = true;
    mallTheme?.resume();ui.restored();resume();void mallTheme?.restore();scheduleThemeMidnight();
  } catch {
    fallback('The 3D mall could not recover its graphics. All stores and verified products remain available below. Reload the page to retry 3D.');
  }
}
async function installNpcs(T, R, prepareModel, highResolution, source) {
  if (pageEnded || fatal) return;
  const enabled = new URLSearchParams(location.search).get('npcs') !== 'off';
  if (!source && !enabled) return;
  try {
    const {createNpcSystem, loadNpcSystem} = await import('./assets/npcs.js');
    const options = {onAvatarEvent:programTrace?.event,scene:world.scene,seats:world.seats,physics,R,playerCollider:player.capsule,
      playerBody:player.body,expanded,tram:tramEnabled(expanded,location.search),
      mobile:innerWidth<1000,tier:quality.state?.tier||'balanced',enabled,prepareModel,
      highResolution,
      onModularFallback() { document.getElementById('npc-appearance-status').hidden=false; }};
    const system = source ? createNpcSystem(T, {...options, source}) : await loadNpcSystem(T, options);
    if (pageEnded || fatal) system.dispose();
    else {
      npcs = system;
      npcs.setQuality({mobile:innerWidth<1000,tier:quality.state?.tier||'balanced'});
      void firstFrame.then(() => {
        if (pageEnded || fatal) return;
        system.enableModular();
        return system.loadBoy();
      });
    }
  } catch { /* NPCs are optional. */ }
}
async function initialize() {
  // Allow the initial overlay to paint before expensive module and scene work.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const attributes = {antialias: !expanded, alpha: false, powerPreference: 'high-performance'};
  const preferredContext = quality.androidChrome ?
    canvas.getContext('webgl2', {...attributes, failIfMajorPerformanceCaveat:true}) : null;
  const context = preferredContext || canvas.getContext('webgl2', attributes);
  quality.setWebGLHint(preferredContext?.getContextAttributes()?.powerPreference === 'high-performance');
  if (!context) { fallback(expanded?'WebGL is unavailable. The 17-store mall plan and verified products remain in the accessible directory below.':'WebGL is unavailable. Explore all three stores and the verified products in the accessible list below.'); return; }
  const T = await import('./vendor/three.module.min.js');
  three = T;
  await waitForContext(context);
  renderer = new T.WebGLRenderer({canvas, context, antialias:attributes.antialias});
  lightWash = expanded && allowMallLightWash(quality.deviceClass,context);
  const diagnostics = new URLSearchParams(location.search);
  // Three's first draw synchronously reads the link status, program log and
  // both shader logs in debug mode, even after a parallel link has completed.
  renderer.debug.checkShaderErrors = diagnostics.get('debugShaders') === '1';
  if (diagnostics.get('tracePrograms') === '1' || diagnostics.get('traceWarm') === '1') programTrace = createProgramTrace(renderer);
  if (diagnostics.get('traceWarm') === '1') frameTrace = createFrameTrace(renderer);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  let R;
  try { R = (await import('./vendor/rapier.mjs')).default; await R.init(); }
  catch { fallback('The WebAssembly physics engine could not start. Walking is unavailable; all stores and verified products are available in list view.'); return; }
  physics = new R.World({x: 0, y: -24, z: 0}); physics.timestep = STEP;
  window.mallLoader?.complete('physics');
  modelWarmup = createModelWarmup(T, renderer);
  tierQueue = createTierQueue(modelWarmup.enqueueSweep);
  const warmShadows = () => requestedProfile?.shadows || quality.state?.shadows;
  const warmModel = (model, scene, options) => modelWarmup.prepare(model, scene, {
    linear: () => expanded && Boolean(warmShadows()),
    lighting: lights => warmShadows() ? atmosphere?.lightVariants(lights) : undefined,
    ...options
  });
  const {createWorld} = await import('./assets/world.js');
  world = await createWorld(T, R, physics, expanded, warmModel,
    () => requestedProfile?.tier ?? quality.resolve(innerWidth).tier, quality.deviceClass === 'phone');
  if (expanded) renderer.toneMappingExposure = world.defaultExposure;
  ui.setBrandStories(world.shopExhibits);
  const prepareModel = (model, options) => warmModel(model, world.scene, options);
  const assetRecords = [world.furnishings, world.shell, world.amenities, world.productAssets?.cans]
    .flatMap(group => Object.values(group || {}));
  if (world.productAssets?.shelf) assetRecords.push(world.productAssets.shelf);
  document.getElementById('loader-asset-notice').hidden = !assetRecords.some(record => record?.status === 'fallback');
  window.mallLoader?.complete('scene');
  atmosphere=createMallAtmosphere(T,renderer,world.scene,expanded ? expandedLayout.slots : spatial.stores.map(store=>store.bounds),
    {frameTrace,expanded,...(expanded && {atrium:expandedLayout.atrium, contact:world.contact, plane:world.plane})});
  try {
    const environments = atmosphere.prepareEnvironments();
    try {
      while (!pageEnded && !contextLost && !context.isContextLost() && !environments.next().done) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    } finally { environments.return(); }
  } catch { /* Keep the mall usable without reflections. */ }
  if (expanded) {
    try {
      const {createMallThemeCoordinator} = await loadOptionalThemeModule(() => import('./assets/mall-themes.js'));
      let storage;
      try { storage=window.localStorage; } catch { storage=null; }
      const packs={
        'lunar-new-year':{load:query=>import(`./assets/lunar-new-year.js${query}`),prepare:'prepareLunarDecor',attempts:0,promise:null},
        christmas:{load:query=>import(`./assets/christmas.js${query}`),prepare:'prepareChristmasDecor',attempts:0,promise:null},
        deepavali:{load:query=>import(`./assets/deepavali.js${query}`),prepare:'prepareDeepavaliDecor',attempts:0,promise:null}
      };
      function loadSeasonalModule(pack){
        if(!pack.promise){
          const query=pack.attempts++ ? `?retry=${pack.attempts}` : '';
          const tracked=loadOptionalThemeModule(() => pack.load(query)).catch(error=>{
            if(pack.promise===tracked)pack.promise=null;
            throw error;
          });
          pack.promise=tracked;
        }
        return pack.promise;
      }
      let paintedTheme='everyday';
      mallTheme=createMallThemeCoordinator({storage,notify:state=>{
        ui.updateMallTheme(state);
        if(state.active!==paintedTheme){
          paintedTheme=state.active;
          // Show the committed stage after the previous decorations are released.
          if(!state.suspended && document.body.classList.contains('is-3d')){
            requestRender(true);
          }
        }
      },async prepare(theme,{signal}){
        if(theme.id==='everyday')return {value:theme,dispose(){}};
        const definition=Object.hasOwn(packs,theme.id) ? packs[theme.id] : null;
        if(!definition || signal.aborted)throw new Error('Theme unavailable');
        const pack=await loadSeasonalModule(definition);
        if(signal.aborted)throw new Error('Theme preparation cancelled');
        const stage=pack[definition.prepare](T,world.scene,theme,{signal});
        if (ready) {
          try { await prepareModel(stage.group, {signal}); }
          catch (error) { stage.dispose(); throw error; }
        }
        return stage;
      },commit(next,previous,stage){
        try {
          if(!world.applyMallTheme(next) || (elevator?.applyMallTheme && !elevator.applyMallTheme(next))) throw new Error('Invalid theme');
          atmosphere.applyTheme(next);
          stage?.setTier?.(quality.state?.tier);
          stage?.mount?.();
          themeStage = stage;
        }
        catch(error) { world.applyMallTheme(previous);elevator?.applyMallTheme?.(previous);atmosphere.applyTheme(previous);throw error; }
      }});
      if(!world.applyMallTheme(mallTheme.definition())) throw new Error('Invalid initial theme');
      atmosphere.applyTheme(mallTheme.definition());
      if(contextLost || interrupted) mallTheme.suspend();
    } catch { mallTheme?.destroy();mallTheme=null; }
    ui.configureMallTheme(mallTheme);
  }
  if (liftEnabled) {
    const {createElevatorV2} = await import('./assets/elevator-v2.js');
    elevator = createElevatorV2(T, R, physics, world.scene, expanded, prepareModel);
    world.prepareUpperLevel();
    if(mallTheme && elevator.applyMallTheme && !elevator.applyMallTheme(mallTheme.definition())) {mallTheme.destroy();mallTheme=null;ui.configureMallTheme(null);}
    world.interactables.push(...elevator.interactables);
    world.cameraObstacles.push(...(elevator.cameraObstacles||[]));
  }
  const prepareAvatar = (model, options) => prepareModel(model, {
    lighting: lights => atmosphere.lightVariants(lights),
    shadowVariants: warmShadows,
    ...options
  });
  // Select once at startup. Quality changes during walking must never upload a portrait atlas.
  const portraitProfile = quality.resolve(innerWidth);
  const portrait = {
    highResolution:usesPortraitAtlas(quality.deviceClass, portraitProfile.tier),
    anisotropy:renderer.capabilities.getMaxAnisotropy(),
    async preload(mesh) {
      // The regular animation loop starts after the first visible draw. Drive its
      // uploader under the overlay and wait for the GPU fence, including on early entry.
      let frame;
      function pump() {
        modelWarmup.runFrame(true);
        frame = requestAnimationFrame(pump);
      }
      frame = requestAnimationFrame(pump);
      try {
        await prepareAvatar(mesh, {fence:true, late:false, priority:() => -Infinity,
          shadowVariants:() => portraitProfile.shadows, linear:() => expanded && portraitProfile.shadows});
      } finally {
        cancelAnimationFrame(frame);
      }
    }
  };
  const {createPlayer} = await import('./assets/player.js');
  player = await createPlayer(T, R, physics, world.scene, canvas, world.contact, world.plane, world.seats,
    world.cameraObstacles, expanded, prepareAvatar, portrait, portraitProfile.tier);
  if (player.npcSource) await installNpcs(T, R, prepareAvatar, portrait.highResolution, player.npcSource);
  else if (player.state.character.model === 'gjh-tripo-visitor') void firstFrame.then(() => installNpcs(T, R, prepareAvatar, portrait.highResolution));
  const {createDOMProjection} = await import('./assets/dom-projection.js');
  const projection = createDOMProjection(T, canvas);
  const {createTargetGuidance} = await import('./assets/target-guidance.js');
  guidance = createTargetGuidance({canvas, projection});
  const {createShelfFocus} = await import('./assets/shelf-focus.js');
  shelfFocus = createShelfFocus({T, canvas, normalCamera: player.camera, getFramingFov: () => player.chaseFov, shelves: world.shelves, projection,
    onChange: () => { syncMode(); requestRender(); }, onDetails: ui.inspect, onAdd: ui.addToBag,
    onRestore: resized => { if (resized) player.updateCamera(0, true); }});
  ui.setShelfFocus(shelfFocus);
  ui.setRestrooms(world.restrooms);
  interactions = createInteractionRegistry(world.interactables, item => ui.describeInteraction(item));
  ui.setInteractionRegistry(interactions);
  if (player.state.character.physicalProduct) {
    try {
      const {installPhysicalProductControl} = await import('./assets/visitor-v2-product-ui.js');
      productControl=installPhysicalProductControl(player,world,()=>modes.paused(),interactions,ui,()=>{
        updateHUD();
        requestRender();
      });
      const {pickup} = productControl.actions;
      const pickupLabel = document.createElement('span');
      pickupLabel.textContent = pickup.textContent;
      pickup.replaceChildren(icon('pick-up', {size: 16}), pickupLabel);
      mallHud.connectProductActions(productControl.actions);
    } catch { /* Physical product handling is optional. */ }
  }
  if (player.npcSource) {
    try {
      const {installVisitorV2Controls} = await import('./assets/visitor-v2-controls.js');
      installVisitorV2Controls(document.querySelector('#controls-copy'), changes => { player.customize(changes); requestRender(); });
    } catch { /* Appearance controls are optional. */ }
  }
  if (elevator) ui.setElevator(() => {
    const result = rideElevator();
    updateHUD(); requestRender(); return result;
  }, requestFloorRide);
  ui.setSeats(world.seats);
  player.setPaused(() => modes.paused());
  ui.onCart(()=>({...player.state.character.cart,available:ready&&player.state.character.cart.available,seated:player.state.seated,heldProduct:player.state.character.physicalProduct?.id,elevatorTravel:player.state.elevatorTravel,capability:player.cartCapability()}),value=>{
    if(!ready)return false;
    const ok=player.setCart(value);updateHUD();requestRender();return ok;
  });
  ui.onCollect(id=>Boolean(!player.state.seated&&player.state.character.collection.available!==false&&world.productAssets?.cans?.[id.replace('new-moon-','').replace('-front','')]?.status==='loaded'), id=>{
    if(player.state.character.collection.active)return false;
    player.setCart(false);player.clearInput();player.setInput(null);manual=false;
    if(reducedMotion.matches)return true;
    return player.startCollection(world.createCollectProp(id),id);
  });
  ui.onBagChange(value => player.setBagCount(Object.values(value).reduce((total, quantity) => total + quantity, 0)));
  player.teleport(expanded ? 'entry' : 'atrium'); updateHUD();
  window.mallLoader?.complete('models');
  initialized = true;
  new ResizeObserver(resize).observe(canvas);
  // A hidden tab cannot supply a visible first frame. Resume only when visible.
  for (;;) {
    while (document.hidden) await new Promise(resolve => {
      const visible = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', visible); resolve(); } };
      document.addEventListener('visibilitychange', visible);
    });
    if (interrupted) { validateRestoration(); return; }
    const day = new Date().toDateString();
    // Wait for the selected pack before exposing the first 3D frame.
    await mallTheme?.restore();
    if (!document.hidden && day === new Date().toDateString()) break;
  }
  if (interrupted) { validateRestoration(); return; }
  resize();
  ready = true; graphicsStatus = 'available';
  if (window.mallLoader?.snapshot().dismissed) document.getElementById('store-list').dispatchEvent(new Event('pointerdown'));
  ui.show3D(); resize();
  for (let i = 0; i < 5; i++) tick();
  player.updateCamera(0, true);
  render(true);
  if (contextLost || context.isContextLost()) return;
  if (!renderer.info.render.calls) throw new Error('First scene frame unavailable');
  markFirstFrame();
  if (expanded && !window.mallLoader?.snapshot().dismissed) {
    initialPreloadStarted=performance.now();
    window.mallLoader?.prepare('Preparing shop models. You can enter now or browse the directory.');
  }
  window.__sceneReady = true; ui.offerFirstGuide(); resume(); scheduleThemeMidnight();
}
// The directory mounts its controls above without downloading physics, models or a WebGL world.
if (document.body.dataset.entryMode !== 'directory') initialize().catch(error => {
  console.error('3D mall initialization failed:', error);
  fallback('The 3D mall could not load. All stores and verified products remain available in the accessible list below.');
});
window.addEventListener('pagehide', event=>{if(!event.persisted) {
  clearTimeout(themeMidnightTimer);
  cancelEntryPresentation();
  pageEnded = true; elevator?.kit?.dispose(); arrivalChime.dispose(); tierQueue?.cancel(); warmRunner?.stop('pagehide'); mallTheme?.destroy(); npcs?.dispose(); player?.dispose?.(); world?.interiors?.dispose(); modelWarmup?.dispose();
}});
