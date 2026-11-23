import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {districtManifest, districtModel, disposeDistrictSource} from './district-assets.js';
import {mergeStaticGeometries} from './merge-static-geometries.js';

const origin = {x:320, z:64};
const quarterTurn = Math.PI / 2;
const placements = {
  'kampung-house': [[-14,8,quarterTurn], [14,19,-quarterTurn]],
  'terrace-house': [[-17,24,quarterTurn]],
  'road-segment': [[0,5,0], [0,15,0], [0,25,0]]
};

// A distinct site keeps the two countries out of each other's walking and camera range.
export async function loadKampungLane(T, signal, {read=fetch, base=new URL('districts/malaysia/',import.meta.url)}={}) {
  if (!globalThis.crypto?.subtle) throw new Error('Kampung integrity verification unavailable');
  const group=new T.Group(), loader=new GLTFLoader();
  group.name='Malaysia · Kampung lane';
  group.position.set(origin.x,0,origin.z);
  const batches=new Map(), geometries=new Set(), materials=new Set(), obstacles=[], cameraBoxes=[], handles=[];
  let sceneBounds,physics;
  const arrival={x:origin.x+5.8,z:origin.z+3,yaw:2.04};

  function collect(geometry,material) {
    geometry.deleteAttribute('uv');
    geometries.add(geometry);
    if(!batches.has(material)) batches.set(material,[]);
    batches.get(material).push(geometry);
  }
  function block(x,y,z,width,height,depth,material,solid=true) {
    collect(new T.BoxGeometry(width,height,depth).translate(x,y,z),material);
    if(solid) obstacles.push({x,y,z,width,height,depth});
  }
  function finish(color) {
    const material=new T.MeshStandardMaterial({color,roughness:.95});
    materials.add(material);
    return material;
  }
  function dispose() {
    group.removeFromParent();
    for(const handle of handles.splice(0)) physics.removeCollider(handle,false);
    if(sceneBounds) for(const box of cameraBoxes) {
      const i=sceneBounds.indexOf(box);
      if(i!==-1) sceneBounds.splice(i,1);
    }
    for(const material of materials) material.dispose();
    for(const geometry of geometries) geometry.dispose();
    group.clear();materials.clear();geometries.clear();batches.clear();
  }
  try {
    const dirt=finish(0xc5ad86), grass=finish(0x81935e), hedge=finish(0x536d47), timber=finish(0xa1805c);
    // The public verges join at both ends. The first proxy owns the arrival floor.
    block(0,-.13,15,54,.22,42,dirt);
    block(0,-.30,15,210,.1,185,grass,false);
    for(const x of [-18,18]) block(x,-.027,15,22,.022,39,grass,false);
    const leaves=finish(0x477351), newLeaves=finish(0x698753), hills=finish(0x849989);
    function crown(x,y,z,sx,sy,sz,material) {
      const shape=new T.SphereGeometry(1,10,7).scale(sx,sy,sz).translate(x,y,z);
      collect(shape,material);
    }
    function gardenTree(x,z,height) {
      const width=height*.42;
      crown(x,-.004,z,width,.018,width*.78,hedge);
      const trunk=new T.CylinderGeometry(.12,.22,height*.72,7).translate(x,height*.35,z);
      collect(trunk,timber);
      if(Math.abs(x)<26 && z>-5 && z<36) obstacles.push({x,y:height*.32,z,width:.42,height:height*.66,depth:.42});
      crown(x,height*.77,z,width,height*.29,width*.88,leaves);
      crown(x-width*.49,height*.64,z+.36,width*.68,height*.23,width*.57,newLeaves);
      crown(x+width*.46,height*.70,z-.53,width*.66,height*.22,width*.61,leaves);
    }
    // Offset the planted gardens from the open stair and porch sightlines.
    for(const [x,z,h] of [[-20,3,5.8],[-11,16.3,4.8],[-20,30,6],[12,3,5.6],[18,10,5.3],[13,31,6.3],
      [-28,-9,7],[-14,39,6],[7,41,7],[25,38,6.6],[-31,12,8],[34,23,7]]) gardenTree(x,z,h);
    for(const [x,z,sx,sy,sz] of [[-48,61,36,9,18],[10,70,40,10,20],[58,56,35,8,25],
      [-69,10,25,10,48],[74,0,28,9,55],[-10,-60,58,9,30]]) crown(x,-3,z,sx,sy,sz,hills);
    for(const x of [-26.7,26.7]) block(x,.47,15,.6,1,42,hedge);
    for(const z of [-5.7,35.7]) block(0,.47,z,54,1,.6,hedge);
    // Short fence runs define private yards and keep their stairs out of the through route.
    for(const [x,z] of [[-7.2,8],[7.2,19],[-7.6,24]]) {
      for(const dz of [-2.85,2.85]) {
        for(const y of [.30,.64]) block(x,y,z+dz,.12,.09,2.7,timber);
        for(const end of [-1.35,1.35]) block(x,.40,z+dz+end,.18,.82,.18,timber);
      }
      block(x,0,z,3.2,.04,2.0,dirt,false);
    }
    const roadBase=new URL('../singapore/',base);
    const homes=await districtManifest(read,base,signal);
    const road=await districtManifest(read,roadBase,signal);
    for(const [id,locations] of Object.entries(placements)) {
      const isRoad=id==='road-segment';
      const src=await districtModel(loader,read,isRoad?roadBase:base,isRoad?road:homes,id,signal);
      const cloned=new Map();
      try {
        for(const [x,z,yaw] of locations) {
          signal.throwIfAborted();
          src.position.set(x,isRoad?-.15:0,z);src.rotation.y=yaw;src.updateMatrixWorld(true);
          src.traverse(node=>{
            if(!node.isMesh) return;
            const name=node.userData.name||node.name;
            if(!cloned.has(node.material)) {
              const mat=node.material.clone();materials.add(mat);cloned.set(node.material,mat);
            }
            collect(node.geometry.clone().applyMatrix4(node.matrixWorld),cloned.get(node.material));
            if(/^(ROAD_Carriageway|SIDEWALK|KERB|Stair(?:\.|$)|Elevated_Floor|Ground_Slab|Entry_Wall|Side_Wall|Rear_Wall|Party_Wall|Front_Pier|Porch_Column|Veranda_Post|Stilt|Entry_Door)/.test(name)) {
              const bounds=new T.Box3().setFromObject(node);
              const c=bounds.getCenter(new T.Vector3()),s=bounds.getSize(new T.Vector3());
              if(Math.min(s.x,s.y,s.z)>.004) obstacles.push({x:c.x,y:c.y,z:c.z,width:s.x,height:s.y,depth:s.z});
            }
            if(/Roof|Entry_Wall|Side_Wall|Rear_Wall|Party_Wall|Front_Pier|Stilt|Porch_Column|Veranda_Post/.test(name)) {
              const box=new T.Box3().setFromObject(node).translate(group.position);
              if(/Roof/.test(name)) box.streetCeiling=true;
              cameraBoxes.push(box);
            }
          });
        }
      } finally { disposeDistrictSource(src); }
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    signal.throwIfAborted();
    for(const [material,parts] of batches) {
      const geo=mergeStaticGeometries(T,parts);
      if(!geo) throw new Error('Kampung material batch could not be built');
      geometries.add(geo);group.add(new T.Mesh(geo,material));
      for(const part of parts) {part.dispose();geometries.delete(part);}
    }
    batches.clear();
    return {arrival,
      mount(scene,R,world,bounds) {
        physics=world;sceneBounds=bounds;
        try {
          for(const p of obstacles) handles.push(world.createCollider(R.ColliderDesc.cuboid(p.width/2,p.height/2,p.depth/2)
            .setTranslation(p.x+origin.x,p.y,p.z+origin.z)));
          const drop=new R.Ray({x:arrival.x,y:1,z:arrival.z},{x:0,y:-1,z:0});
          if(handles[0].castRay(drop,1.15,true)<0) throw new Error('Kampung arrival floor missing');
          bounds.push(...cameraBoxes);scene.add(group);
        } catch(error) {dispose();throw error;}
      },
      get counts() {return {models:3,geometries:geometries.size,materials:materials.size,colliders:handles.length,cameraBounds:sceneBounds?cameraBoxes.length:0};},
      dispose
    };
  } catch(error) {dispose();throw error;}
}
