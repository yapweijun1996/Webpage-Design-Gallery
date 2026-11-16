import {readStandardGamepad,gamepadMotion} from '../../../../assets/onboarding/gamepad.js';
import {createUI} from './assets/ui.js';
import {createGraphicsQuality} from './assets/graphics-quality.js';
import {createModes} from './assets/modes.js';
import {setupOriginalTin} from './assets/original-tin.js';
import {spatial, storeAt} from './assets/spatial.js';
import {expandedLayout} from './assets/expanded-layout.js';
import {createMallAtmosphere} from './assets/mall-atmosphere.js';
const expanded = new URLSearchParams(location.search).get('layout') !== 'classic';
document.body.classList.toggle('is-expanded', expanded);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let ready = false, player, world, physics, renderer, elevator, manual = false, frame = 0, last = 0, accumulator = 0, frames = 0;
let productControl=null,shelfFocus=null,guidance=null,mallTheme=null,brandWallStarted=false,atmosphere=null;
let initialized = false, fatal = false, contextLost = false, interrupted = false, restorePending = false, contextWaiter;
let graphicsStatus = 'initializing', losses = 0, validations = 0;
let renderWidth = 0, renderHeight = 0, viewportWidth = innerWidth, viewportHeight = innerHeight;
const quality = createGraphicsQuality(() => resize());
// Visibility does not imply focus; only an actual focus event clears blur suppression.
let selectedInteraction = null, interactionDistance = Infinity, windowBlurred = false;
function hideGuidance() { guidance?.hide(); shelfFocus?.hideNearby(); ui.clearGuidance(); }
let nearby = null, currentZone = 'atrium';
function clearTransientState(event) {
  hideGuidance();
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
function syncMode(signals = ui.modeSignals()) {
  if (modes.current() === 'shelf' && !signals.shelfOpen) modes.request(modes.layers().at(-2), 'Shelf closed');
  modes.observe({...signals, seated: Boolean(player?.state.seated),
    cartActive: Boolean(player?.state.character?.cart?.active)});
  document.body.dataset.mode = modes.current();
  ui.projectMode(modes.current());
  if (!['explore', 'cart'].includes(modes.current())) hideGuidance();
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
const snapshot = () => Object.freeze({...(player?.state || {}), mode: modes.current(), zone: currentZone, nearby, furnishings: world?.furnishings || null, shell: world?.shell || null,
  illegalCount: modes.illegalCount(), modeHistory: modes.history(), modeLayers: modes.layers(), paused: modes.paused(),
  elevator:elevator?.state||null, amenities: world?.amenities || null,
  theme: mallTheme?.state() || null,
  themeDecorations: world?.scene.children.filter(item=>item.userData.mallThemeDecoration).map(item=>item.userData.mallThemeDecoration) || [],
  productAssets: world?.productAssets || null, shelves: world?.shelves || [], shelf: shelfFocus?.state || null,
  brandPlaqueCount: world?.scene.getObjectByName('Seventeen brand wall plaques')?.geometry.index?.count / 6 || 0,
  interaction: selectedInteraction ? {id: selectedInteraction.id, x: selectedInteraction.x, y: selectedInteraction.y ?? 0, z: selectedInteraction.z, radius: selectedInteraction.radius, distance: interactionDistance} : null,
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
  get ready() { return ready; }, get state() { return snapshot(); },
  get mode() { return modes.current(); },
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
  currentZone = elevator && p.y > elevator.upper / 2 ? 'upper' : storeAt(p.x, p.z, expanded)?.id || 'atrium';
  if(expanded&&currentZone==='upper'&&!brandWallStarted){
    brandWallStarted=true;
    world.ensureBrandWall().then(({records})=>{ui.setBrandStories(records);updateHUD();render();})
      .catch(error=>console.error('Upper deck brand wall could not load:',error));
  }
  nearby = null; selectedInteraction = null; let best = Infinity;
  for (const item of world.interactables) {
    if (elevator && (p.elevatorTravel || Math.abs(p.y - (item.y ?? 0)) > .5)) continue;
    if(item.seat && (p.z-item.seat.z)*item.seat.facing>-.25)continue;
    const distance = Math.hypot(p.x - item.x, p.z - item.z);
    if (distance < item.radius && distance < best) { nearby = item.id; selectedInteraction = item; best = distance; }
  }
  interactionDistance = best;
  productControl?.update(p,nearby);
  shelfFocus?.setNearby(nearby);
  ui.update({zone: currentZone, x: p.x, z: p.z, yaw:p.yaw, nearby, collectionActive:p.character.collection.active||p.productApproaching,isSeated:p.seated,seatPhase:p.seatPhase,seatName:p.seatName,elevatorState:elevator?.expanded?elevator.state:null,elevatorUpper:elevator?.upper});
}
function tick() {
  if (modes.paused() || expanded && windowBlurred) return;
  const p = player.state;
  for (const door of world.doors) {
    const open = !expanded && p.y < 2 && Math.hypot(p.x - door.x, p.z) < 4.8;
    door.open = reducedMotion.matches ? Number(open) : Math.max(0, Math.min(1, door.open + (open ? 1 : -1) * STEP * 3));
    for (const leaf of door.leaves) {
      const x = door.x + leaf.side * (1.16 + door.open * 2.28);
      leaf.group.position.x = x;
      leaf.body.setNextKinematicTranslation({x, y: 1.8, z: .05});
    }
  }
  elevator?.update?.(STEP,player.state); player.update(STEP); physics.step(); player.sync(); player.updateCamera(STEP); updateHUD();
}
function render(force = false) {
  if (ready && !document.hidden && (force || !modes.paused() || modes.current() === 'shelf')) {
    const camera = shelfFocus?.open ? shelfFocus.camera : player.camera;
    camera.updateMatrixWorld();
    const guiding = !windowBlurred && ['explore', 'cart'].includes(modes.current()) && !player.state.character.collection.active;
    const label = ui.updateGuidance(selectedInteraction, interactionDistance, guiding);
    shelfFocus?.update(camera, modes.current() === 'shelf' || !modes.paused(), Boolean(label));
    guidance?.update(selectedInteraction, label, camera, Boolean(label));
    world.updateShopLods(player.state);
    atmosphere?.update(player.state);
    world.updateSigns(camera, canvas);
    const draw=()=>atmosphere.render(camera, expanded && Math.abs(player.state.y) < 5 && quality.state?.tier === 'detailed' && renderWidth >= 1000);
    if (shelfFocus?.open) player.renderShelf(draw);
    else draw();
    frames++;
    if (window.__sceneReady) ui.offerFirstGuide();
  }
}
function animate(now) {
  frame = 0;
  if (!ready || document.hidden) return;
  const pad=readStandardGamepad();
  const consumed=ui.handleGamepad(pad);
  const inspectPressed=Boolean(pad?.buttons[0]?.pressed);
  const focused=document.activeElement===canvas||document.activeElement===document.body;
  if(!manual)player.setGamepadInput(!consumed&&!ui.paused()&&focused?gamepadMotion(pad):null);
  if(inspectPressed&&!previousGamepadInspect&&!consumed&&!ui.paused()&&focused&&nearby){
    player.clearInput();
    if(player.state.seated){player.stand();updateHUD();}else ui.inspect(nearby);
  }
  previousGamepadInspect=inspectPressed;
  const elapsed = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
  if (!manual && !modes.paused()) {
    accumulator += elapsed;
    while (accumulator >= STEP) { tick(); accumulator -= STEP; }
    render();
  } else if (modes.current() === 'shelf') render();
  frame = requestAnimationFrame(animate);
}
function resume() { if (ready && !frame && !document.hidden) { last = performance.now(); accumulator = 0; frame = requestAnimationFrame(animate); } }
function fallback(message, terminal = true) {
  if (terminal) { fatal = true; graphicsStatus = 'failed'; }
  hideGuidance();
  ready = false; window.__sceneFailed = true; window.__sceneReady = false;
  shelfFocus?.close();
  cancelAnimationFrame(frame); frame = 0; modes.interrupt('fallback'); ui.fallback(message);
}
ui.onTeleport(zone => {
  if (!ready || player.state.elevatorTravel || !spatial.arrival(zone)) return false;
  manual = false; player.cancelCollection(); player.setInput(null);
  if (!player.teleport(zone)) return false;
  updateHUD(); render(); canvas.focus({preventScroll: true}); return true;
});
ui.onSeat((sit,id)=>{if(!ready)return;player.clearInput();manual=false;const ok=sit?player.sit(id):player.stand();updateHUD();render();return ok;});
ui.onView(visual => { if (visual) { last = performance.now(); resume(); render(); } else {player?.setCart(false);if(player?.state.seated)player.stand(true);player?.clearInput();player?.cancelCollection();if(player)updateHUD();} });
document.addEventListener('keydown', event => {
  if(event.code==='Escape'&&!modes.paused()){if(player?.state.seated){player.stand();updateHUD();}player?.cancelCollection();}
  if (event.code === 'KeyF' && nearby && !modes.paused() && !event.repeat &&
      !event.altKey && !event.ctrlKey && !event.metaKey &&
      (event.target === canvas || event.target === document.body)) { event.preventDefault(); player.clearInput(); if(player.state.seated){player.stand();updateHUD();}else ui.inspectNearby(nearby); }
});
window.addEventListener('blur', () => { windowBlurred = true; hideGuidance(); shelfFocus?.close(); modes.interrupt('window blur'); });
window.addEventListener('focus', () => { windowBlurred = false; if (ready) { updateHUD(); render(); } });
window.addEventListener('resize', () => { modes.interrupt('viewport resize'); resize(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { mallTheme?.cancel();hideGuidance(); shelfFocus?.close(); modes.interrupt('document hidden'); cancelAnimationFrame(frame); frame = 0; }
  else { if (ready) { updateHUD(); render(); } else validateRestoration(); resume(); }
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); contextLost = true; interrupted = true; restorePending = true; losses++;
  mallTheme?.suspend();
  player?.interruptGraphics(); elevator?.interrupt?.();
  if (!fatal) graphicsStatus = 'lost';
  fallback(fatal ? 'The 3D mall is unavailable. All stores and verified products remain available in list view. Reload the page to retry 3D.' : 'The 3D graphics context was interrupted. All stores and verified products remain available in list view. You can reload to retry, or wait for graphics recovery.', false);
});
canvas.addEventListener('webglcontextrestored', () => {
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
  viewportWidth = innerWidth; viewportHeight = innerHeight;
  if (!width || !height) return;
  const profile = quality.resolve(width);
  if (!contextLost) {
    if (resized || renderer.getPixelRatio() !== profile.pixelRatio || canvas.width !== Math.floor(width * profile.pixelRatio) || canvas.height !== Math.floor(height * profile.pixelRatio)) {
      renderer.setPixelRatio(profile.pixelRatio); renderer.setSize(width, height, false);
    }
    renderer.shadowMap.enabled = profile.shadows;
  }
  if (resized) {
    renderWidth = width; renderHeight = height;
    player.camera.aspect = width / height; player.camera.fov = width < 600 ? 68 : 58; player.camera.updateProjectionMatrix();
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
    window.__sceneFailed = false; window.__sceneReady = true;
    mallTheme?.resume();ui.restored();resume();void mallTheme?.restore();
  } catch {
    fallback('The 3D mall could not recover its graphics. All stores and verified products remain available below. Reload the page to retry 3D.');
  }
}
async function initialize() {
  const context = canvas.getContext('webgl2', {antialias: true, alpha: false, powerPreference: 'high-performance'});
  if (!context) { fallback(expanded?'WebGL is unavailable. The 17-store mall plan and verified products remain in the accessible directory below.':'WebGL is unavailable. Explore all three stores and the verified products in the accessible list below.'); return; }
  const T = await import('./vendor/three.module.min.js');
  await waitForContext(context);
  renderer = new T.WebGLRenderer({canvas, context, antialias: true});
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  let R;
  try { R = (await import('./vendor/rapier.mjs')).default; await R.init(); }
  catch { fallback('The WebAssembly physics engine could not start. Walking is unavailable; all stores and verified products are available in list view.'); return; }
  physics = new R.World({x: 0, y: -24, z: 0}); physics.timestep = STEP;
  const {createWorld} = await import('./assets/world.js'); world = await createWorld(T, R, physics, expanded);
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
  const {createDOMProjection} = await import('./assets/dom-projection.js');
  const projection = createDOMProjection(T, canvas);
  const {createTargetGuidance} = await import('./assets/target-guidance.js');
  guidance = createTargetGuidance({canvas, projection});
  const {createShelfFocus} = await import('./assets/shelf-focus.js');
  shelfFocus = createShelfFocus({T, canvas, normalCamera: player.camera, shelves: world.shelves, projection,
    onChange: () => { syncMode(); render(); }, onDetails: ui.inspect, onAdd: ui.addToBag,
    onRestore: resized => { if (resized) player.updateCamera(0, true); }});
  ui.setShelfFocus(shelfFocus);
  if (elevator) {
    const {installPhysicalProductControl} = await import('./assets/visitor-v2-product-ui.js');
    productControl=installPhysicalProductControl(player,world,()=>modes.paused());
    const {installVisitorV2Controls} = await import('./assets/visitor-v2-controls.js');
    installVisitorV2Controls(document.querySelector('#controls-copy'), changes => { player.customize(changes); render(); });
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
  initialized = true;
  new ResizeObserver(resize).observe(canvas);
  if (interrupted) { validateRestoration(); return; }
  resize();
  ready = true; graphicsStatus = 'available'; ui.show3D(); resize();
  for (let i = 0; i < 5; i++) tick(); render(); window.__sceneReady = true; ui.offerFirstGuide(); resume();
}
initialize().catch(error => {
  console.error('3D mall initialization failed:', error);
  fallback('The 3D mall could not load. All stores and verified products remain available in the accessible list below.');
});
window.addEventListener('pagehide', event=>{if(!event.persisted) mallTheme?.destroy();});
