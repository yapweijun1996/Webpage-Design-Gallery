import test from 'node:test';
import assert from 'node:assert/strict';
import {spatial, createSpatialRegistry, courtyardArrival, storeAt, storeCenterX, mapPoint, mapStoreRect} from '../demos/corporate/gjh/v11/assets/spatial.js';

import {SHELL_LAYOUT} from '../demos/corporate/gjh/v11/assets/interior-shell-registry.js';

const fixture = () => structuredClone(spatial.stores);

test('three stable stores share the current scene centers, entrances and ordering', () => {
  assert.deepEqual(spatial.stores.map(s=>[s.id,s.number,s.label,storeCenterX(s),s.arrival.x,s.arrival.z]), [
    ['newmoon','01','New Moon',-10,-10,2.4],['mili','02','MILI',0,0,2.4],['gogo','03','GOGO',10,10,2.4]]);
  assert.deepEqual(courtyardArrival,{x:-2,z:12});
  assert.equal(spatial.get('unknown'),null);
  assert.equal(spatial.get('__proto__'),null);
  assert.equal(spatial.arrival('unknown'),null);
  assert.equal(Object.isFrozen(spatial.stores[0].bounds),true);
  assert.throws(()=>{spatial.stores[0].arrival.x=500},TypeError);
});

test('location boundaries and map projection retain the existing visible behavior', () => {
  for(const [x,z,expected] of [[-5.01,0,'newmoon'],[-5,0,'mili'],[5,0,'mili'],[5.01,0,'gogo'],[0,.1,null],[0,NaN,null]])
    assert.equal(storeAt(x,z)?.id || null,expected);
  for(const [x,z,expected] of [[-15,-10.5,'newmoon'],[-15.01,-1,null],[15,-1,'gogo'],[15.01,-1,null],[0,-10.51,null],[0,0,'mili']])
    assert.equal(storeAt(x,z,true)?.id || null,expected);
  assert.deepEqual(mapPoint(-100,100),{x:0,y:290});
  assert.deepEqual(spatial.stores.map(s=>mapStoreRect(s).x),[14,114,214]);
  for (const store of spatial.stores) {
    assert.equal(mapStoreRect(store).x+36,mapPoint(storeCenterX(store),0).x);
    assert.equal(spatial.arrival(store.id),store.arrival);
  }
});

test('registry rejects invalid identity, geometry and unsafe nominal arrivals atomically', () => {
  const cases = [
    s=>{s[1].id=s[0].id}, s=>{s[1].number=s[0].number}, s=>{s[1].contentRef=s[0].contentRef},
    s=>{s[1].id=''}, s=>{s[1].label=' '}, s=>{s[1].floor='upper'}, s=>{s[1].available='yes'},
    s=>{s[1].bounds.minX=NaN}, s=>{s[1].bounds.minX=-6}, s=>{s[1].bounds.maxZ=.3},
    s=>{s[1].bounds.minZ=-10}, s=>{s[1].arrival.z=.1}, s=>{s[1].arrival.x=3},
    s=>{s[1].arrival.x=500}, s=>{s[1].arrival.z=Infinity},
    s=>{s.pop()},
  ];
  for (const mutate of cases) {const bad=fixture();mutate(bad);assert.throws(()=>createSpatialRegistry(bad),TypeError);}
  assert.throws(()=>createSpatialRegistry(fixture(),{minX:0,maxX:0,minZ:0,maxZ:0}),TypeError);
  assert.equal(spatial.stores.length,3);
});

test('unavailable store cannot produce a travel destination', () => {
  const source=fixture();source[1].available=false;
  const candidate=createSpatialRegistry(source);
  assert.equal(candidate.get('mili').available,false);
  assert.equal(candidate.arrival('mili'),null);
  assert.deepEqual(candidate.arrival('gogo'),{x:10,z:2.4});
});

// The exported kit is approved for this live fixture; spatial changes require a new layout review.
test('approved shell portals and aggregate proxies match authoritative live store centers', () => {
  const frame = SHELL_LAYOUT.assets.frontage;
  assert.deepEqual(frame.placements, spatial.stores.map(store => [storeCenterX(store),0,0,0]));
  const pieces = frame.components.filter(part => ['Stone pier left','Stone pier right','Dark lintel'].includes(part.name));
  const expected = spatial.stores.flatMap(store => pieces.map(part => ({
    position: [storeCenterX(store)+part.position[0],part.position[1],part.position[2]], size: part.size
  })));
  const actual = SHELL_LAYOUT.aggregate_colliders.filter(part => part.name.startsWith('portal-'))
    .map(({position,size}) => ({position,size}));
  assert.deepEqual(actual,expected);
});
