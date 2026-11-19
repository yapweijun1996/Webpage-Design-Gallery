// Shared static, texture-free PBR batching; preserve each source surface.
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
export function opaqueSurfaceMaterial(T) {
  const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide});
  // These pinned sources have solid PBR colours and no maps. Carry their original
  // roughness and metalness per vertex instead of spending one draw per material.
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 obSurface; varying vec2 vObSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nvObSurface=obSurface;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vObSurface;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vObSurface.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vObSurface.y;');
  };
  material.customProgramCacheKey=()=> 'mall-opaque-pbr-v1';
  return material;
}

export function opaqueBatch(T,parts,shadows){
  if(!parts.length)return null;
  const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());geometry.computeBoundingSphere();
  const material=opaqueSurfaceMaterial(T);
  const mesh=new T.Mesh(geometry,material);mesh.name='Opaque mall amenities';mesh.castShadow=shadows;mesh.receiveShadow=true;return mesh;
}

// These pinned, texture-free surfaces are opaque and non-emissive. Merge them
// once while retaining their PBR values and per-shop visibility.
export function batchFurniture(T, primitives) {
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
      surface[i*2] = material.roughness;
      surface[i*2+1] = material.metalness;
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
