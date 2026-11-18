import {mergeGeometries} from '../shop-sign-vendor.js';
import {createShopSign,letterGeometry,uvRect} from './builder.js';
import {selectSignLod} from './config.js';
import {buildHardware} from './hardware.js';
import {loadModules,modelFiles} from './models.js';
import {atlasSize} from './atlas-layout.js';

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
// retaining its aspect and UV colour. The backing and official lockup stay baked.
function modelRelief(T,sign,module,mask,cell){
  const meshes=[],bounds=new T.Box3();
  module.traverse(node=>{
    if(!node.isMesh)return;
    const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);
    geo.computeBoundingBox();bounds.union(geo.boundingBox);meshes.push(geo);
  });
  if(!meshes.length)return null;
  const {config,mount}=sign, {width:n,height:m}=mask;
  const [mx,my,mw,mh]=mask.markBounds;
  const x0=mx*n,x1=(mx+mw)*n,y0=my*m,y1=(my+mh)*m;
  const [u,v,w,h]=config.logoRegion??[0,0,1,1];
  const x=(x0+(x1-x0)*(u+w/2))/n, y=(y0+(y1-y0)*(v+h/2))/m;
  const size=bounds.getSize(new T.Vector3()), centre=bounds.getCenter(new T.Vector3());
  const scale=Math.min(config.size.width*(x1-x0)*w/n/size.x,config.size.height*(y1-y0)*h/m/size.y);
  const [left,bottom,right,top]=uvRect(cell);
  const pieces=meshes.map(g=>{
    const geometry=g.index?g.toNonIndexed():g;
    geometry.translate(-centre.x,-centre.y,-bounds.min.z);
    geometry.scale(scale,scale,Math.min(scale,.04/(size.z||1)));
    geometry.translate((x-.5)*config.size.width,mount.y+(.5-y)*config.size.height,mount.z+.002);
    const pos=geometry.attributes.position,uv=[];
    for(let i=0;i<pos.count;i++){
      uv.push(left+(right-left)*(.5+pos.getX(i)/config.size.width),
        bottom+(top-bottom)*(.5+(pos.getY(i)-mount.y)/config.size.height));
    }
    for(const key of Object.keys(geometry.attributes))if(key!=='position' && key!=='normal')geometry.deleteAttribute(key);
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
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

function buildRelief(T,signs,tiles,modules,texture){
  const pieces=[],ranges=[],source=[];
  let offset=0;
  for(const sign of signs){
    const {mask,cells}=tiles.get(sign.config.id);
    const imported=mask.markBounds && modules.get(sign.config.logoModule);
    const model=imported && modelRelief(T,sign,imported,mask,cells.fascia);
    const lettering=letterGeometry(T,model?{...mask,ink:model.remaining}:mask,sign.config,sign.mount,cells.fascia);
    const start=source.length;
    for(const g of [model?.geometry,lettering]){
      if(!g)continue;
      const count=g.attributes.position.count;
      for(let i=0;i<(g.index?.count??count);i++)source.push(offset+(g.index?g.index.getX(i):i));
      offset+=count;g.setIndex(null);g.applyMatrix4(sign.matrix);pieces.push(g);
    }
    ranges.push([start,source.length]);
  }
  if(!pieces.length)return null;
  const geo=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  const Index=offset>65535?Uint32Array:Uint16Array;
  const original=new Index(source),index=new T.BufferAttribute(new Index(source.length),1);
  index.setUsage(T.DynamicDrawUsage);geo.setIndex(index);geo.setDrawRange(0,0);
  const mat=new T.MeshStandardMaterial({map:texture,color:0x5a5144,emissive:0xffffff,emissiveMap:texture,
    emissiveIntensity:.78,roughness:.35,metalness:.24,toneMapped:false});
  const mesh=new T.Mesh(geo,mat);mesh.frustumCulled=false;mesh.name='Near sign letter relief';
  return {mesh,select(visible){
    let count=0;
    for(const i of visible){const [a,b]=ranges[i];index.array.set(original.subarray(a,b),count);count+=b-a;}
    index.needsUpdate=true;geo.setDrawRange(0,count);mesh.visible=count>0;
  }};
}

export function createSignageSystem(T,scene,configs,bays,bake,assetBase){
  const texture=new T.CanvasTexture(bake.sheet);texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=2;
  const flat=new T.MeshBasicMaterial({map:texture,toneMapped:false}),pulse={value:0};
  const embossed=nearFaceMaterial(T,texture,pulse);
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
    signs.push({config,matrix,mount,hardwareMatrix,centre,sphere:new T.Sphere(centre,config.size.width/2+.6)});
  });
  const faces=new T.Mesh(mergeGeometries(pieces),flat);pieces.forEach(g=>g.dispose());
  faces.name='Expanded branded shop signs';faces.layers.enable(1);scene.add(faces);
  const frustum=new T.Frustum(),view=new T.Matrix4(),eye=new T.Vector3(),near=[];
  let tier='low',signature=-1,hardware=null,relief=null,modules=new Map(),moduleTask;
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
  function discard(pool){
    if(!pool)return;
    scene.remove(pool.mesh);pool.mesh.geometry.dispose();pool.mesh.material.dispose();
    pool.mesh.dispose?.();
  }
  function rebuild(next){
    discard(hardware);discard(relief);hardware=relief=null;
    faces.material=next==='low'?flat:embossed;
    if(next!=='low'){
      hardware=buildHardware(T,modules,next==='detailed',signs.length);
      if(next==='detailed')relief=buildRelief(T,signs,bake.tiles,modules,texture);
      for(const pool of [hardware,relief])if(pool){pool.mesh.visible=false;measure(pool.mesh);scene.add(pool.mesh);}
    }
    tier=next;signature=-1;
  }
  return {update(camera,requestedTier,reducedMotion,now){
    calls=tris=0;
    const next=['balanced','detailed'].includes(requestedTier)?requestedTier:'low';
    if(tier!==next)rebuild(next);
    if(next==='low')return;
    if(modelFiles.length && !moduleTask){
      moduleTask=loadModules(assetBase).then(loaded=>{
        if(loaded.size){modules=loaded;rebuild(tier);}
      });
    }
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
    relief?.select(near);
  },report(){
    const pixels=texture.image.width*texture.image.height;
    return {signs:signs.length,drawCalls:calls,triangles:tris,textureMB:+(pixels*4*4/3/1048576).toFixed(2),tier};
  }};
}
