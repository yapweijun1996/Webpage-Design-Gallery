import { GLTFLoader as GalleryGLTFLoader } from "../v11/vendor/GLTFLoader.js";
import { getNewMoonProduct } from "./shop-product-catalog.js";

const HAND = {
  url: new URL("./assets/posable-right-hand.glb", import.meta.url),
  sha256: "4e9a6219f4147f80fbd29cd4c349e1ae1d59d436d81822a0da8247984cb2d4e9",
};
const shelfHandYaw = 0.16;
const inspectionHandYaw = 0.37;
const gripDiameter = 0.0775;
const durations = { reaching: 0.65, lifting: 0.61, returning: 1.28, stowing: 0.40 };
const gripAngles = {
  index: [-0.10, 0.375, 0.861],
  middle: [-0.10, 0.819, 0.459],
  ring: [-0.10, 0.707, 0.159],
  pinky: [-0.125, 0.477, 0.369],
  thumb: [-0.48, 0.031, -0.555],
};

// The offsets follow the distal joints of the CC0 hand in its bind pose.
const nailAreas = {
  index_03_r: [0.018, 0.001, 0.009, 0.006],
  middle_03_r: [0.019, 0, 0.0085, 0.006],
  ring_03_r: [0.020, 0.001, 0.0085, 0.0055],
  pinky_03_r: [0.014, 0, 0.0075, 0.0047],
  thumb_03_r: [0.019, 0.005, 0.010, 0.007],
};

function skinRelief(T, uv) {
  // Use the whole map for the hand, which occupies one corner of the source UV atlas.
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) - 0.36) / 0.20, (uv.getY(i) - 0.80) / 0.19);
  }
  uv.needsUpdate = true;

  const size = 256;
  const height = new Uint8Array(size * size);
  let seed = 6327;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const pore = seed >>> 24;
      const fineLines = Math.sin(x * 1.67 + y * 0.89 + 1.8 * Math.sin(y * 0.21));
      const crossLines = Math.sin(x * 0.92 - y * 1.43 + 1.4 * Math.sin(x * 0.14));
      height[y * size + x] = 142 + 12 * fineLines + 7 * crossLines - (pore < 24 ? 35 : 0);
    }
  }
  const texture = new T.DataTexture(height, size, size, T.RedFormat);
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function paintSkin(T, mesh) {
  const { position, normal, uv, skinIndex, skinWeight } = mesh.geometry.attributes;
  const colors = new Float32Array(position.count * 3);
  const nails = new Float32Array(position.count);
  const color = new T.Color();
  const back = new T.Color(0xa66d56);
  const palm = new T.Color(0xc78b75);
  const flush = new T.Color(0xa45452);
  const crease = new T.Color(0x8f5347);
  const vein = new T.Color(0x847b73);
  const nail = new T.Color(0xd6a5a0);
  const nailEdge = new T.Color(0xe5c8b0);
  const point = new T.Vector3();
  const bind = mesh.skeleton.boneInverses.map(matrix => matrix.clone().multiply(mesh.bindMatrix));
  const smooth = T.MathUtils.smoothstep;
  const line = (distance, width) => 1 - smooth(Math.abs(distance), width * 0.25, width);

  for (let i = 0; i < position.count; i++) {
    let slot = 0;
    for (let j = 1; j < 4; j++) {
      if (skinWeight.getComponent(i, j) > skinWeight.getComponent(i, slot)) slot = j;
    }
    const index = skinIndex.getComponent(i, slot);
    const bone = mesh.skeleton.bones[index];
    const { x, z } = point.fromBufferAttribute(position, i);
    const palmar = smooth(-normal.getY(i), -0.21, 0.74);
    const dorsal = smooth(normal.getY(i), -0.10, 0.76);
    const mottling = Math.sin(115 * x + 32 * z) * Math.sin(103 * z - 29 * x);
    const wristShade = 1 - smooth(-z, 0.032, 0.078);
    color.copy(back).lerp(palm, palmar).multiplyScalar(1 + 0.075 * mottling - 0.14 * wristShade);

    if (bone.name === "hand_r") {
      const palmCenter = smooth(x, 0.007, 0.027) * (1 - smooth(x, 0.056, 0.080));
      const radialFold = line(z + 0.083 + 13 * (x - 0.050) ** 2, 0.0036);
      const crossFold = line(z + 0.104 - 0.20 * x - 3 * (x - 0.034) ** 2, 0.0025);
      const wristFold = line(z + 0.038 + 0.17 * x, 0.0038) * (1 - smooth(x, 0.061, 0.083));
      color.lerp(crease, palmar * palmCenter * (0.30 * radialFold + 0.42 * crossFold));
      color.lerp(crease, 0.38 * wristFold * (0.43 + 0.57 * palmar));
      const dorsalVein = line(x - 0.027 - 0.075 * (z + 0.060) - 0.006 * Math.sin(z * 50), 0.006);
      const veinLength = smooth(-z, 0.037, 0.058) * (1 - smooth(-z, 0.084, 0.115));
      color.lerp(vein, 0.34 * dorsalVein * dorsal * veinLength);
    } else {
      point.applyMatrix4(bind[index]);
      const pad = smooth(point.x, -0.002, 0.007);
      const joint = 1 - smooth(Math.abs(point.y - 0.0045), 0.001, 0.012);
      const fold = point.y - 0.0044 - 0.0014 * Math.cos(point.z * 350);
      const jointLines = 0.38 * line(fold, 0.0022) + 0.19 * line(fold - 0.0031, 0.0018);
      color.lerp(flush, 0.31 * joint + 0.16 * pad)
        .lerp(crease, jointLines * (0.26 + 0.74 * pad));

      const area = nailAreas[bone.name];
      if (area) {
        const [centerY, centerZ, length, width] = area;
        const across = (point.z - centerZ) / width;
        const along = (point.y - centerY) / length;
        // The nail plate follows the distal dorsal surface. Leave a narrow cuticle and free edge.
        const edge = Math.sqrt(along * along + across ** 4);
        const side = smooth(-point.x, 0.0015, 0.0040);
        const plate = (1 - smooth(edge, 0.73, 0.99)) * side;
        const cuticle = line(edge - 0.91, 0.22) * side * (1 - smooth(along, -0.1, 0.28));
        const freeEdge = smooth(along, 0.42, 0.83);
        color.lerp(flush, 0.32 * cuticle).lerp(nail, 0.95 * plate).lerp(nailEdge, 0.84 * plate * freeEdge);
        nails[i] = plate;
      }
    }
    color.toArray(colors, i * 3);
  }

  mesh.geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  mesh.geometry.setAttribute("nailPlate", new T.BufferAttribute(nails, 1));

  const material = mesh.material;
  material.color.set(0xffffff);
  material.vertexColors = true;
  material.roughness = 0.63;
  material.bumpMap = skinRelief(T, uv);
  material.bumpScale = 0.00125;

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float nailPlate;\nvarying float vNailPlate;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvNailPlate = nailPlate;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vNailPlate;")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.34, vNailPlate);");
  };
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

