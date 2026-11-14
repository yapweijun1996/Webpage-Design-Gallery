import {createUI} from './assets/ui.js';
import {createModes} from './assets/modes.js';
import {setupOriginalTin} from './assets/original-tin.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let ready = false, player, world, physics, renderer, elevator, manual = false, frame = 0, last = 0, accumulator = 0, frames = 0;
let productControl=null;
let nearby = null, currentZone = 'atrium';
function clearTransientState(event) {
  player?.clearInput();
  player?.setInput(null);
  // Overlays suspend the collection/action camera. Real interruptions cancel the
  // transient demo gesture; physical shelf products remain owned by the player.
  if (event.kind === 'interrupt') player?.cancelCollection();
  manual = false; accumulator = 0; last = performance.now();
}
const modes = createModes({onCleanup: clearTransientState,
  onEnter(mode) { document.body.dataset.mode = mode; }});
const ui = createUI(), canvas = document.querySelector('#scene');
function syncMode(signals = ui.modeSignals()) {
  modes.observe({...signals, seated: Boolean(player?.state.seated),
    cartActive: Boolean(player?.state.character?.cart?.active)});
  document.body.dataset.mode = modes.current();
}
ui.onModeState(syncMode);
setupOriginalTin(ui);
syncMode();
const STEP = 1 / 60;
const snapshot = () => Object.freeze({...(player?.state || {}), mode: modes.current(), zone: currentZone, nearby, furnishings: world?.furnishings || null,
  illegalCount: modes.illegalCount(), modeHistory: modes.history(), modeLayers: modes.layers(), paused: modes.paused(),
  productAssets: world?.productAssets || null,
  seats:world?.seats?.map(({id,name,x,z,exitX,exitZ,facing})=>({id,name,x,z,exitX,exitZ,facing}))||[],
  doors: Object.freeze(Object.fromEntries((world?.doors || []).map(door => [door.zone, door.open]))),
  drawCalls: renderer?.info.render.calls || 0, frames, reducedMotion: reducedMotion.matches,
  roomSigns: Object.freeze((world?.roomSigns || []).map(({zone, mesh, left, right, top, bottom}) => Object.freeze({zone, visible: mesh.visible, left, right, top, bottom}))),
  pixelRatio: renderer?.getPixelRatio() || 1, hidden: document.hidden});
