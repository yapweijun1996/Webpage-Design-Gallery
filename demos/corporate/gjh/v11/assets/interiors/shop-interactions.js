import {loadInteriorActions, interiorStores, worldInteriorBox} from './config.js';
import {mergeStaticGeometries} from '../merge-static-geometries.js';

export const interactiveShopSlots = Object.freeze({newmoon: 'S01', mili: 'S02', gogo: 'S03'});
const shopsBySlot = Object.fromEntries(Object.entries(interactiveShopSlots).map(([zone, slot]) => [slot, zone]));

const tea = {effect:'tea', label:'Pour tea', progress:'Pouring tea…', done:'Tea served.'};
const serve = {effect:'plate', label:'Serve tasting plate', progress:'Serving a tasting plate…', done:'Sample ready.'};
const drink = {effect:'drink', label:'Pour drink', progress:'Pouring a drink…', done:'Drink served.'};
const water = {effect:'water', label:'Water plant', progress:'Watering…', done:'Plant watered.'};
const concreteActions = {
  'S01-kettle': {...tea, seated: true},
  'S01-cups1': tea, 'S01-cups2': tea, 'S01-cups3': tea,
  'S01-plant1': water,
  'S02-cookbase': serve, 'S02-plate': serve, 'S02-tasting-plate': serve,
  'S02-plant2': {...water, label:'Water herbs', done:'Herbs watered.'},
  'S03-focal': {effect:'bell', label:'Ring bell', progress:'Ringing the cart bell…', done:'Popsicle ready.'},
  'S03-drink': drink, 'S03-gbar': drink, 'S03-tray3': drink,
  'S03-fern3': water
};

function point(shop, xyz, yaw = 0) {
  return worldInteriorBox(shop, {center:xyz, yaw}).center;
}

export async function buildShopInteractionTargets(slots = Object.keys(interiorStores)) {
  const layouts = await Promise.all(slots.map(loadInteriorActions));
  return slots.flatMap((slot, index) => {
    const shop = interiorStores[slot];
    return layouts[index].map(item => {
      const [x, y, z] = point(shop,[item.xyz[0],item.xyz[1] + item.size[1]/2,item.xyz[2]]);
      const [sx, floor, sz] = point(shop,[item.standing[0],shop.frame.floor_surface_y_m,item.standing[1]]);
      const zone = shopsBySlot[slot] ?? slot;
      const seat = item.action.includes('sit');
      const productId = zone === 'newmoon' ? item.targetId : undefined;
      const name = item.a11y.en;
      const action = productId ? {
        effect:'drawer', label:'Open drawer', progress:'Opening drawer…', done:'Drawer open.'
      } : concreteActions[item.id];
      const seated = action?.seated;
      return {id:item.id, kind:'shop', x, y, z, floor, standing:{x:sx,z:sz},
        radius:Math.min(item.reachDistance,.9),
        availability:({zone:currentZone,travelling,player}) =>
          zone === currentZone && !travelling && !player?.pushing && !player?.productApproaching &&
          (player?.character?.physicalProduct?.phase ?? 'empty') === 'empty' &&
          (!player?.seated || (seated && player.seatPhase === 'seated' && player.seatId?.startsWith('newmoon-tasting-stool-'))),
        shopAction:{zone, slot, item, name, seat, seated, productId,
          label: seat ? 'Sit' : 'View', done:`Viewed: ${name}`, duration:action ? .85 : 0, ...action}};
    });
  });
}

export async function installShopInteractions(T, scene, registry, announce) {
  const targets = await buildShopInteractionTargets(Object.values(interactiveShopSlots));
  // Existing seats retain their collision checks, stand behaviour and original IDs.
  const nearby = targets.filter(target => !target.shopAction.seat);
  registry.installShopActions(nearby, {announce, present:createShopActionVisual(T,scene,targets)});
  return nearby;
}

