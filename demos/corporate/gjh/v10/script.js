const canvas = document.querySelector('#scene');
const toggle = document.querySelector('#view-toggle');
const status = document.querySelector('#scene-status');
const dialog = document.querySelector('#product-dialog');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const rooms = ['lobby', 'newmoon', 'mili', 'gogo'];
const labels = {lobby: 'The evening arcade', newmoon: 'New Moon', mili: 'MILI', gogo: 'GOGO'};
const descriptions = {
  lobby: 'Three doors. A world of everyday goodness. Choose an entrance to step inside.',
  newmoon: 'The provision room. Explore four source-verified New Moon packshots.',
  mili: 'The gathering room. Official brand artwork, warm light and a place to pause.',
  gogo: 'The garden room. A quieter setting for the official GOGO brand story.'
};
let current = 'lobby';
let available = false;
let requestRender = () => {};
let travel = () => {};
let returnFocus;

function setView(view) {
  const visual = view === '3d' && available;
  document.body.dataset.view = visual ? '3d' : 'list';
  toggle.textContent = visual ? 'List view' : '3D view';
  toggle.setAttribute('aria-controls', visual ? 'store-list' : 'experience');
  if (visual) requestRender();
}
function fallback(message) {
  available = false;
  setView('list');
  status.textContent = message;
  window.__sceneFailed = true;
}
toggle.addEventListener('click', () => {
  if (!available) {
    status.textContent = '3D is unavailable here. Browse all three stores and verified products below. For local 3D, open this folder through a static web server.';
    document.querySelector('#store-list').scrollIntoView({block: 'start'});
    return;
  }
  setView(document.body.dataset.view === '3d' ? 'list' : '3d');
});

