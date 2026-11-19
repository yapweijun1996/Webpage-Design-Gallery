import {readStandardGamepad,gamepadMotion} from '../../../../assets/onboarding/gamepad.js';
import {createPerformanceMonitor} from './assets/performance-monitor.js';
import {createPerformancePanel} from './assets/performance-panel.js';
import {createFrameTrace} from './assets/frame-trace.js';
import {createUI} from './assets/ui.js';
import {createGraphicsQuality} from './assets/graphics-quality.js';
import {createModes} from './assets/modes.js';
import {setupOriginalTin} from './assets/original-tin.js';
import {spatial, storeAt} from './assets/spatial.js';
import {expandedLayout, expandedStoreAt, expandedStoreArrival} from './assets/expanded-layout.js';
import {createMallAtmosphere} from './assets/mall-atmosphere.js';
import {createArrivalChime} from './assets/elevator-chime.js';
import {createModelWarmup} from './assets/model-warmup.js';
import {createWarmReport, createWarmRunner, createTierQueue, prepareEntryFrame, prepareTier} from './assets/scene-warmup.js';
import {emptyInteriorReport} from './assets/interiors/warmup.js';
import {shouldOpenStoreDoor} from './assets/auto-door.js';
import {createInteractionRegistry} from './assets/interaction-registry.js';
import {createSpatialHud} from './assets/ux-spatial-hud.js';
import {createMallHud} from './assets/hud-coordinator.js';
import {storeDestinations} from './assets/store-destinations.js';
import {icon} from './assets/icons.js';
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
const expanded = new URLSearchParams(location.search).get('layout') !== 'classic';
document.body.classList.toggle('is-expanded', expanded);

const arrivalChime = createArrivalChime();
const skipRide = document.getElementById('skip-lift-ride');
skipRide.addEventListener('click',()=>{player?.skipRide();canvas.focus({preventScroll:true});});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const startupOverlay = document.getElementById('app-loader');
let greetedOnArrival = false, pageEnded = false;
let ready = false, player, world, physics, renderer, elevator, manual = false, frame = 0, last = 0, accumulator = 0, frames = 0;
let three, frameTrace;
let modelWarmup, tierQueue, requestedProfile;
let warmRunner = null, warmKey, warmReport = createWarmReport(), sceneWarmFirst = true, entryPresentation;
let productControl=null,shelfFocus=null,guidance=null,mallTheme=null,brandWallStarted=false,atmosphere=null,npcs=null,spatialHud=null;
let themeMidnightTimer;
let initialized = false, fatal = false, contextLost = false, interrupted = false, restorePending = false, contextWaiter;
let graphicsStatus = 'initializing', losses = 0, validations = 0;
let markFirstFrame;
const firstFrame = new Promise(resolve => { markFirstFrame = resolve; });
let renderWidth = 0, renderHeight = 0, viewportWidth = innerWidth, viewportHeight = innerHeight;
const quality = createGraphicsQuality(() => resize());
// Visibility does not imply focus; only an actual focus event clears blur suppression.
let selectedInteraction = null, interactionDistance = Infinity, windowBlurred = false, interactions;
let lastPreloadUpdate = -Infinity, initialPreloadStarted = null, preloadSettled = !expanded;
function hideGuidance() { guidance?.hide(); shelfFocus?.hideNearby(); ui.clearGuidance(); spatialHud?.suspend(); }
let nearby = null, currentZone = 'atrium';
function clearTransientState(event) {
  quality.resetSampling();
  hideGuidance();
  mallHud.suspend();
  player?.clearInput();
  player?.setInput(null);
  // Overlays suspend the collection/action camera. Real interruptions cancel the
  // transient demo gesture; physical shelf products remain owned by the player.
  const interaction=player?.state;
  if (event.kind === 'interrupt' && (!interaction?.character.physicalProduct?.held || interaction.productApproaching)) player?.cancelCollection();
  manual = false; accumulator = 0; last = performance.now();
}
const modes = createModes({onCleanup: clearTransientState,
  onEnter(mode) { document.body.dataset.mode = mode; }});
const ui = createUI(expanded), canvas = document.querySelector('#scene');
const destinations = storeDestinations(expanded).map(store => ({
  ...store, arrival: expanded ? expandedStoreArrival(store.id) : store.arrival,
}));
const mallHud = createMallHud({destinations, scene: canvas, announce: ui.announce,
  subscribeBag: ui.onBagChange, subscribeInspect: ui.onProductInspect});
