import {mallAudio} from './audio.js';
import {instancedSurfaceMaterial} from './opaque-batch.js';
import {registerPhysicsProps} from './physics-props.js';
import {addTramDebug} from './tram-layout.js';
import {buildRestrooms} from './restrooms.js';
import {miliExhibit} from './mili-exhibit.js';
import {gogoExhibit} from './gogo-exhibit.js';
import {borschExhibit} from './borsch-exhibit.js';
import {pzhExhibit} from './pzh-exhibit.js';
import {shopCatalogueExhibits, shopCatalogueFocals} from './shop-catalogue-exhibits.js';
import {createDoorwayOccupancy} from './doorway-occupancy.js';
import {createGlassBatch, createInstanceVisibility, createPackedDraw, createProjectedBatch} from './packed-draw.js';
import {filterWallArtwork, setupArtworkTexture} from './artwork-textures.js';
import {heritagePanel, newMoonExhibit} from './new-moon-exhibit.js';
import {decalClearance, decalHeight, decalMaterial, placeDecal} from './surface-decals.js';
import {createShopVisibility} from './shop-visibility.js';
import {buildPublicArchitecture} from './public-architecture.js';
import {addOriginalShopDetails} from './shop-anchor-details-first.js';
import {addAmenities,SHOWCASE_PRODUCTS} from './amenities.js';
import {brandRail} from './upper-layout.js';
import {buildUpperLevel, loadUpperFurniture, deckPlanters} from './upper-level.js';
import {createInteriorAdditions} from './interior-additions.js';
import {createFurnishings} from './furnishings.js';
import {createShell} from './shell.js';
import {SHELL_LAYOUT} from './interior-shell-registry.js';
import {spatial, storeCenterX} from './spatial.js';
import {expandedLayout, shopEntrance} from './expanded-layout.js';
import {atriumLayout} from './atrium-layout.js';
import {addShopSignAtlas} from './shop-signs.js';
import {addExpandedStorefronts} from './expanded-storefronts.js';
import {createExpandedInteriors} from './expanded-interiors.js';
import {pzhCartonX, pzhCartonStandingZ} from './window-studios.js';
import {createInteriorKit} from './interiors/runtime.js';
import {interiorFloorColour,interiorStores,worldInteriorBox,worldInteriorPoint} from './interiors/config.js';
import {liftLayout,cutRectangle,showcaseProducts} from './lift-layout.js';
import {benchScale, createSeatPlacements, createSeatAnchor, deckBenchFallback, groundBenchFallback} from './seat-placements.js';
import {gogoStoolSeat} from './interiors/gogo-seats.js';
import {createProceduralSeat} from './interiors/procedural-seats.js';
import {createGigasetBacklessSeat,createGigasetLoungeSeat} from './gallery-east-shops.js';
import {addFeatureKiosk} from './feature-kiosk.js';
import {createMallSurfaceAtmosphere, shopLampTint} from './mall-atmosphere.js';
import {createMallBakedLighting, createSkylightDapple} from './mall-baked-lighting.js';
import {EVERYDAY} from './mall-themes.js';
import {createPlayerShadow} from './mall-player-shadow.js';

function addAtriumSkylight(T, scene, {minX,maxX,minZ,maxZ}) {
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const sky = ctx.createLinearGradient(0,0,size,size);
  sky.addColorStop(0,'#85bde1');
  sky.addColorStop(.54,'#c5e7fa');
  sky.addColorStop(1,'#f5f9f6');
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,size,size);

  // Keep the same canopy across reloads. Overlapping leaf clusters and tapered
  // branches frame the clear panes instead of repeating at every roof rib.
  let seed = 271;
  const random = () => ((seed = Math.imul(1664525,seed) + 1013904223 | 0) >>> 0) / 4294967296;
  const leaves = ['#536047','#667559','#899770','#a6a683'];
  function bough(x,y,length,angle,depth) {
    const tipX = x + Math.cos(angle)*length, tipY = y + Math.sin(angle)*length;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(tipX,tipY);
    ctx.strokeStyle = '#5e614d';
    ctx.lineWidth = depth*1.25;
    ctx.lineCap = 'round';
    ctx.stroke();
    if (depth > 1) {
      for (const turn of [-.62,.58]) bough(tipX,tipY,length*(.55+random()*.21),angle+turn,depth-1);
      return;
    }
    for (let i=0;i<25;i++) {
      ctx.beginPath();
      ctx.ellipse(tipX+(random()-.5)*34,tipY+(random()-.5)*24,2+random()*5,1+random()*3,angle,0,Math.PI*2);
      ctx.fillStyle = leaves[i%leaves.length];
      ctx.fill();
    }
  }
  bough(-8,200,53,-.91,4);
  bough(261,52,46,2.4,4);
  bough(165,259,50,-2.11,4);
  bough(80,-7,38,1.18,3);
  const sheen = ctx.createLinearGradient(0,size,size,0);
  sheen.addColorStop(0,'rgba(255,249,230,0)');
  sheen.addColorStop(.53,'rgba(255,253,244,.30)');
  sheen.addColorStop(.83,'rgba(255,249,230,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0,0,size,size);

  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  // Follow the barrel's ribs and offset outward so its real mullions always
  // win the depth test. The inward-facing sheet draws as a single opaque mesh.
  const geometry = new T.PlaneGeometry(1,1,24,1), positions = geometry.attributes.position;
  for (let i=0;i<positions.count;i++) {
    const angle = positions.getX(i)*Math.PI;
    positions.setXYZ(i,(minX+maxX)/2+13.21*Math.sin(angle),13.1+3.99*Math.cos(angle),
      (minZ+maxZ)/2+positions.getY(i)*(maxZ-minZ+.14));
  }
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry,new T.MeshBasicMaterial({map,toneMapped:false}));
  mesh.name = 'Atrium daylight glazing';
  scene.add(mesh);
}

export function applyMallThemeToWorld(theme, {expanded, materials, ambient, key, fog}) {
  if (!expanded || !theme?.materials || !theme?.lighting) return false;
  const m=theme.materials,l=theme.lighting;
  const colors=['floorTextured','floorFlat','ceiling','ceilingGlow','wall','green','ivory','brass','wood','oak','timber','timberAlt','glass','glow','glowEmission'];
  const lightColors=['sky','ground','key','fog'];
  const scalars=['ceilingGlowIntensity','glassOpacity','glassRoughness','glassMetalness','glowIntensity'];
  if(colors.some(k=>!Number.isInteger(m[k])||m[k]<0||m[k]>0xffffff)||lightColors.some(k=>!Number.isInteger(l[k])||l[k]<0||l[k]>0xffffff)||
     scalars.some(k=>!Number.isFinite(m[k])||m[k]<0||m[k]>3)||['ambient','keyIntensity'].some(k=>!Number.isFinite(l[k])||l[k]<0||l[k]>5)||
     !Number.isFinite(l.exposure)||l.exposure<.5||l.exposure>1.25||
     ['glassOpacity','glassRoughness','glassMetalness'].some(k=>m[k]>1)) return false;
  materials.shellFloor.color.set(materials.shellFloor.map?m.floorTextured:m.floorFlat);
  materials.shellCeiling.color.set(m.ceiling);materials.shellCeiling.emissive.set(m.ceilingGlow);materials.shellCeiling.emissiveIntensity=m.ceilingGlowIntensity;
  materials.shellWall.color.set(m.wall);
  for(const role of ['green','ivory','brass','wood','oak','timber','timberAlt']) materials[role].color.set(m[role]);
  materials.glass.color.set(m.glass);materials.glass.opacity=m.glassOpacity;materials.glass.roughness=m.glassRoughness;materials.glass.metalness=m.glassMetalness;
  materials.glow.color.set(m.glow);materials.glow.emissive.set(m.glowEmission);materials.glow.emissiveIntensity=m.glowIntensity;
  ambient.color.set(l.sky);ambient.groundColor.set(l.ground);ambient.intensity=l.ambient;key.color.set(l.key);key.intensity=l.keyIntensity;
  fog?.color.set(l.fog);
  return true;
}

