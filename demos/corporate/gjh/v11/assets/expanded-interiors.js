import {createPackedDraw, mergeOpaqueMeshes} from './packed-draw.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {buildWindowStudio, shopLamp} from './window-studios.js';
import {buildLateShopAnchorDetails} from './shop-anchor-details-last.js';
import {interiorFloorColour,interiorStores} from './interiors/config.js';
import {setupMaterialArtwork} from './artwork-textures.js';
import {westShopPlacements} from './gallery-west-shops.js';
import {eastShopPlacements,gigasetLoungeSofa,gigasetSofaFallback} from './gallery-east-shops.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {parseWarmGLTF} from './gltf-warmup.js';

// All exports use metres, a floor-centred origin and local +Z as the front.
const displayFiles = {
  4:['pharmacy-counter'], 5:['pharmacy-counter'], 13:['speaker-soundbar'],
  14:['tv-demo-table', 'tv-floor-stand'],
  15:['electronic-keyboard'], 16:['battery-display-rack'], 17:['cordless-phone-display']
};

const galleryPlacements = {...westShopPlacements, ...eastShopPlacements};

// Meter dimensions use the original GLB bounds. Register footprints at scene
// creation, so late-loading furnishings cannot appear around a visitor.
const floorModelSize = {
  'medicine-health-box-set':[.60,1.70,.35], 'instant-noodle-pack-display':[.80,1.80,.40],
  'stacked-can-pyramid':[1.20,1.80,1.20], 'peanut-butter-jar-stand':[.80,1.02,.50],
  'shelf-food-aisle':[1.20,1.80,.50], 'food-display-cabinet':[1.25,1.29,.70],
  'headphone-display-stand':[.60,1.40,.40], 'refrigerator':[.63,1.88,.76],
  'grand-piano':[1.50,1.82,2.35], 'shelf-electronics-display':[1.20,1.80,.45],
  'lounge-sofa-bench':[3,.80,1.50]
};

function displayPlacements(number, heroX, heroZ) {
  if (number === 14) return [[heroX-.55, .07, heroZ, .65], [heroX+.7, .07, heroZ, .8]];
  const height = number === 13 || number === 17 ? .94 : .07;
  const scale = number === 17 ? 1.5 : number === 13 || number === 15 || number === 16 ? 1.3 : .7;
  return [[heroX, height, heroZ, scale]];
}

