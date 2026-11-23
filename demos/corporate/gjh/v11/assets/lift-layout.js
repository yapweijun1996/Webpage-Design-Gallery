import {restroomParcel} from './restroom-layout.js';

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
  facilities:{...restroomParcel,status:'open'},
});
// The ground-floor comb is east of the upper landing. All values are world metres.
export const escalatorLayout = freeze({
  z:9, width:1.6, clearWidth:1.34, upperEdge:liftLayout.slab.maxX,
  upperFlat:4, lowerFlat:17.3, lowerEdge:18.5, exitX:2.30, rise:liftLayout.upper,
  speed:1, stepCount:50
});
export function escalatorHeight(x) {
  const e=escalatorLayout;
  return e.rise*Math.max(0,Math.min(1,(e.lowerFlat-x)/(e.lowerFlat-e.upperFlat)));
}
export function deckEdgeSpans(x) {
  const {slab}=liftLayout, e=escalatorLayout;
  return x===slab.maxX ? [[slab.minZ,e.z-e.width/2],[e.z+e.width/2,slab.maxZ]] : [[slab.minZ,slab.maxZ]];
}
export const shaftFinish=Object.freeze({
  west:liftLayout.shaft.minX-.27,east:liftLayout.shaft.maxX+.18,
  north:liftLayout.shaft.minZ-.11,south:liftLayout.shaft.maxZ+.11,height:3.84
});

// An orbit above the cabin roof can still put its opaque shell between the
// lens and the visitor. Keep deck-side chase views on the visitor's side.
const shaft=liftLayout.shaft;
const upperCameraBoundary=[{min:{x:shaftFinish.west-.12,y:liftLayout.upper,z:shaftFinish.north-.04},
  max:{x:shaftFinish.east+.05,y:Infinity,z:shaftFinish.south+.04}}];
// Inside the docked car, sweep against its inner walls and ceiling. The
// open west end still allows the camera to follow the visitor through the door.
const cabinCameraBounds=[];
const {x:carX,z:carZ,upper:carFloor,cabin}=liftLayout;
const halfW=cabin.width/2,halfD=cabin.depth/2;
function carBound(x0,z0,x1,z1,bottom,top){
  cabinCameraBounds.push({min:{x:x0,y:carFloor+bottom,z:z0},max:{x:x1,y:carFloor+top,z:z1}});
}
for(const side of [-1,1]){
  const z=carZ+side*(halfD-.1);
  carBound(carX-halfW,z,carX+halfW,z,0,2.92);
}
carBound(carX+halfW-.1,carZ-halfD,carX+halfW-.1,carZ+halfD,0,2.92);
carBound(carX-halfW,carZ-halfD,carX+halfW,carZ+halfD,2.84,2.92);
export function insideLiftShaft({x,z}){
  return x>=shaft.minX && x<=shaft.maxX && z>=shaft.minZ && z<=shaft.maxZ;
}
export function upperLiftCameraBounds(position){
  return insideLiftShaft(position) ? cabinCameraBounds : upperCameraBoundary;
}

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