function openProduct(id, trigger) {
  const source = document.querySelector(`[data-product="${id}"][data-product-name]`);
  if (!source) return;
  returnFocus = trigger || canvas;
  document.querySelector('#product-title').textContent = source.dataset.productName;
  const image = document.querySelector('#product-image');
  image.src = source.dataset.productImage;
  image.alt = source.dataset.productName;
  dialog.showModal();
}
document.querySelectorAll('[data-product]').forEach(button => {
  // Only buttons are enhanced; baseline articles and links retain native behavior.
  if (button.tagName === 'BUTTON') button.addEventListener('click', () => openProduct(button.dataset.product, button));
});
document.querySelector('#product-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => returnFocus?.focus({preventScroll: true}));

function selectRoom(room) {
  if (!rooms.includes(room) || !available) return;
  current = room;
  document.body.dataset.room = room;
  document.querySelector('#room-title').textContent = labels[room];
  document.querySelector('#room-description').textContent = descriptions[room];
  document.querySelectorAll('button[data-room]').forEach(button => {
    if (button.dataset.room === room) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('.scene-products').hidden = room !== 'newmoon';
  travel(room);
}
document.querySelectorAll('button[data-room]').forEach(button => button.addEventListener('click', () => selectRoom(button.dataset.room)));
document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
  selectRoom(rooms[(rooms.indexOf(current) + Number(button.dataset.step) + rooms.length) % rooms.length]);
}));
document.addEventListener('keydown', event => {
  if (document.body.dataset.view !== '3d' || dialog.open || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (event.key === 'Escape') { event.preventDefault(); selectRoom('lobby'); return; }
  const key = event.key.toLowerCase();
  if (['arrowright', 'arrowup', 'w', 'd', 'arrowleft', 'arrowdown', 's', 'a'].includes(key)) {
    event.preventDefault();
    const step = ['arrowright', 'arrowup', 'w', 'd'].includes(key) ? 1 : -1;
    selectRoom(rooms[(rooms.indexOf(current) + step + rooms.length) % rooms.length]);
  }
});

async function initialize() {
  // Probe before constructing Three's renderer, keeping unavailable-WebGL fallback quiet.
  const context = canvas.getContext('webgl2', {antialias: true, alpha: false, powerPreference: 'low-power'});
  if (!context) throw new Error('WebGL2 unavailable');
  const THREE = await import('./vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({canvas, context, antialias: true});
  renderer.setClearColor(0x142c29);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x142c29);
  scene.fog = new THREE.Fog(0x142c29, 26, 75);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 110);
  const loader = new THREE.TextureLoader();
  const filenames = ['new-moon-logo.svg', 'mili-logo.jpg', 'gogo-logo.jpg', 'new-moon-brand-cover.jpg', 'mili-brand-cover.jpg', 'gogo-brand-cover.jpg', ...['nz-425g', 'au-425g', 'sa-425g', 'mx-454g'].map(id => `new-moon-${id}-front.jpg`)];
  const textures = new Map();
  await Promise.all(filenames.map(async name => {
    const texture = await loader.loadAsync(`assets/${name}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.set(name, texture);
  }));
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: .78, ...extra});
  const materials = {
    green: material(0x193b30), dark: material(0x09291f), ivory: material(0xd8cbb0), cream: material(0xf2dfb9),
    wood: material(0x73543c), woodLight: material(0x846447), brass: material(0xb89a59, {metalness: .62, roughness: .37}),
    stone: material(0xa89d83, {roughness: .48}), stoneAlt: material(0x9d927a, {roughness: .52}),
    upholstery: material(0x55654a), terracotta: material(0x936d50), foliage: material(0x314e35),
    glow: material(0xffe4ae, {emissive: 0xffc773, emissiveIntensity: 1.1})
  };
  // Instancing keeps architectural detail inexpensive: one draw per geometry/material pair.
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 20),
    sphere: new THREE.SphereGeometry(1, 12, 8)
  };
  const batches = new Map();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const rotation = new THREE.Euler();
  function solid(type, mat, x, y, z, sx, sy, sz, ry = 0) {
    const key = `${type}:${mat}`;
    if (!batches.has(key)) batches.set(key, {geometry: geometries[type], material: materials[mat], transforms: []});
    position.set(x, y, z); scale.set(sx, sy, sz); rotation.set(0, ry, 0); quaternion.setFromEuler(rotation);
    matrix.compose(position, quaternion, scale);
    batches.get(key).transforms.push(matrix.clone());
  }
  const box = (mat, x, y, z, sx, sy, sz, ry = 0) => solid('box', mat, x, y, z, sx, sy, sz, ry);
  const cylinder = (mat, x, y, z, r, h) => solid('cylinder', mat, x, y, z, r, h, r);
  const sphere = (mat, x, y, z, sx, sy, sz) => solid('sphere', mat, x, y, z, sx, sy, sz);
  const interactive = [];
  const plane = new THREE.PlaneGeometry(1, 1);
  const artMaterials = new Map();
  function artwork(name, x, y, z, width, rotationY = 0, data = null) {
    const texture = textures.get(name);
    const height = width * texture.image.height / texture.image.width;
    if (!artMaterials.has(name)) artMaterials.set(name, material(0xffffff, {map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .25, roughness: .8}));
    const mesh = new THREE.Mesh(plane, artMaterials.get(name));
    mesh.position.set(x, y, z); mesh.scale.set(width, height, 1); mesh.rotation.y = rotationY;
    scene.add(mesh);
    if (data) { mesh.userData = data; interactive.push(mesh); }
    return height;
  }
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(8,16,10,.48)'); gradient.addColorStop(1, 'rgba(8,16,10,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({map: shadowTexture, transparent: true, depthWrite: false});
  function shadow(x, z, width, depth) {
    const mesh = new THREE.Mesh(plane, shadowMaterial);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .018, z); mesh.scale.set(width, depth, 1); scene.add(mesh);
  }
  // A continuous tiled arcade, open to the evening on the south side.
  box('dark', 0, -.22, -.5, 24, .4, 23);
  box('stoneAlt', 0, -.12, 4, 160, .1, 160);
  for (let x = -17; x <= 17; x += 2) {
    for (let z = -1; z <= 39; z += 2) box((x + z) % 4 === 0 ? 'stone' : 'stoneAlt', x, -.025, z, 1.985, .06, 1.985);
  }
  box('brass', 0, .013, 1, 22, .014, .04);
  box('brass', 0, .013, 7, 22, .014, .04);
  box('green', 0, 5.25, 1.6, 23, .32, 5.8);
  for (let x = -10.5; x <= 10.5; x += 7) {
    box('dark', x, 5.02, 1.6, .22, .2, 5.8);
    box('brass', x, 4.91, 1.6, .035, .025, 5.6);
  }
  box('brass', 0, 5.05, 4.45, 23, .06, .06);
  box('dark', -11.55, 2.5, -2.4, .3, 5.4, 17.3);
  box('dark', 11.55, 2.5, -2.4, .3, 5.4, 17.3);
  // Arched openings are actual extruded masonry with unobstructed room thresholds.
  const arch = new THREE.Shape();
  arch.moveTo(-3.5, 0); arch.lineTo(-2.7, 0); arch.lineTo(-2.7, 2.1);
  arch.absarc(0, 2.1, 2.7, Math.PI, 0, true);
  arch.lineTo(2.7, 0); arch.lineTo(3.5, 0); arch.lineTo(3.5, 5.1); arch.lineTo(-3.5, 5.1); arch.closePath();
  const archGeometry = new THREE.ExtrudeGeometry(arch, {depth: .45, bevelEnabled: false, curveSegments: 24});
  const archBand = new THREE.Shape();
  archBand.absarc(0, 0, 2.75, 0, Math.PI, false); archBand.absarc(0, 0, 2.69, Math.PI, 0, true); archBand.closePath();
  const bandGeometry = new THREE.ExtrudeGeometry(archBand, {depth: .05, bevelEnabled: false, curveSegments: 24});
  const locations = {newmoon: -7, mili: 0, gogo: 7};
  function pendant(x, z, drop = 3.7) {
    cylinder('brass', x, (5 + drop) / 2, z, .022, 5 - drop);
    cylinder('brass', x, drop, z, .43, .15);
    cylinder('glow', x, drop - .09, z, .34, .04);
    shadow(x, z, 3, 3);
  }
  function bench(x, z, ry = 0) {
    box('wood', x, .26, z, 2.1, .36, .85, ry);
    box('upholstery', x, .52, z, 2.15, .2, .9, ry);
    box('upholstery', x + Math.sin(ry) * .35, .92, z + Math.cos(ry) * .35, 2.15, .65, .18, ry);
    shadow(x, z, 3.3, 2.5);
  }
  function plant(x, z) {
    cylinder('terracotta', x, .36, z, .34, .7);
    cylinder('wood', x, 1.05, z, .045, 1.3);
    sphere('foliage', x, 1.65, z, .55, .85, .48);
    sphere('foliage', x + .28, 1.9, z - .12, .36, .62, .35);
    shadow(x, z, 2, 2);
  }
  for (const [room, x] of Object.entries(locations)) {
    const wall = room === 'mili' ? 'ivory' : 'green';
    for (let plank = 0; plank < 14; plank++) box(plank % 3 ? 'woodLight' : 'wood', x - 3.2 + plank * .49, -.01, -5, .48, .07, 10);
    box(wall, x, 2.55, -10, 7, 5.1, .2);
    box(wall, x - 3.45, 2.55, -5, .16, 5.1, 10);
    box(wall, x + 3.45, 2.55, -5, .16, 5.1, 10);
    box('cream', x, 5.1, -5, 7, .18, 10);
    box('wood', x, .2, -9.84, 6.8, .38, .09);
    const facade = new THREE.Mesh(archGeometry, materials.green); facade.position.set(x, 0, -.15); facade.castShadow = facade.receiveShadow = true; scene.add(facade);
    const band = new THREE.Mesh(bandGeometry, materials.brass); band.position.set(x, 2.1, .32); scene.add(band);
    for (const side of [-1, 1]) {
      box('brass', x + side * 2.72, 1.05, .35, .055, 2.1, .055);
      box('dark', x + side * 3.28, 2.5, .3, .4, 5, .32);
      box('brass', x + side * 3.28, .2, .35, .5, .08, .4);
      box('brass', x + side * 3.28, 4.6, .35, .5, .08, .4);
    }
    // Low, illuminated sign over the actual threshold. Logo proportions are untouched.
    box('brass', x, 3.76, .02, 2.25, 1.3, .16);
    box('cream', x, 3.76, .13, 2.13, 1.18, .09);
    artwork(room === 'newmoon' ? 'new-moon-logo.svg' : `${room}-logo.jpg`, x, 3.76, .18, 2.0, 0, {room});
    for (const dx of [-.9, .9]) cylinder('brass', x + dx, 4.53, .02, .018, .25);
    pendant(x, -5.4); pendant(x + .4, 2.3, 4.2);
    const light = new THREE.PointLight(0xffd598, 68, 14, 2); light.position.set(x, 3.8, -5); scene.add(light);
    // Every room has a counter and a freestanding shelving unit, never a painted room card.
    box('wood', x + 2.7, .55, -5.5, 1.05, 1.1, 1.9);
    box('cream', x + 2.7, 1.15, -5.5, 1.2, .13, 2.05);
    for (let stripe = 0; stripe < 5; stripe++) box('woodLight', x + 2.25 + stripe * .21, .57, -4.54, .06, .92, .025);
    shadow(x + 2.7, -5.5, 2.7, 3.5);
    if (room === 'newmoon') {
      box('dark', x, 2.0, -9.55, 5.8, 3.5, .36);
      for (const sx of [-2.8, 0, 2.8]) box('wood', x + sx, 1.9, -9.15, .12, 3.8, .85);
      for (const y of [.35, 1.85, 3.4]) {
        box('woodLight', x, y, -9.12, 5.8, .14, .95);
        box('glow', x, y - .08, -8.75, 5.5, .025, .025);
      }
      const products = ['nz-425g', 'au-425g', 'sa-425g', 'mx-454g'];
      products.forEach((product, i) => {
        const px = x + (i % 2 ? 1.4 : -1.4), py = i < 2 ? 2.59 : 1.04;
        box('brass', px, py, -8.77, 1.35, 1.35, .11);
        artwork(`new-moon-${product}-front.jpg`, px, py, -8.705, 1.26, 0, {product: `new-moon-${product}-front`});
      });
      artwork('new-moon-brand-cover.jpg', x - 3.35, 2.6, -5.8, 2.4, Math.PI / 2);
      bench(x - 2.1, -2.7, Math.PI / 2);
    } else {
      box('brass', x, 2.65, -9.78, 3.42, 3.42, .08);
      artwork(`${room}-brand-cover.jpg`, x, 2.65, -9.72, 3.3);
      bench(x - 1.45, -6.9); bench(x - 2.75, -4.5, Math.PI / 2);
      cylinder('brass', x - .8, .36, -4.9, .09, .7);
      cylinder('woodLight', x - .8, .76, -4.9, .75, .09);
      shadow(x - .8, -4.9, 2.4, 2.4);
      // Empty architectural display shelves: no fictional MILI/GOGO merchandise.
      for (const y of [.6, 1.5, 2.4]) box('woodLight', x + 3.03, y, -7.7, .65, .12, 2.5);
      box('wood', x + 3.03, 1.5, -8.98, .65, 2.8, .09);
      box('wood', x + 3.03, 1.5, -6.42, .65, 2.8, .09);
      plant(x - 2.6, -8.6);
    }
  }
  bench(-7, 5.7); bench(7, 5.7);
  plant(-10.5, 2.5); plant(10.5, 2.5);
  for (const x of [-10.5, -3.5, 3.5, 10.5]) {
    box('dark', x, 2.5, 4.4, .28, 5, .28);
    box('brass', x, .17, 4.4, .5, .15, .5);
    shadow(x, 4.4, 2.5, 2.5);
  }
  // Raycastable floor medallions use geometry, not icon-like glyphs.
  const ringGeometry = new THREE.RingGeometry(.29, .33, 36);
  const markerMaterial = new THREE.MeshBasicMaterial({color: 0xf2d29a, side: THREE.DoubleSide});
  for (const [room, x] of Object.entries(locations)) {
    const ring = new THREE.Mesh(ringGeometry, markerMaterial);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, .025, .9); ring.userData = {room}; scene.add(ring);
    const hit = new THREE.Mesh(new THREE.CircleGeometry(.7, 20), new THREE.MeshBasicMaterial({visible: false}));
    hit.rotation.x = -Math.PI / 2; hit.position.copy(ring.position); hit.userData = {room}; scene.add(hit); interactive.push(hit);
    // The entire open threshold is selectable, without an opaque fake doorway.
    const doorway = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({visible: false}));
    doorway.position.set(x, 1.8, .4); doorway.scale.set(5.1, 3.5, 1); doorway.userData = {room}; scene.add(doorway); interactive.push(doorway);
  }
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.transforms.length);
    mesh.castShadow = mesh.receiveShadow = true;
    batch.transforms.forEach((transform, index) => mesh.setMatrixAt(index, transform));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); scene.add(mesh);
  }
  scene.add(new THREE.HemisphereLight(0xe5ecdf, 0x4e3a21, .95));
  const sun = new THREE.DirectionalLight(0xffdfad, 1.8); sun.position.set(-12, 15, 12);
  sun.castShadow = true; sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, {left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 50});
  sun.shadow.bias = -.001; sun.shadow.normalBias = .07; scene.add(sun);
  const moon = new THREE.DirectionalLight(0x7d9dba, .4); moon.position.set(10, 8, -4); scene.add(moon);

  const target = new THREE.Vector3();
  const startPosition = new THREE.Vector3(), endPosition = new THREE.Vector3();
  const startTarget = new THREE.Vector3(), endTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let yaw = 0, pitch = 0, moving = false, started = 0, frame = 0;
  let renderedFrames = 0;
  let cameraRoom = 'lobby', routed = false;
  function destination(room) {
    if (room === 'lobby') {
      const small = canvas.clientWidth < 600;
      const portrait = canvas.clientWidth / canvas.clientHeight < 1.1;
      return {position: new THREE.Vector3(small ? 3 : 8, small ? 4.5 : 3.8, small ? 45 : portrait ? 34 : 20), target: new THREE.Vector3(0, small ? -1.1 : .4, -2)};
    }
    const x = locations[room];
    return {position: new THREE.Vector3(x, 1.95, -.65), target: new THREE.Vector3(x, 2.05, -8)};
  }
  function orient() {
    lookTarget.copy(target).sub(camera.position);
    const distance = lookTarget.length();
    const angle = Math.atan2(lookTarget.x, -lookTarget.z) + yaw;
    const vertical = Math.asin(lookTarget.y / distance) + pitch;
    lookTarget.set(Math.sin(angle) * Math.cos(vertical), Math.sin(vertical), -Math.cos(angle) * Math.cos(vertical));
    camera.lookAt(lookTarget.add(camera.position));
  }
  function render(now) {
    frame = 0;
    if (document.hidden || document.body.dataset.view !== '3d' || !available) return;
    if (moving) {
      const progress = Math.min((now - started) / 1350, 1);
      const ease = progress * progress * (3 - 2 * progress);
      if (routed) {
        // Leave through the open threshold, cross the arcade, then enter the next room.
        if (ease < .3) camera.position.set(startPosition.x, startPosition.y, THREE.MathUtils.lerp(startPosition.z, 2, ease / .3));
        else if (ease < .7) camera.position.set(THREE.MathUtils.lerp(startPosition.x, endPosition.x, (ease - .3) / .4), THREE.MathUtils.lerp(startPosition.y, endPosition.y, (ease - .3) / .4), 2);
        else camera.position.set(endPosition.x, endPosition.y, THREE.MathUtils.lerp(2, endPosition.z, (ease - .7) / .3));
      } else camera.position.lerpVectors(startPosition, endPosition, ease);
      target.lerpVectors(startTarget, endTarget, ease);
      moving = progress < 1;
    }
    orient(); renderer.render(scene, camera);
    window.__sceneStats = {drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, moving, room: current, pixelRatio: renderer.getPixelRatio(), frames: ++renderedFrames};
    if (moving) requestRender();
  }
  requestRender = () => {
    if (!frame && !document.hidden && document.body.dataset.view === '3d') frame = requestAnimationFrame(render);
  };
  travel = room => {
    cameraRoom = room; yaw = pitch = 0;
    const next = destination(room);
    routed = camera.position.z < -.3 && Math.abs(camera.position.x - next.position.x) > 3;
    startPosition.copy(camera.position); startTarget.copy(target);
    endPosition.copy(next.position); endTarget.copy(next.target);
    moving = !reducedMotion.matches;
    started = performance.now();
    if (!moving) { camera.position.copy(endPosition); target.copy(endTarget); }
    requestRender();
  };
  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 600 ? 1.5 : 2));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (!moving) { const next = destination(cameraRoom); camera.position.copy(next.position); target.copy(next.target); }
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(interactive, false).find(hit => hit.object.userData.product ? current === 'newmoon' : current === 'lobby')?.object;
  }
  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch, moved: false};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) { canvas.style.cursor = hitTest(event.clientX, event.clientY) ? 'pointer' : 'grab'; return; }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    yaw = THREE.MathUtils.clamp(drag.yaw - dx * .0035, -.6, .6);
    pitch = THREE.MathUtils.clamp(drag.pitch + dy * .003, -.25, .27);
    requestRender();
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved) {
      const object = hitTest(event.clientX, event.clientY);
      if (object?.userData.product) openProduct(object.userData.product, canvas);
      else if (object?.userData.room) selectRoom(object.userData.room);
    }
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); if (frame) cancelAnimationFrame(frame); frame = 0;
    fallback('The 3D context was interrupted. The complete store and product list is available below. Reload to try 3D again.');
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { moving = false; camera.position.copy(endPosition); target.copy(endTarget); requestRender(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; }
    else requestRender();
  });
  available = true;
  const initial = destination('lobby'); camera.position.copy(initial.position); target.copy(initial.target);
  endPosition.copy(initial.position); endTarget.copy(initial.target);
  setView('3d'); selectRoom('lobby'); moving = false; resize();
  status.textContent = '';
  requestAnimationFrame(() => { render(performance.now()); window.__sceneReady = true; });
}
initialize().catch(() => fallback('3D could not start. The complete, accessible store and product list is available below.'));
