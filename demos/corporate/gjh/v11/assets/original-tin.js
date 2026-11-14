const MODEL_URL = new URL('./original-demo-food-tin.glb', import.meta.url);
const MODEL_SHA256 = '4b265f78a711d95a80b730ebeaae3906f42c93fbd28f0b8c6e64c8c003eee0ee';
const LOAD_DEADLINE_MS = 8000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function disposeModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(texture => { texture.dispose(); texture.source?.data?.close?.(); });
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

export function setupOriginalTin(ui) {
  const dialog = document.querySelector('#original-tin-dialog');
  const openButton = document.querySelector('#original-tin-open');
  const closeButton = document.querySelector('#original-tin-close');
  const status = document.querySelector('#original-tin-status');
  const opening = document.querySelector('#original-tin-clip');
  const exploding = document.querySelector('#original-tin-explode');
  let canvas = document.querySelector('#original-tin-canvas');
  let current = null, generation = 0, returnFocus = null;
  let last = {status: 'idle', loading: false, loaded: false, error: null, activeResources: 0, renderCount: 0};
  const isCurrent = session => current === session && !session.disposed && dialog.open;
  const announce = (session, message) => { if (isCurrent(session)) status.textContent = message; };

  function snapshot() {
    const s = current;
    if (!s) return Object.freeze({...last, generation, activeResources: 0, liveContexts:0});
    let projectedBounds = null;
    if (s.loaded) {
      s.pivot.updateMatrixWorld(true); s.camera.updateMatrixWorld(true);
      const box = new s.T.Box3().setFromObject(s.model);
      const points = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        points.push(new s.T.Vector3(x,y,z).project(s.camera));
      }
      projectedBounds = Object.freeze({
        minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)),
      });
    }
    return Object.freeze({status: s.status, loading: s.status === 'loading', loaded: s.loaded, error: s.error,
      yaw: s.yaw, pitch: s.pitch, distance: s.distance, zoom: s.zoom, mode: s.mode, clip:s.mode, amount: s.amount,
      renderCount: s.renderCount, frames:s.renderCount, generation: s.generation, canvas: Object.freeze({width:canvas.clientWidth,height:canvas.clientHeight}),
      projectedBounds, activeResources: s.renderer ? 1 : 0, liveContexts:s.renderer?1:0});
  }
  Object.defineProperty(window, '__originalTin', {value: Object.freeze({snapshot, get state() { return snapshot(); }}), configurable: true});

  function release(s) {
    if (!s || s.disposed) return;
    s.disposed = true; clearTimeout(s.timer); s.controller.abort(); s.observer?.disconnect();
    if (s.pointerId !== null && canvas.hasPointerCapture?.(s.pointerId)) canvas.releasePointerCapture(s.pointerId);
    s.mixer?.stopAllAction(); if (s.model) s.mixer?.uncacheRoot(s.model);
    disposeModel(s.model); s.renderer?.dispose(); s.renderer?.forceContextLoss();
    s.renderer = null; s.model = null; s.scene = null; s.pivot = null; s.mixer = null;
  }
  function render(s) {
    if (!isCurrent(s) || !s.renderer || !s.loaded || document.hidden) return;
    s.pivot.rotation.set(s.pitch, s.yaw, 0);
    s.camera.position.set(0, 0, s.distance); s.camera.lookAt(0, 0, 0);
    s.camera.updateMatrixWorld(); s.pivot.updateMatrixWorld(true);
    s.renderer.render(s.scene, s.camera); s.renderCount++;
  }
  function resize(s) {
    if (!isCurrent(s) || !s.renderer) return;
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    s.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    s.renderer.setSize(width, height, false);
    s.camera.aspect = width / height;
    // The envelope sphere encloses both complete forward clips at every orientation.
    const vertical = s.camera.fov * Math.PI / 360;
    const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * s.camera.aspect));
    s.fitDistance = s.radius / Math.sin(halfFov) * 1.12;
    s.distance = s.fitDistance * s.zoom;
    s.camera.near = Math.max(.0001, s.fitDistance - s.radius * 1.5);
    s.camera.far = s.fitDistance * 4 + s.radius * 2;
    s.camera.updateProjectionMatrix(); render(s);
  }
  function applyClip(s, mode, amount) {
    if (!s?.loaded) return;
    s.mixer.stopAllAction();
    s.mode = mode; s.amount = clamp(Number(amount) || 0, 0, 1);
    if (mode !== 'Closed') {
      const action = s.actions[mode];
      action.reset().setLoop(s.T.LoopOnce, 1); action.clampWhenFinished = true;
      action.play(); action.paused = true; action.time = s.amount * 1.5;
    }
    s.mixer.update(0);
    opening.value = mode === 'OpenClose' ? String(s.amount) : '0';
    exploding.value = mode === 'Exploded' ? String(s.amount) : '0';
    render(s);
  }
  function reset() {
    const s = current; if (!s?.loaded) return;
    s.yaw = -.28; s.pitch = .12; s.zoom = 1.15;
    applyClip(s, 'Closed', 0); resize(s);
    announce(s, 'View reset. Original demo tin closed.');
  }
  function orbit(dx, dy) {
    const s = current; if (!s?.loaded) return;
    s.yaw += dx; s.pitch = clamp(s.pitch + dy, -1.2, 1.2); render(s);
  }
  function zoom(delta) {
    const s = current; if (!s?.loaded) return;
    s.zoom = clamp(s.zoom + delta, 1, 2.6); resize(s);
  }
  async function initialize(s) {
    let parsed = null;
    const work = (async () => {
      const [T, {GLTFLoader}] = await Promise.all([import('../vendor/three.module.min.js'), import('../vendor/GLTFLoader.js')]);
      if (!isCurrent(s)) throw Error('cancelled');
      const response = await fetch(MODEL_URL, {signal:s.controller.signal});
      if (!response.ok) throw Error('model unavailable');
      const bytes = await response.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2,'0')).join('');
      if (digest !== MODEL_SHA256) throw Error('model integrity check failed');
      if (!isCurrent(s)) throw Error('cancelled');
      parsed = await new GLTFLoader().parseAsync(bytes, '');
      if (!isCurrent(s)) { disposeModel(parsed.scene); parsed = null; throw Error('cancelled'); }
      return {T, parsed};
    })();
    try {
      const {T, parsed: gltf} = await Promise.race([work, new Promise((_, reject) => {
        s.timer = setTimeout(() => { s.controller.abort(); reject(Error('load deadline exceeded')); }, LOAD_DEADLINE_MS);
      })]);
      clearTimeout(s.timer);
      if (!isCurrent(s)) { disposeModel(gltf.scene); return; }
      s.T = T; s.model = gltf.scene; parsed = null;
      s.scene = new T.Scene(); s.pivot = new T.Group(); s.pivot.add(s.model); s.scene.add(s.pivot);
      s.mixer = new T.AnimationMixer(s.model); s.actions = {};
      for (const name of ['OpenClose','Exploded']) {
        const clip = gltf.animations.find(value => value.name === name);
        if (!clip) throw Error('required original tin animation missing');
        s.actions[name] = s.mixer.clipAction(clip);
      }
      // Measure the native metre geometry with clips sampled through their forward half.
      const envelope = new T.Box3().setFromObject(s.model);
      for (const action of Object.values(s.actions)) {
        action.reset().setLoop(T.LoopOnce,1); action.clampWhenFinished = true; action.play(); action.paused = true;
        for (let step = 0; step <= 30; step++) {
          action.time = step / 20; s.mixer.update(0); s.model.updateMatrixWorld(true);
          envelope.union(new T.Box3().setFromObject(s.model));
        }
        action.stop(); s.mixer.update(0);
      }
      const size = envelope.getSize(new T.Vector3()), center = envelope.getCenter(new T.Vector3());
      s.radius = size.length()/2;
      if (!Number.isFinite(s.radius) || s.radius <= 0 || s.radius > 1) throw Error('invalid original tin scale');
      s.model.position.sub(center);
      s.camera = new T.PerspectiveCamera(35, 1, .001, 10);
      s.renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:true});
      s.renderer.setClearColor(0x000000, 0);
      s.scene.add(new T.HemisphereLight(0xf4f7ff, 0x78806e, 2));
      const key = new T.DirectionalLight(0xfff1d8, 3); key.position.set(1,2,3); s.scene.add(key);
      const fill = new T.DirectionalLight(0xdceaff, 1.8); fill.position.set(-2,1,-2); s.scene.add(fill);
      s.loaded = true; s.status = 'loaded';
      s.observer = new ResizeObserver(() => resize(s)); s.observer.observe(canvas);
      reset();
      announce(s, 'Original demo tin loaded. Drag or use the controls to orbit. This is not New Moon packaging.');
    } catch (error) {
      if (!isCurrent(s)) return;
      s.status = 'error'; s.error = error.message || 'loader failed'; s.loaded = false;
      announce(s, 'Original demo tin unavailable: '+s.error+'. The accessible description remains available.');
      const recorded = snapshot(); release(s); current = null; last = {...recorded, status:'error',loading:false,loaded:false,activeResources:0,liveContexts:0};
    } finally { clearTimeout(s.timer); }
  }
  function open() {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    // A new canvas prevents a deliberately lost old context from poisoning a reopen.
    const replacement = canvas.cloneNode(false); canvas.replaceWith(replacement); canvas = replacement;
    const s = {generation:++generation, controller:new AbortController(), disposed:false, status:'loading',error:null,
      loaded:false, yaw:-.28,pitch:.12,zoom:1.15,distance:0,mode:'Closed',amount:0,renderCount:0,pointerId:null};
    current = s; opening.value = exploding.value = '0';
    dialog.showModal(); ui.setExternalPaused(true); closeButton.focus({preventScroll:true});
    announce(s, 'Loading original demo tin…');
    canvas.addEventListener('pointerdown', event => {
      if (!s.loaded || event.button !== 0) return;
      event.preventDefault(); canvas.focus(); s.pointerId = event.pointerId; canvas.setPointerCapture(event.pointerId);
      s.drag = {x:event.clientX,y:event.clientY,yaw:s.yaw,pitch:s.pitch};
    }, {signal:s.controller.signal});
    canvas.addEventListener('pointermove', event => {
      if (s.pointerId !== event.pointerId || !s.drag) return;
      s.yaw = s.drag.yaw + (event.clientX-s.drag.x)*.01;
      s.pitch = clamp(s.drag.pitch + (event.clientY-s.drag.y)*.01,-1.2,1.2); render(s);
    }, {signal:s.controller.signal});
    for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type, () => {
      s.pointerId = null; s.drag = null;
    }, {signal:s.controller.signal});
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); if (!isCurrent(s)) return;
      announce(s, 'Original demo tin unavailable: graphics context interrupted. Close and reopen to retry. The accessible description remains available.');
      const recorded = snapshot(); release(s); current = null; last = {...recorded,status:'error',error:'context lost',loaded:false,loading:false,activeResources:0,liveContexts:0};
    }, {signal:s.controller.signal});
    initialize(s);
  }
  openButton.hidden = false;
  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const saved = snapshot(); release(current); current = null;
    last = {...saved,status:'closed',loading:false,loaded:false,activeResources:0,liveContexts:0};
    ui.setExternalPaused(false);
    if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({preventScroll:true});
    returnFocus = null;
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); return; }
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll('button,input,canvas[tabindex]')].filter(el => !el.disabled && el.getClientRects().length);
      if (event.shiftKey && (document.activeElement === focusable[0] || !focusable.includes(document.activeElement))) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
      return;
    }
    if (event.target instanceof HTMLInputElement) return;
    const keys = {ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]};
    if (keys[event.key]) { event.preventDefault(); orbit(...keys[event.key]); }
    else if (['+','=','-','_'].includes(event.key)) { event.preventDefault(); zoom(['+','='].includes(event.key)?-.15:.15); }
  });
  dialog.querySelectorAll('[data-tin-orbit]').forEach(button => button.addEventListener('click', () => {
    const directions = {left:[-.2,0],right:[.2,0],up:[0,-.2],down:[0,.2]}; orbit(...directions[button.dataset.tinOrbit]);
  }));
  dialog.querySelectorAll('[data-tin-zoom]').forEach(button => button.addEventListener('click', () => zoom(button.dataset.tinZoom === 'in'?-.15:.15)));
  document.querySelector('#original-tin-reset').addEventListener('click', reset);
  opening.addEventListener('input', () => applyClip(current, 'OpenClose', opening.value));
  exploding.addEventListener('input', () => applyClip(current, 'Exploded', exploding.value));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && current) render(current); });
}
