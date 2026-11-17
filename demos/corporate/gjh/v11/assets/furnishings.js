// Optional furniture; opaque surfaces are merged before instancing across placements.
import {loadStaticAsset} from './static-asset.js';
import {opaqueBatch} from './opaque-batch.js';
import {INTERIOR_PILOT} from './interior-pilot-registry.js';

const pilotSources = Object.freeze(Object.fromEntries(Object.entries(INTERIOR_PILOT).filter(([kind]) => kind !== 'shelf')));

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

export async function createFurnishings(T, shadows, expanded = false) {
  const sources = expanded ? {...pilotSources, ...shopSources} : pilotSources;
  const records = {};
  const pendingByShop = new Map();
  const group = new T.Group();
  group.name = 'Blender furnishings';
  let registerMesh;
  async function load(kind) {
    const definition = sources[kind], record = records[kind];
    record.status = 'loading';
    Object.assign(record, await loadStaticAsset(T, definition, import.meta.url));
    record.sourcePrimitiveCount=record.primitives.length;
    if(record.status==='loaded'&&(['bench','planter','coffeeTable','storeSign','wallLight'].includes(kind) || Object.hasOwn(shopSources,kind))){
      const opaque=record.primitives.filter(primitive=>primitive.material.emissive?.getHex()===0);
      const emissive=record.primitives.filter(primitive=>primitive.material.emissive?.getHex()!==0);
      if(opaque.length>1)record.primitives=[...batchFurniture(T,opaque),...emissive];
    }
  }
  await Promise.all(Object.keys(sources).map(kind => {
    records[kind] = {status:'pending', reason:null, primitives:[], placements:[], sourcePrimitiveCount:0};
    if (!Object.hasOwn(shopSources, kind) || kind === 'barStool') return load(kind);
  }));

  function mount(kind) {
    const record = records[kind];
    const placementsBySlot=new Map();
    for(const placement of record.placements){
      if(!placementsBySlot.has(placement.shopSlot))placementsBySlot.set(placement.shopSlot,[]);
      placementsBySlot.get(placement.shopSlot).push(placement);
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
        else if(shopSlot!==null){mesh.userData.shopSlot=shopSlot;registerMesh(mesh);}
        group.add(mesh);
      }
    }
  }

  return {
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
      for (const kind of kinds) {
        void load(kind).then(() => mount(kind));
      }
    },
    finish(scene,onShopLodMesh=()=>{}) {
      registerMesh = onShopLodMesh;
      const state = {};
      for (const [kind, record] of Object.entries(records)) {
        if (record.status === 'pending') {
          const slot = record.placements[0]?.shopSlot;
          if (slot != null) {
            if (!pendingByShop.has(slot)) pendingByShop.set(slot, []);
            pendingByShop.get(slot).push(kind);
          }
        } else mount(kind);
        state[kind] = Object.freeze({
          assetId:sources[kind].asset_id, identity:sources[kind].sha256, dimensions:sources[kind].dimensions_m,
          instances:record.placements.length, get status(){return record.status;},
          get reason(){return record.reason;}, get primitives(){return record.sourcePrimitiveCount;}
        });
      }
      scene.add(group);
      return Object.freeze(state);
    }
  };
}
