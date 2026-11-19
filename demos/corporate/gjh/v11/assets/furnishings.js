// Optional furniture; opaque surfaces are merged before instancing across placements.
import {loadStaticAsset} from './static-asset.js';
import {createInstanceVisibility, createProjectedBatch} from './packed-draw.js';
import {opaqueBatch} from './opaque-batch.js';
import {INTERIOR_PILOT} from './interior-pilot-registry.js';
import {INTERIOR_ADDITIONS} from './interior-additions-registry.js';

// Placed additions load with the pilot set; reserved ones stay registered but unmounted.
const placedAdditions = Object.fromEntries(Object.entries(INTERIOR_ADDITIONS).filter(([, asset]) => asset.placed));
const pilotSources = Object.freeze({...Object.fromEntries(Object.entries(INTERIOR_PILOT).filter(([kind]) => kind !== 'shelf')), ...placedAdditions});

const shopSources = Object.freeze({
  barStool: {
    asset_id:'ASSET_MallBarStool', file:'gogo-bar-stool.glb',
    sha256:"c4546f8de005aef723c7fd2a175e0b6544b26277792c985eb85d8ffe2aa4b3b3", dimensions_m:[.48,1.04,.48], rootExtras:{units:'metres'}
  },
  teaCup: {
    asset_id:'ASSET_KopitiamSaucerAndCup', file:'kopitiam-saucer-and-cup.glb',
    sha256:'61dfd3673a88072c1d152d3dde91f3e1fcc09579b6ac70090ead8b319769f7d7', dimensions_m:[0.156, 0.088, 0.156], rootExtras:{units:'metres'}
  },
  teaKettle: {
    asset_id:'ASSET_KopitiamKettle', file:'kopitiam-kettle.glb',
    sha256:'fef5f8192497110031216cbcdfe143b5dba6ba9362a9613154beb46259db953a', dimensions_m:[0.4041, 0.36, 0.27], rootExtras:{units:'metres'}
  },
  pantryRack: {
    asset_id:'ASSET_CondimentBottleJarSet', file:'condiment-bottle-jar-set.glb',
    sha256:'5e1eac9c16e1c38057ba0363d5f38d95bf78a79113743df126316f64df56008c', dimensions_m:[0.9, 1.1, 0.35], rootExtras:{units:'metres'}
  },
  coffeeMachine: {
    asset_id:'ASSET_CoffeeMachine', file:'coffee-machine.glb',
    // Box3 encloses the rotated steam wand's local bounds; exact mesh width is 0.480 m.
    sha256:'155666679065cdec42f9b1f831bcc7b67959487a6f518e36f5d06925d90d2022', dimensions_m:[0.481056, 0.5045, 0.58], rootExtras:{units:'metres'}
  }
});

// These pinned, texture-free surfaces are opaque and non-emissive. Merge them
// once while retaining their PBR values and per-shop visibility.
function batchFurniture(T, primitives) {
  const parts=primitives.map(primitive=>{
    const source=primitive.geometry;
    const geometry=source.index?source.toNonIndexed():source.clone();
    geometry.applyMatrix4(primitive.matrix);
    const vertexColour = primitive.material.vertexColors && geometry.getAttribute('color');
    for(const name of Object.keys(geometry.attributes))if(name!=='position'&&name!=='normal')geometry.deleteAttribute(name);
    const count=geometry.attributes.position.count, colour=new Float32Array(count*3), surface=new Float32Array(count*2), material=primitive.material;
    for(let i=0;i<count;i++){
      colour[i*3] = material.color.r * (vertexColour ? vertexColour.getX(i) : 1);
      colour[i*3+1] = material.color.g * (vertexColour ? vertexColour.getY(i) : 1);
      colour[i*3+2] = material.color.b * (vertexColour ? vertexColour.getZ(i) : 1);
      surface.set([material.roughness,material.metalness],i*2);
    }
    geometry.setAttribute('color',new T.BufferAttribute(colour,3));
    geometry.setAttribute('obSurface',new T.BufferAttribute(surface,2));
    return geometry;
  });
  const mesh=opaqueBatch(T,parts,false);
  for(const geometry of new Set(primitives.map(primitive=>primitive.geometry)))geometry.dispose();
  for(const material of new Set(primitives.map(primitive=>primitive.material)))material.dispose();
  return [{geometry:mesh.geometry,material:mesh.material,matrix:new T.Matrix4()}];
}

