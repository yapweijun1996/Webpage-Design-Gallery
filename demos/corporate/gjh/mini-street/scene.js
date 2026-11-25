import * as THREE from "../v11/vendor/three.module.min.js";
import { buildWorld, REFLECTED } from "./world.js";

const LANDMARKS = {
  shop: [-4.71, 2.07, 0.53],
  vending: [-0.89, 2.40, 0.50],
};
const PHONE_MALL_TURN = 0.9;
const DEFAULT_VIEW = { azimuth: 0, elevation: 0, zoom: 1, stop: null };
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 1.24;
const FOCUS_DURATION = 440;
const KEYS = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  "+": "zoom-in", "=": "zoom-in", "-": "zoom-out", Home: "reset",
};

function rain(scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float tail;
      uniform float time;
      varying float opacity;
      void main() {
        vec3 p = position;
        float variation = fract(p.x * 1.6 + p.z * 2.6);
        float y = mod(p.y - time * (4.6 + variation * 1.8), 13.0);
        float streakLength = mix(0.22, 0.63, variation);
        p.y = y + tail * streakLength;
        p.x += (13.0 - p.y) * 0.39;
        float depth = smoothstep(-6.0, 15.0, p.z);
        opacity = mix(mix(0.21, 0.43, depth), 0.02, tail)
          * smoothstep(0.0, 1.2, y) * (1.0 - smoothstep(9.0, 13.0, y));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying float opacity;
      void main() {
        gl_FragColor = vec4(0.75, 0.86, 1.0, opacity);
      }`,
    transparent: true,
    depthWrite: false,
  });

  const coordinates = [];
  const tails = [];
  for (let i = 0; i < 1180; i += 1) {
    const u = (i * 0.61803398875) % 1;
    const v = (i * 0.309173771) % 1;
    const t = (i * 0.41213203) % 1;
    const point = [-23 + 48 * u, 13 * v, -7 + 25 * t];
    coordinates.push(...point, ...point);
    tails.push(0, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(coordinates, 3));
  geometry.setAttribute("tail", new THREE.Float32BufferAttribute(tails, 1));
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  scene.add(lines);
  return lines;
}

function wetRoad(scene) {
  const mirror = new THREE.PerspectiveCamera();
  mirror.layers.set(REFLECTED);
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });
  const projection = new THREE.Matrix4();
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const roadY = 0.015;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      reflection: { value: target.texture },
      mirrorProjection: { value: projection },
      strength: { value: 0.56 },
    },
    vertexShader: `
      uniform mat4 mirrorProjection;
      varying vec4 vMirror;
      varying vec3 vPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPosition = world.xyz;
        vMirror = mirrorProjection * world;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D reflection;
      uniform float strength;
      varying vec4 vMirror;
      varying vec3 vPosition;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(93.7, 187.1))) * 27159.4);
      }
      float noise(vec2 p) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(cell), hash(cell + vec2(1, 0)), f.x),
                   mix(hash(cell + vec2(0, 1)), hash(cell + 1.0), f.x), f.y);
      }
      void main() {
        vec2 uv = vMirror.xy / vMirror.w * 0.5 + 0.5;
        if (vMirror.w < 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
        vec2 p = vPosition.xz;
        float gutter = (1.0 - smoothstep(2.18, 2.66, p.y)) * (1.0 - smoothstep(14.5, 16.0, p.x));
        float pools = smoothstep(0.29, 0.71, noise(p * vec2(1.19, 0.76)) * 0.82 + noise(p * 5.1) * 0.18);
        float ripples = noise(p * vec2(14.0, 37.0)) - 0.5;
        float smear = noise(p * vec2(4.5, 13.4)) - 0.5;
        float facing = 1.0 - abs(normalize(cameraPosition - vPosition).y);
        uv += vec2(ripples * mix(0.003, 0.011, pools) + smear * 0.003, smear * 0.008);
        vec2 spread = vec2(0.002 + 0.0025 * (1.0 - pools), 0.009);
        vec3 color = texture2D(reflection, uv).rgb * 0.46;
        color += texture2D(reflection, uv + spread).rgb * 0.27;
        color += texture2D(reflection, uv - spread).rgb * 0.27;
        float alpha = strength * (0.16 + max(pools, gutter * 0.82) * 0.54 + facing * 0.30);
        alpha *= smoothstep(1.96, 2.15, p.y) * (1.0 - smoothstep(12.0, 24.0, p.y));
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(64, 23.6), material);
  patch.position.set(0, roadY, 13.78);
  patch.rotation.x = -Math.PI / 2;
  scene.add(patch);

  return {
    resize(width, height) {
      const scale = Math.min(0.51, 640 / width, 448 / height);
      target.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    },
    update(renderer, camera, night) {
      material.uniforms.strength.value = night ? 0.79 : 0.29;
      mirror.position.copy(camera.position);
      mirror.position.y = 2 * roadY - camera.position.y;
      camera.getWorldDirection(forward);
      forward.y *= -1;
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      up.y *= -1;
      mirror.up.copy(up);
      mirror.lookAt(forward.add(mirror.position));
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      mirror.updateMatrixWorld();
      projection.multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse);
      renderer.setRenderTarget(target);
      renderer.render(scene, mirror);
      renderer.setRenderTarget(null);
    },
  };
}

