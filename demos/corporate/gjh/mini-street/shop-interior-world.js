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
    const tone = ctx.createLinearGradient(0, 0, width, height);
    tone.addColorStop(0, "#a6734b");
    tone.addColorStop(0.57, "#825233");
    tone.addColorStop(1, "#714428");
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 440; i += 1) {
      const y = random() * height;
      const x = random() * width - width * 0.32;
      const length = width * (0.44 + random() * 0.52);
      const curve = (random() - 0.5) * 11;
      ctx.strokeStyle = i % 2 ? "#4327184d" : "#dfa67562";
      ctx.lineWidth = 0.28 + random() * 1.15;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + length * 0.35, y - curve, x + length * 0.7, y + curve, x + length, y - 1);
      ctx.stroke();
    }
  });
}

function finishTexture(base, light, dark, random) {
  return paintedTexture(256, 256, (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4200; i += 1) {
      ctx.fillStyle = i % 3 ? light : dark;
      ctx.fillRect(random() * size, random() * size, 0.4 + random() ** 2 * 2.9, 0.4 + random() ** 2 * 2);
    }
  });
}

function shelfBackTexture() {
  return paintedTexture(256, 256, (ctx, width, height) => {
    ctx.fillStyle = "#4b5d51";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#24342980";
    for (let y = 2; y < height; y += 7) {
      for (let x = 3; x < width; x += 6) ctx.fillRect(x, y, 1.4, 1.9);
    }
    for (const top of [4, 60, 117, 174, 232]) {
      const falloff = ctx.createLinearGradient(0, top, 0, top + 30);
      falloff.addColorStop(0, "#1e2a20b8");
      falloff.addColorStop(0.47, "#29372b5c");
      falloff.addColorStop(1, "#29362d00");
      ctx.fillStyle = falloff;
      ctx.fillRect(0, top, width, 30);
    }
  });
}

