// Commerce hub miniature scene for the home hero. Loaded on demand by components/hero-3d.js.
// Scene composition (layout.js, scene.js) and the seven GLB modules come from the Blender 3D Gallery
// "commerce-hub" demo; this file adds only the stage, lights and a drag-to-turn camera.
import * as THREE from '../../vendor/three/three.module.min.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { RoomEnvironment } from '../../vendor/three/RoomEnvironment.js';
import { placements, VIEW_ELEVATION, VIEW_YAW } from './layout.js';
import { animateParts, composeModules, createLinks, disposeTree, pickModule } from './scene.js';

import { createModuleUI } from './modules.js';

const TURN_LIMIT = 0.45;

export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch (error) {
    return false;
  }
}

/** Mounts the scene into `stage`. Resolves with { dispose } after the first frame is drawn. */
export async function mount(stage, { base, signal }) {
  const places = placements();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const yaw = VIEW_YAW * Math.PI / 180;
  const elevation = VIEW_ELEVATION * Math.PI / 180;
  const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  let disposed = false;
  let composed;
  const models = new Map();
  let frame = 0;
  let drawn = 0;
  let onScreen = true;
  let started = 0;
  let resizeObserver;
  let viewObserver;
  let environment;
  let light;
  let controls;
  let ui;
  let tween;
  let selectedModule;

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    renderer.setAnimationLoop(null);
    resizeObserver?.disconnect();
    viewObserver?.disconnect();
    controls?.dispose();
    disposeTree(scene);
    for (const model of models.values()) disposeTree(model);
    models.clear();
    environment?.dispose();
    light?.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    ui?.dispose();
  }
  signal.addEventListener('abort', dispose, { once: true });

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.35;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0xc9b8a0, 0.75));
    light = new THREE.DirectionalLight(0xfff2e0, 2.0);
    light.position.set(-1, 14, 10.5);
    light.castShadow = true;
    light.shadow.mapSize.setScalar(2048);
    Object.assign(light.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
    Object.assign(light.shadow, { radius: 8, intensity: 0.42, bias: -0.0004, normalBias: 0.02 });
    scene.add(light);

    // Only a sideways turn: vertical drags stay with the page so touch scrolling keeps working.
    controls = new OrbitControls(camera, canvas);
    Object.assign(controls, {
      enablePan: false, enableZoom: false, enableDamping: false,
      minAzimuthAngle: yaw - TURN_LIMIT, maxAzimuthAngle: yaw + TURN_LIMIT,
      minPolarAngle: Math.PI / 2 - elevation, maxPolarAngle: Math.PI / 2 - elevation,
    });
    canvas.style.touchAction = 'pan-y';
    camera.position.copy(direction).multiplyScalar(60);

    const loader = new GLTFLoader();
    await Promise.all(places.map(async ({ id }) => {
      const response = await fetch(`${base}${id}.glb`, { signal });
      if (!response.ok) throw new Error(`Commerce module ${id}: ${response.status}`);
      const buffer = await response.arrayBuffer();
      signal.throwIfAborted();
      const gltf = await loader.parseAsync(buffer, '');
      if (disposed || signal.aborted) {
        disposeTree(gltf.scene);
        signal.throwIfAborted();
        return;
      }
      models.set(id, gltf.scene);
    }));
    if (disposed) {
      for (const model of models.values()) disposeTree(model);
      return { dispose };
    }
    composed = composeModules(places, models);
    models.clear();
    const links = createLinks();
    scene.add(composed.root, links.group);
    renderer.shadowMap.needsUpdate = true;
    started = performance.now();

    function clampFocus() {
      const box = composed.bounds.get(selectedModule);
      if (!box) return;
      const points = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z).project(camera));
      const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
      // Keep a 3% inset on each edge, including the complete plinth.
      const scale = Math.min(1, 1.88 / (maxX - minX), 1.88 / (maxY - minY));
      if (scale < 1) {
        camera.zoom *= scale;
        camera.updateProjectionMatrix();
        return clampFocus();
      }
      const dx = minX < -0.94 ? minX + 0.94 : maxX > 0.94 ? maxX - 0.94 : 0;
      const dy = minY < -0.94 ? minY + 0.94 : maxY > 0.94 ? maxY - 0.94 : 0;
      const shift = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
        .multiplyScalar(dx * (camera.right - camera.left) / (2 * camera.zoom));
      shift.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
        dy * (camera.top - camera.bottom) / (2 * camera.zoom));
      camera.position.add(shift);
      controls.target.add(shift);
      camera.updateMatrixWorld();
    }
    const focusModule = (id) => {
      selectedModule = id;
      if (!id) camera.position.copy(controls.target).addScaledVector(direction, 60);
      const place = places.find(item => item.id === id);
      const target = place ? new THREE.Vector3(place.x * 0.35, 0, place.z * 0.35) : new THREE.Vector3();
      tween = { start: performance.now(), from: controls.target.clone(), to: target,
        zoomFrom: camera.zoom, zoomTo: id ? 1.16 : 1 };
      if (reduced.matches) {
        camera.position.add(target.clone().sub(controls.target));
        controls.target.copy(target);
        camera.zoom = tween.zoomTo;
        camera.updateProjectionMatrix();
        tween = null;
      }
      draw(performance.now());
    };
    ui = createModuleUI(stage, places, focusModule, signal);
    // The traced reference frame is narrower than the outer Shop/Delivery plinths.
    // Measure model bounds in the initial camera plane once, including mesh transforms.
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = direction.clone().cross(right);
    const minimum = new THREE.Vector2(Infinity, Infinity);
    const maximum = new THREE.Vector2(-Infinity, -Infinity);
    const corner = new THREE.Vector3();
    composed.root.updateMatrixWorld(true);
    composed.root.traverse(object => {
      const position = object.geometry?.attributes.position;
      if (!position) return;
      for (let i = 0; i < position.count; i += 1) {
        corner.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        const x = corner.dot(right), y = corner.dot(up);
        minimum.x = Math.min(minimum.x, x);
        minimum.y = Math.min(minimum.y, y);
        maximum.x = Math.max(maximum.x, x);
        maximum.y = Math.max(maximum.y, y);
      }
    });
    const fit = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      canvas.style.height = `${height}px`;
      const aspect = width / height;
      // Fit the actual meshes to 94% of the width, with labels above and glass below.
      // The full-card canvas lets the panel overlay the scene without an empty canvas band.
      const labelRoom = ui.layer.querySelector('button').offsetHeight;
      const bottomRoom = Math.max(ui.panel.offsetHeight + 8, height * 0.22);
      const usable = Math.max(1, height - labelRoom - bottomRoom);
      const half = Math.max((maximum.x - minimum.x) / (2 * aspect * 0.94),
        (maximum.y - minimum.y) * height / (2 * usable));
      const centerX = (minimum.x + maximum.x) / 2;
      const centerY = (minimum.y + maximum.y) / 2 - (bottomRoom - labelRoom) * half / height;
      Object.assign(camera, { left: centerX - half * aspect, right: centerX + half * aspect,
        top: centerY + half, bottom: centerY - half });
      camera.position.copy(controls.target).addScaledVector(direction, 60);
      camera.updateProjectionMatrix();
      draw(performance.now());
    };
    const animating = () => !reduced.matches && onScreen && !document.hidden;
    function draw(now) {
      if (disposed) return;
      animateParts(composed.parts, reduced.matches ? 0 : (now - started) / 1000);
      if (tween) {
        const k = Math.min(1, (now - tween.start) / 600), ease = k * k * (3 - 2 * k);
        const target = tween.from.clone().lerp(tween.to, ease);
        camera.position.add(target.clone().sub(controls.target));
        controls.target.copy(target);
        camera.zoom = tween.zoomFrom + (tween.zoomTo - tween.zoomFrom) * ease;
        camera.updateProjectionMatrix();
        if (k === 1) tween = null;
      }
      controls.update();
      camera.updateMatrixWorld();
      clampFocus();
      ui.placeLabels(composed.anchors, camera, canvas.clientHeight);
      // Moving parts cast shadows: refresh the single shadow pass a few times a second, not every frame.
      if (!reduced.matches && ++drawn % 6 === 0) renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
    }
    const invalidate = () => {
      if (disposed || frame || animating()) return;
      frame = requestAnimationFrame((now) => { frame = 0; draw(now); });
    };
    const syncLoop = () => {
      if (disposed) return;
      renderer.setAnimationLoop(animating() ? () => draw(performance.now()) : null);
      invalidate();
    };
    controls.addEventListener('change', invalidate);

    const ray = new THREE.Raycaster();
    let pointer;
    canvas.addEventListener('pointerdown', event => {
      if (event.isPrimary && event.button === 0) pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) pointer.dragged = true;
    }, { signal });
    canvas.addEventListener('pointercancel', () => { pointer = null; }, { signal });
    canvas.addEventListener('pointerup', event => {
      const click = pointer?.id === event.pointerId && !pointer.dragged && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 6;
      pointer = null;
      if (!click) return;
      const box = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, 1 - (event.clientY - box.top) / box.height * 2), camera);
      const id = pickModule(composed, places, ray);
      if (id) ui.select(id);
    }, { signal });
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    if (stage.dataset.label) canvas.setAttribute('aria-label', stage.dataset.label);
    canvas.addEventListener('keydown', (event) => {
      const turn = { ArrowLeft: -0.1, ArrowRight: 0.1 }[event.key];
      if (!turn) return;
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta = Math.min(yaw + TURN_LIMIT, Math.max(yaw - TURN_LIMIT, spherical.theta + turn));
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      controls.update();
      invalidate();
    }, { signal });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      stage.dispatchEvent(new CustomEvent('hero3d:lost'));
    }, { signal });
    document.addEventListener('visibilitychange', syncLoop, { signal });
    reduced.addEventListener('change', syncLoop, { signal });
    viewObserver = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; syncLoop(); });
    viewObserver.observe(stage);
    stage.insertBefore(canvas, ui.layer);
    resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(stage);
    resizeObserver.observe(ui.panel);
    fit();
    syncLoop();
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
