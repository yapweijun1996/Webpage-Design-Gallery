// Shared static, texture-free PBR batching; preserve each source surface.
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
export function opaqueBatch(T,parts,shadows){
  if(!parts.length)return null;
  const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());geometry.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide});
  // These pinned sources have solid PBR colours and no maps. Carry their original
  // roughness and metalness per vertex instead of spending one draw per material.
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 obSurface; varying vec2 vObSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nvObSurface=obSurface;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vObSurface;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vObSurface.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vObSurface.y;');
  };
  material.customProgramCacheKey=()=> 'mall-opaque-pbr-v1';
  const mesh=new T.Mesh(geometry,material);mesh.name='Opaque mall amenities';mesh.castShadow=shadows;mesh.receiveShadow=true;return mesh;
}
