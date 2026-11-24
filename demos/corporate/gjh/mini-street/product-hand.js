import { GLTFLoader as GalleryGLTFLoader } from "../v11/vendor/GLTFLoader.js";
import { getNewMoonProduct } from "./shop-product-catalog.js";

const HAND = {
  url: new URL("./assets/posable-right-hand.glb", import.meta.url),
  sha256: "4e9a6219f4147f80fbd29cd4c349e1ae1d59d436d81822a0da8247984cb2d4e9",
};
const handYaw = 0.16;
const gripDiameter = 0.0775;
const durations = { reaching: 0.65, lifting: 0.61, returning: 1.03, stowing: 0.40 };
const gripAngles = {
  index: [-0.10, 0.375, 0.861],
  middle: [-0.10, 0.819, 0.459],
  ring: [-0.10, 0.707, 0.159],
  pinky: [-0.10, 0.627, 0.394],
  thumb: [-0.48, 0.056, -0.48],
};

// The offsets follow the distal joints of the CC0 hand in its bind pose.
const nailAreas = {
  index_03_r: [0.018, 0.001, 0.009, 0.006],
  middle_03_r: [0.019, 0, 0.0085, 0.006],
  ring_03_r: [0.020, 0.001, 0.0085, 0.0055],
  pinky_03_r: [0.014, 0, 0.0075, 0.0047],
  thumb_03_r: [0.019, 0.005, 0.010, 0.007],
};

function paintSkin(T, mesh) {
  const { position, normal, skinIndex, skinWeight } = mesh.geometry.attributes;
  const colors = new Float32Array(position.count * 3);
  const color = new T.Color();
  const back = new T.Color(0xb7826d);
  const palm = new T.Color(0xc38a75);
  const flush = new T.Color(0xb76e65);
  const nail = new T.Color(0xd4a09b);
  const nailEdge = new T.Color(0xd5b4a3);
  const point = new T.Vector3();
  const bind = mesh.skeleton.boneInverses.map(matrix => matrix.clone().multiply(mesh.bindMatrix));

  for (let i = 0; i < position.count; i++) {
    let slot = 0;
    for (let j = 1; j < 4; j++) {
      if (skinWeight.getComponent(i, j) > skinWeight.getComponent(i, slot)) slot = j;
    }
    const index = skinIndex.getComponent(i, slot);
    const bone = mesh.skeleton.bones[index];
    const { x, z } = point.fromBufferAttribute(position, i);
    const palmar = T.MathUtils.smoothstep(-normal.getY(i), -0.2, 0.8);
    const mottling = Math.sin(141 * x + 28 * z) * Math.sin(116 * z - 19 * x);
    const wristShade = 1 - T.MathUtils.smoothstep(-z, 0.029, 0.077);
    const palmFold = 1 - T.MathUtils.smoothstep(
      Math.abs(z + 0.081 + 9 * (x - 0.033) ** 2), 0.0007, 0.0032
    );
    const palmCenter = T.MathUtils.smoothstep(x, 0.012, 0.021) *
      (1 - T.MathUtils.smoothstep(x, 0.035, 0.054));
    color.copy(back).lerp(palm, palmar)
      .multiplyScalar(1 + 0.065 * mottling - 0.12 * wristShade - 0.11 * palmar * palmFold * palmCenter);
    point.applyMatrix4(bind[index]);
    if (bone.name !== "hand_r") {
      // Warm fingertips and knuckles, with a soft crease across each joint.
      const joint = 1 - T.MathUtils.smoothstep(Math.abs(point.y - 0.005), 0.001, 0.011);
      const crease = 1 - T.MathUtils.smoothstep(
        Math.abs(point.y - 0.004 - 0.0014 * Math.cos(point.z * 370)), 0.0003, 0.0015
      );
      color.lerp(flush, 0.27 * joint + 0.26 * palmar).multiplyScalar(1 - 0.10 * palmar * crease);
    }

    const area = nailAreas[bone.name];
    if (area) {
      const [centerY, centerZ, length, width] = area;
      const edge = Math.hypot((point.y - centerY) / length, (point.z - centerZ) / width);
      const onNail = (1 - T.MathUtils.smoothstep(edge, 0.71, 1.03)) *
        T.MathUtils.smoothstep(-point.x, 0.0018, 0.0036);
      const freeEdge = T.MathUtils.smoothstep(point.y, centerY + length * 0.46, centerY + length * 0.80);
      color.lerp(nail, 0.87 * onNail).lerp(nailEdge, 0.75 * onNail * freeEdge);
    }
    color.toArray(colors, i * 3);
  }
  mesh.geometry.setAttribute("color", new T.BufferAttribute(colors, 3));

  // A tiny, deterministic pore texture keeps the close-up from looking like plastic.
  const size = 128;
  const pores = new Uint8Array(size * size);
  let seed = 6327;
  for (let i = 0; i < pores.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const tone = seed >>> 24;
    pores[i] = tone < 23 ? 84 + tone : 120 + (tone >>> 3);
  }
  const texture = new T.DataTexture(pores, size, size, T.RedFormat);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  mesh.material.color.set(0xffffff);
  mesh.material.vertexColors = true;
  mesh.material.roughness = 0.57;
  mesh.material.bumpMap = texture;
  mesh.material.bumpScale = 0.00085;
}

