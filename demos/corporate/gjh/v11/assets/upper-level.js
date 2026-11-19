import {createInstanceVisibility, createPackedDraw} from './packed-draw.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {liftLayout as lift, cutRectangle} from './lift-layout.js';
import {atriumLayout} from './atrium-layout.js';
import {loadStaticAsset} from './static-asset.js';
import {uvRect} from './signage/builder.js';
import {atlasPx, cells, paintUpperAtlas} from './upper-level-atlas.js';
import {decalMaterial} from './surface-decals.js';

const models = {
  bench:{id:'GJH_NEW_bench_oak',dimensions_m:[1.4,.45,.42],sha256:'064fb57f222a95e9327e2fa9ea9e111a2020dbcfc02590c6d6060a54e7570bd9'},
  lamp:{id:'GJH_NEW_lamp_floor',dimensions_m:[.6,1.7,.6],sha256:'5cb040bd1982017acc97b2d96cb80963516be67814c92cab49d816539c1581f2'},
  table:{id:'GJH_NEW_table_display',dimensions_m:[1.1,.85,.6],sha256:'30234aa8ff7d21761920ee1527f374076ded2ae2d296f6499edea2e2759d4ba9'}
};
// Keep the planters inside the perimeter aisle and clear of the seat exits.
export const deckPlanters=[[-6.25,13.8],[.45,13.8],[-7,8],[.45,6.15]];
const lamp=[-1.38,5.75],table=[-4.79,6.05];
const directory={x:-2.96,z:13.52,width:2.46,height:2.56};

// The open lightwell starts at the platform's existing east balustrade.
export const galleryVoid=Object.freeze({
  minX:lift.slab.maxX,maxX:lift.roofOpening.maxX-1.53,
  minZ:lift.slab.minZ,maxZ:lift.slab.maxZ,farRise:1.46
});

// Two short returns protect the sides of the threshold while the cabin is docked.
// The lift owns all four perimeter walls, fixed shaft walls and moving west gate.
export function thresholdReturns() {
  const {minX,maxX,minZ,maxZ}=lift.threshold;
  return [minZ,maxZ].map(z=>({x:(minX+maxX)/2,z,width:maxX-minX,depth:.055}));
}

export async function loadUpperLevel(T, artworkTier = () => 'low') {
  const mark=new Image();mark.src=new URL('./gjh-loader-mark.svg',import.meta.url).href;
  const [logo,...records]=await Promise.all([mark.decode().then(()=>mark,()=>null),
    ...Object.values(models).map(({id,...receipt})=>loadStaticAsset(T,{
      ...receipt,asset_id:id,file:'gallery-assets/upper-level/'+id+'.glb'
    },import.meta.url))]);
  return {map:paintUpperAtlas(T,logo,artworkTier()),models:Object.fromEntries(Object.keys(models).map((key,i)=>[key,records[i]]))};
}

