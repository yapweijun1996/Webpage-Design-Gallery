import {galleryFixture, interiorStores, worldInteriorPoint} from './interiors/config.js';
import {createSeatAnchor} from './seat-placements.js';

export const gigasetLoungeSofa = galleryFixture('S17','leftfront','lounge-sofa-bench',.86);

const loungeContact = [-.95,.481,-.23];
const backlessCushion = {center:[.30,.40,.56], size:[1.58,.10,.35], color:0x9b8374};
// The baked cushion has a seam at x=.30. Use the middle of its aisle-side pad.
const backlessContact = [.10,backlessCushion.center[1]+backlessCushion.size[1]/2,backlessCushion.center[2]];

// Match the measured sofa, opposing bench and side table while the GLB is unavailable.
export const gigasetSofaFallback = [
  {center:[-.50,.29,-.23], size:[1.58,.32,.58], color:0x886f60},
  {center:[-.50,.432,-.23], size:[1.58,.098,.54], color:0x9b8374},
  {center:[-.50,.60,-.57], size:[1.59,.40,.21], color:0x886f60},
  {center:[-1.39,.37,-.23], size:[.20,.48,.74], color:0x886f60},
  {center:[.30,.29,.56], size:[1.58,.28,.35], color:0x886f60},
  backlessCushion,
  {center:[1.075,.45,.235], size:[.85,.10,.22], color:0x735442}
];

function createGigasetSeat(collider,footprint,{id,name,contact:[cx,cy,cz],exit,depth,frontDepth}) {
  const {position:[ox,oy,oz],yaw,scale} = gigasetLoungeSofa;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const point = (x,z) => worldInteriorPoint(interiorStores.S17,[ox+scale*(x*c+z*s),0,oz+scale*(-x*s+z*c)]);
  const [x,,z] = point(cx,cz);
  const [exitX,,exitZ] = point(...exit);
  const {world_origin_m:origin,floor_surface_y_m:surface,yaw_world_deg:shopYaw} = interiorStores.S17.frame;
  const floor = origin[1]+surface;
  const angle = shopYaw*Math.PI/180+yaw-Math.PI;
  return createSeatAnchor({id,name,x,z,floor,accessible:true,exit:{x:exitX,y:floor,z:exitZ},pose:{angle,facing:1},
    clearance:{interactionRadius:.7,capsuleRadius:.3,colliderWidth:footprint.width,colliderDepth:footprint.depth}
  },collider,{size:[1.58*scale,footprint.height,depth*scale],top:oy-surface+cy*scale,seatCentre:0,front:-frontDepth*scale},1);
}

export function createGigasetLoungeSeat(collider,footprint) {
  // Use the aisle end of the sofa to clear the retained footprint and the opposing bench.
  return createGigasetSeat(collider,footprint,{id:'gigaset-lounge-sofa',name:'Gigaset lounge sofa',
    contact:loungeContact,exit:[-1.95,1.12],depth:.58,frontDepth:.282});
}

export function createGigasetBacklessSeat(collider,footprint) {
  return createGigasetSeat(collider,footprint,{id:'gigaset-backless-bench',name:'Gigaset backless bench',
    contact:backlessContact,exit:[.33,1.50],depth:backlessCushion.size[2],frontDepth:backlessCushion.size[2]/2});
}

export function hasGigasetSeatCushions(T,scene) {
  scene.updateMatrixWorld(true);
  const ray = new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,.08);
  return [loungeContact,backlessContact].every(([x,y,z])=>{
    ray.ray.origin.set(x,y+.04,z);
    const [contact] = ray.intersectObject(scene,true);
    return contact && Math.abs(contact.point.y-y)<.006;
  });
}

// Bay-local metres, floor-centred origins. The storefront faces local +Z.
export const eastShopPlacements = {
  12: [{file:'gallery-assets/medicine-health-box-set.glb', position:[-2.24, 0.081, 2.92], yaw:0.11, scale:1.14}],
  13: [galleryFixture('S13','leftfront','headphone-display-stand',1.2)],
  14: [{file:'gallery-assets/refrigerator.glb', position:[-2.48, 0.081, 2.58], yaw:0.08, scale:1.03}],
  15: [{file:'gallery-assets/grand-piano.glb', position:[-2.3, 0.081, 2.47], yaw:0.22, scale:0.93}],
  16: [{file:'gallery-assets/shelf-electronics-display.glb', position:[-2.13, 0.081, 2.81], yaw:0.12, scale:0.96}],
  17: [gigasetLoungeSofa],
};
