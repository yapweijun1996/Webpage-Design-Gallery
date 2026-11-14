/** World-space CCD; preserves authored bone lengths and reports residual error. */
export function createContactSolver(T, root) {
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),q=new T.Quaternion(),parent=new T.Quaternion();
  function solve(names,target) {
    const joints=names.map(name=>root.getObjectByName(name));
    if(joints.some(n=>!n))return Infinity;
    const tip=joints.at(-1);
    for(let i=0;i<18;i++) {
      for(let j=joints.length-2;j>=0;j--) {
        const joint=joints[j];root.updateWorldMatrix(true,true);
        joint.getWorldPosition(a);tip.getWorldPosition(b);b.sub(a).normalize();c.copy(target).sub(a).normalize();
        q.setFromUnitVectors(b,c);joint.parent.getWorldQuaternion(parent);
        q.premultiply(parent.clone().invert()).multiply(parent);
        joint.quaternion.premultiply(q);
      }
      root.updateWorldMatrix(true,true);tip.getWorldPosition(b);if(b.distanceTo(target)<.002)break;
    }
    return b.distanceTo(target);
  }
  function solveTwoBone(names,target,pole) {
    const [upper,lower,tip]=names.map(n=>root.getObjectByName(n));
    root.updateWorldMatrix(true,true);
    const origin=upper.getWorldPosition(new T.Vector3()),middle=lower.getWorldPosition(new T.Vector3()),end=tip.getWorldPosition(new T.Vector3());
    const l1=origin.distanceTo(middle),l2=middle.distanceTo(end),direction=target.clone().sub(origin);
    const distance=Math.min(l1+l2-.000001,Math.max(Math.abs(l1-l2)+.000001,direction.length()));direction.normalize();
    const bend=pole.clone().sub(origin);bend.addScaledVector(direction,-bend.dot(direction)).normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    const knee=origin.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    function aim(joint,child,point){
      root.updateWorldMatrix(true,true);joint.getWorldPosition(a);child.getWorldPosition(b);b.sub(a).normalize();c.copy(point).sub(a).normalize();
      q.setFromUnitVectors(b,c);joint.parent.getWorldQuaternion(parent);q.premultiply(parent.clone().invert()).multiply(parent);joint.quaternion.premultiply(q);
    }
    aim(upper,lower,knee);aim(lower,tip,target);root.updateWorldMatrix(true,true);return tip.getWorldPosition(b).distanceTo(target);
  }
  return {solve,solveTwoBone};
}

/** One shelf reservation owns a product until return or explicit reset. */
export function createProductTransfer(T, avatar) {
  const hand=avatar.getObjectByName('RightHand'), point=new T.Vector3();
  let item=null,phase='empty',elapsed=0,start=null;
  function worldHand(){avatar.updateWorldMatrix(true,true);hand.getWorldPosition(point);return point;}
  function reset(){item?.release();item=null;phase='empty';elapsed=0;}
  return {
    pick(token){if(item||!token)return false;item=token;phase='pickup';elapsed=0;start=token.prop.position.clone();token.owner=token.prop.parent;return true;},
    putBack(){if(phase!=='held')return false;worldHand();item.owner.attach(item.prop);start=item.prop.position.clone();phase='return';elapsed=0;return true;},
    cancel(){if(phase==='pickup'){reset();}else if(phase==='return'){hand.attach(item.prop);item.prop.position.set(0,0,0);phase='held';elapsed=0;}},
    reset,
    update(dt,reduced){if(!item)return;elapsed+=dt;if(phase==='held')return;const t=reduced?1:Math.min(1,elapsed/.65),e=t*t*(3-2*t);
      const target=phase==='pickup'?worldHand():item.origin;
      item.prop.position.lerpVectors(start,target,e);
      if(t===1){if(phase==='return')reset();else{hand.attach(item.prop);item.prop.position.set(0,0,0);item.prop.quaternion.identity();phase='held';}}
    },
    get state(){return {phase,id:item?.id||null,active:phase==='pickup'||phase==='return',held:phase==='held'};}
  };
}
