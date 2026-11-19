// Ground-floor objects stay within the stage 1 planting and lounge reservations.
// Coordinates use the expanded shell's translated world space, in metres.
const point = (x,z) => Object.freeze({x,z});
const lounge = (id,x) => Object.freeze({
  id, x, z:24,
  seats:Object.freeze([point(x-1.7,24.5),point(x+1.7,24.5)]),
  table:point(x,24.5),
  planters:Object.freeze([point(x-2.35,27),point(x+2.35,27)])
});
export const atriumLayout = Object.freeze({
  // The pier straddles the shopfront. The adjoining studio wall ends at its back face.
  arcadePilaster:Object.freeze({inset:.03,depth:.45}),
  garden:Object.freeze({x:10,z:16,width:8,depth:3,height:.48}),
  lounges:Object.freeze([lounge('west',-4),lounge('east',24)]),
  facilitiesBlock:Object.freeze({x:25,z:10,width:6,depth:4,height:3}),
  upperSeats:Object.freeze([
    // Keep the west lift approach and perimeter aisle clear of the seat pan.
    Object.freeze({x:-6.65,z:12.55,facing:1,finish:'oak'}),
    Object.freeze({x:.1,z:8.8,facing:1,finish:'slats'}),
    Object.freeze({x:-3,z:6,facing:-1,finish:'upholstered'})
  ]),
  // Reserved for a future removable installation; no stage 4 object occupies it.
  event:Object.freeze({minX:3,maxX:17,minZ:24,maxZ:32})
});
