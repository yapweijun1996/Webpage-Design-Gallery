import {createDoorwayOccupancy} from './doorway-occupancy.js';
import {restroomAt, restroomParcel, restroomRoof, restroomRooms} from './restroom-layout.js';

export function buildRestrooms(T,R,physics,scene,{box,cylinder,collider,sign,materials,doors,interactables}) {
  const {minX,maxX,minZ,maxZ} = restroomParcel;
  const roomWidth = maxX-minX;
  const centreX = (minX+maxX)/2;
  const roomHeight = restroomRoof.min.y;
  const roofDepth = restroomRoof.max.y - roomHeight;
  const centreZ = (minZ+maxZ)/2;
  const wall = (x,z,w,d) => box('ivory',x,roomHeight/2,z,w,roomHeight,d,true);
  const mirror = 'restroomMirror';
  materials[mirror] = new T.MeshStandardMaterial({color:0xaecbd4,roughness:.28,metalness:.27});
  wall(minX,centreZ,.17,maxZ-minZ);
  for (const z of [minZ,...restroomRooms.map(room=>room.maxZ)]) wall(centreX,z,roomWidth,.16);
  box('cream',centreX,roomHeight+roofDepth/2,centreZ,roomWidth,roofDepth,maxZ-minZ,true);

  const actions = new Map();
  const effectMaterial = new T.MeshBasicMaterial({color:0xb0e8f1});
  const leafMaterial = new T.MeshStandardMaterial({color:0x466b64,roughness:.67});
  const leafShape = new T.BoxGeometry(1,1,1);
  const doorPanels = [];
  const doorBatch = new T.InstancedMesh(leafShape, leafMaterial, restroomRooms.length * 2);
  doorBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);
  doorBatch.name = 'Restroom sliding door leaves';
  scene.add(doorBatch);
  leafShape.computeBoundingBox();
  const doorBounds = new T.Box3(), panelBounds = new T.Box3();
  const submitted = [];
  let doorBatchDirty = true;
  const streamShape = new T.CylinderGeometry(.020,.014,.31,8);
  const rippleShape = new T.TorusGeometry(.14,.013,5,16);

  for (const room of restroomRooms) {
    const z = (room.minZ+room.maxZ)/2, width=room.maxZ-room.minZ;
    const half=room.doorWidth/2;
    const flank=(width-room.doorWidth)/2;
    for (const side of [-1,1]) wall(maxX,z+side*(half+flank/2),.18,flank);
    box('green',maxX,2.53,z,.19,.64,room.doorWidth,true);
    const plaque = sign(room.sign,maxX+.107,2.51,z,room.doorWidth+.48,.25,true,58);
    plaque.rotation.y = Math.PI/2;
    if (room.id==='restroom-accessible') {
      const letters = sign('无障碍洗手间 · TANDAS MESRA OKU',maxX+.109,2.29,z,2.26,.17,true,54);
      letters.rotation.y = Math.PI/2;
    }
    box('shellFloor',centreX,.016,z,roomWidth-.16,.020,width-.15);
    box('green',27.08,1.03,room.minZ+.65,.12,2.06,1.26,true);

    const panelWidth = half-.02;
    const leaves=[-1,1].map(side=>{
      const panel=new T.Object3D();
      panel.scale.set(.055,2.20,panelWidth);
      panel.position.set(maxX,1.10,z+side*panelWidth/2);
      doorPanels.push(panel);
      const body=physics.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(maxX,1.10,panel.position.z));
      physics.createCollider(R.ColliderDesc.cuboid(.028,1.10,panelWidth/2),body);
      return {side,body,panel};
    });
    const occupied = createDoorwayOccupancy(R,physics,{x:maxX,y:1.10,z},[.09,1.10,half],leaves);
    doors.push({zone:room.id,x:maxX,z,open:0,advance(visitor,dt,reduced) {
      const near=visitor.y<2 && Math.abs(visitor.x-maxX)<1.95 && Math.abs(visitor.z-z)<half+.35 ||
        this.open>0 && occupied();
      const progress = reduced ? Number(near) : Math.max(0,Math.min(1,this.open+(near?1:-1)*dt*4.2));
      if (this.open===progress) return;
      this.open=progress;
      doorBatchDirty = true;
      for (const {side,body,panel} of leaves) {
        panel.position.z=z+side*(panelWidth/2+progress*(half+.025));
        body.setNextKinematicTranslation({x:maxX,y:1.10,z:panel.position.z});
      }
    }});

    const basinX=25.07, basinZ=room.minZ+.37;
    if (room.id==='restroom-accessible') {
      for (const dx of [-.36,.36]) box('oak',basinX+dx,.77,basinZ-.22,.07,.24,.18);
    } else {
      box('oak',basinX,.66,basinZ,.94,.23,.62);
    }
    for (const dz of [-.27,.27]) box('cream',basinX,.89,basinZ+dz,.98,.10,.11);
    for (const dx of [-.398,.398]) box('cream',basinX+dx,.89,basinZ,.184,.10,.432);
    box('ivory',basinX,.797,basinZ,.613,.057,.426);
    cylinder('brass',basinX,.828,basinZ,.036,.014);
    cylinder('green',basinX+.36,1.024,basinZ-.19,.044,.14);
    box('brass',basinX+.36,1.103,basinZ-.174,.044,.024,.073);
    collider(basinX,.80,basinZ,.98,.29,.65);
    box('brass',basinX,1.00,basinZ-.22,.050,.22,.06);
    box('brass',basinX,1.11,basinZ-.155,.050,.042,.19);
    box('oak',basinX,1.47,room.minZ+.10,.91,.77,.035);
    box(mirror,basinX,1.47,room.minZ+.123,.84,.70,.019);
    box('ivory',basinX,1.73,room.minZ+.139,.76,.019,.009);
    const water=new T.Mesh(streamShape,effectMaterial);
    water.name=room.id+' running tap';
    water.position.set(basinX,.955,basinZ-.075);
    water.visible=false;
    scene.add(water);

    const toiletX=22.18, toiletZ=room.minZ+.66;
    box('cream',toiletX-.42,.53,toiletZ,.24,.76,.53);
    cylinder('cream',toiletX,.25,toiletZ,.235,.45);
    cylinder('ivory',toiletX+.16,.49,toiletZ,.305,.105);
    cylinder(mirror,toiletX+.16,.549,toiletZ,.218,.014);
    box('brass',toiletX-.42,.94,toiletZ,.10,.020,.07);
    collider(toiletX-.025,.36,toiletZ,1.00,.72,.69);
    if (room.id==='restroom-accessible') {
      box('brass',toiletX,.78,toiletZ-.47,1.02,.055,.055);
      for (const x of [toiletX-.47,toiletX+.47]) box('brass',x,.52,toiletZ-.47,.05,.55,.05);
    }
    const ripple=new T.Mesh(rippleShape,effectMaterial);
    ripple.name=room.id+' flush';
    ripple.position.set(toiletX+.16,.56,toiletZ);
    ripple.rotation.x=-Math.PI/2;
    ripple.visible=false;
    scene.add(ripple);
    for (const [kind,x,anchorZ,mesh] of [
      ['tap',basinX,basinZ+.78,water],['flush',toiletX+.94,toiletZ,ripple]
    ]) {
      const id=room.id+'-'+kind;
      actions.set(id,{room:room.id,kind,mesh,remaining:0});
      interactables.push({id,x,z:anchorZ,radius:.89,availability:({player})=>Boolean(player && restroomAt(player.x,player.z)?.id===room.id)});
    }
  }
  return {
    updateDraw(frustum) {
      let count = 0, changed = doorBatchDirty;
      doorBounds.makeEmpty();
      for (const panel of doorPanels) {
        if (doorBatchDirty) panel.updateMatrix();
        panelBounds.copy(leafShape.boundingBox).applyMatrix4(panel.matrix);
        if (frustum && !frustum.intersectsBox(panelBounds)) continue;
        changed ||= submitted[count] !== panel;
        submitted[count] = panel;
        doorBounds.union(panelBounds);
        count++;
      }
      if (changed || count !== doorBatch.count) {
        doorBatch.count = count;
        doorBatch.visible = count > 0;
        for (let i = 0; i < count; i++) doorBatch.setMatrixAt(i, submitted[i].matrix);
        doorBatch.instanceMatrix.needsUpdate = true;
        doorBatch.boundingSphere ??= new T.Sphere();
        doorBounds.getBoundingSphere(doorBatch.boundingSphere);
        doorBatchDirty = false;
      }
    },
    fixtures:[...actions].map(([id,{kind}])=>({id,name:kind==='tap'?'Handwashing basin':'Toilet'})),
    prompt(id){const action=actions.get(id);return action.kind==='flush'?'Flush':action.mesh.visible?'Turn tap off':'Turn tap on';},
    operate(id){
      const action=actions.get(id);
      if (!action) return null;
      if (action.kind==='flush') {
        action.remaining=.68;
        action.mesh.visible=true;
        return 'Toilet flushed.';
      }
      action.mesh.visible=!action.mesh.visible;
      return action.mesh.visible?'Tap running. Wash your hands.':'Tap off.';
    },
    update(dt,visitor) {
      const room=restroomAt(visitor.x,visitor.z)?.id;
      for (const action of actions.values()) {
        if (!action.mesh.visible) continue;
        if (room!==action.room) action.mesh.visible=false;
        else if (action.kind==='flush') {
          action.remaining=Math.max(0,action.remaining-dt);
          action.mesh.scale.setScalar(1-action.remaining*.64);
          action.mesh.visible=action.remaining>0;
        }
      }
    },
    get state(){return Object.fromEntries([...actions].map(([id,{mesh}])=>[id,mesh.visible]));}
  };
}