function createShopActionVisual(T, scene, targets) {
  const items = new Map(targets.map(({id,shopAction:{item}}) => [id,item]));
  const shapes = new Map();
  let mesh;
  const box = () => new T.BoxGeometry();
  const disc = () => new T.CylinderGeometry(.5,.43,1,10);
  function merge(parts) {
    const combined = mergeStaticGeometries(T,parts);
    parts.forEach(part => part.dispose());
    return combined;
  }
  const makeShape = {
    box, disc,
    bell: () => new T.LatheGeometry([[0,0],[.5,0],[.34,.19],[.24,.64],[.12,.77],[.12,.94],[0,.94]]
      .map(([x,y]) => new T.Vector2(x,y)),10).translate(0,-.45,0),
    popsicle: () => merge([
      box().scale(.92,.70,.75).translate(0,.13,0),
      box().scale(.22,.38,.22).translate(0,-.34,0)
    ]),
    kettle: () => merge([
      disc().scale(.66,.65,.75),
      disc().scale(.45,.12,.5).translate(0,.37,0),
      disc().scale(.14,.56,.14).rotateZ(-1.02).translate(.46,.13,0),
      new T.TorusGeometry(.25,.055,4,8).translate(-.35,0,0)
    ]),
    drawer: () => merge([
      box().scale(1,1,.18).translate(0,0,.41),
      box().scale(.96,.12,.82).translate(0,-.43,-.09),
      box().scale(.018,.4,.82).translate(-.47,-.21,-.09),
      box().scale(.018,.4,.82).translate(.47,-.21,-.09)
    ])
  };
  // One reusable prop, allocated on first use. It casts no shadow and adds at
  // most one draw, even when visitors complete several actions in a room.
  function draw(position, yaw, shape, color, size, tilt = 0) {
    if (!shapes.has(shape)) shapes.set(shape,makeShape[shape]());
    const geometry = shapes.get(shape);
    if (!mesh) {
      mesh = new T.Mesh(geometry,new T.MeshBasicMaterial());
      mesh.name = 'Shop action prop';
      scene.add(mesh);
    }
    mesh.geometry = geometry;
    mesh.material.color.setHex(color);
    mesh.position.set(...position);
    mesh.rotation.set(0,yaw,tilt);
    mesh.scale.set(...size);
    mesh.visible = true;
  }
  return (target,t) => {
    if (mesh) mesh.visible = false;
    const action = target?.shopAction;
    if (!action?.effect) return;
    const {item,slot,effect} = action;
    const shop = interiorStores[slot];
    const yaw = (shop.frame.yaw_world_deg + item.yawDeg) * Math.PI/180;
    const peak = Math.sin(Math.PI*t);
    const relative = (source,dx,dy,dz) => point(shop,[source.xyz[0]+dx,source.xyz[1]+dy,source.xyz[2]+dz]);
    if (effect === 'drawer') {
      draw(relative(item,0,.54,item.size[2]/2-.12+.2*t),yaw,'drawer',0x84523b,[item.size[0]*.7,.19,.30]);
    } else if (effect === 'bell') {
      const ringing = t < .62;
      draw(relative(item,.48,1.05,.4),yaw,ringing?'bell':'popsicle',ringing?0xe6b467:0xdb6a3a,
        ringing?[.13,.13,.13]:[.095,.22,.055],ringing?.55*Math.sin(t*45)*peak:-.4);
    } else if (effect === 'plate') {
      const plate = items.get('S02-tasting-plate');
      if (t < .32) draw(relative(plate,-.42,.02-.025*Math.sin(t*9),0),0,'disc',0xb5422a,[.12,.05,.12]);
      else draw(relative(plate,0,.124+.13*peak,0),0,'disc',0xcf924a,[.26,.075,.21]);
    } else if (effect === 'water') {
      if (t < 1) draw(relative(item,.08,item.size[1]*.73+.22*(1-t),0),yaw,'disc',0x74c5d5,[.055,.28*peak,.055],-.18);
    } else if (effect === 'tea' && t < .72) {
      const kettle = items.get('S01-kettle');
      draw(relative(kettle,.12,.27+.18*peak,.08),yaw,'kettle',0xa87a4f,[.34,.29,.25],-.85*peak);
    } else {
      const cup = effect === 'tea' ? items.get('S01-cups3') : items.get('S03-drink');
      const isTea = effect === 'tea';
      draw(relative(cup,isTea?0:-.29,isTea?.06:.09,isTea?0:.28),yaw,'disc',
        isTea?0x9c5734:0xe8a746,[.11,.06+.10*t,.11]);
    }
  };
}
