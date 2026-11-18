import {materials} from './tokens.js';
import {bladeSocket} from './builder.js';
import manifest from './models/manifest.json' with {type:'json'};

const baseW=7, baseH=1.36;
const {cornerMetres:corner,railWidthMetres:rail,backplateDepthMetres:plateDepth}=manifest.frame;
const sizes=new Map(manifest.assets.map(asset=>[asset.name,asset.sizeMetres]));

// Each vertex follows an edge anchor or stretches along a straight run. Native
// corners, extrusion depths and rail profiles survive the per-bay size change.
function buildBatch(T,modules,capacity,name,assemble) {
  const vertices=[],normals=[],colors=[],pbr=[],emission=[],anchors=[];
  const cube=new T.BoxGeometry(), lamp=new T.CylinderGeometry(.5,.5,1,10);
  const leaf=new T.OctahedronGeometry(.5);
  function part(id,centre,target,anchor,stretch,finish,{roll=0,yaw=0,flag=0,fallback=cube}={}) {
    const pieces=[],bounds=new T.Box3();
    modules.get(id)?.traverse(node=>{
      if(node.isMesh)pieces.push({g:node.geometry.clone().applyMatrix4(node.matrixWorld),finish:node.material.name});
    });
    if(!pieces.length)pieces.push({g:fallback.clone(),finish});
    for(const {g} of pieces){
      g.rotateY(yaw);g.rotateZ(roll);g.computeBoundingBox();bounds.union(g.boundingBox);
    }
    const mid=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    for(const piece of pieces){
      const g=piece.g.index?piece.g.toNonIndexed():piece.g;
      g.translate(-mid.x,-mid.y,-mid.z);
      g.scale(target[0]/size.x,target[1]/size.y,target[2]/size.z);
      const position=g.attributes.position,normal=g.attributes.normal;
      const spec=materials[piece.finish];
      function vertex(i,normalSign){
        const x=position.getX(i),y=position.getY(i);
        vertices.push(centre[0]+x,centre[1]+y,centre[2]+position.getZ(i));
        normals.push(normalSign*normal.getX(i),normalSign*normal.getY(i),normalSign*normal.getZ(i));
        colors.push(...spec.baseColorFactor.slice(0,3));
        pbr.push(spec.metallicFactor,spec.roughnessFactor,0);emission.push(...spec.emissiveFactor);
        anchors.push(stretch.includes('x')?x/target[0]:anchor[0],stretch.includes('y')?y/target[1]:anchor[1],flag);
      }
      for(let i=0;i<position.count;i++)vertex(i,1);
      // The folded ivy leaves are double-sided. Keep one front-sided draw for
      // the hardware and supply the leaves' reverse winding and normals here.
      if(spec.doubleSided)for(let i=position.count-1;i>=0;i--)vertex(i,-1);
      g.dispose();if(g!==piece.g)piece.g.dispose();
    }
  }
  assemble(part,{lamp,leaf});
  cube.dispose();lamp.dispose();leaf.dispose();
  const g=new T.BufferGeometry();
  for(const [attribute,values] of Object.entries({position:vertices,normal:normals,color:colors,signAnchor:anchors,signFinish:pbr,signEmission:emission}))
    g.setAttribute(attribute,new T.Float32BufferAttribute(values,3));
  const dimensions=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4);
  dimensions.setUsage(T.DynamicDrawUsage);
  g.setAttribute('signSize',dimensions);
  const mat=new T.MeshStandardMaterial({vertexColors:true,metalness:1,roughness:1});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec3 signAnchor, signFinish, signEmission; attribute vec4 signSize; varying vec3 vFinish, vSignEmission;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.xy += signAnchor.xy * signSize.xy;
      if ((signAnchor.z == 1. && signSize.z < .5) || (signAnchor.z == 2. && signSize.w < .5)) transformed = vec3(0.);
      vFinish=signFinish;vSignEmission=signEmission;`);
    shader.fragmentShader='varying vec3 vFinish, vSignEmission;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor *= vFinish.x;')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor *= vFinish.y;')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vSignEmission;');
  };
  const mesh=new T.InstancedMesh(g,mat,capacity);
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.frustumCulled=false;mesh.count=0;mesh.name=name;
  return {mesh,setInstance(index,matrix,dw,dh,first,second){
    mesh.setMatrixAt(index,matrix);
    dimensions.setXYZW(index,dw,dh,Number(first),Number(second));
  },commit(count){
    mesh.count=count;mesh.visible=count>0;
    for(const attribute of [mesh.instanceMatrix,dimensions]){
      attribute.clearUpdateRanges();
      if(count){
        attribute.addUpdateRange(0,count*attribute.itemSize);
        attribute.needsUpdate=true;
      }
    }
  }};
}

export function buildHardware(T,modules,detailed,capacity) {
  const batch=buildBatch(T,modules,capacity,'Instanced sign hardware',(part,{lamp})=>{
    // The atlas face is at z=0, 1 mm in front of the lacquer.
    const back=-plateDepth-.001, trimDepth=sizes.get('sign_frame_corner')[2];
    const z=back+trimDepth/2;
    part('sign_backplate',[0,0,back+plateDepth/2],[baseW,baseH,plateDepth],[0,0],'xy','lacquer_fascia');
    for(const side of [-1,1]){
      part('sign_frame_edge_h',[0,side*(baseH-rail)/2,z],[baseW-2*corner,rail,trimDepth],
        [0,side/2],'x','brass_trim',{roll:side===1?Math.PI:0});
      part('sign_frame_edge_v',[side*(baseW-rail)/2,0,z],[rail,baseH-2*corner,trimDepth],
        [side/2,0],'y','brass_trim',{roll:side===1?Math.PI:0});
      for(const end of [-1,1]){
        const roll=side<0?(end<0?0:-Math.PI/2):(end<0?Math.PI/2:Math.PI);
        part('sign_frame_corner',[side*(baseW-corner)/2,end*(baseH-corner)/2,z],
          [corner,corner,trimDepth],[side/2,end/2],'','brass_trim',{roll});
      }
    }
    const {inset,drop,reach,height,thickness}=bladeSocket;
    const x=-baseW/2+inset, blade={yaw:-Math.PI/2,flag:1};
    part('sign_blade_panel',[x,-drop,reach/2],[thickness,height,reach],[-.5,0],'','brass_plate',blade);
    const [,armH,armD]=sizes.get('sign_blade_bracket');
    part('sign_blade_bracket',[x,-drop+height/2+armH*.1,reach/2],[armD,armH,reach],[-.5,0],'','gunmetal',blade);
    const light=sizes.get('sign_downlight');
    if(detailed)for(const a of [-.33,0,.33])
      part('sign_downlight',[a*baseW,(baseH-light[1])/2,light[2]/2],light,[a,.5],'','emissive_letter',{fallback:lamp});
  });
  return {...batch,set(index,{config,hardwareMatrix}){
    batch.setInstance(index,hardwareMatrix,config.size.width-baseW,config.size.height-baseH,config.blade,false);
  }};
}

// The same narrow assembly is instanced at both ends of each café fascia,
// leaving the official lockup in the middle unobstructed.
export function buildEndTrim(T,modules,capacity) {
  const batch=buildBatch(T,modules,capacity*2,'Instanced sign end trim',(part,{leaf})=>{
    for(const x of [-.102,0,.102])
      part('sign_timber_slat',[x,0,.012],[.09,baseH-.14,.02],[0,0],'y','timber_slat',{flag:1});
    const top=baseH/2-.08;
    if(modules.has('sign_ivy_swag')){
      const [w,h,d]=sizes.get('sign_ivy_swag');
      part('sign_ivy_swag',[0,top-w/2,.024+d/2],[h,w,d],[0,.5],'','ivy_leaf',{roll:-Math.PI/2,flag:2});
    } else {
      part(null,[0,top-.29,.031],[.012,.58,.012],[0,.5],'','timber_slat',{flag:2});
      for(let i=0;i<5;i++)
        part(null,[.035*(i%2?1:-1),top-.09-i*.10,.04],[.085,.12,.02],[0,.5],'','ivy_leaf',{flag:2,fallback:leaf});
    }
  });
  const matrix=new T.Matrix4();
  return {...batch,set(index,{config,hardwareMatrix},side){
    matrix.makeTranslation(side*(config.size.width/2-.23),0,0).premultiply(hardwareMatrix);
    batch.setInstance(index,matrix,0,config.size.height-baseH,config.finish==='timber-slat',config.preset==='t3-cafe');
  }};
}
