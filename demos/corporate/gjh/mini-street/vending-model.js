import * as THREE from "../v11/vendor/three.module.min.js";
import { paintedTexture } from "./surfaces.js";
import { CHUTE_CONTACT, MOTOR_START, RELEASE, TRAY_IMPACT, TRAY_RATTLE } from "./vending-sequence.js";

const BAY = -0.133;
const PANEL = 0.407;
const STOCK_DEPTH = 0.271;
const TRAY_DEPTH = 0.367;
const { clamp, lerp, smoothstep } = THREE.MathUtils;

function moon(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, -0.94, 0.94, true);
  ctx.quadraticCurveTo(x - radius * 0.86, y, x + radius * Math.cos(0.94), y - radius * Math.sin(0.94));
  ctx.fill();
}

function lettering(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function paintGrain() {
  return paintedTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#eee";
    ctx.fillRect(0, 0, w, h);
    let seed = 59;
    for (let i = 0; i < 3400; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      ctx.fillStyle = i % 2 ? "#ffffff90" : "#635e4c36";
      ctx.fillRect(seed % w, (seed >>> 12) % h, 1, 2);
    }
  });
}

function studioReflections() {
  const texture = paintedTexture(384, 192, (ctx, w, h) => {
    const room = ctx.createLinearGradient(0, 0, 0, h);
    room.addColorStop(0, "#e2e8d8");
    room.addColorStop(0.43, "#4c5c58");
    room.addColorStop(0.61, "#182823");
    room.addColorStop(1, "#6c594a");
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff2cb";
    ctx.fillRect(8, 38, 120, 56);
    ctx.fillStyle = "#d4f0ff";
    ctx.fillRect(208, 34, 47, 82);
    ctx.fillStyle = "#ffe6b0";
    ctx.fillRect(304, 64, 46, 17);
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function buildVendingModel(scene, drinks, theme) {
  const color = (name) => theme.getPropertyValue(`--color-vending-${name}`).trim();
  const gold = color("lit-text");
  const active = color("active");
  const cream = "#f4e1b9";
  const darkGreen = "#12291f";
  const metal = (color, metalness, roughness) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const enamel = new THREE.MeshStandardMaterial({
    color: color("enamel"), roughness: 0.39, metalness: 0.21, map: paintGrain(),
  });
  const frame = metal("#416452", 0.26, 0.39);
  const brass = metal(color("cabinet-trim"), 0.68, 0.32);
  const steel = metal("#a2b0a7", 0.72, 0.35);
  const black = metal("#15201b", 0.09, 0.59);
  const liner = metal("#574b3c", 0.26, 0.58);
  const rubber = metal("#111713", 0, 0.86);
  const lamp = new THREE.MeshBasicMaterial({ color: gold, toneMapped: false });
  const slotLamp = new THREE.MeshBasicMaterial({ color: "#91c879", toneMapped: false });
  const trayTrim = brass.clone();
  trayTrim.emissive.set(active);
  trayTrim.emissiveIntensity = 0;
  const block = new THREE.BoxGeometry(1, 1, 1);
  const flat = new THREE.PlaneGeometry(1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 20);
  const cap = new THREE.CylinderGeometry(0.037, 0.037, 0.037, 48);
  const capVertices = cap.attributes.position;
  for (let i = 0; i < capVertices.count; i += 1) {
    const x = capVertices.getX(i);
    const z = capVertices.getZ(i);
    const segment = Math.round(Math.atan2(x, z) * 24 / Math.PI);
    if (segment % 3 === 0) {
      capVertices.setX(i, x * 0.93);
      capVertices.setZ(i, z * 0.93);
    }
  }
  cap.computeVertexNormals();
  const cabinet = new THREE.Group();
  scene.add(cabinet);

  function mesh(geometry, material, x, y, z, parent = cabinet) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  }

  function box(material, x, y, z, w, h, d, parent) {
    const part = mesh(block, material, x, y, z, parent);
    part.scale.set(w, h, d);
    return part;
  }

  function bevel(material, x, y, z, w, h, d, edge) {
    const u = w / 2 - edge;
    const v = h / 2 - edge;
    const shape = new THREE.Shape();
    shape.moveTo(-u, -v);
    shape.lineTo(u, -v);
    shape.lineTo(u, v);
    shape.lineTo(-u, v);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d - 2 * edge, bevelThickness: edge, bevelSize: edge, bevelSegments: 2, steps: 1,
    });
    geometry.translate(0, 0, edge - d / 2);
    return mesh(geometry, material, x, y, z);
  }

  function decal(material, x, y, z, w, h, rotation = 0) {
    const part = mesh(flat, material, x, y, z);
    part.scale.set(w, h, 1);
    part.rotation.y = rotation;
    return part;
  }

  function print(texture, transparent = false) {
    return new THREE.MeshBasicMaterial({ map: texture, transparent, depthWrite: !transparent, toneMapped: false });
  }

  function tube(material, x, y, z, radius, height, parent) {
    const part = mesh(cylinder, material, x, y, z, parent);
    part.scale.set(radius, height, radius);
    return part;
  }

  // The door surround, glass, shelves and pickup opening sit at different depths.
  bevel(enamel, 0, 1.185, -0.172, 1.24, 2.18, 0.53, 0.021);
  bevel(frame, 0, 2.323, 0.026, 1.285, 0.084, 0.93, 0.025);
  bevel(enamel, 0, 0.228, 0.026, 1.24, 0.187, 0.878, 0.025);
  bevel(black, 0, 0.141, 0.012, 1.163, 0.072, 0.804, 0.018);
  for (const x of [-0.472, 0.472]) {
    bevel(enamel, Math.sign(x) * 0.574, 1.253, 0.080, 0.126, 2.079, 0.802, 0.015);
    bevel(frame, Math.sign(x) * 0.606, 1.265, 0.467, 0.065, 2.048, 0.070, 0.017);
    for (const z of [-0.276, 0.295]) box(rubber, x, 0.058, z, 0.135, 0.112, 0.158);
  }
  box(brass, 0, 2.302, 0.495, 1.191, 0.015, 0.022);
  bevel(enamel, 0, 2.155, 0.282, 1.13, 0.287, 0.405, 0.023);
  bevel(brass, 0, 2.147, 0.489, 1.056, 0.216, 0.034, 0.012);
  const marquee = paintedTexture(640, 128, (ctx, w, h) => {
    const panel = ctx.createLinearGradient(0, 0, 0, h);
    panel.addColorStop(0, "#376048");
    panel.addColorStop(1, "#123226");
    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#bc9564";
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = gold;
    moon(ctx, 82, 61, 38);
    lettering(ctx, "COLD DRINKS", 353, 51, "bold 60px Georgia", gold);
    lettering(ctx, "M I N I   S T R E E T", 354, 100, "19px monospace", cream);
  });
  decal(print(marquee), 0, 2.147, 0.507, 1.026, 0.188);

  box(liner, BAY, 1.410, 0.101, 0.767, 1.194, 0.027);
  for (const x of [BAY - 0.385, BAY + 0.385]) {
    box(black, x, 1.408, 0.281, 0.041, 1.186, 0.413);
    box(brass, x, 1.409, 0.492, 0.027, 1.177, 0.028);
    box(lamp, x + Math.sign(BAY - x) * 0.026, 1.416, 0.376, 0.012, 1.079, 0.014);
  }
  for (const y of [0.818, 1.994]) {
    box(black, BAY, y, 0.288, 0.789, 0.039, 0.398);
    box(brass, BAY, y, 0.492, 0.792, 0.026, 0.027);
  }
  box(lamp, BAY, 1.965, 0.375, 0.724, 0.013, 0.025);
  for (const y of [1.91, 1.39]) {
    const caseLight = new THREE.PointLight("#ffdfab", 0.95, 0.85, 1.7);
    caseLight.position.set(BAY, y, 0.399);
    scene.add(caseLight);
  }

  const glass = paintedTexture(256, 384, (ctx, w, h) => {
    const tint = ctx.createLinearGradient(0, 0, w, h * 0.5);
    tint.addColorStop(0, "#b9e6d631");
    tint.addColorStop(0.34, "#ffffff02");
    tint.addColorStop(1, "#b5d5c522");
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fffae922";
    ctx.beginPath();
    ctx.moveTo(w * 0.60, 0);
    ctx.lineTo(w * 0.78, 0);
    ctx.lineTo(0, h * 0.68);
    ctx.lineTo(0, h * 0.53);
    ctx.fill();
  });
  decal(print(glass, true), BAY, 1.406, 0.493, 0.763, 1.152);

  const shelves = [1.46, 0.913];
  for (const y of shelves) {
    box(steel, BAY, y, 0.226, 0.744, 0.025, 0.249);
    box(brass, BAY, y - 0.029, 0.348, 0.747, 0.048, 0.023);
    for (const x of [-0.122, 0.122]) box(steel, BAY + x, y + 0.073, 0.207, 0.013, 0.149, 0.206);
  }

  function packageModel(drink) {
    const group = new THREE.Group();
    const bottle = drink.shape === "bottle";
    const radius = bottle ? 0.058 : 0.064;
    const profile = bottle
      ? [[0, -0.153], [0.044, -0.153], [radius, -0.140], [radius, 0.042],
         [0.055, 0.065], [0.040, 0.095], [0.030, 0.109], [0.030, 0.135], [0, 0.135]]
      : [[0, -0.127], [0.054, -0.127], [radius, -0.116], [radius, 0.106],
         [0.055, 0.121], [0, 0.121]];
    const body = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 24);
    mesh(body, metal(drink.color, bottle ? 0.13 : 0.43, bottle ? 0.23 : 0.31), 0, 0, 0, group);

    const label = paintedTexture(384, 128, (ctx, w, h) => {
      ctx.fillStyle = drink.color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = cream;
      ctx.fillRect(0, 36, w, 60);
      ctx.fillStyle = darkGreen;
      ctx.fillRect(0, 26, w, 4);
      ctx.fillRect(0, 101, w, 4);
      for (const x of [64, 192, 320]) {
        ctx.fillStyle = darkGreen;
        moon(ctx, x, 18, 10);
        lettering(ctx, drink.label, x, 61, "bold 26px Georgia", darkGreen);
        lettering(ctx, bottle ? "REFRESHMENT" : "MINI STREET", x, 84, "11px monospace", darkGreen);
        lettering(ctx, drink.code, x, 116, "bold 13px monospace", darkGreen);
      }
    });
    const sleeve = new THREE.MeshStandardMaterial({ map: label, roughness: 0.49, metalness: 0.09 });
    mesh(new THREE.CylinderGeometry(radius + 0.0008, radius + 0.0008, bottle ? 0.122 : 0.192, 24, 1, true),
      sleeve, 0, bottle ? -0.050 : 0, 0, group).rotation.y = Math.PI;

    if (bottle) {
      mesh(cap, frame, 0, 0.137, 0, group);
      tube(steel, 0, 0.117, 0, 0.035, 0.005, group);
    } else {
      tube(steel, 0, -0.122, 0, 0.056, 0.012, group);
      tube(steel, 0, 0.121, 0, 0.058, 0.012, group);
      tube(black, 0, 0.129, 0.017, 0.015, 0.004, group).scale.z = 0.009;
      const ring = mesh(new THREE.TorusGeometry(0.013, 0.0035, 5, 12), steel, 0, 0.13, -0.005, group);
      ring.rotation.x = -Math.PI / 2;
    }
    return group;
  }

  const augerPath = new THREE.Curve();
  augerPath.getPoint = (position, point = new THREE.Vector3()) => {
    const angle = position * Math.PI * 4.6;
    return point.set(Math.sin(angle) * 0.068, Math.cos(angle) * 0.068, position * 0.228);
  };
  const augerGeometry = new THREE.TubeGeometry(augerPath, 42, 0.005, 5, false);
  const slots = drinks.map((drink, index) => {
    const x = BAY + (index % 3 - 1) * 0.247;
    const shelf = shelves[Math.floor(index / 3)];
    const y = shelf + (drink.shape === "bottle" ? 0.168 : 0.142);
    const front = packageModel(drink);
    front.position.set(x, y, STOCK_DEPTH);
    const rear = front.clone();
    rear.position.set(x, y, 0.149);
    rear.rotation.y = 0.42;
    cabinet.add(rear, front);
    const moving = front.clone();
    moving.name = `${drink.code} dispensing pack`;
    moving.visible = false;
    cabinet.add(moving);
    const auger = mesh(augerGeometry, steel, x, shelf + 0.082, 0.122);
    auger.name = `${drink.code} auger`;
    const marker = box(black, x, shelf - 0.026, 0.362, 0.215, 0.039, 0.015);
    const code = paintedTexture(128, 28, (ctx, w, h) => {
      ctx.fillStyle = drink.color;
      ctx.fillRect(12, 8, 15, 12);
      lettering(ctx, drink.code, 74, 15, "bold 23px monospace", cream);
    });
    decal(print(code, true), x, shelf - 0.026, 0.371, 0.21, 0.034);
    const led = box(slotLamp, x, shelf - 0.054, 0.362, 0.156, 0.009, 0.010);
    led.visible = false;
    return { front, moving, auger, marker, led, bottle: drink.shape === "bottle" };
  });

  bevel(enamel, PANEL, 1.215, 0.292, 0.282, 1.771, 0.390, 0.017);
  bevel(steel, PANEL, 1.478, 0.494, 0.211, 0.886, 0.046, 0.012);
  bevel(black, PANEL, 1.478, 0.520, 0.185, 0.853, 0.025, 0.008);
  box(rubber, PANEL, 1.77, 0.536, 0.160, 0.112, 0.011);
  const screen = paintedTexture(224, 144, () => {});
  decal(print(screen), PANEL, 1.77, 0.543, 0.145, 0.093);
  const keys = paintedTexture(160, 156, (ctx, w, h) => {
    for (let i = 0; i < 9; i += 1) {
      lettering(ctx, String(i + 1), (i % 3 + 0.5) * w / 3, (Math.floor(i / 3) + 0.5) * h / 3,
        "bold 21px monospace", darkGreen);
    }
  });
  for (const dx of [-0.046, 0, 0.046]) {
    for (const y of [1.649, 1.601, 1.553]) box(steel, PANEL + dx, y, 0.540, 0.033, 0.034, 0.020);
  }
  decal(print(keys, true), PANEL, 1.601, 0.551, 0.138, 0.144);
  const vendButton = new THREE.Group();
  vendButton.name = "Vend button";
  cabinet.add(vendButton);
  const vendLabel = paintedTexture(160, 52, (ctx, w, h) => lettering(ctx, "VEND", w / 2, h / 2, "bold 31px monospace", darkGreen));
  vendButton.add(
    bevel(brass, PANEL, 1.47, 0.543, 0.141, 0.059, 0.022, 0.007),
    decal(print(vendLabel, true), PANEL, 1.47, 0.555, 0.132, 0.05),
  );
  const reader = paintedTexture(128, 80, (ctx, w, h) => {
    ctx.strokeStyle = "#c1ceb9";
    ctx.lineWidth = 3;
    for (const r of [9, 17, 25]) {
      ctx.beginPath();
      ctx.arc(w / 2 - 9, 32, r, -0.74, 0.74);
      ctx.stroke();
    }
    lettering(ctx, "DEMO READER", w / 2, h - 12, "12px monospace", "#c8d4c4");
  });
  box(frame, PANEL, 1.348, 0.539, 0.151, 0.108, 0.019);
  decal(print(reader, true), PANEL, 1.348, 0.550, 0.136, 0.087);
  box(steel, PANEL, 1.231, 0.543, 0.142, 0.041, 0.024);
  box(black, PANEL, 1.231, 0.557, 0.104, 0.009, 0.008);
  box(steel, PANEL, 1.128, 0.541, 0.105, 0.065, 0.020);
  box(black, PANEL, 1.130, 0.553, 0.069, 0.030, 0.009);
  tube(steel, 0.552, 1.007, 0.492, 0.021, 0.023).rotation.x = Math.PI / 2;
  box(black, 0.552, 1.007, 0.505, 0.005, 0.020, 0.004);

  bevel(enamel, BAY, 0.726, 0.289, 0.781, 0.159, 0.402, 0.013);
  bevel(enamel, BAY, 0.312, 0.280, 0.781, 0.104, 0.424, 0.014);
  box(black, BAY, 0.503, 0.164, 0.759, 0.286, 0.024);
  for (const x of [BAY - 0.363, BAY + 0.363]) {
    box(black, x, 0.503, 0.320, 0.057, 0.286, 0.320);
    box(brass, x, 0.506, 0.492, 0.028, 0.287, 0.034);
  }
  box(steel, BAY, 0.384, 0.328, 0.683, 0.033, 0.306);
  for (const x of [-0.28, -0.21, -0.14, -0.07, 0, 0.07, 0.14, 0.21, 0.28]) {
    box(black, BAY + x, 0.404, 0.333, 0.012, 0.008, 0.231);
  }
  box(trayTrim, BAY, 0.399, 0.496, 0.758, 0.029, 0.044);
  box(brass, BAY, 0.649, 0.492, 0.758, 0.032, 0.042);
  const flap = new THREE.Group();
  flap.name = "Pickup flap";
  flap.position.set(BAY, 0.631, 0.388);
  cabinet.add(flap);
  box(rubber, 0, -0.045, 0, 0.679, 0.09, 0.020, flap);
  const trayLight = new THREE.PointLight("#ffd484", 0, 0.68, 1.6);
  trayLight.position.set(BAY, 0.575, 0.435);
  scene.add(trayLight);

  const pickup = paintedTexture(256, 34, (ctx, w, h) => lettering(ctx, "P I C K   U P", w / 2, h / 2, "bold 25px monospace", cream));
  decal(print(pickup, true), BAY, 0.334, 0.493, 0.32, 0.035);
  for (const y of [0.192, 0.215, 0.238, 0.261]) box(black, 0, y, 0.467, 0.662, 0.009, 0.013);

  function screw(x, y, z, rotation) {
    const head = tube(steel, x, y, z, 0.012, 0.009);
    head.rotation.set(Math.PI / 2, 0, rotation, "ZYX");
    const groove = box(black, x + Math.sin(rotation) * 0.005, y, z + Math.cos(rotation) * 0.005,
      0.016, 0.002, 0.002);
    groove.rotation.y = rotation;
  }

  const livery = paintedTexture(320, 512, (ctx, w, h) => {
    const green = ctx.createLinearGradient(0, 0, w, h);
    green.addColorStop(0, "#315941");
    green.addColorStop(1, "#1e4033");
    ctx.fillStyle = green;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#c0975c";
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    ctx.strokeRect(23, 23, w - 46, h - 46);
    ctx.beginPath();
    ctx.arc(w / 2, 159, 76, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = gold;
    moon(ctx, w / 2 + 8, 158, 53);
    lettering(ctx, "COLD", w / 2, 280, "bold 63px Georgia", gold);
    lettering(ctx, "DRINKS", w / 2, 344, "bold 54px Georgia", gold);
    lettering(ctx, "MINI STREET", w / 2, 417, "22px monospace", cream);
    for (const y of [389, 445]) ctx.fillRect(60, y, w - 120, 2);
  });
  const sideInk = print(livery);
  for (const side of [-1, 1]) {
    const rotation = side * Math.PI / 2;
    box(frame, side * 0.638, 1.218, 0.018, 0.026, 1.852, 0.708);
    box(enamel, side * 0.654, 1.218, 0.018, 0.014, 1.811, 0.666);
    decal(sideInk, side * 0.663, 1.485, 0.018, 0.573, 1.082, rotation);
    for (const y of [0.365, 2.069]) {
      for (const z of [-0.281, 0.317]) screw(side * 0.667, y, z, rotation);
    }
    box(black, side * 0.663, 0.512, 0.018, 0.009, 0.200, 0.451);
    for (let i = 0; i < 7; i += 1) {
      box(frame, side * 0.670, 0.424 + i * 0.029, 0.018, 0.014, 0.010, 0.430).rotation.z = side * -0.30;
    }
  }

  bevel(frame, 0, 1.185, -0.449, 1.116, 2.016, 0.045, 0.017);
  bevel(enamel, 0, 1.193, -0.480, 1.058, 1.960, 0.031, 0.012);
  for (const x of [-0.478, 0.478]) {
    for (const y of [0.272, 1.069, 2.112]) screw(x, y, -0.498, Math.PI);
  }
  const service = paintedTexture(256, 154, (ctx, w, h) => {
    ctx.fillStyle = "#dcd6bf";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#24362f";
    ctx.fillRect(8, 8, w - 16, 40);
    lettering(ctx, "MINI STREET", w / 2, 28, "bold 25px monospace", cream);
    lettering(ctx, "REFRIGERATED CABINET", w / 2, 63, "bold 18px monospace", darkGreen);
    lettering(ctx, "MODEL MS-06   /   UNIT 001", w / 2, 87, "15px monospace", darkGreen);
    for (let i = 0; i < 36; i += 1) ctx.fillRect(26 + i * 5, 108, i % 3 === 0 ? 3 : 1, 32);
  });
  decal(print(service), -0.234, 1.829, -0.500, 0.336, 0.202, Math.PI);
  box(black, 0.271, 1.476, -0.497, 0.077, 0.202, 0.009);
  box(steel, 0.271, 1.476, -0.520, 0.024, 0.168, 0.022);
  for (const y of [1.405, 1.549]) box(steel, 0.271, y, -0.504, 0.041, 0.026, 0.046);

  bevel(steel, 0, 0.633, -0.502, 0.790, 0.542, 0.023, 0.009);
  box(black, 0, 0.635, -0.517, 0.753, 0.504, 0.012);
  tube(rubber, 0, 0.632, -0.528, 0.220, 0.025).rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i += 1) {
    const angle = i * Math.PI * 2 / 5;
    box(steel, Math.sin(angle) * 0.108, 0.632 + Math.cos(angle) * 0.108, -0.542, 0.068, 0.155, 0.007).rotation.z = -angle + 0.32;
  }
  tube(steel, 0, 0.632, -0.548, 0.056, 0.014).rotation.x = Math.PI / 2;
  for (let i = 0; i < 14; i += 1) {
    box(frame, 0, 0.407 + i * 0.035, -0.561, 0.740, 0.011, 0.016).rotation.x = 0.38;
  }
  box(black, 0.383, 0.295, -0.506, 0.080, 0.055, 0.020);
  box(steel, 0.383, 0.295, -0.520, 0.044, 0.025, 0.010);
  const lead = new THREE.CatmullRomCurve3([
    [0.383, 0.295, -0.525], [0.412, 0.244, -0.550], [0.299, 0.223, -0.556],
    [0.087, 0.242, -0.556], [0.013, 0.316, -0.559], [0.106, 0.343, -0.556],
    [0.251, 0.314, -0.552],
  ].map((point) => new THREE.Vector3(...point)));
  mesh(new THREE.TubeGeometry(lead, 22, 0.011, 6, false), rubber, 0, 0, 0);
  box(rubber, 0.241, 0.314, -0.556, 0.051, 0.027, 0.031);

  box(enamel, 0, 2.369, -0.003, 1.157, 0.011, 0.806);
  for (const x of [-0.491, 0.491]) box(frame, x, 2.378, -0.003, 0.019, 0.008, 0.757);

  const shadow = paintedTexture(128, 128, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 13, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, "#091612b8");
    gradient.addColorStop(0.46, "#0916128c");
    gradient.addColorStop(1, "#09161200");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
  decal(print(shadow, true), 0.10, 0, -0.07, 2.37, 1.75).rotation.x = -Math.PI / 2;
  scene.environment = studioReflections();
  scene.environmentIntensity = 0.75;
  scene.add(new THREE.HemisphereLight("#f9f0d9", "#425b54", 1.67));
  for (const [tint, intensity, position] of [
    ["#ffe3ba", 2.5, [-3, 5, 4]], ["#c0e6ee", 1.7, [3, 2, -3]], ["#ffdcaa", 0.7, [1, 1, 4]],
  ]) {
    const light = new THREE.DirectionalLight(tint, intensity);
    light.position.set(...position);
    scene.add(light);
  }

  let current;
  let phase;
  function setState(state) {
    phase = state.phase;
    current = slots[state.selection];
    const vending = phase === "dispensing" || phase === "ready";
    for (const slot of slots) {
      const selected = slot === current;
      slot.front.visible = !selected || !vending;
      slot.moving.visible = selected && vending;
      slot.led.visible = selected;
      slot.marker.material = selected ? frame : black;
      slot.auger.rotation.z = 0;
    }
    slotLamp.color.set(vending ? active : "#91c879");
    trayTrim.emissiveIntensity = phase === "ready" ? 0.64 : 0;
    trayLight.intensity = phase === "ready" ? 2.3 : 0.35;
    const { width: w, height: h } = screen.image;
    const ctx = screen.image.getContext("2d");
    ctx.fillStyle = "#132b20";
    ctx.fillRect(0, 0, w, h);
    const main = { idle: "DEMO", selected: drinks[state.selection]?.code, dispensing: "VENDING", ready: "READY" };
    const sub = { idle: "SELECT A DRINK", selected: drinks[state.selection]?.label, dispensing: "PLEASE WAIT", ready: "COLLECT BELOW" };
    lettering(ctx, main[phase], w / 2, 54, "bold 41px monospace", "#e0f6bd");
    lettering(ctx, sub[phase], w / 2, 108, "19px monospace", "#a7d48f");
    screen.needsUpdate = true;
  }

  function poseDrop(progress) {
    vendButton.position.z = 0;
    if (!current || !current.moving.visible) {
      flap.rotation.x = 0;
      return;
    }
    const { front, moving, auger, bottle } = current;
    const push = smoothstep(progress, MOTOR_START, RELEASE);
    const fall = clamp((progress - RELEASE) / (TRAY_IMPACT - RELEASE), 0, 1);
    const intoChute = smoothstep(progress, CHUTE_CONTACT, TRAY_IMPACT);
    const roll = smoothstep(progress, TRAY_IMPACT, 1);
    const firstBounce = clamp((progress - TRAY_IMPACT) / (TRAY_RATTLE - TRAY_IMPACT), 0, 1);
    const secondBounce = clamp((progress - TRAY_RATTLE) / (1 - TRAY_RATTLE), 0, 1);
    const bounce = 0.037 * Math.sin(Math.PI * firstBounce) + 0.013 * Math.sin(Math.PI * secondBounce);
    const chuteX = lerp(front.position.x, BAY, 0.76);
    const tilt = 1.87 * smoothstep(progress, RELEASE - 0.04, TRAY_IMPACT) - 0.32 * roll + bounce * 4;
    const radius = bottle ? 0.058 : 0.064;
    const halfLength = bottle ? 0.156 : 0.13;
    const restingHeight = 0.412 + radius;
    const contactHeight = (halfLength * Math.abs(Math.cos(tilt)) - radius * (1 - Math.sin(tilt))) * intoChute;

    // The pack tips into the gap between the stock and the glass, then rolls across the tray.
    auger.rotation.z = push * Math.PI * 2;
    moving.position.set(
      lerp(lerp(front.position.x, chuteX, intoChute), BAY, roll),
      lerp(front.position.y, restingHeight, fall ** 2) + contactHeight + bounce,
      lerp(lerp(STOCK_DEPTH, 0.424, push), TRAY_DEPTH, smoothstep(progress, CHUTE_CONTACT, 1)),
    );
    moving.rotation.set(
      0,
      0.12 * intoChute - 0.08 * roll,
      tilt,
    );
    vendButton.position.z = -0.019 * (smoothstep(progress, 0, 0.034) - smoothstep(progress, 0.062, 0.12));
    flap.rotation.x = -1.16 * smoothstep(progress, CHUTE_CONTACT, TRAY_IMPACT) + 0.85 * roll;
    trayTrim.emissiveIntensity = 0.64 * roll;
    trayLight.intensity = 0.35 + 1.95 * intoChute;
  }

  return { setState, poseDrop };
}
