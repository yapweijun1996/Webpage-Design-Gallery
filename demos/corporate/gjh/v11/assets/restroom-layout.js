export const restroomParcel = Object.freeze({minX:21,maxX:29,minZ:6,maxZ:14});
export const restroomRoof = Object.freeze({
  min:Object.freeze({x:restroomParcel.minX,y:2.85,z:restroomParcel.minZ}),
  max:Object.freeze({x:restroomParcel.maxX,y:2.95,z:restroomParcel.maxZ})
});
export const restroomArrival = Object.freeze({x:31.4,z:10,yaw:Math.PI/2});
export const restroomRooms = Object.freeze([
  Object.freeze({id:'restroom-men',label:'Men',sign:'MEN  ·  男厕  ·  LELAKI',minZ:6,maxZ:8.5,doorWidth:1.27}),
  Object.freeze({id:'restroom-women',label:'Women',sign:'WOMEN  ·  女厕  ·  WANITA',minZ:8.5,maxZ:11,doorWidth:1.27}),
  Object.freeze({id:'restroom-accessible',label:'Accessible restroom',sign:'ACCESSIBLE RESTROOM',minZ:11,maxZ:14,doorWidth:1.55})
]);

export function restroomAt(x,z) {
  if (x <= restroomParcel.minX || x >= restroomParcel.maxX) return null;
  return restroomRooms.find(room=>z>room.minZ && z<room.maxZ) ?? null;
}
