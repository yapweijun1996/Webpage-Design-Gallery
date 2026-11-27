// Verify actual projected mesh vertices with software GL, without production test hooks.
const {chromium}=require(process.env.POMELO_PLAYWRIGHT || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const demo=path.resolve(__dirname,'../demos/corporate/pomelo-stem/v8');
const base=process.env.POMELO_BASE || 'http://127.0.0.1:8765/demos/corporate/pomelo-stem/v8/';
const capture=process.env.POMELO_CAPTURE;
if(capture)fs.mkdirSync(capture,{recursive:true});
let cases=0;
(async()=>{const b=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568]]){
const c=await b.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});const p=await c.newPage();
await p.route('**/hero3d/viewer.js',route=>{let s=fs.readFileSync(path.join(demo,'assets/js/hero3d/viewer.js'),'utf8');
s=s.replace('renderer.render(scene, camera);',`renderer.render(scene, camera);
const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
composed.root.updateMatrixWorld(true);
composed.root.traverse(object=>{const pos=object.geometry?.attributes.position;if(!pos)return;for(let i=0;i<pos.count;i++){
 const point=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(object.matrixWorld).project(camera);
 bounds.left=Math.min(bounds.left,point.x);bounds.right=Math.max(bounds.right,point.x);bounds.top=Math.min(bounds.top,point.y);bounds.bottom=Math.max(bounds.bottom,point.y);
}});window.__sceneBounds=bounds;`);return route.fulfill({body:s,contentType:'text/javascript'});});
await p.goto(base);await p.locator('.hero3d__button').click();await p.waitForSelector('[data-hero3d][data-state="ready"]',{timeout:60000});
const bounds=await p.evaluate(()=>__sceneBounds);
assert(bounds.left > -0.96 && bounds.right < 0.96 && bounds.top > -0.96 && bounds.bottom < 0.96, JSON.stringify({width,height,bounds}));
assert(await p.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
console.log(width,height,bounds);cases++;
for(const theme of ['light','dark']){await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);if(capture)await p.screenshot({path:path.join(capture,`framing-${width}-${theme}.png`)});}
await c.close();}await b.close();console.log(`PASS ${cases} scene framing cases; FAIL 0`)})().catch(e=>{console.error(e);process.exit(1)});
