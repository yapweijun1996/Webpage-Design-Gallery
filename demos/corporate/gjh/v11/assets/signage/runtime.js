import {createProgressiveAtlas} from './atlas.js';
import {mergeGeometries} from '../shop-sign-vendor.js';
import {createShopSign,letterGeometry} from './builder.js';
import {selectSignLod} from './config.js';
import {buildHardware,buildEndTrim} from './hardware.js';
import {loadModules} from './models.js';
import {phoneProof} from './phone-proof.js';
import {atlasSize,atlasMiB} from './atlas-layout.js';

function nearFaceMaterial(T,texture,pulse) {
  // The same atlas alpha channel supplies a height/emission mask. The flat
  // colour is always present, including outside the per-store detail radius.
  const material=new T.MeshBasicMaterial({map:texture,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.signPulse=pulse;
    shader.vertexShader='attribute vec4 signRange; attribute float signPulseEnabled; varying vec2 vSignEffect;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vSignEffect=vec2(float(distance(cameraPosition,signRange.xyz)<signRange.w),signPulseEnabled);`);
    shader.fragmentShader='uniform float signPulse; varying vec2 vSignEffect;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(vSignEffect.x>.5){
        float ink=texture2D(map,vMapUv).a;
        float bevel=ink-texture2D(map,vMapUv+vec2(-1.,1.)/${atlasSize.toFixed(1)}).a;
        outgoingLight *= 1.+bevel*.55+max(0.,2.*ink-1.)*(vec3(.065)+vec3(1.,.8,.5)*vSignEffect.y*signPulse);
      }
      #include <opaque_fragment>`);
  };
  return material;
}

// Fit an authored relief to its registered region of the actual ink artwork,
// retaining its aspect and named finish. The backing and official lockup stay baked.
function modelRelief(T,sign,module,mask,finishes){
  const meshes=[],bounds=new T.Box3();
  module.traverse(node=>{
    if(!node.isMesh)return;
    const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);
    geo.computeBoundingBox();bounds.union(geo.boundingBox);meshes.push({geo,material:node.material});
  });
  if(!meshes.length)return null;
  const {config,mount}=sign, {width:n,height:m}=mask;
  const [mx,my,mw,mh]=mask.markBounds;
  const x0=mx*n,x1=(mx+mw)*n,y0=my*m,y1=(my+mh)*m;
  const [u,v,w,h]=config.logoRegion??[0,0,1,1];
  const x=(x0+(x1-x0)*(u+w/2))/n, y=(y0+(y1-y0)*(v+h/2))/m;
  const size=bounds.getSize(new T.Vector3()), centre=bounds.getCenter(new T.Vector3());
  const scale=Math.min(config.size.width*(x1-x0)*w/n/size.x,config.size.height*(y1-y0)*h/m/size.y);
  const pieces=meshes.map(({geo:g,material})=>{
    const geometry=g.index?g.toNonIndexed():g;
    geometry.translate(-centre.x,-centre.y,-bounds.min.z);
    geometry.scale(scale,scale,Math.min(scale,.04/(size.z||1)));
    geometry.translate((x-.5)*config.size.width,mount.y+(.5-y)*config.size.height,mount.z+.002);
    const count=geometry.attributes.position.count;
    const index=finishes.indexOf(material);
    const finish=index<0?finishes.push(material):index+1;
    geometry.setAttribute('signSolid',new T.Uint8BufferAttribute(new Uint8Array(count).fill(finish),1));
    // Letter and solid ranges share one index buffer. Only lettering samples the atlas.
    geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(count*2),2));
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    if(g!==geometry)g.dispose();
    return geometry;
  });
  const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  const remaining=mask.ink.slice();
  for(let j=Math.floor(y0+(y1-y0)*v);j<y0+(y1-y0)*(v+h);j++)
    remaining.fill(0,j*n+Math.floor(x0+(x1-x0)*u),j*n+Math.ceil(x0+(x1-x0)*(u+w)));
  return {geometry:merged,remaining};
}

