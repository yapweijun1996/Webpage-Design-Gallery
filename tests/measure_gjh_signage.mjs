// Optional CPU inspection using an already available Canvas 2D implementation.
// SIGNAGE_CANVAS points to @napi-rs/canvas. No browser, GL context or server.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {expandedLayout,shopEntrance} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {stores,resolveConfig} from '../demos/corporate/gjh/v11/assets/signage/config.js';
import {atlasSize} from '../demos/corporate/gjh/v11/assets/signage/atlas-layout.js';
import {bakeAtlas} from '../demos/corporate/gjh/v11/assets/signage/atlas.js';
import {createSignageSystem} from '../demos/corporate/gjh/v11/assets/signage/runtime.js';

const require=createRequire(import.meta.url);
const {createCanvas,Image}=require(process.env.SIGNAGE_CANVAS || '@napi-rs/canvas');
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
  const camera=new T.PerspectiveCamera(58,width/height,.08,100);
  for(const tier of ['low','balanced','detailed']){
    const scene=new T.Scene(),system=createSignageSystem(T,scene,configs,bays,bake,base);
    requests.length=0;
    let peakTriangles=0,peakBatches=0;
    for(const bay of bays){
      const e=shopEntrance(bay);
      camera.position.set(e.x+12*e.normalX,2.3,e.z+12*e.normalZ);
      camera.lookAt(e.x,4.78,e.z);camera.updateMatrixWorld();
      await system.update(camera,tier,{matches:true},0);
      system.update(camera,tier,{matches:true},0);
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
    console.log({width,height,tier,signs,peakBatches,peakTriangles,textureMiB:textureMB,modelsLoaded});
  }
}

if(process.argv[2]){
  // The renderer treats the colour atlas as opaque. Alpha is lighting metadata.
  const opaque=createCanvas(atlasSize,atlasSize),ox=opaque.getContext('2d');
  const rgba=bake.sheet.getContext('2d').getImageData(0,0,atlasSize,atlasSize);
  for(let i=3;i<rgba.data.length;i+=4)rgba.data[i]=255;
  ox.putImageData(rgba,0,0);
  const out=createCanvas(786,Math.ceil(configs.length/2)*76),ctx=out.getContext('2d');
  ctx.fillStyle='#252824';ctx.fillRect(0,0,out.width,out.height);
  const pixelsPerMetre=550/(24*Math.tan(58*Math.PI/360));
  configs.forEach((c,i)=>{
    const {x,y,w,h}=bake.tiles.get(c.id).cells.fascia;
    const width=c.size.width*pixelsPerMetre,height=c.size.height*pixelsPerMetre;
    ctx.drawImage(opaque,x,y,w,h,i%2*393+(393-width)/2,Math.floor(i/2)*76+10,width,height);
  });
  writeFileSync(process.argv[2],out.toBuffer('image/png'));
}
