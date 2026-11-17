// Exercise map travel only to the public landing. All subsequent movement
// passes through the production fixed-step player controller and Rapier.
export async function walkShop(win, number, onInterior = () => {}) {
  const doc = win.document, mall = win.__mall;
  const id = ['newmoon', 'mili', 'gogo'][number - 1] || 'planned-space-' + String(number).padStart(2, '0');
  const map = doc.getElementById('mall-map');
  if (!map.open) doc.getElementById('header-map').click();
  const destination = doc.getElementById('map-destination');
  destination.value = id;
  if (destination.value !== id) throw Error('Missing map destination ' + id);
  destination.dispatchEvent(new win.Event('change', {bubbles:true}));
  doc.getElementById('map-visit').click();
  if (map.open) doc.getElementById('map-close').click();
  doc.getElementById('scene').focus();
  // The native details toggle and its mode change settle after the map click.
  // Begin walking on the next presented frame, just as a visitor would.
  await new Promise(resolve => win.requestAnimationFrame(resolve));
  const north = number <= 5, west = number >= 6 && number <= 11;
  const yaw = north ? 0 : west ? Math.PI / 2 : -Math.PI / 2;
  const depth = s => north ? -s.z : west ? -15-s.x : s.x-35;
  const along = s => north ? s.x : west ? -s.z : s.z;
  const state = () => mall.state;
  const arrival = state();
  const describe = s => ({x:s.x,z:s.z,zone:s.zone,depth:depth(s)});
  const require = (condition, message) => {
    if (!condition) throw Error(id + ' ' + message + ' ' + JSON.stringify(describe(state())));
  };
  require(depth(arrival) < -.3, 'map destination must be outside');
  function motion(forward,right,ms) {
    mall.setInput({forward,right,yaw,run:false}); return mall.step(ms);
  }
  function approach(axis,target,sideways=false) {
    for(let i=0;i<65;i++) {
      const error = target-axis(state());
      if (Math.abs(error)<.2) return;
      const direction = Math.sign(error);
      motion(sideways?0:direction,sideways?direction:0, Math.min(125,Math.max(34,Math.abs(error)*290)));
    }
    require(false,'could not reach '+target);
  }
  try {
    motion(0,0,420);
    require(state().doors[id] > .99, 'door did not open automatically on approach');
    approach(depth,0);
    motion(0,0,550);
    require(state().doors[id] > .99, 'door closed on the visitor in the threshold');
    approach(depth,3.45);
    require(state().zone === id, 'incorrect interior');
    const entered=describe(state()), aisle=along(state());
    approach(along,aisle+.55,true);
    if (number >= 4) {
      // Pass the island on its aisle side; Casio needs room for the grand
      // piano, and GP keeps the centre aisle open between stepped tables.
      const offset = ({9:1.7, 15:2.8, 16:0})[number] ?? 2.1;
      approach(along,aisle+offset,true);
      approach(depth,7.4);
    }
    const browsed=describe(state());
    motion(0,0,400);
    await onInterior(win,number);
    if (number >= 4) approach(depth,3.45);
    approach(along,aisle,true);
    approach(depth,-1.85);
    require(state().doors[id] > .99, 'door did not open on the way out');
    const exited=describe(state());
    require(exited.zone!==id,'exit still inside');
    return {number,arrival:describe(arrival),entered,browsed,exited};
  } finally {
    mall.setInput(null);
  }
}