function disposeModel(model) {
  const resources = new Set();
  model.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    if (object.skeleton) resources.add(object.skeleton);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.add(value);
      }
    }
  });
  for (const resource of resources) {
    if (resource.isTexture) resource.source.data?.close?.();
    resource.dispose();
  }
}

async function loadPinnedModel(loader, definition, lifetime) {
  const request = new AbortController();
  const stop = () => request.abort();
  lifetime.addEventListener("abort", stop, { once: true });
  if (lifetime.aborted) stop();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(definition.url, { signal: request.signal });
        if (!response.ok) throw new Error("Model unavailable");
        const data = await response.arrayBuffer();
        const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
        const hash = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
        if (hash !== definition.sha256 || request.signal.aborted) throw new Error("Model verification failed");
        const model = (await loader.parseAsync(data, "")).scene;
        if (request.signal.aborted) {
          disposeModel(model);
          throw new Error("Model load expired");
        }
        return model;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          stop();
          reject(new Error("Model load expired"));
        }, 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    lifetime.removeEventListener("abort", stop);
  }
}

function makeHand(T, model) {
  const wrist = model.getObjectByName("hand_r");
  const middle = model.getObjectByName("middle_01_r");
  const offset = new T.Quaternion();
  const flexAxis = new T.Vector3(0, 0, -1);
  const joints = Object.entries(gripAngles).flatMap(([finger, angles], fingerIndex) => angles.map((angle, index) => {
    const bone = model.getObjectByName(`${finger}_0${index + 1}_r`);
    const delay = finger === "thumb" ? 0.16 : 0.23 + fingerIndex * 0.042 + index * 0.023;
    return bone && { bone, bind: bone.quaternion.clone(), angle, delay };
  }));
  if (!wrist?.isBone || !middle?.isBone || joints.some(joint => !joint?.bone.isBone)) {
    throw new Error("Invalid hand rig");
  }

  model.updateMatrixWorld(true);
  const wristPosition = wrist.getWorldPosition(new T.Vector3());
  const forearm = wristPosition.clone().sub(middle.getWorldPosition(new T.Vector3())).normalize();
  const cuff = new T.Mesh(
    new T.CylinderGeometry(0.028, 0.023, 0.043, 24),
    new T.MeshStandardMaterial({ color: 0x232a29, roughness: 0.95 }),
  );
  const sleeve = new T.Mesh(
    new T.CylinderGeometry(0.035, 0.026, 0.25, 24),
    new T.MeshStandardMaterial({ color: 0x333c3a, roughness: 0.94 }),
  );
  for (const [garment, distance] of [[cuff, 0.006], [sleeve, 0.145]]) {
    garment.position.copy(wristPosition).addScaledVector(forearm, distance);
    garment.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), forearm);
  }
  model.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    object.frustumCulled = false;
    paintSkin(T, object);
  });

  const hand = new T.Group();
  hand.name = "Anatomical first-person right hand";
  // The GLB is authored with fingers facing -Z and a reflected source basis.
  // Fit the palm and the curled fingers to the can's 77.5 mm diameter.
  hand.applyMatrix4(new T.Matrix4().set(
    0, 1, 0, -0.00244,
    1, 0, 0, -0.05947,
    0, 0, 1, 0.12626,
    0, 0, 0, 1,
  ));
  hand.add(model, cuff, sleeve);
  const wristMount = new T.Group();
  wristMount.name = hand.name;
  wristMount.add(hand);

  return {
    object: wristMount,
    pose(proportion) {
      for (const { bone, bind, angle, delay } of joints) {
        const curl = T.MathUtils.smoothstep(proportion, delay, 0.93 + delay * 0.15);
        offset.setFromAxisAngle(flexAxis, curl * angle);
        bone.quaternion.copy(bind).multiply(offset);
      }
    },
  };
}

