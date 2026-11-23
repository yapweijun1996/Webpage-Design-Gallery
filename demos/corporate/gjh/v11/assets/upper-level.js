import {createInstanceVisibility, createPackedDraw} from './packed-draw.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {liftLayout as lift, shaftFinish, deckEdgeSpans} from './lift-layout.js';
import {atriumLayout} from './atrium-layout.js';
import {loadStaticAsset} from './static-asset.js';
import {uvRect} from './signage/builder.js';
import {atlasPx, cells, paintUpperAtlas} from './upper-level-atlas.js';
import {decalMaterial} from './surface-decals.js';
import {deckPlanters,directory,lounge} from './upper-layout.js';

export {deckPlanters};

const models = {
  bench:{id:'GJH_NEW_bench_oak',dimensions_m:[1.4,.45,.42],sha256:'064fb57f222a95e9327e2fa9ea9e111a2020dbcfc02590c6d6060a54e7570bd9'},
  lamp:{id:'GJH_NEW_lamp_floor',dimensions_m:[.6,1.7,.6],sha256:'5cb040bd1982017acc97b2d96cb80963516be67814c92cab49d816539c1581f2'},
  table:{id:'GJH_NEW_table_display',dimensions_m:[1.1,.85,.6],sha256:'30234aa8ff7d21761920ee1527f374076ded2ae2d296f6499edea2e2759d4ba9'}
};
const {lamp,table,rug,ottomans}=lounge;

// Two short returns protect the sides of the threshold while the cabin is docked.
// The lift owns all four perimeter walls, fixed shaft walls and moving west gate.
export function thresholdReturns() {
  const {minX,maxX,minZ,maxZ}=lift.threshold;
  return [minZ,maxZ].map(z=>({x:(minX+maxX)/2,z,width:maxX-minX,depth:.055}));
}

export async function loadUpperFurniture(T) {
  return Object.fromEntries(await Promise.all(Object.entries(models).map(async ([kind,{id,...receipt}]) => [
    kind, await loadStaticAsset(T,{...receipt,asset_id:id,file:'gallery-assets/upper-level/'+id+'.glb'},import.meta.url)
  ])));
}

export async function loadUpperLevel(T, artworkTier = () => 'low') {
  const mark = new Image();
  mark.src = new URL('./gjh-loader-mark.svg',import.meta.url).href;
  const [logo, models] = await Promise.all([mark.decode().then(() => mark, () => null),loadUpperFurniture(T)]);
  return {map:paintUpperAtlas(T,logo,artworkTier()), models};
}

