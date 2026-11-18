import {readStandardGamepad,gamepadMotion} from '../../../../assets/onboarding/gamepad.js';
import {createPerformanceMonitor} from './assets/performance-monitor.js';
import {createPerformancePanel} from './assets/performance-panel.js';
import {createUI} from './assets/ui.js';
import {createGraphicsQuality} from './assets/graphics-quality.js';
import {createModes} from './assets/modes.js';
import {setupOriginalTin} from './assets/original-tin.js';
import {spatial, storeAt} from './assets/spatial.js';
import {expandedLayout, expandedStoreAt, expandedStoreArrival} from './assets/expanded-layout.js';
import {createMallAtmosphere} from './assets/mall-atmosphere.js';
import {createModelWarmup} from './assets/model-warmup.js';
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

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const startupOverlay = document.getElementById('app-loader');
let greetedOnArrival = false, pageEnded = false;
let ready = false, player, world, physics, renderer, elevator, manual = false, frame = 0, last = 0, accumulator = 0, frames = 0;
let three;
let productControl=null,shelfFocus=null,guidance=null,mallTheme=null,brandWallStarted=false,atmosphere=null,npcs=null,spatialHud=null;
let initialized = false, fatal = false, contextLost = false, interrupted = false, restorePending = false, contextWaiter;
let graphicsStatus = 'initializing', losses = 0, validations = 0;
let releaseModelWarmup;
const firstFrame = new Promise(resolve => { releaseModelWarmup = resolve; });
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
let measuringFrames = false, lastMetricsUpdate = -Infinity;
function performanceReport() {
  return {
    ...performanceMonitor.snapshot(),
    capturedAt: new Date().toISOString(),
    timeOrigin: performance.timeOrigin,
    version: document.querySelector('[data-mall-version]')?.textContent.trim() || null,
    layout: expanded ? 'expanded' : 'classic',
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
  elevator:elevator?.state||null, amenities: world?.amenities || null,
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
  seats:world?.seats?.map(({id,name,x,z,exitX,exitZ,facing})=>({id,name,x,z,exitX,exitZ,facing}))||[],
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
let lastProductPresentation = '';
function updateProductPresentation(p) {
  if (!productControl) return;
  const product = p.character.physicalProduct;
  const pickup = interactions.get('pickup', nearby);
  const withinReach = pickup && Math.hypot(p.x - pickup.x, p.z - pickup.z) <= pickup.radius;
  const presentation = [nearby, product.phase, product.id, product.active, p.productApproaching,
    p.seated, p.pushing, p.elevatorTravel, withinReach, modes.paused()].join('/');
  if (presentation !== lastProductPresentation) {
    lastProductPresentation = presentation;
    productControl.update(p, nearby);
  }
}
function updateHUD() {
  const p = player.state;
  currentZone = elevator && p.y > elevator.upper / 2 ? 'upper' : (expanded ? expandedStoreAt(p.x,p.z) : storeAt(p.x,p.z))?.id || 'atrium';
  if(expanded&&currentZone==='upper'&&!brandWallStarted){
    brandWallStarted=true;
    world.ensureBrandWall().then(({records})=>{ui.setBrandStories(records);updateHUD();render();})
      .catch(error=>console.error('Upper deck brand wall could not load:',error));
  }
  const selection = interactions.nearest(p, {travelling: Boolean(p.elevatorTravel), player: p});
  selectedInteraction = selection.item; interactionDistance = selection.distance;
  nearby = selectedInteraction?.id || null;
  updateProductPresentation(p);
  shelfFocus?.setNearby(nearby);
  ui.update({zone: currentZone, x: p.x, z: p.z, yaw:p.yaw, nearby, interaction:selectedInteraction, collectionActive:p.character.collection.active||p.productApproaching,isSeated:p.seated,seatPhase:p.seatPhase,seatName:p.seatName,elevatorState:elevator?.expanded?elevator.state:null,elevatorUpper:elevator?.upper});
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
  elevator?.update?.(STEP,p); player.update(STEP); physics.step(); player.sync(); npcs?.update(STEP,player.state,reducedMotion.matches); player.updateCamera(STEP); if (refreshHud) updateHUD();
  greetOnArrival();
}
let lastGuidanceSample = -Infinity, projectedTarget = null;
function render(force = false) {
  if (ready && !document.hidden && (force || !modes.paused() || modes.current() === 'shelf')) {
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
    world.updateShopLods(pose, renderer.shadowMap.enabled, quality.state?.tier);
    atmosphere?.update(pose);
    world.updateSigns(camera, canvas);
    const draw=()=>atmosphere.render(camera, expanded && Math.abs(pose.y) < 5 && quality.state?.tier === 'detailed' && renderWidth >= 1000, npcs);
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
      initialPreloadStarted=null; window.mallLoader?.complete('frame');
    } else window.mallLoader?.prepare(node.textContent);
  }
}
function animate(now) {
  frame = 0;
  if (!ready || document.hidden) return;
  updateModelPreload(now);
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
    const renderStart = performance.now();
    const pose = render();
    const end = performance.now();
    if (!windowBlurred) {
      measuringFrames = true;
      performanceMonitor.frame(now, renderer.info, {
        simulationMs: renderStart - simulationStart, renderMs: end - renderStart,
        callbackMs: end - callbackStart, steps, zone: currentZone, x: pose?.x, z: pose?.z, tier: quality.state?.tier,
        width: canvas.width, height: canvas.height
      });
      if (now - lastMetricsUpdate >= 1000) {
        performancePanel.update(performanceMonitor.snapshot({includeHistory:false}));
        lastMetricsUpdate = now;
      }
    } else pausePerformance();
  } else pausePerformance();
  // Record monitor telemetry before a quality change can resize and render.
  const movement = player.state.animation;
  quality.sample(now, advancing && preloadSettled && document.getElementById('app-loader').hidden &&
    !windowBlurred && document.hasFocus() && !contextLost && !interrupted &&
    ['explore','cart'].includes(modes.current()), ['walk','run'].includes(movement));
  frame = requestAnimationFrame(animate);
}
function resume() { if (ready && !frame && !document.hidden) { last = performance.now(); accumulator = 0; frame = requestAnimationFrame(animate); } }
function fallback(message, terminal = true) {
  if (terminal) window.mallLoader?.fail(message);
  if (terminal) { fatal = true; graphicsStatus = 'failed'; releaseModelWarmup(); }
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pausePerformance();mallTheme?.cancel();hideGuidance(); shelfFocus?.close(); modes.interrupt('document hidden'); cancelAnimationFrame(frame); frame = 0; }
  else { if (ready) { updateHUD(); render(); } else validateRestoration(); resume(); }
});
canvas.addEventListener('webglcontextlost', event => {
  quality.resetSampling();
  window.mallLoader?.context(true);
  event.preventDefault(); contextLost = true; interrupted = true; restorePending = true; losses++;
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
  const profile = quality.resolve(width);
  npcs?.setQuality({tier:profile.tier,mobile:width<1000,enabled:new URLSearchParams(location.search).get('npcs')!=='off'});
  if (!contextLost) {
    if (resized || renderer.getPixelRatio() !== profile.pixelRatio || canvas.width !== Math.floor(width * profile.pixelRatio) || canvas.height !== Math.floor(height * profile.pixelRatio)) {
      renderer.setPixelRatio(profile.pixelRatio); renderer.setSize(width, height, false);
    }
    renderer.shadowMap.enabled = profile.shadows;
  }
  if (resized) {
    renderWidth = width; renderHeight = height;
    player.resizeCamera(width, height);
    if (shelfFocus?.open) shelfFocus.resize(); else player.updateCamera(0, true);
  }
  render();
}
function validateRestoration() {
  if (!initialized || fatal || contextLost || restorePending || !interrupted || ready || document.hidden) return;
  graphicsStatus = 'validating';
  try {
    quality.recover(); resize();
    const gl = renderer.getContext();
    if (gl.isContextLost()) return;
    try { atmosphere?.restoreEnvironment(); } catch { /* Reflections are optional after recovery. */ }
    if (mallTheme && (!world.applyMallTheme(mallTheme.definition()) || (elevator?.applyMallTheme && !elevator.applyMallTheme(mallTheme.definition())))) throw new Error('Theme restoration failed');
    atmosphere?.applyTheme(mallTheme?.definition());
    atmosphere?.update(player.state);
    world.updateShopLods(player.state, renderer.shadowMap.enabled, quality.state?.tier);
    player.camera.updateMatrixWorld(); world.updateSigns(player.camera, canvas);
    renderer.render(world.scene, player.camera);
    // A real submitted scene and nonempty framebuffer must precede availability.
    // No physics tick or UI transition is needed for this offscreen validation.
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (gl.isContextLost()) return;
    if (gl.getError() !== gl.NO_ERROR || renderer.info.render.calls === 0 || !pixel.slice(0, 3).some(Boolean))
      throw new Error('Restored scene frame unavailable');
    validations++; frames++; ready = true; graphicsStatus = 'available';
    releaseModelWarmup();
    if (initialPreloadStarted === null || window.mallLoader?.snapshot().dismissed) window.mallLoader?.complete('frame');
    window.__sceneFailed = false; window.__sceneReady = true;
    mallTheme?.resume();ui.restored();resume();void mallTheme?.restore();
  } catch {
    fallback('The 3D mall could not recover its graphics. All stores and verified products remain available below. Reload the page to retry 3D.');
  }
}
async function installNpcs(T, R, source) {
  if (pageEnded || fatal) return;
  const enabled = new URLSearchParams(location.search).get('npcs') !== 'off';
  if (!source && !enabled) return;
  try {
    const {createNpcSystem, loadNpcSystem} = await import('./assets/npcs.js');
    const options = {scene:world.scene,seats:world.seats,physics,R,playerCollider:player.capsule,
      playerBody:player.body,expanded,mobile:innerWidth<1000,tier:quality.state?.tier||'balanced',enabled};
    const system = source ? createNpcSystem(T, {...options, source}) : await loadNpcSystem(T, options);
    if (pageEnded || fatal) system.dispose();
    else {
      npcs = system;
      npcs.setQuality({mobile:innerWidth<1000,tier:quality.state?.tier||'balanced'});
      void firstFrame.then(() => {
        if (!pageEnded && !fatal) return system.loadBoy();
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
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  let R;
  try { R = (await import('./vendor/rapier.mjs')).default; await R.init(); }
  catch { fallback('The WebAssembly physics engine could not start. Walking is unavailable; all stores and verified products are available in list view.'); return; }
  physics = new R.World({x: 0, y: -24, z: 0}); physics.timestep = STEP;
  window.mallLoader?.complete('physics');
  const warmModel = createModelWarmup(T, renderer, firstFrame, () => ready && !fatal && !contextLost);
  const {createWorld} = await import('./assets/world.js'); world = await createWorld(T, R, physics, expanded, warmModel);
  const assetRecords = [world.furnishings, world.shell, world.deckRailings, world.amenities, world.productAssets?.cans]
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
          // A single frame shows the committed stage behind settings; the
          // paused scene must not restart its animation loop.
          if(!state.suspended && document.body.classList.contains('is-3d') && document.querySelector('#mall-theme-dialog').open){
            try { render(true); } catch(error) { console.error('Theme preview could not render.',error); }
          }
        }
      },async prepare(theme,{signal}){
        if(theme.id==='everyday')return {value:theme,dispose(){}};
        const definition=Object.hasOwn(packs,theme.id) ? packs[theme.id] : null;
        if(!definition || signal.aborted)throw new Error('Theme unavailable');
        const pack=await loadSeasonalModule(definition);
        if(signal.aborted)throw new Error('Theme preparation cancelled');
        return pack[definition.prepare](T,world.scene,theme,{signal});
      },commit(next,previous,stage){
        try { if(!world.applyMallTheme(next) || (elevator?.applyMallTheme && !elevator.applyMallTheme(next))) throw new Error('Invalid theme');atmosphere.applyTheme(next);stage?.mount?.();render(); }
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
    elevator = createElevatorV2(T, R, physics, world.scene, expanded);
    if(mallTheme && elevator.applyMallTheme && !elevator.applyMallTheme(mallTheme.definition())) {mallTheme.destroy();mallTheme=null;ui.configureMallTheme(null);}
    world.interactables.push(...elevator.interactables);
    world.cameraObstacles.push(...(elevator.cameraObstacles||[]));
  }
  if(mallTheme && !contextLost && !interrupted) await mallTheme.restore();
  const {createPlayer} = await import('./assets/player.js'); player = await createPlayer(T, R, physics, world.scene, canvas, world.contact, world.plane, world.seats,world.cameraObstacles,expanded);
  if (player.npcSource) await installNpcs(T, R, player.npcSource);
  else if (player.state.character.model === 'gjh-tripo-visitor') void firstFrame.then(() => installNpcs(T, R));
  const {createDOMProjection} = await import('./assets/dom-projection.js');
  const projection = createDOMProjection(T, canvas);
  const {createTargetGuidance} = await import('./assets/target-guidance.js');
  guidance = createTargetGuidance({canvas, projection});
  const {createShelfFocus} = await import('./assets/shelf-focus.js');
  shelfFocus = createShelfFocus({T, canvas, normalCamera: player.camera, shelves: world.shelves, projection,
    onChange: () => { syncMode(); render(); }, onDetails: ui.inspect, onAdd: ui.addToBag,
    onRestore: resized => { if (resized) player.updateCamera(0, true); }});
  ui.setShelfFocus(shelfFocus);
  interactions = createInteractionRegistry(world.interactables, item => ui.describeInteraction(item));
  ui.setInteractionRegistry(interactions);
  if (player.state.character.physicalProduct) {
    try {
      const {installPhysicalProductControl} = await import('./assets/visitor-v2-product-ui.js');
      const previousChildren = new Set(document.getElementById('inspect-prompt').children);
      productControl=installPhysicalProductControl(player,world,()=>modes.paused(),interactions);
      mallHud.connectProductActions(previousChildren);
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
    const ok=player.useElevator(elevator); updateHUD(); render(); return ok;
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
  while (document.hidden) await new Promise(resolve => {
    const visible = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', visible); resolve(); } };
    document.addEventListener('visibilitychange', visible);
  });
  if (interrupted) { validateRestoration(); return; }
  resize();
  ready = true; graphicsStatus = 'available';
  if (window.mallLoader?.snapshot().dismissed) document.getElementById('store-list').dispatchEvent(new Event('pointerdown'));
  ui.show3D(); resize();
  for (let i = 0; i < 5; i++) tick();
  render(true);
  if (contextLost || context.isContextLost()) return;
  if (!renderer.info.render.calls) throw new Error('First scene frame unavailable');
  releaseModelWarmup();
  if (expanded && !window.mallLoader?.snapshot().dismissed) {
    initialPreloadStarted=performance.now();
    window.mallLoader?.prepare('Preparing shop models. You can enter now or browse the directory.');
  } else window.mallLoader?.complete('frame');
  window.__sceneReady = true; ui.offerFirstGuide(); resume();
}
// The directory mounts its controls above without downloading physics, models or a WebGL world.
if (document.body.dataset.entryMode !== 'directory') initialize().catch(error => {
  console.error('3D mall initialization failed:', error);
  fallback('The 3D mall could not load. All stores and verified products remain available in the accessible list below.');
});
window.addEventListener('pagehide', event=>{if(!event.persisted) {
  pageEnded = true; mallTheme?.destroy(); npcs?.dispose(); player?.dispose?.();
}});
