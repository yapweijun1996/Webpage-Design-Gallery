// Optional CPU inspection using an already available Canvas 2D implementation.
// SIGNAGE_CANVAS points to @napi-rs/canvas. No browser, GL context or server.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {expandedLayout,shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {playerCameraFraming} from '../demos/corporate/gjh/v11/assets/player.js';
import {stores,resolveConfig} from '../demos/corporate/gjh/v11/assets/signage/config.js';
import {atlasSize} from '../demos/corporate/gjh/v11/assets/signage/atlas-layout.js';
import {bakeAtlas} from '../demos/corporate/gjh/v11/assets/signage/atlas.js';
import {phoneProof} from '../demos/corporate/gjh/v11/assets/signage/phone-proof.js';
import {createSignageSystem} from '../demos/corporate/gjh/v11/assets/signage/runtime.js';

const require=createRequire(import.meta.url);
const {createCanvas,Image,loadImage}=require(process.env.SIGNAGE_CANVAS || '@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(value){super.src=value instanceof URL?readFileSync(value):value;}
};
const base=new URL('../demos/corporate/gjh/v11/assets/',import.meta.url);
const json=p=>JSON.parse(readFileSync(new URL(p,base)));
const kit=json('brand-kit/brand-kit.json'),logos=json('brands/logo-sources.json');
const bays=expandedLayout.slots;
const configs=bays.map(b=>resolveConfig('S'+b.number,stores['S'+b.number],b,kit,logos));
const bake=await bakeAtlas(configs,base);
const expectedFiles=json('signage/models/manifest.json').assets.map(a=>a.file);
const requests=[];
globalThis.fetch=async url=>{
  requests.push(url.href);
  return new Response(readFileSync(url));
};

for(const [width,height] of [[393,550],[1440,817]]){
  const camera=new T.PerspectiveCamera(playerCameraFraming('gjh-tripo-visitor',true,width,height).fov,width/height,.08,100);
  for(const tier of ['low','balanced','detailed']){
    const scene=new T.Scene(),system=createSignageSystem(T,scene,configs,bays,bake,base);
    requests.length=0;
    const work=system.prepareTier(tier);
    for(let step=work.next();;step=work.next()){
      if(step.done){system.activate(step.value);break;}
      if(step.value===false)await new Promise(resolve=>setImmediate(resolve));
    }
    let peakTriangles=0,peakBatches=0;
    for(const bay of bays){
      const e=shopEntrance(bay);
      camera.position.set(e.x+12*e.normalX,2.3,e.z+12*e.normalZ);
      camera.lookAt(e.x,4.78,e.z);camera.updateMatrixWorld();
      system.update(camera,{matches:true},0);
      const visible=scene.children.filter(mesh=>mesh.visible);
      const triangles=visible.reduce((sum,mesh)=>{
        const g=mesh.geometry,count=g.index?.count??g.attributes.position.count;
        return sum+Math.min(g.drawRange.count,count)/3*(mesh.isInstancedMesh?mesh.count:1);
      },0);
      peakTriangles=Math.max(peakTriangles,triangles);peakBatches=Math.max(peakBatches,visible.length);
    }
    const {modelsLoaded,textureMB,signs}=system.report();
    const expected=tier==='low'?[]:expectedFiles.map(f=>new URL('signage/models/'+f,base).href);
    assert.deepEqual([...requests].sort(),expected.sort());
    assert.equal(modelsLoaded,expected.length);
    assert.equal(system.report().previousTextureMB,21.33);
    assert.equal(textureMB,tier==='low'?5.33:21.33);
    console.log({width,height,tier,signs,peakBatches,peakTriangles,textureMiB:textureMB,modelsLoaded});
  }
}

const phoneFov=playerCameraFraming('gjh-tripo-visitor',true,393,550).fov;
const proofScale=Math.tan(58*Math.PI/360)/Math.tan(phoneFov*Math.PI/360);
function proof(sheet,fov=phoneFov){
  const size=sheet.width, scale=size/atlasSize;
  // The renderer treats the colour atlas as opaque. Alpha is lighting metadata.
  const opaque=createCanvas(size,size),ox=opaque.getContext('2d');
  const rgba=sheet.getContext('2d').getImageData(0,0,size,size);
  for(let i=3;i<rgba.data.length;i+=4)rgba.data[i]=255;
  ox.putImageData(rgba,0,0);
  const out=createCanvas(786,Math.ceil(configs.length/2)*76),ctx=out.getContext('2d');
  ctx.fillStyle='#252824';ctx.fillRect(0,0,out.width,out.height);
  const pixelsPerMetre=550/(24*Math.tan(fov*Math.PI/360));
  configs.forEach((c,i)=>{
    const {x,y,w,h}=bake.tiles.get(c.id).cells.fascia;
    const width=c.size.width*pixelsPerMetre,height=c.size.height*pixelsPerMetre;
    ctx.drawImage(opaque,x*scale,y*scale,w*scale,h*scale,i%2*393+(393-width)/2,Math.floor(i/2)*76+10,width,height);
  });
  return out;
}