function makeSleeve(T, position, direction) {
  const sleeve = new T.Group();
  sleeve.position.copy(position);
  sleeve.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
  const cuffProfile = [
    [0.0218, -0.018], [0.0231, -0.017], [0.0243, -0.014], [0.0251, -0.008],
    [0.0256, 0.006], [0.0269, 0.020], [0.0270, 0.024], [0.0262, 0.027],
  ];
  const clothProfile = [
    [0.0251, 0.020], [0.0277, 0.026], [0.0304, 0.037], [0.0301, 0.053],
    [0.0315, 0.074], [0.0312, 0.096], [0.0349, 0.180], [0.036, 0.270],
  ];
  const cuff = new T.LatheGeometry(cuffProfile.map(([radius, y]) => new T.Vector2(radius, y)), 96);
  const knit = cuff.attributes.position;
  for (let i = 0; i < knit.count; i++) {
    const x = knit.getX(i);
    const z = knit.getZ(i);
    const y = knit.getY(i);
    const taper = T.MathUtils.smoothstep(y, -0.017, -0.009) *
      (1 - T.MathUtils.smoothstep(y, 0.020, 0.027));
    const rib = 1 + 0.023 * taper * Math.cos(32 * Math.atan2(x, z));
    knit.setX(i, x * rib);
    knit.setZ(i, z * rib);
  }
  cuff.computeVertexNormals();
  sleeve.add(
    new T.Mesh(cuff, new T.MeshStandardMaterial({ color: 0x343e3e, roughness: 0.89 })),
    new T.Mesh(
      new T.LatheGeometry(clothProfile.map(([radius, y]) => new T.Vector2(radius, y)), 32),
      new T.MeshStandardMaterial({ color: 0x414a4a, roughness: 0.95 }),
    ),
  );
  return sleeve;
}

