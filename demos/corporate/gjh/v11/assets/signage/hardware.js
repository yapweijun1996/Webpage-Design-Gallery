import {materials} from './tokens.js';

// Bake a reusable nominal frame. Per-vertex edge anchors move its corners
// rigidly as bay widths change. The shader stretches only the intervening rails.
export function buildHardware(T,modules,detailed,capacity) {
  const vertices=[],normals=[],colors=[],pbr=[],emission=[],anchors=[];
  const baseW=7,baseH=1.36;
  const cube=new T.BoxGeometry(), lamp=new T.CylinderGeometry(.5,.5,1,10);
  function part(id,x,y,z,w,h,d,ax,ay,stretch,blade,fallback,rotation=0) {
    const module=modules.get(id), pieces=[];
    if(module){
      module.traverse(mesh=>{
        if(mesh.isMesh)pieces.push({g:mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),mat:mesh.material.name});
      });
    }
    if(!pieces.length)pieces.push({g:(id==='sign_downlight'?lamp:cube).clone(),mat:fallback});
    const bounds=new T.Box3();
    for(const {g} of pieces){
      if(module && id==='sign_blade_bracket')g.rotateY(-Math.PI/2);
      g.rotateZ(rotation);g.computeBoundingBox();bounds.union(g.boundingBox);
    }
    const centre=bounds.getCenter(new T.Vector3()), size=bounds.getSize(new T.Vector3());
    for(const {g,mat} of pieces){
      const geom=g.index?g.toNonIndexed():g;
      geom.translate(-centre.x,-centre.y,-centre.z);
      geom.scale(w/(size.x||1),h/(size.y||1),d/(size.z||1));
      if(!geom.attributes.normal)geom.computeVertexNormals();
      const spec=materials[mat]??materials[fallback];
      const position=geom.attributes.position,normal=geom.attributes.normal;
      for(let i=0;i<position.count;i++){
        const vx=position.getX(i),vy=position.getY(i);
        vertices.push(x+vx,y+vy,z+position.getZ(i));
        normals.push(normal.getX(i),normal.getY(i),normal.getZ(i));
        colors.push(...spec.baseColorFactor.slice(0,3));
        pbr.push(spec.metallicFactor,spec.roughnessFactor,0);emission.push(...spec.emissiveFactor);
        anchors.push(stretch==='width'||stretch==='both'?vx/w:ax,stretch==='height'||stretch==='both'?vy/h:ay,blade?1:0);
      }
      geom.dispose();if(geom!==g)g.dispose();
    }
  }
  const corner=.09;
  for(const side of [-1,1]){
    part('sign_frame_edge_h',0,side*(baseH/2-.022),.018,baseW-2*corner,.032,.029,0,side/2,'width',false,'brass_trim');
    part('sign_frame_edge_v',side*(baseW/2-.022),0,.018,.032,baseH-2*corner,.029,side/2,0,'height',false,'brass_trim');
    for(const end of [-1,1])
      part('sign_frame_corner',side*(baseW/2-corner/2),end*(baseH/2-corner/2),.018,
        corner,corner,.036,side/2,end/2,null,false,'brass_trim',
        side<0?(end<0?0:-Math.PI/2):(end<0?Math.PI/2:Math.PI));
  }
  part('sign_blade_bracket',-baseW/2+.24,-.427,.46,.042,.055,.94,-.5,0,null,true,'brass_trim');
  if(modules.has('sign_backplate'))
    part('sign_backplate',0,0,-.031,baseW,baseH,.06,0,0,'both',false,'lacquer_fascia');
  if(detailed)for(const a of [-.33,0,.33])
    part('sign_downlight',a*baseW,baseH/2-.062,.035,.10,.038,.06,a,.5,null,false,'emissive_letter');
  cube.dispose();lamp.dispose();
  const g=new T.BufferGeometry();
  for(const [name,values] of Object.entries({position:vertices,normal:normals,color:colors,signAnchor:anchors,signFinish:pbr,signEmission:emission}))
    g.setAttribute(name,new T.Float32BufferAttribute(values,3));
  const dimensions=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3);
  g.setAttribute('signSize',dimensions);
  const mat=new T.MeshStandardMaterial({vertexColors:true,metalness:1,roughness:1});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec3 signAnchor, signFinish, signSize, signEmission; varying vec3 vFinish, vSignEmission;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.xy += signAnchor.xy * signSize.xy;
      if(signAnchor.z > .5 && signSize.z < .5) transformed = vec3(0.);
      vFinish=signFinish;vSignEmission=signEmission;`);
    shader.fragmentShader='varying vec3 vFinish, vSignEmission;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor *= vFinish.x;')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor *= vFinish.y;')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vSignEmission;');
  };
  const mesh=new T.InstancedMesh(g,mat,capacity);
  // Visibility is selected per sign before instances are uploaded.
  mesh.frustumCulled=false;mesh.count=0;mesh.name='Instanced sign hardware';
  return {mesh,set(index,sign){
    mesh.setMatrixAt(index,sign.hardwareMatrix);
    dimensions.setXYZ(index,sign.config.size.width-baseW,sign.config.size.height-baseH,Number(sign.config.blade));
  },commit(count){
    mesh.count=count;mesh.visible=count>0;
    mesh.instanceMatrix.needsUpdate=true;dimensions.needsUpdate=true;
  }};
}
