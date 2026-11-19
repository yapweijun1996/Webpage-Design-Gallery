import {interiorStores,radians} from './interiors/config.js';
import {createSeatAnchor} from './seat-placements.js';

export function addOriginalShopDetails(zone, x, {box, cylinder, solid, collider, seats}) {
  if (zone === 'newmoon') {
    // Two low tasting stools sit along the open edge of the stone island.
    const {frame,props} = interiorStores.S01;
    const floor = frame.floor_surface_y_m;
    for (const stool of props.filter(prop => prop.socket === 'stools1')) {
      const {position_m:[localX,,localZ],envelope_whd_m:[width,height,depth],seat} = stool;
      const profile = {size:[width,seat.top,depth],top:seat.top,seatCentre:0,front:-depth/2};
      const cx = x + localX, z = frame.world_origin_m[2] + localZ;
      cylinder('wood',cx,.59,z,.26,.075);
      cylinder('ivory',cx,floor+profile.top-.095/2,z,.27,.095);
      for(const dx of [-.16,.16])for(const dz of [-.16,.16])box('wood',cx+dx,.30,z+dz,.048,.56,.048);
      for(const dz of [-.16,.16])box('brass',cx,.20,z+dz,.34,.026,.027);
      const seatCollider = collider(cx,height/2,z,width,height,depth);
      seats.push(createSeatAnchor({
        id:seat.id, name:seat.name,
        x:cx,z,floor,accessible:seat.accessible,
        exit:{x:cx+seat.exitOffsetXZ[0],y:floor,z:z+seat.exitOffsetXZ[1]},
        pose:{facing:seat.facing,angle:radians(seat.angleDeg)},
        clearance:{interactionRadius:seat.interactionRadius,capsuleRadius:seat.capsuleRadius,colliderWidth:width,colliderDepth:depth}
      },seatCollider.handle,profile,1));
    }
  } else if (zone === 'mili') {
    // A continuous oak kitchen run grounds the pantry shelves above it.
    const {frame,kitchenRun} = interiorStores.S02;
    const [dx,base,dz] = kitchenRun.xyz, [width,height,depth] = kitchenRun.size;
    const cx=x+dx, z=frame.world_origin_m[2]+dz, cy=base+height/2;
    box('wood',cx,cy,z,width-.08,height-.16,depth-.08);
    box('oak',cx,base+height-.04,z,width,.10,depth);
    collider(cx,cy,z,width,height,depth);
    for(let i=0;i<8;i++) {
      const dz=z+(i-3.5)*.84;
      box('oak',cx+.379,.57,dz,.035,.77,.79);
      box('brass',cx+.407,.81,dz+.23,.045,.035,.23);
    }
    box('jadeAlt',cx-.38,1.66,z,.036,1.03,6.73);
    for (let dz=-3.22;dz<=3.23;dz+=.38) box('wood',cx-.356,1.66,z+dz,.014,.99,.012);
    for (const y of [1.34,1.70,2.06]) box('wood',cx-.356,y,z,.014,.013,6.70);
  } else if (zone === 'gogo') {
    // Shallow arched tea niches line the wall directly behind the drinks bar.
    const {frame,teaNiches} = interiorStores.S03;
    const {radius:r,crownY:crown,centresZ} = teaNiches;
    const wallX=x+teaNiches.wallX;
    for (const [i,localZ] of centresZ.entries()) {
      const z=frame.world_origin_m[2]+localZ;
      for (const [material, offset, radius] of [['brass',0,r],['ivory',.025,r-.07]]) {
        const px=wallX-offset;
        solid('cylinder',material,px,crown,z,radius,.035,radius,0,0,'XYZ',Math.PI/2);
        box(material,px-.004,2.12,z,.04,1.26,radius*2);
      }
      for (const y of [1.72,2.42]) {
        box('oak',wallX-.15,y,z,.34,.068,1.57);
        box('glow',wallX-.31,y-.045,z,.026,.021,1.44);
        for(let j=-2;j<=2;j++) {
          const material=(i+j+3)%3===0?'jadeAlt':(j%2?'brass':'cream');
          cylinder(material,wallX-.16,y+.17,z+j*.25,.086,.25);
          cylinder('oak',wallX-.16,y+.314,z+j*.25,.073,.037);
        }
      }
    }
  }
}
