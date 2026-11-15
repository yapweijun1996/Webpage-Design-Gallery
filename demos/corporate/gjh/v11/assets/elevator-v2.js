import {expandedLayout} from './expanded-layout.js';

// Experimental two-level test space. The static slabs own collision; during
// travel the player controller owns the kinematic rider and calls setHeight.
export function createElevatorV2(T, R, physics, scene, expanded = false) {
  if (expanded) return createExpandedElevator(T, R, physics, scene);
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

function createExpandedElevator(T, R, physics, scene) {
  const {x,z,upper}=expandedLayout.lift;
  const stone=new T.MeshStandardMaterial({color:0xdfd5c4,roughness:.64});
  const green=new T.MeshStandardMaterial({color:0x21483e,roughness:.55});
  const brass=new T.MeshStandardMaterial({color:0xb59b62,metalness:.55,roughness:.35});
  const glass=new T.MeshStandardMaterial({color:0xd7e9df,transparent:true,opacity:.24,metalness:.08,roughness:.08,depthWrite:false,side:T.DoubleSide});
  const geometry=new T.BoxGeometry(1,1,1), batches=new Map(), matrix=new T.Matrix4();
  function box(material,px,py,pz,sx,sy,sz,collision=false){
    if(!batches.has(material))batches.set(material,[]);
    matrix.makeScale(sx,sy,sz);matrix.setPosition(px,py,pz);batches.get(material).push(matrix.clone());
    if(collision)physics.createCollider(R.ColliderDesc.cuboid(sx/2,sy/2,sz/2).setTranslation(px,py,pz));
  }
  // Four panels surround the genuine 4 x 4 m shaft void; the movable
  // platform and landing barriers own collision while the cabin is present.
  for(const dx of [-4,4])box(stone,x+dx,upper-.2,z,4,.4,12,true);
  for(const dz of [-4,4])box(stone,x,upper-.2,z+dz,4,.4,4,true);
  for(const dx of [-6,6])box(glass,x+dx,upper+.58,z,.14,1.16,12,true);
  for(const dz of [-6,6])box(glass,x,upper+.58,z+dz,12,1.16,.14,true);
  for(const dx of [-6,6])box(brass,x+dx,upper+1.2,z,.12,.1,12);
  for(const dz of [-6,6])box(brass,x,upper+1.2,z+dz,12,.1,.12);
  // The doorway is on the west side at both levels. Other shaft walls are solid.
  for(const y of [0,upper]){
    box(glass,x+2,y+1.5,z,.12,3,4,true);
    for(const dz of [-2,2])box(glass,x,y+1.5,z+dz,4,3,.12,true);
    for(const dz of [-1.5,1.5])box(glass,x-2,y+1.5,z+dz,.12,3,1,true);
    for(const dz of [-1,1])box(brass,x-2,y+1.5,z+dz,.1,3,.1);
    box(brass,x-2,y+3,z,.1,.1,2);
  }
  for(const [material,transforms] of batches){
    const mesh=new T.InstancedMesh(geometry,material,transforms.length);
    transforms.forEach((transform,i)=>mesh.setMatrixAt(i,transform));mesh.computeBoundingSphere();mesh.receiveShadow=true;scene.add(mesh);
  }
  const cabin=new T.Group();cabin.position.set(x,0,z);scene.add(cabin);
  for(const [material,px,py,pz,sx,sy,sz] of [[stone,0,.04,0,3.98,.08,3.98],[green,1.88,1.25,0,.12,2.5,3.8],[brass,1.8,2.52,0,.12,.08,3.8]]){
    const mesh=new T.Mesh(geometry,material);mesh.position.set(px,py,pz);mesh.scale.set(sx,sy,sz);cabin.add(mesh);
  }
  const gateMaterial=new T.MeshStandardMaterial({color:0x35584d,roughness:.55});
  const gates=[0,upper].map(y=>{
    const mesh=new T.Mesh(geometry,gateMaterial);mesh.position.set(x-2,y+1.1,z);mesh.scale.set(.14,2.2,2);scene.add(mesh);
    const collider=physics.createCollider(R.ColliderDesc.cuboid(.07,1.1,1).setTranslation(x-2,y+1.1,z));
    return {mesh,collider,y};
  });
  const floor=physics.createCollider(R.ColliderDesc.cuboid(1.99,.1,1.99).setTranslation(x,upper-.1,z));
  function setHeight(y){
    cabin.position.y=y;
    for(const gate of gates){const closed=Math.abs(y-gate.y)>.025;gate.mesh.visible=closed;gate.collider.setEnabled(closed);}
    floor.setEnabled(Math.abs(y-upper)<=.025);
  }
  function applyMallTheme(theme){
    const m=theme?.materials;
    if(!m || ['liftStone','liftGreen','liftGate','brass','glass'].some(k=>!Number.isInteger(m[k])||m[k]<0||m[k]>0xffffff) ||
      ['liftGlassOpacity','glassRoughness','glassMetalness'].some(k=>!Number.isFinite(m[k])||m[k]<0||m[k]>1)) return false;
    stone.color.set(m.liftStone);green.color.set(m.liftGreen);gateMaterial.color.set(m.liftGate);brass.color.set(m.brass);
    glass.color.set(m.glass);glass.opacity=m.liftGlassOpacity;glass.roughness=m.glassRoughness;glass.metalness=m.glassMetalness;
    return true;
  }
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#17372e';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f5e8cb';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.fillText('LIFT  ·  LEVELS 1 / 2',256,80);
  const material=new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),side:T.DoubleSide});
  for(const y of [0,upper]){const sign=new T.Mesh(new T.PlaneGeometry(2.8,.5),material);sign.position.set(x-2.08,y+3.35,z);sign.rotation.y=-Math.PI/2;scene.add(sign);}
  setHeight(0);
  return {x,z,upper,useRadius:3.2,setHeight,prepare:setHeight,applyMallTheme,
    interactables:[0,upper].flatMap(y=>[{id:'visitor-elevator',x:x-2.8,z,y,radius:1.25},{id:'visitor-elevator',x,z,y,radius:1.3}])};
}
