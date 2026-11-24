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

const provisionStock = {
  rice: { name: ["JASMINE", "RICE"], note: "THAI FRAGRANT RICE", script: "香米", color: "#5f7450", accent: "#ddd194", shape: "pouch", size: [0.20, 0.275, 0.112] },
  kopi: { name: ["KOPI O"], note: "ROASTED COFFEE", script: "咖啡乌", color: "#8c533c", accent: "#eab670", shape: "pouch", size: [0.145, 0.213, 0.096] },
  mee: { name: ["EGG", "NOODLES"], note: "DRIED WHEAT NOODLES", script: "鸡蛋面", color: "#cf9a46", accent: "#883427", shape: "pouch", size: [0.175, 0.221, 0.090] },
  teh: { name: ["JASMINE", "TEA"], note: "LOOSE LEAF", script: "茉莉花茶", color: "#406455", accent: "#d5bc7d", shape: "box", size: [0.135, 0.190, 0.102] },
  crackers: { name: ["CREAM", "CRACKERS"], note: "TRADITIONAL BISCUITS", script: "梳打饼", color: "#9f5839", accent: "#e8c180", shape: "box", size: [0.164, 0.195, 0.137] },
  kaya: { name: ["PANDAN", "KAYA"], note: "COCONUT JAM", script: "斑斓咖椰", color: "#73774b", accent: "#cbd39a", shape: "can", size: [0.104, 0.122, 0.104] },
  sardines: { name: ["SARDINES"], note: "IN TOMATO SAUCE", script: "茄汁沙丁鱼", color: "#a34b3e", accent: "#f1b379", shape: "can", size: [0.108, 0.148, 0.108] },
  lychee: { name: ["LYCHEES"], note: "IN LIGHT SYRUP", script: "糖水荔枝", color: "#377a6d", accent: "#efb69d", shape: "can", size: [0.117, 0.151, 0.117] },
  soy: { name: ["LIGHT SOY", "SAUCE"], note: "NATURALLY BREWED", script: "生抽", color: "#4d352a", accent: "#bc6755", shape: "bottle", size: [0.094, 0.295, 0.094] },
};

function provisionLabel({ name, note, script, color, accent, shape }) {
  const wrapped = shape === "can" || shape === "bottle";
  return paintedTexture(128, 128, (ctx, width, height) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    const light = ctx.createLinearGradient(0, 0, 0, height);
    light.addColorStop(0, "#ffffff24");
    light.addColorStop(0.12, "#ffffff03");
    light.addColorStop(0.86, "#00000000");
    light.addColorStop(1, "#00000044");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);

    const labelTop = shape === "bottle" ? 49 : 15;
    const labelBottom = shape === "bottle" ? 123 : 114;
    const sides = wrapped ? [30, 98] : [9, 119];
    ctx.fillStyle = wrapped ? "#f1e4c7" : accent;
    ctx.fillRect(sides[0], labelTop, sides[1] - sides[0], labelBottom - labelTop);
    if (shape === "pouch") {
      ctx.strokeStyle = "#ffffff33";
      for (let line = -height; line < width; line += 7) {
        ctx.beginPath();
        ctx.moveTo(line, 0);
        ctx.lineTo(line + height, height);
        ctx.stroke();
      }
    }
    ctx.fillStyle = wrapped ? accent : "#eee1be";
    ctx.fillRect(sides[0], labelTop, sides[1] - sides[0], 12);
    ctx.fillRect(sides[0], labelBottom - 8, sides[1] - sides[0], 8);
    ctx.strokeStyle = color;
    ctx.strokeRect(sides[0] + 3, labelTop + 3, sides[1] - sides[0] - 6, labelBottom - labelTop - 6);

    ctx.textAlign = "center";
    ctx.fillStyle = wrapped ? color : "#35342a";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(script, 64, labelTop + 26, sides[1] - sides[0] - 10);
    ctx.font = 'bold ' + (wrapped ? 13 : 23) + 'px Georgia, serif';
    name.forEach((line, index) => ctx.fillText(line, 64, labelTop + 41 + index * (wrapped ? 13 : 20), sides[1] - sides[0] - 12));
    ctx.font = "bold 6px system-ui, sans-serif";
    ctx.fillText(note, 64, labelBottom - 12, sides[1] - sides[0] - 8);

    if (shape === "can") {
      ctx.fillStyle = "#b0aaa0";
      ctx.fillRect(0, 0, width, 4);
      ctx.fillRect(0, height - 4, width, 4);
    }
    if (shape === "pouch") {
      ctx.fillStyle = "#ffffff40";
      for (let line = 3; line < 10; line += 3) {
        ctx.fillRect(0, line, width, 1);
        ctx.fillRect(0, height - line, width, 1);
      }
    }
    if (wrapped) {
      ctx.fillStyle = "#f1e4c760";
      for (let line = 45; line < 96; line += 6) {
        ctx.fillRect(5, line, 17, 1);
        ctx.fillRect(106, line, 14, 1);
      }
    }
  });
}

