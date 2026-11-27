// Commerce hub miniature scene for the home hero. Loaded on demand by components/hero-3d.js.
// Scene composition (layout.js, scene.js) and the seven GLB modules come from the Blender 3D Gallery
// "commerce-hub" demo; this file adds only the stage, lights and a drag-to-turn camera.
import * as THREE from '../../vendor/three/three.module.min.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { RoomEnvironment } from '../../vendor/three/RoomEnvironment.js';
import { FRAME, placements, VIEW_ELEVATION, VIEW_YAW } from './layout.js';
import { animateParts, composeModules, createLinks, disposeTree } from './scene.js';

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
  let frame = 0;
  let drawn = 0;
  let onScreen = true;
  let started = 0;
  let resizeObserver;
  let viewObserver;
  let environment;
  let light;
  let controls;

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    renderer.setAnimationLoop(null);
    resizeObserver?.disconnect();
    viewObserver?.disconnect();
    controls?.dispose();
    disposeTree(scene);
    environment?.dispose();
    light?.shadow.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
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
    const models = new Map();
    await Promise.all(places.map(async ({ id }) => {
      const response = await fetch(`${base}${id}.glb`, { signal });
      if (!response.ok) throw new Error(`Commerce module ${id}: ${response.status}`);
      const gltf = await loader.parseAsync(await response.arrayBuffer(), '');
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

    const fit = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const half = Math.max(FRAME.height / 2, FRAME.width / 2 / aspect) / FRAME.pixelsPerUnit;
      Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
      controls.target.set(0, 0, 0);
      camera.position.copy(controls.target).addScaledVector(direction, 60);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      draw(performance.now());
    };
    const animating = () => !reduced.matches && onScreen && !document.hidden;
    function draw(now) {
      if (disposed) return;
      animateParts(composed.parts, reduced.matches ? 0 : (now - started) / 1000);
      controls.update();
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
    stage.append(canvas);
    resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(stage);
    fit();
    syncLoop();
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
