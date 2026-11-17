import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {addAmenities,SHOWCASE_PRODUCTS} from './amenities.js';
import {createDeckRailings} from './deck-railings.js';
import {createFurnishings} from './furnishings.js';
import {createShell} from './shell.js';
import {SHELL_LAYOUT} from './interior-shell-registry.js';
import {spatial, storeCenterX} from './spatial.js';
import {expandedLayout} from './expanded-layout.js';
import {atriumLayout} from './atrium-layout.js';
import {addShopSignAtlas} from './shop-signs.js';
import {addExpandedStorefronts} from './expanded-storefronts.js';
import {createExpandedInteriors} from './expanded-interiors.js';
import {liftLayout,cutRectangle,showcaseProducts} from './lift-layout.js';
import {releaseStartupAssetPack} from './startup-asset-pack.js';
import {createSeatPlacements, createSeatAnchor} from './seat-placements.js';
import {addFeatureKiosk} from './feature-kiosk.js';

export function applyMallThemeToWorld(theme, {expanded, materials, ambient, key, fill}) {
  if (!expanded || !theme?.materials || !theme?.lighting) return false;
  const m=theme.materials,l=theme.lighting;
  const colors=['floorTextured','floorFlat','ceiling','ceilingGlow','wall','green','ivory','brass','wood','oak','timber','timberAlt','glass','glow','glowEmission'];
  const lightColors=['sky','ground','key','fill'];
  const scalars=['ceilingGlowIntensity','glassOpacity','glassRoughness','glassMetalness','glowIntensity'];
  if(colors.some(k=>!Number.isInteger(m[k])||m[k]<0||m[k]>0xffffff)||lightColors.some(k=>!Number.isInteger(l[k])||l[k]<0||l[k]>0xffffff)||
     scalars.some(k=>!Number.isFinite(m[k])||m[k]<0||m[k]>3)||['ambient','keyIntensity','fillIntensity'].some(k=>!Number.isFinite(l[k])||l[k]<0||l[k]>5)||
     ['glassOpacity','glassRoughness','glassMetalness'].some(k=>m[k]>1)) return false;
  materials.shellFloor.color.set(materials.shellFloor.map?m.floorTextured:m.floorFlat);
  materials.shellCeiling.color.set(m.ceiling);materials.shellCeiling.emissive.set(m.ceilingGlow);materials.shellCeiling.emissiveIntensity=m.ceilingGlowIntensity;
  materials.shellWall.color.set(m.wall);
  for(const role of ['green','ivory','brass','wood','oak','timber','timberAlt']) materials[role].color.set(m[role]);
  materials.glass.color.set(m.glass);materials.glass.opacity=m.glassOpacity;materials.glass.roughness=m.glassRoughness;materials.glass.metalness=m.glassMetalness;
  materials.glow.color.set(m.glow);materials.glow.emissive.set(m.glowEmission);materials.glow.emissiveIntensity=m.glowIntensity;
  ambient.color.set(l.sky);ambient.groundColor.set(l.ground);ambient.intensity=l.ambient;key.color.set(l.key);key.intensity=l.keyIntensity;fill.color.set(l.fill);fill.intensity=l.fillIntensity;
  return true;
}