function pouchGeometry(THREE) {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 1, 3, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const y = Math.abs(positions.getY(i));
    positions.setX(i, positions.getX(i) * (1.03 - y * 0.14));
    positions.setZ(i, positions.getZ(i) * (1.10 - y * 1.58));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function bottleGeometry(THREE) {
  const profile = [[0, -0.5], [0.48, -0.5], [0.5, -0.45], [0.5, 0.16],
    [0.23, 0.31], [0.23, 0.52], [0, 0.52]];
  const geometry = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 10);
  const { position, uv } = geometry.attributes;
  for (let i = 0; i < uv.count; i += 1) uv.setY(i, (position.getY(i) + 0.5) / 1.02);
  return geometry;
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
  const unitCan = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
  const unitTop = new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2);
  const unitCap = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const shapes = { box: unitBox, can: unitCan, pouch: pouchGeometry(THREE), bottle: bottleGeometry(THREE) };
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
    batch(unitBox, dark, [0, 0.028, 3.47 + stripe * 0.07], [1.49, 0.005, 0.019]);
  }

  box(room, timber, [3.12, 0.78, 0.087], [0, 2.79, -4.125]);
  const sign = new THREE.MeshStandardMaterial({
    map: shopSign(), emissive: 0xc4ae81, emissiveIntensity: 0.15, roughness: 0.64,
  });
  plane(room, sign, 3.00, 0.70, 0, 2.79, -4.077);
  function shelfSign(title, subtitle) {
    return new THREE.MeshStandardMaterial({
      map: paintedTexture(256, 64, (ctx) => {
        const width = 512;
        const height = 128;
        ctx.scale(0.5, 0.5);
        ctx.fillStyle = "#284a3d";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#c6a970";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(10, 8, width - 20, height - 16);
        ctx.fillStyle = "#e9d8ad";
        ctx.textAlign = "center";
        ctx.font = "bold 35px Georgia, serif";
        ctx.fillText(title, width / 2, 58, width - 45);
        ctx.font = "22px system-ui, sans-serif";
        ctx.fillText(subtitle, width / 2, 94, width - 45);
      }),
      roughness: 0.69,
    });
  }
  plane(room, shelfSign("TINS & SAUCES", "罐头 · 调味料"), 1.82, 0.39, 3.477, 2.67, -0.70, -Math.PI / 2);
  plane(room, shelfSign("PROVISIONS", "粮油 · 日用杂货"), 1.36, 0.34, -3.477, 2.31, 0.58, Math.PI / 2);

  const stock = Object.fromEntries(Object.entries(provisionStock).map(([id, item]) => [
    id,
    new THREE.MeshStandardMaterial({ map: provisionLabel(item), roughness: item.shape === "pouch" ? 0.76 : 0.48 }),
  ]));
  const screwCap = finish(0x9d4333, 0.52);
  const jarCap = finish(0x76814a, 0.44, 0.17);

  function batch(geometry, material, position, scale, rotation = 0) {
    let list = surfaces.get(material);
    if (!list) {
      list = { geometry, items: [] };
      surfaces.set(material, list);
    }
    list.items.push({ position, scale, rotation });
  }

  function packageAt(group, id, x, y, z, turn = 0) {
    const { shape, size } = provisionStock[id];
    const [width, height, depth] = size;
    const center = group.localToWorld(new THREE.Vector3(x, y + height / 2, z));
    const round = shape === "can" || shape === "bottle";
    batch(shapes[shape], stock[id], center.toArray(), size, group.rotation.y + turn + (round ? Math.PI : 0));
    if (shape === "can") {
      batch(unitTop, id === "kaya" ? jarCap : brushed, [center.x, y + height + 0.001, center.z],
        [width + 0.005, 1, depth + 0.005]);
    }
    if (shape === "bottle") {
      batch(unitCap, screwCap, [center.x, y + height - 0.014, center.z], [0.054, 0.033, 0.054]);
    }
  }

  function shelfTickets(plan, featureSlots) {
    return new THREE.MeshStandardMaterial({
      map: paintedTexture(512, 16, (ctx, width, height) => {
        ctx.fillStyle = "#7d8174";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#ccc9b6";
        ctx.fillRect(0, 1, width, 1);
        ctx.fillRect(0, height - 2, width, 1);
        const laneWidth = width / plan.length;
        for (const [bay, id] of plan.entries()) {
          const position = (bay + 0.5) * laneWidth;
          if (featureSlots.some((slot) => Math.abs(slot * width - position) < 24)) continue;
          const x = position - 10;
          ctx.fillStyle = bay % 3 === 1 ? "#e6cb7b" : "#f1e7d1";
          ctx.fillRect(x, 3, 20, 10);
          ctx.fillStyle = "#3b382b";
          ctx.font = "bold 7px sans-serif";
          ctx.fillText(id.toUpperCase(), x + 2, 10, 11);
          ctx.fillRect(x + 16, 5, 1, 6);
          ctx.fillRect(x + 18, 5, 1, 6);
        }
        for (const slot of featureSlots) {
          const x = slot * width - 12;
          ctx.fillStyle = "#d7b66c";
          ctx.fillRect(x, 2, 24, 12);
          ctx.strokeStyle = "#6e522b";
          ctx.strokeRect(x + 1, 3, 22, 10);
          ctx.fillStyle = "#382e21";
          ctx.textAlign = "center";
          ctx.font = "bold 7px sans-serif";
          ctx.fillText("ABALONE", x + 12, 10, 20);
        }
      }),
      roughness: 0.66,
    });
  }

  function wallShelf(name, x, z, width, yaw, plan) {
    const group = area(name, x, z, yaw);
    box(group, deepGreen, [width, 2.24, 0.07], [0, 1.20, -0.235], true);
    box(group, dark, [width, 0.13, 0.53], [0, 0.069, 0], true);
    for (let bay = 0; bay <= 3; bay += 1) {
      for (const railDepth of [-0.22, 0.25]) {
        box(group, paintedGreen, [0.046, 2.22, 0.052], [width * (bay / 3 - 0.5), 1.18, railDepth], true);
      }
    }
    const clearances = occupiedAnchors.map(({ position }) => group.worldToLocal(new THREE.Vector3(...position)))
      .filter(({ x, z }) => Math.abs(x) < width / 2 && Math.abs(z - 0.17) < 0.12);
    for (const [row, y] of [0.31, 0.81, 1.31, 1.81, 2.29].entries()) {
      box(group, shelf, [width, 0.036, 0.56], [0, y - 0.018, 0.013], true);
      const reserved = clearances.filter((anchor) => Math.abs(anchor.y - y) < 0.14);
      const featureSlots = reserved.map(({ x }) => x / width + 0.5);
      plane(group, shelfTickets(plan[row], featureSlots), width, 0.041, 0, y - 0.019, 0.295);
      const laneWidth = width / plan[row].length;
      for (const [lane, id] of plan[row].entries()) {
        const [packWidth] = provisionStock[id].size;
        const pitch = Math.max(0.164, packWidth + 0.019);
        const count = Math.floor((laneWidth - 0.065) / pitch);
        for (let pack = 0; pack < count; pack += 1) {
          const localX = -width / 2 + laneWidth * (lane + 0.5) + pitch * (pack - (count - 1) / 2);
          if (reserved.some((anchor) => Math.abs(anchor.x - localX) < 0.16 + packWidth / 2)) continue;
          if (row === 4 && (lane % 2 || pack % 3 === 1 || (yaw === 0 && Math.abs(localX) < 1.62))) continue;
          packageAt(group, id, localX, y, 0.160 - random() * 0.022, (random() - 0.5) * 0.14);
          if (row < 4 && (lane + pack) % 3 !== 1) {
            packageAt(group, id, localX, y, -0.025 - random() * 0.032, (random() - 0.5) * 0.21);
          }
        }
      }
    }
  }
  wallShelf("Rear grocery shelves", -0.09, -3.92, 6.10, 0, [
    ["rice", "rice", "crackers", "rice", "mee", "rice"],
    ["kopi", "kopi", "teh", "kaya", "crackers", "crackers"],
    ["sardines", "lychee", "lychee", "sardines", "sardines", "lychee"],
    ["teh", "teh", "kopi", "mee", "crackers", "teh"],
    ["rice", "crackers", "rice", "crackers", "rice", "crackers"],
  ]);
  block(-0.09, -3.91, 6.16, 0.64);
  wallShelf("Right grocery shelves", 3.23, -0.33, 5.08, -Math.PI / 2, [
    ["rice", "mee", "rice", "crackers", "rice", "mee"],
    ["soy", "soy", "kaya", "kaya", "soy", "soy"],
    ["lychee", "sardines", "sardines", "lychee", "sardines", "lychee"],
    ["mee", "kopi", "teh", "teh", "kaya", "crackers"],
    ["crackers", "rice", "crackers", "rice", "crackers", "rice"],
  ]);
  block(3.23, -0.33, 0.64, 5.12);

  const counter = area("Checkout counter", -2.57, 2.11);
  box(counter, timber, [1.31, 0.93, 1.54], [0, 0.51, 0], true);
  box(counter, stone, [1.39, 0.076, 1.63], [0, 0.996, 0], true);
  box(counter, dark, [1.28, 0.083, 1.49], [0, 0.061, 0]);
  box(counter, brass, [0.013, 0.025, 1.38], [0.661, 0.86, 0]);
  for (let panel = 0; panel < 8; panel += 1) {
    batch(unitBox, deepGreen, [-1.909, 0.48, 1.43 + panel * 0.191], [0.015, 0.64, 0.009]);
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
  const tender = shelfSign("CASH / NETS", "谢谢光临");
  plane(counter, tender, 0.28, 0.103, 0.33, 1.16, 0.37, Math.PI / 2);
  block(-2.57, 2.11, 1.39, 1.63);

  const island = area("Island display", 0.27, 0.28);
  box(island, timber, [1.40, 0.85, 2.37], [0, 0.493, 0], true);
  box(island, paintedGreen, [1.415, 0.12, 2.38], [0, 0.09, 0]);
  box(island, stone, [1.45, 0.077, 2.42], [0, 0.956, 0], true);
  box(island, brass, [1.455, 0.015, 2.425], [0, 0.977, 0]);
  box(island, deepGreen, [1.20, 0.54, 0.018], [0, 0.53, 1.19]);
  plane(island, shelfSign("NEW MOON ABALONE", "新月鲍鱼"), 0.99, 0.25, 0, 0.58, 1.20);
  box(island, brushed, [0.43, 0.052, 0.44], [-0.03, 1.004, 0.98]);
  box(island, brushed, [0.21, 0.052, 0.35], [-0.60, 1.004, -0.19]);
  block(0.27, 0.28, 1.46, 2.43);
  for (const [i, id] of ["crackers", "lychee", "kaya"].entries()) {
    const trayZ = -0.80 + i * 0.49;
    const trayX = i === 2 ? 0.20 : 0.03;
    box(island, timber, [0.79, 0.053, 0.37], [trayX, 1.01, trayZ]);
    for (let n = 0; n < 4; n += 1) {
      packageAt(island, id, trayX - 0.28 + n * 0.182, 1.037, trayZ, (random() - 0.5) * 0.16);
      packageAt(island, id, trayX - 0.28 + n * 0.182, 1.037, trayZ - 0.14, (random() - 0.5) * 0.16);
    }
  }

  const cartons = area("Stock cartons", -3.05, -1.73);
  box(cartons, paper, [0.55, 0.33, 0.55], [0, 0.176, 0], true);
  box(cartons, paper, [0.46, 0.29, 0.49], [-0.027, 0.485, 0.01], true).rotation.y = 0.055;
  box(cartons, timber, [0.052, 0.003, 0.49], [-0.028, 0.633, 0.015]).rotation.y = 0.055;
  box(cartons, timber, [0.056, 0.30, 0.004], [-0.019, 0.485, 0.258]);
  block(-3.05, -1.73, 0.56, 0.56);
  const cartonPrint = new THREE.MeshStandardMaterial({
    map: paintedTexture(256, 128, (ctx, width, height) => {
      ctx.fillStyle = "#c3a171";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#665036";
      ctx.setLineDash([7, 4]);
      ctx.strokeRect(9, 9, width - 18, height - 18);
      ctx.fillStyle = "#624934";
      ctx.font = "bold 20px monospace";
      ctx.fillText("DRY GOODS", 21, 41);
      ctx.fillText("KEEP DRY", 21, 75);
      ctx.font = "bold 13px monospace";
      ctx.fillText("SINGAPORE", 21, 103);
    }),
    roughness: 0.94,
  });
  plane(cartons, cartonPrint, 0.32, 0.16, 0.006, 0.50, 0.272);

  const conduit = finish(0x71746a, 0.65);
  box(room, conduit, [0.028, 0.024, 7.35], [-2.81, 3.20, 0]);
  box(room, conduit, [0.028, 0.024, 7.35], [2.81, 3.20, 0]);
  box(room, conduit, [5.64, 0.024, 0.028], [0, 3.20, -3.68]);
  const diffuser = new THREE.MeshStandardMaterial({
    color: 0xffe8bd, emissive: 0xffd49f, emissiveIntensity: 1.1, roughness: 0.58,
  });
  for (const x of [-1.62, 1.62]) {
    for (const z of [-2.12, 0.45, 2.65]) {
      batch(unitBox, dark, [x, 3.167, z], [0.15, 0.063, 1.10]);
      batch(unitBox, diffuser, [x, 3.124, z], [0.094, 0.026, 1.05]);
    }
  }
  const ambient = new THREE.HemisphereLight(0xffefd8, 0xa89981, 1.58);
  const frontLight = new THREE.DirectionalLight(0xffe7c7, 0.98);
  frontLight.position.set(-1.2, 4.2, 2.7);
  const entranceLight = new THREE.DirectionalLight(0xc1d8ec, 0.55);
  entranceLight.position.set(1.7, 1.8, 5.0);
  room.add(ambient, frontLight, entranceLight);
  for (const [x, z, intensity] of [[0.20, 1.27, 17], [0.70, -2.1, 14]]) {
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
