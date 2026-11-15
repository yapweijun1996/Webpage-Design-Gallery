import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandedLayout, expandedMapPoint} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {spatial} from '../demos/corporate/gjh/v11/assets/spatial.js';

const proposal=JSON.parse(readFileSync(new URL('../docs/references/gjh-mall-spatial-plan.json',import.meta.url),'utf8'));
test('seventeen runtime shells match the stage 1 plan under one rigid translation',()=>{
  assert.equal(expandedLayout.slots.length,17);
  for(const [i,planned] of proposal.stores.entries()){
    const [x0,y0,x1,y1]=planned.bounds, slot=expandedLayout.slots[i];
    assert.equal(`S${slot.number}`,planned.id);
    assert.deepEqual([slot.minX,slot.maxX,slot.minZ,slot.maxZ],[x0-25,x1-25,48-y1,48-y0]);
    assert.equal(slot.available,i<3);
  }
  assert.deepEqual(expandedLayout.bounds,{minX:-25,maxX:45,minZ:-12,maxZ:48});
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
