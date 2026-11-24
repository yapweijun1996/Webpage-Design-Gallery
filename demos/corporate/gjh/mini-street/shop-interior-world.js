import { paintedTexture } from "./surfaces.js";

const HALF_WIDTH = 3.55;
const HALF_DEPTH = 4.25;
const CEILING = 3.26;

export const SHOP_SPAWN = Object.freeze({
  x: 0.05, z: 3.5, yaw: -0.085, pitch: -0.220,
});

const anchors = [
  ["entry-display", "island", 0.24, 1.03, 1.29, 0],
  ["right-shelf-front", "right", 3.01, 1.31, 1.26, -Math.PI / 2],
  ["right-shelf-middle", "right", 3.01, 1.31, -0.55, -Math.PI / 2],
  ["back-shelf-left", "back", -1.75, 1.31, -3.71, 0],
  ["back-shelf-right", "back", 1.51, 1.31, -3.71, 0],
  ["island-side", "island", -0.33, 1.03, 0.09, -Math.PI / 2],
];

export const SHOP_ANCHORS = Object.freeze(anchors.map(([id, display, x, y, z, rotationY]) =>
  Object.freeze({ id, display, position: Object.freeze([x, y, z]), rotationY })
));

function seededRandom() {
  let seed = 76049;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function tileTexture(THREE, random) {
  const texture = paintedTexture(512, 512, (ctx, size) => {
    const tiles = 5;
    const step = size / tiles;
    const colors = ["#b5ab99", "#bcb2a1", "#c3b8a5", "#b7ad99", "#c8bca9"];
    ctx.fillStyle = "#928c81";
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < tiles; row += 1) {
      for (let col = 0; col < tiles; col += 1) {
        const x = col * step;
        const y = row * step;
        ctx.fillStyle = colors[Math.floor(random() * colors.length)];
        ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
        ctx.fillStyle = "#e2d7bf";
        ctx.fillRect(x + 1, y + 1, step - 2, 1);
        for (let grain = 0; grain < 230; grain += 1) {
          ctx.fillStyle = grain % 2 ? "#e5dbca55" : "#60574840";
          ctx.fillRect(x + 2 + random() * (step - 7), y + 2 + random() * (step - 7),
            0.5 + random() * 3, 0.5 + random() * 2.6);
        }
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3.6);
  return texture;
}

function timberTexture(random) {
  return paintedTexture(512, 256, (ctx, width, height) => {
    ctx.fillStyle = "#a27553";
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 440; i += 1) {
      const y = random() * height;
      ctx.strokeStyle = i % 2 ? "#3a281d43" : "#e6bc9366";
      ctx.lineWidth = 0.3 + random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(width * 0.35, y - 4, width * 0.65, y + 3, width, y - 1);
      ctx.stroke();
    }
  });
}

function shopSign() {
  return paintedTexture(1024, 256, (ctx, width, height) => {
    ctx.fillStyle = "#164437";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#b6a176";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 17, width - 36, height - 34);
    ctx.strokeStyle = "#c9b68b";
    ctx.beginPath();
    ctx.arc(137, 127, 59, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#eddfbc";
    ctx.beginPath();
    ctx.arc(139, 125, 44, 0.85, 5.35);
    ctx.quadraticCurveTo(114, 125, 168, 158);
    ctx.fill();
    ctx.font = "89px Georgia, serif";
    ctx.fillText("NEW MOON", 242, 145);
    ctx.fillStyle = "#dbc9a1";
    ctx.font = "500 27px system-ui, sans-serif";
    ctx.letterSpacing = "7px";
    ctx.fillText("PANTRY & GROCERIES", 248, 195);
  });
}

function groceryMaterial(THREE, { color, title, line }) {
  const map = paintedTexture(128, 128, (ctx, width, height) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f2ede1";
    ctx.fillRect(12, 22, 104, 73);
    ctx.strokeStyle = "#413e34";
    ctx.strokeRect(17, 27, 94, 62);
    ctx.fillStyle = "#322d26";
    ctx.textAlign = "center";
    ctx.font = "bold 27px Georgia, serif";
    ctx.fillText(title, 64, 59, 83);
    ctx.font = "9px sans-serif";
    ctx.fillText(line, 64, 75, 75);
    ctx.fillStyle = "#ffffff55";
    ctx.fillRect(0, 2, width, 4);
    ctx.fillStyle = "#00000025";
    ctx.fillRect(0, height - 7, width, 7);
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.51 });
}

function shadowMap() {
  return paintedTexture(64, 64, (ctx, size) => {
    const radius = size / 2;
    const color = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    color.addColorStop(0, "#231b12a0");
    color.addColorStop(0.57, "#261d1554");
    color.addColorStop(1, "#261d1500");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
  });
}

export function buildShopInterior(THREE, scene, productCount) {
  const random = seededRandom();
  const room = new THREE.Group();
  scene.add(room);
  const unitBox = new THREE.BoxGeometry();
  const unitCan = new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1, true);
  const unitLid = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  const surfaces = new Map();
  const colliders = [];
  const occluders = [];
  const occupiedAnchors = SHOP_ANCHORS.slice(0, productCount);
  const finish = (color, roughness = 0.86, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const wall = finish(0xf1e5cf);
  const ceiling = finish(0xdfdacf);
  const paintedGreen = finish(0x37594a);
  const deepGreen = finish(0x234439);
  const dark = finish(0x30342d);
  const shelf = finish(0xbebbae, 0.74);
  const brushed = finish(0xa9a99c, 0.34, 0.38);
  const brass = finish(0xb49a61, 0.42, 0.38);
  const stone = finish(0x57584f, 0.63);
  const paper = finish(0xd1b98e);
  const rubber = finish(0x303731);
  const timber = new THREE.MeshStandardMaterial({ map: timberTexture(random), roughness: 0.63 });
  const shadow = new THREE.MeshBasicMaterial({
    map: shadowMap(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  });

  function box(parent, material, size, position, occludes = false) {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    if (occludes) occluders.push(mesh);
    return mesh;
  }

  function plane(parent, material, width, height, x, y, z, yaw = 0) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    parent.add(mesh);
    return mesh;
  }

  function block(x, z, width, depth) {
    colliders.push({
      left: x - width / 2, right: x + width / 2,
      back: z - depth / 2, front: z + depth / 2,
    });
    plane(room, shadow, width + 0.52, depth + 0.50, x, 0.006, z).rotation.x = -Math.PI / 2;
  }

  function area(name, x, z, yaw = 0) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    room.add(group);
    return group;
  }

  const floor = new THREE.MeshStandardMaterial({
    map: tileTexture(THREE, random), roughness: 0.61,
  });
  plane(room, floor, HALF_WIDTH * 2, HALF_DEPTH * 2, 0, 0, 0).rotation.x = -Math.PI / 2;
  box(room, ceiling, [7.18, 0.08, 8.56], [0, CEILING, 0], true);
  box(room, wall, [0.12, CEILING, 8.5], [-HALF_WIDTH, CEILING / 2, 0], true);
  box(room, wall, [0.12, CEILING, 8.5], [HALF_WIDTH, CEILING / 2, 0], true);
  box(room, wall, [7.1, CEILING, 0.12], [0, CEILING / 2, -HALF_DEPTH], true);
  box(room, wall, [1.70, CEILING, 0.12], [-2.70, CEILING / 2, HALF_DEPTH], true);
  box(room, wall, [1.70, CEILING, 0.12], [2.70, CEILING / 2, HALF_DEPTH], true);
  box(room, wall, [3.75, 0.48, 0.12], [0, CEILING - 0.24, HALF_DEPTH], true);

  for (const side of [-1, 1]) {
    box(room, paintedGreen, [0.07, 1.10, 8.46], [side * 3.475, 0.55, 0]);
    box(room, timber, [0.095, 0.078, 8.46], [side * 3.454, 1.12, 0]);
    box(room, dark, [0.095, 0.10, 8.46], [side * 3.45, 0.055, 0]);
    box(room, wall, [0.21, 0.21, 8.50], [side * 3.35, 3.085, 0]);
    box(room, paintedGreen, [0.045, 0.95, 1.60], [side * 2.73, 0.49, 4.163]).rotation.y = Math.PI / 2;
    box(room, timber, [1.6, 0.08, 0.14], [side * 2.73, 0.97, 4.13]);
  }

  const evening = new THREE.MeshBasicMaterial({ map: paintedTexture(512, 256, (ctx, w, h) => {
    const light = ctx.createLinearGradient(0, 0, 0, h);
    light.addColorStop(0, "#354b56");
    light.addColorStop(0.46, "#273b46");
    light.addColorStop(1, "#191d25");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i += 1) {
      const x = random() * w;
      const y = random() * h;
      ctx.fillStyle = i % 3 ? "#7997a952" : "#b4a27a48";
      ctx.fillRect(x, y, 1, 5 + random() * 13);
    }
  }) });
  plane(room, evening, 3.64, 2.8, 0, 1.40, 4.24, Math.PI);
  for (const x of [-1.83, -0.89, 0, 0.89, 1.83]) {
    box(room, deepGreen, [0.058, 2.81, 0.115], [x, 1.405, 4.155]);
  }
  for (const y of [0.07, 0.61, 2.13, 2.79]) {
    box(room, deepGreen, [3.72, 0.065, 0.115], [0, y, 4.155]);
  }
  for (const x of [-0.115, 0.115]) {
    box(room, brass, [0.035, 0.29, 0.09], [x, 1.11, 4.047]);
  }
  box(room, brass, [3.57, 0.017, 0.095], [0, 0.012, 4.025]);
  box(room, rubber, [1.54, 0.02, 0.63], [0, 0.015, 3.72]);
  for (let stripe = 0; stripe < 8; stripe += 1) {
    box(room, dark, [1.49, 0.005, 0.019], [0, 0.028, 3.47 + stripe * 0.07]);
  }

  box(room, timber, [3.12, 0.78, 0.087], [0, 2.68, -4.125]);
  const sign = new THREE.MeshStandardMaterial({
    map: shopSign(), emissive: 0xc4ae81, emissiveIntensity: 0.15, roughness: 0.64,
  });
  plane(room, sign, 3.00, 0.70, 0, 2.68, -4.077);
  box(room, paintedGreen, [1.73, 0.29, 0.045], [1.51, 2.68, -3.34]).rotation.y = -Math.PI / 2;

  const stock = [
    { color: "#963f37", title: "STOCK", line: "PANTRY STAPLES" },
    { color: "#2d5c53", title: "TEA", line: "JASMINE LEAVES" },
    { color: "#a67833", title: "RICE", line: "FRAGRANT RICE" },
    { color: "#405567", title: "SOY", line: "PANTRY STAPLES" },
    { color: "#995c37", title: "NOODLES", line: "DRIED WHEAT" },
    { color: "#6b504d", title: "BISCUITS", line: "BUTTER & OAT" },
  ].map((item) => groceryMaterial(THREE, item));

  function batch(geometry, material, position, scale, rotation = 0) {
    let list = surfaces.get(material);
    if (!list) {
      list = { geometry, items: [] };
      surfaces.set(material, list);
    }
    list.items.push({ position, scale, rotation });
  }

  function lineOfStock(group, width, y, row) {
    for (let x = -width / 2 + 0.21, column = 0; x < width / 2 - 0.12; x += 0.205, column += 1) {
      const worldPosition = group.localToWorld(new THREE.Vector3(x, y, 0.23));
      if (occupiedAnchors.some(({ position }) =>
        Math.abs(position[1] - y) < 0.14 &&
        Math.hypot(position[0] - worldPosition.x, position[2] - worldPosition.z) < 0.28)) continue;
      if (random() < 0.065) continue;
      const color = (Math.floor(column / 3) + row * 2) % stock.length;
      const can = color < 2;
      const w = can ? 0.108 : 0.115 + random() * 0.057;
      const h = can ? 0.118 : 0.129 + random() * 0.087;
      const yaw = group.rotation.y + (random() - 0.5) * 0.13 + (can ? Math.PI / 2 : 0);
      const front = 0.012 + random() * 0.045;
      for (let depth = 0; depth < 2; depth += 1) {
        if (depth && random() < 0.25) continue;
        const location = group.localToWorld(new THREE.Vector3(x, y + h / 2, 0.24 - front - depth * 0.18));
        batch(can ? unitCan : unitBox, stock[color], location.toArray(), [w, h, can ? w : 0.12], yaw);
        if (can) {
          for (const side of [-1, 1]) {
            batch(unitLid, brushed, [location.x, location.y + side * h / 2, location.z], [w + 0.004, 0.008, w + 0.004]);
          }
        }
      }
    }
  }

  const labelRail = new THREE.MeshStandardMaterial({
    map: paintedTexture(512, 32, (ctx, width, height) => {
      ctx.fillStyle = "#96978e";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#e1e0cf";
      ctx.fillRect(0, 4, width, 1);
      for (let x = 15; x < width; x += 71) {
        ctx.fillStyle = "#f1e7cf";
        ctx.fillRect(x, 6, 34, 21);
        ctx.fillStyle = "#403b32";
        ctx.font = "11px sans-serif";
        ctx.fillText(["2.80", "3.50", "4.20"][Math.round(x / 71) % 3], x + 4, 21);
      }
    }),
    roughness: 0.65,
  });

  function wallShelf(name, x, z, width, yaw) {
    const group = area(name, x, z, yaw);
    box(group, deepGreen, [width, 2.24, 0.07], [0, 1.20, -0.235], true);
    box(group, dark, [width, 0.13, 0.53], [0, 0.069, 0], true);
    for (let bay = 0; bay <= 3; bay += 1) {
      for (const railDepth of [-0.22, 0.25]) {
        box(group, paintedGreen, [0.046, 2.22, 0.052], [width * (bay / 3 - 0.5), 1.18, railDepth], true);
      }
    }
    for (const [row, y] of [0.31, 0.81, 1.31, 1.81, 2.29].entries()) {
      box(group, shelf, [width, 0.036, 0.56], [0, y - 0.018, 0.013], true);
      plane(group, labelRail, width, 0.041, 0, y - 0.019, 0.295);
      if (row < 4) lineOfStock(group, width, y, row);
    }
  }
  wallShelf("Rear grocery shelves", -0.09, -3.92, 6.10, 0);
  block(-0.09, -3.91, 6.16, 0.64);
  wallShelf("Right grocery shelves", 3.23, -0.33, 5.08, -Math.PI / 2);
  block(3.23, -0.33, 0.64, 5.12);

  const counter = area("Checkout counter", -2.57, 2.11);
  box(counter, timber, [1.31, 0.93, 1.54], [0, 0.51, 0], true);
  box(counter, stone, [1.39, 0.076, 1.63], [0, 0.996, 0], true);
  box(counter, dark, [1.28, 0.083, 1.49], [0, 0.061, 0]);
  box(counter, brass, [0.013, 0.025, 1.38], [0.661, 0.86, 0]);
  for (let panel = 0; panel < 8; panel += 1) {
    box(counter, deepGreen, [0.015, 0.64, 0.009], [0.661, 0.48, -0.68 + panel * 0.191]);
  }
  const checkout = new THREE.MeshStandardMaterial({
    map: paintedTexture(384, 96, (ctx, w, h) => {
      ctx.fillStyle = "#284a3d";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#b4a688";
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = "#e7d9bc";
      ctx.font = "600 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CHECKOUT", w / 2, 61);
    }),
    roughness: 0.6,
  });
  plane(counter, checkout, 0.70, 0.16, 0.668, 0.70, -0.01, Math.PI / 2);
  box(counter, dark, [0.35, 0.08, 0.36], [-0.32, 1.079, 0.10]);
  box(counter, dark, [0.08, 0.17, 0.125], [-0.32, 1.19, 0.10]);
  box(counter, dark, [0.048, 0.235, 0.36], [-0.32, 1.35, 0.10]).rotation.z = 0.13;
  const screen = new THREE.MeshBasicMaterial({ color: 0x667f77 });
  plane(counter, screen, 0.313, 0.180, -0.293, 1.353, 0.10, Math.PI / 2);
  box(counter, brushed, [0.16, 0.032, 0.235], [0.23, 1.054, -0.31]).rotation.y = -0.12;
  box(counter, dark, [0.107, 0.04, 0.19], [0.23, 1.077, -0.31]).rotation.y = -0.12;
  box(counter, paper, [0.085, 0.006, 0.22], [0.24, 1.041, 0.21]).rotation.y = 0.18;
  block(-2.57, 2.11, 1.39, 1.63);

  const island = area("Island display", 0.27, 0.28);
  box(island, timber, [1.40, 0.85, 2.37], [0, 0.493, 0], true);
  box(island, paintedGreen, [1.415, 0.12, 2.38], [0, 0.09, 0]);
  box(island, stone, [1.45, 0.077, 2.42], [0, 0.956, 0], true);
  box(island, brass, [1.455, 0.015, 2.425], [0, 0.977, 0]);
  box(island, deepGreen, [1.20, 0.54, 0.018], [0, 0.53, 1.19]);
  box(island, brushed, [0.43, 0.052, 0.44], [-0.03, 1.004, 0.98]);
  box(island, brushed, [0.21, 0.052, 0.35], [-0.60, 1.004, -0.19]);
  block(0.27, 0.28, 1.46, 2.43);
  for (let i = 0; i < 3; i += 1) {
    const trayZ = -0.80 + i * 0.49;
    const trayX = i === 2 ? 0.20 : 0.03;
    box(island, timber, [0.79, 0.053, 0.37], [trayX, 1.01, trayZ]);
    for (let n = 0; n < 4; n += 1) {
      const w = i === 1 ? 0.142 : 0.144;
      const h = i === 1 ? 0.147 : 0.098;
      const position = [0.27 + trayX - 0.28 + n * 0.182, 1.037 + h / 2, 0.28 + trayZ];
      batch(i === 1 ? unitCan : unitBox, stock[i === 1 ? 0 : i + 2], position, [w, h, i === 1 ? w : 0.24], random() * 0.1);
      if (i === 1) batch(unitLid, brushed, [position[0], position[1] + h / 2, position[2]], [w + 0.004, 0.008, w + 0.004]);
    }
  }

  const cartons = area("Stock cartons", -3.05, -1.73);
  box(cartons, paper, [0.55, 0.33, 0.55], [0, 0.176, 0], true);
  box(cartons, paper, [0.46, 0.29, 0.49], [-0.027, 0.485, 0.01], true).rotation.y = 0.055;
  box(cartons, timber, [0.052, 0.003, 0.49], [-0.028, 0.633, 0.015]).rotation.y = 0.055;
  box(cartons, timber, [0.056, 0.30, 0.004], [-0.019, 0.485, 0.258]);
  block(-3.05, -1.73, 0.56, 0.56);

  const conduit = finish(0x71746a, 0.65);
  box(room, conduit, [0.028, 0.024, 7.35], [-2.81, 3.20, 0]);
  box(room, conduit, [0.028, 0.024, 7.35], [2.81, 3.20, 0]);
  box(room, conduit, [5.64, 0.024, 0.028], [0, 3.20, -3.68]);
  const diffuser = new THREE.MeshStandardMaterial({
    color: 0xffe8bd, emissive: 0xffd49f, emissiveIntensity: 1.1, roughness: 0.58,
  });
  for (const x of [-1.62, 1.62]) {
    for (const z of [-2.12, 0.45, 2.65]) {
      box(room, dark, [0.15, 0.063, 1.10], [x, 3.167, z]);
      box(room, diffuser, [0.094, 0.026, 1.05], [x, 3.124, z]);
    }
  }
  const ambient = new THREE.HemisphereLight(0xffefd8, 0xa89981, 1.82);
  const frontLight = new THREE.DirectionalLight(0xffe7c7, 1.08);
  frontLight.position.set(-1.2, 4.2, 2.7);
  const entranceLight = new THREE.DirectionalLight(0xc1d8ec, 0.55);
  entranceLight.position.set(1.7, 1.8, 5.0);
  room.add(ambient, frontLight, entranceLight);
  for (const [x, z, intensity] of [[0.20, 1.27, 24], [0.70, -2.1, 18]]) {
    const light = new THREE.PointLight(0xffe7c6, intensity, 6, 2);
    light.position.set(x, 2.93, z);
    room.add(light);
  }

  const transform = new THREE.Object3D();
  for (const [material, { geometry, items }] of surfaces) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach(({ position, scale, rotation }, index) => {
      transform.position.set(...position);
      transform.scale.set(...scale);
      transform.rotation.y = rotation;
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    room.add(mesh);
  }

  return { room, colliders, occluders, halfWidth: HALF_WIDTH, halfDepth: HALF_DEPTH };
}
