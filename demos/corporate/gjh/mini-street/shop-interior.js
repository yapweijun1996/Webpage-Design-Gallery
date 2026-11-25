import { paintedTexture } from "./surfaces.js";
import { buildShopInterior, SHOP_ANCHORS, SHOP_SPAWN } from "./shop-interior-world.js";

const EYE_HEIGHT = 1.64;
const PLAYER_RADIUS = 0.24;
const WALK_SPEED = 1.75;
const LOOK_SPEED = 1.4;
const PICK_DISTANCE = 1.2;
const movementKeys = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown",
  "ArrowLeft", "ArrowRight", "PageUp", "PageDown",
]);

function defaultProduct(THREE, { name }) {
  const label = paintedTexture(256, 128, (ctx, width, height) => {
    ctx.fillStyle = "#254b3d";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#c8b788";
    ctx.fillRect(0, 16, width, 4);
    ctx.fillRect(0, height - 20, width, 4);
    ctx.fillStyle = "#f6e4bd";
    ctx.textAlign = "center";
    ctx.font = "bold 23px Georgia, serif";
    ctx.fillText("NEW MOON", width / 2, 57, 210);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(name, width / 2, 82, 228);
  });
  const model = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xbfb9a9, roughness: 0.34, metalness: 0.42 });
  const wrap = new THREE.MeshStandardMaterial({ map: label, roughness: 0.61 });
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.12, 24, 1, true), wrap);
  can.position.y = 0.062;
  can.rotation.y = Math.PI;
  model.add(can);
  const end = new THREE.CylinderGeometry(0.060, 0.060, 0.006, 24);
  for (const y of [0.003, 0.122]) {
    const cap = new THREE.Mesh(end, metal);
    cap.position.y = y;
    model.add(cap);
  }
  return model;
}

function disposeShopObjects(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    const owned = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of owned) {
      if (material) materials.add(material);
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value?.isTexture) textures.add(value);
    }
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function createControls(root, onExit, onInspect, onLock, signal) {
  const document = root.ownerDocument;
  const group = document.createElement("div");
  group.className = "shop-interior-controls";
  group.tabIndex = -1;
  group.setAttribute("role", "region");
  group.setAttribute("aria-label", "New Moon Shop controls");

  function add(tag, className, label) {
    const element = document.createElement(tag);
    element.className = className;
    if (label) element.textContent = label;
    group.append(element);
    return element;
  }

  const title = add("div", "shop-interior-title", "New Moon Shop");
  const hint = document.createElement("small");
  hint.className = "shop-interior-keyboard-hint";
  hint.textContent = "WASD to walk · Drag or use ← and → to turn";
  title.append(hint);
  const touchHint = document.createElement("small");
  touchHint.className = "shop-interior-touch-hint";
  touchHint.textContent = "Use the stick to walk and drag to look";
  title.append(touchHint);

  const exit = add("button", "shop-interior-exit", "‹ Exit shop");
  exit.type = "button";
  exit.addEventListener("click", onExit, { signal });

  const lock = add("button", "shop-interior-lock", "Capture mouse");
  lock.type = "button";
  lock.hidden = !onLock;
  lock.setAttribute("aria-pressed", "false");
  if (onLock) lock.addEventListener("click", onLock, { signal });

  const inspect = add("button", "shop-interior-inspect", "Walk closer and aim");
  inspect.type = "button";
  inspect.disabled = true;
  inspect.addEventListener("click", onInspect, { signal });

  const reticle = add("span", "shop-interior-reticle");
  reticle.setAttribute("aria-hidden", "true");

  const stick = add("div", "shop-interior-stick");
  stick.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("span");
  stick.append(thumb);
  root.append(group);

  return { group, lock, inspect, reticle, stick, thumb };
}

/**
 * Creates an indoor scene on the host renderer. The host owns renderer sizing and
 * rendering cadence. Product factories supply a fresh, locally owned Object3D
 * with its base at y=0 and face toward +Z. Omit the result to use the default can.
 */
