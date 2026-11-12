// Continuous, metre-scale architecture. All repeated architectural solids are instanced.
export async function createWorld(T, R, physics, shadows) {
  const scene = new T.Scene();
  scene.background = new T.Color(0x192e32);
  scene.fog = new T.Fog(0x53625a, 32, 85);
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .72, ...extra});
  const materials = {
    jade: mat(0x21483e, {roughness: .24, metalness: .22}), jadeAlt: mat(0x244c42, {roughness: .28, metalness: .18}),
    courtStone: mat(0x49665b, {roughness: .32, metalness: .16}),
    rugSand: mat(0x8c8063, {roughness: 1}), rugSage: mat(0x5b6d58, {roughness: 1}),
    green: mat(0x153c30), dark: mat(0x0c2923), ivory: mat(0xe3d6b7), cream: mat(0xf5e8cb),
    brass: mat(0xb59b62, {metalness: .68, roughness: .31}), wood: mat(0x6b4931), oak: mat(0xa28055),
    timber: mat(0xa48b67), timberAlt: mat(0xa08763),
    foliage: mat(0x315b38), leaf: mat(0x527548), pot: mat(0xb6ab8c), seat: mat(0xc8b38e),
    glow: mat(0xffe7b4, {emissive: 0xffd08a, emissiveIntensity: 1.2}),
    water: mat(0x4f8c80, {metalness: .48, roughness: .15}),
    glass: mat(0xa0c9be, {transparent: true, opacity: .15, metalness: .2, roughness: .1, depthWrite: false, side: T.DoubleSide})
  };
  const geometry = {
    box: new T.BoxGeometry(1, 1, 1), cylinder: new T.CylinderGeometry(1, 1, 1, 32), sphere: new T.SphereGeometry(1, 12, 8),
    plane: new T.PlaneGeometry(1, 1), torus: new T.TorusGeometry(1, .045, 8, 64), ring: new T.RingGeometry(.985, 1, 64)
  };
  const batches = new Map(), matrix = new T.Matrix4(), quaternion = new T.Quaternion(), euler = new T.Euler();
  const position = new T.Vector3(), scale = new T.Vector3();
  function solid(type, material, x, y, z, sx, sy, sz, ry = 0, rx = 0) {
    const key = `${type}:${material}`;
    if (!batches.has(key)) batches.set(key, {geometry: geometry[type], material: materials[material], transforms: []});
    position.set(x, y, z); scale.set(sx, sy, sz); euler.set(rx, ry, 0); quaternion.setFromEuler(euler);
    matrix.compose(position, quaternion, scale); batches.get(key).transforms.push(matrix.clone());
  }
  function collider(x, y, z, sx, sy, sz) {
    return physics.createCollider(R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(x, y, z));
  }
  function box(m, x, y, z, sx, sy, sz, collision = false) {
    solid('box', m, x, y, z, sx, sy, sz);
    if (collision) collider(x, y, z, sx, sy, sz);
  }
  const cylinder = (m, x, y, z, r, h) => solid('cylinder', m, x, y, z, r, h, r);
  const sphere = (m, x, y, z, sx, sy, sz) => solid('sphere', m, x, y, z, sx, sy, sz);
  const textures = new Map(), loader = new T.TextureLoader();
  const names = ['new-moon-logo.svg', 'mili-logo.jpg', 'gogo-logo.jpg', 'new-moon-brand-cover.jpg', 'mili-brand-cover.jpg', 'gogo-brand-cover.jpg', ...['nz-425g', 'au-425g', 'sa-425g', 'mx-454g'].map(id => `new-moon-${id}-front.jpg`)];
  await Promise.all(names.map(async name => {
    const texture = await loader.loadAsync(`assets/${name}`); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; textures.set(name, texture);
  }));
  const plane = geometry.plane;
  function art(name, x, y, z, width, ry = 0) {
    const texture = textures.get(name), height = width * texture.image.height / texture.image.width;
    const mesh = new T.Mesh(plane, mat(0xffffff, {map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .2}));
    mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.scale.set(width, height, 1); scene.add(mesh);
    return mesh;
  }
  const roomSigns = [];
  function sign(text, x, y, z, width, height = .4, framed = false) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (framed) {
      context.fillStyle = '#17372e'; context.fillRect(0, 0, 1024, 128);
      context.strokeStyle = '#b59b62'; context.lineWidth = 3; context.strokeRect(8, 8, 1008, 112);
    }
    context.fillStyle = '#e9d6a9'; context.font = '500 42px Georgia'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 512, 64);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(plane, new T.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false}));
    mesh.position.set(x, y, z); mesh.scale.set(width, height, 1); scene.add(mesh);
    return mesh;
  }
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d'), gradient = shadowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(4,18,12,.58)'); gradient.addColorStop(.35, 'rgba(4,18,12,.34)'); gradient.addColorStop(1, 'rgba(4,18,12,0)'); shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const contact = new T.MeshBasicMaterial({map: new T.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false});
  function shadow(x, z, w, d) { const mesh = new T.Mesh(plane, contact); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .018, z); mesh.scale.set(w, d, 1); scene.add(mesh); }
  // One soft light texture and one instance batch serve every floor and wall wash.
  const poolCanvas = document.createElement('canvas'); poolCanvas.width = poolCanvas.height = 64;
  const poolContext = poolCanvas.getContext('2d'), poolGradient = poolContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  poolGradient.addColorStop(0, 'rgba(255,226,171,.3)'); poolGradient.addColorStop(.35, 'rgba(255,226,171,.15)'); poolGradient.addColorStop(1, 'rgba(255,226,171,0)');
  poolContext.fillStyle = poolGradient; poolContext.fillRect(0, 0, 64, 64);
  const poolTexture = new T.CanvasTexture(poolCanvas); poolTexture.colorSpace = T.SRGBColorSpace;
  materials.lightPool = new T.MeshBasicMaterial({map: poolTexture, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false});
  function lightPool(x, y, z, width, height, ry = 0, rx = -Math.PI / 2) {
    solid('plane', 'lightPool', x, y, z, width, height, 1, ry, rx);
  }
  function plant(x, z, tall = 1) {
    cylinder('pot', x, .32, z, .42, .64); cylinder('brass', x, .64, z, .43, .045);
    cylinder('brass', x, .055, z, .4, .075); cylinder('wood', x, .656, z, .37, .016);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      solid('box', 'brass', x + Math.cos(a) * .416, .32, z + Math.sin(a) * .416, .018, .44, .018, a);
    }
    cylinder('wood', x, .9 * tall, z, .04, 1.2 * tall);
    for (let i = 0; i < 5; i++) { const a = i * 2.4; sphere(i % 2 ? 'leaf' : 'foliage', x + Math.cos(a) * .26, (1.25 + i * .12) * tall, z + Math.sin(a) * .26, .36, .6 * tall, .34); }
    collider(x, .4, z, .85, .8, .85); shadow(x, z, 2.1, 2.1);
  }
  function bench(x, z, facing = 1) {
    box('wood', x, .3, z, 2.5, .4, .85, true); box('seat', x, .56, z, 2.55, .18, .9);
    box('seat', x, .94, z + facing * .35, 2.55, .7, .18);
    box('brass', x, .47, z - facing * .451, 2.52, .035, .025);
    box('oak', x, 1.285, z + facing * .35, 2.58, .065, .21);
    for (const dx of [-.42, .42]) {
      box('wood', x + dx, .653, z, .018, .006, .82);
      box('wood', x + dx, .96, z + facing * .253, .018, .52, .008);
    }
    for (const dx of [-1.15, 1.15]) {
      box('brass', x + dx, .68, z, .08, .5, .9);
      box('oak', x + dx, .955, z, .13, .065, .92);
    }
    shadow(x, z, 3.6, 2);
    lightPool(x, .051, z - facing * .6, 3.6, 2.4);
  }
  function pendant(x, z, y = 4.7) {
    cylinder('brass', x, (6 + y) / 2, z, .022, 6 - y);
    cylinder('brass', x, y, z, .62, .12); cylinder('glow', x, y - .08, z, .54, .035);
    cylinder('dark', x, y + .08, z, .42, .065);
    lightPool(x, .052, z, 4.6, 4.6);
  }
  // Continuous slab; shop thresholds remain level and physically unobstructed.
  box('dark', 0, -.22, 3.5, 30.4, .4, 29.4, true);
  for (let x = -14; x <= 14; x += 2) for (let z = 1; z <= 17; z += 2) box((x + z) % 4 === 1 ? 'jade' : 'jadeAlt', x, -.005, z, 1.99, .04, 1.99);
  for (const x of [-14.6, -5, 5, 14.6]) box('brass', x, .022, 9, .025, .012, 17.8);
  for (const z of [.6, 4, 11.5, 17.3]) box('brass', 0, .023, z, 29.3, .012, .025);
  // A shallow stone-and-brass promenade gives the arrival view a designed foreground.
  // These inlays are visual only: the continuous collision slab stays unchanged.
  box('courtStone', 0, .026, 13.8, 8.4, .012, 5.8);
  for (const x of [-4.23, 4.23]) box('brass', x, .037, 13.8, .055, .008, 5.91);
  for (const z of [10.87, 16.73]) box('brass', 0, .037, z, 8.51, .008, .055);
  for (const x of [-3.98, 3.98]) box('dark', x, .037, 13.8, .025, .008, 5.36);
  for (const z of [11.13, 16.47]) box('dark', 0, .037, z, 7.98, .008, .025);
  for (const radius of [1.15, 1.55]) {
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      solid('box', 'brass', side * radius / 2, .039, 13.6 + end * radius / 2, radius * Math.SQRT2, .008, .035, side * end * Math.PI / 4);
    }
  }
  for (const side of [-1, 1]) {
    box('brass', side * 2.9, .039, 13.6, 1.6, .008, .035);
    for (const z of [11.8, 15.8]) {
      solid('box', 'brass', side * 2.9, .039, z, .34, .008, .34, Math.PI / 4);
      solid('box', 'jade', side * 2.9, .045, z, .25, .004, .25, Math.PI / 4);
    }
  }
  box('green', -15, 3.3, 3.5, .3, 6.6, 29, true); box('green', 15, 3.3, 3.5, .3, 6.6, 29, true);
  box('green', 0, 3.3, 18, 30, 6.6, .3, true);
  box('ivory', 0, 6.5, 9, 30, .3, 18);
  // Skylight replaces the central roof panel visually, with dusk glass and brass ribs.
  box('dark', 0, 6.29, 8.3, 14.6, .06, 13);
  box('glass', 0, 6.25, 8.3, 14.1, .025, 12.6);
  for (let x = -7; x <= 7; x += 2) box('brass', x, 6.18, 8.3, .045, .08, 12.7);
  for (const z of [2, 5.1, 8.3, 11.5, 14.6]) box('brass', 0, 6.15, z, 14.1, .08, .045);
  // Dusk-lit ceiling inset: no texture or runtime environment download.
  const skylight = new T.Mesh(new T.PlaneGeometry(14, 12.5), new T.ShaderMaterial({side: T.DoubleSide, vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec2 v;void main(){gl_FragColor=vec4(mix(vec3(.13,.24,.28),vec3(.78,.52,.29),pow(1.-v.y,3.)),1.);}'}));
  skylight.rotation.x = Math.PI / 2; skylight.position.set(0, 6.23, 8.3); scene.add(skylight);
  for (const x of [-14.5, -5, 5, 14.5]) {
    box('dark', x, 2.9, .4, .65, 5.8, .9, true); box('brass', x, .18, .4, .85, .18, 1.1); box('brass', x, 5.5, .4, .85, .12, 1.1);
    for (const dx of [-.19, 0, .19]) box('brass', x + dx, 2.9, .865, .018, 4.85, .025);
    box('glow', x, 5.36, .87, .52, .025, .025);
    lightPool(x, .053, 1.1, 2.6, 3.1);
  }
  for (const x of [-14.7, 14.7]) for (const z of [4, 10, 16]) {
    box('brass', x, 2.6, z, .2, 1.1, .4); box('glow', x + (x < 0 ? .13 : -.13), 2.65, z, .12, .8, .3);
    lightPool(x < 0 ? -14.82 : 14.82, 2.5, z, 2.2, 2.9, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    lightPool(x < 0 ? -14 : 14, .054, z, 2.8, 3.8);
  }
  for (const x of [-9.5, 9.5]) for (const z of [4.2, 12.5]) pendant(x, z, 4.9);
  plant(-5.7, 4); plant(5.7, 4); plant(-12.9, 15.8, 1.3); plant(12.9, 15.8, 1.3);
  bench(-7.8, 9.5); bench(7.8, 9.5); bench(-7.8, 13, -1); bench(7.8, 13, -1);
  // Low water court, not a wall blocking the whole concourse.
  cylinder('brass', 0, .12, 7.5, 2.25, .22); cylinder('ivory', 0, .38, 7.5, 2.04, .48);
  cylinder('wood', 0, .245, 7.5, 2.075, .045); cylinder('brass', 0, .58, 7.5, 2.055, .045);
  cylinder('water', 0, .63, 7.5, 1.88, .045);
  cylinder('brass', 0, .69, 7.5, .36, .08); cylinder('ivory', 0, .83, 7.5, .23, .24);
  cylinder('brass', 0, 1.01, 7.5, .065, .26);
  solid('torus', 'brass', 0, 1.84, 7.5, .78, .9, 1);
  solid('torus', 'brass', .08, 1.84, 7.51, .62, .76, .55, -.18);
  solid('torus', 'brass', 0, .65, 7.5, 1.965, 1.965, .6, 0, -Math.PI / 2);
  for (const radius of [.9, 1.48]) solid('ring', 'brass', 0, .657, 7.5, radius, radius, 1, 0, -Math.PI / 2);
  lightPool(0, .662, 7.5, 3.8, 3.8);
  physics.createCollider(R.ColliderDesc.cylinder(.6, 2.25).setTranslation(0, .5, 7.5)); shadow(0, 7.5, 5.4, 5.4);
  for (const radius of [2.58, 2.74]) solid('ring', 'brass', 0, .032, 7.5, radius, radius, 1, 0, -Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    solid('box', 'brass', Math.sin(a) * 2.66, .034, 7.5 + Math.cos(a) * 2.66, .035, .008, .1, a);
  }
  lightPool(0, .05, 7.5, 7.2, 7.2);
  // Three 12cm steps provide a real auto-step path to a quiet seating terrace.
  for (let i = 0; i < 3; i++) box('ivory', -11, .06 * (i + 1), 11.8 + i * .4, 3.1, .12 * (i + 1), .42, true);
  box('ivory', -11, .18, 14, 3.1, .36, 2.8, true);
  const doors = [], interactables = [];
  const stores = {newmoon: -10, mili: 0, gogo: 10};
  for (const [zone, x] of Object.entries(stores)) {
    const wall = zone === 'mili' ? 'cream' : 'green';
    for (let i = 0; i < 18; i++) box(i % 3 ? 'timber' : 'timberAlt', x - 4.25 + i * .5, -.005, -5, .49, .04, 10);
    box(wall, x, 2.85, -10.5, 10, 5.7, .25, true);
    for (const side of [-1, 1]) {
      box(wall, x + side * 4.8, 2.85, -5.25, .22, 5.7, 10.5, true);
      box('courtStone', x + side * 3.55, 2.6, 0, 2.4, 5.2, .35, true);
      // Pale jade inset faces and brass borders lighten both sides of the portal.
      // The original solid collision and sliding-door clearance remain unchanged.
      for (const face of [-1, 1]) {
        box('glass', x + side * 3.6, 2.08, face * .23, 2.12, 3.5, .055);
        for (const edge of [-1, 1]) {
          box('brass', x + side * 3.6 + edge * 1.1, 2.08, face * .28, .035, 3.57, .045);
          box('brass', x + side * 3.6, 2.08 + edge * 1.785, face * .28, 2.23, .035, .045);
        }
      }
      box('brass', x + side * 2.36, 1.9, .22, .065, 3.8, .08);
      box('glow', x + side * 3.6, 3.67, .28, 2.12, .035, .04);
      lightPool(x + side * 3.6, .053, 1.15, 3.4, 3.7);
    }
    box('dark', x, 4.7, 0, 9.7, 1.55, .5, true); box('brass', x, 5.45, .3, 9.8, .045, .08);
    box('cream', x, 5.8, -5.2, 9.7, .22, 10.4);
    // Layered skirting and cornices add depth without moving the walls or artwork.
    for (const side of [-1, 1]) {
      box('oak', x + side * 4.665, .13, -5.25, .055, .2, 10.15);
      box('brass', x + side * 4.63, .245, -5.25, .025, .025, 10.15);
      box('oak', x + side * 4.65, 5.37, -5.25, .09, .16, 10.15);
      box('brass', x + side * 4.59, 5.26, -5.25, .025, .025, 10.15);
      box('oak', x + side * 4.64, 1.08, -5.25, .075, .095, 10.15);
      box('brass', x + side * 4.59, 1.15, -5.25, .025, .018, 10.15);
      // Quiet wall bays remain behind the furniture, clear of the verified artwork.
      if (side > 0 || zone === 'mili') for (const z of [-2.2, -5.2, -8.2]) {
        for (const edge of [-1, 1]) {
          box('oak', x + side * 4.635, 2.85, z + edge * 1.13, .045, 2.55, .045);
          box('oak', x + side * 4.635, 2.85 + edge * 1.275, z, .045, .045, 2.3);
        }
        if (z !== -5.2) {
          box('brass', x + side * 4.57, 3.02, z, .09, .94, .25);
          box('glow', x + side * 4.49, 3.02, z, .075, .67, .16);
          lightPool(x + side * 4.585, 3.18, z, 2.1, 2.8, -side * Math.PI / 2, 0);
        }
      }
    }
    box('oak', x, .13, -10.33, 9.3, .16, .06);
    box('oak', x, 5.37, -10.31, 9.3, .16, .09);
    box('brass', x, 5.26, -10.25, 9.3, .025, .025);
    box('glow', x, 5.19, -10.22, 8.9, .025, .025);
    for (const side of [-1, 1]) {
      box('brass', x + side * 3.08, 3.8, -10.25, .28, .94, .1);
      box('glow', x + side * 3.08, 3.8, -10.17, .17, .68, .075);
      lightPool(x + side * 3.08, 3.96, -10.18, 2.5, 2.6, 0, 0);
    }
    // Flat woven fields sit above the timber; no raised collision or blocked thresholds.
    const rugX = x + (zone === 'newmoon' ? -.35 : 0);
    const rugZ = zone === 'newmoon' ? -5.1 : -5.9;
    const rugWidth = zone === 'newmoon' ? 5.2 : 6.8, rugDepth = zone === 'newmoon' ? 5.4 : 4.8;
    box('oak', rugX, .025, rugZ, rugWidth, .012, rugDepth);
    box(zone === 'gogo' ? 'rugSage' : 'rugSand', rugX, .034, rugZ, rugWidth - .14, .006, rugDepth - .14);
    for (const side of [-1, 1]) {
      box('timber', rugX + side * (rugWidth / 2 - .19), .04, rugZ, .025, .004, rugDepth - .35);
      box('timber', rugX, .04, rugZ + side * (rugDepth / 2 - .19), rugWidth - .35, .004, .025);
      for (const end of [-1, 1]) {
        const cornerX = rugX + side * (rugWidth / 2 - .43), cornerZ = rugZ + end * (rugDepth / 2 - .43);
        solid('box', 'oak', cornerX, .041, cornerZ, .16, .004, .16, Math.PI / 4);
      }
    }
    for (let i = 0; i < 14; i++) for (const end of [-1, 1]) {
      box('timber', rugX + (i - 6.5) * (rugWidth - .6) / 13, .034, rugZ + end * (rugDepth / 2 + .045), .035, .006, .12);
    }
    box('brass', x, .03, .25, 4.7, .025, .7);
    const logo = zone === 'newmoon' ? 'new-moon-logo.svg' : `${zone}-logo.jpg`;
    box('brass', x, 4.67, .3, 2.52, 1.21, .09); box('cream', x, 4.67, .36, 2.42, 1.11, .05); art(logo, x, 4.67, .4, 2.2);
    box('glow', x, 5.36, .36, 2.42, .025, .045);
    box('brass', x, 4.02, .29, 9.3, .025, .04);
    const label = sign(zone === 'newmoon' ? '01  /  THE PROVISION ROOM' : zone === 'mili' ? '02  /  THE GATHERING ROOM' : '03  /  THE GARDEN ROOM', x, 3.42, .38, 3.9, .32, true);
    roomSigns.push({zone, mesh: label, left: 0, right: 0, top: 0, bottom: 0});
    // Two independently kinematic glass leaves slide clear of the walking capsule.
    const leaves = [];
    for (const side of [-1, 1]) {
      const group = new T.Group(); group.position.set(x + side * 1.16, 1.8, .05); scene.add(group);
      const glass = new T.Mesh(geometry.box, materials.glass); glass.scale.set(2.25, 3.5, .06); group.add(glass);
      for (const dx of [-1.12, 1.12]) { const frame = new T.Mesh(geometry.box, materials.brass); frame.scale.set(.035, 3.5, .065); frame.position.x = dx; group.add(frame); }
      const rail = new T.Mesh(geometry.box, materials.brass); rail.scale.set(2.25, .035, .065); rail.position.y = -1.73; group.add(rail);
      const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(group.position.x, 1.8, .05));
      physics.createCollider(R.ColliderDesc.cuboid(1.125, 1.75, .03), body); leaves.push({group, body, side});
    }
    doors.push({zone, x, open: 0, leaves});
    pendant(x, -4, 4.2); pendant(x, -8, 4.2);
    const light = new T.PointLight(zone === 'gogo' ? 0xcce9c2 : 0xffdfa9, 45, 15, 2); light.position.set(x, 4.5, -6); scene.add(light);
    box('brass', x, .22, -10.32, 9.3, .045, .04);
    if (zone === 'newmoon') {
      box('dark', x, 1.55, -9.85, 7.9, 3.1, .35, true);
      for (const dx of [-3.9, -1.3, 1.3, 3.9]) box('brass', x + dx, 1.65, -9.4, .055, 3.3, .7);
      for (const y of [.42, 1.25, 2.08, 2.91]) { box('oak', x, y, -9.25, 7.9, .09, 1.1, true); box('glow', x, y - .06, -8.72, 7.6, .025, .025); }
      box('oak', x, 3.37, -9.32, 8.08, .15, 1.02);
      box('brass', x, 3.46, -8.8, 8.1, .035, .055);
      for (const dx of [-2.6, 0, 2.6]) box('oak', x + dx, 1.65, -9.65, .055, 2.9, .07);
      lightPool(x, .054, -8.6, 7.5, 2.1);
      const cover = art('new-moon-brand-cover.jpg', x - 4.64, 2.8, -5.8, 3.6, Math.PI / 2);
      box('brass', x - 4.665, 2.8, -5.8, .035, cover.scale.y + .14, 3.74);
      box('oak', x - 4.67, 2.8, -5.8, .04, cover.scale.y + .28, 3.88);
      box('green', x + 2.8, .55, -4, 2.1, 1.1, 1.25, true); box('cream', x + 2.8, 1.15, -4, 2.2, .12, 1.4);
      for (let i = 0; i < 9; i++) box('brass', x + 1.9 + i * .22, .56, -3.35, .025, 1, .025);
      box('brass', x + 2.8, 1.08, -3.285, 2.17, .045, .03);
      box('brass', x + 2.8, .09, -3.36, 2.1, .08, .03);
      cylinder('pot', x + 3.48, 1.38, -4, .15, .32); cylinder('brass', x + 3.48, 1.545, -4, .155, .025);
      sphere('leaf', x + 3.48, 1.72, -4, .22, .3, .19);
      const {addProducts} = await import('./products.js');
      interactables.push(...addProducts(T, scene, textures, materials.brass));
      plant(x - 3.6, -2.3);
    } else {
      const cover = `${zone}-brand-cover.jpg`;
      box('brass', x, 2.85, -10.3, 3.65, 3.65, .08); art(cover, x, 2.85, -10.24, 3.48);
      box('oak', x, 2.85, -10.35, 3.88, 3.88, .055);
      box('oak', x, .92, -10.09, 4, .075, .28);
      box('glow', x, 4.77, -10.16, 3.7, .025, .07);
      interactables.push({id: zone, x, z: -9, radius: 2.5});
      bench(x - 3, -6.8); bench(x + 3, -6.8);
      cylinder('brass', x, .4, -5.5, .08, .75); cylinder('oak', x, .8, -5.5, .8, .1); collider(x, .4, -5.5, 1.5, .8, 1.5);
      cylinder('brass', x, .853, -5.5, .805, .025);
      cylinder('pot', x, .99, -5.5, .115, .24);
      sphere('foliage', x, 1.2, -5.5, .2, .23, .18);
      plant(x - 3.8, -8.8, 1.15); plant(x + 3.8, -8.8, 1.15); plant(x + 3.8, -2.5);
      if (zone === 'gogo') {
        for (let z = -9.5; z < -2; z += .38) box('oak', x - 4.61, 2.6, z, .08, 4.7, .055);
        for (const dx of [-2, 0, 2]) {
          cylinder('pot', x + dx, .3, -9.2, .28, .6); cylinder('brass', x + dx, .6, -9.2, .29, .035);
          sphere('leaf', x + dx, .9, -9.2, .42, .55, .4);
        }
        for (const z of [-8.9, -4.3]) {
          box('oak', x - 4.42, 1.78, z, .42, .09, 1.5);
          box('brass', x - 4.39, 1.66, z, .035, .2, 1.25);
          for (const dz of [-.42, .42]) {
            cylinder('pot', x - 4.4, 1.98, z + dz, .14, .3);
            sphere('foliage', x - 4.4, 2.27, z + dz, .21, .34, .23);
          }
        }
      } else {
        for (let dx = -4; dx <= 4; dx += .6) box('oak', x + dx, 1.15, -10.31, .04, 1.9, .04);
        box('oak', x, 1.05, -10.28, 9.1, .08, .06);
        for (const side of [-1, 1]) {
          for (const y of [1.18, 2.75]) box('oak', x + side * 3.32, y, -10.25, 1.65, .055, .075);
          for (const dx of [-.8, .8]) box('oak', x + side * 3.32 + dx, 1.965, -10.25, .045, 1.6, .075);
        }
      }
    }
  }
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.transforms.length);
    batch.transforms.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.castShadow = mesh.receiveShadow = batch.material !== materials.lightPool; mesh.computeBoundingSphere(); scene.add(mesh);
  }
  scene.add(new T.HemisphereLight(0xe4efe6, 0x6d5b3b, 2.1));
  const key = new T.DirectionalLight(0xffd5a0, 2.6); key.position.set(-8, 15, 9); key.castShadow = shadows;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left: -20, right: 20, top: 20, bottom: -20, near: .5, far: 50}); key.shadow.normalBias = .05; key.shadow.bias = -.0004; scene.add(key);
  const fill = new T.DirectionalLight(0xb7d7e8, 1); fill.position.set(4, 8, -5); scene.add(fill);
  sign('G O O D N E S S ,   A L L   A R O U N D', 0, 5.75, -.3, 10, .48);
  const signPoint = new T.Vector3();
  const signHUD = ['.site-header', '#keyboard-help', '#mall-map'].map(selector => document.querySelector(selector));
  function updateSigns(camera, canvas) {
    const frame = canvas.getBoundingClientRect();
    for (const label of roomSigns) {
      const mesh = label.mesh;
      label.left = label.top = Infinity; label.right = label.bottom = -Infinity;
      for (const dx of [-.5, .5]) for (const dy of [-.5, .5]) {
        signPoint.set(mesh.position.x + dx * mesh.scale.x, mesh.position.y + dy * mesh.scale.y, mesh.position.z).project(camera);
        const x = frame.left + (signPoint.x + 1) * frame.width / 2;
        const y = frame.top + (1 - signPoint.y) * frame.height / 2;
        label.left = Math.min(label.left, x); label.right = Math.max(label.right, x);
        label.top = Math.min(label.top, y); label.bottom = Math.max(label.bottom, y);
      }
      let overlaps = false;
      if (frame.width < 600) for (const hud of signHUD) {
        const rect = hud.getBoundingClientRect();
        if (label.left < rect.right + 8 && label.right > rect.left - 8 &&
            label.top < rect.bottom + 8 && label.bottom > rect.top - 8) overlaps = true;
      }
      mesh.visible = !overlaps;
    }
  }
  return {scene, doors, interactables, contact, plane, roomSigns, updateSigns};
}
