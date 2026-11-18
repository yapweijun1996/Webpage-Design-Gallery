export const slotCapacity = 24;
export const atlasSize = 2048;
export const lowAtlasSize = 1024;

// RGBA8, including the complete mip chain down to 1x1.
export function atlasMiB(size) {
  return +((4 * size * size - 1) / 3 * 4 / 1048576).toFixed(2);
}
export function atlasCells(index) {
  if (!Number.isInteger(index) || index<0 || index>=slotCapacity) throw RangeError('Sign atlas holds 24 lots');
  // Three rows of posters below twelve sign rows. Gutters isolate level-zero sampling.
  const x = index%2*1024, row = Math.floor(index/2)*112;
  return {
    fascia:{x:x+3,y:row+3,w:861,h:106},
    blade:{x:x+870,y:row+3,w:150,h:106},
    poster:{x:index%8*256+3,y:1344+Math.floor(index/8)*232+3,w:250,h:226}
  };
}
// The plate is also the lower enamel insert on each blade.
export function plateRect(blade) {
  return {x:blade.x+blade.w*.30,y:blade.y+blade.h*.729,w:blade.w*.40,h:blade.h*.19};
}