function makeHand(T, model) {
  const wrist = model.getObjectByName("hand_r");
  const middle = model.getObjectByName("middle_01_r");
  const offset = new T.Quaternion();
  const flexAxis = new T.Vector3(0, 0, -1);
  const joints = Object.entries(gripAngles).flatMap(([finger, angles], fingerIndex) => angles.map((angle, index) => {
    const bone = model.getObjectByName(`${finger}_0${index + 1}_r`);
    const delay = finger === "thumb" ? 0.16 : 0.23 + fingerIndex * 0.042 + index * 0.023;
    const rest = finger === "thumb" ? -0.06 : 0.12 + 0.04 * index;
    return bone && { bone, bind: bone.quaternion.clone(), angle, delay, rest };
  }));
  if (!wrist?.isBone || !middle?.isBone || joints.some(joint => !joint?.bone.isBone)) {
    throw new Error("Invalid hand rig");
  }

  model.updateMatrixWorld(true);
  const wristPosition = wrist.getWorldPosition(new T.Vector3());
  const forearm = wristPosition.clone().sub(middle.getWorldPosition(new T.Vector3())).normalize();
  const sleeve = makeSleeve(T, wristPosition, forearm);
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
  hand.add(model, sleeve);
  const wristMount = new T.Group();
  wristMount.name = hand.name;
  wristMount.add(hand);

  return {
    object: wristMount,
    pose(proportion, relaxed = 0) {
      for (const { bone, bind, angle, delay, rest } of joints) {
        const curl = T.MathUtils.smoothstep(proportion, delay, 0.93 + delay * 0.15);
        offset.setFromAxisAngle(flexAxis, curl * angle + relaxed * rest);
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
  const inFrontOfStock = new T.Vector3();
  const stockFront = new T.Vector3();
  const reachStart = new T.Vector3();
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
    alongsideStock.set(0.095, 0.012, 0).applyAxisAngle(axes.up, shelfHandYaw).applyQuaternion(viewHeading).add(stock);
    stockFront.set(0, 0, 1).applyAxisAngle(axes.up, shelfHandYaw).applyQuaternion(viewHeading);
    inFrontOfStock.copy(alongsideStock).addScaledVector(stockFront, 0.17);
    const approachDepth = reachStart.copy(inFrontOfStock).sub(approach).dot(stockFront);
    reachStart.copy(approach).addScaledVector(stockFront, Math.max(0, approachDepth));
    heldProduct.quaternion.copy(viewHeading).invert().multiply(stockPose);
  }

  // Move to the side of the tin before closing the fingers around it.
  function poseGrip(progress) {
    carrier.position.lerpVectors(alongsideStock, stock, T.MathUtils.smoothstep(progress, 0, 1));
    hand?.pose(progress);
  }

  function poseReach(reach) {
    // Traverse in front of the stock, then line up at its side before curling.
    const front = T.MathUtils.smoothstep(reach, 0, 0.65);
    const side = T.MathUtils.smoothstep(reach, 0.65, 1);
    carrier.position.lerpVectors(reachStart, inFrontOfStock, front).lerp(alongsideStock, side);
    carrier.position.y += Math.sin(reach * Math.PI) * 0.055;
    const relaxed = 1 - front;
    hand.object.rotation.set(-0.20 * relaxed, shelfHandYaw, 0.15 * relaxed);
    hand.pose(0, relaxed);
  }

  function inspectPose() {
    carrier.position.copy(inspection);
    carrier.quaternion.copy(viewHeading).multiply(poseOffset.setFromAxisAngle(axes.right, pitch));
    heldProduct.quaternion.setFromAxisAngle(axes.up, active.can.frontYaw + yaw);
    if (hand) {
      // The thumb and fingers roll the tin as the wrist follows slightly.
      hand.object.rotation.set(0, inspectionHandYaw + Math.sin(yaw) * 0.29, 0);
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
      hand.object.rotation.set(0, shelfHandYaw, 0);
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
        heldProduct.visible = false;
        poseReach(0);
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
        poseReach(T.MathUtils.smootherstep(progress, 0, 0.61));
      } else {
        hand.object.rotation.set(0, shelfHandYaw, 0);
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
        if (hand) hand.object.rotation.y = T.MathUtils.lerp(shelfHandYaw, inspectionHandYaw, lift);
      }
      if (progress === 1) transition("inspecting");
    } else if (phase === "returning") {
      if (progress < 0.55) {
        const approachShelf = T.MathUtils.smootherstep(progress, 0, 0.55);
        carrier.position.lerpVectors(start, aboveStock, approachShelf);
        carrier.position.y += Math.sin(approachShelf * Math.PI) * 0.045;
        carrier.quaternion.copy(startRotation).slerp(viewHeading, approachShelf);
        viewPose.copy(viewHeading).invert().multiply(stockPose);
        heldProduct.quaternion.copy(startCanRotation).slerp(viewPose, approachShelf);
        if (hand) hand.object.rotation.y = T.MathUtils.lerp(startHandYaw, shelfHandYaw, approachShelf);
      } else if (progress < 0.70) {
        atStock();
        carrier.position.lerpVectors(aboveStock, stock, T.MathUtils.smoothstep(progress, 0.55, 0.70));
      } else if (!hand) {
        finish();
      } else {
        showShelf(true);
        heldProduct.visible = false;
        atStock();
        if (progress < 0.87) {
          poseGrip(1 - (progress - 0.70) / 0.17);
        } else {
          poseReach(1 - T.MathUtils.smootherstep(progress, 0.87, 1));
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
