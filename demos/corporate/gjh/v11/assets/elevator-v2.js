import {liftLayout,cutRectangle} from './lift-layout.js';
import {opaqueBatch} from './opaque-batch.js';
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
    interactables: [0, upper].map(y => ({id:'visitor-elevator', x, z, y, radius:1.45})),
  };
}

export function createElevatorV2(T,R,physics,scene,expanded=false) {
  if(!expanded)return createLegacyElevator(T,R,physics,scene);
  const L=liftLayout, floors=[0,L.upper], staticParts=[], cabinParts=[];
  const palette={stone:new T.Color(0x35584d),rail:new T.Color(0xb59b62),panel:new T.Color(0x183a30)};
  const obstacles=[], gates=[], thresholds=[];let height=0,call=null,generation=0,riding=false;
  function geometry(kind,x,y,z,sx,sy,sz) {
    const g=new T.BoxGeometry(sx,sy,sz).toNonIndexed();g.translate(x,y,z);
    const n=g.attributes.position.count,c=palette[kind],colors=new Float32Array(n*3),surface=new Float32Array(n*2);
    for(let i=0;i<n;i++){colors.set([c.r,c.g,c.b],i*3);surface.set(kind==='rail'?[.35,.55]:[.8,0],i*2);}
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
  const guardHeight=1.1,wallThickness=.1;
  for(const r of cutRectangle(slab,shaft))fixed('stone',(r.minX+r.maxX)/2,L.upper-.2,(r.minZ+r.maxZ)/2,r.maxX-r.minX,.4,r.maxZ-r.minZ);
  // Low guards enclose the landing and both shaft entrances without a tall opaque tower.
  for(const x of [slab.minX,slab.maxX])fixed('panel',x,L.upper+guardHeight/2,slabZ,.12,guardHeight,slab.maxZ-slab.minZ);
  for(const z of [slab.minZ,slab.maxZ])fixed('panel',slabX,L.upper+guardHeight/2,z,slab.maxX-slab.minX,guardHeight,.12);
  for(const floor of floors){
    fixed('rail',shaft.maxX,floor+guardHeight/2,shaftZ,wallThickness,guardHeight,sz);
    for(const z of [shaft.minZ,shaft.maxZ])fixed('rail',shaftX,floor+guardHeight/2,z,sx,guardHeight,wallThickness);
    for(const [minZ,maxZ] of [[shaft.minZ,t.minZ],[t.maxZ,shaft.maxZ]])fixed('rail',shaft.minX,floor+guardHeight/2,(minZ+maxZ)/2,wallThickness,guardHeight,maxZ-minZ);
    const gateShape=[shaft.minX,floor+guardHeight/2,doorwayZ,wallThickness,guardHeight,doorwayDepth];
    const gateMesh=opaqueBatch(T,[geometry('rail',...gateShape)],false);gateMesh.name=`Lift gate ${floor}`;scene.add(gateMesh);
    gates.push({floor,mesh:gateMesh,collider:collider(...gateShape)});
    const thresholdShape=[(t.minX+t.maxX)/2,floor-.04,doorwayZ,t.maxX-t.minX,.08,doorwayDepth];
    const thresholdMesh=opaqueBatch(T,[geometry('stone',...thresholdShape)],false);thresholdMesh.name=`Lift threshold ${floor}`;scene.add(thresholdMesh);
    thresholds.push({floor,mesh:thresholdMesh,collider:collider(...thresholdShape)});
  }
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
  const cabinColliders=cabinBoxes.map(w=>({...w,collider:collider(L.x+w.x,w.y,L.z+w.z,...w.size)}));
  function sync(){
    cabin.position.y=height;
    for(const w of cabinColliders)w.collider.setTranslation({x:L.x+w.x,y:height+w.y,z:L.z+w.z});
    for(const gate of gates){const open=!call&&(!riding||riding==='boarding')&&Math.abs(height-gate.floor)<.001;gate.mesh.visible=!open;gate.collider.setEnabled(!open);}
    for(const threshold of thresholds){const docked=!call&&(!riding||riding==='boarding')&&Math.abs(height-threshold.floor)<.001;threshold.mesh.visible=docked;threshold.collider.setEnabled(docked);}
  }
  function settle(){generation++;call=null;riding=false;height=height<L.upper/2?0:L.upper;sync();}
  sync();
  return {
    ...L, expanded:true,cameraObstacles:obstacles,applyMallTheme,
    interactables:floors.map(y=>({id:'visitor-elevator',x:L.exit.x,z:L.exit.z,y,radius:L.radius})),
    setHeight(y){height=y;sync();},
    setRiding(value){riding=value;sync();},
    call(floor){if(call||riding)return false;generation++;if(Math.abs(height-floor)<.001)return true;call={from:height,to:floor,elapsed:0,generation};sync();return true;},
    update(dt,player){
      if(!call)return;
      if(Math.hypot(player.x-L.exit.x,player.z-L.exit.z)>L.radius+.4||Math.abs(player.y-call.to)>.4){settle();return;}
      call.elapsed+=dt;const t=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,call.elapsed/2.5);
      height=call.from+(call.to-call.from)*t*t*(3-2*t);if(t===1)call=null;sync();
    },
    interrupt:settle,
    get state(){return {height,calling:Boolean(call),riding,generation,docked:!call&&!riding?(Math.abs(height)<.001?0:Math.abs(height-L.upper)<.001?L.upper:null):null,gates:gates.map(g=>({floor:g.floor,closed:g.mesh.visible})),thresholds:thresholds.map(t=>({floor:t.floor,enabled:t.mesh.visible}))};},
  };
}
