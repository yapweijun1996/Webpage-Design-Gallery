import {rideTime} from './elevator-ride.js';
import {mallAudio} from './audio.js';
import {createKitLoader} from './elevator-kit.js';
import {liftLayout,shaftFinish,cutRectangle} from './lift-layout.js';
import {opaqueBatch} from './opaque-batch.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
// Experimental two-level test space. The static slabs own collision; during
// travel the player controller owns the kinematic rider and calls setHeight.
function createLegacyElevator(T, R, physics, scene) {
  const x = 0, z = 16, upper = 7.2;
  const slabMaterial = new T.MeshStandardMaterial({color: 0x35584d, roughness: .8});
  const railMaterial = new T.MeshStandardMaterial({color: 0xb59b62, metalness: .55, roughness: .35});
  const panelMaterial = new T.MeshStandardMaterial({color: 0x183a30, roughness: .5});
  function box(material, px, py, pz, sx, sy, sz, collision = false) {
    const mesh = new T.Mesh(new T.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(px, py, pz); mesh.receiveShadow = true; scene.add(mesh);
    if (collision) physics.createCollider(R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(px, py, pz));
  }
  // A genuine separate walking surface above the original roof.
  box(slabMaterial, 0, upper - .2, 13, 12, .4, 10, true);
  box(panelMaterial, -6, upper + .55, 13, .15, 1.1, 10, true);
  box(panelMaterial, 6, upper + .55, 13, .15, 1.1, 10, true);
  box(panelMaterial, 0, upper + .55, 8, 12, 1.1, .15, true);
  box(panelMaterial, 0, upper + .55, 18, 12, 1.1, .15, true);
  for (const side of [-1, 1]) box(railMaterial, side * 6, upper + 1.13, 13, .12, .1, 10);
  box(railMaterial, 0, upper + 1.13, 8, 12, .1, .12);
  box(railMaterial, 0, upper + 1.13, 18, 12, .1, .12);
  // The cabin follows the rider, rather than making a floor change a map jump.
  const cabin = new T.Group(); cabin.position.set(x, 0, z); scene.add(cabin);
  function part(material, px, py, pz, sx, sy, sz) {
    const mesh = new T.Mesh(new T.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(px, py, pz); cabin.add(mesh);
  }
  part(railMaterial, 0, .045, 0, 2.4, .08, 2.4);
  part(panelMaterial, 0, 1.25, -1.18, 2.4, 2.5, .08);
  for (const side of [-1, 1]) part(railMaterial, side * 1.17, 1.25, -1.1, .08, 2.5, .12);
  part(railMaterial, 0, 2.52, -1.1, 2.4, .08, .12);
  const label = document.createElement('canvas'); label.width = 512; label.height = 128;
  const ctx = label.getContext('2d'); ctx.fillStyle = '#17372e'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#f5e8cb'; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ELEVATOR', 256, 82);
  const sign = new T.Mesh(new T.PlaneGeometry(1.8, .45), new T.MeshBasicMaterial({map: new T.CanvasTexture(label)}));
  sign.position.set(0, 2.15, -1.12); cabin.add(sign);
  return {
    x, z, upper,
    setHeight(y) { cabin.position.y = y; },
    replaceCabin(){cabin.visible=false;},
    interactables: [0, upper].map(y => ({id:'visitor-elevator', x, z, y, radius:1.45})),
  };
}

function createExpandedElevator(T,R,physics,scene,motion) {
  const L=liftLayout, floors=[0,L.upper], staticParts=[], cabinParts=[],deckGlassParts=[];
  const palette={stone:new T.Color(0xdfd5c4),rail:new T.Color(0xb59b62),panel:new T.Color(0x183a30)};
  const obstacles=[], gates=[], thresholds=[];let height=0,call=null,generation=0,riding=false;
  function geometry(kind,x,y,z,sx,sy,sz) {
    const g=new T.BoxGeometry(sx,sy,sz).toNonIndexed();g.translate(x,y,z);
    const n=g.attributes.position.count,c=palette[kind],colors=new Float32Array(n*3),surface=new Float32Array(n*2);
    for(let i=0;i<n;i++){colors.set([c.r,c.g,c.b],i*3);surface.set(kind==='rail'?[.35,.55]:kind==='stone'?[.28,.16]:[.32,.14],i*2);}
    g.setAttribute('color',new T.BufferAttribute(colors,3));g.setAttribute('obSurface',new T.BufferAttribute(surface,2));return g;
  }
  function collider(x,y,z,sx,sy,sz) {return physics.createCollider(R.ColliderDesc.cuboid(sx/2,sy/2,sz/2).setTranslation(x,y,z));}
  function fixed(kind,x,y,z,sx,sy,sz) {
    staticParts.push(geometry(kind,x,y,z,sx,sy,sz));collider(x,y,z,sx,sy,sz);
    obstacles.push({min:{x:x-sx/2,y:y-sy/2,z:z-sz/2},max:{x:x+sx/2,y:y+sy/2,z:z+sz/2}});
  }

  const shaft=L.shaft,slab=L.slab,t=L.threshold;
  const sx=shaft.maxX-shaft.minX,sz=shaft.maxZ-shaft.minZ;
  const slabX=(slab.minX+slab.maxX)/2,slabZ=(slab.minZ+slab.maxZ)/2;
  const shaftX=(shaft.minX+shaft.maxX)/2,shaftZ=(shaft.minZ+shaft.maxZ)/2;
  const doorwayZ=(t.minZ+t.maxZ)/2,doorwayDepth=t.maxZ-t.minZ;
  // The fitted header and jambs extend above the physics guard. Stop the
  // chase camera at their visible faces while keeping the doorway open.
  for(const floor of floors){
    for(const [z,width,bottom,top] of [[L.z,4.2,2.94,3.80],[L.z-1.54,1.04,0,2.94],[L.z+1.54,1.04,0,2.94]]){
      obstacles.push({min:{x:shaftFinish.west-.39,y:floor+bottom,z:z-width/2},
        max:{x:shaftFinish.west+.29,y:floor+top,z:z+width/2}});
    }
  }
  const guardHeight=1.1,wallThickness=.1;
  for(const r of cutRectangle(slab,shaft))fixed('stone',(r.minX+r.maxX)/2,L.upper-.2,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.4,r.maxZ-r.minZ);
  // Low guards enclose the landing and both shaft entrances without a tall opaque tower.
  // Perimeter guards are glass visually and remain solid to the visitor.
  function deckGuard(x,y,z,sx,sy,sz) {
    collider(x,y,z,sx,sy,sz);
    obstacles.push({min:{x:x-sx/2,y:y-sy/2,z:z-sz/2},max:{x:x+sx/2,y:y+sy/2,z:z+sz/2}});
    const pane=new T.BoxGeometry(sx,sy,sz);pane.translate(x,y,z);deckGlassParts.push(pane);
  }
  for(const x of [slab.minX,slab.maxX]){
    const length=slab.maxZ-slab.minZ;deckGuard(x,L.upper+.53,slabZ,.1,1.06,length);
    fixed('rail',x,L.upper+1.08,slabZ,.12,.08,length);
    fixed('rail',x,L.upper+.04,slabZ,.12,.08,length);
    for(const z of [slab.minZ+1.5,slabZ,slab.maxZ-1.5])fixed('rail',x,L.upper+.55,z,.1,1.1,.1);
  }
  for(const z of [slab.minZ,slab.maxZ]){
    const length=slab.maxX-slab.minX;deckGuard(slabX,L.upper+.53,z,length,1.06,.1);
    fixed('rail',slabX,L.upper+1.08,z,length,.08,.12);
    fixed('rail',slabX,L.upper+.04,z,length,.08,.12);
    for(const x of [slab.minX+1.5,slabX,slab.maxX-1.5])fixed('rail',x,L.upper+.55,z,.1,1.1,.1);
  }
  // Glass at the upper shaft edge keeps the planted court visible. The fixed
  // collider and camera bounds retain the full original height and thickness.
  function shaftGuard(floor,x,z,width,depth) {
    if(floor===0){fixed('rail',x,guardHeight/2,z,width,guardHeight,depth);return;}
    deckGuard(x,floor+guardHeight/2,z,width,guardHeight,depth);
    for(const y of [.07,guardHeight])staticParts.push(geometry('rail',x,floor+y,z,width,.065,depth));
    const alongX=width>depth,length=alongX?width:depth;
    for(const offset of [-.46,.46])staticParts.push(geometry('rail',x+(alongX?offset*length:0),floor+guardHeight/2,
      z+(alongX?0:offset*length),.055,guardHeight,.055));
  }
  // Solid ground elevations follow the upper lacquer finish and leave the west threshold clear.
  const {west,east,north,south,height:wallHeight}=shaftFinish;
  const wallX=(west+east)/2;
  for(const [x,z,w,d] of [[east,L.z,wallThickness,south-north],
    [wallX,north,east-west,wallThickness],[wallX,south,east-west,wallThickness]]){
    fixed('panel',x,wallHeight/2,z,w,wallHeight,d);
    for(const y of [.10,wallHeight-.05])
      staticParts.push(geometry('rail',x,y,z,w+.02,.08,d+.02));
  }
  for(const floor of floors){
    if(floor===L.upper){
      shaftGuard(floor,shaft.maxX,shaftZ,wallThickness,sz);
      for(const z of [shaft.minZ,shaft.maxZ])shaftGuard(floor,shaftX,z,sx,wallThickness);
    }
    for(const [minZ,maxZ] of [[shaft.minZ,t.minZ],[t.maxZ,shaft.maxZ]])shaftGuard(floor,shaft.minX,(minZ+maxZ)/2,wallThickness,maxZ-minZ);
    const gateShape=[shaft.minX,floor+guardHeight/2,doorwayZ,wallThickness,guardHeight,doorwayDepth];
    const gateParts=floor===0?[geometry('rail',...gateShape)]:[
      ...[.07,.56,guardHeight].map(y=>geometry('rail',shaft.minX,floor+y,doorwayZ,wallThickness,.065,doorwayDepth)),
      ...[-.47,.47].map(end=>geometry('rail',shaft.minX,floor+guardHeight/2,doorwayZ+end*doorwayDepth,.07,guardHeight,.07))
    ];
    const gateMesh=opaqueBatch(T,gateParts,false);gateMesh.name=`Lift gate ${floor}`;scene.add(gateMesh);
    gates.push({floor,mesh:gateMesh,collider:collider(...gateShape)});
    const thresholdShape=[(t.minX+t.maxX)/2,floor-.04,doorwayZ,t.maxX-t.minX,.08,doorwayDepth];
    const thresholdMesh=opaqueBatch(T,[geometry('stone',...thresholdShape)],false);thresholdMesh.name=`Lift threshold ${floor}`;scene.add(thresholdMesh);
    thresholds.push({floor,mesh:thresholdMesh,collider:collider(...thresholdShape)});
  }
  const deckGlass=new T.Mesh(mergeGeometries(deckGlassParts),new T.MeshStandardMaterial({color:0xc9e2d9,transparent:true,opacity:.22,roughness:.12,metalness:.08,depthWrite:false,side:T.DoubleSide}));
  deckGlass.name='Upper deck glass balustrade';deckGlass.userData.deckLod=true;scene.add(deckGlass);
  const fixedMesh=opaqueBatch(T,staticParts,false);fixedMesh.name='Expanded lift landing and guards';scene.add(fixedMesh);
  const cw=L.cabin.width,cd=L.cabin.depth;
  const cabinBoxes=[{kind:'stone',x:0,y:-.04,z:0,size:[cw,.08,cd]},
    {kind:'panel',x:cw/2-wallThickness/2,y:1.1,z:0,size:[wallThickness,2.2,cd]},
    ...[-1,1].map(side=>({kind:'rail',x:0,y:guardHeight/2,z:side*(cd/2-wallThickness/2),size:[cw,guardHeight,wallThickness]}))];
  for(const part of cabinBoxes)cabinParts.push(geometry(part.kind,part.x,part.y,part.z,...part.size));
  const cabin=opaqueBatch(T,cabinParts,false);cabin.name='Expanded physical lift cabin';cabin.position.set(L.x,0,L.z);scene.add(cabin);
  // The merged lift geometry uses vertex colours so its different surfaces
  // share a draw call. Remember their original roles for reversible themes.
  const themeMeshes=[fixedMesh,cabin,...gates.map(g=>g.mesh),...thresholds.map(t=>t.mesh)];
  const originalColours=themeMeshes.map(mesh=>mesh.geometry.getAttribute('color').array.slice());
  function applyMallTheme(theme){
    const m=theme?.materials;
    if(!m || ['liftStone','liftGreen','liftGate','brass'].some(k=>!Number.isInteger(m[k])||m[k]<0||m[k]>0xffffff))return false;
    const roles={stone:new T.Color(m.liftStone),rail:new T.Color(m.brass),panel:new T.Color(m.liftGreen)},gateColour=new T.Color(m.liftGate);
    themeMeshes.forEach((mesh,index)=>{
      const attribute=mesh.geometry.getAttribute('color'),original=originalColours[index];
      for(let i=0;i<attribute.count;i++){
        const j=i*3,role=Object.keys(palette).find(key=>Math.abs(original[j]-palette[key].r)<1e-6&&Math.abs(original[j+1]-palette[key].g)<1e-6&&Math.abs(original[j+2]-palette[key].b)<1e-6);
        if(!role)continue;
        const colour=index>=2&&index<2+gates.length?gateColour:roles[role];
        attribute.setXYZ(i,colour.r,colour.g,colour.b);
      }
      attribute.needsUpdate=true;
    });
    return true;
  }
  let fitted=false;
  const cabinColliders=cabinBoxes.map(w=>({...w,position:{x:L.x+w.x,y:w.y,z:L.z+w.z},collider:collider(L.x+w.x,w.y,L.z+w.z,...w.size)}));
  function sync(){
    cabin.position.y=height;
    for(const w of cabinColliders){w.position.y=height+w.y;w.collider.setTranslation(w.position);}
    for(const gate of gates){const open=!call&&(!riding||riding==='boarding')&&Math.abs(height-gate.floor)<.001;gate.closed=!open;gate.mesh.visible=!fitted&&!open;gate.collider.setEnabled(!open);}
    for(const threshold of thresholds){const docked=!call&&(!riding||riding==='boarding')&&Math.abs(height-threshold.floor)<.001;threshold.mesh.visible=docked;threshold.collider.setEnabled(docked);}
  }
  function settle(){generation++;call=null;riding=false;height=height<L.upper/2?0:L.upper;sync();}
  sync();
  return {
    replaceCabin(){fitted=true;cabin.visible=false;sync();},
    setDrawTier(tier){deckGlass.material.forceSinglePass=tier==='low';},
    get height(){return height;},
    get calling(){return Boolean(call);},
    ...L, expanded:true,cameraObstacles:obstacles,applyMallTheme,
    interactables:floors.map(y=>({id:'visitor-elevator',x:L.exit.x,z:L.exit.z,y,radius:L.radius})),
    setHeight(y){height=y;sync();},
    setRiding(value){riding=value;sync();},
    call(floor){if(call||riding)return false;generation++;if(Math.abs(height-floor)<.001)return true;call={from:height,to:floor,elapsed:0,generation};sync();return true;},
    update(dt,player){
      if(!call)return;
      if(Math.hypot(player.x-L.exit.x,player.z-L.exit.z)>L.radius+.4||Math.abs(player.y-call.to)>.4){settle();return;}
      call.elapsed+=dt;const t=motion?.matches?1:Math.min(1,call.elapsed/2.5);
      height=call.from+(call.to-call.from)*t*t*(3-2*t);if(t===1)call=null;sync();
    },
    interrupt:settle,
    get state(){return {height,calling:Boolean(call),riding,generation,docked:!call&&!riding?(Math.abs(height)<.001?0:Math.abs(height-L.upper)<.001?L.upper:null):null,gates:gates.map(g=>({floor:g.floor,closed:g.closed})),thresholds:thresholds.map(t=>({floor:t.floor,enabled:t.mesh.visible}))};},
  };
}

// The fixed gates and threshold colliders remain authoritative in both the
// model and fallback paths. Door leaves are a visual follower of the ride.
export function createElevatorV2(T,R,physics,scene,expanded=false,prepareModel,initialTier='low') {
  const motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const lift=expanded ? createExpandedElevator(T,R,physics,scene,motion) : createLegacyElevator(T,R,physics,scene);
  const kit=prepareModel ? createKitLoader(T,scene,lift,prepareModel,lift.replaceCabin) : null;
  const physicalUpdate=lift.update, setHeight=lift.setHeight, interrupt=lift.interrupt;
  let y=0, ground=0, upper=0, dwell=0, down=false;
  function soundDoors(oldGround, oldUpper) {
    if ((ground > oldGround && oldGround === 0) || (upper > oldUpper && oldUpper === 0) ||
        (ground < oldGround && oldGround === 1) || (upper < oldUpper && oldUpper === 1)) mallAudio.play('door');
  }
  function paint(){
    kit?.update(y,ground,upper,(y>=lift.upper/2?2:0)+(down?1:0));
  }
  lift.kit=kit;
  void kit?.select(initialTier);
  lift.setHeight=height=>{setHeight(height);y=height;};
  lift.pose=(trip)=>{
    lift.setHeight(trip.height);
    const oldGround=ground, oldUpper=upper;
    ground=trip.groundDoor;upper=trip.upperDoor;down=trip.phase==='exit' ? trip.to!==0 : trip.to===0;
    soundDoors(oldGround,oldUpper);
    paint();
  };
  lift.finishRide=()=>{dwell=rideTime.cycle-rideTime.exit-rideTime.open;};
  lift.update=(dt,p)=>{
    if (p.elevatorTravel) return;
    const wasCalling=lift.calling, oldY=y;
    physicalUpdate?.(dt,p);
    if (expanded) y=lift.height;
    if (wasCalling && !lift.calling) {
      dwell=1.1;
      if (Math.abs(y-p.y)<.45) mallAudio.play('floor-chime');
    }
    if (oldY!==y) down=y<oldY;
    else if (!dwell) down=y===lift.upper;
    dwell=Math.max(0,dwell-dt);
    // Also open for visitors who walk through the doorway without taking a ride.
    const atDoor=expanded ? Math.abs(p.z-lift.z)<1.03 && p.x>lift.shaft.minX-.65 && p.x<lift.x+.15 :
      Math.abs(p.x-lift.x)<.77 && Math.abs(p.z-(lift.z-1.36))<.65;
    const open=!lift.calling && (dwell>0 || atDoor && Math.abs(p.y-y)<.45);
    const step=motion?.matches?1:dt/rideTime.open;
    const oldGround=ground, oldUpper=upper;
    ground=Math.max(0,Math.min(1,ground+(open&&y===0?step:-step)));
    upper=Math.max(0,Math.min(1,upper+(open&&y===lift.upper?step:-step)));
    soundDoors(oldGround,oldUpper);
    paint();
  };
  lift.interrupt=()=>{
    interrupt?.(); if(expanded)y=lift.height;
    dwell=ground=upper=0;down=y===lift.upper;paint();
  };
  return lift;
}
