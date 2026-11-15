import test from 'node:test';
import assert from 'node:assert/strict';
import {createMallThemeCoordinator, EVERYDAY, LUNAR_NEW_YEAR, CHRISTMAS, DEEPAVALI, THEME_STORAGE_KEY} from '../demos/corporate/gjh/v11/assets/mall-themes.js';
import {applyMallThemeToWorld} from '../demos/corporate/gjh/v11/assets/world.js';
import {LUNAR_DECOR_LAYOUT} from '../demos/corporate/gjh/v11/assets/lunar-new-year.js';
import {CHRISTMAS_DECOR_LAYOUT} from '../demos/corporate/gjh/v11/assets/christmas.js';
import {DEEPAVALI_DECOR_LAYOUT} from '../demos/corporate/gjh/v11/assets/deepavali.js';
import {atriumLayout} from '../demos/corporate/gjh/v11/assets/atrium-layout.js';

const other=Object.freeze({id:'test-theme',label:'Test theme'});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),map:m};};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('only the reviewed themes are available and invalid stored IDs are safe',async()=>{
 const store=memory();store.setItem(THEME_STORAGE_KEY,'unknown');const c=createMallThemeCoordinator({storage:store});
 assert.deepEqual(c.options(),[{id:'everyday',label:'Everyday'},{id:'lunar-new-year',label:'Lunar New Year'},{id:'christmas',label:'Christmas'},{id:'deepavali',label:'Deepavali'}]);assert.equal(c.state().active,'everyday');assert.match(c.state().message,/unavailable/);
 assert.equal(await c.select('unknown'),false);assert.equal(c.state().active,'everyday');
 assert.equal(await c.select('everyday'),true);assert.equal(store.getItem(THEME_STORAGE_KEY),'everyday');
});
test('Deepavali decorations respect planter and event reservations',()=>{
 const {garden,event}=atriumLayout,{lamps,lampRadius,motif,garlands,garlandBottom,banner}=DEEPAVALI_DECOR_LAYOUT;
 for(const p of lamps){assert.ok(Math.abs(p.x-garden.x)+lampRadius<=garden.width/2 && Math.abs(p.z-garden.z)+lampRadius<=garden.depth/2);}
 assert.ok(motif.x-motif.radius>=event.minX && motif.x+motif.radius<=event.maxX && motif.z-motif.radius>=event.minZ && motif.z+motif.radius<=event.maxZ);
 for(const p of garlands){assert.ok(p.x>=event.minX && p.x<=event.maxX && p.z>=event.minZ && p.z<=event.maxZ);}
 assert.ok(garlandBottom>=4.5 && banner.y-banner.height/2>=4.5);
 assert.ok(banner.x-banner.width/2>=event.minX && banner.x+banner.width/2<=event.maxX && banner.z>=event.minZ && banner.z<=event.maxZ);
 assert.deepEqual(DEEPAVALI.decorationRefs,['deepavali']);
});
test('Christmas tree and presents stay in the planter while suspended lights clear the event',()=>{
 const {garden,event}=atriumLayout,{tree,treeRadius,gifts,lights,lightsBottom,banner}=CHRISTMAS_DECOR_LAYOUT;
 assert.ok(Math.abs(tree.x-garden.x)+treeRadius<=garden.width/2 && Math.abs(tree.z-garden.z)+treeRadius<=garden.depth/2);
 for(const p of gifts){assert.ok(Math.abs(p.x-garden.x)+p.radius<=garden.width/2 && Math.abs(p.z-garden.z)+p.radius<=garden.depth/2);}
 for(const p of lights){assert.ok(p.x>=event.minX && p.x<=event.maxX && p.z>=event.minZ && p.z<=event.maxZ);}
 assert.ok(lightsBottom>=4.5 && banner.y-banner.height/2>=4.5);
 assert.ok(banner.x-banner.width/2>=event.minX && banner.x+banner.width/2<=event.maxX && banner.z>=event.minZ && banner.z<=event.maxZ);
 assert.deepEqual(CHRISTMAS.decorationRefs,['christmas']);
});
test('lunar decorations respect the existing planter footprint and suspended event clearance',()=>{
 const {garden,event}=atriumLayout,{trees,treeRadius,lanterns,lanternBottom,banner}=LUNAR_DECOR_LAYOUT;
 for(const p of trees){assert.ok(Math.abs(p.x-garden.x)+treeRadius<=garden.width/2);assert.ok(Math.abs(p.z-garden.z)+treeRadius<=garden.depth/2);}
 for(const p of lanterns){assert.ok(p.x-.51>=event.minX && p.x+.51<=event.maxX && p.z-.51>=event.minZ && p.z+.51<=event.maxZ);}
 assert.ok(lanternBottom>=4.5);assert.ok(banner.y-banner.height/2>=4.5);
 assert.ok(banner.x-banner.width/2>=event.minX && banner.x+banner.width/2<=event.maxX && banner.z>=event.minZ && banner.z<=event.maxZ);
 assert.equal(LUNAR_NEW_YEAR.decorationRefs[0],'lunar-new-year');
});
test('blocked storage keeps a working in-memory selection',async()=>{
 const c=createMallThemeCoordinator({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}});
 assert.equal(await c.select('everyday'),true);assert.equal(c.state().saved,false);assert.match(c.state().message,/session/);
});
test('reapplying the current theme invokes the scene commit without preparing new resources',async()=>{
 let commits=0,preparations=0;const c=createMallThemeCoordinator({storage:memory(),prepare:()=>{preparations++;throw Error('unexpected');},commit:()=>{commits++;}});
 assert.equal(await c.select('everyday'),true);assert.equal(commits,1);assert.equal(preparations,0);
});
test('later selection wins, stale preparation is disposed and no stale commit runs',async()=>{
 const store=memory(),requests=[],commits=[],disposed=[];
 const c=createMallThemeCoordinator({registry:[EVERYDAY,other],storage:store,prepare:theme=>{const d=deferred();requests.push([theme,d]);return d.promise;},commit:t=>commits.push(t.id)});
 const first=c.select('test-theme');const second=c.select('everyday');
 requests[1][1].resolve({value:EVERYDAY,dispose:()=>disposed.push('second')});assert.equal(await second,true);
 requests[0][1].resolve({value:other,dispose:()=>disposed.push('first')});assert.equal(await first,false);
 assert.deepEqual(commits,['everyday']);assert.deepEqual(disposed,['first']);assert.equal(c.state().active,'everyday');
 c.destroy();c.destroy();assert.deepEqual(disposed,['first','second']);
});
test('failure and interruption leave the previous theme active and clean staged resources',async()=>{
 const wait=deferred(),disposed=[];let fail=true;
 const c=createMallThemeCoordinator({registry:[EVERYDAY,other],storage:memory(),prepare:()=>wait.promise,commit(){if(fail)throw Error('commit failure')}});
 const attempt=c.select('test-theme');wait.resolve({value:other,dispose:()=>disposed.push('failed')});assert.equal(await attempt,false);
 assert.equal(c.state().active,'everyday');assert.match(c.state().message,/unchanged/);assert.deepEqual(disposed,['failed']);
 const pending=deferred();const d=createMallThemeCoordinator({registry:[EVERYDAY,other],storage:memory(),prepare:()=>pending.promise});
 const selection=d.select('test-theme');d.suspend();pending.resolve({value:other,dispose:()=>disposed.push('cancelled')});assert.equal(await selection,false);
 assert.equal(d.state().active,'everyday');assert.equal(d.state().suspended,true);d.resume();assert.equal(d.state().suspended,false);assert.deepEqual(disposed,['failed','cancelled']);
});
test('a remembered supported theme is prepared before it becomes active',async()=>{
 const store=memory();store.setItem(THEME_STORAGE_KEY,'test-theme');const wait=deferred();let committed=false;
 const c=createMallThemeCoordinator({registry:[EVERYDAY,other],storage:store,prepare:()=>wait.promise,commit:()=>{committed=true;}});
 assert.equal(c.state().active,'everyday');const restoring=c.restore();assert.equal(c.state().active,'everyday');assert.equal(c.state().pending,'test-theme');
 wait.resolve({value:other,dispose(){}});assert.equal(await restoring,true);assert.equal(c.state().active,'test-theme');assert.equal(committed,true);
});
test('superseding or suspending preparation aborts the old signal',async()=>{
 const wait=deferred();let signal;const c=createMallThemeCoordinator({registry:[EVERYDAY,other],storage:memory(),prepare:(_theme,options)=>{signal=options.signal;return wait.promise;}});
 const pending=c.select('test-theme');assert.equal(signal.aborted,false);c.suspend();assert.equal(signal.aborted,true);
 wait.reject(new Error('aborted'));assert.equal(await pending,false);assert.equal(c.state().active,'everyday');assert.equal(c.state().pending,null);
});
test('closing a pending selection aborts and disposes its late result',async()=>{
 const wait=deferred();let signal,committed=false,disposed=false;
 const c=createMallThemeCoordinator({registry:[EVERYDAY,other],storage:memory(),prepare:(_theme,options)=>{signal=options.signal;return wait.promise;},commit:()=>{committed=true;}});
 const selection=c.select('test-theme');c.cancel();assert.equal(signal.aborted,true);assert.equal(c.state().pending,null);
 wait.resolve({value:other,dispose(){disposed=true;}});assert.equal(await selection,false);assert.equal(disposed,true);assert.equal(committed,false);assert.equal(c.state().active,'everyday');
});
test('validated visual roles update real scene targets atomically before a future theme is committed',()=>{
 const color=()=>({value:null,set(value){this.value=value;}});
 const material=()=>({color:color(),emissive:color(),map:null});
 const materials=Object.fromEntries(['shellFloor','shellCeiling','shellWall','green','ivory','brass','wood','oak','timber','timberAlt','glass','glow'].map(name=>[name,material()]));
 const ambient={color:color(),groundColor:color()},key={color:color()},fill={color:color()};
 const target={expanded:true,materials,ambient,key,fill};
 assert.equal(applyMallThemeToWorld(EVERYDAY,target),true);
 assert.equal(materials.shellFloor.color.value,EVERYDAY.materials.floorFlat);
 const next={...EVERYDAY,materials:{...EVERYDAY.materials,wall:0x112233,green:0x445566,glassOpacity:.4},lighting:{...EVERYDAY.lighting,fill:0x778899,fillIntensity:.7}};
 assert.equal(applyMallThemeToWorld(next,target),true);assert.equal(materials.shellWall.color.value,0x112233);assert.equal(materials.green.color.value,0x445566);assert.equal(materials.glass.opacity,.4);assert.equal(fill.color.value,0x778899);assert.equal(fill.intensity,.7);
 assert.equal(applyMallThemeToWorld({...next,materials:{...next.materials,wall:-1}},target),false);assert.equal(materials.shellWall.color.value,0x112233);
 assert.equal(applyMallThemeToWorld(next,{...target,expanded:false}),false);
});