export function createProductHand({
  THREE: T, GLTFLoader = GalleryGLTFLoader, scene, camera, canvas, preview,
  getProductObject, onStateChange, onAddRequested, onInvalidate,
}) {
  const carrier = new T.Group();
  const heldProduct = new T.Group();
  carrier.name = "Mini Street product inspection";
  heldProduct.name = "Held can";
  carrier.add(heldProduct);
  carrier.visible = false;
  scene.add(carrier);

  const axes = { up: new T.Vector3(0, 1, 0), right: new T.Vector3(1, 0, 0) };
  const worldLook = new T.Vector3();
  const eye = new T.Vector3();
  const cameraRotation = new T.Quaternion();
  const viewHeading = new T.Quaternion();
  const viewPose = new T.Quaternion();
  const poseOffset = new T.Quaternion();
  const stockPose = new T.Quaternion();
  const approach = new T.Vector3();
  const aboveStock = new T.Vector3();
  const inspection = new T.Vector3();
  const alongsideStock = new T.Vector3();
  const drop = new T.Vector3();
  const stock = new T.Vector3();
  const start = new T.Vector3();
  const startRotation = new T.Quaternion();
  const startCanRotation = new T.Quaternion();
  const cans = new Map();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lifetime = new AbortController();
  const loader = new GLTFLoader();

  let active = null;
  let phase = "idle";
  let elapsed = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let yaw = 0;
  let pitch = 0;
  let hand = null;
  let handRequest = null;
  let requestingAdd = false;
  let startHandYaw = 0;
  let disposed = false;

  function getState() {
    return {
      phase,
      product: active?.product ?? null,
      modelReady: Boolean(active?.modelReady),
      handVisible: Boolean(active?.modelReady && hand && carrier.visible),
    };
  }

  function transition(next) {
    phase = next;
    elapsed = 0;
    onStateChange?.(getState());
    onInvalidate?.();
  }

  function showShelf(show) {
    if (active.shelfObject) active.shelfObject.visible = show && active.shelfWasVisible;
  }

  function finish() {
    showShelf(true);
    active = null;
    carrier.visible = false;
    heldProduct.visible = false;
    heldProduct.clear();
    transition("idle");
  }

  function loadCan(product) {
    const cached = cans.get(product.id);
    if (cached) return cached.promise;
    const entry = { model: null, promise: null };
    entry.promise = loadPinnedModel(loader, { url: product.modelUrl, sha256: product.modelSha256 }, lifetime.signal)
      .then(can => {
        const size = new T.Box3().setFromObject(can).getSize(new T.Vector3());
        if (disposed || product.dimensions.some((dimension, axis) => Math.abs(size.getComponent(axis) - dimension) > 0.0005)) {
          disposeModel(can);
          throw new Error("Unexpected can dimensions");
        }
        can.position.y = -product.dimensions[1] / 2;
        entry.model = can;
        return can;
      })
      .catch(() => {
        cans.delete(product.id);
        return null;
      });
    cans.set(product.id, entry);
    return entry.promise;
  }

  function loadHand() {
    if (hand) return hand;
    if (!handRequest) {
      handRequest = loadPinnedModel(loader, HAND, lifetime.signal)
        .then(skin => {
          try {
            if (disposed) return disposeModel(skin);
            hand = makeHand(T, skin);
            carrier.add(hand.object);
          } catch {
            disposeModel(skin);
          }
        })
        .catch(() => {})
        .finally(() => { handRequest = null; });
    }
    return handRequest;
  }

  function screenPoints() {
    camera.getWorldPosition(eye);
    camera.getWorldQuaternion(cameraRotation);
    camera.getWorldDirection(worldLook);
    if (Math.hypot(worldLook.x, worldLook.z) > 0.001) {
      viewHeading.setFromAxisAngle(axes.up, Math.atan2(-worldLook.x, -worldLook.z));
    }

    let ratioX = 1;
    let ratioY = 1;
    let screenX = -0.08;
    let screenY = 0.09;
    if (preview) {
      const view = canvas.getBoundingClientRect();
      const region = preview.getBoundingClientRect();
      const left = Math.max(view.left, region.left);
      const right = Math.min(view.right, region.right);
      const top = Math.max(view.top, region.top);
      const bottom = Math.min(view.bottom, region.bottom);
      if (right > left && bottom > top) {
        ratioX = (right - left) / view.width;
        ratioY = (bottom - top) / view.height;
        screenX = (left + right - 2 * view.left) / view.width - 1;
        screenY = 1 - (top + bottom - 2 * view.top) / view.height;
      }
    }
    const vertical = Math.tan(T.MathUtils.degToRad(camera.getEffectiveFOV()) / 2);
    const horizontal = vertical * camera.aspect;
    const distance = Math.max(camera.near + 0.22, 0.40, 0.105 / Math.min(vertical * ratioY, horizontal * ratioX));
    inspection.set(screenX * horizontal * distance, screenY * vertical * distance, -distance);
    inspection.applyQuaternion(cameraRotation).add(eye);
    approach.set(horizontal * distance * 1.45, -vertical * distance * 1.40, -distance);
    approach.applyQuaternion(cameraRotation).add(eye);
    drop.set(horizontal * distance * 0.62, -vertical * distance * 1.60, -distance);
    drop.applyQuaternion(cameraRotation).add(eye);
  }

  function atStock() {
    carrier.position.copy(stock);
    carrier.quaternion.copy(viewHeading);
    alongsideStock.set(0.095, 0.012, 0).applyAxisAngle(axes.up, handYaw).applyQuaternion(viewHeading).add(stock);
    heldProduct.quaternion.copy(viewHeading).invert().multiply(stockPose);
  }

  // Move to the side of the tin before closing the fingers around it.
  function poseGrip(progress) {
    carrier.position.lerpVectors(alongsideStock, stock, T.MathUtils.smoothstep(progress, 0, 1));
    hand?.pose(progress);
  }

  function inspectPose() {
    carrier.position.copy(inspection);
    carrier.quaternion.copy(viewHeading).multiply(poseOffset.setFromAxisAngle(axes.right, pitch));
    heldProduct.quaternion.setFromAxisAngle(axes.up, active.can.frontYaw + yaw);
    if (hand) {
      // The thumb and fingers roll the tin as the wrist follows slightly.
      hand.object.rotation.y = handYaw + Math.asin(Math.sin(yaw) * 0.12);
      hand.pose(1);
    }
  }

  function showInspection() {
    showShelf(false);
    heldProduct.visible = true;
    inspectPose();
    transition("inspecting");
  }

  async function select(product, anchor) {
    if (disposed || active || !product?.id) return false;
    const shelfObject = anchor ? getProductObject?.(anchor.id) : null;
    const can = getNewMoonProduct(product.id);
    const selection = { product, can, anchor, shelfObject, shelfWasVisible: shelfObject?.visible, modelReady: false };
    active = selection;
    targetYaw = yaw = targetPitch = pitch = 0;
    if (!can) {
      transition("inspecting");
      return true;
    }

    transition("loading");
    const [model] = await Promise.all([loadCan(can), loadHand()]);
    if (active !== selection || disposed) return false;
    selection.modelReady = Boolean(model);
    if (!model) {
      transition("inspecting");
      return true;
    }

    heldProduct.add(model);
    screenPoints();
    if (hand) {
      hand.object.rotation.y = handYaw;
      hand.object.scale.setScalar(can.dimensions[0] / gripDiameter);
    }
    if (shelfObject) {
      shelfObject.getWorldPosition(stock);
      shelfObject.getWorldQuaternion(stockPose);
    } else if (anchor?.position) {
      stock.fromArray(anchor.position);
      stockPose.setFromAxisAngle(axes.up, anchor.rotationY ?? 0);
    } else {
      stock.copy(inspection).addScaledVector(axes.up, -can.dimensions[1] / 2);
      stockPose.copy(viewHeading);
    }
    stock.addScaledVector(axes.up, can.dimensions[1] / 2);
    aboveStock.copy(stock).addScaledVector(axes.up, 0.034);

    carrier.visible = true;
    if (motion.matches || !anchor) {
      showInspection();
    } else {
      atStock();
      if (hand) {
        carrier.position.copy(approach);
        heldProduct.visible = false;
        hand.pose(0);
        transition("reaching");
      } else {
        showShelf(false);
        heldProduct.visible = true;
        transition("lifting");
      }
    }
    return true;
  }

  function rotate(yawStep, pitchStep = 0) {
    if (phase !== "inspecting" || !active.modelReady || !Number.isFinite(yawStep) ||
        !Number.isFinite(pitchStep)) return false;
    targetYaw += yawStep;
    targetPitch = T.MathUtils.clamp(targetPitch + pitchStep, -0.52, 0.52);
    onInvalidate?.();
    return true;
  }

  function resetRotation() {
    if (phase !== "inspecting" || !active.modelReady) return false;
    targetYaw = yaw - T.MathUtils.euclideanModulo(yaw + Math.PI, 2 * Math.PI) + Math.PI;
    targetPitch = 0;
    onInvalidate?.();
    return true;
  }

  function putBack() {
    if (phase !== "inspecting") return false;
    if (!active.modelReady || !active.anchor || motion.matches) finish();
    else {
      start.copy(carrier.position);
      startRotation.copy(carrier.quaternion);
      startCanRotation.copy(heldProduct.quaternion);
      startHandYaw = hand?.object.rotation.y ?? 0;
      transition("returning");
    }
    return true;
  }

  function addToBasket() {
    if (phase !== "inspecting" || requestingAdd || !onAddRequested) return false;
    const selection = active;
    requestingAdd = true;
    try {
      if (onAddRequested(selection.product) === false) return false;
    } finally {
      requestingAdd = false;
    }
    if (active !== selection) return true;
    if (!selection.modelReady || motion.matches) finish();
    else {
      start.copy(carrier.position);
      startRotation.copy(carrier.quaternion);
      transition("stowing");
    }
    return true;
  }

  function cancel() {
    if (!active) return false;
    finish();
    return true;
  }

  function update(delta) {
    if (!active?.modelReady) return false;
    screenPoints();
    if (phase === "inspecting") {
      yaw = motion.matches || Math.abs(targetYaw - yaw) < 0.001 ? targetYaw : T.MathUtils.damp(yaw, targetYaw, 14, delta);
      pitch = motion.matches || Math.abs(targetPitch - pitch) < 0.001 ? targetPitch : T.MathUtils.damp(pitch, targetPitch, 14, delta);
      if (yaw === targetYaw) {
        yaw = T.MathUtils.euclideanModulo(yaw + Math.PI, 2 * Math.PI) - Math.PI;
        targetYaw = yaw;
      }
      inspectPose();
      return yaw !== targetYaw || pitch !== targetPitch;
    }

    if (motion.matches) {
      if (phase === "reaching" || phase === "lifting") showInspection();
      else finish();
      return false;
    }

    elapsed += delta;
    const progress = T.MathUtils.clamp(elapsed / durations[phase], 0, 1);
    const eased = T.MathUtils.smoothstep(progress, 0, 1);
    if (phase === "reaching") {
      atStock();
      if (progress < 0.61) {
        const reach = T.MathUtils.smootherstep(progress, 0, 0.61);
        carrier.position.lerpVectors(approach, alongsideStock, reach);
        carrier.position.y += Math.sin(reach * Math.PI) * 0.065;
        hand?.pose(0);
      } else {
        poseGrip((progress - 0.61) / 0.39);
      }
      if (progress === 1) {
        showShelf(false);
        heldProduct.visible = true;
        transition("lifting");
      }
    } else if (phase === "lifting") {
      atStock();
      if (progress < 0.28) {
        const clearance = T.MathUtils.smoothstep(progress, 0, 0.28);
        carrier.position.lerpVectors(stock, aboveStock, clearance);
      } else {
        const lift = T.MathUtils.smootherstep(progress, 0.28, 1);
        const arc = Math.sin(lift * Math.PI);
        carrier.position.lerpVectors(aboveStock, inspection, lift);
        carrier.position.y += arc * 0.055;
        carrier.quaternion.multiply(poseOffset.setFromAxisAngle(axes.right, 0.18 * arc));
        heldProduct.quaternion.slerp(viewPose.setFromAxisAngle(axes.up, active.can.frontYaw), lift);
      }
      if (progress === 1) transition("inspecting");
    } else if (phase === "returning") {
      if (progress < 0.64) {
        const approachShelf = T.MathUtils.smootherstep(progress, 0, 0.64);
        carrier.position.lerpVectors(start, aboveStock, approachShelf);
        carrier.position.y += Math.sin(approachShelf * Math.PI) * 0.045;
        carrier.quaternion.copy(startRotation).slerp(viewHeading, approachShelf);
        viewPose.copy(viewHeading).invert().multiply(stockPose);
        heldProduct.quaternion.copy(startCanRotation).slerp(viewPose, approachShelf);
        if (hand) hand.object.rotation.y = T.MathUtils.lerp(startHandYaw, handYaw, approachShelf);
      } else if (progress < 0.80) {
        atStock();
        carrier.position.lerpVectors(aboveStock, stock, T.MathUtils.smoothstep(progress, 0.64, 0.80));
      } else if (!hand) {
        finish();
      } else {
        showShelf(true);
        heldProduct.visible = false;
        atStock();
        if (progress < 0.92) {
          poseGrip(1 - (progress - 0.80) / 0.12);
        } else {
          const withdraw = T.MathUtils.smoothstep(progress, 0.92, 1);
          carrier.position.lerpVectors(alongsideStock, approach, withdraw);
          hand.pose(0);
        }
        if (progress === 1) finish();
      }
    } else if (phase === "stowing") {
      carrier.position.lerpVectors(start, drop, eased);
      carrier.quaternion.copy(startRotation).multiply(poseOffset.setFromAxisAngle(axes.right, -0.32 * eased));
      if (progress === 1) finish();
    }
    return phase !== "idle";
  }

  function hide() {
    if (document.hidden) cancel();
  }

  document.addEventListener("visibilitychange", hide);
  window.addEventListener("blur", cancel);
  motion.addEventListener("change", onMotionChange);
  function onMotionChange() {
    onInvalidate?.();
  }

  return {
    select, rotate, resetRotation, putBack, addToBasket, cancel, update, getState,
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      cancel();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", cancel);
      motion.removeEventListener("change", onMotionChange);
      scene.remove(carrier);
      disposeModel(carrier);
      for (const { model } of cans.values()) {
        if (model) disposeModel(model);
      }
      cans.clear();
    },
  };
}
