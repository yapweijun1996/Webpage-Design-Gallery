// Expanded coordinates use worldX = planX - 25, worldZ = 48 - planY.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const liftLayout = freeze({
  x:-3, z:10, upper:7.2,
  shaft:{minX:-5,maxX:-1,minZ:8,maxZ:12},
  slab:{minX:-9,maxX:3,minZ:4,maxZ:16},
  roofOpening:{minX:-16,maxX:10,minZ:-3,maxZ:23},
  cabin:{width:3.2,depth:3.2},
  threshold:{minX:-5,maxX:-4.6,minZ:9,maxZ:11},
  exit:{x:-6.4,z:10}, radius:1.15,
  directory:{x:-5,z:45}, desk:{x:25,z:45}, showcase:{x:-7,z:18},
  facilities:{minX:21,maxX:29,minZ:6,maxZ:14,status:'planned'},
});
// Four disjoint panels cover the source rectangle except its intersection with a cutout.
export function cutRectangle(rect, hole) {
  const x0=Math.max(rect.minX,hole.minX),x1=Math.min(rect.maxX,hole.maxX);
  const z0=Math.max(rect.minZ,hole.minZ),z1=Math.min(rect.maxZ,hole.maxZ);
  if(x0>=x1||z0>=z1)return [{...rect}];
  return [
    {minX:rect.minX,maxX:x0,minZ:rect.minZ,maxZ:rect.maxZ},
    {minX:x1,maxX:rect.maxX,minZ:rect.minZ,maxZ:rect.maxZ},
    {minX:x0,maxX:x1,minZ:rect.minZ,maxZ:z0},
    {minX:x0,maxX:x1,minZ:z1,maxZ:rect.maxZ},
  ].filter(r=>r.maxX>r.minX&&r.maxZ>r.minZ);
}
export function showcaseProducts(items,expanded) {
  if(!expanded)return items;
  return items.map(item=>({...item,position:[
    liftLayout.showcase.x+item.position[0]+7,item.position[1],liftLayout.showcase.z+item.position[2]-2.2
  ]}));
}
