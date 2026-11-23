import * as THREE from "../v11/vendor/three.module.min.js";
import { buildWorld, REFLECTED } from "./world.js";

const LANDMARKS = {
  shop: [-5.62, 2.34, 1.05],
  vending: [-0.89, 2.46, 0.50],
  mall: [8.3, 1.76, -0.92],
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
        float y = mod(p.y - time * (4.6 + fract(p.z * 2.6)), 13.0);
        p.x += -(13.0 - y) * 0.12 - tail * 0.026;
        p.y = y + tail * 0.24;
        opacity = mix(0.24, 0.05, tail) * smoothstep(0.0, 1.2, y) * (1.0 - smoothstep(6.0, 13.0, y));
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
      void main() {
        vec2 uv = vMirror.xy / vMirror.w * 0.5 + 0.5;
        if (vMirror.w < 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
        float x = vPosition.x;
        float z = vPosition.z;
        float ripples = sin(z * 47.0 + sin(x * 4.8) * 2.1) + sin(z * 57.1 + x * 8.8);
        float pools = smoothstep(-0.9, 0.9, sin(z * 5.5 + sin(x * 2.6) * 2.1) * sin(x * 4.6 - z * 2.2));
        uv.x += ripples * 0.0033 * (0.6 + pools);
        uv.y += sin(x * 21.0 + z * 12.0) * 0.002;
        vec3 color = texture2D(reflection, uv).rgb * 0.52;
        color += texture2D(reflection, uv + vec2(0.006, 0.002)).rgb * 0.24;
        color += texture2D(reflection, uv - vec2(0.006, 0.002)).rgb * 0.24;
        float alpha = strength * (0.40 + pools * 0.60);
        alpha *= smoothstep(1.98, 2.34, z) * (1.0 - smoothstep(13.0, 24.0, z));
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
      const scale = Math.min(0.55, 720 / width, 560 / height);
      target.setSize(Math.round(width * scale), Math.round(height * scale));
    },
    update(renderer, camera, night) {
      material.uniforms.strength.value = night ? 0.71 : 0.28;
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

export function createStreet({ canvas, stops, activate, fail }) {
  const attributes = { antialias: true, alpha: false, powerPreference: "low-power" };
  const context = canvas.getContext("webgl2", attributes);
  if (!context) throw new Error("WebGL 2 is unavailable.");
  const renderer = new THREE.WebGLRenderer({ canvas, context, ...attributes });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.15, 150);
  const street = buildWorld(world);
  const rainLines = rain(world);
  const reflection = wetRoad(world);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const portrait = matchMedia("(max-width: 720px)");
  const pick = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const projected = new THREE.Vector3();
  let azimuth = 0;
  let elevation = 0;
  let night = true;
  let paused = false;
  let lost = false;
  let dirty = true;
  let frame = 0;
  let lastPaint = 0;
  let rainTime = 0;
  let pointer;
  let width = 1;
  let height = 1;

  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
    renderer.setSize(width, height, false);
    reflection.resize(width, height);
    camera.aspect = width / height;
    camera.fov = portrait.matches ? 42 : 38;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function placeStops() {
    if (portrait.matches) return;
    const positions = stops.map((element) => {
      projected.set(...LANDMARKS[element.dataset.stop]).project(camera);
      const half = element.offsetWidth / 2 + 10;
      return {
        element,
        x: THREE.MathUtils.clamp((projected.x + 1) * width / 2, half, width - half),
        y: THREE.MathUtils.clamp((1 - projected.y) * height / 2 - 29, 108, height - 39),
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

  function updateView() {
    const narrow = portrait.matches;
    const focus = (narrow ? -3.90 : 0.05) + azimuth * (narrow ? 10.1 : 7.1);
    const distance = narrow ? 17.9 : THREE.MathUtils.clamp(31.8 / camera.aspect, 19.5, 34);
    const angle = -0.34 + azimuth * 0.28;
    camera.position.set(focus + Math.sin(angle) * distance, 5.25 + elevation, 0.12 + Math.cos(angle) * distance);
    camera.lookAt(focus, narrow ? 2.72 : 3.02, -0.40);
    camera.updateMatrixWorld();
    placeStops();
    reflection.update(renderer, camera, night);
  }

  function draw(now) {
    frame = 0;
    if (lost || document.hidden || paused) return;
    const moving = night && !motion.matches;
    const elapsed = now - lastPaint;
    if (dirty || (moving && elapsed >= 32)) {
      if (moving) rainTime += Math.min(elapsed, 60) / 1000;
      rainLines.visible = moving;
      rainLines.material.uniforms.time.value = rainTime;
      if (dirty) updateView();
      renderer.render(world, camera);
      lastPaint = now;
      dirty = false;
    }
    if (moving) frame = requestAnimationFrame(draw);
  }

  function invalidate() {
    dirty = true;
    if (!frame && !paused && !lost && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function turn(horizontal, vertical = 0) {
    azimuth = THREE.MathUtils.clamp(azimuth + horizontal, -0.83, 1.15);
    elevation = THREE.MathUtils.clamp(elevation + vertical, -2.0, 2.85);
    invalidate();
  }

  function select(event) {
    const rect = canvas.getBoundingClientRect();
    cursor.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    pick.setFromCamera(cursor, camera);
    const [hit] = pick.intersectObjects(street.hitTargets);
    if (hit) activate(hit.object.name);
  }

  function end(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const wasTap = !pointer.dragging && event.type === "pointerup";
    pointer = undefined;
    delete canvas.dataset.dragging;
    if (wasTap) select(event);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.hypot(dx, dy) < 5) return;
    pointer.dragging = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    canvas.dataset.dragging = "";
    turn(-dx * 0.0043, dy * 0.015);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, end);
  }

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("visibilitychange", invalidate);
    motion.removeEventListener("change", invalidate);
    fail();
  });
  document.addEventListener("visibilitychange", invalidate);
  motion.addEventListener("change", invalidate);

  street.setNight(true);
  resize();
  cancelAnimationFrame(frame);
  draw(performance.now());
  if (lost) throw new Error("The WebGL context was lost during startup.");

  return {
    setPaused(value) {
      paused = value;
      if (paused) {
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
    look(direction) {
      if (direction === "reset") {
        azimuth = 0;
        elevation = 0;
        invalidate();
      } else {
        turn(direction === "left" ? -0.30 : 0.30);
      }
    },
  };
}
