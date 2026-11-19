export const slotCapacity = 24;
export const atlasSize = 2048;
export const lowAtlasSize = 1024;
export const atlasGutter = 8;

// RGBA8, including the complete mip chain down to 1x1.
export function atlasMiB(size) {
  return +((4 * size * size - 1) / 3 * 4 / 1048576).toFixed(2);
}
export function atlasCells(index) {
  if (!Number.isInteger(index) || index<0 || index>=slotCapacity) throw RangeError('Sign atlas holds 24 lots');
  // Three rows of posters below twelve sign rows. The baked edge texels fill
  // the gutters so the first few mip levels never sample an adjacent tile.
  const x = index%2*1024, row = Math.floor(index/2)*112;
  const inset = (x,y,w,h) => ({x:x+atlasGutter,y:y+atlasGutter,w:w-2*atlasGutter,h:h-2*atlasGutter});
  return {
    fascia:inset(x,row,864,112),
    blade:inset(x+864,row,160,112),
    poster:inset(index%8*256,1344+Math.floor(index/8)*232,256,232)
  };
}
// The plate is also the lower enamel insert on each blade.
export function plateRect(blade) {
  return {x:blade.x+blade.w*.30,y:blade.y+blade.h*.729,w:blade.w*.40,h:blade.h*.19};
}