export function buildUpperLevel(T, {map,models:loadedModels}, {collider,lightWash}) {
  const group=new T.Group();group.name='Premium Open Atrium';group.userData.deckLod=true;
  const floor=lift.upper, gold=[], emit=[], solids=[], prints=[], glass=[];
  const unit=new T.BoxGeometry(), plane=new T.PlaneGeometry(), transform=new T.Object3D();
  function matrix(x,y,z,w,h,d,yaw=0,pitch=0) {
    transform.position.set(x,floor+y,z);transform.rotation.set(pitch,yaw,0,'YXZ');
    transform.scale.set(w,h,d);transform.updateMatrix();return transform.matrix.clone();
  }
  function tint(source,world,colour) {
    const geo=source.index?source.toNonIndexed():source.clone();
    geo.applyMatrix4(world);
    for(const key of Object.keys(geo.attributes))if(key!=='position'&&key!=='normal')geo.deleteAttribute(key);
    const rgb=new T.Color(colour),values=new Float32Array(geo.attributes.position.count*3);
    for(let i=0;i<values.length;i+=3)rgb.toArray(values,i);
    geo.setAttribute('color',new T.BufferAttribute(values,3));solids.push(geo);
  }
  const block=(color,...args)=>tint(unit,matrix(...args),color);
  const brass=(...args)=>gold.push(matrix(...args));
  const led=(...args)=>emit.push(unit.clone().applyMatrix4(matrix(...args)));
  function print(cell,...args) {
    const g=plane.clone().applyMatrix4(matrix(...args)),uv=g.attributes.uv;
    const [l,b,r,t]=uvRect(cell,atlasPx);
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)?r:l,uv.getY(i)?t:b);
    prints.push(g);
  }
  function guard(x,z,w,d) {
    const alongX=w>d,length=Math.max(w,d);
    brass(x,1.158,z,alongX?w:.11,.052,alongX?.11:d);
    led(x,.115,z,alongX?w:.142,.033,alongX?.142:d);
    print(cells.filament,x,.133,z,alongX?w:.075,alongX?.075:d,1,0,-Math.PI/2);
    const bays=Math.ceil(length/1.95);
    for(let i=0;i<bays;i++){
      const along=(i+.5)*length/bays-length/2;
      brass(x+(alongX?along:0),.56,z+(alongX?0:along),.045,1.12,.045);
    }
    lightWash(x,floor+.018,z,alongX?w:.64,alongX?.64:d,0,-Math.PI/2);
  }
  function frame(rect,door) {
    const {minX,maxX,minZ,maxZ}=rect,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
    for(const z of [minZ,maxZ])guard(cx,z,maxX-minX,.1);
    guard(maxX,cz,.1,maxZ-minZ);
    if(!door)guard(minX,cz,.1,maxZ-minZ);
    else for(const [a,b] of [[minZ,door.minZ],[door.maxZ,maxZ]])guard(minX,(a+b)/2,.1,b-a);
  }
  frame(lift.slab);frame(lift.shaft,lift.threshold);
  for(const {x,z,width,depth} of thresholdReturns()){
    guard(x,z,width,depth);
    collider(x,floor+.55,z,width,1.10,depth);
    glass.push(plane.clone().applyMatrix4(matrix(x,.55,z,width,1.10,1)));
  }

  // The tile joints reveal the existing stone slab. Clip each tile to the
  // floor panels, so neither artwork nor collision bridges the open shaft.
  const tile=1.5,tones=[0xdbceba,0xded1be,0xd8ccb9,0xdcd1bd];
  for(const area of cutRectangle(lift.slab,lift.shaft)){
    for(let col=0;col<8;col++)for(let row=0;row<8;row++){
      const x=lift.slab.minX+col*tile,z=lift.slab.minZ+row*tile;
      const a=Math.max(area.minX,x+.009),b=Math.min(area.maxX,x+tile-.009);
      const c=Math.max(area.minZ,z+.009),d=Math.min(area.maxZ,z+tile-.009);
      if(a<b&&c<d)tint(plane,matrix((a+b)/2,.008,(c+d)/2,b-a,d-c,1,0,-Math.PI/2),tones[(col*3+row*7)%4]);
    }
  }
  print(cells.rug,-3.05,.022,6.27,4.87,2.23,1,0,-Math.PI/2);
  const crop=new T.CylinderGeometry(.36,.32,.053,16);
  for(const [x,z] of deckPlanters){
    const ring=new T.RingGeometry(.408,.447,24);
    emit.push(ring.applyMatrix4(matrix(x,.031,z,1,1,1,0,-Math.PI/2)));
    lightWash(x,floor+.019,z,1.72,1.72,0,-Math.PI/2);
  }
  const furnitureOffset=.024;
  function furniture(kind,[x,z],sx,sy,sz,fallback){
    const record=loadedModels[kind];
    if(!record?.primitives.length){fallback?.(x,z);return false;}
    const pose=matrix(x,furnitureOffset,z,sx,sy,sz);
    for(const p of record.primitives)tint(p.geometry,pose.clone().multiply(p.matrix),p.material.color);
    for(const geo of new Set(record.primitives.map(p=>p.geometry)))geo.dispose();
    for(const mat of new Set(record.primitives.map(p=>p.material)))mat.dispose();
    return true;
  }
  const seatProfiles=new Map();
  const benchProfile=(width,top,depth,seatCentre=0)=>({size:[width,top,depth],top,front:-depth/2,seatCentre});
  function slats(x,z){
    const width=2.12,centre=.46,thickness=.09,slatDepth=.103,spacing=.12;
    for(let i=-2;i<=2;i++)block(i%2?0xa96f44:0xb98552,x,centre,z+i*spacing,width,thickness,slatDepth);
    for(const dx of [-.78,.78])brass(x+dx,.22,z,.08,.44,.50);
    return benchProfile(width,centre+thickness/2,4*spacing+slatDepth);
  }
  const [benchX,benchY,benchZ]=[1.52,1.1,1.55];
  for(const {finish,x,z} of atriumLayout.upperSeats){
    if(finish==='oak' && furniture('bench',[x,z],benchX,benchY,benchZ)){
      const [width,height,depth]=models.bench.dimensions_m;
      // The oak model has a narrow gap between slats at its centreline.
      seatProfiles.set(finish,benchProfile(width*benchX,furnitureOffset+height*benchY,depth*benchZ,-.04));
    }else if(finish==='oak'||finish==='slats')seatProfiles.set(finish,slats(x,z));
  }
  furniture('table',table,.78,.81,.92,(x,z)=>{
    block(0xb98858,x,.64,z,.86,.09,.55);
    brass(x,.33,z,.12,.62,.12);
    block(0x5d4938,x,.06,z,.55,.08,.37);
  });
  furniture('lamp',lamp,1,1,1,(x,z)=>{
    tint(crop,matrix(x,.05,z,1,1,1),0x997947);
    brass(x,.79,z,.045,1.5,.045);block(0xf8dda5,x,1.58,z,.51,.35,.51);
  });
  crop.dispose();
  led(lamp[0],1.44,lamp[1],.32,.025,.32);
  collider(table[0],floor+.33,table[1],.86,.66,.55);
  collider(lamp[0],floor+.17,lamp[1],.48,.34,.48);

  // The fixed screen is on the safe side of the east guard. The docked
  // cabin occludes it, so its existing rear panel carries the same print.
  const east=lift.shaft.maxX,cz=lift.z;
  block(0x1b3e31,east+.10,1.29,cz,.14,1.72,3.05);
  collider(east+.10,floor+1.29,cz,.14,1.72,3.05);
  for(const dz of [-1.52,1.52])brass(east+.10,1.08,cz+dz,.09,2.16,.06);
  for(const y of [.43,2.14])brass(east+.025,y,cz,.035,.032,3.09);
  print(cells.mark,east+.025,1.32,cz,2.06,1.48,1,-Math.PI/2);

  // Face the lift from the inner aisle and leave the story wall approachable.
  const {x,z,width,height}=directory;
  block(0x694d35,x,1.43,z,width+.10,height+.15,.15);
  print(cells.directory,x,1.43,z-.083,width,height,1,Math.PI);
  for(const dx of [-width/2-.045,width/2+.045])led(x+dx,1.43,z-.087,.031,height+.08,.031);
  brass(x,.23,z,1.25,.46,.13);
  collider(x,floor+1.31,z,width+.10,2.62,.17);

  // The east cut face of the roof becomes the apron of one continuous arcade.
  // The four windows are architectural displays outside the walkable deck.
  const front=lift.roofOpening.maxX, start=lift.roofOpening.minZ, end=lift.roofOpening.maxZ;
  const span=(end-start)/4,mid=(start+end)/2;
  block(0xc0ad8c,front+.12,1.17,mid,.42,.56,end-start+.14);
  block(0xbcae94,front-.67,1.39,mid,1.78,.15,end-start+.12);
  const lip=front-1.53;
  glass.push(plane.clone().applyMatrix4(matrix(lip,1.92,mid,end-start,.96,1,-Math.PI/2)));
  brass(lip,2.42,mid,.076,.055,end-start);
  led(lip,1.37,mid,.075,.027,end-start);
  for(let j=0;j<=12;j++)brass(lip,1.93,start+(end-start)*j/12,.045,.99,.045);
  block(0x28453b,front+.16,2.98,mid,.30,3.3,end-start+.12);
  for(const y of [1.44,4.61])brass(front-.09,y,mid,.20,.085,end-start+.18);
  // The lightwell overlooks the ground court even when the lift is upstairs.
  // The same inclined spans drive the fascia, glass, LED and Rapier guards.
  const {minX,maxX,minZ,maxZ,farRise}=galleryVoid;
  const run=maxX-minX,riseAngle=Math.atan2(farRise,run);
  const slope=Math.hypot(run,farRise),cx=(minX+maxX)/2;
  const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),riseAngle);
  function bridgeMatrix(y,z,w,h,d) {
    return new T.Matrix4().compose(new T.Vector3(cx,floor+farRise/2+y,z),rotation,new T.Vector3(w,h,d));
  }
  function bridgeCollider(y,z,w,h,d) {
    collider(cx,floor+farRise/2+y,z,w,h,d)?.setRotation(rotation);
  }
  for(const [z,side] of [[minZ,-1],[maxZ,1]]){
    const walkway=z+side*.52;
    tint(unit,bridgeMatrix(-.075,walkway,slope+.10,.15,1.05),0xc3ac88);
    bridgeCollider(-.075,walkway,slope+.10,.15,1.05);
    for(const edge of [z,z+side*1.05]){
      glass.push(plane.clone().applyMatrix4(bridgeMatrix(.55,edge,slope+.08,1.10,1)));
      bridgeCollider(.55,edge,slope+.10,1.13,.10);
      gold.push(bridgeMatrix(1.13,edge,slope+.10,.056,.09));
    }
    glass.push(plane.clone().applyMatrix4(matrix(minX,.55,walkway,1.06,1.10,1,-Math.PI/2)));
    brass(minX,1.13,walkway,.09,.056,1.09);
    collider(minX,floor+.55,walkway,.10,1.13,1.09);
    emit.push(unit.clone().applyMatrix4(bridgeMatrix(.10,z,slope+.10,.038,.10)));
    for(const t of [.25,.5,.75])brass(minX+run*t,farRise*t+.55,z,.043,1.10,.043);
  }
  collider(front-.67,floor+1.39,mid,1.78,.15,end-start+.12);
  collider(lip,floor+farRise+.48,mid,.10,1.02,end-start);
  collider(front+.10,floor+2.98,mid,.19,3.3,end-start);
  for(const endZ of [start,end]){
    glass.push(plane.clone().applyMatrix4(matrix(front-.67,1.94,endZ,1.78,1.01,1)));
    brass(front-.67,2.46,endZ,1.78,.055,.075);
    collider(front-.67,floor+1.94,endZ,1.78,1.03,.10);
  }

  for(let i=0;i<4;i++){
    const c=start+(i+.5)*span;
    // The outer returns screen the flat backs of the ground-floor studio roofs.
    // Keep the middle two bays open beneath the balcony so the court is visible.
    if(i===0||i===3){
      block(0x64513c,front+.19,-.51,c,.26,2.91,span+.04);
      print(cells.windows[i],front+.05,-.49,c,span-.28,2.60,1,-Math.PI/2);
      brass(front+.02,-.49,c,.075,2.65,.075);
    }
    print(cells.windows[i],front-.015,2.66,c,span-.32,2.32,1,-Math.PI/2);
    print(cells.signs[i],front-.10,4.20,c,span*.74,.60,1,-Math.PI/2);
    for(const dz of [-span/2+.05,0])brass(front-.055,2.66,c+dz,.09,2.36,.075);
    led(front-.11,3.84,c,.10,.048,span-.23);
    // Plinths and staggered display shelves give
    // the lit windows depth from oblique viewpoints along the balcony.
    block(0x5b4132,front-.24,1.67,c,.44,.34,span-.36);
    for(const side of [-1,1]){
      const p=c+side*1.38;
      block(0xb78d61,front-.18,2.18,p,.32,.095,1.72);

    }
  }


  // World-space sky continues from warm horizon to blue zenith as the camera turns.
  const radius=66,segments=12;
  for(let i=0;i<segments;i++){
    const a=2*Math.PI*i/segments;
    print(cells.sky,lift.x+radius*Math.sin(a),23,lift.z+radius*Math.cos(a),
      2*radius*Math.tan(Math.PI/segments)+.04,60,1,a+Math.PI);
  }
  print(cells.sky,lift.x,52.95,lift.z,2.05*radius,2.05*radius,1,0,Math.PI/2);

  const viewUpdates = [];
  function merged(name, parts, material, parent) {
    let mesh;
    if (material.transparent) {
      // Keep the skylight and glass draw order intact.
      mesh = new T.Mesh(mergeGeometries(parts), material);
      parts.forEach(part => part.dispose());
    } else {
      const batch = createPackedDraw(T, parts.map(geometry => {
        geometry.computeBoundingBox();
        return {geometries:[geometry], bounds:geometry.boundingBox};
      }), material);
      mesh = batch.mesh;
      viewUpdates.push(frustum => batch.update(({bounds}) => frustum.intersectsBox(bounds) ? 0 : -1));
    }
    parts.length = 0;
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }
  merged('Lounge, stone paving and shop arcade',solids,new T.MeshStandardMaterial({vertexColors:true,roughness:.67}),group);
  const ink=decalMaterial(new T.MeshBasicMaterial({map,toneMapped:false,fog:false}),-1);
  merged('Directory, mall mark and display graphics',prints,ink,group);
  const rail = new T.InstancedMesh(unit,new T.MeshStandardMaterial({color:0xcdab70,metalness:.52,roughness:.34}),gold.length);
  gold.forEach((matrix,i) => rail.setMatrixAt(i,matrix));
  rail.name = 'Champagne handrails and posts';
  rail.computeBoundingSphere();
  group.add(rail);
  const railVisibility = createInstanceVisibility(T, rail);
  viewUpdates.push(frustum => railVisibility.update(frustum));
  merged('Amber LED channels',emit,new T.MeshStandardMaterial({color:0x412708,emissive:0xffb34e,emissiveIntensity:1.14,toneMapped:false}),group);
  // The rear face is local to the moving cabin. A small stand-off clears its trim.
  print(cells.mark,lift.cabin.width/2-.107,1.26-floor,0,2.12,1.52,1,-Math.PI/2);
  const cabinMark=new T.Mesh(prints.pop(),ink);cabinMark.name='GJH cabin face';
  cabinMark.userData.deckLod=true;
  plane.dispose();

  // Single sheets transmit daylight through the existing barrel-vault ribs.
  const panes=new T.Group();panes.name='Atrium skylight and threshold glass';
  // Keep the railings visible from both sides in the existing glass draw.
  for (const pane of glass.slice()) {
    const back = pane.clone();
    const {index,attributes:{normal}} = back;
    for (let i=0; i<index.count; i+=3) {
      const a = index.getX(i);
      index.setX(i,index.getX(i+1));
      index.setX(i+1,a);
    }
    for (let i=0; i<normal.count; i++) normal.setXYZ(i,-normal.getX(i),-normal.getY(i),-normal.getZ(i));
    glass.push(back);
  }
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<=24;i++){
    const a=(i/24-.5)*Math.PI,px=-3+13.18*Math.sin(a),py=13.14+3.91*Math.cos(a);
    positions.push(px,py,-2.94,px,py,23.13);uvs.push(i/24,0,i/24,1);
    const j=2*i;if(i<24)indices.push(j,j+2,j+1,j+1,j+2,j+3);
  }
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  roof.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));roof.setIndex(indices);roof.computeVertexNormals();glass.push(roof);
  const glazing=new T.MeshStandardMaterial({color:0xdeeff1,emissive:0xb3dbe2,emissiveIntensity:.22,
    transparent:true,opacity:.14,depthWrite:false,roughness:.22,side:T.FrontSide});
  merged('Daylight glass',glass,glazing,panes);
  return {group,panes,cabinMark,seatProfiles,updateView(frustum) {
    if (group.visible) for (const update of viewUpdates) update(frustum);
  }};
}
