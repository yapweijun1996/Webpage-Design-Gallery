import * as THREE from "../v11/vendor/three.module.min.js";
import { paintedTexture, pavingTexture, streetTextures } from "./surfaces.js";

const NIGHT = {
  sky: "#46627c", haze: "#485f78", top: "#172e51", ground: "#a17664", ambient: "#93b5dc",
  sun: "#a6c3f6", skyPower: 1.48, sunPower: 1.50, warmly: 1, glass: 1.28,
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
  const brick = mapped("#8f5447", textures.plaster);
  const redTiles = ["#9d5347", "#b16350", "#b97457", "#98583e", "#834236", "#b5694e"]
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
  shades.addColorStop(0, "#777");
  shades.addColorStop(0.34, "#eee");
  shades.addColorStop(0.67, "#aaa");
  shades.addColorStop(1, "#555");
  windowInk.fillStyle = shades;
  windowInk.fillRect(0, 0, 128, 128);
  for (const x of [0, 34, 67, 101]) {
    windowInk.fillStyle = "#180d062e";
    windowInk.fillRect(x, 0, 9, 128);
  }
  const glassTexture = new THREE.CanvasTexture(windowArt);
  glassTexture.colorSpace = THREE.SRGBColorSpace;
  const windows = ["#e38335", "#ec9033", "#a84921", "#da7739"].map((color) => {
    const material = glow(color);
    material.map = glassTexture;
    material.emissiveMap = glassTexture;
    return material;
  });
  const lampGlow = glow("#ffad5c");
  const neon = glow("#ffb653");
  const displayColors = ["#da9cb0", "#f3c26d", "#76bdac", "#98ade3"].map(glow);

  const cube = new THREE.BoxGeometry(1, 1, 1);
  const plane = new THREE.PlaneGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const barrelTile = new THREE.CylinderGeometry(1, 1, 1, 7, 1, false, Math.PI / 2, Math.PI);
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
    map: haloTexture, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
  });
  const pool = new THREE.MeshBasicMaterial({
    map: textures.lightPool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shade = new THREE.MeshBasicMaterial({ map: textures.occlusion, transparent: true, depthWrite: false });
  const glass = new THREE.MeshBasicMaterial({
    color: "#b7cee4", opacity: 0.065, transparent: true, depthWrite: false,
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

  function hit(name, x, y, z, width, height, depth) {
    const target = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
    target.position.set(x, y, z);
    target.updateMatrixWorld();
    target.name = name;
    hitTargets.push(target);
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
      ctx.font = `${h * 0.56}px Georgia`;
      ctx.fillText(title, w * 0.50, h * 0.54);
      ctx.font = `${h * 0.24}px Georgia`;
      for (const x of [0.16, 0.84]) ctx.fillText("✦", w * x, h * 0.50);
    } else {
      ctx.font = `${h * 0.4}px Georgia`;
      ctx.fillText(title, w * 0.50, h * 0.52, w * 0.86);
    }
    const art = new THREE.CanvasTexture(canvas);
    art.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({
      map: art, emissive: "#fff0cb", emissiveMap: art, emissiveIntensity: 0.65, roughness: 0.5,
    });
    signMaterials.push(material);
    box(wood, x, y, z - 0.07, width + 0.08, height + 0.08, 0.13);
    mesh(new THREE.PlaneGeometry(width, height), material, x, y, z + 0.006);
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
    halo.scale.set(1.48 * size, 1.48 * size, 1);
    scene.add(halo);
  }

  function light(x, y, z, strength, radius) {
    const point = new THREE.PointLight("#ffac60", strength, radius, 1.6);
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
    for (let i = 0; i < count; i += 2) {
      box(wood, x - width / 2 + i * step, peak - rise - 0.25, z + depth - 0.09, 0.13, 0.19, 0.34);
    }
  }

  function upperWindow(x, y, z, index) {
    const half = 0.59;
    arch(x, y, z + 0.024, half + 0.13, 0.105, 1.15, lightCream, 0.12);
    arch(x, y, z + 0.026, half, 0.13, 1.16, ink, 0.22);
    archedGlass(x, y, z + 0.030, half, 1.16, windows[index % windows.length]);
    arch(x, y, z + 0.23, half + 0.025, 0.047, 1.16, lightGreen, 0.035);
    box(deepGreen, x, y - 1.17, z + 0.12, 1.40, 0.15, 0.27);
    for (const offset of [-0.30, 0, 0.30]) {
      box(wood, x + offset, y - 0.31, z + 0.13, 0.044, offset === 0 ? 1.67 : 1.56, 0.071);
    }
    for (const offset of [-0.65, -0.22, 0.03]) {
      box(wood, x, y + offset, z + 0.13, 1.17, 0.056, 0.064);
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
    if (index % 2 === 0) hangingGreenery(x, y - 0.98, z + 0.38, 1);
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

  function shopfront(x, z, width) {
    const left = x - width / 2;
    const right = x + width / 2;
    const door = x + 0.97;
    const face = z + 0.18;
    const floor = 0.19;
    // Shell stops at the opening. The back wall and side returns define the view through the door.
    box(wood, x, 1.64, z - 2.09, width, 3.0, 0.15);
    box(litTimber, x, floor - 0.05, z - 0.79, width, 0.18, 2.95);
    box(cream, x, 2.96, z - 0.93, width, 0.14, 2.57);
    for (const side of [-1, 1]) {
      const jamb = x + side * width * 0.5;
      box(wood, jamb, 1.44, z - 0.92, 0.20, 2.57, 2.10);
      box(deepGreen, jamb, 0.56, face + 0.02, 0.24, 0.81, 0.16);
    }
    box(ink, x, 2.70, face - 0.04, width + 0.10, 0.095, 0.14);
    for (const dx of [0, -0.55, 0.55]) {
      const jamb = door + dx;
      box(deepGreen, jamb, 1.40, face, 0.073, 2.45, 0.118);
      box(brass, jamb, 1.67, face + 0.066, 0.030, 0.021, 0.011);
    }
    box(deepGreen, door, 0.34, face, 1.12, 0.28, 0.13);
    box(lightGreen, door, 0.34, face + 0.080, 0.97, 0.17, 0.023);
    box(deepGreen, door, 2.20, face, 1.12, 0.083, 0.12);
    box(deepGreen, door, 1.07, face, 1.12, 0.049, 0.10);
    for (const dx of [-0.073, 0.073]) {
      tube(brass, door + dx, 1.23, face + 0.096, 0.022, 0.27, 0.026);
    }
    glassPane(door, 1.52, face + 0.009, 1.04, 1.97);

    for (const [start, end, divisions] of [[left, door - 0.55, 2], [door + 0.55, right, 1]]) {
      const span = end - start;
      const mid = (start + end) / 2;
      box(deepGreen, mid, 0.42, face, span, 0.43, 0.17);
      box(brass, mid, 0.67, face + 0.039, span, 0.055, 0.12);
      box(deepGreen, mid, 2.20, face, span, 0.085, 0.14);
      for (let pane = 0; pane <= divisions; pane += 1) {
        const px = start + pane * span / divisions;
        box(deepGreen, px, 1.53, face, 0.077, 2.32, 0.13);
      }
      for (let pane = 0; pane < divisions; pane += 1) {
        const px = start + (pane + 0.5) * span / divisions;
        box(lightGreen, px, 0.43, face + 0.093, span / divisions - 0.17, 0.24, 0.028);
        glassPane(px, 1.65, face + 0.010, span / divisions - 0.08, 1.94);
        if (start === left && pane === 1) {
          shelf(px - 0.16, z - 0.47, span / divisions - 0.51, [0.73, 1.18], 0.081, true);
          tins(px + 0.36, 0.73, z - 0.24, 2, 3, 0.077);
          box(cane, px + 0.44, 0.67, z - 0.24, 0.43, 0.11, 0.32);
        } else {
          shelf(px, z - 0.24, span / divisions - 0.18, [0.73, 1.16, 1.57], 0.077, true);
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
    for (const dx of [-2.11, -0.19, 1.88]) {
      const px = x + dx;
      tube(wood, px, 2.59, z - 0.63, 0.015, 0.63, 0.015);
      ellipsoid(brass, px, 2.31, z - 0.63, 0.24, 0.12, 0.24);
      ellipsoid(lampGlow, px, 2.25, z - 0.63, 0.15, 0.062, 0.15);
      decal(pool, px, 1.55, z - 1.90, 1.91, 2.59);
    }
    box(cream, door, 0.134, face + 0.21, 1.31, 0.13, 0.61);
    box(stone, door, 0.092, face + 0.49, 1.43, 0.074, 0.21);
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
    const profile = [[0, 0], [0.27, -0.06], [0.63, -0.18], [1, -0.35], [1.003, -0.49]];
    for (let row = 0; row < profile.length; row += 1) {
      const [depth, y] = profile[row];
      for (let column = 0; column <= 4; column += 1) {
        const arch = Math.sin(column * Math.PI / 4);
        points.push(column / 4 - 0.5, y + arch * (row === 4 ? -0.055 : 0.018), depth * 1.24);
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
    tube(wood, x, 2.61, z + 1.24, 0.034, width + 0.16, 0.034, 0, 0, Math.PI / 2);
    for (let i = 0; i < count; i += 1) {
      const tx = x - width / 2 + (i + 0.5) * step;
      stamp(stripe, fabric[i % 2], tx, 2.95, z, step + 0.002, 1, 1);
    }
    for (const dx of [-width * 0.45, 0, width * 0.45]) {
      box(ink, x + dx, 2.66, z + 0.62, 0.037, 0.043, 1.27, 0.20);
      box(brass, x + dx, 2.68, z - 0.038, 0.13, 0.38, 0.047);
    }
  }

  function house(x, width, z, wall, peak, shop = false) {
    box(wall, x, 4.45, z - 2.06, width, 2.42, 4.16);
    if (!shop) box(wall, x, 1.64, z - 2.06, width, 3.26, 4.16);
    box(stone, x, 0.13, z - 1.88, width + 0.12, 0.25, 4.25);
    box(cream, x, 3.65, z + 0.08, width + 0.17, 0.12, 0.42);
    box(stone, x, 3.73, z + 0.035, width + 0.16, 0.062, 0.29);
    const windowY = shop ? 4.96 : 4.84;
    const sillSpacing = width * 0.274;
    box(lightCream, x, windowY + 0.80, z + 0.06, width + 0.22, 0.088, 0.28);
    box(brick, x, windowY + 0.75, z + 0.02, width + 0.23, 0.062, 0.17);
    const lintel = Math.ceil(width / 0.36);
    for (let i = 0; i < lintel; i += 1) {
      const dx = (i + 0.5) * width / lintel - width / 2;
      if ([-sillSpacing, 0, sillSpacing].every((offset) => Math.abs(dx - offset) > 0.74)) {
        box(i % 3 === 0 ? stone : cream, x + dx, windowY + 0.48, z + 0.066,
          width / lintel - 0.07, 0.084, 0.12);
      }
    }
    for (const side of [-1, 1]) pier(x + side * (width / 2 - 0.13), z + 0.11, 5.73);
    for (let i = 0; i < 3; i += 1) {
      upperWindow(x + (i - 1) * sillSpacing, windowY, z + 0.09, i + (shop ? 0 : 1));
    }
    roof(x, width, z - 2.15, peak);
    if (shop) {
      shopfront(x, z, width - 0.79);
      sign(x, 3.25, z + 0.28, width - 0.66, 0.78, "New Moon", "moon");
      awning(x, z + 0.12, width - 0.6);
      for (const side of [-1, 1]) {
        const lx = x + side * (width / 2 - 0.20);
        lantern(lx, 2.49, z + 0.91, 1.22);
        decal(pool, lx, 2.26, z + 0.307, 1.58, 2.63);
      }
      light(x, 2.49, z - 0.20, 10, 4.8);
      light(x - 2.54, 2.11, z + 0.98, 7, 4.5);
      decal(pool, x + 0.15, 0.055, 0.92, width * 1.08, 1.93, -Math.PI / 2, 2);
      hit("shop", x, 1.84, z + 0.45, width - 0.60, 3.51, 0.68);
    } else {
      shutters(x, z + 0.10, width);
      lantern(x + width / 2 - 0.30, 2.57, z + 0.48, 0.75);
    }
  }

  function arcade(x, z) {
    box(plaster[1], x, 4.82, z - 1.90, 5.46, 1.68, 3.95);
    box(wood, x, 1.99, z - 2.10, 5.46, 3.98, 0.36);
    box(wood, x, 3.99, z - 0.85, 5.34, 0.13, 2.10);
    for (let i = 0; i < 7; i += 1) {
      box(cane, x, 3.91, z - 0.12 - i * 0.27, 5.28, 0.09, 0.052);
    }
    for (const offset of [-1.26, 1.26]) {
      const px = x + offset;
      arch(px, 2.89, z - 0.14, 0.96, 0.30, 2.81, cream, 0.46);
      arch(px, 2.89, z + 0.322, 0.98, 0.054, 2.81, stone, 0.052);
      arch(px, 2.89, z + 0.331, 1.13, 0.074, 2.81, lightCream, 0.048);
      arch(px, 2.86, z - 1.11, 0.89, 0.10, 2.75, stone, 0.16);
      for (let i = 0; i < 11; i += 1) {
        const angle = (i + 0.5) * Math.PI / 11;
        box(i === 5 ? lightCream : plaster[0], px + Math.cos(angle) * 1.085, 2.89 + Math.sin(angle) * 1.085,
          z + 0.357, 0.088, i === 5 ? 0.24 : 0.153, 0.078, 0, 0, angle + Math.PI / 2);
      }
      archedGlass(px, 2.84, z - 1.91, 0.77, 2.66, windows[offset < 0 ? 2 : 3]);
      for (const dx of [-0.45, 0, 0.45]) {
        box(wood, x + offset + dx, 1.81, z - 1.87, 0.071, 3.19, 0.081);
      }
      box(wood, x + offset, 2.60, z - 1.87, 1.54, 0.10, 0.08);
      lantern(x + offset, 2.68, z - 0.70, 0.74);
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
  }

  function cornerShop(x, z) {
    const wall = plaster[3];
    box(wall, x, 2.76, z - 1.95, 4.29, 5.52, 3.88);
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
    box(ink, x, 1.19, z, 1.22, 2.29, 0.75);
    box(deepGreen, x, 1.22, z + 0.18, 1.15, 2.16, 0.44);
    box(brass, x, 1.94, z + 0.407, 0.95, 0.09, 0.027);
    box(cream, x - 0.108, 1.40, z + 0.407, 0.75, 1.06, 0.032);
    box(ink, x - 0.108, 1.42, z + 0.428, 0.66, 0.94, 0.017);
    sign(x, 2.12, z + 0.432, 0.99, 0.26, "VENDING");
    for (let row = 0; row < 5; row += 1) {
      const y = 1.08 + row * 0.175;
      box(neon, x - 0.108, y - 0.068, z + 0.45, 0.65, 0.018, 0.03);
      for (let column = 0; column < 4; column += 1) {
        const cx = x - 0.35 + column * 0.16;
        ellipsoid(displayColors[(row + column) % 4], cx, y, z + 0.45, 0.060, 0.066, 0.038);
        box(cream, cx, y - 0.01, z + 0.486, 0.06, 0.012, 0.008);
      }
    }
    box(brass, x + 0.37, 1.44, z + 0.415, 0.15, 0.52, 0.04);
    box(displayColors[2], x + 0.37, 1.57, z + 0.446, 0.095, 0.12, 0.017);
    for (let i = 0; i < 4; i += 1) {
      ellipsoid(ink, x + 0.37, 1.44 - i * 0.055, z + 0.447, 0.018, 0.018, 0.016);
    }
    box(brass, x, 0.50, z + 0.415, 0.74, 0.26, 0.039);
    box(ink, x, 0.50, z + 0.443, 0.63, 0.16, 0.026);
    box(wood, x, 0.23, z + 0.422, 0.75, 0.19, 0.038);
    for (let i = 0; i < 5; i += 1) box(brass, x, 0.16 + i * 0.031, z + 0.446, 0.66, 0.012, 0.013);
    box(lightGreen, x - 0.618, 1.30, z, 0.022, 1.80, 0.56);
    box(brass, x - 0.632, 1.72, z, 0.014, 0.035, 0.44);
    box(brass, x - 0.632, 1.16, z, 0.014, 0.035, 0.44);
    decal(pool, x, 0.056, z + 0.93, 1.55, 1.91, -Math.PI / 2, 2);
    hit("vending", x, 1.17, z + 0.16, 1.24, 2.34, 0.79);
  }

  function mall(x, z) {
    const radius = 2.55;
    const spring = 2.37;
    const width = 6.18;
    box(deepGreen, x, 2.50, z - 2.71, width, 4.88, 0.35);
    box(cream, x, 0.20, z - 0.99, width, 0.30, 3.30);
    for (const side of [-1, 1]) {
      box(plaster[0], x + side * 2.86, 2.39, z - 1.00, 0.54, 4.73, 3.30);
      box(cream, x + side * 2.85, 0.36, z + 0.42, 0.66, 0.66, 0.70);
      lantern(x + side * 2.78, 2.39, z + 0.57, 0.77);
    }
    archedGlass(x, spring, z - 2.49, radius - 0.05, 2.26, windows[2]);
    for (let i = -4; i <= 4; i += 1) {
      box(deepGreen, x + i * 0.51, 1.65, z - 2.44, 0.069, 3.37, 0.09);
    }
    box(wood, x, 1.95, z - 2.43, 4.58, 0.13, 0.07);
    arch(x, spring, z - 0.06, radius, 0.61, 2.28, deepGreen, 0.49);
    arch(x, spring, z + 0.458, radius + 0.04, 0.07, 2.28, neon, 0.025);
    arch(x, spring, z + 0.463, radius + 0.49, 0.077, 2.28, brass, 0.041);
    arch(x, spring - 0.09, z - 1.04, radius - 0.21, 0.054, 2.15, windows[3], 0.27);
    arch(x, spring - 0.16, z - 1.83, radius - 0.34, 0.067, 2.10, windows[2], 0.23);
    for (let i = -10; i <= 10; i += 1) {
      const dx = i * 0.221;
      const top = spring + Math.sqrt(radius ** 2 - dx ** 2);
      const length = top - 3.53;
      box(brass, x + dx, top - length / 2, z + 0.13, 0.083, length, 0.23);
      box(neon, x + dx, top - length / 2, z + 0.263, 0.032, length - 0.04, 0.026);
    }
    sign(x, 3.54, z + 0.40, 4.51, 0.64, "GJH VIRTUAL MALL");
    for (const [width, height, depth] of [[5.84, 0.23, 0.60], [6.04, 0.125, 0.79]]) {
      box(stone, x, height / 2, z + 0.53, width, height, depth);
    }
    decal(pool, x, 0.354, z - 0.58, 5.56, 3.45, -Math.PI / 2, 2);
    light(x, 2.03, z - 0.35, 11, 5.8);
    hit("mall", x, 1.95, z + 0.12, 5.16, 3.90, 0.58);
  }

  function streetLamp(x, z, size = 1) {
    tube(ink, x, 1.78 * size, z, 0.073 * size, 3.47 * size, 0.073 * size);
    tube(ink, x, 0.29 * size, z, 0.16 * size, 0.55 * size, 0.16 * size);
    tube(brass, x, 0.54 * size, z, 0.12 * size, 0.075 * size, 0.12 * size);
    const hook = mesh(new THREE.TorusGeometry(0.37 * size, 0.037 * size, 7, 24, Math.PI), ink,
      x + 0.36 * size, 3.44 * size, z);
    hook.rotation.y = -0.12;
    lantern(x + size * 0.71, 3.17 * size, z, 1.09 * size);
  }

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
    const umbrella = ["#7898b8", "#a6becd"].map((color) => new THREE.MeshStandardMaterial({
      color, side: THREE.DoubleSide, roughness: 0.42, transparent: true, opacity: 0.81,
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
    for (const offset of [-0.113, 0.03]) {
      ellipsoid(ink, x + offset - 0.071, 1.095, z + 0.248, 0.024, 0.034, 0.018);
    }
    for (const y of [0.55, 0.68, 0.80]) {
      ellipsoid(wood, x - 0.014, y, z + 0.162, 0.022, 0.024, 0.017);
    }
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

  function skyline() {
    const blockColors = ["#374a61", "#3f4c64", "#3f5267", "#526075"].map((color) => surface(color));
    const distantLight = glow("#b6a086");
    for (let i = 0; i < 29; i += 1) {
      const x = -22 + i * 3.25;
      const z = -15 - random() * 14;
      const height = 4.7 + random() * 6.0;
      const w = 1.0 + random() * 2.6;
      box(blockColors[i % 4], x, height / 2, z, w, height, 2.25);
      for (let row = 0; row < Math.floor(height / 0.49); row += 1) {
        for (let col = -1; col <= 1; col += 1) {
          if (random() > 0.67) box(distantLight, x + col * w / 3, row * 0.48 + 0.64, z + 1.129, w * 0.11, 0.11, 0.014);
        }
      }
    }
    for (const x of [17.8, 20.2]) {
      const z = -16.4;
      tube(blockColors[3], x, 5.78, z, 0.77, 11.56, 0.83);
      for (let tier = 0; tier < 11; tier += 1) {
        const taper = tier <= 6 ? 1 : 1 - (tier - 6) * 0.16;
        tube(blockColors[2], x, 5.54 + tier * 0.60, z, 0.86 * taper, 0.51, 0.91 * taper);
        tube(distantLight, x, 5.80 + tier * 0.60, z, 0.81 * taper, 0.033, 0.89 * taper);
      }
      tube(blockColors[3], x, 12.27, z, 0.113, 1.43, 0.12);
      ellipsoid(neon, x, 13.00, z, 0.06, 0.08, 0.06);
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
    }
    for (let col = 0; col < 21; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const x = -7.68 + col * 0.24;
        const z = 0.88 + row * 0.24;
        stamp(plane, encaustic, x, 0.046, z, 0.235, 0.235, 1, -Math.PI / 2);
      }
    }
    for (const x of [-7.78, -3.76, -0.72, 4.47, 9.97]) {
      box(ink, x, 0.003, 2.08, 0.47, 0.022, 0.26);
      for (let i = -3; i <= 3; i += 1) box(stone, x + i * 0.057, 0.016, 2.08, 0.018, 0.013, 0.235);
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
        float cloud = cloudNoise(p) * 0.64 + cloudNoise(p * 2.8) * 0.36 - 0.47;
        gl_FragColor = vec4(mix(bottom, top, height) * (1.0 + cloud * 0.48), 1.0);
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
  mall(11.98, -2.38);
  house(18.56, 6.80, -5.78, plaster[2], 6.78);
  house(25.29, 6.60, -7.20, plaster[3], 7.15);
  vending(-0.89, -0.05);
  planter(-8.73, 1.26, 1.46);
  planter(-9.21, 1.55, 0.69, false);
  planter(-7.68, 0.87, 0.73, false);
  planter(-1.87, 1.16, 0.88);
  planter(1.22, 0.66, 1.13, false);
  planter(3.35, 0.21, 1.18);
  planter(5.74, -1.91, 1.17);
  planter(6.59, -1.45, 0.74, false);
  planter(9.00, -1.85, 1.14);
  planter(14.97, -1.83, 1.27, false);
  planter(20.81, -2.28, 1.48);
  planter(-11.30, 1.37, 1.08, false);
  bench(-10.44, 0.44);
  streetLamp(15.46, -2.82, 1.20);
  streetLamp(3.77, 1.85, 0.99);
  streetLamp(-12.71, 1.81, 1.00);
  palm(7.12, -5.11, 6.20);
  palm(16.22, -5.95, 6.82);
  palm(21.54, -3.48, 6.18);
  palm(27.82, -2.43, 6.29);
  banner(3.50, 3.68, -0.32);
  banner(14.51, 3.55, -1.76);
  for (let i = 0; i < 5; i += 1) {
    const x = 5.1 + i * 0.96;
    const z = 1.61 - i * 0.75;
    tube(ink, x, 0.30, z, 0.066, 0.53, 0.066);
    ellipsoid(brass, x, 0.56, z, 0.092, 0.063, 0.092);
  }
  box(stone, 6.15, 0.045, 10.49, 6.20, 0.11, 3.15);
  planter(3.74, 9.40, 2.08, false, 0.10);
  planter(4.16, 9.85, 1.52, true, 0.10);
  visitor(1.13, 3.25);
  decal(shade, 1.13, 0.016, 3.25, 0.95, 0.71, -Math.PI / 2, 1);

  const slate = surface("#244438");
  const boardTilt = -0.16;
  box(wood, -2.83, 0.53, 1.39, 0.69, 1.00, 0.11, boardTilt, 0.30);
  box(slate, -2.83, 0.55, 1.45, 0.55, 0.79, 0.034, boardTilt, 0.30);
  box(wood, -2.83, 0.52, 1.17, 0.69, 1.02, 0.085, 0.28, 0.30);
  for (const y of [0.42, 0.55, 0.66]) {
    box(brass, -2.81, y, 1.475 - (y - 0.55) * 0.16, 0.36, 0.025, 0.006, boardTilt, 0.30);
  }

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
    litTimber.emissiveIntensity = night ? 0.65 : 0.22;
    displayLight.emissiveIntensity = night ? 2.2 : 0.32;
    pool.opacity = night ? 0.78 : 0.10;
    lampGlow.emissiveIntensity = night ? 3.3 : 0.27;
    neon.emissiveIntensity = night ? 2.85 : 0.41;
    haloMaterial.opacity = night ? 0.7 : 0;
    for (const material of signMaterials) material.emissiveIntensity = night ? 0.77 : 0.14;
  }

  return { hitTargets, setNight };
}
