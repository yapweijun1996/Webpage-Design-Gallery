import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {liftLayout as L,cutRectangle,showcaseProducts} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {expandedLayout} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
const area=r=>(r.maxX-r.minX)*(r.maxZ-r.minZ);
const intersects=(a,b)=>Math.max(a.minX,b.minX)<Math.min(a.maxX,b.maxX)&&Math.max(a.minZ,b.minZ)<Math.min(a.maxZ,b.maxZ);
test('expanded lift uses actual translated plan, continuous threshold and safe courtyard return',()=>{
 assert.equal(L.x,22-25);assert.equal(L.z,48-38);
 assert.deepEqual(L.shaft,{minX:-5,maxX:-1,minZ:8,maxZ:12});
 assert.equal(L.threshold.minX,L.shaft.minX);assert.equal(L.threshold.maxX,L.x-L.cabin.width/2);
 assert(L.exit.x<L.threshold.minX-.3);assert(Object.isFrozen(L.shaft));
 const p=expandedLayout.atrium;assert(!intersects(L.shaft,{minX:p.x-.3,maxX:p.x+.3,minZ:p.z-.3,maxZ:p.z+.3}));
});
test('upper deck and ceiling panels exactly cover remainder without gaps or overlapping shaft',()=>{
 for(const [rect,hole,expected] of [[L.slab,L.shaft,128],[{minX:-25,maxX:45,minZ:-12,maxZ:48},L.roofOpening,3524]]){
  const panels=cutRectangle(rect,hole);assert.equal(panels.reduce((s,r)=>s+area(r),0),expected);
  panels.forEach((r,i)=>{assert(!intersects(r,hole));panels.slice(i+1).forEach(other=>assert(!intersects(r,other)));});
 }
 for(const axis of ['X','Z'])assert(L.roofOpening['min'+axis]<=L.slab['min'+axis]-7&&L.roofOpening['max'+axis]>=L.slab['max'+axis]+7);
});
test('canonical amenities and four SKU transforms remain outside shaft and circulation',()=>{
 const items=[0,1,2,3].map(i=>({id:String(i),position:[-7+(i-1)*.1,.479,2.2]}));
 assert.equal(showcaseProducts(items,false),items);
 const moved=showcaseProducts(items,true);assert.deepEqual(moved.map(x=>x.id),items.map(x=>x.id));
 for(let i=0;i<4;i++){assert.equal(moved[i].position[2],L.showcase.z);assert(Math.abs(moved[i].position[0]-L.showcase.x)<.3);}
 for(const [p,w,d] of [[L.desk,2.88,.961],[L.directory,.96,.68],[L.showcase,.75,.532]])assert(!intersects({minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2},L.shaft));
 const world=readFileSync(new URL('../demos/corporate/gjh/v11/assets/world.js',import.meta.url),'utf8');
 const amenities=readFileSync(new URL('../demos/corporate/gjh/v11/assets/amenities.js',import.meta.url),'utf8');
 assert(world.includes('showcaseProducts(SHOWCASE_PRODUCTS,expanded)'));assert(amenities.includes('showcaseProducts(SHOWCASE_PRODUCTS,expanded)'));
 assert(!world.includes('item.position[2] + 4.8'));
});