export function createStreet({ canvas, stops, activate, fail, startPaused = false }) {
  const attributes = { antialias: true, alpha: false, powerPreference: "low-power" };
  const context = canvas.getContext("webgl2", attributes);
  if (!context) throw new Error("WebGL 2 is unavailable.");
  const renderer = new THREE.WebGLRenderer({ canvas, context, ...attributes });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.15, 150);
  const street = buildWorld(world, invalidate);
  const landmarks = { ...LANDMARKS, mall: street.mallAnchor };
  const stopViews = {
    shop: { target: [-5.25, 1.82, 0.02], width: 4.7, distance: 6.7, closest: 3.25, angle: -0.12, eye: 2.35 },
    vending: { target: [-0.89, 1.29, 0.47], width: 2.25, distance: 4.15, closest: 2.30, angle: 0.08, eye: 1.66 },
    mall: {
      target: [street.mallAnchor[0], 3.27, street.mallAnchor[2] - 1.25],
      width: 9.4, distance: 11.1, closest: 4.5, angle: -0.1, eye: 3.42,
    },
  };
  const rainLines = rain(world);
  const reflection = wetRoad(world);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const portrait = matchMedia("(max-width: 720px)");
  const pick = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const projected = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const pointers = new Map();
  let view = { ...DEFAULT_VIEW };
  let transition;
  let interactive = true;
  let pinchSpan = 0;
  let night = true;
  let paused = startPaused;
  let lost = false;
  let dirty = true;
  let frame = 0;
  let lastPaint = 0;
  let rainTime = 0;
  let width = 1;
  let height = 1;

  function resize() {
    if (!interactive || lost) return;
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
    renderer.setSize(width, height, false);
    reflection.resize(width, height);
    camera.aspect = width / height;
    camera.fov = portrait.matches ? THREE.MathUtils.clamp(53 - camera.aspect * 9, 43, 50) : 43;
    if (portrait.matches) view.azimuth = Math.min(view.azimuth, PHONE_MALL_TURN);
    camera.updateProjectionMatrix();
    invalidate();
  }

  function placeStops() {
    if (portrait.matches) return;
    const positions = stops.map((element) => {
      const stop = element.dataset.stop;
      projected.set(...landmarks[stop]).project(camera);
      const half = element.offsetWidth / 2 + 10;
      const lift = stop === "mall" ? 8 : 29;
      return {
        element,
        x: THREE.MathUtils.clamp((projected.x + 1) * width / 2, half, width - half),
        y: THREE.MathUtils.clamp((1 - projected.y) * height / 2 - lift, 108, height - 39),
        half,
      };
    });
    for (let i = 0; i < positions.length; i += 1) {
      const position = positions[i];
      for (const previous of positions.slice(0, i)) {
        if (Math.abs(position.x - previous.x) < position.half + previous.half && Math.abs(position.y - previous.y) < 59) {
          position.y = previous.y > height - 105 ? previous.y - 59 : previous.y + 59;
        }
      }
      position.element.style.setProperty("--stop-x", `${position.x}px`);
      position.element.style.setProperty("--stop-y", `${position.y}px`);
    }
  }

  function updateView(now) {
    const narrow = portrait.matches;
    const { clamp, degToRad, lerp, smoothstep } = THREE.MathUtils;
    const { azimuth, elevation, zoom, stop } = view;
    const horizontalSpan = 2 * Math.tan(degToRad(camera.fov / 2)) * camera.aspect;
    let distance;
    let closest;
    let angle;
    let eye;
    if (stop) {
      const focus = stopViews[stop];
      distance = Math.max(focus.distance, focus.width / horizontalSpan);
      closest = focus.closest;
      angle = focus.angle + azimuth * .52;
      eye = focus.eye + elevation;
      cameraTarget.set(...focus.target);
    } else {
      const wideFocus = clamp(3.05 - camera.aspect * 1.65, -0.38, 1.95);
      const mallTurn = narrow ? clamp(azimuth / PHONE_MALL_TURN, 0, 1) : 0;
      const center = narrow
        ? lerp(-4.15, street.mallAnchor[0], mallTurn) + Math.min(0, azimuth) * 10.1
        : wideFocus + azimuth * 7.1;
      // Fit the full arch and approach at the end of the phone's rightward pan.
      const mallDistance = Math.max(16.6, 10.9 / horizontalSpan);
      distance = narrow ? lerp(16.6, mallDistance, mallTurn) : clamp(24.8 / camera.aspect, 16.9, 37);
      closest = narrow ? 6.3 : 5.6;
      angle = (narrow ? -0.50 : -0.63) + azimuth * 0.28;
      eye = 4.73 + elevation;
      cameraTarget.set(center, narrow ? lerp(2.78, 3.40, mallTurn) : 3.00, -0.40);
    }
    distance = zoom < 1 ? distance / zoom : lerp(distance, closest, (zoom - 1) / (MAX_ZOOM - 1));
    camera.position.set(
      cameraTarget.x + Math.sin(angle) * distance,
      Math.max(1.1, eye),
      cameraTarget.z + (stop ? 0 : 0.52) + Math.cos(angle) * distance,
    );

    if (transition) {
      const progress = motion.matches ? 1 : clamp((now - transition.start) / FOCUS_DURATION, 0, 1);
      const blend = smoothstep(progress, 0, 1);
      camera.position.lerpVectors(transition.fromPosition, camera.position, blend);
      cameraTarget.lerpVectors(transition.fromTarget, cameraTarget, blend);
      if (progress === 1) finishTransition(true);
    }
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();
    placeStops();
    reflection.update(renderer, camera, night);
  }

  function draw(now) {
    frame = 0;
    if (lost || document.hidden || paused) return;
    const rainMoving = night && !motion.matches;
    const elapsed = now - lastPaint;
    const cameraMoving = transition && (elapsed >= 32 || motion.matches);
    if (dirty || cameraMoving || (rainMoving && elapsed >= 32)) {
      if (rainMoving) rainTime += Math.min(elapsed, 60) / 1000;
      rainLines.visible = night;
      rainLines.material.uniforms.time.value = motion.matches ? 0 : rainTime;
      if (dirty || cameraMoving) updateView(now);
      renderer.render(world, camera);
      lastPaint = now;
      dirty = false;
    }
    if (rainMoving || transition) frame = requestAnimationFrame(draw);
  }

  function invalidate() {
    dirty = true;
    if (!frame && !paused && !lost && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function finishTransition(completed) {
    const pending = transition;
    transition = undefined;
    pending?.resolve(completed);
  }

  function setView(next, animate) {
    finishTransition(false);
    view = { ...next, azimuth: Math.min(next.azimuth, portrait.matches ? PHONE_MALL_TURN : 1.15) };
    invalidate();
    if (!animate || paused || lost || document.hidden || motion.matches) return Promise.resolve(!lost);
    return new Promise((resolve) => {
      transition = {
        start: performance.now(),
        fromPosition: camera.position.clone(),
        fromTarget: cameraTarget.clone(),
        resolve,
      };
    });
  }

  function focusStop(name) {
    if (!interactive || paused || lost || !Object.hasOwn(stopViews, name)) return Promise.resolve(false);
    return setView({ ...DEFAULT_VIEW, stop: name }, true);
  }

  function turn(horizontal, vertical = 0) {
    view.azimuth = THREE.MathUtils.clamp(view.azimuth + horizontal, -0.83, portrait.matches ? PHONE_MALL_TURN : 1.15);
    view.elevation = THREE.MathUtils.clamp(view.elevation + vertical, -2.0, 2.85);
    invalidate();
  }

  function zoomBy(factor) {
    const zoom = THREE.MathUtils.clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (zoom === view.zoom) return;
    view.zoom = zoom;
    invalidate();
  }

  function look(direction) {
    if (!interactive || paused || lost) return;
    switch (direction) {
      case "reset": setView(DEFAULT_VIEW, true); break;
      case "left": turn(-0.30); break;
      case "right": turn(0.30); break;
      case "up": turn(0, 0.40); break;
      case "down": turn(0, -0.40); break;
      case "zoom-in": zoomBy(ZOOM_STEP); break;
      case "zoom-out": zoomBy(1 / ZOOM_STEP); break;
    }
  }

  function select(event) {
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) return;
    cursor.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    pick.setFromCamera(cursor, camera);
    const [hit] = pick.intersectObjects(street.hitTargets);
    if (!hit) return;
    const name = hit.object.name;
    if (name === "shop" || (!transition && view.stop === name)) activate(name);
    else focusStop(name);
  }

  function clearPointers() {
    const ids = [...pointers.keys()];
    pointers.clear();
    pinchSpan = 0;
    delete canvas.dataset.dragging;
    for (const id of ids) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
  }

  function pinchDistance() {
    const [first, second] = pointers.values();
    return Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
  }

  function end(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    pinchSpan = 0;
    if (!pointers.size) delete canvas.dataset.dragging;
    if (!pointer.dragging && event.type === "pointerup") select(event);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!interactive || paused || lost || event.button !== 0 || pointers.size >= 2) return;
    if (pointers.size && (event.pointerType !== "touch" || pointers.values().next().value.type !== "touch")) return;
    const pointer = { x: event.clientX, y: event.clientY, dragging: false, type: event.pointerType };
    pointers.set(event.pointerId, pointer);
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      for (const active of pointers.values()) active.dragging = true;
      pinchSpan = pinchDistance();
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.hypot(dx, dy) < 5) return;
    pointer.dragging = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    canvas.dataset.dragging = "";
    if (pinchSpan) {
      const span = pinchDistance();
      zoomBy(span / pinchSpan);
      pinchSpan = span;
    } else {
      turn(-dx * 0.0043, dy * 0.015);
    }
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, end);
  }

  canvas.addEventListener("wheel", (event) => {
    if (!interactive || paused || lost || event.ctrlKey || event.metaKey || event.altKey) return;
    const mode = event.deltaMode;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const signaledDelta = horizontal ? (event.shiftKey ? event.deltaX : 0) : event.deltaY;
    if (!signaledDelta) return;
    event.preventDefault();
    const unit = mode === 1 ? 16 : mode === 2 ? height : 1;
    const delta = THREE.MathUtils.clamp(signaledDelta * unit, -220, 220);
    zoomBy(Math.exp(-delta * 0.002));
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    if (!interactive || paused || lost || event.altKey || event.ctrlKey || event.metaKey || !Object.hasOwn(KEYS, event.key)) return;
    event.preventDefault();
    look(KEYS[event.key]);
  });

  function visibilityChanged() {
    if (document.hidden) {
      clearPointers();
      finishTransition(true);
    }
    invalidate();
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    clearPointers();
    finishTransition(false);
    observer.disconnect();
    document.removeEventListener("visibilitychange", visibilityChanged);
    motion.removeEventListener("change", invalidate);
    fail();
  });
  document.addEventListener("visibilitychange", visibilityChanged);
  motion.addEventListener("change", invalidate);

  street.setNight(true);
  resize();
  cancelAnimationFrame(frame);
  draw(performance.now());
  if (lost) throw new Error("The WebGL context was lost during startup.");

  return {
    canvas,
    renderer,
    focusStop,
    getCameraState: () => ({ ...view }),
    restoreCameraState: (state, { animate = false } = {}) => setView(state, animate),
    setInteractive(value) {
      if (interactive === value) return;
      interactive = value;
      if (interactive) {
        resize();
      } else {
        clearPointers();
        finishTransition(false);
      }
    },
    setPaused(value) {
      paused = value;
      if (paused) {
        clearPointers();
        finishTransition(false);
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        invalidate();
      }
    },
    setNight(value) {
      night = value;
      street.setNight(night);
      invalidate();
    },
    look,
  };
}
