import {placeDecal} from './surface-decals.js';
import {expandedLayout} from './expanded-layout.js';

// XZ bounds of the authored shell, shared with the offline rasterizer.
const {minX,maxX,minZ,maxZ} = expandedLayout.bounds;
export const bakeAtlasSplit = .5;
export const bakeAtlasGutter = .015625;

// Generate planar UVs in world metres once. The geometry is a single identity
// instance so the decals use the same program as the existing contact batch.
function createLayer(T, panels, material, ceiling, projection) {
  const positions = [], uv = [], indices = [], normals = [];
  const span = bakeAtlasSplit - 2*bakeAtlasGutter;
  const start = (ceiling ? bakeAtlasSplit : 0) + bakeAtlasGutter;
  for (const {minX:x0,maxX:x1,minZ:z0,maxZ:z1,y} of panels) {
    const first = positions.length / 3;
    for (const [x,z] of [[x0,z0],[x0,z1],[x1,z1],[x1,z0]]) {
      positions.push(x,y,z);
      normals.push(0,ceiling ? -1 : 1,0);
      const row = start + (z-minZ)/(maxZ-minZ)*span;
      if (projection) {
        uv.push((x-projection.minX)/(projection.maxX-projection.minX),
          1-(z-projection.minZ)/(projection.maxZ-projection.minZ));
      } else uv.push((x-minX)/(maxX-minX),1-row);
    }
    for (const index of ceiling ? [0,2,1,0,3,2] : [0,1,2,0,2,3]) indices.push(first+index);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  const mesh = placeDecal(new T.InstancedMesh(geometry,material,1),-3);
  mesh.setMatrixAt(0,new T.Matrix4());
  mesh.name = ceiling ? 'Mall baked ceiling lighting' : 'Mall baked floor lighting';
  mesh.visible = false;
  return mesh;
}

export function createMallBakedLighting(T, scene, {floors, ceilings, contact, phone, prepareModel, skylightDapple,
  load = url => new T.TextureLoader().loadAsync(url)
}) {
  const material = contact.clone();
  const floor = createLayer(T,floors,material,false), ceiling = createLayer(T,ceilings,material,true);
  scene.add(floor,ceiling);
  const atlasSize = tier => phone || tier === 'low' ? 1024 : 2048;
  const materials = new Map(), requests = new Map();
  let currentTier = 'low';
  function apply() {
    // A desktop upgrade can keep the warmed floor visible during the fetch.
    const warmed = materials.get(atlasSize(currentTier)) ?? materials.get(1024);
    if (warmed) floor.material = ceiling.material = warmed;
    floor.visible = Boolean(warmed);
    ceiling.visible = Boolean(warmed) && currentTier !== 'low';
  }
  function prepare(tier) {
    void skylightDapple?.prepare();
    const size = atlasSize(tier);
    if (!requests.has(size)) {
      const url = new URL(`mall-light-ao-${size}.webp`,import.meta.url).href;
      const request = Promise.resolve().then(() => load(url)).then(async atlas => {
        atlas.generateMipmaps = false;
        atlas.minFilter = T.LinearFilter;
        const stagingMaterial = contact.clone();
        stagingMaterial.map = atlas;
        const samples = [floor,ceiling].map(mesh => {
          const sample = mesh.clone();
          sample.material = stagingMaterial;
          return sample;
        });
        try {
          // Use the shared upload budget and retain the authored fallback
          // lighting while this optional texture is decoded and uploaded.
          await prepareModel?.(samples,{late:false,includeInSceneSweep:false,fence:true,priority:() => 100});
          materials.set(size,stagingMaterial);
          apply();
        } catch {
          atlas.dispose();
          stagingMaterial.dispose();
        } finally {
          for (const sample of samples) sample.dispose();
        }
      }).catch(() => {});
      requests.set(size,request);
    }
    return requests.get(size);
  }
  function setTier(tier) {
    const next = tier ?? 'low';
    if (next === currentTier && requests.has(atlasSize(next))) return;
    currentTier = next;
    // During the initial entry, prepareTier can prefetch the requested tier
    // before it becomes the active profile.
    void prepare(currentTier);
    apply();
  }
  return {prepare,setTier};
}

// The atlas adds sunlit panes and leaves their mottled shadows clear.
// Blending is render state, so this still uses the contact decal program.
export function createSkylightDapple(T, scene, {panels, projection, contact, prepareModel,
  load = url => new T.TextureLoader().loadAsync(url)
}) {
  const material = contact.clone();
  material.blending = T.AdditiveBlending;
  const mesh = createLayer(T,panels,material,false,projection);
  mesh.name = 'Atrium skylight tree shadow';
  mesh.renderOrder = -2;
  scene.add(mesh);
  let request, map;
  function prepare() {
    request ??= Promise.resolve().then(async () => {
      const texture = await load(new URL('mall-skylight-dapple-512.png',import.meta.url).href);
      texture.colorSpace = T.SRGBColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.generateMipmaps = false;
      texture.minFilter = T.LinearFilter;
      material.map = texture;
      try {
        // A contact decal has no lighting variants. Warm one binding in
        // the shared queue ahead of the larger optional room textures.
        await prepareModel?.(mesh,{
          late:false,includeInSceneSweep:false,priority:() => -10,
          linear:() => false,lighting:undefined
        });
        map = texture;
        mesh.visible = currentTier !== 'low';
      } catch {
        material.map = contact.map;
        texture.dispose();
      }
    }).catch(() => {});
    return request;
  }
  let currentTier;
  function update(tier, reducedMotion, now = performance.now()) {
    currentTier = tier;
    if (!map) return;
    mesh.visible = tier !== 'low';
    const drift = (tier === 'balanced' || tier === 'detailed') && !reducedMotion ? now : 0;
    map.offset.set(.008*Math.sin(drift/67000), .006*Math.sin(drift/59000));
  }
  return {prepare,update};
}