const lowProof=proof(bake.lowSheet);
if(process.argv[2])writeFileSync(process.argv[2],lowProof.toBuffer('image/png'));

// Windows in the 1:1 CSS-size proof isolate a name glyph from outlines,
// borders, adjacent letters and taglines. S04's full logo was enlarged.
const ink={
  yellow:(r,g,b)=>r>155 && g>140 && b<100,
  dark:(r,g,b)=>Math.max(r,g,b)<130,
  blue:(r,g,b)=>b>r*1.28 && r<100,
  white:(r,g,b)=>Math.min(r,g,b)>165,
  cream:(r,g,b)=>r>205 && g>174 && b>132,
  red:(r,g,b)=>r>g*1.35+26 && r>b*1.18+8,
  grey:(r,g,b)=>Math.max(r,g,b)<150,
  orange:(r,g,b)=>r>170 && g>65 && b<90
};
const samples=[
  ['e','yellow',157,24,175,56], ['m','yellow',578,25,586,43],
  ['O','dark',165,98,190,135], ['o','white',533,96,545,113],
  ['e','cream',180,178,194,207], ['W','red',584,190,599,211],
  ['u','cream',197,249,219,286], ['S','red',565,250,575,280],
  ['S','white',193,326,214,360], ['a','cream',598,322,606,343],
  ['o','cream',203,401,226,440], ['e','cream',613,401,633,439],
  ['O','dark',139,473,191,516], ['G','grey',614,476,638,512],
  ['A','blue',143,547,190,592], ['e','white',602,560,611,581],
  ['a','orange',188,621,209,666]
];
function inkHeight(ctx,[,colour,x0,y0,x1,y1]){
  const {data,width,height}=ctx.getImageData(x0,y0,x1-x0,y1-y0);
  let top=height,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=4*(y*width+x);
    if(ink[colour](data[i],data[i+1],data[i+2])){top=Math.min(top,y);bottom=y;}
  }
  return Math.max(0,bottom-top+1);
}
const baseline=await loadImage(readFileSync(new URL('../docs/evidence/gjh-v11-signage-fascias.png',import.meta.url)));
const before=createCanvas(baseline.width,baseline.height).getContext('2d');
function projection(i,x,y){
  const cx=(i%2+.5)*393,top=Math.floor(i/2)*76+10;
  return [cx+(x-cx)*proofScale,top+(y-top)*proofScale];
}
for(let i=0;i<samples.length;i++){
  const x=i%2*393,y=Math.floor(i/2)*76+10,[left,top]=projection(i,x,y);
  before.drawImage(baseline,x,y,393,60,left,top,393*proofScale,60*proofScale);
}
function windowAtPhone(i,[glyph,colour,x0,y0,x1,y1]){
  const [x,y]=projection(i,x0,y0),[right,bottom]=projection(i,x1,y1);
  return [glyph,colour,Math.floor(x),Math.floor(y),Math.ceil(right),Math.ceil(bottom)];
}
const after=lowProof.getContext('2d'),full=proof(bake.sheet).getContext('2d');
// Refit captions move individual glyphs. These windows use the live phone
// projection directly. The archived proof keeps its original chart registration.
const movedGlyphs={
  S01:['e','yellow',175,22,185,43], S02:['m','yellow',575,19,586,34], S04:['o','cream',576,98,588,118],
  S05:['e','cream',157,171,167,190], S10:['a','cream',585,317,593,334],
  S11:['o','cream',202,399,216,423], S16:['e','white',636,554,644,572]
};
console.log({phoneFov,pixelsPerMetre:550/(24*Math.tan(phoneFov*Math.PI/360))});
for(const [i,sample] of samples.entries()){
  const oldSample=i===3?['o','white',540,96,550,113]:sample, id=configs[i].id;
  const current=movedGlyphs[id]??windowAtPhone(i,sample);
  const previous=inkHeight(before,windowAtPhone(i,oldSample));
  const low=inkHeight(after,current),high=inkHeight(full,current);
  console.log(id,configs[i].brand,sample[0],previous,low,high);
  assert.ok(low>=10,id+' phone fascia ink below 10 CSS px');
  if(process.platform==='darwin'){
    assert.equal(phoneProof('low').verticalFovDeg,+phoneFov.toFixed(3));
    assert.deepEqual(phoneProof('low').glyphs[id],{previousCssPx:previous,activeAtlasCssPx:low});
    assert.equal(phoneProof('balanced').glyphs[id].activeAtlasCssPx,high);
  }
}