function lidTexture() {
  return paintedTexture(64, 64, (ctx, size) => {
    const metal = ctx.createLinearGradient(0, 0, size, size);
    metal.addColorStop(0, "#a29d92");
    metal.addColorStop(0.28, "#d9d2be");
    metal.addColorStop(0.64, "#989489");
    metal.addColorStop(1, "#ddd7c8");
    ctx.fillStyle = metal;
    ctx.fillRect(0, 0, size, size);
    for (const [radius, color] of [[29.5, "#ede4d0"], [26.4, "#8c867c"], [24.4, "#cbc3b4"], [19, "#9b9587"]]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(32, 32, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#827a6b";
    ctx.beginPath();
    ctx.ellipse(32, 38, 6.7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ded3be";
    ctx.beginPath();
    ctx.ellipse(32, 36, 5.8, 8.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#938b7c";
    ctx.beginPath();
    ctx.ellipse(32, 39, 3, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
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
  soy: { name: ["LIGHT SOY", "SAUCE"], note: "SOY SAUCE", script: "生抽", color: "#4d352a", accent: "#bc6755", shape: "bottle", size: [0.094, 0.295, 0.094] },
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
    ctx.font = wrapped ? "bold 13px Georgia, serif" : "bold 23px Georgia, serif";
    const baseline = labelTop + (shape === "bottle" ? 38 : 41);
    name.forEach((line, index) => {
      ctx.fillText(line, 64, baseline + index * (wrapped ? 13 : 18), sides[1] - sides[0] - 12);
    });
    if (shape === "pouch") {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.57;
      for (const side of [-1, 1]) {
        for (let grain = 0; grain < 4; grain += 1) {
          ctx.beginPath();
          ctx.ellipse(64 + side * (12 + grain * 3.7), labelBottom - 23 + grain % 2 * 2.7,
            2.7, 0.8, side * (grain - 1) * 0.26, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.font = "bold 6px system-ui, sans-serif";
    ctx.fillText(note, 64, labelBottom - 12, sides[1] - sides[0] - 8);

    if (shape === "can") {
      for (const y of [0, height - 4]) {
        ctx.fillStyle = "#9d988c";
        ctx.fillRect(0, y, width, 4);
        ctx.fillStyle = "#dfd7c5";
        ctx.fillRect(0, y + 1, width, 1);
      }
    }
    if (shape === "bottle") {
      const reflection = ctx.createLinearGradient(0, 0, width, 0);
      reflection.addColorStop(0, "#21110b77");
      reflection.addColorStop(0.22, "#e6ba8659");
      reflection.addColorStop(0.38, "#210f0800");
      reflection.addColorStop(0.77, "#1e100a00");
      reflection.addColorStop(0.85, "#e4b69256");
      reflection.addColorStop(1, "#1e100a48");
      ctx.fillStyle = reflection;
      ctx.fillRect(0, 0, width, labelTop);
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

function paintContact(ctx, x, y, radiusX, radiusY) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(radiusX, radiusY);
  const color = ctx.createRadialGradient(0, 0, 0.03, 0, 0, 1);
  color.addColorStop(0, "#211810d0");
  color.addColorStop(0.48, "#271c1378");
  color.addColorStop(1, "#2a1c1100");
  ctx.fillStyle = color;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

const SHELF_DEPTH = 0.56;
const SHELF_CENTER = 0.013;

function addShelfDecks(THREE, room, boards) {
  // Static contact shading for all board tops uses one texture and one draw call.
  const width = 1024;
  const height = 256;
  const stride = Math.floor(height / boards.length);
  const texture = paintedTexture(width, height, (ctx) => {
    for (const [index, board] of boards.entries()) {
      const top = index * stride;
      const tone = ctx.createLinearGradient(0, top, 0, top + stride);
      tone.addColorStop(0, "#c4b79c");
      tone.addColorStop(0.60, "#a89173");
      tone.addColorStop(1, "#655745");
      ctx.fillStyle = tone;
      ctx.fillRect(0, top, width, stride);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top, width, stride);
      ctx.clip();
      for (const [x, z, packWidth, packDepth] of board.stock) {
        paintContact(ctx, (0.5 + x / board.width) * width,
          top + (0.5 - (z - SHELF_CENTER) / SHELF_DEPTH) * stride,
          packWidth * 0.74 / board.width * width, packDepth * 0.80 / SHELF_DEPTH * stride);
      }
      ctx.restore();
    }
  });
  const positions = [];
  const uvs = [];
  const indices = [];
  for (const [index, board] of boards.entries()) {
    const half = board.width / 2;
    const front = SHELF_CENTER + SHELF_DEPTH / 2;
    const back = SHELF_CENTER - SHELF_DEPTH / 2;
    const y = board.y + 0.0015;
    for (const [x, z] of [[-half, front], [half, front], [-half, back], [half, back]]) {
      positions.push(...board.group.localToWorld(new THREE.Vector3(x, y, z)).toArray());
    }
    const frontUV = 1 - (index * stride + 1) / height;
    const backUV = 1 - ((index + 1) * stride - 1) / height;
    uvs.push(0, frontUV, 1, frontUV, 0, backUV, 1, backUV);
    const base = index * 4;
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  room.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.77 })));
}

function shadowMap() {
  return paintedTexture(64, 64, (ctx, size) => {
    paintContact(ctx, size / 2, size / 2, size / 2, size / 2);
  });
}

export function buildShopInterior(THREE, scene, productCount) {
  const random = seededRandom();
  const textureRandom = seededRandom();
  const room = new THREE.Group();
  scene.add(room);
  const unitBox = new THREE.BoxGeometry();
  const unitCan = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true);
  const unitTop = new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2);
  const unitCap = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const shapes = { box: unitBox, can: unitCan, pouch: pouchGeometry(THREE), bottle: bottleGeometry(THREE) };
  const surfaces = new Map();
  const boards = [];
  const colliders = [];
  const occluders = [];
  const occupiedAnchors = SHOP_ANCHORS.slice(0, productCount);
  const finish = (color, roughness = 0.86, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const wall = new THREE.MeshStandardMaterial({
    map: finishTexture("#dfd0b4", "#fff0d444", "#7966512b", textureRandom), roughness: 0.91,
  });
  const ceiling = finish(0xd5cbb7);
  const paintedGreen = finish(0x37594a);
  const deepGreen = finish(0x234439);
  const dark = finish(0x30342d);
  const shelf = finish(0x958a75, 0.74);
  const shelfBack = new THREE.MeshStandardMaterial({ map: shelfBackTexture(), roughness: 0.84 });
  const brushed = finish(0xa9a99c, 0.34, 0.38);
  const brass = finish(0xb49a61, 0.42, 0.38);
  const stone = new THREE.MeshStandardMaterial({
    map: finishTexture("#494941", "#c4b39420", "#292a2148", textureRandom), roughness: 0.54,
  });
  const paper = finish(0xd1b98e);
  const rubber = finish(0x303731);
  const timber = new THREE.MeshStandardMaterial({ map: timberTexture(textureRandom), roughness: 0.59 });
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
    map: tileTexture(THREE, textureRandom), roughness: 0.67,
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
    for (const [x, y, color] of [[59, 72, "#97b8c588"], [164, 97, "#edb77a76"], [407, 89, "#a8c7d580"]]) {
      const exteriorGlow = ctx.createRadialGradient(x, y, 2, x, y, 36);
      exteriorGlow.addColorStop(0, color);
      exteriorGlow.addColorStop(1, "#f9d49400");
      ctx.fillStyle = exteriorGlow;
      ctx.fillRect(x - 36, y - 36, 72, 72);
    }
    for (let i = 0; i < 160; i += 1) {
      const x = random() * w;
      const y = random() * h;
      ctx.fillStyle = i % 3 ? "#7997a952" : "#b4a27a48";
      ctx.fillRect(x, y, 1, 5 + random() * 13);
    }
    const reflectedLight = ctx.createLinearGradient(0, 0, 0, h);
    reflectedLight.addColorStop(0, "#f8d4a566");
    reflectedLight.addColorStop(0.41, "#d2be9d05");
    reflectedLight.addColorStop(0.83, "#d2be9d00");
    reflectedLight.addColorStop(1, "#14111e66");
    ctx.fillStyle = reflectedLight;
    ctx.fillRect(0, 0, w, h);
    for (const x of [55, 219, 355, 475]) {
      ctx.fillStyle = "#ddd9c62e";
      ctx.fillRect(x, 8, 1.5, h - 74);
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
  for (const x of [-0.43, 0.43]) {
    batch(unitBox, brushed, [x, 0.27, 4.091], [0.83, 0.29, 0.018]);
  }
  box(room, rubber, [1.54, 0.02, 0.63], [0, 0.015, 3.72]);
  for (let stripe = 0; stripe < 8; stripe += 1) {
    batch(unitBox, dark, [0, 0.028, 3.47 + stripe * 0.07], [1.49, 0.005, 0.019]);
  }

  box(room, timber, [3.12, 0.78, 0.087], [0, 2.79, -4.125]);
  const signMap = shopSign();
  const sign = new THREE.MeshStandardMaterial({
    map: signMap, emissiveMap: signMap, emissive: 0xffe4ba, emissiveIntensity: 0.18, roughness: 0.67,
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
  plane(room, shelfSign("PROVISIONS", "粮油 · 日用杂货"), 1.36, 0.34, -3.477, 2.31, -0.55, Math.PI / 2);

  const stock = Object.fromEntries(Object.entries(provisionStock).map(([id, item]) => [
    id,
    new THREE.MeshStandardMaterial({ map: provisionLabel(item), roughness: item.shape === "pouch" ? 0.76 : 0.48 }),
  ]));
  const screwCap = finish(0x9d4333, 0.52);
  const lidMap = lidTexture();
  const tinLid = new THREE.MeshStandardMaterial({ map: lidMap, roughness: 0.43, metalness: 0.31 });
  const jarCap = new THREE.MeshStandardMaterial({ map: lidMap, color: 0xaeb57c, roughness: 0.46, metalness: 0.22 });

  function batch(geometry, material, position, scale, rotation = 0) {
    let geometries = surfaces.get(material);
    if (!geometries) {
      geometries = new Map();
      surfaces.set(material, geometries);
    }
    let items = geometries.get(geometry);
    if (!items) {
      items = [];
      geometries.set(geometry, items);
    }
    items.push({ position, scale, rotation });
  }

  function shelfTrim(group, material, size, x, y, z) {
    const position = group.localToWorld(new THREE.Vector3(x, y, z));
    batch(unitBox, material, position.toArray(), size, group.rotation.y);
  }

  function packageAt(group, id, x, y, z, turn = 0, footprints) {
    const { shape, size } = provisionStock[id];
    const [width, height, depth] = size;
    const center = group.localToWorld(new THREE.Vector3(x, y + height / 2, z));
    footprints?.push([x, z, width, depth]);
    const round = shape === "can" || shape === "bottle";
    batch(shapes[shape], stock[id], center.toArray(), size, group.rotation.y + turn + (round ? Math.PI : 0));
    if (shape === "can") {
      batch(unitTop, id === "kaya" ? jarCap : tinLid, [center.x, y + height + 0.001, center.z],
        [width + 0.005, 1, depth + 0.005], group.rotation.y + turn);
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
    box(group, shelfBack, [width, 2.24, 0.07], [0, 1.20, -0.235], true);
    box(group, dark, [width, 0.13, 0.53], [0, 0.069, 0], true);
    for (let bay = 0; bay <= 3; bay += 1) {
      const railX = width * (bay / 3 - 0.5);
      for (const railDepth of [-0.22, 0.25]) {
        const size = [0.046, 2.22, 0.052];
        // Keep each rail's intersection geometry while drawing the rails in one batch.
        const rail = box(group, paintedGreen, size, [railX, 1.18, railDepth], true);
        rail.visible = false;
        shelfTrim(group, paintedGreen, size, railX, 1.18, railDepth);
      }
      shelfTrim(group, brushed, [0.014, 2.06, 0.005], railX, 1.12, 0.278);
    }
    const clearances = occupiedAnchors.map(({ position }) => group.worldToLocal(new THREE.Vector3(...position)))
      .filter(({ x, z }) => Math.abs(x) < width / 2 && Math.abs(z - 0.17) < 0.12);
    for (const [row, y] of [0.31, 0.81, 1.31, 1.81, 2.29].entries()) {
      box(group, shelf, [width, 0.036, SHELF_DEPTH], [0, y - 0.018, SHELF_CENTER], true);
      const footprints = [];
      boards.push({ group, width, y, stock: footprints });
      const reserved = clearances.filter((anchor) => Math.abs(anchor.y - y) < 0.14);
      const featureSlots = reserved.map(({ x }) => x / width + 0.5);
      plane(group, shelfTickets(plan[row], featureSlots), width, 0.041, 0, y - 0.019, 0.295);
      shelfTrim(group, paintedGreen, [width, 0.018, 0.022], 0, y - 0.045, 0.263);
      const laneWidth = width / plan[row].length;
      for (const [lane, id] of plan[row].entries()) {
        const [packWidth] = provisionStock[id].size;
        const pitch = Math.max(0.164, packWidth + 0.019);
        const count = Math.floor((laneWidth - 0.065) / pitch);
        for (let pack = 0; pack < count; pack += 1) {
          const localX = -width / 2 + laneWidth * (lane + 0.5) + pitch * (pack - (count - 1) / 2);
          if (reserved.some((anchor) => Math.abs(anchor.x - localX) < 0.16 + packWidth / 2)) continue;
          if (row === 4 && (lane % 2 || pack % 3 === 1 || (yaw === 0 && Math.abs(localX) < 1.62))) continue;
          packageAt(group, id, localX, y, 0.160 - random() * 0.022, (random() - 0.5) * 0.14, footprints);
          if (row < 4 && (lane + pack) % 3 !== 1) {
            packageAt(group, id, localX, y, -0.025 - random() * 0.032, (random() - 0.5) * 0.21, footprints);
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
  addShelfDecks(THREE, room, boards);

  // These shallow ledges keep the existing walkable camera bounds clear.
  const ledges = area("Left provision ledges", -3.43, -0.55, Math.PI / 2);
  for (const [row, y] of [1.36, 1.84].entries()) {
    shelfTrim(ledges, timber, [1.50, 0.05, 0.20], 0, y - 0.025, 0.021);
    shelfTrim(ledges, brass, [1.50, 0.008, 0.007], 0, y - 0.012, 0.122);
    for (const x of [-0.55, 0.55]) {
      shelfTrim(ledges, paintedGreen, [0.052, 0.10, 0.115], x, y - 0.075, -0.017);
    }
    const goods = row === 0 ? ["crackers", "crackers", "kopi", "kopi", "teh", "teh"] :
      ["teh", "teh", "teh", "kopi", "kopi", "kopi"];
    for (const [slot, id] of goods.entries()) {
      packageAt(ledges, id, (slot - 2.5) * 0.22, y, 0.021, (random() - 0.5) * 0.09);
    }
  }

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
  const stands = [[-0.03, 0.98, 0.43, 0.44], [-0.60, -0.19, 0.21, 0.35]];
  for (const [x, z, width, depth] of stands) {
    box(island, deepGreen, [width, 0.044, depth], [x, 1.000, z]);
    shelfTrim(island, brass, [width + 0.006, 0.005, depth + 0.006], x, 1.023, z);
    shelfTrim(island, stone, [width - 0.009, 0.003, depth - 0.009], x, 1.028, z);
  }
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
    color: 0xf5e6cb, emissive: 0xffd7a1, emissiveIntensity: 1.18, roughness: 0.54,
  });
  for (const x of [-1.62, 1.62]) {
    for (const z of [-2.12, 0.45, 2.65]) {
      batch(unitBox, dark, [x, 3.185, z], [0.19, 0.053, 1.16]);
      batch(unitBox, diffuser, [x, 3.148, z], [0.126, 0.029, 1.05]);
      for (const end of [-0.54, 0.54]) {
        batch(unitBox, brushed, [x, 3.148, z + end], [0.148, 0.041, 0.044]);
      }
    }
  }
  const shade = new THREE.CylinderGeometry(0.085, 0.24, 0.17, 16, 1, true);
  const pendant = new THREE.CircleGeometry(0.228, 16).rotateX(Math.PI / 2);
  const enamel = new THREE.MeshStandardMaterial({ color: 0x355346, roughness: 0.45, side: THREE.DoubleSide });
  for (const z of [0.63, -0.94]) {
    batch(unitBox, dark, [0.22, 3.18, z], [0.19, 0.057, 0.19]);
    batch(unitBox, dark, [0.22, 2.99, z], [0.023, 0.32, 0.023]);
    batch(shade, enamel, [0.22, 2.76, z], [1, 1, 1]);
    batch(pendant, diffuser, [0.22, 2.678, z], [1, 1, 1]);
  }
  const ambient = new THREE.HemisphereLight(0xf8efe2, 0xa79b87, 1.04);
  const shopFill = new THREE.DirectionalLight(0xffebd2, 0.84);
  shopFill.position.set(-1.8, 4.3, 2.5);
  const entranceLight = new THREE.DirectionalLight(0xc3daf0, 0.47);
  entranceLight.position.set(1.7, 1.8, 5.0);
  room.add(ambient, shopFill, entranceLight);
  const interiorLights = [
    { origin: [0.22, 2.64, 0.63], aim: [0.20, 1.04, 0.92], intensity: 19, color: 0xffdfb3 },
    { origin: [1.62, 3.105, -2.12], aim: [0.36, 1.42, -3.44], intensity: 17, color: 0xffe9cc },
  ];
  for (const { origin, aim, intensity, color } of interiorLights) {
    const light = new THREE.SpotLight(color, intensity, 6.5, 0.97, 0.76, 2);
    light.position.set(...origin);
    light.target.position.set(...aim);
    room.add(light, light.target);
  }

  const transform = new THREE.Object3D();
  for (const [material, geometries] of surfaces) {
    for (const [geometry, items] of geometries) {
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
  }

  return { room, colliders, occluders, halfWidth: HALF_WIDTH, halfDepth: HALF_DEPTH };
}