Object.defineProperty(window, '__mall', {value: Object.freeze({
  get ready() { return ready; }, get state() { return snapshot(); },
  get mode() { return modes.current(); },
  teleport(zone) { if (!ready || !player.teleport(zone)) return false; updateHUD(); render(); return true; },
  setInput(input) {
    if (!ready) return;
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
  currentZone = elevator && p.y > elevator.upper / 2 ? 'upper' : p.z < .1 ? (p.x < -5 ? 'newmoon' : p.x > 5 ? 'gogo' : 'mili') : 'atrium';
  nearby = null; let best = Infinity;
  for (const item of world.interactables) {
    if (elevator && (p.elevatorTravel || Math.abs(p.y - (item.y ?? 0)) > .5)) continue;
    if(item.seat && (p.z-item.seat.z)*item.seat.facing>-.25)continue;
    const distance = Math.hypot(p.x - item.x, p.z - item.z);
    if (distance < item.radius && distance < best) { nearby = item.id; best = distance; }
  }
  productControl?.update(p,nearby);
  ui.update({zone: currentZone, x: p.x, z: p.z, nearby, collectionActive:p.character.collection.active,isSeated:p.seated,seatPhase:p.seatPhase,seatName:p.seatName});
}
function tick() {
  if (modes.paused()) return;
  const p = player.state;
  for (const door of world.doors) {
    const open = p.y < 2 && Math.hypot(p.x - door.x, p.z) < 4.8;
    door.open = reducedMotion.matches ? Number(open) : Math.max(0, Math.min(1, door.open + (open ? 1 : -1) * STEP * 3));
    for (const leaf of door.leaves) {
      const x = door.x + leaf.side * (1.16 + door.open * 2.28);
      leaf.group.position.x = x;
      leaf.body.setNextKinematicTranslation({x, y: 1.8, z: .05});
    }
  }
  player.update(STEP); physics.step(); player.sync(); player.updateCamera(STEP); updateHUD();
}
function render() {
  if (ready && !document.hidden && !modes.paused()) {
    player.camera.updateMatrixWorld();
    world.updateSigns(player.camera, canvas); renderer.render(world.scene, player.camera); frames++;
    if (window.__sceneReady) ui.offerFirstGuide();
  }
}
function animate(now) {
  frame = 0;
  if (!ready || document.hidden) return;
  const elapsed = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
  if (!manual && !modes.paused()) {
    accumulator += elapsed;
    while (accumulator >= STEP) { tick(); accumulator -= STEP; }
    render();
  }
  frame = requestAnimationFrame(animate);
}
function resume() { if (ready && !frame && !document.hidden) { last = performance.now(); accumulator = 0; frame = requestAnimationFrame(animate); } }
function fallback(message) {
  ready = false; window.__sceneFailed = true;
  cancelAnimationFrame(frame); frame = 0; modes.interrupt('fallback'); ui.fallback(message);
}
ui.onTeleport(zone => { if (ready) { manual = false; player.cancelCollection(); player.setInput(null); player.teleport(zone); updateHUD(); render(); canvas.focus({preventScroll: true}); } });
ui.onSeat((sit,id)=>{if(!ready)return;player.clearInput();manual=false;const ok=sit?player.sit(id):player.stand();updateHUD();render();return ok;});
ui.onView(visual => { if (visual) { last = performance.now(); resume(); render(); } else {player?.setCart(false);if(player?.state.seated)player.stand(true);player?.clearInput();player?.cancelCollection();if(player)updateHUD();} });
document.addEventListener('keydown', event => {
  if(event.code==='Escape'&&!modes.paused()){if(player?.state.seated){player.stand();updateHUD();}player?.cancelCollection();}
  if (event.code === 'KeyF' && nearby && !modes.paused() && !event.repeat &&
      !event.altKey && !event.ctrlKey && !event.metaKey &&
      (event.target === canvas || event.target === document.body)) { event.preventDefault(); player.clearInput(); if(player.state.seated){player.stand();updateHUD();}else ui.inspect(nearby); }
});
window.addEventListener('blur', () => modes.interrupt('window blur'));
window.addEventListener('resize', () => modes.interrupt('viewport resize'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { modes.interrupt('document hidden'); cancelAnimationFrame(frame); frame = 0; }
  else resume();
});
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback('The 3D graphics context was interrupted. All stores and verified products remain available in list view. Reload to retry.'); });
async function initialize() {
  const context = canvas.getContext('webgl2', {antialias: true, alpha: false, powerPreference: 'high-performance'});
  if (!context) { fallback('WebGL is unavailable. Explore all three stores and the verified products in the accessible list below.'); return; }
  const T = await import('./vendor/three.module.min.js');
  let R;
  try { R = (await import('./vendor/rapier.mjs')).default; await R.init(); }
  catch { fallback('The WebAssembly physics engine could not start. Walking is unavailable; all stores and verified products are available in list view.'); return; }
  physics = new R.World({x: 0, y: -24, z: 0}); physics.timestep = STEP;
  const quality = innerWidth >= 1000 && (navigator.hardwareConcurrency || 2) >= 4 && (navigator.deviceMemory || 4) >= 4;
  renderer = new T.WebGLRenderer({canvas, context, antialias: true});
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = quality; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const {createWorld} = await import('./assets/world.js'); world = await createWorld(T, R, physics, quality);
  if (new URLSearchParams(location.search).get('visitor') !== 'v1') {
    const {createElevatorV2} = await import('./assets/elevator-v2.js');
    elevator = createElevatorV2(T, R, physics, world.scene);
    world.interactables.push(...elevator.interactables);
  }
  const {createPlayer} = await import('./assets/player.js'); player = await createPlayer(T, R, physics, world.scene, canvas, world.contact, world.plane, world.seats);
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
  ui.onCart(()=>({...player.state.character.cart,seated:player.state.seated}),value=>{const ok=player.setCart(value);updateHUD();render();return ok;});
  ui.onCollect(id=>Boolean(!player.state.seated&&player.state.character.collection.available!==false&&world.productAssets?.cans?.[id.replace('new-moon-','').replace('-front','')]?.status==='loaded'), id=>{
    if(player.state.character.collection.active)return false;
    player.setCart(false);player.clearInput();player.setInput(null);manual=false;
    if(reducedMotion.matches)return true;
    return player.startCollection(world.createCollectProp(id),id);
  });
  ui.onBagChange(value => player.setBagCount(Object.values(value).reduce((total, quantity) => total + quantity, 0)));
  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight; if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 600 ? (elevator ? 1.25 : 1.5) : 2)); renderer.setSize(width, height, false);
    player.camera.aspect = width / height; player.camera.fov = width < 600 ? 68 : 58; player.camera.updateProjectionMatrix();
    renderer.shadowMap.enabled = quality && width >= 1000; player.updateCamera(0, true); render();
  }
  ready = true; ui.show3D(); new ResizeObserver(resize).observe(canvas); resize(); player.teleport('atrium'); updateHUD();
  for (let i = 0; i < 5; i++) tick(); render(); window.__sceneReady = true; ui.offerFirstGuide(); resume();
}
initialize().catch(() => fallback('The 3D mall could not load. All stores and verified products remain available in the accessible list below.'));
