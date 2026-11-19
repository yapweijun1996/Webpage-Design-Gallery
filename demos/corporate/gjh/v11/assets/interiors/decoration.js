import {mergeGeometries} from '../shop-sign-vendor.js';
import {radians} from './config.js';
import {floorFinish, kelvinColour} from './surfaces.js';

function merged(parts) {
  if (!parts.length) return null;
  const result = mergeGeometries(parts);
  for (const geometry of parts) geometry.dispose();
  return result;
}

function addColour(T, geometry, colour) {
  const colors = new Float32Array(3*geometry.attributes.position.count);
  for (let i=0;i<colors.length;i+=3) colour.toArray(colors,i);
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  return geometry;
}

export function interiorMaterials(T) {
  return {
    opaque:new T.MeshStandardMaterial({vertexColors:true,roughness:.78}),
    glow:new T.MeshBasicMaterial({vertexColors:true,toneMapped:false})
  };
}

export function* prepareInteriorDecoration(T, store, materials, detail = 0) {
  const [dominant,secondary,pale,accent] = store.palette.map(({hex}) => new T.Color(hex));
  const warm = kelvinColour(T,store.accent_kelvin);
  const opaque = [], glow = [];
  const body = dominant.clone().lerp(secondary,.37);
  const edge = pale.clone().lerp(accent,.52);
  const [lotWidth,lotDepth] = store.frame.lot_width_depth_m;
  const back = lotDepth/2-store.frame.actual_room_depth_m;
  const ceiling = Number(store.id.slice(1)) <= 3 ? 5.45 : 3.96;
  let origin = [0,0,0], yaw = 0;
  function piece(geometry, x,y,z, colour, emits) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    g.translate(x,y,z).rotateY(yaw).translate(...origin);
    (emits ? glow : opaque).push(addColour(T,g,colour));
  }
  const box = (x,y,z,w,h,d,c=body,emits=false) => piece(new T.BoxGeometry(w,h,d),x,y,z,c,emits);
  const cylinder = (x,y,z,r,h,c=edge,round=8) => piece(new T.CylinderGeometry(r,r,h,round),x,y,z,c,false);
  function fixture(prop, position) {
    const {kind} = prop;
    // The room GLB owns the suspended luminaire. Its old forward-facing
    // rectangular diffuser projected across the rear brand sign from the door.
    if (kind === 'retain' || prop.socket === 'ceiling') return;
    origin = position;
    yaw = radians(prop.yaw_deg);
    const [w,h,d] = prop.envelope_whd_m;
    const slab = (y,height,c) => box(0,y,0,w,height,d,c);
    const front = d/2;
    if (detail) {
      // Higher tiers draw the smaller objects on the shelves or counter lips.
      if (!['counter','rack','cabinet','case','console','easel'].includes(kind)) return;
      if (detail === 1) {
        for (let i=-1;i<=1;i++) {
          box(i*w*.24,h*.82,front-.075,w*.17,h*.16,.065,i===0?pale:secondary);
        }
      } else {
        for (let i=-1;i<=1;i++) box(i*w*.24,h*.82,front-.034,w*.11,.014,.009,accent);
      }
      return;
    }
    switch(kind) {
      case 'photo': // Its face uses the official packshot texture.
        slab(.075,.15,secondary);
        box(0,h*.5,-.1,.07,h*.87,.09,body);
        box(0,h-.4,0,w,.8,.10,edge);
        break;
      case 'light':
      case 'sconce':
      case 'spot':
      case 'lantern': {
        const pendant = kind !== 'sconce';
        box(0,h*.48,0,w*.9,h*.83,d*.87,body);
        box(0,h*.38,d*.44,w*.79,h*.56,.025,warm,true);
        if (pendant && position[1]+h+.04 < ceiling) {
          const drop = ceiling-position[1]-h;
          box(0,h+drop/2,0,.034,drop,.034,accent);
          box(0,.024,0,w*.79,.018,d*.68,warm,true);
        }
        break;
      }
      case 'plant':
        cylinder(0,h*.18,0,Math.min(w,d)*.43,h*.36,secondary);
        for (let i=0;i<6;i++) {
          const angle = i*2.4, leaf = new T.SphereGeometry(1,6,4)
            .scale(w*.11,h*.32,d*.13).rotateZ(.62).rotateY(angle);
          piece(leaf,Math.cos(angle)*w*.22,h*(.58+(i%3)*.06),Math.sin(angle)*d*.23,
            new T.Color(i%2 ? '#47634C' : '#788157'));
        }
        break;
      case 'baffle':
        slab(h*.49,h*.98,dominant);
        for (let i=-4;i<=4;i++) box(i*w*.1,h*.51,d*.48,w*.025,h*.91,.024,secondary);
        break;
      case 'counter':
      case 'console':
      case 'chest':
      case 'cabinet':
      case 'trolley':
      case 'crate':
      case 'pallet':
        box(0,h*.48,0,w*.95,h*.85,d*.92,body);
        slab(h*.96,h*.08,edge);
        for (let i=-1;i<=1;i++) box(i*w*.28,h*.57,d*.472,w*.16,.031,.028,accent);
        break;
      case 'rack':
      case 'case':
      case 'easel':
      case 'stand':
        for (const side of [-1,1]) box(side*w*.467,h/2,0,w*.066,h,d,body);
        box(0,h/2,-d*.42,w*.87,h,d*.14,secondary);
        for (const level of [.15,.48,.81]) slab(h*level,.05,edge);
        break;
      case 'sofa':
      case 'chair':
      case 'ottoman':
        slab(h*.34,h*.31,secondary);
        if (kind !== 'ottoman') box(0,h*.66,-d*.34,w,h*.67,d*.32,pale);
        for (const x of [-.39,.39]) for (const z of [-.34,.34])
          box(x*w,h*.12,z*d,.07,h*.24,.07,body);
        break;
      case 'screen':
      case 'keyboard':
        slab(h*.12,h*.24,body);
        box(0,h*.62,0,w,h*.76,d*.43,dominant);
        box(0,h*.61,d*.23,w*.92,h*.64,.018,secondary);
        if (kind === 'keyboard') for (let i=-5;i<=5;i++) box(i*w*.075,h*.85,d*.24,w*.063,.018,d*.3,pale);
        break;
      case 'plinth':
      case 'drum':
      case 'basket':
        cylinder(0,h*.45,0,Math.min(w,d)*.48,h*.89,body,12);
        cylinder(0,h*.95,0,Math.min(w,d)*.5,h*.1,secondary,12);
        break;
      case 'plate':
      case 'plates':
      case 'bowl':
        cylinder(0,h*.16,0,Math.min(w,d)*.47,h*.24,pale);
        cylinder(0,h*.46,0,Math.min(w,d)*.37,h*.4,edge);
        if (kind === 'plates') cylinder(0,h*.81,0,Math.min(w,d)*.45,h*.23,pale);
        break;
      case 'dispenser':
      case 'boiler':
        slab(h*.21,h*.42,secondary);
        for (const x of [-.25,.25]) {
          cylinder(x*w,h*.66,0,Math.min(w*.22,d*.41),h*.61,edge);
          box(x*w,h*.37,d*.23,w*.08,h*.08,d*.20,accent);
        }
        break;
      case 'tray':
      case 'samples':
      case 'rack-small':
      case 'tins':
        slab(h*.11,h*.22,body);
        for (let i=-1;i<=1;i++) box(i*w*.29,h*.51,0,w*.25,h*.72,d*.73,i===0?edge:secondary);
        break;
      case 'utensils':
      case 'chopsticks':
        cylinder(0,h*.27,0,Math.min(w,d)*.40,h*.54,secondary);
        for (let i=-1;i<=1;i++) box(i*w*.22,h*.59,0,.015,h*.79,.015,edge);
        break;
      case 'soundbar':
      case 'scanner':
      case 'scale':
      case 'till':
      case 'handset':
        slab(h*.14,h*.28,body);
        box(0,h*.57,-d*.12,w*.78,h*.67,d*.58,secondary);
        box(0,h*.66,d*.182,w*.51,h*.21,.015,pale);
        break;
    }
  }
  if (!detail) {
    opaque.push(floorFinish(T,store));
    if (store.id === 'S01' || store.id === 'S14') {
      const [x,y,z] = store.anchor.position_m;
      const distance = z-back-.22;
      for (const offset of [-.64,.64])
        box(x+offset,y+1,back+.12+distance/2,.15,.24,distance,body);
    }
    if (store.id === 'S02') {
      // The original entrance fascia stops short of the ceiling. Return the
      // kitchen plaster across its inner face, keeping the full door clearance.
      box(0,4.81,5.734,9.65,1.77,.038,pale);
      box(0,3.918,5.98,9.69,.025,.54,edge);
      const [x,y,z] = store.anchor.position_m, top = y+store.anchor.envelope_whd_m[1];
      for (const offset of [-.45,.45])
        box(x+offset,(ceiling+top)/2,z,.065,ceiling-top,.065,accent);
    }
    const [lx,ly,lz] = store.lighting;
    // A continuous picture light above the fixture supplies the approved tint.
    const high = Math.min(ly,ceiling-.13), width = Math.min(lotWidth-1.2,store.anchor.envelope_whd_m[0]+.35);
    box(lx,high+.06,lz,width,.11,.16,body);
    box(lx,high,lz+.027,width*.94,.018,.09,warm,true);
    // Two shallow rear wall returns bracket the shop's architectural accent.
    // The original cover and shelf faces remain clear of these side panels.
    for (const side of [-1,1]) {
      const x = side*(lotWidth/2-.51), z = back+.16;
      box(x,2.22,z,.22,3.68,.16,body);
      box(x-side*.155,2.72,z+.04,.035,2.49,.12,edge);
    }
    // Ceiling rails connect the back wall to the entrance. The underside
    // samples the same colour as the picture light.
    for (const side of [-1,1]) {
      const x = side*(lotWidth/2-.86);
      box(x,ceiling,0,.16,.09,lotDepth-2.1,secondary);
      box(x,ceiling-.052,0,.04,.012,lotDepth-2.25,warm,true);
    }
  }
  for (const prop of store.props) {
    for (const position of prop.instance_positions_m ?? [prop.position_m]) {
      fixture(prop,position);
      yield;
    }
  }
  if (detail) {
    origin = [0,0,0]; yaw = 0;
    const [x,y,z] = store.lighting, high = Math.min(y,ceiling-.13);
    // Tier-specific brass or enamel trim reveals the ends of the picture light.
    for (const side of [-1,1]) {
      const offset = side*(store.anchor.envelope_whd_m[0]/2+.10);
      if (detail === 1) box(x+offset,high+.026,z,.045,.057,.18,edge);
      else box(x+offset,high+.026,z+.097,.021,.034,.012,warm,true);
    }
  }
  const group = new T.Group();
  for (const [parts,material] of [[opaque,materials.opaque],[glow,materials.glow]]) {
    const geometry = merged(parts);
    if (geometry) group.add(new T.Mesh(geometry,material));
  }
  return group;
}

export function buildInteriorDecoration(...args) {
  const work = prepareInteriorDecoration(...args);
  let step;
  do { step = work.next(); } while (!step.done);
  return step.value;
}