export function createShopInterior({
  THREE, renderer, canvas = renderer.domElement, controlsRoot = canvas.parentElement,
  products = [], createProduct, onProductSelect, onProductFocus, onExitRequest,
}) {
  const document = canvas.ownerDocument;
  const window = document.defaultView;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2c332d);
  const camera = new THREE.PerspectiveCamera(54, 1, 0.045, 20);
  camera.rotation.order = "YXZ";
  scene.add(camera);
  const world = buildShopInterior(THREE, scene, products.length);
  const stock = new Map();
  const hitTargets = [];
  const hitArea = new THREE.BoxGeometry(0.28, 0.26, 0.27);
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  for (const [index, product] of products.slice(0, SHOP_ANCHORS.length).entries()) {
    const anchor = SHOP_ANCHORS[index];
    const group = new THREE.Group();
    group.name = anchor.id;
    group.position.set(...anchor.position);
    group.rotation.y = anchor.rotationY;
    const object = createProduct?.(product, anchor) ?? defaultProduct(THREE, product);
    object.name ||= product.id;
    const hit = new THREE.Mesh(hitArea, hitMaterial);
    hit.position.y = 0.094;
    group.add(object, hit);
    world.room.add(group);
    hitTargets.push(hit);
    stock.set(anchor.id, { product, anchor, object });
    hit.userData.anchorId = anchor.id;
  }
  if (!hitTargets.length) {
    hitArea.dispose();
    hitMaterial.dispose();
  }

  const highlight = new THREE.Mesh(new THREE.RingGeometry(0.079, 0.086, 32),
    new THREE.MeshBasicMaterial({ color: 0xeac782, transparent: true, opacity: 0.9 }));
  highlight.rotation.x = -Math.PI / 2;
  highlight.visible = false;
  world.room.add(highlight);
  world.room.updateMatrixWorld(true);

  const ray = new THREE.Raycaster(undefined, undefined, 0, PICK_DISTANCE);
  const center = new THREE.Vector2();
  const cursor = new THREE.Vector2();
  const keys = new Set();
  let active = false;
  let paused = false;
  let disposed = false;
  let events;
  let controls;
  let focus;
  let lookPointer;
  let walkPointer;
  let useCursor = false;
  let locked = false;
  let unlockedAt = -Infinity;
  let yaw = 0;
  let pitch = 0;
  let walkX = 0;
  let walkY = 0;

  function canWalk(x, z) {
    const wallInset = PLAYER_RADIUS + 0.075;
    if (Math.abs(x) > world.halfWidth - wallInset || Math.abs(z) > world.halfDepth - wallInset) return false;
    return !world.colliders.some(({ left, right, back, front }) => {
      const distanceX = x - THREE.MathUtils.clamp(x, left, right);
      const distanceZ = z - THREE.MathUtils.clamp(z, back, front);
      return distanceX * distanceX + distanceZ * distanceZ < PLAYER_RADIUS * PLAYER_RADIUS;
    });
  }

  function setFocus(next) {
    if (focus === next) return;
    focus = next;
    highlight.visible = Boolean(next);
    if (next) {
      highlight.position.set(...next.anchor.position);
      highlight.position.y += 0.006;
    }
    if (controls) {
      controls.inspect.disabled = !next;
      controls.inspect.textContent = next ? `Inspect ${next.product.name}` : "Walk closer and aim";
      controls.reticle.classList.toggle("shop-interior-reticle--target", Boolean(next));
    }
    onProductFocus?.(next?.product ?? null, next?.anchor ?? null);
  }

  function pick(point = center) {
    if (!hitTargets.length) return undefined;
    camera.updateMatrixWorld();
    ray.setFromCamera(point, camera);
    const hit = ray.intersectObjects(hitTargets, false).find(({ object }) => stock.get(object.userData.anchorId).object.visible);
    if (!hit) return undefined;
    const obstacle = ray.intersectObjects(world.occluders, false)[0];
    return !obstacle || hit.distance < obstacle.distance ? stock.get(hit.object.userData.anchorId) : undefined;
  }

  function select(item) {
    if (active && !paused && item) onProductSelect?.(item.product, item.anchor);
  }

  function look(dx, dy) {
    yaw -= dx;
    pitch = THREE.MathUtils.clamp(pitch - dy, -1.17, 1.17);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  function update(dt) {
    const turn = Number(keys.has("KeyE") || keys.has("ArrowRight")) -
      Number(keys.has("KeyQ") || keys.has("ArrowLeft"));
    const tilt = Number(keys.has("PageDown")) - Number(keys.has("PageUp"));
    if (turn || tilt) {
      useCursor = false;
      look(turn * dt * LOOK_SPEED, tilt * dt * LOOK_SPEED);
    }

    const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) -
      Number(keys.has("KeyS") || keys.has("ArrowDown")) - walkY;
    const strafe = Number(keys.has("KeyD")) - Number(keys.has("KeyA")) + walkX;
    if (forward || strafe) {
      useCursor = false;
      const speed = dt * WALK_SPEED / Math.max(1, Math.hypot(forward, strafe));
      const dx = (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) * speed;
      const dz = (-Math.sin(yaw) * strafe - Math.cos(yaw) * forward) * speed;
      if (canWalk(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
      if (canWalk(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
    }
    setFocus(pick(useCursor && !locked ? cursor : center));
  }

  function resetInput() {
    if (lookPointer && canvas.hasPointerCapture(lookPointer.id)) canvas.releasePointerCapture(lookPointer.id);
    if (walkPointer !== undefined && controls?.stick.hasPointerCapture(walkPointer)) {
      controls.stick.releasePointerCapture(walkPointer);
    }
    lookPointer = undefined;
    walkPointer = undefined;
    keys.clear();
    walkX = 0;
    walkY = 0;
    useCursor = false;
    if (controls) controls.thumb.style.removeProperty("transform");
  }

  function unlock() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function setPaused(value) {
    paused = Boolean(value);
    if (paused) {
      resetInput();
      unlock();
      setFocus(undefined);
    }
    controls?.group.toggleAttribute("data-paused", paused);
  }

  function toCursor(event) {
    const bounds = canvas.getBoundingClientRect();
    cursor.set(2 * (event.clientX - bounds.left) / Math.max(1, bounds.width) - 1,
      1 - 2 * (event.clientY - bounds.top) / Math.max(1, bounds.height));
    return cursor;
  }

  function bindInputs(signal) {
    const on = (target, type, listener) => target.addEventListener(type, listener, { signal });
    on(window, "keydown", (event) => {
      if (paused || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (document.querySelector("dialog[open]") ||
        event.target?.closest?.("input, select, textarea, [contenteditable]")) return;
      const code = event.code;
      if (movementKeys.has(code)) {
        event.preventDefault();
        keys.add(code);
      } else if (code === "Escape" && !event.repeat) {
        event.preventDefault();
        if (locked) unlock();
        else if (window.performance.now() - unlockedAt > 250) onExitRequest?.();
      } else if ((code === "Enter" || code === "Space") && !event.repeat &&
        !event.target?.closest?.("button, a, summary, [role=button]")) {
        event.preventDefault();
        select(pick());
      }
    });
    on(window, "keyup", (event) => keys.delete(event.code));
    on(window, "blur", resetInput);
    on(document, "visibilitychange", () => {
      if (document.hidden) resetInput();
    });
    on(document, "pointerlockchange", () => {
      const previous = locked;
      locked = document.pointerLockElement === canvas;
      if (previous && !locked) unlockedAt = window.performance.now();
      if (locked && paused) unlock();
      controls?.lock.setAttribute("aria-pressed", String(locked));
      if (controls) controls.lock.textContent = locked ? "Release mouse" : "Capture mouse";
      useCursor = false;
      lookPointer = undefined;
    });
    on(document, "mousemove", (event) => {
      if (paused || !locked) return;
      look(event.movementX * 0.0028, event.movementY * 0.0028);
    });

    on(canvas, "pointerdown", (event) => {
      if (paused || event.button !== 0 || lookPointer) return;
      if (locked) {
        select(pick());
        return;
      }
      lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0 };
      canvas.setPointerCapture(event.pointerId);
    });
    on(canvas, "pointermove", (event) => {
      if (paused || locked) return;
      if (lookPointer?.id === event.pointerId) {
        const dx = event.clientX - lookPointer.x;
        const dy = event.clientY - lookPointer.y;
        lookPointer.x = event.clientX;
        lookPointer.y = event.clientY;
        lookPointer.travel += Math.hypot(dx, dy);
        if (lookPointer.travel > 5) {
          useCursor = false;
          const sensitivity = event.pointerType === "mouse" ? 0.0035 : 0.0047;
          look(dx * sensitivity, dy * sensitivity);
        }
      } else if (!lookPointer && event.pointerType === "mouse") {
        useCursor = true;
        toCursor(event);
      }
    });
    on(canvas, "pointerup", (event) => {
      if (lookPointer?.id !== event.pointerId) return;
      const tap = lookPointer.travel <= 5;
      lookPointer = undefined;
      if (tap && !paused) select(pick(toCursor(event)));
    });
    for (const type of ["pointercancel", "lostpointercapture"]) {
      on(canvas, type, (event) => {
        if (lookPointer?.id === event.pointerId) lookPointer = undefined;
      });
    }
    on(canvas, "pointerleave", () => {
      if (!lookPointer) useCursor = false;
    });

    if (!controls) return;
    const { stick, thumb } = controls;
    function steer(event) {
      const bounds = stick.getBoundingClientRect();
      const radius = Math.max(1, bounds.width * 0.31);
      const dx = (event.clientX - bounds.left - bounds.width / 2) / radius;
      const dy = (event.clientY - bounds.top - bounds.height / 2) / radius;
      const stretch = Math.max(1, Math.hypot(dx, dy));
      walkX = dx / stretch;
      walkY = dy / stretch;
      thumb.style.transform = `translate(${walkX * radius}px, ${walkY * radius}px)`;
    }
    on(stick, "pointerdown", (event) => {
      if (paused || walkPointer !== undefined || event.button !== 0) return;
      walkPointer = event.pointerId;
      stick.setPointerCapture(walkPointer);
      steer(event);
    });
    on(stick, "pointermove", (event) => {
      if (event.pointerId === walkPointer) steer(event);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      on(stick, type, (event) => {
        if (event.pointerId !== walkPointer) return;
        walkPointer = undefined;
        walkX = 0;
        walkY = 0;
        thumb.style.removeProperty("transform");
      });
    }
  }

  function resize(width = canvas.clientWidth, height = canvas.clientHeight) {
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.fov = camera.aspect < 0.9 ? 63 : 54;
    camera.updateProjectionMatrix();
  }

  function enter() {
    if (active || disposed) return false;
    active = true;
    paused = false;
    unlockedAt = -Infinity;
    camera.position.set(SHOP_SPAWN.x, EYE_HEIGHT, SHOP_SPAWN.z);
    yaw = SHOP_SPAWN.yaw;
    pitch = SHOP_SPAWN.pitch;
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    resize();
    events = new window.AbortController();
    canvas.setAttribute("data-shop-interior", "");
    if (controlsRoot) {
      const requestLock = typeof canvas.requestPointerLock === "function" ? async () => {
        if (paused) return;
        if (locked) {
          unlock();
          return;
        }
        const session = events;
        try {
          await canvas.requestPointerLock();
          if (session.signal.aborted || paused) unlock();
        } catch {
          controls?.lock.setAttribute("aria-pressed", "false");
        }
      } : undefined;
      controls = createControls(controlsRoot,
        () => onExitRequest?.(), () => select(focus ?? pick()), requestLock, events.signal);
    }
    bindInputs(events.signal);
    controls?.group.focus({ preventScroll: true });
    setFocus(pick());
    return true;
  }

  function exit() {
    if (!active) return;
    active = false;
    resetInput();
    unlock();
    locked = false;
    events.abort();
    controls?.group.remove();
    controls = undefined;
    canvas.removeAttribute("data-shop-interior");
    setFocus(undefined);
  }

  function dispose() {
    if (disposed) return;
    exit();
    disposed = true;
    disposeShopObjects(world.room);
    world.room.removeFromParent();
    stock.clear();
    hitTargets.length = 0;
  }

  function render(deltaSeconds = 0) {
    if (!active || disposed) return false;
    if (!paused) update(THREE.MathUtils.clamp(deltaSeconds, 0, 0.05));
    renderer.render(scene, camera);
    return true;
  }

  return {
    scene, camera, enter, exit, dispose, resize, setPaused, render,
    getProductObject: (anchorId) => stock.get(anchorId)?.object,
  };
}
