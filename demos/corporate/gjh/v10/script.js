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
dialog.addEventListener('close', () => {
  // Native restoration usually wins; never steal focus from a newer interaction.
  if (document.activeElement === document.body || dialog.contains(document.activeElement)) returnFocus?.focus({preventScroll: true});
});
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const first = document.querySelector('#product-close');
  const last = document.querySelector('#product-shop');
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
});

function selectRoom(room) {
  if (!rooms.includes(room) || !available) return;
  if (current === room && document.body.dataset.room === room) return;
  current = room;
  document.body.dataset.room = room;
  document.querySelector('#room-title').textContent = labels[room];
  document.querySelector('#room-description').textContent = descriptions[room];
  document.querySelector('.page-intro .eyebrow').textContent = room === 'lobby' ? 'An evening at the arcade' : labels[room];
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
  const desktopQuality = matchMedia('(min-width: 1000px)').matches &&
    (navigator.hardwareConcurrency || 2) >= 4 && (navigator.deviceMemory || 4) >= 4;
  const renderer = new THREE.WebGLRenderer({canvas, context, antialias: true});
  renderer.setClearColor(0x142c29);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = desktopQuality;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x777c60, .024);
  const arcade = new THREE.Group(); scene.add(arcade);
  const proportioned = [];
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 180);
  // World-space dusk: the warm horizon and fog share a color, with no floor seam.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 direction;
      void main(){
        float h=normalize(direction).y;
        vec3 horizon=vec3(.185,.202,.125);
        vec3 zenith=vec3(.013,.052,.048);
        vec3 color=mix(horizon,zenith,smoothstep(0.,.45,h));
        color+=vec3(.10,.045,.012)*exp(-pow((h-.055)*12.,2.));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  scene.add(sky);
  const starPositions = [];
  for (let i = 0; i < 38; i++) {
    const azimuth = i * 2.39996, elevation = .18 + ((i * 17) % 31) / 65;
    starPositions.push(Math.sin(azimuth) * 115 * Math.cos(elevation), Math.sin(elevation) * 115, -Math.cos(azimuth) * 115 * Math.cos(elevation));
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({color: 0xf9e8bf, size: .18, transparent: true, opacity: .6, fog: false})));
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
    stone: material(0x40594b, {metalness: .12, roughness: .29}), stoneAlt: material(0x394e42, {metalness: .1, roughness: .34}),
    rug: material(0x253d32, {roughness: .96}), rugBorder: material(0x8d794b, {roughness: .88}),
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
    if (!artMaterials.has(name)) artMaterials.set(name, material(0xffffff, {map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .25, roughness: .8, side: THREE.DoubleSide}));
    const mesh = new THREE.Mesh(plane, artMaterials.get(name));
    mesh.position.set(x, y, z); mesh.scale.set(width, height, 1); mesh.rotation.y = rotationY;
    arcade.add(mesh);
    if (rotationY === 0) proportioned.push({mesh, width});
    if (data) { mesh.userData = data; interactive.push(mesh); }
    return mesh;
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
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .09, z); mesh.scale.set(width, depth, 1); arcade.add(mesh);
  }
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext('2d');
  const glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowGradient.addColorStop(0, 'rgba(255,218,151,.5)');
  glowGradient.addColorStop(.22, 'rgba(255,203,117,.16)');
  glowGradient.addColorStop(1, 'rgba(255,203,117,0)');
  glowContext.fillStyle = glowGradient; glowContext.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const haloMaterial = new THREE.SpriteMaterial({map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .48});
  const poolMaterial = new THREE.MeshBasicMaterial({map: glowTexture, transparent: true, depthWrite: false, opacity: .32, blending: THREE.AdditiveBlending});
  function halo(x, y, z, size) {
    if (!desktopQuality) return;
    const sprite = new THREE.Sprite(haloMaterial);
    sprite.position.set(x, y, z); sprite.scale.set(size, size, 1); arcade.add(sprite);
  }
  function lightPool(x, z) {
    const pool = new THREE.Mesh(plane, poolMaterial);
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, .095, z); pool.scale.set(4.5, 4.5, 1); arcade.add(pool);
  }
  const focusRing = new THREE.Mesh(new THREE.RingGeometry(.36, .39, 48), new THREE.MeshBasicMaterial({color: 0xffe4a6, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false}));
  focusRing.rotation.x = -Math.PI / 2; focusRing.visible = false; arcade.add(focusRing);
  const productLight = new THREE.PointLight(0xffe6b2, 0, 3, 2); arcade.add(productLight);
  let highlightedProduct = null;
  function highlightProduct(id) {
    const focused = document.activeElement.closest('#products button');
    id = current === 'newmoon' ? (focused?.dataset.product || id) : null;
    const mesh = id ? interactive.find(item => item.userData.product === id) : null;
    highlightedProduct = mesh ? id : null;
    focusRing.visible = !!mesh && current === 'newmoon';
    productLight.intensity = focusRing.visible ? 5 : 0;
    if (mesh) {
      focusRing.position.copy(mesh.position); focusRing.position.y -= mesh.scale.y / 2 - .025;
      productLight.position.copy(mesh.position); productLight.position.z += .7;
    }
    requestRender();
  }
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture, color: 0xffedc6, transparent: true, depthWrite: false, fog: false}));
  moonDisc.position.set(26, 38, -75); moonDisc.scale.set(8, 8, 1); scene.add(moonDisc);
  const moonCore = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 12), new THREE.MeshBasicMaterial({color: 0xf2e2b8, fog: false}));
  moonCore.position.copy(moonDisc.position); scene.add(moonCore);
  // A continuous tiled arcade, open to the evening on the south side.
  box('dark', 0, -.22, -.5, 24, .4, 23);
  box('stoneAlt', 0, -.12, 4, 160, .1, 160);
  for (let x = -17; x <= 17; x += 2) {
    for (let z = -1; z <= 39; z += 2) box((x + z) % 4 === 0 ? 'stone' : 'stoneAlt', x, -.025, z, 1.985, .06, 1.985);
  }
  // A tailored runner and fine brass joints lead the eye to the three thresholds.
  box('rugBorder', 0, .017, 7.2, 3.7, .025, 13);
  box('rug', 0, .033, 7.2, 3.5, .025, 12.8);
  for (const x of [-10.5, -3.5, 3.5, 10.5]) box('brass', x, .014, 5, .018, .018, 12);
  for (const z of [1, 7, 13]) box('brass', 0, .014, z, 22, .018, .018);
  box('rugBorder', 0, .017, 23, 3.7, .025, 18);
  box('rug', 0, .033, 23, 3.5, .025, 17.8);
  for (let z = 2; z <= 30; z += 1.3) {
    for (const x of [-1.3, 1.3]) box('rugBorder', x, .048, z, .12, .008, .12, Math.PI / 4);
    box('rugBorder', 0, .048, z, .27, .008, .27, Math.PI / 4);
  }
  // Open pergola and planted arrival court give portrait views a foreground.
  for (const x of [-3.6, 3.6]) {
    box('wood', x, 5.65, 12, .16, .18, 17);
    box('brass', x, 5.53, 12, .035, .035, 17);
  }
  for (let z = 7; z <= 20; z += 2.6) box('wood', 0, 5.75, z, 7.4, .16, .12);
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
    halo(x, drop - .15, z, 1.6);
    lightPool(x, z);
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
    cylinder('brass', x, .71, z, .355, .045);
    cylinder('wood', x, 1.05, z, .045, 1.3);
    sphere('foliage', x, 1.65, z, .55, .85, .48);
    sphere('foliage', x + .28, 1.9, z - .12, .36, .62, .35);
    shadow(x, z, 2, 2);
  }
  // Layered cornices and softly lit pilasters articulate the arcade edges.
  for (const y of [.3, 4.8, 5.12]) box('brass', 0, y, .4, 23, .045, .08);
  for (const x of [-11.25, -3.5, 3.5, 11.25]) {
    box('woodLight', x, 2.55, .38, .22, 4.4, .12);
    box('brass', x, 2.55, .46, .025, 4.2, .025);
    box('brass', x, 2.7, .61, .32, .65, .16);
    cylinder('glow', x, 2.75, .8, .13, .4);
    cylinder('brass', x, 3, .8, .2, .06);
    cylinder('brass', x, 2.5, .8, .2, .06);
    halo(x, 2.75, .9, 2.8);
    const wash = new THREE.Mesh(plane, poolMaterial);
    wash.position.set(x, 2.8, .49); wash.scale.set(1.8, 4, 1); arcade.add(wash);
    lightPool(x, 1);
  }
  plant(-3.6, 16); plant(3.6, 16);
  plant(-4.8, 14.7); plant(4.8, 14.7);
  bench(-7.8, 19); bench(7.8, 19);
  pendant(0, 16, 4.5);
  for (const [room, x] of Object.entries(locations)) {
    const wall = room === 'mili' ? 'ivory' : 'green';
    for (let plank = 0; plank < 14; plank++) box(plank % 3 ? 'woodLight' : 'wood', x - 3.2 + plank * .49, -.01, -5, .48, .07, 10);
    box(wall, x, 2.55, -10, 7, 5.1, .2);
    box(wall, x - 3.45, 2.55, -5, .16, 5.1, 10);
    box(wall, x + 3.45, 2.55, -5, .16, 5.1, 10);
    box('cream', x, 5.1, -5, 7, .18, 10);
    box('wood', x, .2, -9.84, 6.8, .38, .09);
    const facade = new THREE.Mesh(archGeometry, materials.green); facade.position.set(x, 0, -.15); facade.castShadow = facade.receiveShadow = true; arcade.add(facade);
    const band = new THREE.Mesh(bandGeometry, materials.brass); band.position.set(x, 2.1, .32); arcade.add(band);
    for (const side of [-1, 1]) {
      box('brass', x + side * 2.72, 1.05, .35, .055, 2.1, .055);
      box('dark', x + side * 3.28, 2.5, .3, .4, 5, .32);
      box('brass', x + side * 3.28, .2, .35, .5, .08, .4);
      box('brass', x + side * 3.28, 4.6, .35, .5, .08, .4);
    }
    // Low, illuminated sign over the actual threshold. Logo proportions are untouched.
    const sign = new THREE.Group(); sign.position.set(x, 3.76, .65); sign.scale.y = .85; arcade.add(sign);
    const frame = new THREE.Mesh(geometries.box, materials.brass);
    frame.position.z = .02; frame.scale.set(2.25, 1.3, .16); sign.add(frame);
    const backing = new THREE.Mesh(geometries.box, materials.cream);
    backing.position.z = .13; backing.scale.set(2.13, 1.18, .09); sign.add(backing);
    const logo = artwork(room === 'newmoon' ? 'new-moon-logo.svg' : `${room}-logo.jpg`, 0, 0, .18, 2.0, 0, {room});
    sign.add(logo);
    proportioned.pop(); proportioned.push({mesh: sign, width: .85});
    for (const dx of [-.9, .9]) cylinder('brass', x + dx, 4.53, .65, .018, .35);
    halo(x, 3.76, .3, 3.6);
    pendant(x, -5.4); pendant(x + .4, 2.3, 4.2);
    const reverseLogo = artwork(room === 'newmoon' ? 'new-moon-logo.svg' : `${room}-logo.jpg`, 0, 0, -.08, 2, Math.PI, {room});
    sign.add(reverseLogo);
    const tint = room === 'mili' ? 0xffeed1 : room === 'gogo' ? 0xc7efbd : 0xffd098;
    const light = new THREE.PointLight(tint, room === 'mili' ? 95 : 72, 15, 2);
    light.position.set(x, 3.8, -5); arcade.add(light);
    if (room === 'newmoon') {
      box('dark', x, 2, -9.55, 5.8, 3.5, .36);
      for (const sx of [-2.8, 0, 2.8]) box('wood', x + sx, 1.9, -9.15, .12, 3.8, .85);
      for (const y of [.35, 1.85, 3.4]) {
        box('woodLight', x, y, -8.95, 5.8, .14, 1.65);
        box('glow', x, y - .08, -8.14, 5.5, .025, .025);
      }
      box('wood', x + 2.35, .55, -5.5, 1.05, 1.1, 1.9);
      box('cream', x + 2.35, 1.15, -5.5, 1.2, .13, 2.05);
      for (let stripe = 0; stripe < 5; stripe++) box('woodLight', x + 1.9 + stripe * .21, .57, -4.54, .06, .92, .025);
      shadow(x + 2.35, -5.5, 2.7, 3.5);
      const {createProductModels} = await import('./assets/product-models.js');
      const cans = createProductModels(THREE, arcade, textures, materials.brass);
      interactive.push(...cans);
      cans.forEach(mesh => proportioned.push({mesh, width: mesh.scale.x}));
      artwork('new-moon-brand-cover.jpg', x - 3.35, 2.6, -5.8, 2.4, Math.PI / 2);
      const coverTexture = textures.get('new-moon-brand-cover.jpg');
      const coverFrame = new THREE.Mesh(geometries.box, materials.brass);
      coverFrame.position.set(x - 3.38, 2.6, -5.8);
      coverFrame.scale.set(.06, 2.4 * coverTexture.image.height / coverTexture.image.width + .12, 2.52);
      arcade.add(coverFrame);
      artwork('new-moon-logo.svg', x + 2.35, .65, -4.52, .7);
      bench(x - 2.1, -2.7, Math.PI / 2);
      box('rugBorder', x, .04, -5.8, 4.8, .025, 4);
      box('rug', x, .06, -5.8, 4.65, .025, 3.85);
    } else {
      // A clear central axis: framed verified artwork, low logo plinth, soft rug.
      const pictureFrame = new THREE.Mesh(geometries.box, materials.brass);
      pictureFrame.position.set(x, 2.9, -9.78); pictureFrame.scale.set(3.42, 3.42, .08);
      arcade.add(pictureFrame); proportioned.push({mesh: pictureFrame, width: 3.42});
      artwork(`${room}-brand-cover.jpg`, x, 2.9, -9.72, 3.3);
      box('rugBorder', x, .045, -5.6, 4.7, .035, 5.8);
      box(room === 'mili' ? 'upholstery' : 'rug', x, .067, -5.6, 4.55, .025, 5.65);
      box(room === 'mili' ? 'ivory' : 'green', x, .42, -7.7, 3.8, .8, 1.1);
      box('brass', x, .84, -7.7, 3.9, .045, 1.15);
      artwork(`${room}-logo.jpg`, x, .47, -7.12, 1.45);
      // Shelves contain architectural decor only, never fictional products.
      for (const side of [-1, 1]) {
        const sx = x + side * 2.85;
        box('wood', sx, 1.7, -7, .7, 3.1, .08);
        for (const y of [.45, 1.4, 2.35]) {
          box('woodLight', sx, y, -6.6, .85, .1, .85);
          cylinder('terracotta', sx, y + .21, -6.6, .17, .32);
          if (side > 0) sphere('foliage', sx, y + .55, -6.6, .24, .28, .24);
          else {
            box('ivory', sx + .24, y + .25, -6.6, .07, .4, .3);
            box('brass', sx + .33, y + .23, -6.6, .06, .36, .3);
          }
        }
      }
      bench(x - 2.55, -3.9, Math.PI / 2);
      plant(x + 2.5, -8.9);
      if (room === 'gogo') {
        plant(x - 2.5, -8.9); plant(x + 2.5, -3.6);
        for (let z = -8.8; z < -3; z += .5) box('woodLight', x - 3.32, 2.6, z, .065, 4.7, .045);
        box('brass', x - 3.27, 3.9, -6, .035, .035, 6);
      } else {
        for (const side of [-1, 1]) {
          box('cream', x + side * 3.33, 1.3, -5.7, .035, 2.3, 6.5);
          box('brass', x + side * 3.28, 2.5, -5.7, .035, .035, 6.5);
        }
      }
    }
    for (const side of [-1, 1]) {
      box('brass', x + side * 3.28, 2.7, -3.5, .12, .6, .28);
      sphere('glow', x + side * 3.14, 2.7, -3.5, .16, .22, .16);
      halo(x + side * 3.05, 2.7, -3.5, 1.4);
    }
  }
  bench(-6.9, 6.1); bench(6.9, 6.1);
  plant(-10.4, 2.6); plant(10.4, 2.6);
  plant(-4.8, 8.2); plant(4.8, 8.2);
  for (const x of [-11.3, 11.3]) {
    box('brass', x, 2.5, 2.2, .09, 5, .09);
    shadow(x, 2.2, 1.3, 1.3);
  }
  for (const x of [-3.5, 3.5]) {
    cylinder('brass', x, .08, 9.2, .3, .1);
    cylinder('brass', x, .42, 9.2, .035, .65);
    cylinder('glow', x, .75, 9.2, .16, .26);
    cylinder('brass', x, .91, 9.2, .22, .06);
    halo(x, .75, 9.2, 1.6); lightPool(x, 9.2);
  }
  const ringGeometry = new THREE.RingGeometry(.29, .33, 36);
  const markerMaterial = new THREE.MeshBasicMaterial({color: 0xf2d29a, side: THREE.DoubleSide});
  const hitMaterial = new THREE.MeshBasicMaterial({visible: false});
  const hitGeometry = new THREE.CircleGeometry(.7, 20);
  for (const [room, x] of Object.entries(locations)) {
    const ring = new THREE.Mesh(ringGeometry, markerMaterial);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, .025, .9); ring.userData = {room}; arcade.add(ring);
    const hit = new THREE.Mesh(hitGeometry, hitMaterial);
    hit.rotation.x = -Math.PI / 2; hit.position.copy(ring.position); hit.userData = {room}; arcade.add(hit); interactive.push(hit);
    const doorway = new THREE.Mesh(plane, hitMaterial);
    doorway.position.set(x, 1.8, .4); doorway.scale.set(5.1, 3.5, 1); doorway.userData = {room}; arcade.add(doorway); interactive.push(doorway);
  }
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.transforms.length);
    mesh.castShadow = false; mesh.receiveShadow = true;
    batch.transforms.forEach((transform, index) => mesh.setMatrixAt(index, transform));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); arcade.add(mesh);
  }
  scene.add(new THREE.HemisphereLight(0xe5ecdf, 0x4e3a21, .95));
  const sun = new THREE.DirectionalLight(0xffdfad, 1.8); sun.position.set(-12, 15, 12);
  sun.castShadow = desktopQuality; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 50});
  sun.shadow.bias = -.001; sun.shadow.normalBias = .07; scene.add(sun);
  const moon = new THREE.DirectionalLight(0x7d9dba, .4); moon.position.set(10, 8, -4); scene.add(moon);

  const target = new THREE.Vector3();
  const startPosition = new THREE.Vector3(), endPosition = new THREE.Vector3();
  const startTarget = new THREE.Vector3(), endTarget = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let yaw = 0, pitch = 0, moving = false, started = 0, frame = 0;
  let desiredYaw = 0, desiredPitch = 0, parallaxX = 0, parallaxY = 0;
  let smoothParallaxX = 0, smoothParallaxY = 0, lastRender = 0, idleYaw = 0, idlePitch = 0;
  let startFov = 48, endFov = 48;
  let renderedFrames = 0;
  let cameraRoom = 'lobby', routed = false;
  function destination(room) {
    if (room === 'lobby') {
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const portrait = aspect < 1.1;
      const fov = portrait ? 45 : 48;
      const distance = portrait ? 10.8 * arcade.scale.x / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect) : 16.8;
      return {position: new THREE.Vector3(portrait ? 0 : 1.2, portrait ? 1.4 : 1.65, distance), target: new THREE.Vector3(0, portrait ? 1.85 : 2.9, 0), fov};
    }
    const x = locations[room] * arcade.scale.x;
    const portrait = canvas.clientWidth / canvas.clientHeight < 1;
    return {position: new THREE.Vector3(x, 1.95, -.65), target: new THREE.Vector3(x, 2.05, -8), fov: portrait ? 57 : 48};
  }
  function orient() {
    lookTarget.copy(target).sub(camera.position);
    const distance = lookTarget.length();
    const angle = Math.atan2(lookTarget.x, -lookTarget.z) + yaw + idleYaw + smoothParallaxX;
    const vertical = Math.asin(lookTarget.y / distance) + pitch + idlePitch + smoothParallaxY;
    lookTarget.set(Math.sin(angle) * Math.cos(vertical), Math.sin(vertical), -Math.cos(angle) * Math.cos(vertical));
    camera.lookAt(lookTarget.add(camera.position));
  }
  function render(now) {
    frame = 0;
    if (document.hidden || document.body.dataset.view !== '3d' || !available) return;
    const breathing = current === 'lobby' && !reducedMotion.matches && !dialog.open;
    const delta = Math.min((now - lastRender) / 1000, .05);
    lastRender = now;
    const damping = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 18);
    yaw += (desiredYaw - yaw) * damping; pitch += (desiredPitch - pitch) * damping;
    smoothParallaxX += (parallaxX - smoothParallaxX) * damping;
    smoothParallaxY += (parallaxY - smoothParallaxY) * damping;
    const settling = Math.abs(desiredYaw - yaw) + Math.abs(desiredPitch - pitch) +
      Math.abs(parallaxX - smoothParallaxX) + Math.abs(parallaxY - smoothParallaxY) > .0001;
    idleYaw = breathing && !moving ? Math.sin(now * .00022) * .004 : 0;
    idlePitch = breathing && !moving ? Math.cos(now * .00028) * .002 : 0;
    if (moving) {
      const progress = Math.min((now - started) / 1350, 1);
      const ease = progress * progress * (3 - 2 * progress);
      if (routed) {
        // Leave through the open threshold before crossing the arcade.
        if (ease < .3) camera.position.set(startPosition.x, startPosition.y, THREE.MathUtils.lerp(startPosition.z, 2, ease / .3));
        else if (ease < .7) camera.position.set(THREE.MathUtils.lerp(startPosition.x, endPosition.x, (ease - .3) / .4), THREE.MathUtils.lerp(startPosition.y, endPosition.y, (ease - .3) / .4), 2);
        else camera.position.set(endPosition.x, endPosition.y, THREE.MathUtils.lerp(2, endPosition.z, (ease - .7) / .3));
      } else camera.position.lerpVectors(startPosition, endPosition, ease);
      target.lerpVectors(startTarget, endTarget, ease);
      camera.fov = THREE.MathUtils.lerp(startFov, endFov, ease) - Math.sin(progress * Math.PI) * 2;
      camera.updateProjectionMatrix();
      moving = progress < 1;
    }
    orient(); renderer.render(scene, camera);
    window.__sceneStats = {drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, moving, settling, breathing, highlightedProduct, room: current, pixelRatio: renderer.getPixelRatio(), frames: ++renderedFrames, quality: renderer.shadowMap.enabled ? 'desktop' : 'mobile', fov: camera.fov};
    if (moving || settling || breathing) requestRender();
  }
  requestRender = () => {
    if (!frame && !document.hidden && document.body.dataset.view === '3d') frame = requestAnimationFrame(render);
  };
  travel = room => {
    cameraRoom = room; yaw = pitch = desiredYaw = desiredPitch = 0;
    parallaxX = parallaxY = smoothParallaxX = smoothParallaxY = 0;
    highlightProduct(null);
    arcade.scale.x = canvas.clientWidth / canvas.clientHeight < 1.1 ? (room === 'lobby' ? .4 : .62) : 1;
    proportioned.forEach(({mesh, width}) => { mesh.scale.x = width / arcade.scale.x; });
    const next = destination(room);
    routed = camera.position.z < -.3 && Math.abs(camera.position.x - next.position.x) > 3;
    startPosition.copy(camera.position); startTarget.copy(target);
    endPosition.copy(next.position); endTarget.copy(next.target);
    startFov = camera.fov; endFov = next.fov;
    moving = !reducedMotion.matches;
    started = performance.now();
    if (!moving) { camera.position.copy(endPosition); target.copy(endTarget); camera.fov = endFov; camera.updateProjectionMatrix(); }
    requestRender();
  };
  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    // Portrait architecture is a narrower arcade, not a wider-angle distant view.
    // Original logo, poster and can proportions remain invariant.
    arcade.scale.x = width / height < 1.1 ? (cameraRoom === 'lobby' ? .4 : .62) : 1;
    proportioned.forEach(({mesh, width: originalWidth}) => { mesh.scale.x = originalWidth / arcade.scale.x; });
    scene.fog.density = width < 600 ? .014 : .024;
    renderer.shadowMap.enabled = desktopQuality && width >= 1000;
    haloMaterial.visible = renderer.shadowMap.enabled;
    if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 600 ? 1.5 : 2));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (!moving) {
      const next = destination(cameraRoom);
      camera.position.copy(next.position); target.copy(next.target);
      endPosition.copy(next.position); endTarget.copy(next.target);
      camera.fov = endFov = next.fov; camera.updateProjectionMatrix();
    }
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
    if (!drag) {
      const hit = hitTest(event.clientX, event.clientY);
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      highlightProduct(hit?.userData.product);
      if (event.pointerType === 'mouse' && canvas.clientWidth >= 1000 && !reducedMotion.matches) {
        const rect = canvas.getBoundingClientRect();
        parallaxX = ((event.clientX - rect.left) / rect.width - .5) * .012;
        parallaxY = ((event.clientY - rect.top) / rect.height - .5) * -.008;
        requestRender();
      }
      return;
    }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    desiredYaw = THREE.MathUtils.clamp(drag.yaw - dx * .0035, -.6, .6);
    desiredPitch = THREE.MathUtils.clamp(drag.pitch + dy * .003, -.25, .27);
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
  canvas.addEventListener('pointerleave', () => {
    highlightProduct(null); parallaxX = parallaxY = 0; requestRender();
  });
  document.querySelectorAll('#products button').forEach(button => {
    button.addEventListener('focus', () => highlightProduct(button.dataset.product));
    button.addEventListener('blur', () => highlightProduct(null));
    button.addEventListener('pointerenter', () => highlightProduct(button.dataset.product));
    button.addEventListener('pointerleave', () => highlightProduct(null));
  });
  dialog.addEventListener('close', () => requestRender());
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); if (frame) cancelAnimationFrame(frame); frame = 0;
    fallback('The 3D context was interrupted. The complete store and product list is available below. Reload to try 3D again.');
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { moving = false; camera.position.copy(endPosition); target.copy(endTarget); camera.fov = endFov; camera.updateProjectionMatrix(); requestRender(); }
    if (reducedMotion.matches) {
      parallaxX = parallaxY = smoothParallaxX = smoothParallaxY = 0;
      yaw = desiredYaw; pitch = desiredPitch;
    }
    requestRender();
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
