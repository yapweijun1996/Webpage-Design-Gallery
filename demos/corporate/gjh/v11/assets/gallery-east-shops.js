import {galleryFixture, interiorStores, worldInteriorPoint} from './interiors/config.js';
import {createSeatAnchor} from './seat-placements.js';

export const gigasetLoungeSofa = galleryFixture('S17','leftfront','lounge-sofa-bench',.86);

// Match the measured sofa, opposing bench and side table while the GLB is unavailable.
export const gigasetSofaFallback = [
  {center:[-.50,.29,-.23], size:[1.58,.32,.58], color:0x886f60},
  {center:[-.50,.432,-.23], size:[1.58,.098,.54], color:0x9b8374},
  {center:[-.50,.60,-.57], size:[1.59,.40,.21], color:0x886f60},
  {center:[-1.39,.37,-.23], size:[.20,.48,.74], color:0x886f60},
  {center:[.30,.29,.56], size:[1.58,.28,.35], color:0x886f60},
  {center:[.30,.40,.56], size:[1.58,.10,.35], color:0x9b8374},
  {center:[1.075,.45,.235], size:[.85,.10,.22], color:0x735442}
];

export function createGigasetLoungeSeat(collider, footprint) {
  const {position:[ox,oy,oz],yaw,scale} = gigasetLoungeSofa;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const point = (x,z) => worldInteriorPoint(interiorStores.S17,[ox+scale*(x*c+z*s),0,oz+scale*(-x*s+z*c)]);
  const [x,,z] = point(-.95,-.23);
  // Use the aisle end of the sofa to clear the retained footprint and the opposing bench.
  const [exitX,,exitZ] = point(-1.95,1.12);
  const {world_origin_m:origin,floor_surface_y_m:surface,yaw_world_deg:shopYaw} = interiorStores.S17.frame;
  const floor = origin[1]+surface;
  const angle = shopYaw*Math.PI/180+yaw-Math.PI;
  return createSeatAnchor({id:'gigaset-lounge-sofa', name:'Gigaset lounge sofa',
    x,z,floor,accessible:true,exit:{x:exitX,y:floor,z:exitZ},pose:{angle,facing:1},
    clearance:{interactionRadius:.7,capsuleRadius:.3,colliderWidth:footprint.width,colliderDepth:footprint.depth}
  },collider,{size:[1.58*scale,footprint.height,.58*scale],top:oy-surface+.481*scale,seatCentre:0,front:-.282*scale},1);
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
