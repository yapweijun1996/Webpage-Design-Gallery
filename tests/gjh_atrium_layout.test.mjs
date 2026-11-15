import test from 'node:test';
import assert from 'node:assert/strict';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';

const rect=(x,z,w,d)=>({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
const overlap=(a,b)=>a.minX<b.maxX && a.maxX>b.minX && a.minZ<b.maxZ && a.maxZ>b.minZ;
const contains=(outer,inner)=>inner.minX>=outer.minX && inner.maxX<=outer.maxX && inner.minZ>=outer.minZ && inner.maxZ<=outer.maxZ;
const ring=[{minX:-15,maxX:-9,minZ:0,maxZ:42},{minX:29,maxX:35,minZ:0,maxZ:42},
  {minX:-15,maxX:35,minZ:0,maxZ:6},{minX:-15,maxX:35,minZ:36,maxZ:42}];
const plantingReservation={minX:5,maxX:15,minZ:14,maxZ:18};
const loungeReservations=[{minX:-7,maxX:-1,minZ:20,maxZ:28},{minX:21,maxX:27,minZ:20,maxZ:28}];

test('planting and furniture remain inside their reservations and clear of the loop and event',()=>{
  const garden=atriumLayout.garden;
  const objects=[rect(garden.x,garden.z,garden.width,garden.depth)];
  assert.ok(contains(plantingReservation,objects[0]));
  assert.ok(garden.height<.6);
  assert.equal(atriumLayout.lounges.length,2);
  for(const [index,lounge] of atriumLayout.lounges.entries()){
    assert.equal(lounge.seats.length,2);
    const furniture=[...lounge.seats.map(p=>rect(p.x,p.z,2.5,.85)),
      rect(lounge.table.x,lounge.table.z,.58,.58),...lounge.planters.map(p=>rect(p.x,p.z,.7,.7))];
    for(const object of furniture)assert.ok(contains(loungeReservations[index],object),JSON.stringify(object));
    for(let i=0;i<furniture.length;i++)for(let j=i+1;j<furniture.length;j++)
      assert.ok(!overlap(furniture[i],furniture[j]),JSON.stringify([furniture[i],furniture[j]]));
    objects.push(...furniture);
  }
  for(const object of objects){
    assert.ok(!overlap(atriumLayout.event,object),JSON.stringify(object));
    for(const corridor of ring)assert.ok(!overlap(corridor,object),JSON.stringify(object));
  }
});
