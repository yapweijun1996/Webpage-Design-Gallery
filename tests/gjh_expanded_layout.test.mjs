import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandedLayout, expandedMapPoint, expandedStoreAt, expandedStoreArrival} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {spatial} from '../demos/corporate/gjh/v11/assets/spatial.js';

const proposal=JSON.parse(readFileSync(new URL('../docs/references/gjh-mall-spatial-plan.json',import.meta.url),'utf8'));
test('seventeen runtime shells match the stage 1 plan under one rigid translation',()=>{
  assert.equal(expandedLayout.slots.length,17);
  for(const [i,planned] of proposal.stores.entries()){
    const [x0,y0,x1,y1]=planned.bounds, slot=expandedLayout.slots[i];
    assert.equal(`S${slot.number}`,planned.id);
    assert.deepEqual([slot.minX,slot.maxX,slot.minZ,slot.maxZ],[x0-25,x1-25,48-y1,48-y0]);
    assert.equal(slot.available,true);
    const id=i<3?spatial.stores[i].id:`planned-space-${slot.number}`;
    assert.equal(expandedStoreAt((slot.minX+slot.maxX)/2,(slot.minZ+slot.maxZ)/2)?.id,id);
    const arrival=expandedStoreArrival(id);
    assert.ok(arrival);
    if(i>=3){
      assert.equal(arrival.yaw,slot.side==='north'?0:slot.side==='west'?Math.PI/2:-Math.PI/2);
      assert.equal(expandedStoreAt(arrival.x,arrival.z),null);
    }
  }
  assert.deepEqual(expandedLayout.bounds,{minX:-25,maxX:45,minZ:-12,maxZ:48});
  assert.deepEqual(expandedLayout.lift,{x:-3,z:10,upper:7.2});
  assert.ok(Math.hypot(expandedLayout.courtyardArrival.x-expandedLayout.lift.x,expandedLayout.courtyardArrival.z-expandedLayout.lift.z)>5);
  for(const [i,store] of spatial.stores.entries()){
    const slot=expandedLayout.slots[i];
    assert.equal(store.number,slot.number);
    assert.equal(store.bounds.minX,slot.minX);
    assert.equal(store.bounds.maxX,slot.maxX);
    assert.equal(store.bounds.maxZ,slot.maxZ);
  }
  assert.deepEqual(expandedMapPoint(-25,-12),{x:0,y:0});
  assert.deepEqual(expandedMapPoint(45,48),{x:700,y:600});
  assert.deepEqual(expandedMapPoint(10,45),{x:350,y:570});
});

const {plannedSpaces} = await import('../demos/corporate/gjh/v11/assets/expanded-layout.js');
const kit=JSON.parse(readFileSync(new URL('../demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../demos/corporate/gjh/v11/index.html',import.meta.url),'utf8');
test('fourteen concept records derive from visitable bays outside the curated catalog',()=>{
  const concepts=expandedLayout.slots.slice(3);
  assert.equal(plannedSpaces.length,14);assert.ok(Object.isFrozen(plannedSpaces));
  for(const [index,space] of plannedSpaces.entries()){
    const slot=concepts[index];assert.equal(space.id,`planned-space-${slot.number}`);
    assert.equal(space.number,slot.number);
    assert.equal(space.side,slot.side);assert.equal(space.status,'open');assert.equal(space.available,true);
    assert.ok(Object.isFrozen(space));
  }
  assert.equal(new Set(plannedSpaces.map(space=>space.id)).size,14);
  assert.equal(spatial.stores.length,3);assert.ok(spatial.stores.every(store=>!plannedSpaces.some(space=>space.id===store.id)));
});
test('static planned directory matches every canonical field without live catalog actions',()=>{
  const match=html.match(/<details\b([^>]*\bid="planned-spaces-directory"[^>]*)>([\s\S]*?)<\/details>/);
  assert.ok(match);assert.doesNotMatch(match[1],/\bopen(?:\s|=|$)/);
  const body=match[2], items=[...body.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)];
  assert.equal(items.length,plannedSpaces.length);
  assert.ok(body.includes(`Concept stores (${plannedSpaces.length})`));
  assert.doesNotMatch(body,/<a\b|\bdata-(?:store|product|teleport|inspect|add)(?:=|-|\s)/);
  const sideLabels={north:'North side',west:'West side',east:'East side'};
  for(const [index,item] of items.entries()){
    const attrs=Object.fromEntries([...item[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    const space=plannedSpaces[index];assert.equal(attrs.id,space.id);
    for(const [key,value] of Object.entries({space:space.id,number:space.number,side:space.side,status:space.status,available:String(space.available),brand:kit[`S${space.number}`].brand}))assert.equal(attrs[`data-planned-${key}`],value);
    assert.ok(item[2].includes(`data-visit-store="${space.id}" hidden>Visit ${attrs['data-planned-brand']} in 3D`));
    assert.equal(item[2].match(/<h3>([^<]*)<\/h3>/)?.[1],`${space.number} · ${kit[`S${space.number}`].brand}`);
    assert.equal(item[2].match(/<p data-planned-field="location">([^<]*)<\/p>/)?.[1],`${sideLabels[space.side]}`);
  }
});