// Furniture is vertex-coloured and merged; model displays load in the background.
// Coordinates inside each bay have the glazed front on local +Z.
export async function createExpandedInteriors(T, expandedLayout, scene, stoneMap, prepareModel = () => {}, shopVisibility, artworkTier = () => 'low', detailsEnabled = () => true, waitForSlice) {
  const slots = expandedLayout.slots.filter(slot => Number(slot.number) >= 4 && Number(slot.number) <= 17);
  const material = new T.MeshStandardMaterial({vertexColors:true, roughness:.65});
  const woodFinishes = new Set([0xb18356,0x66412f,0x69442c,0x8b5a38,0xb28a5c,0xc59d69,0x8e4d35,0x66482f,0x604534,0x694635,0xaa8464]);
  // Illuminated shelving and lamps share a draw call with the cabinets. A
  // per-vertex mask gives the light strips emission without fourteen lights.
  material.onBeforeCompile = shader => {
    if (stoneMap) shader.uniforms.shopStone = {value:stoneMap};
    shader.vertexShader = 'attribute float shopGlow; attribute vec3 finishPosition; varying float vShopGlow; varying vec3 vFinishPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvShopGlow=shopGlow;vFinishPosition=finishPosition;');
    shader.fragmentShader = (stoneMap ? 'uniform sampler2D shopStone;\n' : '') +
      'varying float vShopGlow; varying vec3 vFinishPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      if(vShopGlow < -1.5 && vShopGlow > -2.5){
        ${stoneMap ? 'diffuseColor.rgb *= texture2D(shopStone, vFinishPosition.xz * vec2(.72,.86)).rgb;' : ''}
      } else if(vShopGlow < -.5 && vShopGlow > -1.5){
        vec3 p=vFinishPosition;
        float grain=p.y*38.+p.z*2.7+p.x*1.5+1.9*sin(p.x*2.+p.z*1.6)+.65*sin(p.y*8.+p.x*.6);
        float fibre=.5+.5*sin(grain+1.8*sin(grain*.24));
        diffuseColor.rgb*=.88+.15*fibre+.07*sin(p.y*4.+p.z*.5);
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance += max(0.,vShopGlow) * vec3(.88,.52,.23);\n' +
      'if(vShopGlow < -2.5) totalEmissiveRadiance += diffuseColor.rgb * .38;');
  };
  const studioParts = [];
  const shops = [], collisionBoxes = [];
  let gigasetSeatBox;
  const models = new Map(), loadedScenes = new Map(), gltfLoader = new GLTFLoader();
  const modelStates = new Map(slots.flatMap(slot => {
    const number=Number(slot.number);
    return [...(displayFiles[number] || []).map(file => `./${file}.glb`), ...galleryPlacements[number].map(({file}) => `./${file}`)];
  }).map(name => [name, 'pending']));
  function loadModel(name) {
    if (!models.has(name)) {
      modelStates.set(name,'loading');
      const url = new URL(name, import.meta.url), controller = new AbortController();
      let timer, abandoned = false;
      const load = async () => {
        const response = await fetch(url, {signal:controller.signal});
        if (!response.ok) throw new Error(`Model request failed: ${response.status}`);
        const gltf = await parseWarmGLTF(gltfLoader, await response.arrayBuffer(), new URL('.',url).href, waitForSlice, controller.signal);
        if (abandoned) {
          gltf.scene.traverse(node => {
            if (!node.isMesh) return;
            node.geometry?.dispose();
            for (const material of (Array.isArray(node.material) ? node.material : [node.material])) material?.dispose();
          });
          throw new Error('Model load timed out');
        }
        const materials = new Set();
        gltf.scene.traverse(mesh => {
          if (mesh.isMesh) for (const material of [].concat(mesh.material)) materials.add(material);
        });
        for (const material of materials) setupMaterialArtwork(T,material,artworkTier());
        return gltf.scene;
      };
      const deadline = new Promise((_,reject) => {
        timer=setTimeout(() => { abandoned=true; controller.abort(); reject(new Error('Model load timed out')); },45000);
      });
      models.set(name, Promise.race([load(),deadline]).then(scene => { modelStates.set(name,'loaded'); loadedScenes.set(name,scene); return scene; }, error => { modelStates.set(name,'fallback'); throw error; }).finally(() => clearTimeout(timer)));
    }
    return models.get(name);
  }
  const ivory = 0xeee4d1, green = 0x526e5b, gold = 0xc6a66b;
  const creamStone = n => n===13 || n===15 || n===17 ? 0x55483f : 0xe5d6bb;
  const accents = {4:0x785a68, 5:0x913f35, 6:0x667887, 7:0x9c4937, 8:0x477aac,
    9:0x294f7c, 10:0x478c86, 11:0x843e43, 12:0x6f9690, 13:0x33383b,
    14:0x665079, 15:0x292725, 16:0x4b9993, 17:0x62696a};

  slots.forEach(slot => {
    const number = Number(slot.number), side = slot.side;
    const width = side === 'north' ? slot.maxX-slot.minX : slot.maxZ-slot.minZ;
    const depth = side === 'north' ? slot.maxZ-slot.minZ : slot.maxX-slot.minX;
    const group = new T.Group();
    group.name = `S${slot.number} interior`;
    group.position.set((slot.minX+slot.maxX)/2, 0, (slot.minZ+slot.maxZ)/2);
    group.rotation.y = side === 'west' ? Math.PI/2 : side === 'east' ? -Math.PI/2 : 0;
    const front = depth/2;
    let parts = [];
    let geometryXOffset = 0, replaced = false;
    function add(geometry, x, y, z, color, finish = color===shopLamp ? 1 : woodFinishes.has(color) ? -1 : 0) {
      if (replaced) { geometry.dispose(); return; }
      geometry.translate(x + geometryXOffset, y, z);
      const c = new T.Color(color), colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i=0; i<colors.length; i+=3) { colors[i]=c.r; colors[i+1]=c.g; colors[i+2]=c.b; }
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      geometry.setAttribute('finishPosition', geometry.attributes.position.clone());
      geometry.setAttribute('shopGlow', new T.BufferAttribute(
        new Float32Array(geometry.attributes.position.count).fill(finish), 1));
      parts.push(geometry);
    }
    function box(x,y,z,w,h,d,color,finish) { add(new T.BoxGeometry(w,h,d),x,y,z,color,finish); }
    function cylinder(x,y,z,r,h,color) { add(new T.CylinderGeometry(r,r,h,12),x,y,z,color); }
    function block(x,y,z,w,h,d) {
      const a = group.rotation.y, c = Math.cos(a), sn = Math.sin(a);
      const box = {
        x:group.position.x+x*c+z*sn, y, z:group.position.z-x*sn+z*c,
        width:w*Math.abs(c)+d*Math.abs(sn), height:h, depth:w*Math.abs(sn)+d*Math.abs(c),
        ...(replaced && {replacedDisplay:true})
      };
      collisionBoxes.push(box);
      return box;
    }
    const tools = {
      block,
      opaqueWall(x,y,z,w,h,d,color) {
        box(x,y,z,w,h,d,color);
        const a = group.rotation.y, c = Math.cos(a), s = Math.sin(a);
        shopVisibility?.addWall(number,group.position.x+x*c+z*s,y,group.position.z-x*s+z*c,
          w*Math.abs(c)+d*Math.abs(s),h,w*Math.abs(s)+d*Math.abs(c));
      },
      replaceDisplay(build) {
        // Retain the solid envelopes while the room kit owns their surfaces.
        replaced = true;
        try { build(); } finally { replaced = false; }
      },
      surface(points, triangles, color) {
        const panel = new T.BufferGeometry();
        panel.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
        // Untextured relief panels share the same vertex format as the cabinet batch.
        panel.setAttribute('uv', new T.BufferAttribute(new Float32Array(points.length * 2), 2));
        panel.setIndex(triangles);
        panel.computeVertexNormals();
        add(panel, 0, 0, 0, color);
      },
      ellipse(x,y,z,rx,ry,rz,c,turn,lean) {
        add(new T.SphereGeometry(1,10,6).scale(rx,ry,rz).rotateZ(lean).rotateY(turn),x,y,z,c);
      },
      tapered(x,y,z,rt,rb,h,c) {add(new T.CylinderGeometry(rt,rb,h,16),x,y,z,c);},
      ring(x,y,z,r,w,c){add(new T.TorusGeometry(r,w,6,40).rotateX(Math.PI/2),x,y,z,c);},
      box, column:cylinder,
      disc(x,y,z,r,d,c) {
        add(new T.CylinderGeometry(r,r,d,24).rotateX(Math.PI/2),x,y,z,c);
      },
      bar(x1,y1,z1,x2,y2,z2,w,c) {
        const direction = new T.Vector3(x2-x1,y2-y1,z2-z1);
        const rod = new T.BoxGeometry(w,direction.length(),w);
        rod.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));
        add(rod,(x1+x2)/2,(y1+y2)/2,(z1+z2)/2,c);
      },
      arch(x,y,z,r,leg,w,c) {
        for(const side of [-1,1]) tools.box(x+side*r,y+leg/2,z,w,leg,w,c);
        const curve = new T.TorusGeometry(r,w/2,6,24,Math.PI);
        add(curve,x,y+leg,z,c);
      }
    };
    buildWindowStudio(number, tools, width, depth, interiorFloorColour(interiorStores['S'+slot.number]));
    buildLateShopAnchorDetails(number, tools, width, depth);
    group.updateMatrix();
    function addStudioParts(geometries, visible) {
      for (const geometry of geometries) {
        geometry.applyMatrix4(group.matrix);
        geometry.computeBoundingBox();
        studioParts.push({geometries:[geometry], bounds:geometry.boundingBox, visible, number});
      }
    }
    addStudioParts(parts);
    parts = [];
    const heroOffset = side === 'north' ? 3 : 2.55;
    geometryXOffset = heroOffset;
    // The merchandise fixture sits inside a window, clear of the doorway.
    const heroZ = front - 1;
    block(heroOffset,1.47,heroZ,2.18,2.94,1.16);
    box(0,.12,heroZ,2.06,.22,.98,creamStone(number));
    // Narrow uprights and a picture light frame the hero without obscuring the room.
    for (const x of [-1.04,1.04]) cylinder(x,1.63,heroZ-.46,.023,2.57,gold);
    box(0,2.92,heroZ-.46,2.12,.065,.095,gold);
    box(0,2.875,heroZ-.46,2.02,.022,.065,shopLamp);
    if (!displayFiles[number] || number === 13 || number === 17) {
      box(0,.47,heroZ,2.1,.9,1.05,number===8?0x213969:creamStone(number));
      box(0,.95,heroZ,2.2,.08,1.15,ivory);
    }
    const fixtureParts = parts;
    parts = [];
    const accent = accents[number];
    if (number >= 7 && number <= 11) {
      // A stocked window case reads as grocery packaging while keeping each
      // illustrative item smaller than a shopper's hand, as in the references.
      for (let row=0;row<3;row++) for(let i=0;i<5-row;i++) {
        const x=(i-(4-row)/2)*.24, y=1.13+row*.24;
        cylinder(x,y,heroZ,.108,.215,number===8?0xc79b65:row%2?ivory:accent);
        cylinder(x,y+.115,heroZ,.111,.025,number===8?accent:gold);
      }
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
    function localBounds(geometries) {
      const bounds = new T.Box3();
      for (const geometry of geometries) {
        geometry.computeBoundingBox();
        bounds.union(geometry.boundingBox);
      }
      return bounds;
    }
    hero.userData.fixtureBounds = localBounds(fixtureParts);
    hero.userData.fallbackBounds = localBounds(parts);
    hero.userData.fallbackVisible = true;
    group.add(hero);
    let loadDisplay, display, loaded = false;
    addStudioParts(fixtureParts, () => group.visible);
    addStudioParts(parts, () => group.visible && (!loaded || !display?.visible));
    if (files) {
      display = new T.Group();
      display.visible = false;
      loadDisplay = () => {
        const placements = displayPlacements(number, heroOffset, heroZ);
        return Promise.all(files.map(name => loadModel(`./${name}.glb`))).then(async scenes => {
          scenes.forEach((model, i) => {
            const instance = model.clone(true);
            const [x, y, z, scale] = placements[i];
            instance.position.set(x, y, z);
            instance.scale.setScalar(scale);
            instance.name = `S${slot.number} ${files[i]}`;
            mergeOpaqueMeshes(T, instance);
            display.add(instance);
          });
          // The LOD controller can select this display before it finishes loading.
          await prepareModel(display);
          hero.add(display);
          loaded = true;
          hero.userData.modelReady = true;
          hero.userData.fallbackVisible = !display.visible;
        }).catch(() => {
          // Keep the procedural display if a model is unavailable.
        });
      };
    }
    group.visible = false;
    scene.add(group);
    const loadHero = loadDisplay;
    const placements = galleryPlacements[number];
    geometryXOffset = 0;
    let sofaMounted = false;
    for(const placement of placements) {
      const {file,position:[x,y,z],yaw=0,scale=1} = placement;
      const size=floorModelSize[file.split('/').pop().replace(/\.glb$/,'')];
      if(!size) continue; // Countertop pack displays share their supporting island.
      const [w,h,d]=size.map(value=>value*scale);
      const c=Math.abs(Math.cos(yaw)), sn=Math.abs(Math.sin(yaw));
      const footprint=block(x,y+h/2,z,c*w+sn*d,h,sn*w+c*d);
      if (placement === gigasetLoungeSofa) {
        gigasetSeatBox = footprint;
        parts = [];
        for (const {center,size,color} of gigasetSofaFallback) {
          const geometry = new T.BoxGeometry(...size).translate(...center).scale(scale,scale,scale).rotateY(yaw);
          add(geometry,x,y,z,color);
        }
        addStudioParts(parts, () => group.visible && !sofaMounted);
      }
    }
    // Secondary furnishings belong to the bay, so they remain visible when a
    // visitor looks across adjoining windows and the nearest hero changes.
    const shopState = {number:String(slot.number), status:'pending', galleryLoaded:0, galleryFailed:0};
    const gallery = [];
    async function loadShop() {
      await Promise.all([
        loadHero?.(),
        ...placements.map(async placement => {
          const {file,position,yaw=0,scale=1} = placement;
          try {
            const model = (await loadModel(`./${file}`)).clone(true);
            model.position.set(...position);
            model.rotation.y = yaw;
            model.scale.setScalar(scale);
            model.name = `S${slot.number} gallery: ${file}`;
            mergeOpaqueMeshes(T, model);
            await prepareModel(model);
            group.add(model);
            model.updateWorldMatrix(true,true);
            gallery.push({model, bounds:new T.Box3().setFromObject(model)});
            if (placement === gigasetLoungeSofa) sofaMounted = true;
            shopState.galleryLoaded++;
          } catch (error) {
            shopState.galleryFailed++;
            console.warn(`Unavailable shop furnishing: ${file}`, error);
          }
        })
      ]);
    }
    shops.push({group, hero, number, gallery, x:group.position.x, z:group.position.z, display, isLoaded:() => loaded,
      loadDisplay: loadShop, state:shopState});
  });
  const studioBatch = createPackedDraw(T, studioParts, material);
  studioBatch.mesh.name = 'Concourse window studios';
  scene.add(studioBatch.mesh);
  let loading = false, scheduled = false, lastVisitor = null;
  function schedulePrefetch() {
    if (!detailsEnabled()) return;
    if (loading || scheduled) return;
    const candidates = shops.filter(shop => shop.loadDisplay);
    if (!candidates.length) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      if (document.hidden) return;
      const next = shops.filter(shop => shop.loadDisplay)
        .sort((a,b) => lastVisitor ? Math.hypot(lastVisitor.x-a.x,lastVisitor.z-a.z)-Math.hypot(lastVisitor.x-b.x,lastVisitor.z-b.z) : 0)[0];
      if (!next) return;
      loading = true;
      const load = next.loadDisplay; next.loadDisplay = null; next.state.status='loading';
      load().catch(error => console.warn('Shop preload failed',error)).finally(() => { next.state.status='settled'; loading = false; schedulePrefetch(); });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, {timeout: 1500});
    else window.setTimeout(run, 100);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedulePrefetch(); });
  schedulePrefetch();
  return {collisionBoxes,gigasetSeatBox,getPreloadedModels() { return [...loadedScenes].map(([name,scene]) => ({name:new URL(name,import.meta.url).href,scene})); }, get preloadState() {
    return {models:Object.fromEntries(modelStates), shops:shops.map(shop => ({...shop.state})),
      settled:shops.filter(shop => shop.state.status==='settled').length, total:shops.length};
  }, update(visitor, view) {
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
      for (const {model,bounds} of shop.gallery) {
        model.visible = !view || bounds.isEmpty() || !shopVisibility?.occluded(shop.number,bounds);
      }
      if (!shop.display) continue;
      const active = shop === nearest;
      shop.display.visible = active;
      shop.hero.userData.fallbackVisible = !active || !shop.isLoaded();
    }
    studioBatch.update(part => {
      if (part.visible && !part.visible()) return -1;
      if (!view) return 0;
      return view.frustum.intersectsBox(part.bounds) && !shopVisibility?.occluded(part.number,part.bounds) ? 0 : -1;
    });
    schedulePrefetch();
  }};
}