// Collapse subpixel bevel steps within each finish, preserving the authored
// normals on surviving faces. Bound the change by the measured displacement.
export function simplifyBench(T, geometry) {
  const size = .012, {position, color, obSurface} = geometry.attributes;
  const keys = new Map(), remap = new Uint32Array(position.count);
  const index = [], result = geometry.clone();
  let error = 0;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const key = [Math.round(x/size),Math.round(y/size),Math.round(z/size),
      color?.getX(i),color?.getY(i),color?.getZ(i),obSurface?.getX(i),obSurface?.getY(i)].join(',');
    if (!keys.has(key)) keys.set(key, i);
    const first = remap[i] = keys.get(key);
    const rx = position.getX(first), ry = position.getY(first), rz = position.getZ(first);
    error = Math.max(error, Math.hypot(x-rx, y-ry, z-rz));
    result.attributes.position.setXYZ(i,rx,ry,rz);
  }
  const source = geometry.index;
  for (let i = 0; i < (source?.count ?? position.count); i += 3) {
    const a = source ? source.getX(i) : i;
    const b = source ? source.getX(i + 1) : i + 1;
    const c = source ? source.getX(i + 2) : i + 2;
    if (remap[a] !== remap[b] && remap[b] !== remap[c] && remap[a] !== remap[c]) index.push(a,b,c);
  }
  result.setIndex(index);
  return {geometry:result, error};
}

