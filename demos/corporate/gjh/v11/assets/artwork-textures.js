const anisotropyFor = tier => tier === 'low' ? 2 : 4;

// Only colour artwork uses this policy. GLB data maps retain their authored sampling.
export function setupArtworkTexture(T, texture, tier = 'low', {mipmaps = 'generate', fixedTier = false} = {}) {
  if (!texture || texture.isCompressedTexture || texture.isRenderTargetTexture) return texture;
  texture.colorSpace = T.SRGBColorSpace;
  texture.premultiplyAlpha = false;
  texture.generateMipmaps = mipmaps === 'generate';
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.anisotropy = anisotropyFor(tier);
  texture.userData.artworkMipmaps = mipmaps;
  texture.userData.artworkFixedTier = fixedTier;
  texture.needsUpdate = true;
  return texture;
}

// Three keys GPU storage by sampler state. Call this inside the upload slice
// immediately before initTexture, so a live draw cannot trigger an upload.
export function setArtworkTextureTier(texture, tier) {
  if (tier === undefined || texture.userData?.artworkMipmaps !== 'generate' || texture.userData.artworkFixedTier) return;
  const anisotropy = anisotropyFor(tier);
  if (texture.anisotropy === anisotropy) return;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
}

export function setupMaterialArtwork(T, material, tier) {
  for (const map of new Set([material?.map, material?.emissiveMap])) {
    if (map?.isTexture && !map.userData.artworkMipmaps) setupArtworkTexture(T,map,tier);
  }
}

// Wall photographs need a wider footprint at grazing angles, where even the
// high-tier anisotropy cannot fully cover the projected texels.
export function filterWallArtwork(T, material) {
  material.onBeforeCompile = shader => {
    for (const [chunk, sample] of [['map_fragment','map, vMapUv'], ['emissivemap_fragment','emissiveMap, vEmissiveMapUv']]) {
      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <${chunk}>`, T.ShaderChunk[chunk].replace(sample, `${sample}, 0.65`));
    }
  };
  return material;
}

// Extend the edge texels into the guard band before the atlas is downsampled.
export function extrudeArtworkGutter(context, {x,y,w,h}, padding) {
  const sheet = context.canvas;
  for (const [sx,sy,sw,sh,dx,dy,dw,dh] of [
    [x,y,1,h,x-padding,y,padding,h], [x+w-1,y,1,h,x+w,y,padding,h],
    [x-padding,y,w+2*padding,1,x-padding,y-padding,w+2*padding,padding],
    [x-padding,y+h-1,w+2*padding,1,x-padding,y+h,w+2*padding,padding]
  ]) context.drawImage(sheet,sx,sy,sw,sh,dx,dy,dw,dh);
}
