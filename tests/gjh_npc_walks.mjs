() => {
  const {T,options,system} = window.npcTest;
  const {scene,R,physics,playerCollider,playerBody,seats} = options;
  const shape = new R.Capsule(.55,.3);
  const visitors = () => scene.children.filter(root => root.isGroup && root.layers.mask === 4 && root.getObjectByName('Head'));
  const seatAt = p => seats.find(seat => system.occupiedSeatIds.includes(seat.id) && Math.hypot(seat.x-p.x,seat.z-p.z)<.01);
  // The skinned smile is in front of the head bone in the real visitor GLB.
  // Read the deformed vertices: a scene root's +Z alone cannot establish facing.
  function forward(visual) {
    let smile;
    visual.traverse(node => { if (node.isSkinnedMesh && node.material.name === 'Warm smile') smile=node; });
    const count=smile.geometry.attributes.position.count;
    const head=smile.skeleton.getBoneByName('Head'), point=new T.Vector3(), centre=new T.Vector3();
    visual.updateMatrixWorld(true);
    for(let i=0;i<count;i++) centre.add(smile.localToWorld(smile.getVertexPosition(i,point)));
    centre.divideScalar(count).sub(head.getWorldPosition(point));
    centre.y=0;
    return centre.normalize();
  }
  const previous=new Map(), walked=new Set();
  let metres=0, minFacing=1, intersections=0;
  __mall.setInput({forward:0});
  for(let tick=0;tick<240;tick++) {
    __mall.step(105);
    for(const visual of visitors()) {
      const p=visual.position;
      if(seatAt(p)) continue;
      if(physics.intersectionWithShape({x:p.x,y:p.y+.91,z:p.z},{x:0,y:0,z:0,w:1},shape,undefined,undefined,playerCollider,playerBody)) intersections++;
      if(previous.has(visual)) {
        const movement=p.clone().sub(previous.get(visual));
        metres+=movement.length();
        if(movement.length()>.01 && !walked.has(visual)) {
          minFacing=Math.min(minFacing,forward(visual).dot(movement.normalize()));
          walked.add(visual);
        }
      }
      previous.set(visual,p.clone());
    }
  }
  __mall.teleport('mili');
  __mall.step(500);
  const sitter=visitors().find(visual=>seatAt(visual.position));
  const seat=sitter && seatAt(sitter.position);
  const seatFacing=seat && forward(sitter).dot(new T.Vector3(seat.exitX-seat.x,0,seat.exitZ-seat.z).normalize());
  return {walkers:walked.size,metres,minFacing,intersections,seat:seat?.id,seatFacing};
}