// Continuous, metre-scale architecture. All repeated architectural solids are instanced.
export async function createWorld(T, R, physics, expanded = false, warmModel, artworkTier = () => 'low', phone = false, detailsEnabled = () => true, waitForSlice, registerShopSeat) {
  let shellState = null;
  const expandedLift=expanded&&new URLSearchParams(location.search).get('visitor')!=='v1';
  // Local textures share the HTML packshots' request mode, avoiding duplicate image loads.
  const textures = new Map(), loader = new T.TextureLoader().setCrossOrigin(undefined);
  const names = ['new-moon-logo.svg', 'mili-logo.jpg', 'gogo-logo.jpg', 'new-moon-brand-cover.jpg', 'mili-brand-cover.jpg', 'gogo-brand-cover.jpg', ...['nz-425g', 'au-425g', 'sa-425g', 'mx-454g'].map(id => `new-moon-${id}-front.jpg`)];
  const texturesTask = Promise.all(names.map(async name => {
    let texture;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = new URL(name.replace(/(?:-brand-cover|-front)\.jpg$/, match => match.replace('.jpg','.webp')), import.meta.url);
        if (attempt) url.searchParams.set('retry', String(attempt));
        texture = await loader.loadAsync(url.href);
        break;
      } catch (error) {
        if (attempt === 2) throw new Error(`Mall texture failed to load: ${name}`, {cause: error});
        await new Promise(resolve => setTimeout(resolve, attempt ? 800 : 200));
      }
    }
    textures.set(name, setupArtworkTexture(T,texture,artworkTier()));
  }));
  const productsTask = import('./products.js');
  void productsTask.catch(() => {});
  const furnishingTask = createFurnishings(T,true,expanded,detailsEnabled);
  const shellTask = expanded ? null : createShell(T);
  const ceilingObstacles=[], shopObstacles=[];
  const bakedFloors=[], bakedCeilings=[];
  function ceilingBounds(x,y,z,sx,sy,sz){
    ceilingObstacles.push({min:{x:x-sx/2,y:y-sy/2,z:z-sz/2},max:{x:x+sx/2,y:y+sy/2,z:z+sz/2}});
  }
  function ceilingBox(material,x,y,z,sx,sy,sz,hole=liftLayout.shaft){
    const bounds={minX:x-sx/2,maxX:x+sx/2,minZ:z-sz/2,maxZ:z+sz/2};
    const panels=expandedLift && hole ? cutRectangle(bounds,hole) : [bounds];
    for(const r of panels){
      const panel=[(r.minX+r.maxX)/2,y,(r.minZ+r.maxZ)/2,r.maxX-r.minX,sy,r.maxZ-r.minZ];
      box(material,...panel);
      ceilingBounds(...panel);
    }
    if (expanded && (material === 'shellCeiling' || material === 'cream')) {
      for (const rect of panels) bakedCeilings.push({...rect, y:y-sy/2-.003});
    }
    return panels;
  }
  const seats=[], seatPlacements=createSeatPlacements(expanded);
  const seatInteraction = seat => ({id:seat.id,kind:'sit',x:seat.exitX,y:seat.floor,z:seat.exitZ,
    floor:seat.floor,radius:seat.clearance.interactionRadius,seat});
  const scene = new T.Scene();
  const prepareModel = warmModel && ((model, options) => warmModel(model, scene, options));
  scene.background = new T.Color(expanded ? 0x819b9b : 0x192e32);
  scene.fog = new T.Fog(expanded ? EVERYDAY.lighting.fog : 0xb7ad9c, expanded ? 75 : 40, expanded ? 155 : 100);
  const ambient = new T.HemisphereLight(0xffeee0,0x6d5b3b,1.05);
  const key = new T.DirectionalLight(0xffd5a0,expanded ? EVERYDAY.lighting.keyIntensity : 2.1);
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .72, ...extra});
  const materials = {
    jade: mat(0x21483e, {roughness: .24, metalness: .22}), jadeAlt: mat(0x244c42, {roughness: .28, metalness: .18}),
    courtStone: mat(0x49665b, {roughness: .32, metalness: .16}),
    shellFloor: mat(0xc9c2ac, {roughness: .9}), shellCeiling: mat(0xe7ddc8, {emissive: 0x9d8c70, emissiveIntensity: .35}),
    shellWall: mat(0xb7b6a9, {roughness: .82}),
    rugSand: mat(0x8c8063, {roughness: 1}), rugSage: mat(0x5b6d58, {roughness: 1}),
    green: mat(0x153c30), dark: mat(0x0c2923), ivory: mat(0xe3d6b7), cream: mat(0xf5e8cb),
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
      if(natural.stone) materials.shellFloor.map=natural.stone;
      if(natural.wood)for(const name of ['wood','oak','timber','timberAlt'])materials[name].map=natural.wood;
    }catch{/* Retain usable solid finishes on module/canvas failure. */}
    finally{clearTimeout(timer);}
    applyMallThemeToWorld(EVERYDAY, {expanded, materials, ambient, key, fog:scene.fog});
    materials.shellFloor.roughness = .34;
    materials.brass.roughness = .28;
    materials.brass.metalness = .78;
    materials.green.roughness = .24;
    materials.green.metalness = .23;
    materials.dark.roughness = .30;
    materials.dark.metalness = .12;
  }
  const geometry = {
    box: new T.BoxGeometry(1, 1, 1), cylinder: new T.CylinderGeometry(1, 1, 1, 32), sphere: new T.SphereGeometry(1, 12, 8),
    plane: new T.PlaneGeometry(1, 1), torus: new T.TorusGeometry(1, .045, 8, 64), ring: new T.RingGeometry(.985, 1, 64)
  };
  const storefrontGlassMaterial = expanded ? materials.glass.clone() : materials.glass;
  if (expanded) storefrontGlassMaterial.forceSinglePass = true;
  const doorGlassMaterial = expanded ? new T.MeshBasicMaterial({
    color:materials.glass.color, opacity:materials.glass.opacity*.76, transparent:true, depthWrite:false
  }) : materials.glass;
  materials.skylightGlass = materials.glass.clone();
  materials.skylightGlass.side = T.FrontSide;
  const framedDoorTrim = [
    {offset:[-1.12,0,0],size:[.035,3.5,.065]},
    {offset:[1.12,0,0],size:[.035,3.5,.065]},
    {offset:[0,-1.73,0],size:[2.25,.035,.065]}
  ];
  // Adapt the editable frameless module's panes, channels and patch clamps to
  // the mall's existing opening. The moving leaves keep their own physics.
  const framelessGlassDepth = .012;
  const framelessPatchSize = [.082,.072,.028];
  const framelessPatchOffset = (.455-.2515)/.491*2.25;
  const batches = new Map(), matrix = new T.Matrix4(), quaternion = new T.Quaternion(), euler = new T.Euler();
  // These matte and wood finishes differ only in tint within each group.
  // Shared ground batches retain shop membership per placement.
  const finishForRole = new Map();
  const finishMaterials = {}, colourBatches = [], viewUpdates = [];
  if (expanded) {
    finishMaterials.shopFloor = materials.shellFloor.clone();
    finishMaterials.shopFloor.color.set(0xffffff);
    for (const [finish, roles] of Object.entries({
      matte: ['ivory','green','dark','cream','foliage','leaf','pot','seat'],
      woodGrain: ['wood','oak','timber','timberAlt']
    })) {
      const base = materials[roles[0]].clone();
      base.color.set(0xffffff);
      finishMaterials[finish] = base;
      for (const role of roles) finishForRole.set(role, finish);
    }
  }
  const plainFinish = instancedSurfaceMaterial(T);
  function refreshInstanceColours() {
    for (const refresh of colourBatches) refresh();
  }
  const position = new T.Vector3(), scale = new T.Vector3(), shopLodMeshes=[],shopLodUpdates=[],shopBays=new Map(expandedLayout.slots.map(bay=>[Number(bay.number),bay]));
  const shopVisibility = createShopVisibility(T);
  const shopUploads = new Map();
  const atmosphereWashes = [];
  const lightWash = (...placement) => atmosphereWashes.push(placement);
  let uploadVisitor, pavingMesh, mappedPaving;
  function queueShopUpload(slot, ...meshes) {
    if (!expanded || !prepareModel) return;
    if (!shopUploads.has(slot)) shopUploads.set(slot, []);
    shopUploads.get(slot).push(...meshes);
  }
  async function setPavingMap(map) {
    const material = materials.paving.clone();
    material.map = map;
    material.color.set(0xf8f5f1);
    const sample = new T.InstancedMesh(geometry.paving, material, 1);
    try {
      await prepareModel?.(sample);
      // A graphics tier can change while the mapped material is warming.
      material.roughness = materials.paving.roughness;
      mappedPaving = material;
      if (pavingMesh) pavingMesh.material = material;
      materials.paving.dispose();
    } catch {
      map.dispose();
      material.dispose();
    } finally { sample.dispose(); }
  }
  let activeShopSlot=null,activeDeck=false,upperLevel=null,interiorModels=null,productDisplay=null;
  const tagShopLod=mesh=>{if(expanded&&activeShopSlot!==null){mesh.userData.shopSlot=activeShopSlot;shopLodMeshes.push(mesh);}return mesh;};
  function solid(type, material, x, y, z, sx, sy, sz, ry = 0, rx = 0, order = 'XYZ', rz = 0) {
    const source = materials[material];
    const roleFinish = finishForRole.get(material);
    const plainType = type === 'box' || type === 'cylinder' && roleFinish !== 'woodGrain';
    const plain = expanded && plainType && source.isMeshStandardMaterial && !source.transparent && !source.map && !source.emissive.getHex() &&
      !['paving','shellFloor','courtStone'].includes(material);
    const finish = plain ? 'plain' : type === 'publicLeaf' ? 'canopy' : roleFinish;
    const shared = expanded && ((!source.transparent && !material.endsWith('Backdrop')) ||
      material === 'contact' || material === 'lightPool');
    const shopSlot = shared ? null : activeShopSlot;
    const key = `${type}:${finish || material}${shopSlot===null?'':`:shop-${shopSlot}`}${activeDeck?':deck':''}`;
    if (!batches.has(key)) batches.set(key, {type, finish, geometry: geometry[type],
      material: plain ? plainFinish : finish ? finishMaterials[finish] : source, transforms: [],
      shopSlot, deckLod:activeDeck, colours: finish ? [] : null, surfaces:plain ? [] : null, slots:shared ? [] : null});
    const batch = batches.get(key);
    batch.slots?.push(activeShopSlot);
    if (finish) batch.colours.push(source.color);
    if (plain) {
      // Cylinders formerly shared the matte finish's lighting parameters.
      const surface = type === 'cylinder' && roleFinish === 'matte' ? finishMaterials.matte : source;
      batch.surfaces.push(surface.roughness, surface.metalness);
    }
    position.set(x, y, z); scale.set(sx, sy, sz); euler.set(rx, ry, rz, order); quaternion.setFromEuler(euler);
    matrix.compose(position, quaternion, scale); batch.transforms.push(matrix.clone());
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
  const [furnishings,shell] = await Promise.all([furnishingTask,shellTask,texturesTask]);
  const plane = geometry.plane;
  function art(name, x, y, z, width, ry = 0) {
    const texture = textures.get(name), height = width * texture.image.height / texture.image.width;
    const material = decalMaterial(filterWallArtwork(T,mat(0xffffff, {
      map:texture, emissiveMap:texture, emissive:0xffffff, emissiveIntensity:.2
    })), -1);
    const mesh = new T.Mesh(plane, material);
    mesh.name = name;
    mesh.position.set(x + decalClearance * Math.sin(ry), y, z + decalClearance * Math.cos(ry));
    mesh.rotation.y = ry; mesh.scale.set(width, height, 1); scene.add(mesh);
    mesh.userData.shopDecal = true;
    if (activeShopSlot !== null) queueShopUpload(activeShopSlot, mesh);
    return tagShopLod(mesh);
  }
  const roomSigns = [];
  let restrooms = null;
  let signage, interiorKit;
  function sign(text, x, y, z, width, height = .4, framed = false, fontSize = 42) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (framed) {
      context.fillStyle = '#17372e'; context.fillRect(0, 0, 1024, 128);
      context.strokeStyle = '#b59b62'; context.lineWidth = 3; context.strokeRect(8, 8, 1008, 112);
    }
    context.fillStyle = '#e9d6a9'; context.font = `500 ${fontSize}px Georgia`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 512, 64);
    const texture = setupArtworkTexture(T,new T.CanvasTexture(canvas),artworkTier());
    const mesh = placeDecal(new T.Mesh(plane, decalMaterial(new T.MeshBasicMaterial({map:texture,transparent:true}))));
    mesh.name = text;
    mesh.position.set(x, y, decalHeight(z)); mesh.scale.set(width, height, 1); scene.add(mesh);
    mesh.userData.shopDecal = true;
    if (activeShopSlot !== null) queueShopUpload(activeShopSlot, mesh);
    return tagShopLod(mesh);
  }
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d'), gradient = shadowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(4,18,12,.58)'); gradient.addColorStop(.35, 'rgba(4,18,12,.34)'); gradient.addColorStop(1, 'rgba(4,18,12,0)'); shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const contact = decalMaterial(new T.MeshBasicMaterial({map:new T.CanvasTexture(shadowCanvas),transparent:true}),-1);
  materials.contact=contact;
  function shadow(x, z, w, d) {
    // Every ground decal uses the same flat color and alpha blend.
    solid('plane','contact',x,.018,z,w,d,1,0,-Math.PI/2);
  }
  // One soft light texture and one instance batch serve every floor and wall wash.
  const poolCanvas = document.createElement('canvas'); poolCanvas.width = poolCanvas.height = 64;
  const poolContext = poolCanvas.getContext('2d'), poolGradient = poolContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  poolGradient.addColorStop(0, expanded ? 'rgba(255,231,200,.18)' : 'rgba(255,226,171,.3)');
  poolGradient.addColorStop(.35, expanded ? 'rgba(255,234,206,.09)' : 'rgba(255,226,171,.15)');
  poolGradient.addColorStop(1, 'rgba(255,226,171,0)');
  poolContext.fillStyle = poolGradient; poolContext.fillRect(0, 0, 64, 64);
  const poolTexture = new T.CanvasTexture(poolCanvas); poolTexture.colorSpace = T.SRGBColorSpace;
  materials.lightPool = decalMaterial(new T.MeshBasicMaterial({
    map:poolTexture, transparent:true, blending:T.AdditiveBlending, toneMapped:false
  }),-1);
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
    if (expanded) lightPool(x,.091,z,1.9,1.9);
    collider(x, .4, z, .85, .8, .85); shadow(x, z, 2.1, 2.1);
  }
  function bench(placement) {
    const {x,z,facing,group}=placement;
    const modelPlaced=furnishings.place('bench', x, z, benchScale, facing, 0, placement.pose.angle, activeShopSlot);
    const seatCollider=collider(x, .3*benchScale, z, placement.clearance.colliderWidth, .4*benchScale, placement.clearance.colliderDepth);
    if (placement.pose.angle % Math.PI) {
      const halfYaw=placement.pose.angle/2;
      seatCollider.setRotation({x:0,y:Math.sin(halfYaw),z:0,w:Math.cos(halfYaw)});
    }
    const footY=group==='atrium' ? (expanded ? .016 : 0) : (expanded ? .0245 : .015);
    seats.push(createSeatAnchor(placement,seatCollider.handle,modelPlaced ? undefined : groundBenchFallback,benchScale,footY));
    const angle=placement.pose.angle, c=Math.cos(angle), s=Math.sin(angle);
    const benchBox=(m,bx,by,bz,sx,sy,sz)=>{
      const dx=bx-x, dz=(bz-z)*facing;
      solid('box',m,x+c*dx+s*dz,by*benchScale,z-s*dx+c*dz,sx,sy*benchScale,sz,angle);
    };
    if (!modelPlaced) {
      const {top,front}=groundBenchFallback;
      benchBox('wood', x, .3, z, 2.5, .4, .85); benchBox('seat', x, top-.09, z, 2.55, .18, -2*front);
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
    if (expanded && activeShopSlot === null) lightWash(x,.054,z,3.1,3.1,0,-Math.PI/2,true);
    else lightPool(x, .052, z, 4.6, 4.6);
  }
  // Continuous slab; shop thresholds remain level and physically unobstructed.
  if (expanded) {
    box('dark', 10, -.22, 18, 70, .4, 60, true);
    box('shellFloor', 10, -.035, 18, 70, .04, 60);
    // Twin stone borders lead from the entrance to the planted court. The
    // detailing sits flush above the slab and shares existing material batches.
    for (const x of [6.8, 13.2]) {
      box('green', x, -.009, 32.5, .46, .008, 29);
      box('brass', x, -.002, 32.5, .035, .004, 29);
    }
    for (const z of [22, 28, 34, 40, 46]) {
      for (const x of [6.8, 13.2]) {
        solid('box', 'brass', x, .002, z, .38, .005, .38, Math.PI / 4);
        solid('box', 'green', x, .007, z, .26, .004, .26, Math.PI / 4);
      }
    }
    if (new URLSearchParams(location.search).get('tram') === 'debug') shopLodUpdates.push(addTramDebug(T, scene));
    shopLodUpdates.push(buildPublicArchitecture(T, {scene, materials, geometry, box, solid, lightPool, lightWash, garden:atriumLayout.garden, prepareModel, detailsEnabled, setPavingMap, ceilingBounds, artworkTier, daylightSkylight:expandedLift, setCanopyMaterial: material => { finishMaterials.canopy = material; }}));
    if (expandedLift) addAtriumSkylight(T,scene,liftLayout.roofOpening);
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
    for (const component of [...SHELL_LAYOUT.caps, ...roof]) ceilingBox(component.material, ...component.position, ...component.size);
    const ceiling = SHELL_LAYOUT.assets.ceiling;
    const [width, height, depth] = ceiling.bounds_max.map((max, axis) => max - ceiling.bounds_min[axis]);
    for (const [x, y, z] of ceiling.placements) ceilingBounds(x, y + height / 2, z, width, height, depth);
    shellState = shell.finish(scene, solid);
  }
  if (!expanded) {
  // Skylight replaces the central roof panel visually, with dusk glass and brass ribs.
  ceilingBox('dark', 0, 6.29, 8.3, 14.6, .06, 13);
  ceilingBox('skylightGlass', 0, 6.25, 8.3, 14.1, .025, 12.6);
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
    // A lighter bed liner defines the planting edge without filling the surrounding shadows.
    box('oak',garden.x,garden.height+.012,garden.z,garden.width-.18,.025,garden.depth-.18);
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
        box('green',planter.x,.3,planter.z,.7,.6,.7,true);
        const aisle = Math.sign(atriumLayout.garden.x-planter.x);
        lightWash(planter.x+aisle*.354,.21,planter.z,.72,.52,aisle*Math.PI/2,0,true);
        box('wood',planter.x,.61,planter.z,.6,.025,.6);
        for (let i=0;i<9;i++) {
          const a=i*Math.PI*2/9;
          solid('sphere',i%2?'leaf':'foliage',planter.x+Math.sin(a)*.12,.8,planter.z+Math.cos(a)*.12,.08,.27,.05,a,.72,'YXZ');
        }
        lightWash(planter.x,.025,planter.z,1.55,1.55,0,-Math.PI/2,true);
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
  const doors = [], interactables = [], doorFrames = [], doorGlass = [], windowGlass = [];
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
  // Painted shop finishes share the existing back-wall surface. The art is
  // architectural ornament, separate from the licensed imagery and displays.
  function shopBackdrop(zone) {
    const panel = document.createElement('canvas');
    panel.width = 1024; panel.height = 576;
    const ctx = panel.getContext('2d');
    function rectangle(color, x, y, width, height) {
      ctx.fillStyle = color; ctx.fillRect(x, y, width, height);
    }
    rectangle(zone === 'mili' ? '#a77c53' : '#eadcc3', 0, 0, 1024, 576);
    if (zone === 'gogo') {
      ctx.fillStyle = '#466858'; ctx.beginPath();
      ctx.roundRect(220, 98, 584, 450, [112,112,0,0]); ctx.fill();
    }
    // Backlit recessed cabinetry flanks the central display.
    for (const x of [24, 782]) {
      ctx.fillStyle = '#735239'; ctx.beginPath();
      ctx.roundRect(x, 84, 218, 398, zone === 'mili' ? 4 : [65,65,0,0]); ctx.fill();
      for (let shelf = 0; shelf < 3; shelf++) {
        const y = 114 + shelf * 107;
        const wash = ctx.createLinearGradient(0, y, 0, y + 90);
        wash.addColorStop(0,'#edcb87'); wash.addColorStop(.25,'#ad8250'); wash.addColorStop(1,'#78583e');
        rectangle(wash, x + 13, y + 15, 192, 84);
        for (let k = 0; k < 6; k++) {
          const ox = x + 22 + 29*k, h = 20 + ((k+shelf)%3)*7;
          ctx.fillStyle = ['#b7894c','#e1cdaa','#927754'][k%3];
          ctx.beginPath(); ctx.roundRect(ox,y+94-h,17,h,4); ctx.fill();
          rectangle('#e4cc99',ox+2,y+91-h,13,4);
        }
        rectangle('#cfac77', x + 9, y + 98, 200, 5);
      }
    }
    const map = setupArtworkTexture(T,new T.CanvasTexture(panel),artworkTier());
    return mat(0xffffff, {map, roughness:.88});
  }
  for (const store of spatial.stores) {
    const zone = store.id, x = storeCenterX(store);
    const frameless = expanded && zone === 'gogo';
    const lightNewMoon = expanded && zone === 'newmoon';
    const wall = expanded ? (lightNewMoon ? 'newMoonWall' : 'cream') : (zone === 'mili' ? 'cream' : 'green');
    if (lightNewMoon) materials.newMoonWall = mat(0xe6e4df);
    if (expanded) {
      const floor = `${zone}Floor`;
      finishForRole.set(floor,'shopFloor');
      materials[floor] = materials.shellFloor.clone();
      materials[floor].color.set(interiorFloorColour(interiorStores['S'+store.number]));
      const y=.012, z=-5.1, width=9.55, height=.025, depth=10.25;
      box(floor, x, y, z, width, height, depth);
      bakedFloors.push({minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2,y:y+height/2+.009});
    } else for (let i = 0; i < 18; i++) box(i % 3 ? 'timber' : 'timberAlt', x - 4.25 + i * .5, -.005, -5, .49, .04, 10);
    const backdrop = `${zone}Backdrop`;
    let rearWall = wall;
    if (lightNewMoon) {
      materials.newMoonOak = mat(interiorStores.S01.palette[0].hex);
      materials.newMoonBlue = mat(interiorStores.S01.palette[3].hex);
    } else if (expanded) {
      materials[backdrop] = shopBackdrop(zone);
      rearWall = backdrop;
    }
    box(rearWall, x, 2.85, -10.5, 10, 5.7, .25, true);
    for (const side of [-1, 1]) {
      box(wall, x + side * 4.8, 2.85, -5.25, .22, 5.7, 10.5, true);
      if (expanded) {
        shopVisibility.addWall(Number(store.number), x + side * 4.8, 2.85, -5.25, .22, 5.7, 10.5);
        // Glazing is physically solid but visually transparent: shoppers can
        // see the real existing interior without blocking the 4.7 m doorway.
        const windowX = x + side * 3.55;
        windowGlass.push({position:new T.Vector3(windowX,2.6,0), scale:new T.Vector3(2.4,5.2,frameless ? framelessGlassDepth : .12)});
        collider(windowX,2.6,0,2.4,5.2,.12);
        if (frameless) {
          box('brass', windowX, .013, 0, 2.4, .026, .036);
        } else {
          box('shellWall', windowX, .26, .1, 2.4, .52, .2);
          for (const edge of [-1, 1]) {
            box('green', windowX + edge * 1.15, 2.65, .1, .11, 5.05, .18);
            box('brass', windowX, 2.6 + edge * 2.49, .12, 2.3, .06, .16);
          }
          box('brass', windowX, 2.58, .12, 2.3, .035, .12);
        }
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
      if (!frameless) box('brass', x + side * 2.36, 1.9, .22, .065, 3.8, .08);
      box('glow', x + side * 3.6, frameless ? 3.94 : 3.67, .28, 2.12, .035, .04);
      lightPool(x + side * 3.6, .053, 1.15, 3.4, 3.7);
    }
    if (expanded) {
      box('green', x, 4.7, 0, 9.7, 1.55, .5, true); box('brass', x, 5.45, .3, 9.8, .045, .08);
      shopVisibility.addWall(Number(store.number),x,4.7,0,9.7,1.55,.5,true);
    }
    ceilingBox('cream', x, 5.8, -5.2, 9.7, .22, 10.4, null);
    if (expanded) {
      shopVisibility.addWall(Number(store.number),x,2.85,-10.5,10,5.7,.25);
      shopVisibility.addCeiling(Number(store.number),x,5.8,-5.2,9.7,10.4);
    }
    activeShopSlot=expanded?Number(store.number):null;
    if (expanded && zone === 'newmoon') {
      // Recessed bronze-edged coffers draw the eye along the product aisle.
      for (const z of [-2.5, -5.4, -8.3]) {
        ceilingBox('ivory', x, 5.63, z, 7.9, .12, 2.35, null);
        for (const side of [-1, 1]) {
          box('brass', x + side * 3.85, 5.55, z, .06, .06, 2.24);
          box('brass', x, 5.55, z + side * 1.12, 7.75, .06, .06);
        }
      }
    }
    if (expanded) {
      // Window displays face the arcade; keep the full sliding-door opening clear.
      for (const side of [-1,1]) {
        const bx=x+3.57*side, bz=-.66;
        if (zone === 'newmoon' || (zone === 'mili' && side < 0)) {
          const casing=lightNewMoon?'newMoonOak':'oak';
          box(casing,bx,1.98,bz-.32,1.96,3.45,.09);
          for (const edge of [-1,1]) box(casing,bx+edge*.96,1.98,bz,.075,3.45,.68);
          collider(bx,1.98,bz,2.0,3.46,.7);
          for (const y of [.63,1.40,2.17,2.94]) {
            box(casing,bx,y,bz,1.95,.07,.7);
            box('glow',bx,y-.05,bz+.3,1.84,.025,.035);
            if (lightNewMoon) lightWash(bx,y-.28,bz+.38,1.85,.52,0,0,true);
            for(const dx of [-.51,0,.51]) {
              // Unlabelled ceramics and glassware form the window still life.
              cylinder(zone==='newmoon'?'brass':'cream',bx+dx,y+.19,bz+.11,.14,.29);
              cylinder(zone==='newmoon'?'wood':'cream',bx+dx,y+.36,bz+.11,.095,.075);
            }
          }
        } else {
          box('brass',bx,.12,bz,1.6,.18,.90);
          box('shellFloor',bx,.41,bz,1.62,.44,.91);
          collider(bx,.32,bz,1.62,.64,.92);
          for(const dx of [-.38,.29]) {
            cylinder('pot',bx+dx,.84,bz,.22,.40);
            for(const [offset,height] of [[-.16,1.38],[.10,1.60],[.22,1.32]]) {
              sphere('leaf',bx+dx+offset,height,bz,.21,.54,.14);
            }
          }
        }
      }
      if(!expanded && zone==='mili') {
        // Open oak pantry shelves continue down the side wall.
        for(const z of [-2.75,-5.05,-7.35]) {
          for(const y of [1.35,2.17,3.0]) {
            box('oak',x-4.45,y,z,.45,.085,2.15);
            box('glow',x-4.24,y-.055,z,.025,.024,2.07);
            const rack = y === 3 && z !== -7.35 &&
              furnishings.place('pantryRack',x-4.43,z,1,1,y+.0425,Math.PI/2,activeShopSlot);
            if (!rack) for(const dz of [-.72,-.23,.23,.72]) cylinder('cream',x-4.43,y+.18,z+dz,.14,.265);
          }
        }
      }
    }
    // Layered skirting and cornices add depth without moving the walls or artwork.
    for (const side of [-1, 1]) {
      box('oak', x + side * 4.665, .13, -5.25, .055, .2, 10.15);
      box('brass', x + side * 4.63, .245, -5.25, .025, .025, 10.15);
      box('oak', x + side * 4.65, 5.37, -5.25, .09, .16, 10.15);
      box('brass', x + side * 4.59, 5.26, -5.25, .025, .025, 10.15);
      if (!lightNewMoon) {
        box('oak', x + side * 4.64, 1.08, -5.25, .075, .095, 10.15);
        box('brass', x + side * 4.59, 1.15, -5.25, .025, .018, 10.15);
      }
      // Quiet wall bays remain behind the furniture, clear of the verified artwork.
      if (!lightNewMoon && (side > 0 || zone === 'mili')) for (const z of [-2.2, -5.2, -8.2]) {
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
    if (!expanded) {
      const rugX = x + (zone === 'newmoon' ? -.35 : 0);
      const rugZ = zone === 'newmoon' ? -5.1 : -5.9;
      const rugWidth = zone === 'newmoon' ? 5.2 : 6.8, rugDepth = zone === 'newmoon' ? 5.4 : 4.8;
      box('oak', rugX, .025, rugZ, rugWidth, .012, rugDepth);
      box(zone === 'gogo' ? 'rugSage' : 'rugSand', rugX, .034, rugZ, rugWidth - .14, .006, rugDepth - .14);
      for (const side of [-1, 1]) {
        const trimY = decalHeight(.037) + .002;
        box('timber', rugX + side * (rugWidth / 2 - .19), trimY, rugZ, .025, .004, rugDepth - .355);
        box('timber', rugX, trimY, rugZ + side * (rugDepth / 2 - .19), rugWidth - .405, .004, .025);
        for (const end of [-1, 1]) {
          const cornerX = rugX + side * (rugWidth / 2 - .43), cornerZ = rugZ + end * (rugDepth / 2 - .43);
          solid('box', 'oak', cornerX, .041, cornerZ, .16, .004, .16, Math.PI / 4);
        }
      }
      for (let i = 0; i < 14; i++) for (const end of [-1, 1]) {
        box('timber', rugX + (i - 6.5) * (rugWidth - .6) / 13, .034, rugZ + end * (rugDepth / 2 + .045), .035, .006, .12);
      }
    }
    if (!frameless) box('brass', x, .03, .25, 4.7, .025, .7);
    const logo = zone === 'newmoon' ? 'new-moon-logo.svg' : `${zone}-logo.jpg`;
    if (!expanded && !furnishings.place('storeSign', x, .28, 1, 1, 4.065, null, activeShopSlot)) {
      box('brass', x, 4.67, .3, 2.52, 1.21, .09); box('cream', x, 4.67, .36, 2.42, 1.11, .05);
    }
    if (!expanded) art(logo, x, 4.67, .4, 2.2);
    if (!expanded) box('glow', x, 5.36, .36, 2.42, .025, .045);
    box('brass', x, 4.02, .29, 9.3, .025, .04);
    const label = sign(`${store.number}  /  ${store.label.toUpperCase()}`, x, expanded ? 4.07 : 3.5, .38, expanded ? 1.9 : 3.9, expanded ? .14 : .48, true, 80);
    roomSigns.push({zone, mesh: label, left: 0, right: 0, top: 0, bottom: 0});
    // Two independently kinematic glass leaves slide clear of the walking capsule.
    const leaves = [];
    for (const side of [-1, 1]) {
      const group = new T.Group(); group.position.set(x + side * 1.16, 1.8, .05); scene.add(group);
      const paneScale = new T.Vector3(2.25,3.5,frameless ? framelessGlassDepth : .06);
      if (expanded) {
        doorGlass.push({position:group.position,scale:paneScale});
      } else {
        const glass = new T.Mesh(geometry.box,materials.glass);
        glass.scale.copy(paneScale);
        group.add(glass);
      }
      const trim = frameless ? [-1,1].map(end => ({
        offset:[side*framelessPatchOffset,end*(1.75-.046),0],size:framelessPatchSize
      })) : framedDoorTrim;
      doorFrames.push({position:group.position,trim});
      const body = physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(group.position.x, 1.8, .05));
      physics.createCollider(R.ColliderDesc.cuboid(1.125, 1.75, .03), body); leaves.push({group, body, side});
    }
    const occupied = createDoorwayOccupancy(R,physics,{x,y:1.8,z:.05},[2.29,1.75,.08],leaves);
    const door={zone, x, open:0, targetOpen:false, leaves, occupied};
    doors.push(door);
    if (expanded && zone === 'newmoon') {
      cylinder('brass', x + 1.8, 4.46, -4, .028, 2.35);
      cylinder('brass', x + 1.8, 3.25, -4, 1.05, .14);
      cylinder('glow', x + 1.8, 3.17, -4, 1.01, .04);
    } else if (expanded && zone === 'gogo') {
      for (const z of [-2.1,-3.7,-5.3]) pendant(x+2.7, z, 3.35);
    } else if (!expanded) { pendant(x, -4, 4.2); pendant(x, -8, 4.2); }
    box('brass', x, .22, -10.32, 9.3, .045, .04);
    if (zone === 'newmoon') {
      // The asset display owns its geometry and collision bounds; no legacy rack remains.
      lightPool(x, .054, -8.6, 7.5, 2.1);
      if (lightNewMoon) {
        const image = textures.get('new-moon-nz-425g-front.jpg').image;
        textures.set('new-moon-heritage-panel', setupArtworkTexture(T, new T.CanvasTexture(heritagePanel(image)), artworkTier()));
        const shop = interiorStores.S01;
        const [ox, oy, oz] = shop.frame.world_origin_m;
        const worldPoint = ([px, py, pz]) => [ox + px, oy + py, oz + pz];
        for (const panel of shop.storyPanels) {
          const yaw = panel.yawDeg * Math.PI / 180;
          box(panel.material, ...worldPoint(panel.frame), ...panel.size);
          art(panel.texture, ...worldPoint(panel.art), panel.width, yaw);
          if (panel.caption) {
            const serving = sign(newMoonExhibit[panel.id].tagline.toUpperCase(), ...worldPoint(panel.caption), 2.8, .19, true, 54);
            serving.rotation.y = yaw;
          }
          const [px, pz] = panel.interactionXZ;
          interactables.push({id:panel.id, x:ox+px, z:oz+pz, radius:panel.radius});
        }
      } else {
        const cover = art('new-moon-brand-cover.jpg', x - 4.64, 2.8, -5.8, 3.6, Math.PI / 2);
        box('brass', x - 4.665, 2.8, -5.8, .035, cover.scale.y + .14, 3.74);
        box('oak', x - 4.67, 2.8, -5.8, .04, cover.scale.y + .28, 3.88);
      }
      let sampleCan = null;
      if (expanded) {
        // Rounded stone sampling island with a continuous brass plinth.
        for (const [material, y, height, radius] of [['brass',.085,.17,.76],['shellFloor',.63,.96,.78],['ivory',1.14,.09,.80]]) {
          box(material, x+2.65, y, -4, radius*2, height, 2);
          for (const end of [-1,1]) cylinder(material,x+2.65,y,-4+end,radius,height);
        }
        collider(x+2.65,.57,-4,1.56,1.14,3.30);
        const top = 1.185;
        sampleCan = [x+2.65, top, -3.05];
        furnishings.place('teaKettle',x+2.8,-4.55,1,1,top,-.45,activeShopSlot);
        for (const [dx,dz] of [[-.35,.54],[.15,.73],[-.29,-.05]]) {
          furnishings.place('teaCup',x+2.65+dx,-4+dz,1,1,top,.2,activeShopSlot);
        }
      } else {
        box('green', x + 2.8, .55, -4, 2.1, 1.1, 1.25, true); box('cream', x + 2.8, 1.15, -4, 2.2, .12, 1.4);
        for (let i = 0; i < 9; i++) box('brass', x + 1.9 + i * .22, .56, -3.35, .025, 1, .025);
        box('brass', x + 2.8, 1.08, -3.285, 2.17, .045, .03);
        box('brass', x + 2.8, .09, -3.36, 2.1, .08, .03);
      }
      cylinder('pot', x + 3.48, 1.38, -4, .15, .32); cylinder('brass', x + 3.48, 1.545, -4, .155, .025);
      sphere('leaf', x + 3.48, 1.72, -4, .22, .3, .19);
      const {addProducts} = await productsTask;
      const displayProducts=showcaseProducts(SHOWCASE_PRODUCTS,expanded);
      const firstProduct = scene.children.length;
      productDisplay = await addProducts(T, scene, textures, materials.brass,displayProducts,[],sampleCan,activeShopSlot,artworkTier);
      // These GLBs were awaited during startup, but the shelf is out of the entry view.
      queueShopUpload(activeShopSlot, ...scene.children.slice(firstProduct).filter(mesh => mesh.isMesh));
      interactables.push(...productDisplay.interactables);
      for (const c of productDisplay.colliders) collider(c.x, c.y, c.z, c.sx, c.sy, c.sz);
      if (expanded) for (const shelf of productDisplay.shelves) {
        const shelfX = (shelf.min.x+shelf.max.x)/2, width = shelf.max.x-shelf.min.x;
        const shelfZ = shelf.max.z+.024;
        for (const fraction of [.39,.63,.88]) {
          const y = shelf.max.y*fraction;
          box('glow',shelfX,y,shelfZ,width*.87,.022,.026);
          lightWash(shelfX,y-.20,shelfZ+.02,width*.90,.44,0,0,true);
        }
      }
      const mountOnCabinet = expanded && productDisplay.assets.shelf.model === 'GJH-M056';
      for (const [index, country] of ['NEW ZEALAND', 'AUSTRALIA', 'SOUTH AFRICA', 'MEXICO'].entries()) {
        const {max} = productDisplay.shelves[index];
        // Keep labels on the cabinet header above the upper stock light.
        const [y, z] = mountOnCabinet ? [max.y - .14, max.z + .028] : [2.04, -9.22];
        sign(country, productDisplay.shelfPositions[index], y, z, 1.65, .16, true, expanded ? 78 : undefined);
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
      if (expanded && zone === 'mili') {
        const {frame, cookbase} = interiorStores.S02;
        const [originX, , originZ] = frame.world_origin_m;
        const [fixtureX, , fixtureZ] = cookbase.xyz;
        const [standingX, standingZ] = cookbase.standing;
        const counterX = originX + fixtureX, counterZ = originZ + fixtureZ;
        sign('COMPARE THE TWO MILI SAUCES', counterX, .91, counterZ+1.307, 1.50, .14, true, 60);
        interactables.push({id:'mili-sauce-story',x:originX+standingX,z:originZ+standingZ,radius:1.12});
        box('jadeAlt',x,.57,-5.5,1.7,1.12,2.55);
        box('brass',x,.095,-5.5,1.72,.15,2.57);
        for(let dx=-.8;dx<=.85;dx+=.2) box('courtStone',x+dx,.6,-4.218,.012,.96,.015);
        for(let y=.22;y<1.13;y+=.2) box('courtStone',x,y,-4.218,1.68,.014,.015);
        box('shellFloor',x,1.16,-5.5,1.82,.12,2.69);
        collider(x,.57,-5.5,1.72,1.14,2.55);
      } else if (!expanded) {
        if (!furnishings.place('coffeeTable', x, -5.5, 1, 1, 0, null, activeShopSlot)) {
          cylinder('brass', x, .4, -5.5, .08, .75); cylinder('oak', x, .8, -5.5, .8, .1);
          cylinder('brass', x, .853, -5.5, .805, .025);
        }
        collider(x, .4375, -5.5, 1.61, .875, 1.61);
        cylinder('pot', x, .99, -5.5, .115, .24);
        sphere('foliage', x, 1.2, -5.5, .2, .23, .18);
      }
      plant(x - 3.8, -8.8, 1.15); plant(x + 3.8, -8.8, 1.15); plant(x + 3.8, -2.5);
      if (zone === 'gogo') {
        if (expanded) {
          const {frame, anchor, gogoStools} = interiorStores.S03;
          const [standingX, standingZ] = anchor.standing;
          const [originX, originY, originZ] = frame.world_origin_m;
          art('gogo-logo.jpg',originX-2.213,originY+1.60,originZ+2.669,.49,anchor.yaw_deg*Math.PI/180);
          interactables.push({id:'gogo-potong-story',x:frame.world_origin_m[0]+standingX,z:frame.world_origin_m[2]+standingZ,radius:1.0});
          const cx = x+3.15, cz = -2.40;
          box('water',cx,.59,cz,1.55,1.16,3.25);
          box('brass',cx,.10,cz,1.57,.16,3.29);
          box('cream',cx,1.2,cz,1.67,.12,3.4);
          furnishings.place('coffeeMachine',cx+.16,cz+.55,1,1,1.26,-Math.PI/2,activeShopSlot);
          collider(cx,.59,cz,1.55,1.18,3.25);
          for(let dz=-1.55;dz<1.61;dz+=.10) box('jadeAlt',cx-.79,.65,cz+dz,.045,.88,.045);
          for(let dx=-.73;dx<.77;dx+=.10) box('jadeAlt',cx+dx,.65,cz+1.64,.045,.88,.045);
          for (const stool of gogoStools) {
            const sx = originX+stool.position_m[0], sz = originZ+stool.position_m[2];
            const [width,height,depth] = stool.envelope_whd_m;
            const angle = stool.yaw_deg*Math.PI/180;
            const placed = furnishings.place('barStool',sx,sz,1,1,0,angle,activeShopSlot);
            if (!placed) {
              cylinder('brass',sx,.36,sz,.042,.65);
              cylinder('brass',sx,.06,sz,.23,.065);
              cylinder('seat',sx,.72,sz,.22,.12);
            }
            const pan = collider(sx,height/2,sz,width,height,depth);
            pan.setRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)});
            seats.push(gogoStoolSeat(frame,stool,pan.handle,placed));
          }
        }
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
      if(!expanded && zone==='mili') {
        // Generic pack forms avoid inventing package artwork or exact dimensions.
        cylinder('green',x,.25,-1.35,.075,.34);cylinder('oak',x,.45,-1.35,.038,.09);cylinder('brass',x,.505,-1.35,.04,.025);
      } else if(!expanded && zone==='gogo') {
        cylinder('cream',x-.11,.07,-1.35,.034,.14);cylinder('brass',x-.11,.144,-1.35,.035,.012);
        box('ivory',x+.12,.08,-1.35,.055,.16,.045);box('oak',x+.12,.08,-1.325,.035,.11,.006);
      }
    }
    if (expanded) addOriginalShopDetails(zone, x, {box, cylinder, solid, collider, seats});
    activeShopSlot=null;
    }
  let slide;
  if (expanded) {
    signage=await addShopSignAtlas(T,expandedLayout,scene);
    slide = addExpandedStorefronts(T,expandedLayout,scene,signage.configs,plainFinish);
    for (const x of atriumLayout.anchorPierXs) {
      box('green',x,2.83,.27,.29,5.66,.24);
      box('brass',x,.15,.31,.35,.24,.27);
      box('brass',x,5.63,.29,.36,.065,.27);
      lightWash(x,.22,.449,.66,.58,0,0,true);
      for (const side of [-1,1]) lightWash(x+side*.122,2.9,.394,.038,5.35,0,0,true,0xffca79,2.3);
      lightWash(x-.046,2.76,.394,.155,4.96,0,0,true,0xb0c6a5,.42);
    }
    for (const side of [-1,1]) {
      const {inset,depth} = atriumLayout.arcadePilaster;
      const face = (side < 0 ? -15 : 35) + side*(inset-depth/2-.004), yaw = -side*Math.PI/2;
      for (let i=0;i<6;i++) {
        const z = i*8+.12;
        for (const edge of [-1,1]) lightWash(face,2.9,z+edge*.151,.038,5.35,yaw,0,true,0xffca79,2.2);
        lightWash(face,2.78,z+.045,.15,4.96,yaw,0,true,0xb0c6a5,.38);
      }
    }
    for (const store of spatial.stores) {
      const x = storeCenterX(store);
      box('glow',x,5.595,.416,9.67,.048,.07);
      for (const dx of [-3.2,0,3.2]) {
        lightWash(x+dx,5.43,.30,3.85,.82,0,0,true,0xffca85,1.75);
      }
    }
    for (const bay of expandedLayout.slots) {
      const {x,z,normalX,normalZ,yaw} = shopEntrance(bay);
      const frontage = normalZ ? bay.maxX-bay.minX : bay.maxZ-bay.minZ;
      const tint = shopLampTint(T,'S'+bay.number);
      const offset = 2.15;
      lightWash(x+normalX*offset,.029,z+normalZ*offset,frontage*.78,4.2,yaw,-Math.PI/2,false,tint);
      lightWash(x-normalX*.28,3.88,z-normalZ*.28,frontage*.72,.72,yaw,Math.PI/2,true,tint,1.7);
      lightWash(x-normalX*1.05,.052,z-normalZ*1.05,2.5,2.5,yaw,-Math.PI/2,true,tint,.78);
      if (bay.number === '14') {
        lightWash(x+normalX*.23,2.21,z,frontage*.95,3.6,yaw,0,true,tint,1.24);
        // Keep the dark television display readable through the side glass.
        lightWash(x+normalX*.24,1.55,z+2.35,2.65,2.4,yaw,0,true);
      }
    }
    for (const bay of expandedLayout.slots.slice(3)) {
      const {x,z,alongX,alongZ,normalX,normalZ}=shopEntrance(bay);
      const width = normalZ ? bay.maxX-bay.minX : bay.maxZ-bay.minZ;
      const halfOpening=1.24, paneWidth=width/2-halfOpening;
      const leaves=[];
      for (const side of [-1,1]) {
        const offset=side*(halfOpening+paneWidth/2);
        collider(x+alongX*offset,1.96,z+alongZ*offset,
          normalZ ? paneWidth : .18,3.92,normalZ ? .18 : paneWidth);
        const body=physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(
          x+alongX*side*.64+normalX*.025,1.97,z+alongZ*side*.64+normalZ*.025));
        physics.createCollider(R.ColliderDesc.cuboid(normalZ ? .62 : .035,1.93,normalZ ? .035 : .62),body);
        leaves.push({side,body});
      }
      const occupied = createDoorwayOccupancy(R,physics,{x:x+normalX*.025,y:1.97,z:z+normalZ*.025},
        normalZ ? [halfOpening,1.93,.08] : [.08,1.93,halfOpening],leaves);
      const door={
        zone:`planned-space-${bay.number}`, x,z,open:0,targetOpen:false,
        advance(visitor,dt,reducedMotion) {
          const dx=visitor.x-x,dz=visitor.z-z;
          const nearby=(visitor.y<2 && Math.abs(dx*alongX+dz*alongZ)<2.25 &&
            Math.abs(dx*normalX+dz*normalZ)<3.25) || (this.open > 0 && occupied());
          if (nearby !== this.targetOpen) mallAudio.play('door');
          this.targetOpen = nearby;
          const next=reducedMotion ? Number(nearby) : Math.max(0,Math.min(1,this.open+(nearby?1:-1)*dt*3));
          if (next===this.open) return;
          this.open=next;
          const travel=1.30*next;
          slide(bay.number,travel);
          for (const {side,body} of leaves) {
            const along=side*(.64+travel);
            body.setNextKinematicTranslation({x:x+alongX*along+normalX*.025,y:1.97,z:z+alongZ*along+normalZ*.025});
          }
        }
      };
      doors.push(door);
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
    // The broad wash follows the same roof opening as the fixture.
    function warmStrip(x,z,width,depth){
      const panels=ceilingBox('glow',x,8.34,z,width,.035,depth,liftLayout.roofOpening);
      for (const r of panels) lightWash(
        (r.minX+r.maxX)/2,8.31,(r.minZ+r.maxZ)/2,
        Math.max(.88,r.maxX-r.minX),Math.max(.88,r.maxZ-r.minZ),0,Math.PI/2,true,0xffcf94,1.55
      );
      const washWidth=width>depth ? width : 2.4, washDepth=width>depth ? 2.4 : depth;
      const bounds={minX:x-washWidth/2,maxX:x+washWidth/2,minZ:z-washDepth/2,maxZ:z+washDepth/2};
      const washes=expandedLift ? cutRectangle(bounds,liftLayout.roofOpening) : [bounds];
      for (const r of washes) lightWash(
        (r.minX+r.maxX)/2,8.367,(r.minZ+r.maxZ)/2,r.maxX-r.minX,r.maxZ-r.minZ,0,Math.PI/2,false,0xffd39e,1.25
      );
    }
    for(const x of [-12,32])for(const z of [10,22,34])warmStrip(x,z,.07,6);
    for(const x of [-5,10,25])warmStrip(x,3,6,.07);
    // Cove strips and suspended rings reuse emissive instances, not dynamic lights.
    const {minX:roofWest,maxX:roofEast,minZ:roofNorth,maxZ:roofSouth} = liftLayout.roofOpening;
    if (expandedLift) {
      for (const x of [roofWest-.20,roofEast+.20]) warmStrip(x,(roofNorth+roofSouth)/2,.07,roofSouth-roofNorth);
      for (const z of [roofNorth-.20,roofSouth+.20]) warmStrip((roofWest+roofEast)/2,z,roofEast-roofWest,.07);
    }
    for(const x of [-9,29]) warmStrip(x,20,.09,27);
    for(const z of [6.5,33.5]) warmStrip(10,z,38,.09);
    for(const radius of [2.2,3.2]) solid('torus','glow',10,8.05,20,radius,radius,.8,0,-Math.PI/2);
    lightPool(10,.053,20,8,8);

    restrooms=buildRestrooms(T,R,physics,scene,{box,cylinder,collider,sign,materials,doors,interactables});
    for (const x of [-12,32]) {
      box('brass',x,.024,21,.035,.008,36);
      lightWash(x,.029,21,.028,36,0,-Math.PI/2,true);
    }
    for (const z of [3,39]) {
      box('brass',10,.024,z,44,.008,.035);
      lightWash(10,.029,z,44,.028,0,-Math.PI/2,true);
    }
    // The story gallery lines the south perimeter, behind the directory.
    activeDeck=true;
    const band=brandRail;
    box('wood',band.x,liftLayout.upper+band.y,band.z,band.width,band.height,band.depth,true);
    for(const edge of [-1,1])box('brass',band.x,liftLayout.upper+band.y+edge*band.height/2,
      band.z-band.depth/2,band.width,.028,.035);
    if(expandedLift){
      upperLevel=buildUpperLevel(T,{tier:artworkTier()},{collider,lightWash});
      scene.add(upperLevel.group,upperLevel.panes);
    }
    const deckBench=placement=>{
      const {x,z,facing}=placement;
      const slattedProfile=upperLevel?.seatProfiles.get(placement.finish);
      const modelPlaced=!slattedProfile && furnishings.place('bench',x,z,benchScale,facing,liftLayout.upper,placement.pose.angle,-1);
      if(!slattedProfile && !modelPlaced){
        const {top,front}=deckBenchFallback;
        box('wood',x,liftLayout.upper+.24,z,2.3,.32,.72);
        box('seat',x,liftLayout.upper+top-.09,z,2.34,.18,-2*front);
        box('seat',x,liftLayout.upper+.82,z+facing*.28,2.34,.54,.16);
        box('brass',x,liftLayout.upper+.44,z-facing*.38,2.32,.025,.025);
      }
      // Leave capsule clearance between each bench and the adjacent planter.
      const seatCollider=collider(x,liftLayout.upper+.26,z,placement.clearance.colliderWidth,.5,placement.clearance.colliderDepth);
      if(placement.accessible!==false)seats.push(createSeatAnchor(placement,seatCollider.handle,
        modelPlaced ? undefined : slattedProfile || deckBenchFallback,modelPlaced ? benchScale : 1));
    };
    for(const placement of seatPlacements.filter(item=>item.group==='deck'))deckBench(placement);
    for(const [x,z] of deckPlanters){
      if(!furnishings.place('planter',x,z,.68,1,liftLayout.upper,null,-1)){
        box('pot',x,liftLayout.upper+.24,z,.68,.48,.68,true);
        box('wood',x,liftLayout.upper+.49,z,.58,.025,.58);
        for(let i=0;i<4;i++)solid('sphere',i%2?'leaf':'foliage',x+(i%2?-.14:.14),liftLayout.upper+.78,z+(i<2?-.14:.14),.19,.36,.19);
      }
      collider(x,liftLayout.upper+.25,z,.68,.5,.68);
    }
    activeDeck=false;
    const interiors=await createExpandedInteriors(T,expandedLayout,scene,materials.shellFloor.map,prepareModel,shopVisibility,artworkTier,detailsEnabled,waitForSlice);
    interiorModels=interiors;
    for(const footprint of interiors.collisionBoxes) {
      const {x,y,z,width,height,depth} = footprint;
      const shape = collider(x,y,z,width,height,depth);
      if (footprint === interiors.gigasetSeatBox)
        seats.push(createGigasetLoungeSeat(shape.handle,footprint),createGigasetBacklessSeat(shape.handle,footprint));
      const nativeSeat = interiors.nativeStudioSeats.get(footprint);
      if (nativeSeat) seats.push(nativeSeat(shape.handle));
      shopObstacles.push({min:{x:x-width/2,y:y-height/2,z:z-depth/2},
        max:{x:x+width/2,y:y+height/2,z:z+depth/2}});
      const rect = {minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
      // The studio generator emits the floor and ceiling collision envelopes
      // directly from the same dimensions as their visible finishes.
      if (y === .041 && height === .08) bakedFloors.push({...rect,y:y+height/2+.009});
      if (y === 4.19 && height === .18) bakedCeilings.push({...rect,y:y-height/2-.003});
    }
    shopLodUpdates.push(interiors.update);
    interiorKit = createInteriorKit(T, scene, {
      assetBase:new URL('.',import.meta.url), packshot:textures.get('new-moon-nz-425g-front.jpg'), artworkTier, waitForSlice,
      prepareModel, registerCollider({center:[x,y,z],size:[w,h,d],yaw},store,footprint) {
        // The camera sweep already uses these oriented Rapier boxes.
        const box = physics.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z)
          .setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}));
        const seat = createProceduralSeat(store,footprint,box.handle);
        if (!seat) return () => physics.removeCollider(box,false);
        const entry = seatInteraction(seat);
        const removeRecord = registerShopSeat?.(seat);
        seats.push(seat);
        interactables.push(entry);
        return () => {
          seats.splice(seats.indexOf(seat),1);
          interactables.splice(interactables.indexOf(entry),1);
          removeRecord?.();
          physics.removeCollider(box,false);
        };
      }
    });
    // Shop focus pools share the public light wash. Contact decals follow
    // the authored furniture footprints in the existing contact batch.
    for (const [id,store] of Object.entries(interiorStores)) {
      activeShopSlot = Number(id.slice(1));
      const [fx,,fz] = store.ambient.focus;
      const [standingX,standingZ] = store.anchor.standing;
      const floorY = Math.max(.036,store.floor.position_m[1]+.012);
      const [px,py,pz] = worldInteriorPoint(store,[(fx+standingX)/2,floorY,(fz+standingZ)/2]);
      const width = id === 'S01' ? 7.8 : 3.25;
      const intensity = id === 'S03' ? 1.10 : 1.42;
      lightWash(px,py,pz,width,2.75,store.frame.yaw_world_deg*Math.PI/180,-Math.PI/2,
        activeShopSlot,id === 'S01' ? 0xffce91 : 0xffdfae,intensity);
      if (id === 'S04') {
        for (const [storyId, [x, z]] of [
          ['borsch-patch-story', store.anchor.standing],
          ['borsch-lingzhi-story', store.lingzhiStanding]
        ]) {
          const [wx,,wz] = worldInteriorPoint(store,[x,0,z]);
          interactables.push({id:storyId,x:wx,z:wz,radius:1.0});
        }
      } else if (id === 'S05') {
        const [x,,z] = worldInteriorPoint(store,[pzhCartonX,0,pzhCartonStandingZ]);
        interactables.push({id:'pzh-carton-story',x,z,radius:1.0});
      } else if (shopCatalogueFocals[id]) {
        const exhibit = shopCatalogueFocals[id];
        const [x,,z] = worldInteriorPoint(store,[standingX,0,standingZ]);
        const plaque = sign(exhibit.caption,...worldInteriorPoint(store,exhibit.panel),1.02,.15,true,65);
        plaque.rotation.y = store.frame.yaw_world_deg*Math.PI/180;
        interactables.push({id:exhibit.id,x,z,radius:1.0});
      }
      for (const footprint of store.colliders) {
        const {center:[x,,z],size:[w,,d],yaw} = worldInteriorBox(store,footprint);
        const y = store.frame.world_origin_m[1] + store.floor.position_m[1] + .024;
        solid('plane','contact',x,y,z,w*1.22,d*1.22,1,yaw,-Math.PI/2,'YXZ');
      }
    }
    activeShopSlot = null;
  }
  const amenities=await addAmenities(T,scene,collider,createCollectProp,true,staticProductCount,expanded,artworkTier);
  interactables.push(...amenities.interactables);
  // The physics still owns each moving leaf. Frame and glass buffers read the
  // same transforms before drawing.
  const trimCount = doorFrames.reduce((count,{trim}) => count+trim.length,0);
  const frames = new T.InstancedMesh(geometry.box, materials.brass, trimCount);
  frames.name = 'Sliding shop door frames';
  frames.instanceMatrix.setUsage(T.DynamicDrawUsage);
  let frameCount = -1;
  const previousDoorFrames = [], previousDoorX = [];
  geometry.box.computeBoundingBox();
  const frameBox = new T.Box3();
  for (const leaf of doorFrames) {
    leaf.bounds = new T.Box3();
    for (const {size,offset} of leaf.trim) {
      matrix.makeScale(...size).setPosition(...offset);
      leaf.bounds.union(frameBox.copy(geometry.box.boundingBox).applyMatrix4(matrix));
    }
  }
  function updateFrames({frustum} = {}) {
    let count = 0, changed = false;
    for (const leaf of doorFrames) {
      const {position,trim,bounds} = leaf;
      if (frustum && !frustum.intersectsBox(frameBox.copy(bounds).translate(position))) continue;
      if (previousDoorFrames[count] !== leaf || previousDoorX[count] !== position.x) changed = true;
      previousDoorFrames[count] = leaf;
      previousDoorX[count] = position.x;
      for (const {offset,size} of trim) {
        matrix.makeScale(...size).setPosition(position.x+offset[0],position.y+offset[1],position.z+offset[2]);
        frames.setMatrixAt(count++, matrix);
      }
    }
    if (!changed && count === frameCount) return;
    frameCount = frames.count = count;
    frames.instanceMatrix.needsUpdate = true;
    frames.computeBoundingSphere();
  }
  updateFrames();
  scene.add(frames);
  viewUpdates.push(updateFrames);
  if (expanded) for (const [name,panes,material,receiveShadow] of [
    ['Sliding shop door glass',doorGlass,doorGlassMaterial,false],
    ['Original shop window glass',windowGlass,storefrontGlassMaterial,true]
  ]) {
    const batch = createGlassBatch(T,geometry.box,material,panes);
    batch.mesh.name = name;
    batch.mesh.receiveShadow = receiveShadow;
    scene.add(batch.mesh);
    viewUpdates.push(batch.update);
  }

  const stagingLods = [], standalonePools = [], poolBatches = [];
  const shopNear = new Map();
  let contactBatch;
  const glowParts = [];
  const lowCylinder = new T.CylinderGeometry(1, 1, 1, 12);
  const lowSphere = new T.SphereGeometry(1, 8, 5);
  const radius = (m, axis) => Math.hypot(...m.elements.slice(axis * 4, axis * 4 + 3));
  for (const batch of batches.values()) {
    if (expanded && batch.material === materials.glow && !batch.deckLod) {
      batch.transforms.forEach((transform,index) => {
        const piece = batch.geometry.clone().applyMatrix4(transform);
        piece.computeBoundingBox();
        glowParts.push({geometries:[piece],bounds:piece.boundingBox,slot:batch.slots?.[index]});
      });
      continue;
    }
    const surfaces = batch.surfaces && new T.InstancedBufferAttribute(new Float32Array(batch.surfaces), 2);
    const source = surfaces ? batch.geometry.clone().setAttribute('instanceSurface', surfaces) : batch.geometry;
    const playerContact = expanded && !batch.deckLod && batch.material === contact;
    const mesh = new T.InstancedMesh(source, batch.material, batch.transforms.length + Number(playerContact));
    if (playerContact) {
      mesh.count = batch.transforms.length;
      contactBatch = mesh;
    }
    if (batch.material === contact) placeDecal(mesh);
    if (batch.material === materials.lightPool) {
      placeDecal(mesh,-1);
      if (expanded) {
        // Standalone pools and the compact wash use the same linked variant.
        mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(batch.transforms.length*3).fill(1),3);
        standalonePools.push(mesh);
        poolBatches.push(batch);
      }
    }
    mesh.name = `${batch.type} ${batch.finish || batch.material.name}`;
    if (batch.material === contact) mesh.name = 'Mall contact shadows';
    if (batch.material === materials.lightPool) mesh.name = 'Mall floor and wall light pools';
    if (batch.material === materials.paving) {
      mesh.name = 'Mall ivory marble paving';
      pavingMesh = mesh;
      if (mappedPaving) mesh.material = mappedPaving;
    }
    for (const store of spatial.stores) {
      if (batch.material === materials[`${store.id}Backdrop`]) queueShopUpload(Number(store.number), mesh);
    }
    batch.transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    batch.colours?.forEach((colour, i) => mesh.setColorAt(i, colour));
    mesh.receiveShadow = batch.material !== materials.lightPool;
    mesh.userData.shopSlot = batch.shopSlot;
    mesh.userData.deckLod = batch.deckLod;
    if (batch.material === materials.glow) mesh.layers.enable(1);
    scene.add(mesh);
    if (batch.shopSlot !== null) shopLodMeshes.push(mesh);

    const isTimber = batch.type === 'cylinder' && batch.finish === 'woodGrain';
    const isMatteSphere = batch.type === 'sphere' && batch.finish === 'matte';
    let lod;
    if ((isTimber || isMatteSphere) && batch.shopSlot === null && !batch.deckLod) {
      lod = createProjectedBatch(T, mesh, isTimber ? lowCylinder : lowSphere,
        isTimber ? m => Math.max(radius(m, 0), radius(m, 2)) * (1 - Math.cos(Math.PI/12))
          : m => Math.max(radius(m, 0), radius(m, 1), radius(m, 2)) * (1 - Math.cos(Math.PI/8) * Math.cos(Math.PI/10)),
        batch.colours, batch.slots);
      stagingLods.push({original:mesh, lod});
    }
    const compact = !mesh.material.transparent || [materials.contact, materials.lightPool].includes(batch.material);
    const controller = expanded && compact ? createInstanceVisibility(T, mesh, {
      colours:batch.colours, slots:batch.slots, attributes:surfaces ? [surfaces] : []
    }) : null;
    const allow = batch.material === contact
      ? slot => slot === null || interiorKit.groups[slot-1]?.visible
      : slot => slot === null || shopNear.get(slot);
    viewUpdates.push(view => {
      if (lod?.mesh.parent) lod.update(view, batch.slots ? allow : undefined);
      else if (mesh.visible && controller) controller.update(view.frustum,batch.slots ? allow : undefined,
        false,view.shopVisibility.occluded);
    });
    if (batch.colours) colourBatches.push(() => {
      lod?.refreshColours();
      if (controller) controller.refreshColours();
    });
  }
  if (glowParts.length) {
    const glow = createPackedDraw(T,glowParts,materials.glow);
    glow.mesh.name = 'Mall fixture glow';
    glow.mesh.receiveShadow = true;
    glow.mesh.layers.enable(1);
    scene.add(glow.mesh);
    viewUpdates.push(view => glow.update(({bounds,slot}) =>
      (slot == null || shopNear.get(slot)) && view.frustum.intersectsBox(bounds) &&
      !view.shopVisibility.occluded(slot,bounds) ? 0 : -1));
  }
  lowCylinder.dispose();
  lowSphere.dispose();
  key.position.set(...(expanded ? [-12, 16, 6] : [-8, 15, 9]));
  key.castShadow = true;
  scene.add(ambient,key);
  const playerShadow = expanded ? createPlayerShadow(T,scene,key) : null;
  if (!expanded) {
    key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.5,far:50});
    key.shadow.normalBias = .05;
    key.shadow.bias = -.0004;
  }
  let bakedLighting, skylightDapple;
  if (expanded) {
    const holes = expandedLift ? [...bakedFloors,liftLayout.shaft] : bakedFloors;
    const publicFloor = holes.reduce((panels,hole) => panels.flatMap(panel => cutRectangle(panel,hole)),
      [expandedLayout.bounds]);
    if (expandedLift) {
      const {minX,maxX,minZ,maxZ} = liftLayout.roofOpening;
      const projection = {minX:minX+2,maxX:maxX+4,minZ:Math.max(.4,minZ),maxZ:maxZ-1};
      skylightDapple = createSkylightDapple(T,scene,{contact,prepareModel,projection,
        panels:cutRectangle(projection,liftLayout.shaft).map(rect => ({...rect,y:.026}))});
    }
    bakedLighting = createMallBakedLighting(T,scene,{contact,phone,prepareModel,
      floors:[...publicFloor.map(rect => ({...rect,y:.014})),...bakedFloors],ceilings:bakedCeilings,skylightDapple});
  }
  const fill = expanded ? null : new T.DirectionalLight(0xe9d8c2,.45);
  if (fill) { fill.position.set(4,8,-5); scene.add(fill); }
  const surfaceAtmosphere = expanded ? createMallSurfaceAtmosphere(T,scene,{
    plane:geometry.plane, poolMaterial:materials.lightPool, washes:atmosphereWashes, pools:poolBatches, shopNear,
    floors:[materials.shellFloor,materials.paving,materials.courtStone],
    fixtures:materials.glow, vault:materials.vaultOak
  }) : null;
  refreshInstanceColours();
  for (const {original, lod} of stagingLods) {
    const attach = () => {
      original.removeFromParent();
      original.dispose();
      scene.add(lod.mesh);
    };
    if (prepareModel) void prepareModel(lod.mesh, {late:false}).then(attach, () => lod.mesh.geometry.dispose());
    else attach();
  }
  const applyMallTheme = theme => {
    const applied = applyMallThemeToWorld(theme, {expanded, materials, ambient, key, fog:scene.fog});
    if (applied) {
      surfaceAtmosphere.setFixtureEmission(theme.materials.glowIntensity);
      storefrontGlassMaterial.color.copy(materials.glass.color);
      storefrontGlassMaterial.opacity = materials.glass.opacity;
      storefrontGlassMaterial.roughness = materials.glass.roughness;
      storefrontGlassMaterial.metalness = materials.glass.metalness;
      doorGlassMaterial.color.copy(materials.glass.color);
      doorGlassMaterial.opacity = materials.glass.opacity*.76;
      materials.skylightGlass.color.copy(materials.glass.color);
      materials.skylightGlass.opacity = materials.glass.opacity;
      materials.skylightGlass.roughness = materials.glass.roughness;
      materials.skylightGlass.metalness = materials.glass.metalness;
      refreshInstanceColours();
    }
    return applied;
  };
  sign('G O O D N E S S ,   A L L   A R O U N D', 0, 5.75, -.3, 10, .48);
  const signPoint = new T.Vector3();
  const signHUD = ['.site-header', '#mall-tools', '#keyboard-help', '#mall-map'].map(selector => document.querySelector(selector));
  function updateSigns(camera, canvas, reducedMotion) {
    signage?.update(camera,reducedMotion,performance.now());
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
  const eye = new T.Vector3(), projection = new T.Matrix4();
  const decalBounds = new T.Box3();
  const contactBounds = new T.Sphere(), savedContactBounds = new T.Sphere();
  function drawWithPlayerContact(shadow, draw) {
    if (!contactBatch || !shadow.visible) return draw();
    const {count, boundingSphere, instanceMatrix} = contactBatch;
    shadow.updateMatrix();
    contactBatch.setMatrixAt(count,shadow.matrix);
    instanceMatrix.clearUpdateRanges();
    instanceMatrix.addUpdateRange(0,(count+1)*16);
    instanceMatrix.needsUpdate = true;
    geometry.plane.boundingSphere ?? geometry.plane.computeBoundingSphere();
    savedContactBounds.copy(boundingSphere);
    boundingSphere.union(contactBounds.copy(geometry.plane.boundingSphere).applyMatrix4(shadow.matrix));
    contactBatch.count++;
    shadow.visible = false;
    try { return draw(); } finally {
      shadow.visible = true;
      contactBatch.count = count;
      boundingSphere.copy(savedContactBounds);
    }
  }
  const view = {frustum:new T.Frustum(), eye, shopVisibility};
  let deckLodMeshes=null;
  function updateShopLods(visitor, shadows = true, tier, camera, height, focus, lightWash, reducedMotion = false) {
    productDisplay?.setShadows(shadows);
    if (!expanded) {
      if (camera) {
        view.frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        updateFrames(view);
      }
      return;
    }
    // The render loop and context recovery both supply the resolved tier here.
    interactables.physicsProps?.setTier(tier);
    materials.glass.forceSinglePass = tier === 'low';
    shopVisibility.setOverheadCulling(tier === 'low');
    bakedLighting.setTier(tier);
    skylightDapple?.update(tier,reducedMotion);
    if (shadows && tier === 'detailed') playerShadow.update(visitor);
    if (surfaceAtmosphere.setTier(tier, lightWash) && mappedPaving) mappedPaving.roughness = materials.paving.roughness;
    uploadVisitor = visitor;
    if (camera) {
      view.camera = camera;
      view.pixelScale = camera.projectionMatrix.elements[5] * height / 2;
      view.shadows = shadows;
      view.focus = focus;
      eye.setFromMatrixPosition(camera.matrixWorld);
      shopVisibility.setEye(eye);
      view.frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    }
    restrooms?.updateDraw(camera && view.frustum);
    productDisplay?.updateShopLods(visitor, camera && view);
    interiorKit.update(visitor, camera && view);
    const deckVisible=Math.abs(visitor.y-liftLayout.upper)<3,shopDistance=12;
    view.deckVisible = deckVisible;
    view.low = tier === 'low';
    for (const [slot,bay] of shopBays) {
      const x = (bay.minX + bay.maxX) / 2;
      // The three occupied stores are visible through their north arcade doors.
      const z = slot <= 3 ? Math.min(bay.maxZ,Math.max(bay.minZ,visitor.z)) : (bay.minZ+bay.maxZ)/2;
      shopNear.set(slot, Math.hypot(visitor.x-x,visitor.y,visitor.z-z)<shopDistance);
    }
    for (const mesh of shopLodMeshes) {
      const slot = mesh.userData.shopSlot;
      if (!shopNear.has(slot)) continue;
      let near = shopNear.get(slot);
      if (near && camera && mesh.userData.shopDecal) {
        mesh.geometry.boundingBox ?? mesh.geometry.computeBoundingBox();
        mesh.updateWorldMatrix(true,false);
        near = !shopVisibility.occluded(slot,decalBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
      }
      mesh.visible = mesh.userData.shopLodNear = near;
      if (mesh.visible && !deckVisible) furnishings.loadShopDetails(slot);
    }
    if(!deckLodMeshes){deckLodMeshes=[];scene.traverse(mesh=>{if(mesh.userData.deckLod)deckLodMeshes.push(mesh);});}
    for(const mesh of deckLodMeshes)mesh.visible=deckVisible;
    for (const mesh of standalonePools) mesh.visible = tier !== 'low' && (!mesh.userData.deckLod || deckVisible);
    for (const update of shopLodUpdates) update(visitor, camera && view);
    additions?.update(tier,camera ? view : {deckVisible},shopNear);
    furnishings.updateView(camera ? view : {deckVisible},shopNear);
    if (camera) {
      for (const update of viewUpdates) update(view);
      surfaceAtmosphere.updateView(view);
      amenities.updateView(view);
      upperLevel?.updateView(view.frustum);
    }
  }
  const additions = expanded ? createInteriorAdditions(T,{scene,collider,seats,prepareModel,detailsEnabled,tier:artworkTier}) : null;
  interactables.push(...seats.map(seatInteraction));
  const firstFurnishing = shopLodMeshes.length;
  const furnishingState=furnishings.finish(scene,mesh=>shopLodMeshes.push(mesh),prepareModel);
  for (const mesh of shopLodMeshes.slice(firstFurnishing)) queueShopUpload(mesh.userData.shopSlot, mesh);
  for (const [slot, meshes] of shopUploads) {
    const bay = shopBays.get(slot);
    const x = (bay.minX + bay.maxX) / 2;
    const priority = () => uploadVisitor ? Math.abs(uploadVisitor.x - x) - 60 : -60;
    // These meshes already belong to the live shops. Early entry can reach
    // them before the background warm-up finishes, so keep their render layers.
    void prepareModel(meshes, {late:false, priority}).catch(() => {});
  }
  // The seating collider intentionally covers only the seat pan. Camera bounds
  // also cover the authored back and arms without blocking sit/stand routes.
  const cameraObstacles=ceilingObstacles.concat(shopObstacles,seats.map(seat=>seat.bounds));
  let upperWarmStatus=null,landingLights,upperFurniture;
  function prepareUpperLevel(){
    if(!upperLevel)return;
    const {group,panes,cabinMark}=upperLevel;
    const cabin=scene.getObjectByName('Expanded physical lift cabin');
    if(cabinMark.parent!==cabin)cabin?.add(cabinMark);
    if(!warmModel)return;
    // Match the landing's zero shop accents even while the player is downstairs.
    landingLights??=new T.Scene();
    landingLights.children=[ambient,key];
    landingLights.fog=scene.fog;landingLights.environment=scene.environment;
    landingLights.environmentIntensity=scene.environmentIntensity;
    if(upperWarmStatus==='pending'||upperWarmStatus==='ready')return;
    upperWarmStatus='pending';
    void warmModel([group,panes,cabinMark],landingLights,{
      late:false,priority:()=>-100,linear:()=>false
    }).then(()=>{upperWarmStatus='ready';},error=>{
      upperWarmStatus='interrupted';console.warn('Upper level GPU warmup interrupted',error);
    });
  }
  function prepareUpperFurniture() {
    if (!upperLevel) return;
    prepareUpperLevel();
    upperFurniture ??= loadUpperFurniture(T).then(records => upperLevel.installFurniture(records, prepareModel))
      .catch(error => console.warn('Upper level furniture unavailable', error));
  }
  let brandWallPromise=null;
  function ensureBrandWall(){
    if(!expanded)return Promise.reject(new Error('Brand wall is only available in the expanded mall'));
    if(!brandWallPromise)brandWallPromise=import('./brand-wall.js').then(({addBrandWallAtlas})=>addBrandWallAtlas(
      T,scene,liftLayout.upper,prepareModel,artworkTier)).then(result=>{
      interactables.push(...result.interactables);
      deckLodMeshes?.push(result.mesh);
      return result;
    });
    return brandWallPromise;
  }
  reserveProduct = registerPhysicsProps(T, R, physics, {
    scene, interactables, reserveProduct, expanded, phone, prepareModel, interiors: interiorKit,
    initialTier: artworkTier()
  });
  return {signage, defaultExposure:EVERYDAY.lighting.exposure, interiors:interiorKit, restrooms, shopExhibits:expanded ? {...newMoonExhibit, ...miliExhibit, ...gogoExhibit, ...borschExhibit, ...pzhExhibit, ...shopCatalogueExhibits} : {}, getPreloadedModels() { return interiorModels?.getPreloadedModels() || []; }, get modelPreload() {
    const preload=interiorModels?.preloadState;
    return preload ? {...preload, sceneModels:Object.fromEntries(['Gallery lift directory standee','Gallery atrium chandelier'].map(name => [name,scene.getObjectByName(name)?.userData.sourceStatus || 'pending']))} : null;
  }, scene, bakedLighting, doors, seats, shell: shellState, cameraObstacles, amenities:amenities.state, interactables, shelves, createCollectProp, reserveProduct, contact, plane, roomSigns, updateSigns, updateShopLods, drawWithPlayerContact, applyMallTheme, ensureBrandWall, prepareUpperLevel, prepareUpperFurniture, get upperWarmStatus(){return upperWarmStatus;}, furnishings: Object.freeze({...furnishingState,...additions?.state}), productAssets: Object.freeze(worldProductAssets)};
}
