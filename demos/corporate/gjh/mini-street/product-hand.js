import { GLTFLoader as GalleryGLTFLoader } from "../v11/vendor/GLTFLoader.js";

const CAN = {
  id: "au-425g",
  url: new URL("../v11/assets/new-moon-can-au-425g-lod1.glb", import.meta.url),
  sha256: "d1ae9ff1b35a65c6bb4cafb4a70ff3dd746bf3f70c8ffdac3f93546478feacde",
  width: 0.0775,
  height: 0.123992,
};
const HAND = {
  url: new URL("./assets/posable-right-hand.glb", import.meta.url),
  sha256: "4e9a6219f4147f80fbd29cd4c349e1ae1d59d436d81822a0da8247984cb2d4e9",
};
const handYaw = 0.43;
const durations = { reaching: 0.54, lifting: 0.58, returning: 0.94, stowing: 0.40 };
const gripAngles = {
  index: [-0.10, 0.375, 0.861],
  middle: [-0.10, 0.819, 0.459],
  ring: [-0.10, 0.707, 0.159],
  pinky: [-0.10, 0.627, 0.394],
  thumb: [-0.48, 0.056, -0.48],
};

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
  const joints = Object.entries(gripAngles).flatMap(([finger, angles]) => angles.map((angle, index) => {
    const bone = model.getObjectByName(`${finger}_0${index + 1}_r`);
    return bone && { bone, bind: bone.quaternion.clone(), angle };
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
    object.material.roughness = 0.62;
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
      for (const { bone, bind, angle } of joints) {
        offset.setFromAxisAngle(flexAxis, proportion * angle);
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
  const inspection = new T.Vector3();
  const alongsideStock = new T.Vector3();
  const drop = new T.Vector3();
  const end = new T.Vector3();
  const stock = new T.Vector3();
  const start = new T.Vector3();
  const startRotation = new T.Quaternion();
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
  let canModel = null;
  let hand = null;
  let assets = null;
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
    transition("idle");
  }

  async function loadAssets() {
    const [can, skin] = await Promise.all([
      canModel ?? loadPinnedModel(loader, CAN, lifetime.signal).catch(() => null),
      hand ?? loadPinnedModel(loader, HAND, lifetime.signal).catch(() => null),
    ]);
    if (disposed) {
      if (can && can !== canModel) disposeModel(can);
      if (skin && skin !== hand) disposeModel(skin);
      return;
    }
    if (can && !canModel) {
      const size = new T.Box3().setFromObject(can).getSize(new T.Vector3());
      if (Math.abs(size.x - CAN.width) > 0.0005 || Math.abs(size.z - CAN.width) > 0.0005 ||
          Math.abs(size.y - CAN.height) > 0.0005) {
        disposeModel(can);
      } else {
        canModel = can;
        can.position.y = -CAN.height / 2;
        heldProduct.add(can);
      }
    }
    if (skin && !hand) {
      try {
        hand = makeHand(T, skin);
        carrier.add(hand.object);
      } catch {
        disposeModel(skin);
      }
    }
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

  // Slide in from the side before curling the fingers around the tin.
  function poseGrip(progress) {
    carrier.position.lerpVectors(alongsideStock, stock, T.MathUtils.smoothstep(progress, 0, 1));
    hand?.pose(T.MathUtils.smoothstep(progress, 0.1875, 1));
  }

  function inspectPose() {
    carrier.position.copy(inspection);
    carrier.quaternion.copy(viewHeading).multiply(poseOffset.setFromAxisAngle(axes.right, pitch));
    heldProduct.quaternion.setFromAxisAngle(axes.up, yaw);
    if (hand) {
      // The wrist turns slightly as the fingers roll the can around its upright axis.
      hand.object.rotation.y = handYaw + Math.asin(Math.sin(yaw) * 0.12);
      hand.pose(1);
    }
  }

  async function select(product, anchor) {
    if (disposed || active || !product?.id) return false;
    const shelfObject = anchor ? getProductObject?.(anchor.id) : null;
    const selection = { product, anchor, shelfObject, shelfWasVisible: shelfObject?.visible, modelReady: false };
    active = selection;
    targetYaw = yaw = targetPitch = pitch = 0;
    // Product fallback still opens immediately for products without a pinned model.
    if (product.id !== CAN.id) {
      transition("inspecting");
      return true;
    }
    transition("loading");
    if (!assets) assets = loadAssets().finally(() => { assets = null; });
    await assets;
    if (active !== selection || disposed) return false;

    selection.modelReady = Boolean(canModel);
    if (!selection.modelReady) {
      transition("inspecting");
      return true;
    }

    screenPoints();
    if (hand) hand.object.rotation.y = handYaw;
    if (shelfObject) {
      shelfObject.getWorldPosition(stock);
      shelfObject.getWorldQuaternion(stockPose);
      stock.addScaledVector(axes.up, CAN.height / 2);
    } else if (anchor?.position) {
      stock.fromArray(anchor.position).addScaledVector(axes.up, CAN.height / 2);
      stockPose.setFromAxisAngle(axes.up, anchor.rotationY ?? 0);
    } else {
      stock.copy(inspection);
      stockPose.copy(viewHeading);
    }

    carrier.visible = true;
    if (motion.matches || !anchor) {
      showShelf(false);
      heldProduct.visible = true;
      inspectPose();
      transition("inspecting");
    } else {
      atStock();
      carrier.position.copy(approach);
      if (hand) {
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

    elapsed += delta;
    const progress = motion.matches ? 1 : T.MathUtils.clamp(elapsed / durations[phase], 0, 1);
    const eased = T.MathUtils.smoothstep(progress, 0, 1);
    if (phase === "reaching") {
      atStock();
      if (progress < 0.68) {
        const reach = T.MathUtils.smoothstep(progress, 0, 0.68);
        carrier.position.lerpVectors(approach, alongsideStock, reach);
        carrier.position.y += Math.sin(reach * Math.PI) * 0.07;
      } else {
        poseGrip((progress - 0.68) / 0.32);
      }
      if (progress === 1) {
        showShelf(false);
        heldProduct.visible = true;
        transition("lifting");
      }
    } else if (phase === "lifting") {
      atStock();
      carrier.position.lerpVectors(stock, inspection, eased);
      carrier.position.y += Math.sin(progress * Math.PI) * 0.09;
      heldProduct.quaternion.slerp(viewPose.identity(), eased);
      if (progress === 1) transition("inspecting");
    } else if (phase === "returning") {
      if (progress < 0.75) {
        const place = T.MathUtils.smoothstep(progress, 0, 0.75);
        carrier.position.lerpVectors(start, stock, place);
        carrier.position.y += Math.sin(place * Math.PI) * 0.10;
        carrier.quaternion.copy(startRotation).slerp(viewHeading, place);
        heldProduct.quaternion.setFromAxisAngle(axes.up, yaw);
        heldProduct.quaternion.slerp(viewPose.copy(viewHeading).invert().multiply(stockPose), place);
        if (hand) hand.object.rotation.y = T.MathUtils.lerp(startHandYaw, handYaw, place);
      } else {
        showShelf(true);
        heldProduct.visible = false;
        carrier.quaternion.copy(viewHeading);
        if (hand) hand.object.rotation.y = handYaw;
        if (progress < 0.86) {
          poseGrip((0.86 - progress) / 0.11);
        } else {
          const withdraw = T.MathUtils.smoothstep(progress, 0.86, 1);
          carrier.position.lerpVectors(alongsideStock, approach, withdraw);
          hand?.pose(0);
          carrier.position.y += Math.sin(withdraw * Math.PI) * 0.06;
        }
      }
      if (progress === 1) finish();
    } else if (phase === "stowing") {
      carrier.position.lerpVectors(start, drop, eased);
      carrier.quaternion.copy(startRotation).multiply(poseOffset.setFromAxisAngle(axes.right, -0.32 * eased));
      hand?.pose(1 - T.MathUtils.smoothstep(progress, 0.7, 1));
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
    },
  };
}