// Continuous, metre-scale architecture. All repeated architectural solids are instanced.
export async function createWorld(T, R, physics, expanded = false) {
  try {
  const [furnishings, shell, deckRailings] = await Promise.all([createFurnishings(T, true), expanded ? null : createShell(T), expanded ? createDeckRailings(T) : null]);
  let shellState = null;
  const expandedLift=expanded&&new URLSearchParams(location.search).get('visitor')!=='v1';
  const ceilingObstacles=[];
  function ceilingBox(material,x,y,z,sx,sy,sz,hole=liftLayout.shaft){
    if(!expandedLift){box(material,x,y,z,sx,sy,sz);return [{minX:x-sx/2,maxX:x+sx/2,minZ:z-sz/2,maxZ:z+sz/2}];}
    const panels=cutRectangle({minX:x-sx/2,maxX:x+sx/2,minZ:z-sz/2,maxZ:z+sz/2},hole);
    for(const r of panels){
      box(material,(r.minX+r.maxX)/2,y,(r.minZ+r.maxZ)/2,r.maxX-r.minX,sy,r.maxZ-r.minZ);
      ceilingObstacles.push({min:{x:r.minX,y:y-sy/2,z:r.minZ},max:{x:r.maxX,y:y+sy/2,z:r.maxZ}});
    }
    return panels;
  }
  const seats=[], seatPlacements=createSeatPlacements(expanded);
  const scene = new T.Scene();
  scene.background = new T.Color(0x192e32);
  scene.fog = new T.Fog(0xb7ad9c, expanded ? 75 : 40, expanded ? 155 : 100);
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .72, ...extra});
  const materials = {
    jade: mat(0x21483e, {roughness: .24, metalness: .22}), jadeAlt: mat(0x244c42, {roughness: .28, metalness: .18}),
    courtStone: mat(0x49665b, {roughness: .32, metalness: .16}),
    shellFloor: mat(0xc9c2ac, {roughness: .9}), shellCeiling: mat(0xe7ddc8, {emissive: 0x9d8c70, emissiveIntensity: .35}),
    shellWall: mat(0xb7b6a9, {roughness: .82}),
    rugSand: mat(0x8c8063, {roughness: 1}), rugSage: mat(0x5b6d58, {roughness: 1}),
    green: mat(0x153c30), dark: mat(0x0c2923), ivory: mat(0xe3d6b7), cream: mat(0xf5e8cb),
    newMoonRed: mat(0x8f1621, {roughness: .48}),
    brass: mat(0xb59b62, {metalness: .68, roughness: .31}), wood: mat(0x6b4931), oak: mat(0xa28055),
    timber: mat(0xa48b67), timberAlt: mat(0xa08763),
    foliage: mat(0x315b38), leaf: mat(0x527548), pot: mat(0xb6ab8c), seat: mat(0xc8b38e),
    glow: mat(0xffe7b4, {emissive: 0xffd08a, emissiveIntensity: 1.2}),
    water: mat(0x4f8c80, {metalness: .48, roughness: .15}),
    glass: mat(0xa0c9be, {transparent: true, opacity: .15, metalness: .2, roughness: .1, depthWrite: false, side: T.DoubleSide})
  };
  if(expanded){
    // Optional, local finishes cannot hold walking behind a stalled module.
    // The module is side-effect free: a late import never invokes its factory.
    let timer;
    try{
      const module=await Promise.race([
        import('./natural-materials.js'),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Optional finish timeout')),2000);}),
      ]);
      const natural=module.createNaturalSurfaceTextures(T);
      if(natural.stone){materials.shellFloor.map=natural.stone;materials.shellFloor.color.set(0xe8dbc6);materials.shellFloor.roughness=.38;}
      if(natural.wood)for(const name of ['wood','oak','timber','timberAlt'])materials[name].map=natural.wood;
    }catch{/* Retain usable solid finishes on module/canvas failure. */}
    finally{clearTimeout(timer);}
    if(!materials.shellFloor.map) materials.shellFloor.color.set(0xdac8ae);
    materials.shellCeiling.color.set(0xf0e8d9);materials.shellCeiling.emissive.set(0xb3a286);materials.shellCeiling.emissiveIntensity=.55;
    materials.shellWall.color.set(0xc9c4b6);
    materials.glass.color.set(0xd7e9df);materials.glass.opacity=.19;materials.glass.roughness=.08;materials.glass.metalness=.08;
  }
  const geometry = {
    box: new T.BoxGeometry(1, 1, 1), cylinder: new T.CylinderGeometry(1, 1, 1, 32), sphere: new T.SphereGeometry(1, 12, 8),
    plane: new T.PlaneGeometry(1, 1), torus: new T.TorusGeometry(1, .045, 8, 64), ring: new T.RingGeometry(.985, 1, 64)
  };
  // Each moving leaf has three fixed brass pieces; bake their local transforms
  // into one shared geometry while the parent and physics body remain movable.
  const doorFrameParts = [-1.12,1.12].map(x => geometry.box.clone().scale(.035,3.5,.065).translate(x,0,0));
  doorFrameParts.push(geometry.box.clone().scale(2.25,.035,.065).translate(0,-1.73,0));
  const doorFrameGeometry = mergeGeometries(doorFrameParts);
  doorFrameParts.forEach(part=>part.dispose());
  const batches = new Map(), matrix = new T.Matrix4(), quaternion = new T.Quaternion(), euler = new T.Euler();
  const position = new T.Vector3(), scale = new T.Vector3(), shopLodMeshes=[],shopLodUpdates=[],shopBays=new Map(expandedLayout.slots.map(bay=>[Number(bay.number),bay]));
  let activeShopSlot=null,activeDeck=false,railingState=null;
  const tagShopLod=mesh=>{if(expanded&&activeShopSlot!==null){mesh.userData.shopSlot=activeShopSlot;shopLodMeshes.push(mesh);}return mesh;};
  function solid(type, material, x, y, z, sx, sy, sz, ry = 0, rx = 0, order = 'XYZ') {
    const key = `${type}:${material}${activeShopSlot===null?'':`:shop-${activeShopSlot}`}${activeDeck?':deck':''}`;
    if (!batches.has(key)) batches.set(key, {geometry: geometry[type], material: materials[material], transforms: [],shopSlot:activeShopSlot,deckLod:activeDeck});
    position.set(x, y, z); scale.set(sx, sy, sz); euler.set(rx, ry, 0, order); quaternion.setFromEuler(euler);
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
  // Local textures share the HTML packshots' request mode, avoiding duplicate image loads.
  const textures = new Map(), loader = new T.TextureLoader().setCrossOrigin(undefined);
  const names = ['new-moon-logo.svg', 'mili-logo.jpg', 'gogo-logo.jpg', 'new-moon-brand-cover.jpg', 'mili-brand-cover.jpg', 'gogo-brand-cover.jpg', ...['nz-425g', 'au-425g', 'sa-425g', 'mx-454g'].map(id => `new-moon-${id}-front.jpg`)];
  await Promise.all(names.map(async name => {
    let texture;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = new URL(`assets/${name}`, location.href);
        if (attempt) url.searchParams.set('retry', String(attempt));
        texture = await loader.loadAsync(url.href);
        break;
      } catch (error) {
        if (attempt === 2) throw new Error(`Mall texture failed to load: ${name}`, {cause: error});
        await new Promise(resolve => setTimeout(resolve, attempt ? 800 : 200));
      }
    }
    texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; textures.set(name, texture);
  }));
  const plane = geometry.plane;
  function art(name, x, y, z, width, ry = 0) {
    const texture = textures.get(name), height = width * texture.image.height / texture.image.width;
    const mesh = new T.Mesh(plane, mat(0xffffff, {map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .2}));
    mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.scale.set(width, height, 1); scene.add(mesh);
    return tagShopLod(mesh);
  }
  const roomSigns = [];
  function sign(text, x, y, z, width, height = .4, framed = false, fontSize = 42) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (framed) {
      context.fillStyle = '#17372e'; context.fillRect(0, 0, 1024, 128);
      context.strokeStyle = '#b59b62'; context.lineWidth = 3; context.strokeRect(8, 8, 1008, 112);
    }
    context.fillStyle = '#e9d6a9'; context.font = `500 ${fontSize}px Georgia`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 512, 64);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(plane, new T.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false}));
    mesh.position.set(x, y, z); mesh.scale.set(width, height, 1); scene.add(mesh);
    return tagShopLod(mesh);
  }
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d'), gradient = shadowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(4,18,12,.58)'); gradient.addColorStop(.35, 'rgba(4,18,12,.34)'); gradient.addColorStop(1, 'rgba(4,18,12,0)'); shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const contact = new T.MeshBasicMaterial({map: new T.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false});
  materials.contact=contact;
  function shadow(x, z, w, d) {
    // Legacy quads share texture, color and floor plane; one batch preserves
    // their blending while leaving room for the previously uncounted shadows.
    if (!expanded) { solid('plane','contact',x,.018,z,w,d,1,0,-Math.PI/2); return; }
    const mesh = new T.Mesh(plane, contact); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .018, z); mesh.scale.set(w, d, 1); scene.add(mesh); tagShopLod(mesh);
  }
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
    if (!furnishings.place('planter', x, z, tall, 1, 0, null, activeShopSlot)) {
      cylinder('pot', x, .32, z, .42, .64); cylinder('brass', x, .64, z, .43, .045);
      cylinder('brass', x, .055, z, .4, .075); cylinder('wood', x, .656, z, .37, .016);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        solid('box', 'brass', x + Math.cos(a) * .416, .32, z + Math.sin(a) * .416, .018, .44, .018, a);
      }
      cylinder('wood', x, .9 * tall, z, .04, 1.2 * tall);
      for (let i = 0; i < 5; i++) { const a = i * 2.4; sphere(i % 2 ? 'leaf' : 'foliage', x + Math.cos(a) * .26, (1.25 + i * .12) * tall, z + Math.sin(a) * .26, .36, .6 * tall, .34); }
    }
    collider(x, .4, z, .85, .8, .85); shadow(x, z, 2.1, 2.1);
  }
  function bench(placement) {
    const {x,z,facing}=placement;
    const seatScale=new URLSearchParams(location.search).get('visitor') !== 'v1' ? .8 : 1;
    const seatCollider=collider(x, .3*seatScale, z, placement.clearance.colliderWidth, .4*seatScale, placement.clearance.colliderDepth);
    seats.push(createSeatAnchor(placement,seatCollider.handle));
    const benchBox=(m,bx,by,bz,sx,sy,sz)=>box(m,bx,by*seatScale,bz,sx,sy*seatScale,sz);
    if (!furnishings.place('bench', x, z, seatScale, facing, 0, null, activeShopSlot)) {
      benchBox('wood', x, .3, z, 2.5, .4, .85); benchBox('seat', x, .56, z, 2.55, .18, .9);
      benchBox('seat', x, .94, z + facing * .35, 2.55, .7, .18);
      benchBox('brass', x, .47, z - facing * .451, 2.52, .035, .025);
      benchBox('oak', x, 1.285, z + facing * .35, 2.58, .065, .21);
      for (const dx of [-.42, .42]) {
        benchBox('wood', x + dx, .653, z, .018, .006, .82);
        benchBox('wood', x + dx, .96, z + facing * .253, .018, .52, .008);
      }
      for (const dx of [-1.15, 1.15]) {
        benchBox('brass', x + dx, .68, z, .08, .5, .9);
        benchBox('oak', x + dx, .955, z, .13, .065, .92);
      }
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
  if (expanded) {
    box('dark', 10, -.22, 18, 70, .4, 60, true);
    box('shellFloor', 10, -.035, 18, 70, .04, 60);
  } else {
    // Classic GLBs, fallback/caps and original aggregate proxies share one layout.
    for (const proxy of SHELL_LAYOUT.aggregate_colliders) collider(...proxy.position, ...proxy.size);
    const foundation = SHELL_LAYOUT.foundation_visual;
    box(foundation.material, ...foundation.position, ...foundation.size);
  }
  if (!expanded) {
  for (const [x, y, z] of SHELL_LAYOUT.retained_tiles) box((x + z) % 4 === 1 ? 'jade' : 'jadeAlt', x, y, z, 1.99, .04, 1.99);
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
  }
  if (!expanded) {
    const roof = new URLSearchParams(location.search).get('visitor') !== 'v1' ? SHELL_LAYOUT.roof_v2 : SHELL_LAYOUT.roof_v1;
    for (const component of [...SHELL_LAYOUT.caps, ...roof]) box(component.material, ...component.position, ...component.size);
    shellState = shell.finish(scene, solid);
  }
  if (!expanded) {
  // Skylight replaces the central roof panel visually, with dusk glass and brass ribs.
  ceilingBox('dark', 0, 6.29, 8.3, 14.6, .06, 13);
  ceilingBox('glass', 0, 6.25, 8.3, 14.1, .025, 12.6);
  for (let x = -7; x <= 7; x += 2) ceilingBox('brass', x, 6.18, 8.3, .045, .08, 12.7);
  for (const z of [2, 5.1, 8.3, 11.5, 14.6]) ceilingBox('brass', 0, 6.15, z, 14.1, .08, .045);
  // Dusk-lit ceiling inset: no texture or runtime environment download.
  const skylight = new T.Mesh(new T.PlaneGeometry(14, 12.5), new T.ShaderMaterial({side: T.DoubleSide, vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec2 v;void main(){gl_FragColor=vec4(mix(vec3(.13,.24,.28),vec3(.78,.52,.29),pow(1.-v.y,3.)),1.);}'}));
  skylight.rotation.x = Math.PI / 2; skylight.position.set(0, 6.23, 8.3); scene.add(skylight);
  }
  if (!expanded) for (const x of [-14.5, -5, 5, 14.5]) {
    box('dark', x, 2.9, .4, .65, 5.8, .9, true); box('brass', x, .18, .4, .85, .18, 1.1); box('brass', x, 5.5, .4, .85, .12, 1.1);
    for (const dx of [-.19, 0, .19]) box('brass', x + dx, 2.9, .865, .018, 4.85, .025);
    box('glow', x, 5.36, .87, .52, .025, .025);
    lightPool(x, .053, 1.1, 2.6, 3.1);
  }
  if (!expanded) for (const x of [-14.7, 14.7]) for (const z of [4, 10, 16]) {
    if (!furnishings.place('wallLight', x, z, 1, 1, 2.1, x < 0 ? Math.PI / 2 : -Math.PI / 2)) {
      box('brass', x, 2.6, z, .2, 1.1, .4); box('glow', x + (x < 0 ? .13 : -.13), 2.65, z, .12, .8, .3);
    }
    lightPool(x < 0 ? -14.82 : 14.82, 2.5, z, 2.2, 2.9, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    lightPool(x < 0 ? -14 : 14, .054, z, 2.8, 3.8);
  }
  for (const x of [-9.5, 9.5]) for (const z of [4.2, 12.5]) pendant(x, z, 4.9);
  if (!expanded) {
    plant(-5.7, 4); plant(5.7, 4); plant(-12.9, 15.8, 1.3); plant(12.9, 15.8, 1.3);
    for (const placement of seatPlacements.filter(item=>item.group==='atrium')) bench(placement);
  } else {
    // Low planting preserves views while leaving the seasonal/event block clear.
    const garden=atriumLayout.garden;
    box('ivory',garden.x,garden.height/2,garden.z,garden.width,garden.height,garden.depth,true);
    box('wood',garden.x,garden.height+.012,garden.z,garden.width-.18,.025,garden.depth-.18);
    for (let i=0;i<13;i++) {
      const x=garden.x-3.45+i*.575, z=garden.z+(i%3-1)*.65;
      sphere('foliage',x,.57,z,.28,.14,.23);
      for (let leaf=0;leaf<8;leaf++) {
        const angle=leaf*Math.PI*2/8+(i%3)*.2;
        solid('sphere',leaf%2?'leaf':'foliage',x+Math.sin(angle)*.2,.72,z+Math.cos(angle)*.2,
          .1,i%4===0?.38:.3,.065,angle,.72,'YXZ');
      }
    }
    for (const lounge of atriumLayout.lounges) {
      // Flush stone inset; it creates a room within the open floor without a trip edge.
      box('rugSand',lounge.x,.01,lounge.z,5.8,.012,7.8);
      for (const side of [-1,1]) {
        box('oak',lounge.x+side*2.84,.019,lounge.z,.035,.008,7.62);
        box('oak',lounge.x,.019,lounge.z+side*3.74,5.7,.008,.035);
      }
      for (const placement of seatPlacements.filter(item=>item.group==='atrium' && item.name.startsWith(lounge.id === 'west' ? 'West' : 'East'))) bench(placement);
      const table=lounge.table;
      // A compact side table fits between the two sofas without blocking either exit.
      cylinder('brass',table.x,.27,table.z,.055,.5);
      cylinder('oak',table.x,.53,table.z,.29,.06);
      cylinder('brass',table.x,.04,table.z,.2,.05);
      collider(table.x,.28,table.z,.58,.56,.58);shadow(table.x,table.z,1,1);
      for (const planter of lounge.planters) {
        box('pot',planter.x,.3,planter.z,.7,.6,.7,true);
        box('wood',planter.x,.61,planter.z,.6,.025,.6);
        for (let i=0;i<9;i++) {
          const a=i*Math.PI*2/9;
          solid('sphere',i%2?'leaf':'foliage',planter.x+Math.sin(a)*.12,.8,planter.z+Math.cos(a)*.12,.08,.27,.05,a,.72,'YXZ');
        }
        lightPool(planter.x,.024,planter.z,2.2,2.2);
      }
      // Shared, non-colliding ceiling lighting keeps each lounge legible at a distance.
      for (const z of [22,26]) {
        box('glow',lounge.x,8.34,z,4,.035,.065);
        lightPool(lounge.x,.025,z,5,4);
      }
    }
  }
  // Remove the old focal point and its matching collider from the expanded loop.
  if (!expanded) {
  // Low water court, not a wall blocking the whole concourse.
  if (!furnishings.place('plinth', 0, 7.5)) {
    cylinder('brass', 0, .12, 7.5, 2.25, .22); cylinder('ivory', 0, .38, 7.5, 2.04, .48);
    cylinder('wood', 0, .245, 7.5, 2.075, .045); cylinder('brass', 0, .58, 7.5, 2.055, .045);
    cylinder('water', 0, .63, 7.5, 1.88, .045);
  }
  cylinder('brass', 0, .69, 7.5, .36, .08); cylinder('ivory', 0, .83, 7.5, .23, .24);
  cylinder('brass', 0, 1.01, 7.5, .065, .26);
  solid('torus', 'brass', 0, 1.84, 7.5, .78, .9, 1);
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
  }
  // Three 12cm steps provide a real auto-step path to a quiet seating terrace.
  if (!expanded) {
    for (let i = 0; i < 3; i++) box('ivory', -11, .06 * (i + 1), 11.8 + i * .4, 3.1, .12 * (i + 1), .42, true);
    box('ivory', -11, .18, 14, 3.1, .36, 2.8, true);
  }
  const doors = [], interactables = [];
  if (expanded) {
    interactables.push(addFeatureKiosk({x:10,z:20,box,cylinder,sign}));
    collider(10,.5,20,1.8,1,1.4);
    lightPool(10,.054,20,4,4);
  }
  let createCollectProp = () => null, reserveProduct = () => null, staticProductCount=0;
  let worldProductAssets = Object.freeze({status: 'not-loaded'}), shelves = [];
  // Original decorative kiosk beside the entrance, outside the central walking line.
  // The actual wayfinding interaction opens the existing three-store DOM map.
  // The old kiosk artwork depicts the old three-room floorplan. Use a neutral
  // screen in the expanded shell; its existing interaction opens the live map.
  const directory=expanded?liftLayout.directory:{x:-5.3,z:10.4};
  if (expanded || !furnishings.place('kiosk', directory.x, directory.z, 1, -1)) {
    box('jade',directory.x,1.22,directory.z,.94,1.6,.22);
    box('brass',directory.x,.08,directory.z,.96,.16,.68);
    box('dark',directory.x,1.3,directory.z+.13,.78,1.25,.035);
    if(expanded)sign('DIRECTORY',directory.x,1.55,directory.z+.16,.7,.16,false,90);
  }
  collider(directory.x,1.025,directory.z,.96,2.05,.68);
  shadow(directory.x,directory.z,1.2,.9);
  interactables.push({id:'mall-directory',...directory,radius:2.8});
  for (const store of spatial.stores) {
    const zone = store.id, x = storeCenterX(store);
    const wall = zone === 'mili' ? 'cream' : 'green';
    for (let i = 0; i < 18; i++) box(i % 3 ? 'timber' : 'timberAlt', x - 4.25 + i * .5, -.005, -5, .49, .04, 10);
    box(zone === 'newmoon' ? 'newMoonRed' : wall, x, 2.85, -10.5, 10, 5.7, .25, true);
    for (const side of [-1, 1]) {
      box(wall, x + side * 4.8, 2.85, -5.25, .22, 5.7, 10.5, true);
      if (expanded) {
        // Glazing is physically solid but visually transparent: shoppers can
        // see the real existing interior without blocking the 4.7 m doorway.
        const frame=zone==='mili'?'oak':zone==='gogo'?'jadeAlt':'green';
        box('glass', x + side * 3.55, 2.6, 0, 2.4, 5.2, .12, true);
        box('shellWall', x + side * 3.55, .26, .1, 2.4, .52, .2);
        for (const edge of [-1, 1]) {
          box(frame, x + side * 3.55 + edge * 1.15, 2.65, .1, .11, 5.05, .18);
          box('brass', x + side * 3.55, 2.6 + edge * 2.49, .12, 2.3, .06, .16);
        }
        box('brass', x + side * 3.55, 2.58, .12, 2.3, .035, .12);
      } else {
        // Keep the original facade and collision in the reversible legacy view.
        for (const face of [-1, 1]) {
          box('glass', x + side * 3.6, 2.08, face * .23, 2.12, 3.5, .055);
          for (const edge of [-1, 1]) {
            box('brass', x + side * 3.6 + edge * 1.1, 2.08, face * .28, .035, 3.57, .045);
            box('brass', x + side * 3.6, 2.08 + edge * 1.785, face * .28, 2.23, .035, .045);
          }
        }
      }
      box('brass', x + side * 2.36, 1.9, .22, .065, 3.8, .08);
      box('glow', x + side * 3.6, 3.67, .28, 2.12, .035, .04);
      lightPool(x + side * 3.6, .053, 1.15, 3.4, 3.7);
    }
    if (expanded) {
      box(zone === 'newmoon' ? 'newMoonRed' : 'dark', x, 4.7, 0, 9.7, 1.55, .5, true); box('brass', x, 5.45, .3, 9.8, .045, .08);
    }
    activeShopSlot=expanded?Number(store.number):null;
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
          if (!furnishings.place('wallLight', x + side * 4.57, z, 1, 1, 2.52, -side * Math.PI / 2, activeShopSlot)) {
            box('brass', x + side * 4.57, 3.02, z, .09, .94, .25);
            box('glow', x + side * 4.49, 3.02, z, .075, .67, .16);
          }
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
    if (zone === 'newmoon' && expanded) {
      // The fascia is part of the distant facade, not the near-interior LOD.
      activeShopSlot = null;
      art(logo, x, 4.72, .31, 5.2);
      box('glow', x, 5.36, .31, 5.4, .025, .045);
      activeShopSlot = Number(store.number);
    } else {
      if (!furnishings.place('storeSign', x, .28, 1, 1, 4.065, null, activeShopSlot)) {
        box('brass', x, 4.67, .3, 2.52, 1.21, .09); box('cream', x, 4.67, .36, 2.42, 1.11, .05);
      }
      art(logo, x, 4.67, .4, 2.2);
      box('glow', x, 5.36, .36, 2.42, .025, .045);
    }
    box('brass', x, 4.02, .29, 9.3, .025, .04);
    const label = sign(`${store.number}  /  ${store.label.toUpperCase()}`, x, 3.5, .38, 3.9, .48, true, 80);
    roomSigns.push({zone, mesh: label, left: 0, right: 0, top: 0, bottom: 0});
    // Two independently kinematic glass leaves slide clear of the walking capsule.
    const leaves = [];
    for (const side of [-1, 1]) {
      const group = new T.Group(); group.position.set(x + side * 1.16, 1.8, .05); scene.add(group);
      const glass = new T.Mesh(geometry.box, materials.glass); glass.scale.set(2.25, 3.5, .06); group.add(glass);
      group.add(new T.Mesh(doorFrameGeometry, materials.brass));
      const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(group.position.x, 1.8, .05));
      physics.createCollider(R.ColliderDesc.cuboid(1.125, 1.75, .03), body); leaves.push({group, body, side});
    }
    const door={zone, x, open:0, targetOpen:false, leaves, toggle(){this.targetOpen=!this.targetOpen;return this.targetOpen;}};
    doors.push(door);
    if(expanded)interactables.push({id:`${zone}-door`,kind:'open',x,z:0,y:0,floor:0,radius:2.5,door});
    pendant(x, -4, 4.2); pendant(x, -8, 4.2);
    const light = new T.PointLight(zone === 'gogo' ? 0xcce9c2 : 0xffdfa9, 45, 15, 2); light.position.set(x, 4.5, -6); scene.add(light);
    box('brass', x, .22, -10.32, 9.3, .045, .04);
    if (zone === 'newmoon') {
      // The asset display owns its geometry and collision bounds; no legacy rack remains.
      for (const dx of [-4.3, -2.15, 0, 2.15, 4.3]) box('brass', x + dx, 3.55, -10.35, .035, 2.8, .025);
      lightPool(x, .054, -8.6, 7.5, 2.1);
      const cover = art('new-moon-brand-cover.jpg', x - 4.64, 2.8, -5.8, 3.6, Math.PI / 2);
      box('brass', x - 4.665, 2.8, -5.8, .035, cover.scale.y + .14, 3.74);
      box('oak', x - 4.67, 2.8, -5.8, .04, cover.scale.y + .28, 3.88);
      box('newMoonRed', x + 2.8, .55, -4, 2.1, 1.1, 1.25, true); box('cream', x + 2.8, 1.15, -4, 2.2, .12, 1.4);
      for (let i = 0; i < 9; i++) box('brass', x + 1.9 + i * .22, .56, -3.35, .025, 1, .025);
      box('brass', x + 2.8, 1.08, -3.285, 2.17, .045, .03);
      box('brass', x + 2.8, .09, -3.36, 2.1, .08, .03);
      cylinder('pot', x + 3.48, 1.38, -4, .15, .32); cylinder('brass', x + 3.48, 1.545, -4, .155, .025);
      sphere('leaf', x + 3.48, 1.72, -4, .22, .3, .19);
      const {addProducts} = await import('./products.js');
      const displayProducts=showcaseProducts(SHOWCASE_PRODUCTS,expanded);
      const productDisplay = await addProducts(T, scene, textures, materials.brass,displayProducts,[],expanded?[-10,0,-1.25]:null);
      shopLodUpdates.push(productDisplay.updateShopLods);
      interactables.push(...productDisplay.interactables);
      for (const c of productDisplay.colliders) collider(c.x, c.y, c.z, c.sx, c.sy, c.sz);
      for (const [index, country] of ['NEW ZEALAND', 'AUSTRALIA', 'SOUTH AFRICA', 'MEXICO'].entries()) {
        sign(country, productDisplay.shelfPositions[index], 2.04, -9.22, 1.65, .16, true);
      }
      staticProductCount=productDisplay.displayedProducts;worldProductAssets = productDisplay.assets; shelves = productDisplay.shelves; createCollectProp = productDisplay.createCollectProp; reserveProduct = productDisplay.reserveProduct;
      plant(x - 3.6, -2.3);
    } else {
      const cover = `${zone}-brand-cover.jpg`;
      box('brass', x, 2.85, -10.3, 3.65, 3.65, .08); art(cover, x, 2.85, -10.24, 3.48);
      box('oak', x, 2.85, -10.35, 3.88, 3.88, .055);
      box('oak', x, .92, -10.09, 4, .075, .28);
      box('glow', x, 4.77, -10.16, 3.7, .025, .07);
      interactables.push({id: zone, x, z: -9, radius: 2.5});
      // Store seating faces the natural route from the entrance, not the rear wall.
      for (const placement of seatPlacements.filter(item=>item.group===zone)) bench(placement);
      if (!furnishings.place('coffeeTable', x, -5.5, 1, 1, 0, null, activeShopSlot)) {
        cylinder('brass', x, .4, -5.5, .08, .75); cylinder('oak', x, .8, -5.5, .8, .1);
        cylinder('brass', x, .853, -5.5, .805, .025);
      }
      collider(x, .4375, -5.5, 1.61, .875, 1.61);
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
      if(zone==='mili') {
        // Generic pack forms avoid inventing package artwork or exact dimensions.
        cylinder('green',x,.25,-1.35,.075,.34);cylinder('oak',x,.45,-1.35,.038,.09);cylinder('brass',x,.505,-1.35,.04,.025);
      } else if(zone==='gogo') {
        cylinder('cream',x-.11,.07,-1.35,.034,.14);cylinder('brass',x-.11,.144,-1.35,.035,.012);
        box('ivory',x+.12,.08,-1.35,.055,.16,.045);box('oak',x+.12,.08,-1.325,.035,.11,.006);
      }
    }
    activeShopSlot=null;
    }
  if (expanded) {
    // Planned bays remain physically closed; their glazing reveals the displays.
    for (const bay of expandedLayout.slots.filter(item => !item.available)) {
      const x=(bay.minX+bay.maxX)/2, z=(bay.minZ+bay.maxZ)/2;
      box('ivory', x, .018, z, bay.maxX-bay.minX-.12, .025, bay.maxZ-bay.minZ-.12);
      if (bay.side === 'north') {
        collider(x, 2.6, 0, 9.9, 5.2, .25);
        for (const edge of [bay.minX,bay.maxX]) box('ivory', edge, 2.8, -6, .2, 5.6, 12, true);
      } else {
        const front=bay.side === 'west' ? bay.maxX : bay.minX;
        collider(front, 2.6, z, .25, 5.2, 7.9);
        for (const edge of [bay.minZ,bay.maxZ]) box('ivory', x, 2.8, edge, 10, 5.6, .2, true);
      }
    }
    // The closed glass entrance provides a visible boundary to the ground floor.
    for (const x of [-25,45]) box('ivory',x,3.3,18,.3,6.6,60,true);
    box('ivory',10,3.3,-12,70,6.6,.3,true);
    for (const x of [-10.5,30.5]) box('ivory',x,3.3,48,29,6.6,.3,true);
    box('glass',10,2.8,48,12,5.6,.3,true);
    for (const x of [4,10,16]) box('brass',x,2.8,47.8,.08,5.6,.08);
    // Four roof panels leave the 12 x 12 m upper landing open to the sky.
    ceilingBox('shellCeiling',10,8.5,18,70,.25,60,liftLayout.roofOpening);
    // Recessed strips share the retained roof footprint, including its camera opening.
    // Reuse existing emissive/pool batches; no new lights or visitor colliders.
    function warmStrip(x,z,width,depth){
      const panels=ceilingBox('glow',x,8.34,z,width,.035,depth,liftLayout.roofOpening);
      for(const r of panels)lightPool((r.minX+r.maxX)/2,.052,(r.minZ+r.maxZ)/2,
        width>depth?r.maxX-r.minX:4.5,width>depth?4.5:r.maxZ-r.minZ);
    }
    for(const x of [-12,32])for(const z of [10,22,34])warmStrip(x,z,.07,6);
    for(const x of [-5,10,25])warmStrip(x,3,6,.07);
    // Cove strips and suspended rings reuse emissive instances, not dynamic lights.
    for(const x of [-9,29]) warmStrip(x,20,.09,27);
    for(const z of [6.5,33.5]) warmStrip(10,z,38,.09);
    for(const radius of [2.2,3.2]) solid('torus','glow',10,8.05,20,radius,radius,.8,0,-Math.PI/2);
    lightPool(10,.053,20,8,8);

    // This is a closed reservation, not an operating facility.
    box('ivory',25,1.5,10,6,3,4,true);
    const facility=sign('FUTURE FACILITIES',28.07,2,10,2.5,.35,true,60);facility.rotation.y=Math.PI/2;
    for (const x of [-12,32]) box('brass',x,.024,21,.035,.008,36);
    for (const z of [3,39]) box('brass',10,.024,z,44,.008,.035);
    // One neutral, framed backdrop anchors the upper gallery. Its plaque atlas loads
    // only when a visitor reaches this floor.
    activeDeck=true;
    box('green',-3,liftLayout.upper+2.1,14.48,9.4,4.2,.16,true);
    box('brass',-3,liftLayout.upper+4.12,14.36,9.55,.055,.045);
    box('brass',-3,liftLayout.upper+.08,14.36,9.55,.055,.045);
    for(const x of [-7.72,1.72]){
      box('brass',x,liftLayout.upper+2.1,14.36,.055,4.05,.045);
      box('glow',x+(x<0?.04:-.04),liftLayout.upper+2.1,14.32,.035,3.7,.025);
    }
    box('glow',-3,liftLayout.upper+4.02,14.32,8.9,.035,.025);
    lightPool(-3,liftLayout.upper+.035,13.35,8.8,2.8);
    activeDeck=false;
    // Warm timber seating and areca planters form a central lounge without
    // narrowing the approach to the plaque wall or the lift.
    activeDeck=true;
    const deckBench=placement=>{
      const {x,z,facing}=placement;
      if(!furnishings.place('bench',x,z,.8,facing,liftLayout.upper,null,-1)){
        box('wood',x,liftLayout.upper+.24,z,2.3,.32,.72);
        box('seat',x,liftLayout.upper+.49,z,2.34,.18,.76);
        box('seat',x,liftLayout.upper+.82,z+facing*.28,2.34,.54,.16);
        box('brass',x,liftLayout.upper+.44,z-facing*.38,2.32,.025,.025);
      }
      // Leave capsule clearance between each bench and the adjacent planter.
      const seatCollider=collider(x,liftLayout.upper+.26,z,placement.clearance.colliderWidth,.5,placement.clearance.colliderDepth);
      if(placement.accessible!==false)seats.push(createSeatAnchor(placement,seatCollider.handle));
    };
    for(const placement of seatPlacements.filter(item=>item.group==='deck'))deckBench(placement);
    for(const [x,z] of [[-8.1,12.8],[2.1,12.8],[-8.1,9.2],[2.1,9.2]]){
      if(!furnishings.place('planter',x,z,.68,1,liftLayout.upper,null,-1)){
        box('pot',x,liftLayout.upper+.24,z,.68,.48,.68,true);
        box('wood',x,liftLayout.upper+.49,z,.58,.025,.58);
        for(let i=0;i<4;i++)solid('sphere',i%2?'leaf':'foliage',x+(i%2?-.14:.14),liftLayout.upper+.78,z+(i<2?-.14:.14),.19,.36,.19);
      }
      collider(x,liftLayout.upper+.25,z,.68,.5,.68);
    }
    for(const x of [-8,-6,-4,-2])deckRailings.place('bay',x,16);
    for(const x of [-.5,.5,1.5,2.5])deckRailings.place('bay1m',x,16);
    for(const z of [5,7,9,11]){
      deckRailings.place('bay',-9,z,Math.PI/2);
      deckRailings.place('bay',3,z,Math.PI/2);
    }
    for(const z of [12.5,13.5,14.5,15.5]){
      deckRailings.place('bay1m',-9,z,Math.PI/2);
      deckRailings.place('bay1m',3,z,Math.PI/2);
    }
    for(const [x,z] of [[-9,4],[3,4],[-9,16],[3,16]])deckRailings.place('post',x,z);
    railingState=deckRailings?.finish(scene)||null;
    activeDeck=false;
    addExpandedStorefronts(T,expandedLayout,scene);
    const shopSigns=await addShopSignAtlas(T,expandedLayout,scene);
    shopSigns.layers.enable(1);
    const interiors=await createExpandedInteriors(T,expandedLayout,scene);
    shopLodUpdates.push(interiors.update);
  }
  const amenities=await addAmenities(T,scene,collider,createCollectProp,true,staticProductCount,expanded);
  interactables.push(...amenities.interactables);
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.transforms.length);
    batch.transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = false; mesh.receiveShadow = batch.material !== materials.lightPool; mesh.computeBoundingSphere(); mesh.userData.shopSlot=batch.shopSlot;mesh.userData.deckLod=batch.deckLod;
    if(batch.material===materials.glow)mesh.layers.enable(1);
    scene.add(mesh);
    if(batch.shopSlot!==null)shopLodMeshes.push(mesh);
  }
  const ambient = new T.HemisphereLight(expanded ? 0xe5eef0 : 0xffeee0, expanded ? 0x665e50 : 0x6d5b3b, expanded ? .72 : 1.05);scene.add(ambient);
  const key = new T.DirectionalLight(expanded ? 0xffe0bc : 0xffd5a0, expanded ? 2.6 : 2.1); key.position.set(...(expanded ? [-12, 16, 6] : [-8, 15, 9])); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left: -20, right: 20, top: 20, bottom: -20, near: .5, far: 50}); key.shadow.normalBias = .05; key.shadow.bias = -.0004; scene.add(key);
  const fill = new T.DirectionalLight(expanded ? 0xcbdde5 : 0xe9d8c2, expanded ? .4 : .45); fill.position.set(4, 8, -5); scene.add(fill);
  const applyMallTheme = theme => applyMallThemeToWorld(theme, {expanded, materials, ambient, key, fill});
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
      mesh.visible = !overlaps && (mesh.userData.shopSlot===undefined || mesh.userData.shopLodNear);
    }
  }
  let deckLodMeshes=null;
  function updateShopLods(visitor) {
    if(!expanded)return;
    const deckVisible=Math.abs(visitor.y-liftLayout.upper)<3,shopDistance=12;
    for(const mesh of shopLodMeshes){
      const bay=shopBays.get(mesh.userData.shopSlot);
      if(!bay)continue;
      const x=(bay.minX+bay.maxX)/2,z=(bay.minZ+bay.maxZ)/2;
      mesh.userData.shopLodNear=Math.hypot(visitor.x-x,visitor.z-z)<shopDistance;
      mesh.visible=mesh.userData.shopLodNear;
    }
    if(!deckLodMeshes){deckLodMeshes=[];scene.traverse(mesh=>{if(mesh.userData.deckLod)deckLodMeshes.push(mesh);});}
    for(const mesh of deckLodMeshes)mesh.visible=deckVisible;
    for(const update of shopLodUpdates)update(visitor);
  }
  interactables.push(...seats.map(seat=>({id:seat.id,kind:'sit',x:seat.exitX,y:seat.floor,z:seat.exitZ,floor:seat.floor,radius:seat.clearance.interactionRadius,seat})));
  const furnishingState=furnishings.finish(scene,mesh=>shopLodMeshes.push(mesh));
  const benchSize=furnishingState.bench.dimensions,seatScale=new URLSearchParams(location.search).get('visitor')!=='v1'?.8:1;
  // The seating collider intentionally covers only the seat pan. Camera bounds
  // also cover the authored back and arms without blocking sit/stand routes.
  const cameraObstacles=ceilingObstacles.concat(seats.filter(seat=>seat.floor===0).map(seat=>({min:{x:seat.x-benchSize[0]/2,y:0,z:seat.z+.23*seat.facing-benchSize[2]/2},max:{x:seat.x+benchSize[0]/2,y:benchSize[1]*seatScale,z:seat.z+.23*seat.facing+benchSize[2]/2}})));
  let brandWallPromise=null;
  function ensureBrandWall(){
    if(!expanded)return Promise.reject(new Error('Brand wall is only available in the expanded mall'));
    if(!brandWallPromise)brandWallPromise=import('./brand-wall.js').then(({addBrandWallAtlas})=>addBrandWallAtlas(T,scene,liftLayout.upper)).then(result=>{
      interactables.push(...result.interactables);
      return result;
    });
    return brandWallPromise;
  }
  return {scene, doors, seats, shell: shellState, cameraObstacles, amenities:amenities.state, interactables, shelves, createCollectProp, reserveProduct, contact, plane, roomSigns, updateSigns, updateShopLods, applyMallTheme, ensureBrandWall, furnishings: furnishingState, deckRailings:railingState, productAssets: Object.freeze(worldProductAssets)};
  } finally {
    releaseStartupAssetPack();
  }
}
