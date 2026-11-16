// Current three-store scene only. The expanded 17-store plan is not runtime geometry.
const FLOOR = Object.freeze({minX: -15.2, maxX: 15.2, minZ: -11.2, maxZ: 18.2});
const MAP = Object.freeze({minX: -15, maxX: 15, minZ: -11, maxZ: 18, width: 300, height: 290, storeWidth: 72, storeHeight: 110, storeTop: 20});
const SOURCE = [
  {id:'newmoon', number:'01', label:'New Moon', floor:'ground', available:true,
    bounds:{minX:-15,maxX:-5,minZ:-10.5,maxZ:0}, arrival:{x:-10,z:2.4}, contentRef:'newmoon-title'},
  {id:'mili', number:'02', label:'MILI', floor:'ground', available:true,
    bounds:{minX:-5,maxX:5,minZ:-10.5,maxZ:0}, arrival:{x:0,z:2.4}, contentRef:'mili-title'},
  {id:'gogo', number:'03', label:'GOGO', floor:'ground', available:true,
    bounds:{minX:5,maxX:15,minZ:-10.5,maxZ:0}, arrival:{x:10,z:2.4}, contentRef:'gogo-title'},
];

// Validate before publishing any record. Geometry is nominal, not a physics
// query: actual arrival clearance is verified in the running scene.
export function createSpatialRegistry(source, floor = FLOOR) {
  if (!Array.isArray(source) || source.length !== 3 || !floor ||
      !['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(floor[k])) ||
      floor.minX >= floor.maxX || floor.minZ >= floor.maxZ) throw new TypeError('Invalid spatial source or floor');
  const ids = new Set(), numbers = new Set(), refs = new Set();
  const stores = source.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id) || ids.has(item.id) ||
        typeof item.number !== 'string' || !/^\d{2}$/.test(item.number) || numbers.has(item.number) ||
        typeof item.label !== 'string' || !item.label.trim() || item.floor !== 'ground' || typeof item.available !== 'boolean' ||
        typeof item.contentRef !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.contentRef) || refs.has(item.contentRef))
      throw new TypeError('Invalid or duplicate store identity');
    const b = item.bounds, a = item.arrival;
    if (!b || !a || !['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(b[k])) ||
        !Number.isFinite(a.x) || !Number.isFinite(a.z) || b.maxX-b.minX !== 10 || b.minZ !== -10.5 || b.maxZ !== 0 ||
        b.minX < floor.minX || b.maxX > floor.maxX || b.minZ < floor.minZ || b.maxZ > floor.maxZ ||
        Math.abs(a.x - (b.minX+b.maxX)/2) > 2 || a.z <= b.maxZ + .3 ||
        a.x < floor.minX + .3 || a.x > floor.maxX - .3 || a.z > floor.maxZ - .3)
      throw new TypeError('Invalid store bounds or arrival');
    ids.add(item.id); numbers.add(item.number); refs.add(item.contentRef);
    return Object.freeze({...item, bounds:Object.freeze({...b}), arrival:Object.freeze({...a})});
  });
  for (let i=1;i<stores.length;i++) {
    const prev=stores[i-1].bounds, next=stores[i].bounds;
    if (prev.maxX !== next.minX || prev.minZ !== next.minZ || prev.maxZ !== next.maxZ) throw new TypeError('Inconsistent store geometry');
  }
  const byId = new Map(stores.map(store=>[store.id,store]));
  return Object.freeze({stores:Object.freeze(stores), get:id=>byId.get(id) || null,
    arrival(id) { const store=byId.get(id); return store?.available ? store.arrival : null; }});
}

export const spatial = createSpatialRegistry(SOURCE);
export const courtyardArrival = Object.freeze({x:-2,z:12});
export function storeCenterX(store) { return (store.bounds.minX + store.bounds.maxX) / 2; }

// Preserve the existing ground-zone boundary behavior including ±5 m edges.
export function storeAt(x, z, bounded = false) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || z >= spatial.stores[0].bounds.maxZ + .1) return null;
  const [left, middle, right] = spatial.stores;
  const store = x < left.bounds.maxX ? left : x > right.bounds.minX ? right : middle;
  const b = store.bounds;
  return bounded && (x < b.minX || x > b.maxX || z < b.minZ) ? null : store;
}
export function mapPoint(x, z) {
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  return {x:(clamp(x,MAP.minX,MAP.maxX)-MAP.minX)*MAP.width/(MAP.maxX-MAP.minX),
    y:(clamp(z,MAP.minZ,MAP.maxZ)-MAP.minZ)*MAP.height/(MAP.maxZ-MAP.minZ)};
}
export function mapStoreRect(store) {
  const center=mapPoint(storeCenterX(store),store.bounds.maxZ).x;
  return {x:center-MAP.storeWidth/2,y:MAP.storeTop,width:MAP.storeWidth,height:MAP.storeHeight};
}
export const mapView = MAP;
