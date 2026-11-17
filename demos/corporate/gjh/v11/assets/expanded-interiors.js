import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {buildWindowStudio} from './window-studios.js';
import {loadBrandKit} from './shop-signs.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

// All exports use metres, a floor-centred origin and local +Z as the front.
const displayFiles = {
  4:['pharmacy-counter'], 5:['pharmacy-counter'], 13:['speaker-soundbar'],
  14:['tv-demo-table', 'tv-floor-stand'],
  15:['electronic-keyboard'], 16:['battery-display-rack'], 17:['cordless-phone-display']
};

function displayPlacements(number, heroX, heroZ) {
  if (number === 14) return [[heroX-.55, .07, heroZ, .65], [heroX+.7, .07, heroZ, .8]];
  const height = number === 13 || number === 17 ? .94 : .07;
  const scale = number === 17 ? 1.5 : number === 13 || number === 15 || number === 16 ? 1.3 : .7;
  return [[heroX, height, heroZ, scale]];
}

// Furniture is vertex-coloured and merged; model displays are prefetched near a bay.
// Coordinates inside each bay have the glazed front on local +Z.
export async function createExpandedInteriors(T, expandedLayout, scene) {
  const slots = expandedLayout.slots.filter(slot => Number(slot.number) >= 4 && Number(slot.number) <= 17);
  const loader = new T.TextureLoader().setCrossOrigin(undefined);
  const [kit, textures] = await Promise.all([
    loadBrandKit(),
    Promise.all(slots.map(slot => loader.loadAsync(new URL(`./brand-kit/S${slot.number}-hero.webp`, import.meta.url).href)))
  ]);
  const material = new T.MeshStandardMaterial({vertexColors:true, roughness:.78, emissive:0x30281b, emissiveIntensity:.22});
  const studioParts = [], posterParts = [];
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = 2048;
  const atlasContext = atlas.getContext('2d');
  const shops = [];
  const models = new Map(), gltfLoader = new GLTFLoader();
  function loadModel(name) {
    if (!models.has(name)) {
      models.set(name, gltfLoader.loadAsync(new URL(`./${name}.glb`, import.meta.url).href)
        .then(gltf => gltf.scene));
    }
    return models.get(name);
  }
  const ivory = 0xeee4d1, green = 0x526e5b, gold = 0xc6a66b;
  const accents = {4:0x785a68, 5:0x913f35, 6:0x667887, 7:0x9c4937, 8:0x477aac,
    9:0x294f7c, 10:0x478c86, 11:0x843e43, 12:0x6f9690, 13:0x33383b,
    14:0x665079, 15:0x292725, 16:0x4b9993, 17:0x62696a};

  slots.forEach((slot, index) => {
    const number = Number(slot.number), side = slot.side;
    const width = side === 'north' ? slot.maxX-slot.minX : slot.maxZ-slot.minZ;
    const depth = side === 'north' ? slot.maxZ-slot.minZ : slot.maxX-slot.minX;
    const group = new T.Group();
    group.name = `S${slot.number} interior`;
    group.position.set((slot.minX+slot.maxX)/2, 0, (slot.minZ+slot.maxZ)/2);
    group.rotation.y = side === 'west' ? Math.PI/2 : side === 'east' ? -Math.PI/2 : 0;
    const front = depth/2;
    let parts = [];
    let heroOffset = 0;
    function add(geometry, x, y, z, color) {
      geometry.translate(x + heroOffset, y, z);
      const c = new T.Color(color), colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i=0; i<colors.length; i+=3) { colors[i]=c.r; colors[i+1]=c.g; colors[i+2]=c.b; }
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      parts.push(geometry);
    }
    function box(x,y,z,w,h,d,color) { add(new T.BoxGeometry(w,h,d),x,y,z,color); }
    function cylinder(x,y,z,r,h,color) { add(new T.CylinderGeometry(r,r,h,12),x,y,z,color); }
    const leftPane = -(width/4+.4), stageZ = front-1.92;
    const tools = {
      box:(x,y,z,w,h,d,c) => box(x+leftPane,y,z+stageZ,w,h,d,c),
      column:(x,y,z,r,h,c) => cylinder(x+leftPane,y,z+stageZ,r,h,c),
      disc(x,y,z,r,d,c) {
        add(new T.CylinderGeometry(r,r,d,24).rotateX(Math.PI/2),x+leftPane,y,z+stageZ,c);
      },
      bar(x1,y1,z1,x2,y2,z2,w,c) {
        const direction = new T.Vector3(x2-x1,y2-y1,z2-z1);
        const rod = new T.BoxGeometry(w,direction.length(),w);
        rod.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));
        add(rod,leftPane+(x1+x2)/2,(y1+y2)/2,stageZ+(z1+z2)/2,c);
      },
      arch(x,y,z,r,leg,w,c) {
        for(const side of [-1,1]) tools.box(x+side*r,y+leg/2,z,w,leg,w,c);
        const curve = new T.TorusGeometry(r,w/2,6,24,Math.PI);
        add(curve,x+leftPane,y+leg,z+stageZ,c);
      }
    };
    const palette = kit[`S${slot.number}`].palette.map(colour => colour.hex);
    buildWindowStudio(number, palette, tools, width, -leftPane);
    group.updateMatrix();
    for (const part of parts) studioParts.push(part.applyMatrix4(group.matrix));
    parts = [];
    heroOffset = side === 'north' ? 3 : 2.55;
    // The merchandise fixture sits inside a window, clear of the doorway.
    const heroZ = front - 1;
    box(0,1.7,heroZ-.5,2.1,2.45,.10,accents[number]);
    if (!displayFiles[number] || number === 13 || number === 17) {
      box(0,.47,heroZ,2.1,.9,1.05,green);
      box(0,.95,heroZ,2.2,.08,1.15,ivory);
    }
    const fixtureParts = parts;
    parts = [];
    const accent = accents[number];
    if (number >= 7 && number <= 11) {
      cylinder(0,1.5,heroZ,.37,1.05,number===8?0xd6b778:ivory);
      cylinder(0,2.04,heroZ,.38,.09,accent);
      box(0,1.53,heroZ+.375,.56,.38,.025,accent);
    } else if (number === 14) {
      box(0,1.64,heroZ,1.65,.95,.12,0x20292d);
      box(0,1.64,heroZ+.07,1.48,.78,.025,0x506e78);
      box(0,1.1,heroZ,.12,.19,.2,0x34383a);
    } else if (number === 15) {
      box(0,1.38,heroZ,1.85,.74,.65,0x282522);
      box(0,1.78,heroZ+.18,1.72,.07,.37,ivory);
      for (let i=-6;i<=6;i++) box(i*.125,1.83,heroZ+.09,.045,.05,.17,0x262626);
    } else if (number === 13) {
      box(0,1.42,heroZ,.16,.83,.18,accent);
      box(0,1.84,heroZ,.85,.12,.18,accent);
      box(-.39,1.58,heroZ,.12,.46,.2,accent);
      box(.39,1.58,heroZ,.12,.46,.2,accent);
    } else if (number === 17) {
      box(0,1.12,heroZ,.8,.24,.6,accent);
      box(0,1.59,heroZ,.35,.83,.19,ivory);
      box(0,1.73,heroZ+.11,.22,.2,.025,accent);
      for (let i=-1;i<=1;i++) for (let j=0;j<3;j++) box(i*.07,1.52-j*.08,heroZ+.11,.035,.035,.02,accent);
    } else if (number === 16) {
      cylinder(0,1.5,heroZ,.35,.19,ivory);
      cylinder(0,1.61,heroZ,.16,.035,accent);
    } else {
      box(0,1.57,heroZ,.73,1.18,.35,ivory);
      box(0,1.59,heroZ+.19,.56,.46,.03,accent);
      box(0,2.19,heroZ,.73,.07,.36,gold);
    }
    const files = displayFiles[number];
    const hero = new T.Group();
    hero.name = `S${slot.number} hero display`;
    hero.userData.modelReady = !files;
    const fixture = new T.Mesh(mergeGeometries(fixtureParts), material);
    fixtureParts.forEach(part => part.dispose());
    hero.add(fixture);
    group.add(hero);
    let loadDisplay, display, loaded = false;
    const fallback = new T.Mesh(mergeGeometries(parts), material);
    parts.forEach(part => part.dispose());
    fallback.name = `S${slot.number} display fallback`;
    hero.add(fallback);
    if (files) {
      display = new T.Group();
      display.visible = false;
      hero.add(display);
      loadDisplay = () => {
        const placements = displayPlacements(number, heroOffset, heroZ);
        return Promise.all(files.map(loadModel)).then(scenes => {
          scenes.forEach((model, i) => {
            const instance = model.clone(true);
            const [x, y, z, scale] = placements[i];
            instance.position.set(x, y, z);
            instance.scale.setScalar(scale);
            instance.name = `S${slot.number} ${files[i]}`;
            display.add(instance);
          });
          loaded = true;
          hero.userData.modelReady = true;
          fallback.visible = !display.visible;
        }).catch(() => {
          // Keep the procedural display if a model is unavailable.
        });
      };
    }
    // Keep the right-hand product artwork visible across the concourse as
    // well. All fourteen panels use one atlas and one draw call.
    const column = index % 4, row = Math.floor(index / 4);
    const image = textures[index].image, cell = atlas.width / 4;
    atlasContext.fillStyle = palette[0];
    atlasContext.fillRect(column*cell,row*cell,cell,cell);
    const posterWidth = side === 'north' ? 2.75 : 2.25, posterHeight = 1.85;
    const aspect = image.width/image.height, panelAspect = posterWidth/posterHeight;
    const w = cell*Math.min(1,aspect/panelAspect), h = cell*Math.min(1,panelAspect/aspect);
    atlasContext.drawImage(image,column*cell+(cell-w)/2,row*cell+(cell-h)/2,w,h);
    textures[index].dispose();
    const poster = new T.PlaneGeometry(posterWidth,posterHeight);
    const uv = poster.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,(column+.004+uv.getX(i)*.992)/4,(3-row+.004+uv.getY(i)*.992)/4);
    poster.translate(heroOffset,2.16,heroZ-.42).applyMatrix4(group.matrix);
    posterParts.push(poster);
    group.visible = false;
    scene.add(group);
    shops.push({group, x:group.position.x, z:group.position.z, display, fallback,
      isLoaded: () => loaded, loadDisplay});
  });
  const scenery = new T.Mesh(mergeGeometries(studioParts), material);
  scenery.name = 'Concourse window studios';
  scene.add(scenery);
  const art = new T.CanvasTexture(atlas);
  art.colorSpace = T.SRGBColorSpace;
  const pictures = new T.Mesh(mergeGeometries(posterParts), new T.MeshBasicMaterial({map:art}));
  pictures.name = 'Concourse window artwork';
  scene.add(pictures);
  for(const part of [...studioParts,...posterParts]) part.dispose();
  let loading = false, scheduled = false, lastVisitor = null;
  function schedulePrefetch() {
    if (loading || scheduled || !lastVisitor) return;
    const candidates = shops.filter(shop => shop.loadDisplay && Math.hypot(lastVisitor.x-shop.x, lastVisitor.z-shop.z) < 25);
    if (!candidates.length) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      if (!lastVisitor || document.hidden) return;
      const next = shops.filter(shop => shop.loadDisplay && Math.hypot(lastVisitor.x-shop.x, lastVisitor.z-shop.z) < 25)
        .sort((a,b) => Math.hypot(lastVisitor.x-a.x,lastVisitor.z-a.z)-Math.hypot(lastVisitor.x-b.x,lastVisitor.z-b.z))[0];
      if (!next) return;
      loading = true;
      const load = next.loadDisplay; next.loadDisplay = null;
      load().finally(() => { loading = false; schedulePrefetch(); });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, {timeout: 1500});
    else window.setTimeout(run, 100);
  }
  return {update(visitor) {
    lastVisitor = {x:visitor.x, z:visitor.z};
    let nearest = null, nearestDistance = 11*11;
    for (const shop of shops) {
      const dx=visitor.x-shop.x, dz=visitor.z-shop.z, distance=dx*dx+dz*dz;
      shop.group.visible = Math.abs(visitor.y) < 5 && distance < 17*17;
      if (shop.group.visible && distance < nearestDistance) {
        nearest = shop;
        nearestDistance = distance;
      }
    }
    for (const shop of shops) {
      if (!shop.display) continue;
      const active = shop === nearest;
      shop.display.visible = active;
      shop.fallback.visible = !active || !shop.isLoaded();
    }
    schedulePrefetch();
  }};
}
