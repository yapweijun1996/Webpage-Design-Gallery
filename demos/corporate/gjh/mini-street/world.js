import * as THREE from "../v11/vendor/three.module.min.js";
import { paintedTexture, pavingTexture, streetTextures } from "./surfaces.js";
import { drinks } from "./vending.js";

const NIGHT = {
  sky: "#56677d", haze: "#53617a", top: "#1d3151", ground: "#ad8270", ambient: "#9fb7d8",
  sun: "#c3d0f5", skyPower: 1.60, sunPower: 1.28, warmly: 1, glass: 1.38,
};
const DAY = {
  sky: "#b5d8de", haze: "#aac9c7", top: "#508eaa", ground: "#ae9583", ambient: "#d4ebff",
  sun: "#ffe1b0", skyPower: 2.05, sunPower: 2.7, warmly: 0.15, glass: 0.06,
};

export const REFLECTED = 1;

export function buildWorld(scene, invalidate) {
  let seed = 21973;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const surface = (color, roughness = 0.77) => new THREE.MeshStandardMaterial({ color, roughness });
  const glow = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 });
  const textures = streetTextures(random);
  const mapped = (color, map, roughness = 0.77) => new THREE.MeshStandardMaterial({ color, map, roughness });
  const plaster = ["#e3ab84", "#ebc6a0", "#bf8774", "#c8bb91"].map((color) => mapped(color, textures.plaster));
  const cream = surface("#ead2b9", 0.68);
  const lightCream = surface("#fae7c9", 0.64);
  const stone = mapped("#916c63", textures.plaster);
  const deepGreen = mapped("#214934", textures.wood, 0.58);
  const lightGreen = mapped("#497256", textures.wood, 0.58);
  const ink = surface("#202e2a");
  const wood = mapped("#6f4029", textures.wood, 0.61);
  const cane = mapped("#cb9259", textures.wood, 0.52);
  const brass = surface("#d6a364", 0.32);
  const mortar = mapped("#6b4640", textures.plaster);
  const curtain = mapped("#bd7149", textures.cloth);
  const porcelain = surface("#e9cdab", 0.39);
  const slate = surface("#244438");
  const brick = mapped("#8f5447", textures.plaster);
  const redTiles = ["#9d5141", "#b66750", "#bc7458", "#9b543e", "#8b493a", "#b9674d"]
    .map((color) => mapped(color, textures.roof, 0.49));
  const foliage = ["#2e5c39", "#447640", "#5f8847", "#789a52", "#376f59"].map((color) => {
    const material = surface(color, 0.5);
    material.side = THREE.DoubleSide;
    return material;
  });
  const flowers = ["#c94243", "#df6752", "#eeb451", "#e69aa4"].map((color) => surface(color, 0.52));
  const encaustic = mapped("#ffffff", textures.encaustic);
  const fabric = [mapped("#214735", textures.cloth), mapped("#f4ddad", textures.cloth)];
  const windowArt = document.createElement("canvas");
  windowArt.width = 128;
  windowArt.height = 128;
  const windowInk = windowArt.getContext("2d");
  const shades = windowInk.createLinearGradient(0, 0, 0, 128);
  shades.addColorStop(0, "#aaa");
  shades.addColorStop(0.25, "#f2e9d6");
  shades.addColorStop(0.67, "#bd9f87");
  shades.addColorStop(1, "#614e4b");
  windowInk.fillStyle = shades;
  windowInk.fillRect(0, 0, 128, 128);
  for (const x of [0, 34, 67, 101]) {
    windowInk.fillStyle = "#180d062e";
    windowInk.fillRect(x, 0, 9, 128);
  }
  const glassTexture = new THREE.CanvasTexture(windowArt);
  glassTexture.colorSpace = THREE.SRGBColorSpace;
  const windows = ["#f4ac61", "#e5994f", "#b76539", "#e49158"].map((color) => {
    const material = glow(color);
    material.map = glassTexture;
    material.emissiveMap = glassTexture;
    return material;
  });
  const lampGlow = glow("#ffad5c");
  const neon = glow("#ffb653");
  const roomGlow = glow("#ffad68");
  const roseGlow = glow("#eb96b7");

  const cube = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const shadeGlass = new THREE.CylinderGeometry(0.65, 1, 1, 10);
  const cupHandle = new THREE.TorusGeometry(1, 0.16, 4, 10);
  const barrelTile = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false, Math.PI / 2, Math.PI);
  const ball = new THREE.SphereGeometry(1, 11, 7);
  const petal = new THREE.SphereGeometry(1, 7, 4);
  const leaf = new THREE.BufferGeometry();
  // Local +X runs from the stem to the tapered tip. The ridge catches wet highlights.
  const leafPoints = [];
  const leafIndices = [];
  for (let row = 0; row <= 6; row += 1) {
    const t = row / 6;
    const width = Math.sin(t * Math.PI) ** 0.86 * 0.22 + 0.002;
    const rise = Math.sin(t * Math.PI * 0.98) * 0.22 - 0.055 * t;
    leafPoints.push(t, rise - width * 0.35, -width, t, rise, 0, t, rise - width * 0.50, width);
    if (row) {
      const i = row * 3;
      leafIndices.push(i - 3, i - 2, i, i, i - 2, i + 1, i - 2, i - 1, i + 1, i + 1, i - 1, i + 2);
    }
  }
  leaf.setAttribute("position", new THREE.Float32BufferAttribute(leafPoints, 3));
  leaf.setIndex(leafIndices);
  leaf.computeVertexNormals();
  const lanternRib = new THREE.TorusGeometry(0.204, 0.008, 3, 10);
  const pot = new THREE.CylinderGeometry(0.36, 0.25, 0.52, 18);
  const instances = new Map();
  const archProfiles = new Map();
  const signMaterials = [];
  const hitTargets = [];
  const lamps = [];
  const haloArt = document.createElement("canvas");
  haloArt.width = haloArt.height = 64;
  const haloInk = haloArt.getContext("2d");
  const halo = haloInk.createRadialGradient(32, 32, 1, 32, 32, 32);
  halo.addColorStop(0, "#fff2cbdc");
  halo.addColorStop(0.24, "#ffba554f");
  halo.addColorStop(0.55, "#eb88341a");
  halo.addColorStop(1, "#f86e2a00");
  haloInk.fillStyle = halo;
  haloInk.fillRect(0, 0, 64, 64);
  const haloTexture = new THREE.CanvasTexture(haloArt);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  const haloMaterial = new THREE.SpriteMaterial({
    map: haloTexture, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.56,
  });
  const pool = new THREE.MeshBasicMaterial({
    map: textures.lightPool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const rosePool = new THREE.MeshBasicMaterial({
    map: textures.rosePool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.61,
  });
  const shade = new THREE.MeshBasicMaterial({ map: textures.occlusion, transparent: true, depthWrite: false });
  const glass = new THREE.MeshBasicMaterial({
    color: "#c7d6e4", opacity: 0.075, transparent: true, depthWrite: false,
  });
  const litTimber = new THREE.MeshStandardMaterial({
    color: "#b57b47", map: textures.wood, emissive: "#9b4d20", emissiveMap: textures.wood, roughness: 0.64,
  });
  const displayLight = glow("#ffc17b");
  // Keep the products visible while the atlas loads or if it is unavailable.
  const labels = new THREE.MeshStandardMaterial({
    name: "New Moon shelf labels", color: "#b89059", roughness: 0.63,
  });
  new THREE.TextureLoader().load(new URL("./assets/new-moon-label-atlas.webp", import.meta.url).href,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      labels.color.set("#ffffff");
      labels.emissive.set("#fbcf9c");
      labels.map = texture;
      labels.emissiveMap = texture;
      labels.needsUpdate = true;
      invalidate();
    }, undefined, () => invalidate());
  const cans = Array.from({ length: 4 }, (_, origin) => {
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, Math.PI - 0.35);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) uv.setY(i, (290 - 96 * origin + uv.getY(i) * 92) / 384);
    return geometry;
  });

  function stamp(geometry, material, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    if (!instances.has(geometry)) instances.set(geometry, new Map());
    const batches = instances.get(geometry);
    if (!batches.has(material)) batches.set(material, []);
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    batches.get(material).push(new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), turn, new THREE.Vector3(w, h, d),
    ));
  }
  const box = (material, ...pose) => stamp(cube, material, ...pose);
  const tube = (material, ...pose) => stamp(cylinder, material, ...pose);
  const ellipsoid = (material, ...pose) => stamp(ball, material, ...pose);

  const upright = new THREE.Vector3(0, 1, 0);
  function rod(material, from, to, radius) {
    const direction = new THREE.Vector3().fromArray(to).sub(new THREE.Vector3().fromArray(from));
    const length = direction.length();
    const turn = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(upright, direction.normalize()),
    );
    tube(material, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2,
      radius, length, radius, turn.x, turn.y, turn.z);
  }

  function mesh(geometry, material, x, y, z, reflect = true) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    if (reflect) object.layers.enable(REFLECTED);
    scene.add(object);
    return object;
  }

  function decal(material, x, y, z, width, height, rx = 0, order = 0) {
    const object = mesh(plane, material, x, y, z, false);
    object.scale.set(width, height, 1);
    object.rotation.x = rx;
    object.renderOrder = order;
    return object;
  }

  function hitTarget(name, geometry, x, y, z) {
    const target = new THREE.Mesh(geometry);
    target.position.set(x, y, z);
    target.updateMatrixWorld();
    target.name = name;
    hitTargets.push(target);
  }

  function hit(name, x, y, z, width, height, depth) {
    hitTarget(name, new THREE.BoxGeometry(width, height, depth), x, y, z);
  }

  function archGeometry(radius, band, legs, depth) {
    const shape = new THREE.Shape();
    const outer = radius + band;
    shape.moveTo(outer, -legs);
    shape.lineTo(outer, 0);
    shape.absarc(0, 0, outer, 0, Math.PI, false);
    shape.lineTo(-outer, -legs);
    shape.lineTo(-radius, -legs);
    shape.lineTo(-radius, 0);
    shape.absarc(0, 0, radius, Math.PI, 0, true);
    shape.lineTo(radius, -legs);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });
  }

  function archFill(radius, legs) {
    const shape = new THREE.Shape();
    shape.moveTo(radius, -legs);
    shape.lineTo(radius, 0);
    shape.absarc(0, 0, radius, 0, Math.PI, false);
    shape.lineTo(-radius, -legs);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape, 22);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, (uv.getX(i) + radius) / (2 * radius), (uv.getY(i) + legs) / (radius + legs));
    }
    return geometry;
  }

  function arch(x, y, z, radius, band, legs, material, depth = 0.14) {
    const key = `${radius}/${band}/${legs}/${depth}`;
    if (!archProfiles.has(key)) archProfiles.set(key, archGeometry(radius, band, legs, depth));
    stamp(archProfiles.get(key), material, x, y, z, 1, 1, 1);
  }

  function archedGlass(x, y, z, radius, legs, material) {
    const key = `${radius}/${legs}`;
    if (!archProfiles.has(key)) archProfiles.set(key, archFill(radius, legs));
    stamp(archProfiles.get(key), material, x, y, z, 1, 1, 1);
  }

  function crescent(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, -0.94, 0.94, true);
    ctx.quadraticCurveTo(x - r * 0.86, y, x + Math.cos(0.94) * r, y - Math.sin(0.94) * r);
    ctx.fill();
  }

  function sign(x, y, z, width, height, title, kind) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = Math.round(768 * height / width);
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#224e3a");
    gradient.addColorStop(1, "#0d3025");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#dbae6c";
    ctx.lineWidth = 6;
    ctx.strokeRect(13, 13, w - 26, h - 26);
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, w - 52, h - 52);
    ctx.fillStyle = "#ffe1a0";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.shadowColor = "#d89248";
    ctx.shadowBlur = 8;
    if (kind === "moon") {
      crescent(ctx, w * 0.235, h * 0.51, h * 0.33);
      ctx.font = `${h * 0.60}px Georgia`;
      ctx.fillText(title, w * 0.54, h * 0.54);
      ctx.font = `${h * 0.24}px Georgia`;
      for (const x of [0.15, 0.85]) ctx.fillText("✦", w * x, h * 0.50);
    } else {
      ctx.font = `bold ${h * 0.58}px Georgia`;
      ctx.fillText(title, w * 0.50, h * 0.52, w * 0.86);
    }
    const art = new THREE.CanvasTexture(canvas);
    art.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({
      map: art, emissive: "#fff0cb", emissiveMap: art, emissiveIntensity: 0.65, roughness: 0.5,
    });
    signMaterials.push(material);
    box(wood, x, y, z - 0.07, width + 0.15, height + 0.15, 0.13);
    stamp(plane, material, x, y, z + 0.006, width, height, 1);
  }

  function lantern(x, y, z, size = 1) {
    box(ink, x, y + 0.32 * size, z - 0.11, 0.06, 0.06, 0.52);
    tube(brass, x, y + 0.18 * size, z, 0.14 * size, 0.13 * size, 0.14 * size);
    ellipsoid(lampGlow, x, y, z, 0.20 * size, 0.23 * size, 0.20 * size);
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4;
      stamp(lanternRib, brass, x, y, z, size, size * 1.15, size, 0, angle);
    }
    tube(brass, x, y - 0.20 * size, z, 0.12 * size, 0.06 * size, 0.12 * size);
    tube(wood, x, y - 0.27 * size, z, 0.014 * size, 0.14 * size, 0.014 * size);
    const halo = new THREE.Sprite(haloMaterial);
    halo.position.set(x, y, z + 0.22 * size);
    halo.scale.set(1.66 * size, 1.66 * size, 1);
    scene.add(halo);
  }

  function light(x, y, z, strength, radius, color = "#ffac60") {
    const point = new THREE.PointLight(color, strength, radius, 1.6);
    point.position.set(x, y, z);
    point.layers.enable(REFLECTED);
    scene.add(point);
    lamps.push({ point, strength });
  }

  function planter(x, z, size, ceramic = true, base = 0.06) {
    stamp(pot, ceramic ? lightGreen : brick, x, base + 0.26 * size, z, size, size, size);
    tube(ceramic ? cane : stone, x, base + 0.49 * size, z, 0.375 * size, 0.074 * size, 0.375 * size);
    tube(wood, x, base + 0.515 * size, z, 0.32 * size, 0.01, 0.32 * size);
    tube(ceramic ? brass : brick, x, base + 0.15 * size, z, 0.295 * size, 0.027 * size, 0.295 * size);
    decal(shade, x + 0.16, base + 0.003, z - 0.09, 1.40 * size, 0.98 * size, -Math.PI / 2, 1);
    for (let i = 0; i < 19; i += 1) {
      const angle = i * 2.4;
      const length = (0.29 + random() * 0.63) * size;
      const radius = (0.04 + random() * 0.23) * size;
      const y = (0.62 + random() * 0.52) * size;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      stamp(leaf, foliage[i % foliage.length], x + dx, base + y, z + dz,
        length, length * 0.94, length * 0.86, 0.14, -angle, 0.08 + random() * 0.77);
      if (i % 3 === 0) {
        tube(foliage[1], x + dx * 0.5, base + (y + 0.52 * size) * 0.5, z + dz * 0.5,
          0.014 * size, y - 0.49 * size, 0.014 * size, dz * 1.7, 0, -dx * 1.7);
      }
      if (i % 6 === 0) {
        const bx = x + dx * 1.45;
        const by = base + y + 0.32 * size;
        const bz = z + dz * 1.4;
        tube(foliage[0], x + dx, by - 0.26 * size, z + dz,
          0.014 * size, 0.52 * size, 0.014 * size, dz, 0, -dx);
        for (let part = 0; part < 5; part += 1) {
          const a = 2 * Math.PI * part / 5;
          stamp(petal, flowers[(i / 6) % flowers.length], bx + 0.07 * size * Math.cos(a), by,
            bz + 0.058 * size * Math.sin(a), 0.075 * size, 0.043 * size, 0.063 * size);
        }
        stamp(petal, brass, bx, by + 0.04 * size, bz, 0.035 * size, 0.029 * size, 0.035 * size);
      }
    }
  }

  function hangingGreenery(x, y, z, size, planterBox = true) {
    if (planterBox) {
      box(wood, x, y - 0.11, z, 1.12 * size, 0.22 * size, 0.32 * size);
      box(brass, x, y - 0.02, z + 0.01, 1.15 * size, 0.037 * size, 0.35 * size);
    }
    for (let i = 0; i < 30; i += 1) {
      const strand = i % 6;
      const depth = Math.floor(i / 6);
      const sx = x + size * (strand * 0.16 - 0.41 + Math.sin(i * 1.47) * 0.085);
      const sy = y + size * (0.06 - depth * (0.084 + strand % 3 * 0.062));
      const sz = z + size * (0.10 + depth * 0.046);
      const length = size * (0.14 + random() * 0.18);
      stamp(leaf, foliage[i % 5], sx, sy, sz, length, length, length, 0.43, i * 2.4, -0.34);
      if (i < 8 && i % 2 === 0) {
        stamp(petal, flowers[i % 3], sx, sy + 0.11 * size, sz, 0.051 * size, 0.042 * size, 0.045 * size);
      }
    }
  }

  function roof(x, width, z, peak) {
    const depth = 2.5;
    const rise = 1.14;
    const slope = Math.atan(rise / depth);
    const run = Math.hypot(depth, rise);
    box(brick, x, peak - rise / 2, z + depth / 2, width + 0.65, 0.14, run, slope);
    box(brick, x, peak - rise / 2, z - depth / 2, width + 0.65, 0.14, run, -slope);
    const count = Math.ceil((width + 0.52) / 0.29);
    const step = (width + 0.52) / count;
    for (const side of [-1, 1]) {
      for (let column = 0; column < count; column += 1) {
        const tx = x - (width + 0.52) / 2 + (column + 0.5) * step;
        for (let row = 0; row < 6; row += 1) {
          const t = (row + 0.5) / 6;
          stamp(barrelTile, redTiles[Math.floor(random() * redTiles.length)],
            tx, peak + 0.105 - t * rise, z + side * t * depth,
            step * 0.46, run / 6 + 0.045, 0.087, Math.PI / 2 + side * slope);
        }
      }
    }
    for (let i = 0; i < Math.ceil(width / 0.42) + 1; i += 1) {
      const tx = x - width / 2 + i * 0.42;
      tube(redTiles[i % redTiles.length], tx, peak + 0.14, z, 0.165, 0.43, 0.16, 0, 0, Math.PI / 2);
    }
    box(wood, x, peak - rise - 0.11, z + depth, width + 0.60, 0.15, 0.25);
    box(cream, x, peak - rise - 0.22, z + depth - 0.07, width + 0.58, 0.095, 0.30);
    tube(mortar, x, peak - rise - 0.085, z + depth + 0.15, 0.085, width + 0.60, 0.085, 0, 0, Math.PI / 2);
    for (let i = 0; i < count; i += 2) {
      box(wood, x - width / 2 + i * step, peak - rise - 0.25, z + depth - 0.09, 0.13, 0.19, 0.34);
    }
  }

  function downpipe(x, z, top) {
    const radius = 0.046;
    const shoulder = top - 0.29;
    rod(ink, [x, top, z + 0.08], [x, shoulder, z], radius);
    rod(ink, [x, shoulder, z], [x, 0.27, z], radius);
    for (const y of [0.63, 2.16, 3.86, top - 0.32]) {
      tube(ink, x, y, z, 0.060, 0.062, 0.060);
      box(mortar, x, y, z - 0.074, 0.112, 0.081, 0.13);
    }
    rod(ink, [x, 0.27, z], [x, 0.13, z + 0.15], radius);
    rod(ink, [x, 0.13, z + 0.15], [x, 0.13, z + 0.23], 0.051);
  }

  function drainChannel(x, start) {
    const end = 1.77;
    const length = end - start;
    const center = (start + end) / 2;
    box(ink, x, 0.044, center, 0.229, 0.010, length);
    for (const side of [-1, 1]) {
      box(stone, x + side * 0.12, 0.057, center, 0.052, 0.030, length);
    }
    for (let i = 0; i < 13; i += 1) {
      box(i % 3 ? ink : brass, x, 0.057, start + (i + 0.5) * length / 13, 0.192, 0.020, 0.037);
    }
    box(ink, x, 0.051, end + 0.16, 0.27, 0.022, 0.28);
    for (const offset of [-0.062, 0, 0.062]) {
      box(brass, x + offset, 0.065, end + 0.16, 0.024, 0.009, 0.23);
    }
  }

  function upperWall(x, z, width, bottom, top, windowY, offsets, material) {
    // The front leaf of the wall has openings through its full thickness.
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, bottom);
    shape.lineTo(width / 2, bottom);
    shape.lineTo(width / 2, top);
    shape.lineTo(-width / 2, top);
    shape.closePath();
    for (const offset of offsets) {
      const hole = new THREE.Path();
      hole.moveTo(offset + 0.61, windowY - 1.17);
      hole.lineTo(offset + 0.61, windowY);
      hole.absarc(offset, windowY, 0.61, 0, Math.PI, false);
      hole.lineTo(offset - 0.61, windowY - 1.17);
      hole.closePath();
      shape.holes.push(hole);
    }
    const facade = new THREE.ExtrudeGeometry(shape, { depth: 0.34, bevelEnabled: false, curveSegments: 16 });
    const uv = facade.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, (uv.getX(i) + width / 2) / width, (uv.getY(i) - bottom) / (top - bottom));
    }
    mesh(facade, material, x, 0, z - 0.34);
    box(material, x, (bottom + top) / 2, z - 2.25, width, top - bottom, 3.77);
  }

  function upperWindow(x, y, z, index) {
    const half = 0.59;
    arch(x, y, z - 0.36, half - 0.006, 0.044, 1.16, cane, 0.43);
    arch(x, y, z + 0.005, half + 0.08, 0.09, 1.15, lightCream, 0.13);
    arch(x, y, z + 0.115, half, 0.078, 1.16, deepGreen, 0.065);
    archedGlass(x, y, z - 0.378, half + 0.021, 1.16, windows[index % windows.length]);
    box(litTimber, x, y - 1.14, z - 0.15, 1.20, 0.08, 0.48);
    box(deepGreen, x, y - 1.16, z + 0.12, 1.40, 0.15, 0.27);
    box(stone, x, y + 0.713, z + 0.13, 0.18, 0.20, 0.13, 0, 0, 0.04);
    for (const offset of [-0.30, 0, 0.30]) {
      box(cane, x + offset, y - 0.56, z + 0.061, 0.042, 1.18, 0.067);
    }
    for (const offset of [-0.65, -0.25, 0.015]) {
      box(cane, x, y + offset, z + 0.061, 1.17, 0.05, 0.064);
    }
    for (const angle of [0.55, Math.PI / 2, 2.59]) {
      rod(cane, [x, y + 0.015, z + 0.063],
        [x + Math.cos(angle) * half, y + Math.sin(angle) * half, z + 0.063], 0.019);
    }
    const litSide = index % 2 === 0 ? 1 : -1;
    for (let fold = 0; fold < 5; fold += 1) {
      const fx = x + litSide * (0.55 - fold * 0.048);
      const length = 0.72 + fold * 0.07;
      tube(curtain, fx, y - 0.19 - length * 0.5, z - 0.25 + (fold % 2) * 0.026, 0.033, length, 0.031);
    }
    const lampX = x - litSide * 0.14;
    tube(wood, lampX, y + 0.22, z - 0.26, 0.013, 0.42, 0.013);
    stamp(shadeGlass, roomGlow, lampX, y - 0.04, z - 0.26, 0.125, 0.15, 0.12);
    tube(wood, lampX, y - 0.12, z - 0.26, 0.128, 0.021, 0.122);
    tube(porcelain, x - litSide * 0.25, y - 1.045, z - 0.20, 0.089, 0.15, 0.08);
    for (let i = 0; i < 3; i += 1) {
      stamp(leaf, foliage[2], x - litSide * 0.25, y - 0.962, z - 0.20, 0.20, 0.21, 0.19, 0, i * 2.4, 0.64);
    }
    for (const side of [-1, 1]) {
      const tilt = side * -0.63;
      box(deepGreen, x + side * 0.83, y - 0.43, z + 0.23, 0.35, 1.49, 0.081, 0, tilt);
      for (let i = 0; i < 11; i += 1) {
        box(lightGreen, x + side * 0.83, y - 1.00 + i * 0.107, z + 0.277, 0.29, 0.048, 0.078, -0.33, tilt);
      }
      for (const offset of [-0.97, 0.10]) {
        box(brass, x + side * 0.71, y + offset, z + 0.22, 0.062, 0.058, 0.044, 0, tilt);
      }
    }
    box(stone, x, y - 1.285, z + 0.16, 1.51, 0.084, 0.32);
    box(cream, x, y - 1.217, z + 0.18, 1.70, 0.093, 0.41);
    if (index % 2 === 0) hangingGreenery(x, y - 1.02, z + 0.35, 1.12);
  }

  function windowGuard(x, y, z) {
    box(brass, x, y + 0.13, z, 1.44, 0.047, 0.050);
    box(ink, x, y - 0.13, z, 1.44, 0.049, 0.051);
    for (const offset of [-0.68, -0.46, -0.23, 0, 0.23, 0.46, 0.68]) {
      box(ink, x + offset, y, z, 0.038, 0.253, 0.044);
    }
    for (const offset of [-0.35, -0.12, 0.12, 0.35]) {
      stamp(cupHandle, brass, x + offset, y + 0.002, z, 0.085, 0.091, 0.071);
    }
    for (const side of [-1, 1]) {
      const end = x + side * 0.68;
      rod(ink, [end, y - 0.13, z], [end, y - 0.22, z - 0.24], 0.023);
    }
  }

  function pier(x, z, height) {
    box(cream, x, height / 2, z, 0.42, height, 0.32);
    box(stone, x, 0.24, z + 0.035, 0.51, 0.40, 0.44);
    const bandY = height - 0.27;
    box(cream, x, bandY, z + 0.05, 0.59, 0.24, 0.43);
    box(lightCream, x, bandY + 0.20, z + 0.09, 0.65, 0.13, 0.44);
    box(cream, x, height - 1.21, z + 0.173, 0.33, 1.55, 0.045);
    for (let i = 0; i < 6; i += 1) {
      const y = height - 1.84 + i * 0.251;
      stamp(plane, encaustic, x, y, z + 0.201, 0.249, 0.249, 1);
    }
    box(stone, x, height - 2.04, z + 0.02, 0.48, 0.09, 0.40);
    box(lightCream, x, height - 2.13, z + 0.05, 0.56, 0.12, 0.47);
  }

  function glassPane(x, y, z, width, height) {
    // Subtle glazing sits in front of actual shelf and door geometry.
    decal(glass, x, y, z, width, height);
  }

  function tins(x, y, z, count, origin, radius = 0.088) {
    for (let i = 0; i < count; i += 1) {
      const sku = (origin + Math.floor(i / 3)) % cans.length;
      const cx = x + i * radius * 2.42;
      const height = radius * (sku === 3 ? 2.94 : 3.08);
      const cz = z + (random() - 0.5) * 0.045;
      stamp(cans[sku], labels, cx, y + height / 2, cz, radius, height, radius, 0, (random() - 0.5) * 0.25);
      tube(brass, cx, y + height, cz, radius * 1.02, 0.017, radius * 1.02);
      tube(brass, cx, y + 0.008, cz, radius * 1.02, 0.016, radius * 1.02);
    }
  }

  function shelf(x, z, width, levels, radius, front = false) {
    const depth = front ? 0.43 : 0.34;
    const height = levels[levels.length - 1] + 0.35;
    for (const dx of [-width / 2, width / 2]) {
      box(wood, x + dx, height / 2, z, 0.087, height, depth);
    }
    levels.forEach((y, row) => {
      box(litTimber, x, y - 0.040, z, width, 0.072, depth);
      box(cane, x, y - 0.031, z + depth * 0.5, width, 0.053, 0.027);
      if (row) box(displayLight, x, y - 0.076, z + depth * 0.21, width * 0.87, 0.012, 0.026);
      const count = Math.floor((width - 0.21) / (2.42 * radius)) - (row % 3 === 1 ? 2 : 0);
      const px = x - (count - 1) * 1.21 * radius + (row % 3 === 1 ? radius * 1.35 : 0);
      tins(px, y, z + 0.032, count, row + (front ? 1 : 0), radius);
      if (!front && row === 0) tins(px, y, z - 0.14, count - 1, row, radius);
    });
  }

  function teaService(x, y, z) {
    ellipsoid(porcelain, x, y + 0.115, z, 0.139, 0.11, 0.104);
    tube(porcelain, x, y + 0.219, z, 0.083, 0.026, 0.080);
    ellipsoid(brass, x, y + 0.239, z, 0.021, 0.019, 0.020);
    rod(porcelain, [x - 0.09, y + 0.11, z], [x - 0.22, y + 0.19, z], 0.033);
    stamp(cupHandle, porcelain, x + 0.137, y + 0.133, z, 0.069, 0.063, 0.063);
    tube(porcelain, x + 0.29, y + 0.018, z + 0.095, 0.093, 0.022, 0.090);
    tube(lightGreen, x + 0.29, y + 0.071, z + 0.095, 0.063, 0.087, 0.063);
  }

  function shopfront(x, z, width) {
    const left = x - width / 2;
    const right = x + width / 2;
    const door = x + 0.97;
    const face = z + 0.18;
    const floor = 0.19;
    // Shell stops at the opening. The back wall and side returns define the view through the door.
    box(wood, x, 1.64, z - 2.09, width, 3.0, 0.15);
    box(litTimber, x, floor - 0.05, z - 0.79, width, 0.18, 2.95);
    box(litTimber, x, 2.94, z - 0.93, width, 0.14, 2.57);
    for (const dx of [-2.5, -1.3, 0, 1.3, 2.5]) {
      box(wood, x + dx, 2.85, z - 0.89, 0.12, 0.15, 2.75);
    }
    for (const side of [-1, 1]) {
      const jamb = x + side * width * 0.5;
      box(wood, jamb, 1.44, z - 0.92, 0.20, 2.57, 2.10);
      box(deepGreen, jamb, 0.56, face + 0.02, 0.24, 0.81, 0.16);
    }
    box(deepGreen, x, 2.69, face + 0.03, width + 0.10, 0.15, 0.23);
    box(brass, x, 2.62, face + 0.16, width + 0.07, 0.025, 0.055);
    const doorZ = face - 0.29;
    for (const side of [-1, 1]) {
      box(litTimber, door + side * 0.55, 1.41, face - 0.13, 0.071, 2.43, 0.39);
      box(deepGreen, door + side * 0.61, 1.42, face + 0.046, 0.105, 2.48, 0.17);
    }
    for (const dx of [0, -0.55, 0.55]) {
      const jamb = door + dx;
      box(deepGreen, jamb, 1.40, doorZ, 0.073, 2.45, 0.118);
      box(brass, jamb, 1.67, doorZ + 0.066, 0.030, 0.021, 0.011);
    }
    box(deepGreen, door, 0.43, doorZ, 1.12, 0.48, 0.13);
    box(deepGreen, door, 2.20, doorZ, 1.12, 0.083, 0.12);
    box(deepGreen, door, 1.07, doorZ, 1.12, 0.049, 0.10);
    for (const dx of [-0.073, 0.073]) {
      tube(brass, door + dx, 1.23, doorZ + 0.096, 0.022, 0.27, 0.026);
    }
    for (const dx of [-0.27, 0.27]) {
      box(lightGreen, door + dx, 0.47, doorZ + 0.080, 0.39, 0.27, 0.031);
    }
    glassPane(door, 1.64, doorZ + 0.009, 1.04, 1.91);
    box(brass, door + 0.27, 1.88, doorZ + 0.080, 0.27, 0.13, 0.021, 0, 0, -0.07);
    box(wood, door + 0.27, 1.88, doorZ + 0.096, 0.22, 0.082, 0.016, 0, 0, -0.07);

    for (const [start, end, divisions] of [[left, door - 0.55, 2], [door + 0.55, right, 1]]) {
      const span = end - start;
      const mid = (start + end) / 2;
      box(deepGreen, mid, 0.42, face, span, 0.43, 0.17);
      box(brass, mid, 0.67, face + 0.039, span, 0.055, 0.12);
      box(deepGreen, mid, 2.20, face, span, 0.085, 0.14);
      box(litTimber, mid, 2.31, face - 0.14, span, 0.15, 0.26);
      for (let pane = 0; pane <= divisions; pane += 1) {
        const px = start + pane * span / divisions;
        box(deepGreen, px, 1.53, face, 0.077, 2.32, 0.13);
      }
      for (let pane = 0; pane < divisions; pane += 1) {
        const px = start + (pane + 0.5) * span / divisions;
        box(lightGreen, px, 0.43, face + 0.093, span / divisions - 0.17, 0.24, 0.028);
        for (const side of [-1, 1]) {
          box(deepGreen, px + side * (span / divisions - 0.23) / 2, 0.43, face + 0.111, 0.041, 0.22, 0.022);
        }
        glassPane(px, 1.65, face + 0.010, span / divisions - 0.08, 1.94);
        if (start === left && pane === 1) {
          box(deepGreen, px, 0.61, z - 0.38, 1.51, 0.75, 0.55);
          box(litTimber, px, 1.014, z - 0.38, 1.58, 0.089, 0.60);
          for (let i = -5; i <= 5; i += 1) box(cane, px + i * 0.126, 0.79, z - 0.096, 0.043, 0.37, 0.030);
          teaService(px + 0.24, 1.06, z - 0.32);
          tins(px - 0.57, 1.06, z - 0.34, 3, 0, 0.079);
        } else {
          shelf(px, z - 0.39, span / divisions - 0.18, [0.73, 1.18, 1.65], 0.077, true);
        }
      }
    }

    for (const dx of [-1.89, 0, 1.89]) {
      box(litTimber, x + dx, 1.60, z - 1.98, 1.76, 2.68, 0.10);
      box(wood, x + dx, 0.36, z - 1.80, 1.76, 0.46, 0.44);
      shelf(x + dx, z - 1.76, 1.66, [0.85, 1.31, 1.77, 2.21], 0.077);
    }
    box(wood, door - 0.72, 0.59, z - 0.88, 0.69, 0.84, 0.56);
    box(cane, door - 0.72, 1.01, z - 0.88, 0.78, 0.085, 0.61);
    tins(door - 0.96, 1.06, z - 0.85, 3, 0, 0.083);
    for (const dx of [-2.11, -0.41, 1.88]) {
      const px = x + dx;
      tube(ink, px, 2.53, z - 0.48, 0.015, 0.63, 0.015);
      stamp(shadeGlass, roomGlow, px, 2.17, z - 0.48, 0.205, 0.19, 0.205);
      tube(brass, px, 2.073, z - 0.48, 0.212, 0.027, 0.212);
      ellipsoid(lampGlow, px, 2.08, z - 0.48, 0.12, 0.061, 0.12);
      decal(pool, px, 1.55, z - 1.90, 2.19, 2.47);
    }
    box(stone, door, 0.128, face + 0.07, 1.36, 0.172, 0.78);
    box(cream, door, 0.113, face + 0.49, 1.47, 0.077, 0.28);
    for (let tile = -2; tile <= 2; tile += 1) {
      stamp(plane, encaustic, door + tile * 0.23, 0.216, face + 0.15, 0.229, 0.229, 1, -Math.PI / 2);
    }
  }

  function shutters(x, z, width) {
    const span = width - 0.98;
    box(ink, x, 1.32, z, span, 2.45, 0.22);
    for (let i = 0; i < 4; i += 1) {
      const px = x + (i - 1.5) * span / 4;
      box(i === 1 ? lightGreen : deepGreen, px, 1.28, z + 0.11, span / 4 - 0.028, 2.36, 0.09);
      box(wood, px, 0.75, z + 0.17, span / 4 - 0.18, 0.81, 0.035);
      for (const y of [1.46, 1.89, 2.32]) {
        box(windows[i % 2], px, y, z + 0.17, span / 4 - 0.18, 0.33, 0.038);
        box(wood, px, y, z + 0.19, 0.071, 0.33, 0.035);
      }
    }
  }

  function awning(x, z, width) {
    const stripe = new THREE.BufferGeometry();
    const points = [];
    const uv = [];
    const indices = [];
    const profile = [[0, 0], [0.23, -0.035], [0.62, -0.15], [1, -0.32], [1.004, -0.49]];
    for (let row = 0; row < profile.length; row += 1) {
      const [depth, y] = profile[row];
      for (let column = 0; column <= 4; column += 1) {
        const arch = Math.sin(column * Math.PI / 4);
        points.push(column / 4 - 0.5, y + arch * (row === 4 ? -0.086 : 0.029), depth * 1.24);
        uv.push(column / 4, 1 - row / profile.length);
        if (row && column) {
          const i = row * 5 + column;
          indices.push(i - 6, i - 1, i - 5, i - 5, i - 1, i);
        }
      }
    }
    stripe.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    stripe.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    stripe.setIndex(indices);
    stripe.computeVertexNormals();
    for (const material of fabric) material.side = THREE.DoubleSide;
    const count = 17;
    const step = width / count;
    tube(wood, x, 2.60, z + 1.233, 0.037, width + 0.16, 0.037, 0, 0, Math.PI / 2);
    tube(brass, x, 2.91, z - 0.022, 0.030, width + 0.12, 0.030, 0, 0, Math.PI / 2);
    for (let i = 0; i < count; i += 1) {
      const tx = x - width / 2 + (i + 0.5) * step;
      stamp(stripe, fabric[i % 2], tx, 2.95, z, step + 0.002, 1, 1);
    }
    for (const dx of [-width * 0.47, -width * 0.16, width * 0.16, width * 0.47]) {
      rod(wood, [x + dx, 2.911, z], [x + dx, 2.589, z + 1.23], 0.030);
      tube(brass, x + dx, 2.599, z + 1.23, 0.055, 0.074, 0.054, 0, 0, Math.PI / 2);
    }
    for (const dx of [-width * 0.47, width * 0.47]) {
      const px = x + dx;
      box(wood, px, 2.53, z - 0.008, 0.105, 0.70, 0.082);
      rod(brass, [px, 2.24, z + 0.013], [px, 2.43, z + 0.56], 0.027);
      rod(wood, [px, 2.43, z + 0.56], [px, 2.614, z + 1.03], 0.031);
      for (const y of [2.27, 2.79]) ellipsoid(brass, px, y, z + 0.043, 0.028, 0.029, 0.015);
    }
  }

  function house(x, width, z, wall, peak, shop = false) {
    const windowY = shop ? 4.96 : 4.84;
    const sillSpacing = width * 0.274;
    const bays = [-sillSpacing, 0, sillSpacing];
    upperWall(x, z, width, 3.24, 5.66, windowY, bays, wall);
    if (!shop) box(wall, x, 1.64, z - 2.06, width, 3.26, 4.16);
    box(stone, x, 0.13, z - 1.88, width + 0.12, 0.25, 4.25);
    box(cream, x, 3.65, z + 0.08, width + 0.17, 0.12, 0.42);
    box(stone, x, 3.73, z + 0.035, width + 0.16, 0.062, 0.29);
    box(lightCream, x, windowY + 0.80, z + 0.06, width + 0.22, 0.088, 0.28);
    box(brick, x, windowY + 0.75, z + 0.02, width + 0.23, 0.062, 0.17);
    const lintel = Math.ceil(width / 0.36);
    for (let i = 0; i < lintel; i += 1) {
      const dx = (i + 0.5) * width / lintel - width / 2;
      if (bays.every((offset) => Math.abs(dx - offset) > 0.74)) {
        box(i % 3 === 0 ? stone : cream, x + dx, windowY + 0.48, z + 0.066,
          width / lintel - 0.07, 0.084, 0.12);
      }
    }
    for (const side of [-1, 1]) pier(x + side * (width / 2 - 0.13), z + 0.11, 5.73);
    bays.forEach((offset, index) => upperWindow(x + offset, windowY, z + 0.09, index + (shop ? 0 : 1)));
    roof(x, width, z - 2.15, peak);
    const drainX = x + width / 2 + 0.02;
    downpipe(drainX, z + 0.42, peak - 1.25);
    if (shop) {
      drainChannel(drainX, z + 0.69);
      for (const offset of bays) windowGuard(x + offset, windowY - 1.015, z + 0.635);
      shopfront(x, z, width - 0.79);
      sign(x, 3.25, z + 0.28, width - 0.66, 0.78, "New Moon", "moon");
      for (const side of [-1, 1]) {
        const px = x + side * 2.12;
        rod(ink, [px, 3.70, z + 0.12], [px, 3.74, z + 0.42], 0.019);
        ellipsoid(brass, px, 3.70, z + 0.44, 0.105, 0.046, 0.081);
        tube(roomGlow, px, 3.667, z + 0.46, 0.065, 0.022, 0.061);
      }
      awning(x, z + 0.12, width - 0.6);
      for (const side of [-1, 1]) {
        const lx = x + side * (width / 2 - 0.20);
        lantern(lx, 2.49, z + 0.91, 1.22);
        decal(pool, lx, 2.26, z + 0.307, 1.69, 2.87);
      }
      light(x, 2.12, z - 0.14, 8.8, 4.7);
      light(x - 0.83, 3.69, z + 1.97, 9.3, 5.7);
      decal(pool, x + 0.15, 0.055, 0.92, width * 1.08, 1.93, -Math.PI / 2, 2);
      hit("shop", x, 1.84, z + 0.45, width - 0.60, 3.51, 0.68);
    } else {
      shutters(x, z + 0.10, width);
      lantern(x + width / 2 - 0.30, 2.57, z + 0.48, 0.75);
    }
  }

  function arcadeSign(x, y, z) {
    const art = paintedTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = "#402a35";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#e9a6ae";
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = "#ffeecc";
      ctx.textAlign = "center";
      ctx.font = "bold 32px Georgia";
      ctx.fillText("FIVE-FOOT", w / 2, 56);
      ctx.font = "25px Georgia";
      ctx.fillText("WAY", w / 2, 91);
    });
    const enamel = new THREE.MeshStandardMaterial({
      name: "Five-foot way sign",
      map: art, emissiveMap: art, emissive: "#ffd6e3", roughness: 0.58,
    });
    signMaterials.push(enamel);
    const turn = -Math.PI / 3;
    const sine = Math.sin(turn);
    const cosine = Math.cos(turn);
    box(ink, x, y, z, 0.84, 0.42, 0.092, 0, turn);
    rod(ink, [x + 0.16, y + 0.34, z - 1.31], [x, y + 0.34, z + 0.27], 0.026);
    rod(ink, [x + 0.23, y + 0.59, z - 1.31], [x + 0.035, y + 0.34, z - 0.37], 0.018);
    for (const side of [-1, 1]) {
      box(brass, x + side * cosine * 0.28, y + 0.26, z - side * sine * 0.28, 0.043, 0.15, 0.043);
      stamp(plane, enamel, x + side * sine * 0.048, y, z + side * cosine * 0.048,
        0.80, 0.38, 1, 0, side === 1 ? turn : turn + Math.PI);
    }
    box(roseGlow, x, y - 0.218, z, 0.80, 0.034, 0.096, 0, turn);
    light(x + 0.58, y + 0.17, z + 0.84, 8.2, 4.5, "#ff80a6");
    // Use static spill around the sign and its wet-road reflection.
    decal(rosePool, x + 0.36, 0.057, 1.05, 2.77, 1.90, -Math.PI / 2, 2);
    decal(rosePool, x + 0.49, 0.018, 3.72, 2.90, 4.41, -Math.PI / 2, 2);
  }

  function arcade(x, z) {
    upperWall(x, z + 0.075, 5.46, 3.77, 5.72, 4.99, [-1.20, 1.18], plaster[1]);
    box(wood, x, 1.99, z - 2.10, 5.46, 3.98, 0.36);
    box(wood, x, 3.99, z - 0.85, 5.34, 0.13, 2.10);
    box(stone, x, 0.028, z - 0.80, 5.29, 0.069, 2.92);
    for (let i = 0; i < 7; i += 1) {
      box(cane, x, 3.91, z - 0.12 - i * 0.27, 5.28, 0.09, 0.052);
    }
    for (const offset of [-1.26, 1.26]) {
      const px = x + offset;
      for (let tile = -3; tile <= 3; tile += 1) {
        for (const dz of [-0.32, -0.568]) {
          stamp(plane, encaustic, px + tile * 0.248, 0.065, z + dz, 0.247, 0.247, 1, -Math.PI / 2);
        }
      }
      arch(px, 2.89, z - 0.14, 0.96, 0.30, 2.81, cream, 0.46);
      arch(px, 2.89, z + 0.322, 0.98, 0.054, 2.81, stone, 0.052);
      arch(px, 2.89, z + 0.331, 1.13, 0.074, 2.81, lightCream, 0.048);
      arch(px, 2.86, z - 1.11, 0.89, 0.10, 2.75, stone, 0.16);
      for (let i = 0; i < 11; i += 1) {
        const angle = (i + 0.5) * Math.PI / 11;
        box(i === 5 ? lightCream : plaster[0], px + Math.cos(angle) * 1.085, 2.89 + Math.sin(angle) * 1.085,
          z + 0.357, 0.088, i === 5 ? 0.24 : 0.153, 0.078, 0, 0, angle + Math.PI / 2);
      }
      archedGlass(px, 2.84, z - 1.91, 0.77, 2.66, windows[offset < 0 ? 1 : 3]);
      box(deepGreen, px, 0.58, z - 1.79, 1.59, 0.91, 0.12);
      for (const side of [-1, 1]) {
        box(litTimber, px + side * 0.39, 0.58, z - 1.713, 0.58, 0.48, 0.04);
        box(brass, px + side * 0.096, 1.32, z - 1.71, 0.048, 0.25, 0.055);
      }
      for (const dx of [-0.45, 0, 0.45]) {
        box(wood, x + offset + dx, 1.81, z - 1.87, 0.071, 3.19, 0.081);
      }
      box(wood, x + offset, 2.60, z - 1.87, 1.54, 0.10, 0.08);
      box(cane, px, 1.04, z - 1.70, 1.60, 0.075, 0.15);
      for (const dx of [-0.57, 0.57]) {
        box(mortar, px + dx, 3.89, z - 0.91, 0.107, 0.15, 1.56);
      }
      lantern(x + offset, 2.68, z - 0.70, 0.74);
      decal(pool, px, 1.65, z - 1.66, 1.65, 2.79);
      decal(pool, px, 0.058, z - 0.55, 1.8, 2.28, -Math.PI / 2, 2);
    }
    for (const dx of [-2.52, 0, 2.52]) {
      box(stone, x + dx, 0.29, z + 0.15, 0.51, 0.48, 0.54);
      box(lightCream, x + dx, 2.83, z + 0.15, 0.58, 0.16, 0.58);
    }
    box(cream, x, 4.16, z + 0.05, 5.67, 0.25, 0.31);
    box(stone, x, 4.37, z - 0.04, 5.48, 0.16, 0.28);
    upperWindow(x - 1.20, 4.99, z + 0.08, 2);
    upperWindow(x + 1.18, 4.99, z + 0.08, 3);
    roof(x, 5.42, z - 2.13, 6.83);
    downpipe(x + 2.71, z + 0.42, 5.58);
    arcadeSign(x - 2.61, 2.83, z + 1.65);
  }

  function cornerShop(x, z) {
    const wall = plaster[3];
    box(wall, x, 1.72, z - 1.95, 4.29, 3.44, 3.88);
    upperWall(x, z, 4.29, 3.44, 5.52, 4.79, [-0.88, 0.89], wall);
    box(cream, x, 3.54, z + 0.06, 4.52, 0.23, 0.42);
    box(cream, x, 5.47, z + 0.09, 4.50, 0.13, 0.32);
    box(wood, x, 2.32, z - 0.05, 3.73, 0.20, 0.36);
    for (const dx of [-1.97, 1.97]) pier(x + dx, z, 5.53);
    upperWindow(x - 0.88, 4.79, z + 0.045, 1);
    upperWindow(x + 0.89, 4.79, z + 0.045, 2);
    shutters(x, z + 0.051, 4.22);
    roof(x, 4.29, z - 2.14, 6.63);
    for (const dx of [-1.48, 1.49]) {
      lantern(x + dx, 2.55, z + 0.43, 0.82);
      decal(pool, x + dx, 1.81, z + 0.174, 1.17, 2.24);
    }
  }

  function banner(x, y, z) {
    const art = paintedTexture(96, 192, (ctx, w, h) => {
      ctx.fillStyle = "#814442";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#dcb27b";
      ctx.lineWidth = 2;
      ctx.strokeRect(9, 11, w - 18, h - 25);
      ctx.translate(w / 2, h * 0.46);
      ctx.fillStyle = "#dcbc8d";
      for (let i = 0; i < 6; i += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.ellipse(0, -13, 5.5, 10, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    const cloth = mapped("#ffffff", art);
    cloth.side = THREE.DoubleSide;
    const flag = mesh(plane, cloth, x, y - 0.54, z);
    flag.scale.set(0.43, 1.12, 1);
    flag.rotation.y = -0.22;
    tube(brass, x, y + 0.015, z, 0.020, 0.57, 0.020, 0, 0, Math.PI / 2);
    tube(brass, x, y - 1.105, z, 0.014, 0.48, 0.014, 0, 0, Math.PI / 2);
  }

  function vending(x, z) {
    const enamel = surface("#244e3c", 0.39);
    const edge = surface("#486956", 0.35);
    const steel = surface("#a6b1a8", 0.35);
    const liner = glow("#76654c");
    const drinkFinishes = drinks.map(({ color }) => glow(color));
    // Printed faces make the same six fictional drinks recognisable from the street.
    // Each label material is shared by the front and rear pack in its lane.
    const drinkLabels = drinks.map(({ label, color, accent, code }) => {
      const artwork = paintedTexture(192, 128, (ctx, width, height) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = accent;
        ctx.fillRect(0, 13, width, 10);
        ctx.fillRect(0, 106, width, 9);
        ctx.fillStyle = "#fff1cf";
        ctx.fillRect(8, 26, width - 16, 76);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 30, width - 24, 68);
        ctx.textAlign = "center";
        ctx.fillStyle = "#253d30";
        ctx.font = "bold 28px Georgia, serif";
        ctx.fillText(label, width / 2, 61, width - 32);
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("MINI STREET", width / 2, 82);
        ctx.fillStyle = accent;
        ctx.font = "bold 11px monospace";
        ctx.fillText(code, width / 2, height - 3);
      });
      return new THREE.MeshBasicMaterial({ map: artwork, toneMapped: false });
    });
    const bay = x - 0.13;
    const panel = x + 0.397;

    // The front returns leave real depth behind the display glass and pickup lip.
    box(enamel, x, 1.21, z - 0.14, 1.18, 2.21, 0.49);
    for (const side of [-1, 1]) {
      box(enamel, x + side * 0.558, 1.21, z + 0.035, 0.084, 2.21, 0.83);
      box(edge, x + side * 0.585, 1.25, z + 0.44, 0.049, 2.12, 0.045);
      box(ink, x + side * 0.46, 0.102, z + 0.04, 0.13, 0.078, 0.58);
    }
    box(enamel, x, 0.188, z + 0.037, 1.19, 0.145, 0.81);
    box(edge, x, 2.345, z + 0.037, 1.24, 0.067, 0.85);
    box(brass, x, 2.33, z + 0.458, 1.15, 0.023, 0.028);
    box(enamel, x, 2.15, z + 0.255, 1.11, 0.30, 0.38);
    sign(x, 2.145, z + 0.447, 0.97, 0.195, "COLD DRINKS");

    box(liner, bay, 1.414, z + 0.133, 0.765, 1.12, 0.037);
    for (const side of [-1, 1]) {
      box(ink, bay + side * 0.385, 1.414, z + 0.29, 0.040, 1.15, 0.324);
      box(brass, bay + side * 0.391, 1.414, z + 0.455, 0.023, 1.17, 0.032);
      box(displayLight, bay + side * 0.356, 1.433, z + 0.325, 0.014, 1.02, 0.016);
    }
    for (const y of [0.834, 1.995]) {
      box(ink, bay, y, z + 0.29, 0.8, 0.044, 0.33);
      box(brass, bay, y, z + 0.454, 0.803, 0.025, 0.026);
    }
    box(displayLight, bay, 1.967, z + 0.356, 0.74, 0.016, 0.036);

    function packageAt(drink, finish, label, px, y, pz) {
      if (drink.shape === "can") {
        tube(finish, px, y + 0.134, pz, 0.071, 0.236, 0.071);
        for (const rim of [0.017, 0.252]) tube(steel, px, y + rim, pz, 0.071, 0.019, 0.071);
        tube(ink, px, y + 0.263, pz, 0.023, 0.005, 0.011);
        tube(lightCream, px, y + 0.108, pz, 0.072, 0.060, 0.072);
      } else {
        tube(finish, px, y + 0.111, pz, 0.062, 0.209, 0.062);
        stamp(shadeGlass, finish, px, y + 0.248, pz, 0.062, 0.072, 0.062);
        tube(finish, px, y + 0.292, pz, 0.039, 0.026, 0.039);
        tube(edge, px, y + 0.312, pz, 0.044, 0.033, 0.044);
        tube(lightCream, px, y + 0.126, pz, 0.063, 0.074, 0.063);
      }
      const bottle = drink.shape === "bottle";
      stamp(plane, label, px, y + (bottle ? 0.130 : 0.108),
        pz + (bottle ? 0.0635 : 0.0725), bottle ? 0.093 : 0.108, 0.074, 1);
    }

    for (const [row, y] of [1.462, 0.937].entries()) {
      const lanes = drinks.slice(row * 3, row * 3 + 3);
      box(steel, bay, y, z + 0.288, 0.745, 0.031, 0.27);
      box(brass, bay, y - 0.022, z + 0.41, 0.748, 0.063, 0.028);
      for (const [column, drink] of lanes.entries()) {
        const px = bay + (column - 1) * 0.241;
        const finish = drinkFinishes[row * 3 + column];
        const label = drinkLabels[row * 3 + column];
        packageAt(drink, finish, label, px + 0.026, y + 0.017, z + 0.208);
        packageAt(drink, finish, label, px, y + 0.017, z + 0.344);
      }
      const codes = paintedTexture(384, 24, (ctx, w, h) => {
        ctx.fillStyle = "#2e2d25";
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 18px monospace";
        for (const [column, drink] of lanes.entries()) {
          ctx.fillStyle = drink.color;
          ctx.fillRect((column + 0.12) * w / 3, 5, 14, 14);
          ctx.fillStyle = "#ffedc8";
          ctx.fillText(drink.code, (column + 0.5) * w / 3, h * 0.53);
        }
      });
      stamp(plane, new THREE.MeshBasicMaterial({ map: codes }), bay, y - 0.021, z + 0.426, 0.74, 0.06, 1);
    }
    const sheen = paintedTexture(128, 192, (ctx, w, h) => {
      const highlight = ctx.createLinearGradient(0, 0, w, h * 0.45);
      highlight.addColorStop(0, "#fff7d631");
      highlight.addColorStop(0.25, "#fff7d616");
      highlight.addColorStop(0.55, "#c6efd50c");
      highlight.addColorStop(1, "#d9e6db00");
      ctx.fillStyle = highlight;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff3db2c";
      ctx.beginPath();
      ctx.moveTo(w * 0.48, 0);
      ctx.lineTo(w * 0.65, 0);
      ctx.lineTo(0, h * 0.73);
      ctx.lineTo(0, h * 0.53);
      ctx.fill();
    });
    const displayGlass = new THREE.MeshBasicMaterial({ map: sheen, transparent: true, depthWrite: false });
    stamp(plane, displayGlass, bay, 1.415, z + 0.454, 0.773, 1.139, 1);

    box(enamel, panel, 1.16, z + 0.274, 0.266, 1.64, 0.34);
    box(steel, panel, 1.49, z + 0.449, 0.214, 0.861, 0.031);
    box(ink, panel, 1.49, z + 0.468, 0.184, 0.823, 0.025);
    const screen = paintedTexture(128, 80, (ctx, w, h) => {
      ctx.fillStyle = "#10291d";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c9ed9f";
      ctx.font = "bold 32px monospace";
      ctx.textAlign = "center";
      ctx.fillText("DEMO", w / 2, 37);
      for (let i = 0; i < 3; i += 1) ctx.fillRect(32 + i * 24, 54, 14, 6);
    });
    stamp(plane, new THREE.MeshBasicMaterial({ map: screen }), panel, 1.742, z + 0.482, 0.149, 0.101, 1);
    for (const dx of [-0.045, 0, 0.045]) {
      box(steel, panel + dx, 1.617, z + 0.488, 0.028, 0.031, 0.02);
    }
    box(brass, panel, 1.51, z + 0.488, 0.127, 0.065, 0.024);
    box(steel, panel, 1.367, z + 0.487, 0.13, 0.068, 0.026);
    box(ink, panel, 1.371, z + 0.501, 0.095, 0.015, 0.010);
    box(steel, panel, 1.228, z + 0.487, 0.135, 0.038, 0.026);
    box(ink, panel, 1.23, z + 0.502, 0.102, 0.014, 0.008);

    box(enamel, bay, 0.742, z + 0.266, 0.78, 0.163, 0.36);
    box(enamel, bay, 0.323, z + 0.274, 0.78, 0.125, 0.37);
    box(ink, bay, 0.525, z + 0.153, 0.762, 0.283, 0.019);
    for (const side of [-1, 1]) box(ink, bay + side * 0.364, 0.529, z + 0.299, 0.058, 0.27, 0.297);
    box(steel, bay, 0.405, z + 0.31, 0.695, 0.035, 0.292);
    box(ink, bay, 0.609, z + 0.28, 0.695, 0.102, 0.051, -0.23);
    for (const y of [0.399, 0.663]) box(brass, bay, y, z + 0.456, 0.778, 0.032, 0.047);
    for (let i = 0; i < 4; i += 1) {
      box(ink, x, 0.166 + i * 0.025, z + 0.446, 0.668, 0.012, 0.013);
    }

    box(edge, x - 0.608, 1.23, z + 0.018, 0.017, 1.85, 0.64);
    const badge = paintedTexture(96, 96, (ctx) => {
      ctx.fillStyle = "#f6cc80";
      crescent(ctx, 49, 48, 28);
      ctx.strokeStyle = "#c59b5f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(48, 48, 38, 0, 2 * Math.PI);
      ctx.stroke();
    });
    const badgeMaterial = new THREE.MeshBasicMaterial({ map: badge, transparent: true, depthWrite: false });
    stamp(plane, badgeMaterial, x - 0.619, 1.527, z + 0.012, 0.49, 0.49, 1, 0, -Math.PI / 2);
    for (const y of [0.42, 2.08]) {
      for (const dz of [-0.272, 0.306]) tube(steel, x - 0.622, y, z + dz, 0.014, 0.017, 0.014, 0, 0, Math.PI / 2);
    }
    for (let i = 0; i < 6; i += 1) {
      box(ink, x - 0.62, 0.53 + i * 0.032, z + 0.025, 0.012, 0.015, 0.39);
    }
    decal(pool, x, 0.056, z + 0.93, 1.55, 1.91, -Math.PI / 2, 2);
    hit("vending", x, 1.17, z + 0.16, 1.24, 2.34, 0.79);

    return (night) => {
      liner.emissiveIntensity = night ? 0.49 : 0.15;
      for (const finish of drinkFinishes) finish.emissiveIntensity = night ? 0.49 : 0.17;
      displayGlass.opacity = night ? 0.63 : 0.9;
    };
  }

  function mallMarquee(x, spring, z, radius) {
    const width = 5.50;
    const height = 1.20;
    const y = spring + 0.77;
    archedGlass(x, spring, z + 0.028, radius, 0, slate);
    box(deepGreen, x, spring + 0.034, z + 0.10, radius * 2, 0.123, 0.32);
    for (let i = -9; i <= 9; i += 1) {
      const dx = i * 0.30;
      const length = Math.sqrt((radius - 0.045) ** 2 - dx ** 2) - 0.12;
      const cy = spring + 0.12 + length / 2;
      box(brass, x + dx, cy, z + 0.14, 0.088, length, 0.20);
      box(neon, x + dx, cy, z + 0.249, 0.032, length - 0.08, 0.022);
    }
    const art = paintedTexture(768, 168, (ctx, w, h) => {
      ctx.fillStyle = "#102e28";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#cf9c5f";
      ctx.lineWidth = 3;
      ctx.strokeRect(13, 12, w - 26, h - 24);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f3c67d";
      ctx.font = "bold 42px Georgia";
      ctx.fillText("GJH", w / 2, 49);
      for (const side of [-1, 1]) ctx.fillRect(w / 2 + side * 111 - 39, 49, 78, 2);
      ctx.fillStyle = "#fff3cc";
      ctx.font = "bold 66px sans-serif";
      ctx.fillText("VIRTUAL MALL", w / 2, 115, w - 80);
    });
    const lettering = new THREE.MeshStandardMaterial({
      map: art, emissiveMap: art, emissive: "#fff0d2", roughness: 0.52,
    });
    signMaterials.push(lettering);
    box(ink, x, y, z + 0.32, width + 0.18, height + 0.17, 0.28);
    box(brass, x, y, z + 0.477, width + 0.09, height + 0.09, 0.046);
    stamp(plane, lettering, x, y, z + 0.502, width, height, 1);
  }

  function mallVestibule(x, z, radius, spring, floor) {
    const width = radius * 2;
    const doorZ = z - 1.08;
    const rearZ = z - 3.51;
    const canopyY = spring - 0.07;
    const height = canopyY - floor;
    const midY = floor + height / 2;
    const floorFront = z + 0.77;
    box(cream, x, floor / 2, (floorFront + rearZ) / 2, width + 1.63, floor, floorFront - rearZ);
    box(stone, x, 0.071, floorFront, width + 1.88, 0.142, 0.57);
    box(brass, x, floor + 0.001, floorFront - 0.08, width + 1.49, 0.006, 0.046);
    box(litTimber, x, midY, rearZ, width, height, 0.16);
    box(wood, x, canopyY, (z + rearZ) / 2, width, 0.16, z - rearZ + 0.16);
    for (const dx of [-1.85, 0, 1.85]) {
      box(windows[1], x + dx, midY + 0.16, rearZ + 0.10, 1.53, height - 0.64, 0.062);
      box(litTimber, x + dx, 1.13, rearZ + 0.17, 1.55, 0.14, 0.15);
      box(cane, x + dx, midY + 0.16, rearZ + 0.166, 0.051, height - 0.64, 0.072);
    }
    for (const dz of [-0.42, -1.63, -2.88]) {
      box(cane, x, canopyY - 0.071, z + dz, width - 0.03, 0.095, 0.14);
      box(displayLight, x, canopyY - 0.123, z + dz, width - 0.73, 0.018, 0.055);
    }

    // The door plane sits inside the canopy and leaves the lit lobby visible.
    for (const dx of [-radius, -1.78, 0, 1.78, radius]) {
      box(deepGreen, x + dx, midY, doorZ, 0.105, height, 0.14);
    }
    for (const side of [-1, 1]) {
      box(deepGreen, x + side * 0.89, floor + 0.16, doorZ, 1.76, 0.32, 0.14);
      box(brass, x + side * 0.155, 1.48, doorZ + 0.097, 0.053, 0.42, 0.066);
      glassPane(x + side * 1.58, midY + 0.12, doorZ + 0.078, radius - 0.054, height - 0.27);
      box(brass, x + side * 1.27, floor + 0.006, z - 0.88, 0.025, 0.012, 2.48);
      for (const dz of [-0.24, -1.25, -2.40]) {
        box(litTimber, x + side * (radius - 0.037), midY, z + dz, 0.10, height, 0.14);
      }
    }
    box(deepGreen, x, 2.62, doorZ, width, 0.127, 0.14);
    box(brass, x, 2.638, doorZ + 0.087, width - 0.15, 0.027, 0.041);
    decal(pool, x, floor + 0.016, z - 0.89, width - 0.14, 3.03, -Math.PI / 2, 2);
    decal(pool, x, 0.047, z + 1.58, width - 0.35, 1.62, -Math.PI / 2, 2);
    light(x, 2.66, z - 0.45, 13.8, 6.2);
  }

  function mall(x, z) {
    const radius = 3.16;
    const band = 0.90;
    const spring = 3.25;
    const floor = 0.24;
    const legs = spring - floor;
    const outer = radius + band;
    arch(x, spring, z - 3.57, radius, 0.25, legs, deepGreen, 3.25);
    arch(x, spring, z - 0.32, radius, band, legs, deepGreen, 0.68);
    arch(x, spring, z + 0.29, outer - 0.24, 0.24, legs, cream, 0.15);
    arch(x, spring, z + 0.365, radius + 0.077, 0.084, legs, neon, 0.038);
    arch(x, spring, z + 0.365, radius + 0.52, 0.037, legs, brass, 0.038);
    mallMarquee(x, spring, z, radius);
    mallVestibule(x, z, radius, spring, floor);

    for (let i = 0; i < 17; i += 1) {
      const angle = (i + 0.5) * Math.PI / 17;
      const molding = outer - 0.13;
      box(i === 8 ? brass : stone, x + Math.cos(angle) * molding, spring + Math.sin(angle) * molding,
        z + 0.45, i === 8 ? 0.16 : 0.034, 0.18, 0.03, 0, 0, angle + Math.PI / 2);
    }
    for (const side of [-1, 1]) {
      const px = x + side * (outer - 0.43);
      const flank = x + side * (radius + 0.25);
      box(stone, flank, 0.34, z - 1.96, 0.19, 0.34, 3.03);
      box(wood, flank, 0.58, z - 1.96, 0.14, 0.14, 3.04);
      box(lightGreen, flank, 2.51, z - 1.96, 0.12, 0.12, 3.02);
      for (const dz of [-3.35, -2.00, -0.57]) {
        box(lightGreen, flank, 1.51, z + dz, 0.15, 1.96, 0.12);
      }
      box(stone, px, 0.32, z + 0.25, 0.89, 0.55, 0.66);
      box(lightCream, px, 0.59, z + 0.26, 0.87, 0.102, 0.68);
      box(cream, px, spring - 0.10, z + 0.26, 0.86, 0.17, 0.59);
      for (const y of [0.86, 1.13, 1.40]) stamp(plane, encaustic, px, y, z + 0.369, 0.235, 0.235, 1);
      lantern(px, 2.24, z + 0.65, 0.96);
    }

    // Pick the portal silhouette, including the open doorway and the marquee.
    hitTarget("mall", archFill(outer, legs), x, spring, z + 0.51);
    return [x, 0.055, z + 2.45];
  }

  function streetLamp(x, z, size = 1) {
    tube(ink, x, 1.78 * size, z, 0.073 * size, 3.47 * size, 0.073 * size);
    tube(ink, x, 0.29 * size, z, 0.16 * size, 0.55 * size, 0.16 * size);
    tube(brass, x, 0.54 * size, z, 0.12 * size, 0.075 * size, 0.12 * size);
    stamp(lampHook, ink, x + 0.36 * size, 3.44 * size, z, size, size, size, 0, -0.12);
    tube(ink, x, 1.15 * size, z, 0.092 * size, 0.16 * size, 0.092 * size);
    const lx = x + size * 0.71;
    const y = 3.18 * size;
    const radius = 0.163 * size;
    stamp(shadeGlass, lampGlow, lx, y, z, radius, 0.27 * size, radius);
    for (const dx of [-0.11, 0.11]) {
      for (const dz of [-0.11, 0.11]) {
        rod(ink, [lx + dx * size * 0.71, y + 0.12 * size, z + dz * size * 0.71],
          [lx + dx * size, y - 0.13 * size, z + dz * size], 0.013 * size);
      }
    }
    stamp(shadeGlass, ink, lx, y + 0.19 * size, z, radius * 1.22, 0.135 * size, radius * 1.22);
    tube(brass, lx, y - 0.148 * size, z, radius * 1.06, 0.038 * size, radius * 1.06);
    ellipsoid(ink, lx, y - 0.185 * size, z, radius * 0.32, 0.055 * size, radius * 0.32);
    const halo = new THREE.Sprite(haloMaterial);
    halo.position.set(lx, y, z + 0.23 * size);
    halo.scale.set(1.72 * size, 1.72 * size, 1);
    scene.add(halo);
  }

  const lampHook = new THREE.TorusGeometry(0.37, 0.037, 5, 16, Math.PI);

  function palm(x, z, height) {
    for (let i = 0; i < 8; i += 1) {
      const lean = (i / 8) ** 2 * 0.52;
      tube(i % 3 ? wood : stone, x + lean, (i + 0.5) * height / 8, z,
        0.19 - i * 0.008, height / 8 + 0.014, 0.17 - i * 0.006, 0, 0, -lean * 0.17);
    }
    for (let branch = 0; branch < 9; branch += 1) {
      const angle = branch * 2.4;
      const radius = 1.34 + random() * 0.97;
      const arc = (branch % 3 - 0.5) * 0.53;
      for (let row = 0; row < 9; row += 1) {
        const t = row / 9;
        const dx = t * radius * Math.cos(angle);
        const dz = t * radius * Math.sin(angle);
        const y = height + Math.sin(t * Math.PI) * (0.49 + arc) - t * (0.96 - arc);
        for (const side of [-1, 1]) {
          const length = (0.32 + Math.sin(t * Math.PI) * 0.51) * (1 - t * 0.36);
          stamp(leaf, foliage[(branch + row) % foliage.length], x + 0.48 + dx, y, z + dz,
            length, length, length * 0.68, side * 0.22, -angle + side * 0.87, -0.64);
        }
      }
    }
  }

  function visitor(x, z) {
    const coat = surface("#e3ae4e");
    const face = surface("#e4ae8c");
    const hair = surface("#392a2d");
    const umbrella = ["#7c94b5", "#a9bfd1"].map((color) => new THREE.MeshStandardMaterial({
      color, side: THREE.DoubleSide, roughness: 0.41, transparent: true, opacity: 0.62,
    }));
    const angle = -0.39;
    const shoulder = 0.81;
    for (const side of [-1, 1]) {
      ellipsoid(ink, x + side * 0.12, 0.105, z, 0.091, 0.09, 0.14);
      tube(wood, x + side * 0.12, 0.28, z - 0.03, 0.06, 0.30, 0.065);
      const arm = x + side * 0.22;
      ellipsoid(coat, arm, shoulder - 0.13, z, 0.085, 0.24, 0.088, 0, 0, side * 0.21);
    }
    ellipsoid(coat, x, 0.60, z, 0.225, 0.30, 0.159);
    ellipsoid(face, x - 0.055, 1.11, z + 0.062, 0.233, 0.25, 0.205, 0, angle);
    ellipsoid(hair, x + 0.017, 1.22, z - 0.035, 0.253, 0.242, 0.200, 0, angle);
    ellipsoid(hair, x - 0.13, 1.23, z + 0.182, 0.15, 0.077, 0.067, 0, angle, 0.32);
    ellipsoid(hair, x + 0.20, 1.15, z - 0.055, 0.111, 0.143, 0.103);
    for (const offset of [-0.113, 0.03]) {
      ellipsoid(ink, x + offset - 0.071, 1.095, z + 0.248, 0.024, 0.034, 0.018);
    }
    for (const y of [0.55, 0.68, 0.80]) {
      ellipsoid(wood, x - 0.014, y, z + 0.162, 0.022, 0.024, 0.017);
    }
    stamp(cupHandle, wood, x - 0.25, 0.67, z + 0.06, 0.081, 0.145, 0.075, 0, -0.19, -0.14);
    box(porcelain, x - 0.26, 0.48, z + 0.065, 0.244, 0.25, 0.105, 0, -0.19, -0.14);
    box(deepGreen, x - 0.26, 0.385, z + 0.078, 0.244, 0.056, 0.111, 0, -0.19, -0.14);
    const handleX = x + 0.27;
    ellipsoid(face, handleX - 0.073, 0.91, z + 0.109, 0.068, 0.063, 0.059);
    tube(brass, handleX, 1.38, z + 0.045, 0.020, 1.05, 0.020, 0, 0, -0.15);
    const rim = new THREE.TorusGeometry(0.686, 0.013, 4, 16);
    for (let slice = 0; slice < 8; slice += 1) {
      const wedge = new THREE.SphereGeometry(0.73, 3, 5, slice * Math.PI / 4, Math.PI / 4, 0, Math.PI * 0.39);
      const panel = mesh(wedge, umbrella[slice % 2], handleX + 0.086, 1.68, z, true);
      panel.scale.y = 0.56;
      panel.rotation.z = -0.15;
    }
    const edge = mesh(rim, cream, handleX + 0.11, 1.814, z);
    edge.rotation.set(Math.PI / 2, 0, -0.15, "ZYX");
    const rib = new THREE.TorusGeometry(0.71, 0.007, 3, 10, Math.PI * 0.39);
    for (let i = 0; i < 8; i += 1) {
      stamp(rib, brass, handleX + 0.086, 1.68, z, 0.56, 1, 1, 0, -i * Math.PI / 4, Math.PI / 2 - 0.15);
    }
    ellipsoid(brass, handleX + 0.03, 2.10, z, 0.027, 0.032, 0.027);
  }

  function bench(x, z) {
    for (const dx of [-0.73, 0.73]) {
      box(ink, x + dx, 0.28, z, 0.092, 0.49, 0.56);
      box(ink, x + dx, 0.68, z - 0.25, 0.076, 0.65, 0.08, 0.14);
    }
    for (let i = 0; i < 4; i += 1) {
      box(wood, x, 0.53, z - 0.22 + i * 0.14, 1.80, 0.079, 0.124);
      if (i < 3) box(cane, x, 0.72 + i * 0.12, z - 0.27, 1.80, 0.090, 0.062, 0.14);
    }
  }

  function cafeTable(x, z) {
    tube(ink, x, 0.39, z, 0.061, 0.71, 0.061);
    tube(cane, x, 0.765, z, 0.36, 0.065, 0.36);
    tube(wood, x, 0.737, z, 0.37, 0.035, 0.37);
    for (let i = 0; i < 3; i += 1) {
      const angle = i * Math.PI * 2 / 3;
      rod(ink, [x, 0.31, z], [x + Math.cos(angle) * 0.27, 0.07, z + Math.sin(angle) * 0.27], 0.028);
    }
    teaService(x - 0.09, 0.80, z);
    const sx = x + 0.61;
    tube(wood, sx, 0.43, z - 0.08, 0.22, 0.064, 0.22);
    for (const dx of [-0.13, 0.13]) {
      for (const dz of [-0.13, 0.13]) {
        rod(ink, [sx + dx, 0.41, z - 0.08 + dz], [sx + dx * 1.3, 0.063, z - 0.08 + dz * 1.30], 0.023);
      }
    }
    decal(shade, x + 0.14, 0.047, z, 1.44, 0.95, -Math.PI / 2, 1);
  }

  function skyline() {
    const blockColors = ["#424e65", "#414c63", "#4b586c", "#526075"].map((color) => surface(color));
    const distantLight = glow("#bca485");
    for (let i = 0; i < 29; i += 1) {
      const x = -22 + i * 3.25;
      const z = -21 - random() * 13;
      const height = 4.7 + random() * 6.0;
      const w = 1.0 + random() * 2.6;
      box(blockColors[i % 4], x, height / 2, z, w, height, 2.25);
      if (i % 3 === 0) box(blockColors[i % 4], x - w * 0.16, height + 0.20, z - 0.14, w * 0.54, 0.40, 1.64);
      for (let row = 0; row < Math.floor(height / 0.49); row += 1) {
        for (let col = -1; col <= 1; col += 1) {
          if (random() > 0.70) box(distantLight, x + col * w / 3, row * 0.48 + 0.64, z + 1.129, w * 0.13, 0.16, 0.014);
        }
      }
    }
    for (const x of [17.8, 20.2]) {
      const z = -21.4;
      tube(blockColors[3], x, 3.65, z, 0.81, 7.30, 0.87);
      for (let tier = 0; tier < 11; tier += 1) {
        const taper = tier <= 6 ? 1 : 1 - (tier - 6) * 0.16;
        tube(blockColors[2], x, 5.54 + tier * 0.60, z, 0.86 * taper, 0.51, 0.91 * taper);
        tube(distantLight, x, 5.80 + tier * 0.60, z, 0.84 * taper, 0.036, 0.90 * taper);
      }
      tube(blockColors[3], x, 12.27, z, 0.113, 1.43, 0.12);
      ellipsoid(neon, x, 13.00, z, 0.06, 0.08, 0.06);
    }
    // The distant row closes the perspective beyond the covered walk.
    for (let i = 0; i < 4; i += 1) {
      const x = 29.9 + i * 3.81;
      const z = -6.35 + i * 1.30;
      const wall = blockColors[i];
      const height = [4.63, 5.15, 4.87, 5.41][i];
      box(wall, x, height / 2, z - 1.1, 3.65, height, 2.21);
      box(mortar, x, height + 0.11, z - 0.86, 3.91, 0.26, 2.62, 0.17);
      box(wall, x, 2.58, z + 0.09, 3.75, 0.16, 0.23);
      for (const dx of [-0.99, 0, 0.99]) {
        box(deepGreen, x + dx, 3.56, z + 0.05, 0.66, 1.01, 0.15);
        box(windows[(i + 1) % 4], x + dx, 3.58, z + 0.137, 0.48, 0.79, 0.035);
        box(wood, x + dx, 3.62, z + 0.168, 0.049, 0.79, 0.036);
        box(ink, x + dx, 1.25, z + 0.08, 0.74, 1.95, 0.14);
        box(windows[2], x + dx, 1.73, z + 0.158, 0.55, 0.79, 0.028);
      }
    }
  }

  function paving() {
    function ground(w, d, y, z, road) {
      const material = new THREE.MeshStandardMaterial({
        map: pavingTexture(road, random), roughness: road ? 0.42 : 0.68, metalness: road ? 0.08 : 0,
      });
      mesh(new THREE.PlaneGeometry(w, d), material, 0, y, z, false).rotation.x = -Math.PI / 2;
    }
    ground(85, 64, -0.014, 7, true);
    ground(54, 3.43, 0.04, 0.17, false);
    const apron = mesh(new THREE.PlaneGeometry(28, 7.75), mapped("#b58e78", pavingTexture(false, random)),
      17.44, 0.035, -4.83, false);
    apron.material.map.repeat.set(19, 4);
    apron.rotation.x = -Math.PI / 2;
    for (let i = -22; i < 22; i += 1) {
      box(stone, i * 0.73, 0.006, 1.90, 0.711, 0.075, 0.28);
      box(cream, i * 0.73, 0.046, 1.84, 0.716, 0.032, 0.17);
      box(mortar, i * 0.73, -0.012, 2.15, 0.718, 0.035, 0.23);
    }
    for (let i = 0; i < 18; i += 1) {
      const t = i / 17;
      const x = 15.95 + i * 0.68;
      const z = 1.88 - 4.45 * t ** 1.45;
      const angle = 0.55 * t ** 0.45;
      box(stone, x, 0.013, z, 0.72, 0.083, 0.27, 0, angle);
      box(cream, x - 0.022, 0.05, z - 0.05, 0.721, 0.028, 0.15, 0, angle);
    }
    for (let col = 0; col < 21; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const x = -7.68 + col * 0.24;
        const z = 0.88 + row * 0.24;
        stamp(plane, encaustic, x, 0.046, z, 0.235, 0.235, 1, -Math.PI / 2);
      }
    }
    for (const x of [-7.78, -3.76, -0.72, 4.47, 9.97]) {
      box(ink, x, 0.014, 2.15, 0.47, 0.022, 0.29);
      for (let i = -3; i <= 3; i += 1) box(brass, x + i * 0.057, 0.029, 2.15, 0.016, 0.009, 0.242);
    }
    for (let i = 0; i < 20; i += 1) {
      const x = -10.4 + i * 0.77 + random() * 0.39;
      const z = 1.48 + random() * 1.17;
      const y = z < 1.78 ? 0.051 : 0.023;
      stamp(petal, flowers[i % flowers.length], x, y, z, 0.047, 0.012, 0.027, 0.03, i * 2.4);
    }
  }

  const sky = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { bottom: { value: new THREE.Color() }, top: { value: new THREE.Color() } },
    vertexShader: `
      varying vec3 vSky;
      void main() {
        vSky = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vSky;
      uniform vec3 bottom;
      uniform vec3 top;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(49.3, 237.1))) * 43758.54);
      }
      float cloudNoise(vec2 p) {
        vec2 cell = floor(p);
        vec2 uv = smoothstep(vec2(0.0), vec2(1.0), fract(p));
        return mix(mix(hash(cell), hash(cell + vec2(1, 0)), uv.x),
                   mix(hash(cell + vec2(0, 1)), hash(cell + 1.0), uv.x), uv.y);
      }
      void main() {
        vec3 dir = normalize(vSky);
        float height = smoothstep(-0.03, 0.48, dir.y);
        vec2 p = vec2(atan(dir.x, -dir.z), dir.y) * vec2(5.7, 13.0);
        float cloud = cloudNoise(p * vec2(0.73, 1.36)) * 0.64 + cloudNoise(p * 2.8) * 0.36 - 0.47;
        float horizon = exp(-abs(dir.y - 0.03) * 9.0);
        vec3 color = mix(bottom, top, height) * (1.0 + cloud * 0.48);
        color += bottom * horizon * vec3(0.16, 0.08, 0.04);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  mesh(new THREE.SphereGeometry(92, 30, 18), sky, 0, 0, 0).renderOrder = -1;
  scene.fog = new THREE.FogExp2(NIGHT.haze, 0.019);
  const hemisphere = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  key.position.set(-7, 10, 8);
  for (const source of [hemisphere, key]) {
    source.layers.enable(REFLECTED);
    scene.add(source);
  }

  paving();
  skyline();
  house(-12.23, 6.75, -0.76, plaster[2], 6.82);
  house(-5.25, 7.03, -0.52, plaster[0], 7.01, true);
  arcade(1.28, -1.08);
  cornerShop(6.10, -2.80);
  const mallX = 12.73;
  const mallZ = -1.10;
  const mallAnchor = mall(mallX, mallZ);
  house(18.56, 6.80, -5.78, plaster[2], 6.78);
  house(25.29, 6.60, -7.20, plaster[3], 7.15);
  const setVendingNight = vending(-0.89, -0.05);
  planter(-8.73, 1.26, 1.38);
  planter(-9.21, 1.55, 0.69, false);
  planter(-7.68, 0.87, 0.73, false);
  planter(-2.52, 1.16, 0.88);
  planter(1.22, 0.66, 1.13, false);
  planter(3.35, 0.21, 1.18);
  planter(5.74, -1.91, 1.17);
  planter(6.59, -1.45, 0.74, false);
  planter(mallX - 3.97, mallZ + 0.93, 1.14);
  planter(mallX + 3.97, mallZ + 0.93, 1.27, false);
  planter(20.81, -2.28, 1.48);
  planter(-11.30, 1.37, 1.08, false);
  bench(-10.74, 0.40);
  cafeTable(-9.59, 0.72);
  streetLamp(mallX + 4.72, mallZ - 0.79, 1.20);
  streetLamp(3.77, 1.85, 0.99);
  streetLamp(-12.71, 1.81, 1.00);
  streetLamp(3.05, 8.68, 1.08);
  decal(pool, 3.70, 0.054, 8.77, 2.66, 2.88, -Math.PI / 2, 2);
  palm(7.12, -5.11, 6.20);
  palm(16.22, -5.95, 6.82);
  palm(21.54, -3.48, 6.18);
  palm(27.82, -2.43, 6.29);
  banner(3.50, 3.68, -0.32);
  banner(mallX + 4.77, 3.55, mallZ - 0.43);
  for (let i = 0; i < 5; i += 1) {
    const x = 5.1 + i * 0.96;
    const z = 1.61 - i * 0.75;
    tube(ink, x, 0.30, z, 0.066, 0.53, 0.066);
    ellipsoid(brass, x, 0.56, z, 0.092, 0.063, 0.092);
  }
  box(stone, 3.9675, 0.023, 10.26, 2.265, 0.055, 3.58);
  planter(3.74, 9.40, 2.08, false, 0.0505);
  planter(4.16, 9.85, 1.52, true, 0.0505);
  visitor(1.13, 3.25);
  decal(shade, 1.13, 0.016, 3.25, 0.95, 0.71, -Math.PI / 2, 1);

  const boardTilt = -0.16;
  const boardTurn = -0.26;
  box(cane, -2.83, 0.54, 1.39, 0.75, 0.92, 0.086, boardTilt, boardTurn);
  box(slate, -2.84, 0.54, 1.446, 0.63, 0.79, 0.040, boardTilt, boardTurn);
  box(wood, -2.83, 0.52, 1.17, 0.72, 0.95, 0.075, 0.28, boardTurn);
  const boardArt = paintedTexture(128, 160, (ctx, w, h) => {
    ctx.strokeStyle = "#d7a66d";
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = "#f0cb87";
    crescent(ctx, w / 2, 51, 25);
    ctx.textAlign = "center";
    ctx.font = "20px Georgia";
    ctx.fillText("New Moon", w / 2, 104);
    ctx.font = "11px Georgia";
    ctx.fillText("MINI STREET", w / 2, 124);
  });
  const boardInk = new THREE.MeshBasicMaterial({
    map: boardArt, transparent: true, depthWrite: false,
  });
  stamp(plane, boardInk, -2.844, 0.534, 1.471, 0.57, 0.69, 1, boardTilt, boardTurn);

  for (const [geometry, materials] of instances) {
    for (const [material, matrices] of materials) {
      const batch = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
      batch.layers.enable(REFLECTED);
      scene.add(batch);
    }
  }

  function setNight(night) {
    const palette = night ? NIGHT : DAY;
    hemisphere.color.set(palette.ambient);
    hemisphere.groundColor.set(palette.ground);
    hemisphere.intensity = palette.skyPower;
    key.color.set(palette.sun);
    key.intensity = palette.sunPower;
    scene.fog.color.set(palette.haze);
    sky.uniforms.bottom.value.set(palette.sky);
    sky.uniforms.top.value.set(palette.top);
    for (const { point, strength } of lamps) point.intensity = strength * palette.warmly;
    for (const glass of windows) glass.emissiveIntensity = palette.glass;
    labels.emissiveIntensity = night ? 0.33 : 0.08;
    setVendingNight(night);
    litTimber.emissiveIntensity = night ? 0.65 : 0.22;
    displayLight.emissiveIntensity = night ? 2.2 : 0.32;
    pool.opacity = night ? 0.66 : 0.10;
    rosePool.visible = night;
    roseGlow.emissiveIntensity = night ? 2.1 : 0.09;
    lampGlow.emissiveIntensity = night ? 3.3 : 0.27;
    roomGlow.emissiveIntensity = night ? 1.85 : 0.11;
    neon.emissiveIntensity = night ? 2.85 : 0.41;
    haloMaterial.opacity = night ? 0.58 : 0;
    for (const material of signMaterials) material.emissiveIntensity = night ? 0.77 : 0.14;
  }

  return { hitTargets, mallAnchor, setNight };
}