export function buildUpperLevel(T, {map, tier, models:loadedModels}, {collider,lightWash}) {
  if (tier) map = paintUpperAtlas(T,null,tier);
  const group=new T.Group();group.name='Premium Open Atrium';group.userData.deckLod=true;
  const floor=lift.upper, gold=[], emit=[], solids=[], prints=[], glass=[];
  const viewUpdates = [];
  const unit=new T.BoxGeometry(), plane=new T.PlaneGeometry(), transform=new T.Object3D();
  function matrix(x,y,z,w,h,d,yaw=0,pitch=0) {
    transform.position.set(x,floor+y,z);transform.rotation.set(pitch,yaw,0,'YXZ');
    transform.scale.set(w,h,d);transform.updateMatrix();return transform.matrix.clone();
  }
  function tint(source,world,colour,parts = solids) {
    const geo=source.index?source.toNonIndexed():source.clone();
    geo.applyMatrix4(world);
    for(const key of Object.keys(geo.attributes))if(key!=='position'&&key!=='normal')geo.deleteAttribute(key);
    const rgb=new T.Color(colour),values=new Float32Array(geo.attributes.position.count*3);
    for(let i=0;i<values.length;i+=3)rgb.toArray(values,i);
    geo.setAttribute('color',new T.BufferAttribute(values,3));parts.push(geo);
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
    for(const [a,b] of deckEdgeSpans(maxX))guard(maxX,(a+b)/2,.1,b-a);
    if(!door)guard(minX,cz,.1,maxZ-minZ);
    else for(const [a,b] of [[minZ,door.minZ],[door.maxZ,maxZ]])guard(minX,(a+b)/2,.1,b-a);
  }
  frame(lift.slab);
  for(const {x,z,width,depth} of thresholdReturns()){
    guard(x,z,width,depth);
    collider(x,floor+.55,z,width,1.10,depth);
    glass.push(plane.clone().applyMatrix4(matrix(x,.55,z,width,1.10,1)));
  }

  print(cells.rug,rug.x,.022,rug.z,rug.width,rug.depth,1,0,-Math.PI/2);
  const crop=new T.CylinderGeometry(.36,.32,.053,16);
  for(const [x,z] of deckPlanters){
    const ring=new T.RingGeometry(.408,.447,24);
    emit.push(ring.applyMatrix4(matrix(x,.031,z,1,1,1,0,-Math.PI/2)));
    lightWash(x,floor+.019,z,1.72,1.72,0,-Math.PI/2);
  }
  const furnitureOffset=.024;
  const furnitureSlots = new Map();
  function furniture(kind,[x,z],sx,sy,sz,fallback,yaw=0){
    const start = solids.length;
    fallback(x,z);
    furnitureSlots.set(kind,{
      pose:matrix(x,furnitureOffset,z,sx,sy,sz,yaw), geometry:solids.splice(start)
    });
  }
  const seatProfiles=new Map();
  const benchProfile=(width,top,depth,seatCentre=0)=>({size:[width,top,depth],top,front:-depth/2,seatCentre});
  function slats(x,z,yaw,profile){
    const [width,top,depth] = profile?.size ?? [2.12,.505,.583];
    const thickness=.09, centre=top-thickness/2, spacing=depth*.2058, slatDepth=depth-4*spacing;
    for(let i=-2;i<=2;i++)block(i%2?0xa96f44:0xb98552,x+i*spacing,centre,z,width,thickness,slatDepth,yaw);
    for(const dx of [-.78,.78])block(0x997947,x,.22,z+dx,.08,.44,.50,yaw);
    return benchProfile(width,centre+thickness/2,4*spacing+slatDepth);
  }
  const [benchX,benchY,benchZ]=[1.52,1.1,1.55];
  for(const {finish,x,z,yaw} of atriumLayout.upperSeats){
    if(finish==='oak'){
      const [width,height,depth]=models.bench.dimensions_m;
      const profile = benchProfile(width*benchX,furnitureOffset+height*benchY,depth*benchZ,-.04);
      furniture('bench',[x,z],benchX,benchY,benchZ,()=>slats(x,z,yaw,profile),yaw);
      seatProfiles.set(finish,profile);
    }else if(finish==='slats')seatProfiles.set(finish,slats(x,z,yaw));
  }
  furniture('table',table,.78,.81,.92,(x,z)=>{
    block(0xb98858,x,.64,z,.86,.09,.55);
    block(0x997947,x,.33,z,.12,.62,.12);
    block(0x5d4938,x,.06,z,.55,.08,.37);
  });
  furniture('lamp',lamp,1,1,1,(x,z)=>{
    const baseScale=models.lamp.dimensions_m[0]/(.36*2);
    tint(crop,matrix(x,.05,z,baseScale,1,baseScale),0x997947);
    block(0x997947,x,.79,z,.045,1.5,.045);block(0xf8dda5,x,1.58,z,.51,.35,.51);
  });
  // Low upholstered footstools share the existing opaque furniture batch.
  const cushion=new T.CylinderGeometry(.32,.33,.29,12);
  for(const [x,z] of ottomans){
    tint(crop,matrix(x,.055,z,.82,2,.82),0x967851);
    tint(cushion,matrix(x,.24,z,1,1,1),0xbda987);
    collider(x,floor+.19,z,.62,.38,.62);
  }
  cushion.dispose();
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

  // The west elevation wraps the fitted portal. Leave the full door opening
  // and the animated indicator clear. All other elevations meet at the cap.
  const {west,east:eastFace,north,south,height:capHeight}=shaftFinish;
  const cx=(west+eastFace)/2, widthX=eastFace-west, widthZ=south-north;
  const lacquer=[];
  function elevation(x,z,width,yaw,bottom=0,top=capHeight) {
    const nx=Math.sin(yaw),nz=Math.cos(yaw);
    const pose=(y,out,w,h,d)=>[x+nx*out,y,z+nz*out,w,h,d,yaw];
    lacquer.push(plane.clone().applyMatrix4(matrix(...pose((bottom+top)/2,0,width,top-bottom,1))));
    // A satin highlight on the front keeps the metal legible in backlight.
    // Its edges still catch the scene lighting on the underlying brass trim.
    if(bottom===0){
      brass(...pose(.095,.012,width,.19,.026));
      print(cells.brushedBrass,...pose(.11,.027,width,.115,1));
    }
    if(top===capHeight){
      brass(...pose(capHeight-.045,.016,width,.09,.045));
      print(cells.brushedBrass,...pose(capHeight-.045,.041,width,.05,1));
      led(...pose(capHeight-.118,.011,width,.037,.026));
    }
    const bays=Math.round(width/.8);
    for(let i=1;i<bays;i++){
      const along=width*(i/bays-.5);
      print(cells.brushedBrass,x+nz*along+nx*.026,(bottom+top)/2,
        z-nx*along+nz*.026,.018,top-bottom,1,yaw);
      brass(x+nz*along+nx*.012,(bottom+top)/2,z-nx*along+nz*.012,.026,top-bottom,.024,yaw);
    }
  }
  elevation(cx,south,widthX,0);
  elevation(cx,north,widthX,Math.PI);
  elevation(eastFace,cz,widthZ,Math.PI/2);
  for(const [a,b] of [[north,lift.threshold.minZ],[lift.threshold.maxZ,south]])
    elevation(west,(a+b)/2,b-a,-Math.PI/2);
  elevation(west,cz,lift.threshold.maxZ-lift.threshold.minZ,-Math.PI/2,2.93);
  lacquer.push(plane.clone().applyMatrix4(matrix(cx,capHeight,cz,widthX,widthZ,1,0,-Math.PI/2)));
  // Attach the directory to the face across from the brand rail. The west
  // landing keeps its visitor-facing copy and the full turning circle.
  brass(cx,1.89,south+.033,1.56,1.49,.032);
  print(cells.directory,cx,1.89,south+.052,1.48,1.40,1);
  brass(west-.048,3.35,cz,1.24,.42,.034,-Math.PI/2);
  print(cells.lift,west-.069,3.35,cz,1.17,.36,1,-Math.PI/2);
  const finish=new T.MeshStandardMaterial({color:0x46715a,roughness:.32,metalness:.14,
    emissive:0x335644,emissiveIntensity:.46});
  finish.name='Deep green shaft lacquer';
  merged('Upper lift shaft lacquer panels',lacquer,finish,group);

  // A shallow sign at the west guard faces the cabin along the exit axis.
  const {x,z,width,height,yaw}=directory;
  block(0x694d35,x,1.16,z,width+.10,height+.15,.15,yaw);
  print(cells.directory,x+.083,1.16,z,width,height,1,yaw);
  for(const dx of [-width/2-.045,width/2+.045])led(x+.087,1.16,z+dx,.031,height+.08,.031);
  brass(x,.15,z,.15,.30,.96);
  collider(x,floor+1.08,z,.17,2.16,width+.10);

  // Frame the architectural shop windows across the lightwell. The former
  // sloped bridges and balcony apron ended at guards and had no public access.
  const front=lift.roofOpening.maxX, start=lift.roofOpening.minZ, end=lift.roofOpening.maxZ;
  const span=(end-start)/4,mid=(start+end)/2;
  block(0xc0ad8c,front+.12,1.17,mid,.42,.56,end-start+.14);
  block(0x28453b,front+.16,2.98,mid,.30,3.3,end-start+.12);
  for(const y of [1.44,4.61])brass(front-.09,y,mid,.20,.085,end-start+.18);

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
  const loungeMaterial = new T.MeshStandardMaterial({vertexColors:true,roughness:.67});
  const loungeName = 'Lounge, stone paving and shop arcade';
  function buildLounge(replacements = {}) {
    const parts = [...solids, ...[...furnitureSlots].flatMap(([kind,slot]) => replacements[kind] ?? slot.geometry)];
    const batch = createPackedDraw(T,parts.map(geometry => {
      geometry.computeBoundingBox();
      return {geometries:[geometry], bounds:geometry.boundingBox};
    }),loungeMaterial,{disposeSources:false});
    batch.mesh.name = loungeName;
    // Reveal the complete staged batch during its GPU warm-up.
    batch.update(() => 0);
    return batch;
  }
  function buildFurniture(records) {
    const replacements = {};
    for (const [kind, {pose}] of furnitureSlots) {
      const record = records[kind];
      if (!record?.primitives.length) continue;
      const parts = replacements[kind] = [];
      for (const p of record.primitives) tint(p.geometry,pose.clone().multiply(p.matrix),p.material.color,parts);
      for (const geo of new Set(record.primitives.map(p=>p.geometry)))geo.dispose();
      for (const mat of new Set(record.primitives.map(p=>p.material)))mat.dispose();
    }
    const staged = Object.keys(replacements).length ? buildLounge(replacements) : null;
    for (const geometry of [...solids,...[...furnitureSlots.values()].flatMap(slot => slot.geometry),...Object.values(replacements).flat()]) geometry.dispose();
    solids.length = 0;
    furnitureSlots.clear();
    return staged;
  }
  let loungeBatch = buildLounge();
  if (loadedModels) {
    const authored = buildFurniture(loadedModels);
    if (authored) {
      loungeBatch.mesh.geometry.dispose();
      loungeBatch = authored;
    }
  }
  group.add(loungeBatch.mesh);
  viewUpdates.push(frustum => loungeBatch.update(({bounds}) => frustum.intersectsBox(bounds) ? 0 : -1));
  async function installFurniture(records, prepareModel) {
    const staged = buildFurniture(records);
    if (!staged) return;
    try { await prepareModel?.(staged.mesh,{fence:true,late:false,linear:()=>false}); }
    catch (error) { staged.mesh.geometry.dispose(); throw error; }
    loungeBatch.mesh.removeFromParent();
    loungeBatch.mesh.geometry.dispose();
    loungeBatch = staged;
    group.add(staged.mesh);
  }
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
  return {group,panes,cabinMark,seatProfiles,installFurniture,updateView(frustum) {
    if (group.visible) for (const update of viewUpdates) update(frustum);
  }};
}
