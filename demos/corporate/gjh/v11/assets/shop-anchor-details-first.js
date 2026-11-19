import {interiorStores} from './interiors/config.js';
import {createSeatAnchor} from './seat-placements.js';

export function addOriginalShopDetails(zone, x, {box, cylinder, solid, collider, seats}) {
  if (zone === 'newmoon') {
    // Two low tasting stools sit along the open edge of the stone island.
    const {frame,props} = interiorStores.S01;
    const stools = props.find(({socket}) => socket === 'stools1');
    const [width,,depth] = stools.envelope_whd_m;
    const floor = frame.floor_surface_y_m;
    const profile = {size:[width,.693,depth],top:.693,seatCentre:0,front:-depth/2};
    for (const [index,[localX,,localZ]] of stools.instance_positions_m.entries()) {
      const cx = x + localX, z = frame.world_origin_m[2] + localZ;
      cylinder('wood',cx,.59,z,.26,.075);
      cylinder('ivory',cx,floor+profile.top-.095/2,z,.27,.095);
      for(const dx of [-.16,.16])for(const dz of [-.16,.16])box('wood',cx+dx,.30,z+dz,.048,.56,.048);
      for(const dz of [-.16,.16])box('brass',cx,.20,z+dz,.34,.026,.027);
      const seatCollider = collider(cx,.35,z,width,.70,depth);
      seats.push(createSeatAnchor({
        id:`newmoon-tasting-stool-${index+1}`, name:`New Moon tasting stool ${index+1}`,
        x:cx,z,floor,accessible:true,
        exit:{x:cx-.95,y:floor,z},
        pose:{facing:0,angle:Math.PI/2},
        clearance:{interactionRadius:.8,capsuleRadius:.3,colliderWidth:width,colliderDepth:depth}
      },seatCollider.handle,profile,1));
    }
  } else if (zone === 'mili') {
    // A continuous oak kitchen run grounds the pantry shelves above it.
    const cx=x-4.27, z=-5.13;
    box('wood',cx,.56,z,.74,.94,6.86);
    box('oak',cx,1.07,z,.82,.10,6.94);
    collider(cx,.56,z,.82,1.10,6.94);
    for(let i=0;i<8;i++) {
      const dz=z+(i-3.5)*.84;
      box('oak',cx+.379,.57,dz,.035,.77,.79);
      box('brass',cx+.407,.81,dz+.23,.045,.035,.23);
    }
    box('jadeAlt',x-4.65,1.66,z,.036,1.03,6.73);
    for (let dz=-3.22;dz<=3.23;dz+=.38) box('wood',x-4.626,1.66,z+dz,.014,.99,.012);
    for (const y of [1.34,1.70,2.06]) box('wood',x-4.626,y,z,.014,.013,6.70);
  } else if (zone === 'gogo') {
    // Shallow arched tea niches line the wall directly behind the drinks bar.
    for (const [i,z] of [-2.10,-4.13,-6.16].entries()) {
      const wallX=x+4.60, r=.87, crown=2.75;
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
