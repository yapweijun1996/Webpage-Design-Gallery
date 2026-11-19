import {createSeatAnchor} from '../seat-placements.js';

export function gogoStoolSeat(frame, stool, collider, modelPlaced) {
  const [ox,,oz] = frame.world_origin_m;
  const [x,,z] = stool.position_m;
  const [sx,sz] = stool.standing;
  // The GLB cushion tops at .778 m. The procedural cushion tops at .78 m.
  const profile = {size:stool.envelope_whd_m, top:modelPlaced ? .778 : .78, seatCentre:0, front:-.1};
  const [width,,depth] = profile.size;
  return createSeatAnchor({
    id:stool.id, name:'GOGO bar stool', x:ox+x, z:oz+z, floor:0, accessible:true,
    exit:{x:ox+sx,y:0,z:oz+sz}, pose:{angle:Math.PI/2,facing:0},
    clearance:{interactionRadius:.52,capsuleRadius:.3,colliderWidth:width,colliderDepth:depth}
  },collider,profile,1);
}