export async function createFurnishings(T, shadows, expanded = false) {
  const sources = expanded ? {...pilotSources, ...shopSources} : pilotSources;
  const records = {};
  const pendingByShop = new Map(), detailQueue = [];
  let detailLoading = false, detailScheduled = false;
  const group = new T.Group();
  group.name = 'Blender furnishings';
  const benchLods = [], staticBatches = [];
  let registerMesh, prepareModel;
  async function load(kind) {
    const definition = sources[kind], record = records[kind];
    record.status = 'loading';
    Object.assign(record, await loadStaticAsset(T, definition, import.meta.url));
    record.sourcePrimitiveCount=record.primitives.length;
    if(record.status==='loaded'&&(['bench','planter','coffeeTable','storeSign','wallLight',...Object.keys(placedAdditions)].includes(kind) || Object.hasOwn(shopSources,kind))){
      const opaque=record.primitives.filter(primitive=>primitive.material.emissive?.getHex()===0);
      const emissive=record.primitives.filter(primitive=>primitive.material.emissive?.getHex()!==0);
      if(opaque.length>1)record.primitives=[...batchFurniture(T,opaque),...emissive];
    }
  }
  await Promise.all(Object.keys(sources).map(kind => {
    records[kind] = {status:'pending', reason:null, primitives:[], placements:[], sourcePrimitiveCount:0};
    if (!Object.hasOwn(shopSources, kind) || kind === 'barStool') return load(kind);
  }));

  function mount(kind, prewarm) {
    const record = records[kind];
    const sharedLights = expanded && kind === 'wallLight';
    const placementsBySlot = new Map(), meshes = [];
    for (const placement of record.placements) {
      const slot = sharedLights ? null : placement.shopSlot;
      if (!placementsBySlot.has(slot)) placementsBySlot.set(slot, []);
      placementsBySlot.get(slot).push(placement);
    }
    for (const primitive of record.primitives) {
      for(const [shopSlot,placements] of placementsBySlot){
        const mesh = new T.InstancedMesh(primitive.geometry, primitive.material, placements.length);
        mesh.name = `${kind} primitive`;
        placements.forEach((placement, index) => mesh.setMatrixAt(index, new T.Matrix4().multiplyMatrices(placement.transform, primitive.matrix)));
        // Mounted trim uses existing light pools without adding shadow passes.
        mesh.castShadow = shadows && !['wallLight', 'storeSign'].includes(kind); mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        if(shopSlot===-1)mesh.userData.deckLod=true;
        else if(shopSlot!==null)mesh.userData.shopSlot=shopSlot;
        if (sharedLights) mesh.userData.lightSlots = placements.map(placement => placement.shopSlot);
        meshes.push(mesh);
      }
    }
    const attach = () => {
      for (const mesh of meshes) {
        if (mesh.userData.shopSlot !== undefined) registerMesh(mesh);
        group.add(mesh);
        if (expanded && kind === 'bench') {
          const distant = simplifyBench(T, mesh.geometry);
          const lod = createProjectedBatch(T, mesh, distant.geometry, matrix => distant.error * matrix.getMaxScaleOnAxis());
          distant.geometry.dispose();
          const compact = createInstanceVisibility(T, mesh);
          benchLods.push({mesh, compact, lod});
          const mountLod = () => {
            mesh.removeFromParent();
            lod.mesh.visible = false;
            group.add(lod.mesh);
          };
          if (prepareModel) void prepareModel(lod.mesh, {late:false}).then(mountLod, () => lod.mesh.geometry.dispose());
          else mountLod();
        } else if (expanded && !mesh.material.transparent) {
          const slots = mesh.userData.lightSlots;
          const compact = createInstanceVisibility(T, mesh, {slots,castShadow:mesh.castShadow});
          staticBatches.push({mesh, slots, compact});
        }
      }
    };
    if (sharedLights && prepareModel) prewarm = prepareModel;
    if (prewarm && meshes.length) {
      const staging = new T.Group().add(...meshes);
      return prewarm(staging).then(attach);
    }
    attach();
  }

  function scheduleDetails() {
    if (detailLoading || detailScheduled) return;
    if (!detailQueue.length && pendingByShop.size) {
      const [slot,kinds] = pendingByShop.entries().next().value;
      pendingByShop.delete(slot); detailQueue.push(...kinds);
    }
    if (!detailQueue.length) return;
    detailScheduled = true;
    const run = () => {
      detailScheduled = false;
      if (document.hidden) return;
      const kind = detailQueue.shift();
      if (!kind) return;
      detailLoading = true;
      load(kind).then(async () => {
        if (records[kind].status !== 'loaded') return;
        records[kind].status = 'loading';
        await mount(kind, prepareModel);
        records[kind].status = 'loaded';
      }).catch(error => { records[kind].status='fallback'; records[kind].reason='unavailable'; console.warn('Furniture preload failed',error); }).finally(() => {
        detailLoading = false; scheduleDetails();
      });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, {timeout:1500});
    else window.setTimeout(run,100);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleDetails(); });

  return {
    updateView(view, shopNear) {
      const lightNear = slot => slot === null || shopNear.get(slot);
      for (const {mesh, slots, compact} of staticBatches) {
        if (mesh.visible) compact.update(view.frustum, slots ? lightNear : undefined, view.shadows);
      }
      for (const {mesh, compact, lod} of benchLods) {
        const visible = mesh.userData.deckLod ? view.deckVisible : mesh.visible;
        if (!lod.mesh.parent) {
          mesh.visible = visible;
          if (visible) compact.update(view.shadows ? null : view.frustum);
          continue;
        }
        if (visible) lod.update(view);
        lod.mesh.visible = visible && lod.mesh.geometry.drawRange.count > 0;
      }
    },
    place(kind, x, z, height = 1, facing = 1, baseY = 0, yaw = null, shopSlot = null) {
      const record = records[kind];
      const transform = new T.Matrix4().compose(new T.Vector3(x, baseY, z),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw ?? (facing < 0 ? Math.PI : 0)),
        new T.Vector3(1, height, 1));
      record.placements.push({transform, shopSlot});
      return record.status === 'loaded' || record.status === 'pending';
    },
    loadShopDetails(shopSlot) {
      const kinds = pendingByShop.get(shopSlot);
      if (!kinds) return;
      pendingByShop.delete(shopSlot);
      detailQueue.unshift(...kinds);
      scheduleDetails();
    },
    finish(scene,onShopLodMesh=()=>{},prewarm) {
      registerMesh = onShopLodMesh;
      prepareModel = prewarm;
      const state = {};
      for (const [kind, record] of Object.entries(records)) {
        if (record.status === 'pending') {
          const slot = record.placements[0]?.shopSlot;
          if (slot != null) {
            if (!pendingByShop.has(slot)) pendingByShop.set(slot, []);
            pendingByShop.get(slot).push(kind);
          }
        } else void Promise.resolve(mount(kind)).catch(error => console.warn('Furniture preload failed',error));
        state[kind] = Object.freeze({
          assetId:sources[kind].asset_id, identity:sources[kind].sha256, dimensions:sources[kind].dimensions_m,
          instances:record.placements.length, get status(){return record.status;},
          get reason(){return record.reason;}, get primitives(){return record.sourcePrimitiveCount;}
        });
      }
      scene.add(group);
      scheduleDetails();
      return Object.freeze(state);
    }
  };
}