function reliefMaterial(T,texture,finishes){
  const mat=new T.MeshStandardMaterial({map:texture,color:0x5a5144,emissive:0xffffff,emissiveMap:texture,
    emissiveIntensity:.78,roughness:.35,metalness:.24,toneMapped:false});
  if(!finishes.length)return mat;
  // Index 0 uses the artwork material. Each solid selects its imported PBR
  // finish in the same draw, including its linear base and emissive colours.
  mat.customProgramCacheKey=()=>'sign-relief-'+finishes.length;
  mat.onBeforeCompile=shader=>{
    const count=finishes.length;
    shader.uniforms.solidBase={value:finishes.map(m=>m.color)};
    shader.uniforms.solidEmission={value:finishes.map(m=>m.emissive.clone().multiplyScalar(m.emissiveIntensity))};
    shader.uniforms.solidPbr={value:finishes.map(m=>new T.Vector2(m.metalness,m.roughness))};
    shader.vertexShader='attribute float signSolid; varying float vSolid;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSolid=signSolid;');
    shader.fragmentShader=`varying float vSolid; uniform vec3 solidBase[${count}],solidEmission[${count}];
      uniform vec2 solidPbr[${count}];\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <map_fragment>','#include <map_fragment>\nint solid=int(vSolid+.5)-1; if(solid>=0) diffuseColor=vec4(solidBase[solid],1.);')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif(solid>=0) roughnessFactor=solidPbr[solid].y;')
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nif(solid>=0) metalnessFactor=solidPbr[solid].x;')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nif(solid>=0) totalEmissiveRadiance=solidEmission[solid];');
  };
  return mat;
}

function* buildRelief(T,signs,tiles,modules,texture,detailed){
  const pieces=[],ranges=[],source=[],finishes=[];
  let offset=0;
  for(const sign of signs){
    const {mask,cells}=tiles.get(sign.config.id);
    const imported=mask.markBounds && modules.get(sign.config.logoModule);
    const model=imported && modelRelief(T,sign,imported,mask,finishes);
    const lettering=detailed && letterGeometry(T,model?{...mask,ink:model.remaining}:mask,sign.config,sign.mount,cells.fascia);
    if(lettering)lettering.setAttribute('signSolid',new T.Uint8BufferAttribute(lettering.attributes.position.count,1));
    const start=source.length;
    for(const g of [model?.geometry,lettering]){
      if(!g)continue;
      const count=g.attributes.position.count;
      for(let i=0;i<(g.index?.count??count);i++)source.push(offset+(g.index?g.index.getX(i):i));
      offset+=count;g.setIndex(null);g.applyMatrix4(sign.matrix);pieces.push(g);
    }
    ranges.push([start,source.length]);
    yield;
  }
  if(!pieces.length)return null;
  const geo=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  const Index=offset>65535?Uint32Array:Uint16Array;
  const original=new Index(source),index=new T.BufferAttribute(new Index(source.length),1);
  index.setUsage(T.DynamicDrawUsage);geo.setIndex(index);geo.setDrawRange(0,0);
  const mat=reliefMaterial(T,texture,finishes);
  const mesh=new T.Mesh(geo,mat);mesh.frustumCulled=false;mesh.name='Near sign letter relief';
  return {mesh,select(visible){
    let count=0;
    for(const i of visible){const [a,b]=ranges[i];index.array.set(original.subarray(a,b),count);count+=b-a;}
    index.clearUpdateRanges();
    if(count){
      index.addUpdateRange(0,count);
      index.needsUpdate=true;
    }
    geo.setDrawRange(0,count);mesh.visible=count>0;
  }};
}

export function createSignageSystem(T,scene,configs,bays,bake,assetBase){
  const pulse={value:0};
  function atlas(canvas) {
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;
    texture.generateMipmaps=true;
    texture.minFilter=T.LinearMipmapLinearFilter;
    texture.anisotropy=2;
    return texture;
  }
  const lowTexture=atlas(bake.lowSheet), fullAtlas=createProgressiveAtlas(T,bake.sheet);
  const flat=new T.MeshBasicMaterial({map:lowTexture,toneMapped:false});
  const pieces=[],signs=[];
  configs.forEach((config,index)=>{
    const group=createShopSign(T,{...config,faceMaterial:flat},bays[index]);
    const matrix=group.matrixWorld,mount=group.userData.mount;
    const centre=new T.Vector3(0,mount.y,mount.z).applyMatrix4(matrix);
    const hardwareMatrix=matrix.clone().multiply(new T.Matrix4().makeTranslation(0,mount.y,mount.z));
    const geo=group.children[0].geometry.applyMatrix4(matrix),n=geo.attributes.position.count;
    const ranges=new Float32Array(n*4),pulses=new Float32Array(n);
    for(let i=0;i<4;i++){
      ranges.set([centre.x,centre.y,centre.z,config.lodDistance],4*i);
      pulses[i]=Number(config.pulse && config.backlight!=='none');
    }
    geo.setAttribute('signRange',new T.Float32BufferAttribute(ranges,4));
    geo.setAttribute('signPulseEnabled',new T.Float32BufferAttribute(pulses,1));pieces.push(geo);
    const hasEndTrim=config.finish==='timber-slat' || config.preset==='t3-cafe';
    signs.push({config,matrix,mount,hardwareMatrix,centre,hasEndTrim,sphere:new T.Sphere(centre,config.size.width/2+.6)});
  });
  const faces=new T.Mesh(mergeGeometries(pieces),flat);pieces.forEach(g=>g.dispose());
  faces.name='Expanded branded shop signs';faces.layers.enable(1);scene.add(faces);
  const frustum=new T.Frustum(),view=new T.Matrix4(),eye=new T.Vector3(),near=[];
  const low={tier:'low',faces,meshes:[faces]};
  let active=low,signature=-1,modules=null,moduleTask;
  let calls=0,tris=0;
  function measure(mesh){
    let beforeCalls=0,beforeTriangles=0;
    mesh.onBeforeRender=renderer=>{
      beforeCalls=renderer.info.render.calls;
      beforeTriangles=renderer.info.render.triangles;
    };
    mesh.onAfterRender=renderer=>{
      calls+=renderer.info.render.calls-beforeCalls;
      tris+=renderer.info.render.triangles-beforeTriangles;
    };
  }
  measure(faces);
  function release(stage, keep) {
    if (!stage || stage===keep) return;
    const texture=stage.faces.material.map;
    if(texture!==keep.faces.material.map){
      texture.dispose();
      texture.needsUpdate=true;
    }
    if(stage===low)return;
    for(const pool of [stage.hardware,stage.endTrim,stage.relief])if(pool){
      pool.mesh.geometry.dispose();pool.mesh.material.dispose();pool.mesh.dispose?.();
    }
    stage.faces.material.dispose();
  }
  function activate(stage) {
    if(stage===active)return;
    scene.remove(...active.meshes);
    release(active,stage);
    active=stage;signature=-1;
    scene.add(...stage.meshes);
  }
  // Build the exact drawable pools off-scene. The owner commits only after
  // their buffers, programs and textures pass the same fence as the mall.
  function* prepareTier(tier, renderer) {
    if(tier!=='balanced' && tier!=='detailed')tier='low';
    if(tier===active.tier)return active;
    if(tier==='low')return low;
    moduleTask??=loadModules(assetBase).then(loaded=>{modules=loaded;},()=>{modules=new Map();});
    while(!modules)yield false;
    const texture=fullAtlas.texture, face=new T.Mesh(faces.geometry,nearFaceMaterial(T,texture,pulse));
    face.name=faces.name;face.layers.mask=faces.layers.mask;measure(face);
    const stage={tier,faces:face,meshes:[face]};
    let complete=false;
    try {
      if (renderer) yield* fullAtlas.upload(renderer);
      const detailed=tier==='detailed';
      stage.hardware=buildHardware(T,modules,detailed,signs.length);
      signs.forEach((sign,i)=>stage.hardware.set(i,sign));
      stage.hardware.commit(signs.length);
      yield;
      const ends=signs.filter(sign=>sign.hasEndTrim);
      if(ends.length){
        stage.endTrim=buildEndTrim(T,modules,signs.length);
        ends.forEach((sign,i)=>{stage.endTrim.set(i*2,sign,-1);stage.endTrim.set(i*2+1,sign,1);});
        stage.endTrim.commit(ends.length*2);
        yield;
      }
      stage.relief=yield* buildRelief(T,signs,bake.tiles,modules,texture,detailed);
      stage.relief?.select(signs.map((_,i)=>i));
      for(const pool of [stage.hardware,stage.endTrim,stage.relief])if(pool){
        measure(pool.mesh);stage.meshes.push(pool.mesh);
      }
      complete=true;
      return stage;
    } finally { if(!complete)release(stage,active); }
  }
  return {prepareTier,activate,discard(stage){release(stage,active);},
    activeMeshes(){return active.meshes;}, getTier(){return active.tier;}, recover(){activate(low);},
    update(camera,reducedMotion,now){
    calls=tris=0;
    const {tier,hardware,endTrim,relief}=active;
    if(tier==='low')return;
    frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    eye.setFromMatrixPosition(camera.matrixWorld);
    let bits=0;near.length=0;
    for(let i=0;i<signs.length;i++){
      const s=signs[i];
      if(!frustum.intersectsSphere(s.sphere))continue;
      if(selectSignLod(tier,s.centre.distanceTo(eye),true,s.config.lodDistance)==='baked')continue;
      near.push(i);bits|=1<<i;
    }
    pulse.value=near.length && !reducedMotion?.matches ? .024*Math.sin(now*.0012):0;
    if(bits===signature)return;
    signature=bits;
    near.forEach((i,n)=>hardware.set(n,signs[i]));hardware.commit(near.length);
    let ends=0;
    for(const i of near){
      const sign=signs[i];
      if(sign.hasEndTrim){
        endTrim.set(ends++,sign,-1);endTrim.set(ends++,sign,1);
      }
    }
    endTrim?.commit(ends);
    relief?.select(near);
  },report(){
    const atlasPx=active.faces.material.map.image.width;
    return {modelsLoaded:modules?.size??0,signs:signs.length,drawCalls:calls,triangles:tris,
      phoneProof:phoneProof(active.tier),previousTextureMB:atlasMiB(atlasSize),atlasPx,textureMB:atlasMiB(atlasPx),tier:active.tier};
  }};
}