const performanceMonitor = createPerformanceMonitor();
performanceMonitor.setEnabled(true);
let measuringFrames = false, lastMetricsUpdate = -Infinity, maxFrameUploadMs = 0;
function performanceReport() {
  return {
    ...performanceMonitor.snapshot(),
    signage: world?.signage?.report() ?? {modelsLoaded:0,signs:0,drawCalls:0,triangles:0,textureMB:0,previousTextureMB:0,atlasPx:0,phoneProof:null,tier:quality.state?.tier??'low'},
    interiors: world?.interiors?.report() ?? emptyInteriorReport(quality.state?.tier ?? 'low'),
    capturedAt: new Date().toISOString(),
    timeOrigin: performance.timeOrigin,
    version: document.querySelector('[data-mall-version]')?.textContent.trim() || null,
    layout: expanded ? 'expanded' : 'classic',
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
const STEP = 1 / 60;
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
    function visit(object) {
      if (!object.visible) return;
      if (object.isMesh && object.geometry) {
        let bounds;
        if (object.isSkinnedMesh) {
          object.computeBoundingBox();
          bounds=object.boundingBox;
        } else {
          if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
          bounds=object.geometry.boundingBox;
        }
        if (bounds && !bounds.isEmpty()) for (const x of [bounds.min.x,bounds.max.x])
          for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
            point.set(x,y,z).applyMatrix4(object.matrixWorld).project(camera);
            if (point.z < -1 || point.z > 1) out.inFront=false;
            const px=rect.left+(point.x+1)*rect.width/2, py=rect.top+(1-point.y)*rect.height/2;
            out.left=Math.min(out.left,px); out.right=Math.max(out.right,px);
            out.top=Math.min(out.top,py); out.bottom=Math.max(out.bottom,py);
          }
      }
      for (const child of object.children) visit(child);
    }
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
  elevator:elevator?.state||null, elevatorModel:elevator?.kit?{tier:elevator.kit.tier,status:elevator.kit.status}:null, amenities: world?.amenities || null,
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
Object.defineProperty(window, '__mall', {value: Object.freeze({
  performanceReport,
  emote(name) {
    if (!canPlayEmote()) return false;
    greetOnArrival();
    return player.emote(name);
  },
  get ready() { return ready; }, get state() { return snapshot(); },
  get mode() { return modes.current(); },
  get camera() { return player ? Object.freeze(player.cameraState(shelfFocus?.open)) : null; },
  heroVisibility(number) { return heroVisibility(number); },
  teleport(zone) { if (!ready || !player.teleport(zone)) return false; updateHUD(); render(); return true; },
  setInput(input) {
    if (!ready || modes.paused()) return;
    manual = input !== null;
    const clean = input === null ? null : {forward: Math.max(-1, Math.min(1, Number(input.forward) || 0)), right: Math.max(-1, Math.min(1, Number(input.right) || 0)), run: Boolean(input.run)};
    if (clean && Number.isFinite(input.yaw)) clean.yaw = input.yaw;
    if (clean && Number.isFinite(input.pitch)) clean.pitch = input.pitch;
    player.setInput(clean);
  },
  step(ms) {
    if (!ready || !Number.isFinite(ms) || document.hidden || modes.paused()) return snapshot();
    manual = true;
    const count = Math.max(0, Math.min(600, Math.floor(ms / (STEP * 1000))));
    for (let i = 0; i < count; i++) tick();
    render(); return snapshot();
  }
}), writable: false});
function updateHUD() {
  const p = player.state;
  if (skipRide.hidden===p.elevatorTravel) skipRide.hidden=!p.elevatorTravel;
  currentZone = elevator && p.y > elevator.upper / 2 ? 'upper' : (expanded ? expandedStoreAt(p.x,p.z) : storeAt(p.x,p.z))?.id || 'atrium';
  if(expanded&&currentZone==='upper'&&!brandWallStarted){
    brandWallStarted=true;
    world.ensureBrandWall().then(({records})=>{ui.setBrandStories(records);updateHUD();})
      .catch(error=>console.error('Upper deck brand wall could not load:',error));
  }
  const selection = interactions.nearest(p, {travelling: Boolean(p.elevatorTravel), player: p});
  selectedInteraction = selection.item; interactionDistance = selection.distance;
  nearby = selectedInteraction?.id || null;
  productControl?.update(p, nearby);
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
function tick(refreshHud = true) {
  if (modes.paused() || expanded && windowBlurred) return;
  const p = player.state;
  for (const door of world.doors) {
    if (door.advance) { door.advance(p, STEP, reducedMotion.matches); continue; }
    const open = shouldOpenStoreDoor(door, p);
    door.targetOpen = open;
    door.open = reducedMotion.matches ? Number(open) : Math.max(0, Math.min(1, door.open + (open ? 1 : -1) * STEP * 3));
    for (const leaf of door.leaves) {
      const x = door.x + leaf.side * (1.16 + door.open * 2.28);
      leaf.group.position.x = x;
      leaf.body.setNextKinematicTranslation({x, y: 1.8, z: .05});
    }
  }
  elevator?.update?.(STEP,p); player.update(STEP); physics.step(); player.sync();
  if (npcs) {
    const start = frameTrace?.start();
    npcs.update(STEP,player.state,reducedMotion.matches);
    frameTrace?.end('crowd.update', start);
  }
  player.updateCamera(STEP); if (refreshHud) updateHUD();
  greetOnArrival();
}
let lastGuidanceSample = -Infinity, projectedTarget = null;
function render(force = false) {
  if (ready && !document.hidden && (force || !modes.paused() || modes.current() === 'shelf')) {
    if (!shelfFocus?.open) player.refreshCameraMode();
    const camera = shelfFocus?.open ? shelfFocus.camera : player.camera;
    camera.updateMatrixWorld();
    const pose = player.state;
    const matrix = camera.matrixWorld.elements;
    const now = performance.now();
    mallHud.update({position: pose, zone: currentZone, travelling: pose.elevatorTravel,
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
    const detailed = expanded && quality.state?.shadows && renderWidth >= 1000;
    // Retain the direct pass until the Detailed interiors have their linear
    // programs. A downgrade can use the already warmed direct pass immediately.
    const detailedReady = detailed && world.interiors?.activeTier === 'detailed';
    if (expanded) renderer.shadowMap.enabled = detailedReady;
    world.updateShopLods(pose, renderer.shadowMap.enabled, tier);
    atmosphere?.update(pose);
    const signStart = frameTrace?.start();
    world.updateSigns(camera, canvas, reducedMotion);
    frameTrace?.end('signage.update', signStart);
    const draw=()=>{
      world.interiors?.beginFrame();
      try {
        atmosphere.render(camera, detailedReady && Math.abs(pose.y) < 5, npcs);
      } finally { world.interiors?.endFrame(); }
    };
    if (shelfFocus?.open) player.renderShelf(draw); else draw();
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
    tierQueue.cancel();
    world.interiors?.setTier(profile.tier);
    applyProfile(profile);
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
  world.interiors?.runFrame(remaining());
  frameTrace?.end('interiors.install', roomsStart);
  const modelsStart = frameTrace?.start();
  modelWarmup.runFrame(true, remaining());
  frameTrace?.end('models.upload', modelsStart);
  if (runner && !sceneFirst) runner.runFrame(remaining());
  frameTrace?.end('warm.slice', traceStart);
  const elapsed = performance.now() - started;
  maxFrameUploadMs = Math.max(maxFrameUploadMs, elapsed);
  return elapsed;
}
function animate(now) {
  frame = 0;
  if (!ready || document.hidden) return;
  updateModelPreload(now);
  if (advanceStartupWarm()) {
    last = now;
    accumulator = 0;
    frame = requestAnimationFrame(animate);
    return;
  }
  const callbackStart = performance.now();
  const pad=readStandardGamepad();
  const consumed=ui.handleGamepad(pad);
  const inspectPressed=Boolean(pad?.buttons[0]?.pressed);
  const focused=document.activeElement===canvas||document.activeElement===document.body;
  if(!manual)player.setGamepadInput(!consumed&&!ui.paused()&&focused?gamepadMotion(pad):null);
  if(inspectPressed&&!previousGamepadInspect&&!consumed&&!ui.paused()&&focused&&nearby){
    player.clearInput();
    if(player.state.seated){player.stand();updateHUD();}else ui.inspectNearby(nearby);
  }
  previousGamepadInspect=inspectPressed;
  const elapsed = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
  const advancing = !manual && !modes.paused();
  if (advancing || modes.current() === 'shelf') {
    const simulationStart = performance.now();
    let steps = 0;
    if (advancing) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        tick(false);
        accumulator -= STEP;
        steps++;
      }
      // During catch-up the physics still steps at its fixed rate, but only
      // the final HUD state can be presented on this browser frame.
      if (steps) updateHUD();
    }
    // Tier preparation can exercise one real screen pixel. The live scene
    // covers it in this same animation callback, before presentation.
    const simulationEnd = performance.now();
    const uploadMs = warmModels(player.state);
    const renderStart = performance.now();
    const pose = render();
    const renderEnd = performance.now();
    const end = performance.now();
    if (!windowBlurred && startupOverlay.hidden) {
      measuringFrames = true;
      performanceMonitor.frame(now, renderer.info, {
        simulationMs: simulationEnd - simulationStart, renderMs: renderEnd - renderStart, uploadMs,
        callbackMs: end - callbackStart, steps, zone: currentZone, x: pose?.x, z: pose?.z, tier: quality.state?.tier,
        width: canvas.width, height: canvas.height
      });
      if (now - lastMetricsUpdate >= 1000) {
        performancePanel.update(performanceMonitor.snapshot({includeHistory:false}));
        lastMetricsUpdate = now;
      }
    } else pausePerformance();
  } else {
    pausePerformance();
    warmModels(player.state);
  }
  // Record monitor telemetry before a quality change can resize and render.
  const movement = player.state.animation;
  quality.sample(now, advancing && !warmRunner && !tierQueue?.pending && preloadSettled && document.getElementById('app-loader').hidden &&
    !windowBlurred && document.hasFocus() && !contextLost && !interrupted &&
    ['explore','cart'].includes(modes.current()), ['walk','run'].includes(movement));
  frame = requestAnimationFrame(animate);
}
function resume() { if (ready && !frame && !document.hidden) { last = performance.now(); accumulator = 0; frame = requestAnimationFrame(animate); } }
function fallback(message, terminal = true) {
  if (terminal) window.mallLoader?.fail(message);
  if (terminal) { fatal = true; graphicsStatus = 'failed'; cancelEntryPresentation(); world?.interiors?.dispose(); modelWarmup?.dispose(); markFirstFrame(); }
  pausePerformance();
  hideGuidance();
  ready = false; window.__sceneFailed = true; window.__sceneReady = false;
  shelfFocus?.close();
  cancelAnimationFrame(frame); frame = 0; modes.interrupt('fallback'); ui.fallback(message);
}
ui.onTeleport(zone => {
  if (!ready || player.state.elevatorTravel || !(expanded ? expandedStoreArrival(zone) : spatial.arrival(zone))) return false;
  manual = false; player.cancelCollection(); player.setInput(null);
  if (!player.teleport(zone)) return false;
  updateHUD(); render(); canvas.focus({preventScroll: true}); return true;
});
ui.onSeat((sit,id)=>{if(!ready)return;player.clearInput();manual=false;if(sit)npcs?.releaseSeat(id);const ok=sit?player.sit(id):player.stand();updateHUD();render();return ok;});
ui.onView(visual => { if (visual) { last = performance.now(); resume(); render(); } else {player?.setCart(false);if(player?.state.seated)player.stand(true);player?.clearInput();player?.cancelCollection();if(player)updateHUD();} });
document.addEventListener('keydown', event => {
  if(event.code==='Escape'&&!modes.paused()){if(player?.state.seated){player.stand();updateHUD();}player?.cancelCollection();}
  if (event.code === 'KeyF' && nearby && !modes.paused() && !event.repeat &&
      !event.altKey && !event.ctrlKey && !event.metaKey &&
      (event.target === canvas || event.target === document.body)) { event.preventDefault(); player.clearInput(); if(player.state.seated){player.stand();updateHUD();}else ui.inspectNearby(nearby); }
});
window.addEventListener('blur', () => { windowBlurred = true; pausePerformance();hideGuidance(); shelfFocus?.close(); modes.interrupt('window blur'); });
window.addEventListener('focus', () => { windowBlurred = false; if (ready) { updateHUD(); render(); } });
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
  else { if (ready) { refreshCalendarTheme(); updateHUD(); render(); } else validateRestoration(); resume(); }
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
  requestedProfile=quality.resolve(width,true);
  if(!ready || !quality.state || !window.mallLoader?.ready) {
    if(!warmRunner)applyProfile(requestedProfile);
  } else {
    applyProfile(quality.state);
    scheduleTier();
  }
  render();
}
function applyProfile(profile) {
  const width=renderWidth, height=renderHeight;
  quality.apply(profile);
  void elevator?.kit?.select(profile.tier);
  npcs?.setQuality({tier:profile.tier,mobile:width<1000,enabled:new URLSearchParams(location.search).get('npcs')!=='off'});
  if (!contextLost) {
    if (renderer.getPixelRatio() !== profile.pixelRatio || canvas.width !== Math.floor(width * profile.pixelRatio) || canvas.height !== Math.floor(height * profile.pixelRatio)) {
      renderer.setDrawingBufferSize(width,height,profile.pixelRatio);
    }
    renderer.shadowMap.enabled = profile.shadows;
  }
}
function validateRestoration() {
  if (!initialized || fatal || contextLost || restorePending || !interrupted || ready || document.hidden) return;
  graphicsStatus = 'validating';
  try {
    quality.recover(); world.signage?.recover(); resize();
    const gl = renderer.getContext();
    if (gl.isContextLost()) return;
    try { atmosphere?.restoreEnvironment(); } catch { /* Reflections are optional after recovery. */ }
    world.prepareUpperLevel();
    if (mallTheme && (!world.applyMallTheme(mallTheme.definition()) || (elevator?.applyMallTheme && !elevator.applyMallTheme(mallTheme.definition())))) throw new Error('Theme restoration failed');
    atmosphere?.applyTheme(mallTheme?.definition());
    atmosphere?.update(player.state);
    world.updateShopLods(player.state, renderer.shadowMap.enabled, quality.state?.tier);
    player.camera.updateMatrixWorld(); world.updateSigns(player.camera, canvas, reducedMotion);
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
async function installNpcs(T, R, prepareModel, source) {
  if (pageEnded || fatal) return;
  const enabled = new URLSearchParams(location.search).get('npcs') !== 'off';
  if (!source && !enabled) return;
  try {
    const {createNpcSystem, loadNpcSystem} = await import('./assets/npcs.js');
    const options = {scene:world.scene,seats:world.seats,physics,R,playerCollider:player.capsule,
      playerBody:player.body,expanded,mobile:innerWidth<1000,tier:quality.state?.tier||'balanced',enabled,prepareModel,
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
  const context = canvas.getContext('webgl2', {antialias: true, alpha: false, powerPreference: 'high-performance'});
  if (!context) { fallback(expanded?'WebGL is unavailable. The 17-store mall plan and verified products remain in the accessible directory below.':'WebGL is unavailable. Explore all three stores and the verified products in the accessible list below.'); return; }
  const T = await import('./vendor/three.module.min.js');
  three = T;
  await waitForContext(context);
  renderer = new T.WebGLRenderer({canvas, context, antialias: true});
  if (new URLSearchParams(location.search).get('traceWarm') === '1') frameTrace = createFrameTrace(renderer);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  let R;
  try { R = (await import('./vendor/rapier.mjs')).default; await R.init(); }
  catch { fallback('The WebAssembly physics engine could not start. Walking is unavailable; all stores and verified products are available in list view.'); return; }
  physics = new R.World({x: 0, y: -24, z: 0}); physics.timestep = STEP;
  window.mallLoader?.complete('physics');
  modelWarmup = createModelWarmup(T, renderer);
  tierQueue = createTierQueue(modelWarmup.enqueueSweep);
  const warmModel = (model, scene, options) => modelWarmup.prepare(model, scene, {
    linear: () => expanded && quality.state?.tier === 'detailed' && renderWidth >= 1000, ...options
  });
  const {createWorld} = await import('./assets/world.js'); world = await createWorld(T, R, physics, expanded, warmModel);
  const prepareModel = (model, options) => warmModel(model, world.scene, options);
  const assetRecords = [world.furnishings, world.shell, world.amenities, world.productAssets?.cans]
    .flatMap(group => Object.values(group || {}));
  if (world.productAssets?.shelf) assetRecords.push(world.productAssets.shelf);
  document.getElementById('loader-asset-notice').hidden = !assetRecords.some(record => record?.status === 'fallback');
  window.mallLoader?.complete('scene');
  atmosphere=createMallAtmosphere(T,renderer,world.scene,expanded ? expandedLayout.slots : spatial.stores.map(store=>store.bounds));
  try { if (!contextLost && !context.isContextLost()) atmosphere.restoreEnvironment(); } catch { /* Keep the mall usable without reflections. */ }
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
            try { render(true); } catch(error) { console.error('Theme preview could not render.',error); }
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
        try { if(!world.applyMallTheme(next) || (elevator?.applyMallTheme && !elevator.applyMallTheme(next))) throw new Error('Invalid theme');atmosphere.applyTheme(next);stage?.mount?.(); }
        catch(error) { world.applyMallTheme(previous);elevator?.applyMallTheme?.(previous);atmosphere.applyTheme(previous);throw error; }
      }});
      if(!world.applyMallTheme(mallTheme.definition())) throw new Error('Invalid initial theme');
      atmosphere.applyTheme(mallTheme.definition());
      if(contextLost || interrupted) mallTheme.suspend();
    } catch { mallTheme?.destroy();mallTheme=null; }
    ui.configureMallTheme(mallTheme);
  }
  if (new URLSearchParams(location.search).get('visitor') !== 'v1') {
    const {createElevatorV2} = await import('./assets/elevator-v2.js');
    elevator = createElevatorV2(T, R, physics, world.scene, expanded, prepareModel);
    world.prepareUpperLevel();
    if(mallTheme && elevator.applyMallTheme && !elevator.applyMallTheme(mallTheme.definition())) {mallTheme.destroy();mallTheme=null;ui.configureMallTheme(null);}
    world.interactables.push(...elevator.interactables);
    world.cameraObstacles.push(...(elevator.cameraObstacles||[]));
  }
  const {createPlayer} = await import('./assets/player.js'); player = await createPlayer(T, R, physics, world.scene, canvas, world.contact, world.plane, world.seats,world.cameraObstacles,expanded,prepareModel);
  if (player.npcSource) await installNpcs(T, R, prepareModel, player.npcSource);
  else if (player.state.character.model === 'gjh-tripo-visitor') void firstFrame.then(() => installNpcs(T, R, prepareModel));
  const {createDOMProjection} = await import('./assets/dom-projection.js');
  const projection = createDOMProjection(T, canvas);
  const {createTargetGuidance} = await import('./assets/target-guidance.js');
  guidance = createTargetGuidance({canvas, projection});
  const {createShelfFocus} = await import('./assets/shelf-focus.js');
  shelfFocus = createShelfFocus({T, canvas, normalCamera: player.camera, getFramingFov: () => player.chaseFov, shelves: world.shelves, projection,
    onChange: () => { syncMode(); render(); }, onDetails: ui.inspect, onAdd: ui.addToBag,
    onRestore: resized => { if (resized) player.updateCamera(0, true); }});
  ui.setShelfFocus(shelfFocus);
  interactions = createInteractionRegistry(world.interactables, item => ui.describeInteraction(item));
  ui.setInteractionRegistry(interactions);
  if (player.state.character.physicalProduct) {
    try {
      const {installPhysicalProductControl} = await import('./assets/visitor-v2-product-ui.js');
      productControl=installPhysicalProductControl(player,world,()=>modes.paused(),interactions,ui,()=>{
        updateHUD();
        render();
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
      installVisitorV2Controls(document.querySelector('#controls-copy'), changes => { player.customize(changes); render(); });
    } catch { /* Appearance controls are optional. */ }
  }
  if (elevator) ui.setElevator(() => {
    manual=false; player.setInput(null);
    const ok=player.useElevator(elevator,arrivalChime.play);
    if (ok && player.state.elevatorTravel) arrivalChime.unlock();
    updateHUD(); render(); return ok;
  });
  ui.setSeats(world.seats);
  player.setPaused(() => modes.paused());
  ui.onCart(()=>({...player.state.character.cart,available:ready&&player.state.character.cart.available,seated:player.state.seated,heldProduct:player.state.character.physicalProduct?.id,elevatorTravel:player.state.elevatorTravel,capability:player.cartCapability()}),value=>{
    if(!ready)return false;
    const ok=player.setCart(value);updateHUD();render();return ok;
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
