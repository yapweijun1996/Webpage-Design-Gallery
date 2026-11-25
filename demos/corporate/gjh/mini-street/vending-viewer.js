import * as THREE from "../v11/vendor/three.module.min.js";
import { buildVendingModel } from "./vending-model.js";
import { VEND_DURATION } from "./vending-sequence.js";

const HOME_YAW = 0.31;
const HOME_PITCH = 0.13;
const TURN_STEP = Math.PI / 7;
const TILT_STEP = Math.PI / 18;
const DRAG_THRESHOLD = 6;

export function createVendingViewer(preview, { drinks, motion, onFailure }) {
  const viewport = preview.querySelector(".vending-orbit");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  const events = new AbortController();
  const { signal } = events;
  let renderer;
  let model;
  let observer;
  let intersection;
  let inView = true;
  let frame = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 0;
  let disposed = false;
  let pointer;
  let yaw = HOME_YAW;
  let pitch = HOME_PITCH;
  let state;
  let returnView;

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    events.abort();
    observer?.disconnect();
    intersection?.disconnect();
    if (pointer && viewport.hasPointerCapture(pointer.id)) viewport.releasePointerCapture(pointer.id);
    delete viewport.dataset.dragging;
    canvas.remove();

    const resources = new Set([scene.environment]);
    scene.traverse((part) => {
      const { geometry, material } = part;
      if (part.isInstancedMesh) resources.add(part);
      resources.add(geometry);
      if (!material) return;
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.add(value);
      }
    });
    for (const resource of resources) resource?.dispose();
    if (renderer) {
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    }
  }

  function invalidate() {
    if (!frame && !disposed && inView && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (disposed || !inView || document.hidden) return;
    const nextWidth = viewport.clientWidth;
    const nextHeight = viewport.clientHeight;
    if (!nextWidth || !nextHeight) return;
    try {
      const nextRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      if (nextWidth !== width || nextHeight !== height || nextRatio !== pixelRatio) {
        width = nextWidth;
        height = nextHeight;
        pixelRatio = nextRatio;
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }

      if (returnView && !motion.matches) {
        const step = THREE.MathUtils.smoothstep(now - state.startedAt, 0, 410);
        yaw = THREE.MathUtils.lerp(returnView.yaw, HOME_YAW, step);
        pitch = THREE.MathUtils.lerp(returnView.pitch, HOME_PITCH, step);
        if (step === 1) returnView = undefined;
      }
      const distance = Math.max(4.65, 3.35 / camera.aspect);
      const horizontal = Math.cos(pitch) * distance;
      camera.position.set(Math.sin(yaw) * horizontal, 1.17 + Math.sin(pitch) * distance, Math.cos(yaw) * horizontal);
      camera.lookAt(0, 1.17, 0);

      const progress = state?.phase === "dispensing" && !motion.matches
        ? THREE.MathUtils.clamp((now - state.startedAt) / VEND_DURATION, 0, 1)
        : 1;
      model.poseDrop(progress);
      renderer.render(scene, camera);
      if (renderer.getContext().isContextLost()) {
        onFailure();
        return;
      }
      if (progress < 1) invalidate();
    } catch {
      onFailure();
    }
  }

  function turn(horizontal, vertical = 0) {
    returnView = undefined;
    yaw = (yaw + horizontal) % (2 * Math.PI);
    pitch = THREE.MathUtils.clamp(pitch + vertical, -0.12, 0.66);
    invalidate();
  }

  function resetView() {
    returnView = undefined;
    yaw = HOME_YAW;
    pitch = HOME_PITCH;
    invalidate();
  }

  const commands = {
    left: () => turn(-TURN_STEP),
    right: () => turn(TURN_STEP),
    up: () => turn(0, TILT_STEP),
    down: () => turn(0, -TILT_STEP),
    reset: resetView,
  };

  const keys = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Home: "reset" };

  function endDrag(event) {
    if (pointer?.id !== event.pointerId) return;
    pointer = undefined;
    delete viewport.dataset.dragging;
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    model = buildVendingModel(scene, drinks, getComputedStyle(preview));
    viewport.append(canvas);
    canvas.addEventListener("webglcontextlost", onFailure, { signal });

    viewport.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || pointer) return;
      returnView = undefined;
      viewport.setPointerCapture(event.pointerId);
      pointer = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, dragging: false };
    }, { signal });
    viewport.addEventListener("pointermove", (event) => {
      if (pointer?.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.dragging && (pointer.type === "touch" ? Math.abs(dx) : Math.hypot(dx, dy)) < DRAG_THRESHOLD) return;
      pointer.dragging = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      viewport.dataset.dragging = "";
      turn(-dx * 0.009, pointer.type === "touch" ? 0 : dy * 0.007);
    }, { signal });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      viewport.addEventListener(type, endDrag, { signal });
    }
    viewport.addEventListener("keydown", (event) => {
      const command = Object.hasOwn(keys, event.key) ? keys[event.key] : undefined;
      if (!command || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      commands[command]();
    }, { signal });
    for (const button of preview.querySelectorAll("[data-orbit]")) {
      button.addEventListener("click", commands[button.dataset.orbit], { signal });
    }
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(invalidate);
      observer.observe(viewport);
    } else {
      window.addEventListener("resize", invalidate, { signal });
    }
    if (typeof IntersectionObserver === "function") {
      intersection = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) invalidate();
      });
      intersection.observe(viewport);
    }
    document.addEventListener("visibilitychange", invalidate, { signal });

    return {
      dispose,
      setState(next) {
        returnView = undefined;
        if (next.phase === "dispensing" && next.showDropInViewer && !motion.matches && !pointer && Math.cos(yaw) < 0.6) {
          const offset = yaw - HOME_YAW;
          returnView = { yaw: HOME_YAW + Math.atan2(Math.sin(offset), Math.cos(offset)), pitch };
        }
        state = next;
        model.setState(state);
        invalidate();
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
