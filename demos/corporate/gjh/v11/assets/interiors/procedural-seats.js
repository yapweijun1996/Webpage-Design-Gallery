import {createSeatAnchor} from '../seat-placements.js';
import {radians, worldInteriorPoint} from './config.js';
import {seatCushionRatios} from './decoration.js';

const shopSeats = {
  'S08-leftmid': {name:'SKIPPY breakfast chair', frontDistance:.7, cameraOffsetDeg:-60},
  'S13-backleft': {name:'Sony felt listening chair', frontDistance:.7, cameraOffsetDeg:75},
  'S14-leftmid': {name:'LG ivory sofa', frontDistance:.95},
  'S14-leftfront': {name:'LG velvet ottoman', exitLocal:[-1.483351,2.724601], feetHang:true},
  'S15-backleft': {name:'Casio audience chair', exitLocal:[-2.85,-.8], cameraOffsetDeg:-60}
};

export function createProceduralSeat(store, footprint, collider) {
  const placement = shopSeats[footprint.seat?.id];
  if (!placement) return null;
  const fixture = store.props.find(prop => prop.socket === footprint.seat.socket);
  const [x,y,z] = fixture.position_m;
  const [width,height,depth] = fixture.envelope_whd_m;
  const yaw = radians(fixture.yaw_deg);
  const floorY = store.frame.floor_surface_y_m;
  const [worldX,floor,worldZ] = worldInteriorPoint(store,[x,floorY,z]);
  // Unobstructed approaches follow the fixture's +Z. Offset exits follow the clear aisle.
  const [standX,standZ] = placement.exitLocal ?? [
    x+placement.frontDistance*Math.sin(yaw), z+placement.frontDistance*Math.cos(yaw)
  ];
  const [exitX,,exitZ] = worldInteriorPoint(store,[standX,floorY,standZ]);
  const top = y-floorY + height*(seatCushionRatios.centreHeight + seatCushionRatios.thickness/2);
  return createSeatAnchor({
    id:footprint.seat.id, name:placement.name, x:worldX, z:worldZ, floor,
    exit:{x:exitX,y:floor,z:exitZ}, accessible:true,
    pose:{angle:radians(store.frame.yaw_world_deg)+yaw-Math.PI,facing:1,
      cameraOffset:radians(placement.cameraOffsetDeg ?? 0),feetHang:placement.feetHang},
    clearance:{interactionRadius:.7,capsuleRadius:.3,colliderWidth:width,colliderDepth:depth}
  }, collider, {size:fixture.envelope_whd_m,top,seatCentre:0,front:-depth/2}, 1);
}
