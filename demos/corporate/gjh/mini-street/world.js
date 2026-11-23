import * as THREE from "../v11/vendor/three.module.min.js";

const NIGHT = {
  sky: "#2c4966", haze: "#415d72", top: "#132743", ground: "#735255", ambient: "#bbd4ff",
  sun: "#b5caff", skyPower: 1.0, sunPower: 1.38, warmly: 1, glass: 2.1,
};
const DAY = {
  sky: "#b5d8de", haze: "#aac9c7", top: "#508eaa", ground: "#ae9583", ambient: "#d4ebff",
  sun: "#ffe1b0", skyPower: 2.05, sunPower: 2.7, warmly: 0.15, glass: 0.06,
};

export const REFLECTED = 1;

export function buildWorld(scene) {
  let seed = 21973;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const surface = (color, roughness = 0.77) => new THREE.MeshStandardMaterial({ color, roughness });
  const glow = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 });
  const plaster = ["#daa580", "#e0bd92", "#bc876c", "#c7ab85"].map((color) => surface(color));
  const cream = surface("#f8d4a5");
  const lightCream = surface("#fce4bd");
  const stone = surface("#92715c");
  const deepGreen = surface("#163e30");
  const lightGreen = surface("#34624d");
  const ink = surface("#202e2a");
  const wood = surface("#653c29");
  const cane = surface("#b17542");
  const brass = surface("#c38b52", 0.36);
  const brick = surface("#764b40");
  const redTiles = ["#794739", "#a45b46", "#b2684d", "#97533e", "#844236", "#ba6b50"].map((color) => surface(color));
  const foliage = ["#1c542f", "#397142", "#54804b", "#658744", "#336247"].map((color) => surface(color));
  const flowers = ["#c7513e", "#e27959", "#f1ad65", "#df9c9c"].map((color) => surface(color));
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
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const ball = new THREE.SphereGeometry(1, 11, 7);
  const leaf = new THREE.SphereGeometry(1, 7, 4);
  const lanternRib = new THREE.TorusGeometry(0.204, 0.008, 4, 15);
  const pot = new THREE.CylinderGeometry(0.36, 0.25, 0.52, 10);
  const instances = new Map();
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
    return mesh(archGeometry(radius, band, legs, depth), material, x, y, z);
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
    ctx.shadowBlur = 15;
    if (kind === "moon") {
      ctx.beginPath();
      ctx.arc(w * 0.18, h * 0.5, h * 0.29, 0.65, 5.63);
      ctx.quadraticCurveTo(w * 0.135, h * 0.5, w * 0.18 + Math.cos(0.65) * h * 0.29, h * 0.5 + Math.sin(0.65) * h * 0.29);
      ctx.fill();
      ctx.font = `${h * 0.56}px Georgia`;
      ctx.fillText(title, w * 0.595, h * 0.54, w * 0.66);
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
    halo.scale.set(1.16 * size, 1.16 * size, 1);
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
    tube(brass, x, base + 0.50 * size, z, 0.375 * size, 0.048 * size, 0.375 * size);
    tube(wood, x, base + 0.515 * size, z, 0.32 * size, 0.01, 0.32 * size);
    for (let i = 0; i < 12; i += 1) {
      const angle = i * 2.4;
      const length = 0.28 + random() * 0.4;
      const radius = (0.16 + random() * 0.29) * size;
      const y = base + (0.72 + random() * 0.53) * size;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      stamp(leaf, foliage[i % foliage.length], x + dx, y, z + dz,
        length * size, 0.065 * size, 0.17 * size, 0, -angle, 0.30 + random() * 0.65);
      if (i % 4 === 0) {
        ellipsoid(flowers[i % 3], x + dx, y + 0.16 * size, z + dz,
          0.10 * size, 0.13 * size, 0.085 * size);
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
          tube(redTiles[Math.floor(random() * redTiles.length)], tx, peak + 0.105 - t * rise, z + side * t * depth,
            step * 0.46, run / 6 + 0.045, 0.087, Math.PI / 2 + side * slope);
        }
      }
    }
    tube(redTiles[3], x, peak + 0.12, z, 0.16, width + 0.70, 0.16, 0, 0, Math.PI / 2);
    box(cream, x, peak - rise - 0.08, z + depth, width + 0.55, 0.16, 0.2);
    for (let i = 0; i < count; i += 2) {
      box(wood, x - width / 2 + i * step, peak - rise - 0.22, z + depth - 0.07, 0.15, 0.19, 0.27);
    }
  }

  function upperWindow(x, y, z, index) {
    const half = 0.59;
    box(stone, x, y - 0.40, z, 1.52, 1.93, 0.10);
    mesh(archFill(half, 1.16), windows[index % windows.length], x, y, z + 0.065);
    arch(x, y, z + 0.046, half, 0.105, 1.16, deepGreen, 0.13);
    box(deepGreen, x, y - 1.17, z + 0.10, 1.40, 0.12, 0.21);
    for (const offset of [-0.30, 0, 0.30]) {
      box(wood, x + offset, y - 0.36, z + 0.105, 0.042, offset === 0 ? 1.56 : 1.48, 0.049);
    }
    for (const offset of [-0.65, -0.22, 0.03]) {
      box(wood, x, y + offset, z + 0.105, 1.17, 0.048, 0.043);
    }
    for (const side of [-1, 1]) {
      box(deepGreen, x + side * 0.83, y - 0.43, z + 0.18, 0.33, 1.44, 0.07, 0, side * -0.37);
      for (let i = 0; i < 11; i += 1) {
        box(lightGreen, x + side * 0.83, y - 1.00 + i * 0.107, z + 0.226, 0.29, 0.043, 0.075, -0.18, side * -0.37);
      }
    }
    box(cream, x, y - 1.225, z + 0.13, 1.64, 0.105, 0.33);
    if (index % 2 === 0) {
      box(wood, x, y - 1.045, z + 0.26, 1.05, 0.18, 0.26);
      for (let i = 0; i < 13; i += 1) {
        const bx = x - 0.52 + i * 0.085;
        ellipsoid(foliage[i % 5], bx, y - 0.94 - random() * 0.12, z + 0.38, 0.12, 0.1, 0.10);
        if (i % 3 !== 1) {
          ellipsoid(flowers[i % 4], bx, y - 0.89 - random() * 0.09, z + 0.44, 0.05, 0.055, 0.04);
        }
      }
    }
  }

  function pier(x, z, height) {
    box(cream, x, height / 2, z, 0.42, height, 0.32);
    box(stone, x, 0.24, z + 0.035, 0.51, 0.40, 0.44);
    const bandY = height - 0.27;
    box(cream, x, bandY, z + 0.05, 0.59, 0.24, 0.43);
    box(lightCream, x, bandY + 0.20, z + 0.09, 0.65, 0.13, 0.44);
    box(lightGreen, x, height - 1.27, z + 0.17, 0.26, 1.26, 0.035);
    for (let i = 0; i < 6; i += 1) {
      const y = height - 1.80 + i * 0.205;
      box(cream, x, y, z + 0.194, 0.132, 0.124, 0.022, 0, 0, Math.PI / 4);
      box(i % 2 === 0 ? brick : brass, x, y, z + 0.207, 0.062, 0.062, 0.021, 0, 0, Math.PI / 4);
    }
  }

  function shutters(x, z, width, shop) {
    const glass = windows[shop ? 1 : 0];
    const displayWidth = width - 0.89;
    const frame = shop ? deepGreen : wood;
    box(frame, x, 1.37, z, displayWidth, 2.57, 0.20);
    box(glass, x, 1.54, z + 0.109, displayWidth - 0.25, 2.08, 0.035);
    box(brass, x, 0.60, z + 0.148, displayWidth - 0.10, 0.10, 0.101);
    const panels = shop ? 5 : 4;
    for (let i = 0; i <= panels; i += 1) {
      const bx = x - displayWidth / 2 + i * displayWidth / panels;
      box(frame, bx, 1.44, z + 0.17, 0.105, 2.52, 0.11);
    }
    for (const y of [1.08, 1.64, 2.11, 2.56]) {
      box(frame, x, y, z + 0.165, displayWidth, 0.071, 0.095);
    }
    if (!shop) return;
    for (let i = 0; i < 20; i += 1) {
      const xPack = x - 2.48 + (i % 7) * 0.28;
      const yPack = 0.70 + Math.floor(i / 7) * 0.53;
      const color = [cream, brick, cane, lightGreen][i % 4];
      tube(color, xPack, yPack, z + 0.157, 0.082, 0.12, 0.036);
      tube(brass, xPack, yPack + 0.055, z + 0.158, 0.087, 0.021, 0.04);
    }
    for (const dx of [1.16, 1.40]) {
      box(brass, x + dx, 1.14, z + 0.255, 0.055, 0.29, 0.055);
    }
  }

  function awning(x, z, width) {
    const stripes = 19;
    const w = width / stripes;
    for (let i = 0; i < stripes; i += 1) {
      const tx = x - width / 2 + (i + 0.5) * w;
      const material = i % 2 === 0 ? deepGreen : cream;
      box(material, tx, 2.78, z + 0.63, w + 0.004, 0.044, 1.3, 0.26);
      box(material, tx, 2.575, z + 1.246, w + 0.004, 0.14, 0.045);
      tube(material, tx, 2.506, z + 1.246, 0.065, w + 0.004, 0.023, 0, 0, Math.PI / 2);
    }
  }

  function house(x, width, z, wall, peak, shop = false) {
    box(wall, x, 2.84, z - 2.06, width, 5.64, 4.16);
    box(stone, x, 0.13, z - 1.88, width + 0.12, 0.25, 4.25);
    box(cream, x, 3.61, z + 0.08, width + 0.17, 0.16, 0.37);
    box(stone, x, 3.71, z + 0.035, width + 0.16, 0.055, 0.27);
    box(brick, x, 5.45, z + 0.02, width + 0.23, 0.086, 0.17);
    for (const side of [-1, 1]) pier(x + side * (width / 2 - 0.13), z + 0.11, 5.73);
    for (let i = 0; i < 3; i += 1) upperWindow(x + (i - 1) * (width * 0.274), 4.99, z + 0.09, i + (shop ? 0 : 1));
    shutters(x, z + 0.1, width, shop);
    roof(x, width, z - 2.15, peak);
    if (shop) {
      sign(x, 3.25, z + 0.28, width - 0.66, 0.78, "New Moon", "moon");
      awning(x, z + 0.12, width - 0.6);
      for (const side of [-1, 1]) lantern(x + side * (width / 2 - 0.06), 2.55, z + 0.64, 1.09);
      light(x, 2.12, z + 1.10, 17, 7);
      hit("shop", x, 1.85, z + 0.17, width - 0.55, 3.68, 0.50);
    } else {
      lantern(x + width / 2 - 0.30, 2.57, z + 0.48, 0.75);
    }
  }

  function arcade(x, z) {
    box(plaster[1], x, 4.82, z - 1.90, 5.46, 1.68, 3.95);
    box(wood, x, 1.99, z - 2.10, 5.46, 3.98, 0.36);
    for (const offset of [-1.26, 1.26]) {
      arch(x + offset, 2.89, z, 0.96, 0.29, 2.81, cream, 0.32);
      arch(x + offset, 2.89, z + 0.32, 0.97, 0.085, 2.81, stone, 0.062);
      mesh(archFill(0.77, 2.66), windows[offset < 0 ? 2 : 3], x + offset, 2.84, z - 1.91);
      for (const dx of [-0.45, 0, 0.45]) {
        box(wood, x + offset + dx, 1.81, z - 1.87, 0.071, 3.19, 0.081);
      }
      box(wood, x + offset, 2.60, z - 1.87, 1.54, 0.10, 0.08);
      lantern(x + offset, 2.68, z - 0.70, 0.74);
    }
    box(cream, x, 4.16, z + 0.05, 5.67, 0.25, 0.31);
    box(stone, x, 4.37, z - 0.04, 5.48, 0.16, 0.28);
    upperWindow(x - 1.20, 4.99, z + 0.08, 2);
    upperWindow(x + 1.18, 4.99, z + 0.08, 3);
    roof(x, 5.42, z - 2.13, 6.83);
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
    box(neon, x, 0.22, z + 0.422, 0.70, 0.055, 0.038);
    light(x, 1.17, z + 0.66, 2.8, 3);
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
    mesh(archFill(radius - 0.05, 2.26), windows[2], x, spring, z - 2.49);
    for (let i = -4; i <= 4; i += 1) {
      box(deepGreen, x + i * 0.51, 1.65, z - 2.44, 0.069, 3.37, 0.09);
    }
    box(wood, x, 1.95, z - 2.43, 4.58, 0.13, 0.07);
    const mallCornice = archGeometry(radius, 0.42, 2.28, 0.45);
    mesh(mallCornice, deepGreen, x, spring, z);
    arch(x, spring, z + 0.458, radius + 0.04, 0.07, 2.28, neon, 0.025);
    arch(x, spring, z + 0.463, radius + 0.31, 0.041, 2.28, brass, 0.035);
    arch(x, spring - 0.09, z - 1.04, radius - 0.21, 0.054, 2.15, windows[3], 0.27);
    arch(x, spring - 0.16, z - 1.83, radius - 0.34, 0.067, 2.10, windows[2], 0.23);
    for (let i = 1; i < 19; i += 1) {
      const angle = i * Math.PI / 19;
      const r = radius + 0.215;
      box(brass, x + Math.cos(angle) * r, spring + Math.sin(angle) * r, z + 0.49, 0.16, 0.044, 0.042, 0, 0, angle);
    }
    sign(x, 3.68, z + 0.40, 3.91, 0.70, "GJH VIRTUAL MALL");
    light(x, 1.90, z + 0.10, 16, 8);
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

  function visitor(x, z) {
    const coat = surface("#e3ae4e");
    const face = surface("#e4ae8c");
    const hair = surface("#392a2d");
    const umbrella = [surface("#8ba8bd"), surface("#b3c7d5")];
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
    tube(brass, handleX, 1.32, z + 0.014, 0.018, 1.31, 0.018, 0, 0, -0.15);
    const rim = new THREE.TorusGeometry(0.686, 0.013, 4, 16);
    for (let slice = 0; slice < 8; slice += 1) {
      const wedge = new THREE.SphereGeometry(0.73, 2, 5, slice * Math.PI / 4, Math.PI / 4, 0, Math.PI * 0.39);
      const panel = mesh(wedge, umbrella[slice % 2], handleX + 0.086, 1.68, z, true);
      panel.scale.y = 0.56;
      panel.rotation.z = -0.15;
    }
    const edge = mesh(rim, cream, handleX + 0.11, 1.814, z);
    edge.rotation.set(Math.PI / 2, 0, -0.15, "ZYX");
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
    for (let i = 0; i < 18; i += 1) {
      const x = -23 + i * 2.85;
      const z = -11 - random() * 12;
      const height = 2.9 + random() * 5.5;
      const w = 1.0 + random() * 2.6;
      box(blockColors[i % 4], x, height / 2, z, w, height, 2.25);
      for (let row = 0; row < Math.floor(height / 0.49); row += 1) {
        for (let col = -1; col <= 1; col += 1) {
          if (random() > 0.67) box(distantLight, x + col * w / 3, row * 0.48 + 0.64, z + 1.129, w * 0.11, 0.11, 0.014);
        }
      }
    }
    for (const x of [9.7, 12.1]) {
      const z = -17.8;
      tube(blockColors[3], x, 4.63, z, 0.77, 9.26, 0.83);
      for (let tier = 0; tier < 11; tier += 1) {
        const taper = tier <= 6 ? 1 : 1 - (tier - 6) * 0.16;
        tube(blockColors[2], x, 3.3 + tier * 0.58, z, 0.86 * taper, 0.48, 0.91 * taper);
        tube(distantLight, x, 3.54 + tier * 0.58, z, 0.81 * taper, 0.027, 0.89 * taper);
      }
      tube(blockColors[3], x, 9.6, z, 0.113, 1.24, 0.12);
      ellipsoid(neon, x, 10.23, z, 0.06, 0.08, 0.06);
    }
  }

  function paving() {
    function brickTexture(road) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = road ? "#394047" : "#866353";
      ctx.fillRect(0, 0, 512, 512);
      const columns = road ? 6 : 4;
      const rows = road ? 10 : 4;
      const w = 512 / columns;
      const h = 512 / rows;
      const hues = road ? ["#5b5555", "#555052", "#514c52", "#615b56"] : ["#ae8468", "#9e7863", "#ac8269", "#be947b"];
      for (let row = 0; row < rows; row += 1) {
        for (let col = -1; col < columns; col += 1) {
          const x = (col + (row % 2) * 0.5) * w;
          const y = row * h;
          ctx.fillStyle = hues[Math.floor(random() * hues.length)];
          ctx.fillRect(x + 1.4, y + 1.4, w - 2.8, h - 2.8);
          ctx.fillStyle = road ? "#75676b" : "#cea58d";
          ctx.fillRect(x + 2, y + 2, w - 4, 1.8);
        }
      }
      for (let i = 0; i < 5100; i += 1) {
        ctx.fillStyle = i % 2 ? "#161b2014" : "#fff4da12";
        ctx.fillRect(random() * 512, random() * 512, 0.7 + random() * 3, 0.7 + random() * 2);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(road ? 12 : 27, road ? 10 : 2);
      texture.anisotropy = 4;
      return texture;
    }
    function ground(w, d, y, z, road) {
      const material = new THREE.MeshStandardMaterial({
        map: brickTexture(road), roughness: road ? 0.41 : 0.64, metalness: road ? 0.12 : 0,
      });
      mesh(new THREE.PlaneGeometry(w, d), material, 0, y, z, false).rotation.x = -Math.PI / 2;
    }
    ground(85, 64, -0.014, 7, true);
    ground(54, 3.43, 0.04, 0.17, false);
    for (let i = -22; i < 22; i += 1) {
      box(stone, i * 0.73, 0.006, 1.90, 0.711, 0.075, 0.28);
      box(cream, i * 0.73, 0.046, 1.84, 0.716, 0.032, 0.17);
    }
    for (let col = 0; col < 19; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const x = -6.46 + col * 0.24;
        const z = 0.87 + row * 0.24;
        box(row === 1 ? lightGreen : cream, x, 0.052, z, 0.224, 0.018, 0.224);
        box(row === 1 ? cream : brick, x, 0.062, z, 0.11, 0.010, 0.11, 0, Math.PI / 4);
      }
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
      void main() {
        vec3 dir = normalize(vSky);
        float height = smoothstep(-0.03, 0.48, dir.y);
        float cloud = sin(dir.x * 23.0 + dir.z * 19.0 + dir.y * 31.0);
        cloud *= sin(dir.x * 10.0 - dir.z * 17.0 - dir.y * 46.0);
        gl_FragColor = vec4(mix(bottom, top, height) + cloud * 0.011, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  mesh(new THREE.SphereGeometry(92, 30, 18), sky, 0, 0, 0).renderOrder = -1;
  scene.fog = new THREE.FogExp2(NIGHT.haze, 0.023);
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
  arcade(1.30, -0.86);
  mall(8.3, -1.55);
  house(15.24, 6.54, -2.43, plaster[3], 6.81);
  vending(-0.89, -0.05);
  planter(-8.90, 1.06, 1.48);
  planter(-7.68, 0.87, 0.73, false);
  planter(-1.99, 1.09, 1.06);
  planter(1.22, 0.66, 1.13, false);
  planter(3.35, 0.21, 1.18);
  planter(5.25, -0.20, 1.22);
  planter(11.45, 0.37, 1.22);
  planter(12.47, 1.55, 1.5, false);
  planter(-11.30, 1.37, 1.08, false);
  bench(-10.44, 0.44);
  streetLamp(11.96, 1.87, 1.05);
  streetLamp(3.52, 1.89, 0.87);
  streetLamp(-12.71, 1.81, 1.00);
  visitor(0.99, 3.24);

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
    lampGlow.emissiveIntensity = night ? 3.3 : 0.27;
    neon.emissiveIntensity = night ? 2.85 : 0.41;
    haloMaterial.opacity = night ? 0.7 : 0;
    for (const material of signMaterials) material.emissiveIntensity = night ? 0.77 : 0.14;
  }

  return { hitTargets, setNight };
}
