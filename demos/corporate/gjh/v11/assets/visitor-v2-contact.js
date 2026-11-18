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

export function isShelfInReach({x,y,z}, approach) {
  return Math.abs(y)<=.5&&Math.hypot(x-approach.x,z-approach.z)<=approach.radius;
}

/** One cosmetic shelf facing is reserved during each physical transfer. */
export function createProductTransfer(T, avatar, hand = avatar.getObjectByName('RightHand'), facing = avatar.parent) {
  const bagDuration=.45;
  const point=new T.Vector3(),offset=new T.Vector3(),shelfPoint=new T.Vector3(),rotation=new T.Quaternion(),ownerRotation=new T.Quaternion();
  let item=null,phase='empty',elapsed=0,start=null;
  function worldHand(){avatar.updateWorldMatrix(true,true);hand.getWorldPosition(point);return point;}
  function worldCarry(){worldHand();(facing??avatar.parent).getWorldQuaternion(rotation);return point.add(offset.set(0,-.05,-.06).applyQuaternion(rotation));}
  function hold(){
    // A can stays upright in the palm, rather than inheriting the wrist's
    // authored local axes and disappearing inside the forearm.
    worldCarry();
    item.prop.position.copy(item.owner.worldToLocal(point));
    item.prop.quaternion.copy(item.owner.getWorldQuaternion(ownerRotation).invert().multiply(rotation));
  }
  function reset(){item?.release();item=null;phase='empty';elapsed=0;}
  return {
    pick(token){if(item||!token)return false;item=token;phase='pickup';elapsed=-(token.approachDelay||0);start=token.prop.position.clone();token.owner=token.prop.parent;return true;},
    putBack(){if(phase!=='held')return false;worldHand();item.owner.attach(item.prop);start=item.prop.position.clone();phase='return';elapsed=0;return true;},
    putInBag(id,reduced){
      if(phase!=='held'||item.id!==id)return false;
      phase='bag';elapsed=0;
      if(reduced)reset();
      return true;
    },
    cancel(){if(phase==='pickup'||phase==='bag'){reset();}else if(phase==='return'){phase='held';elapsed=0;hold();}},
    reset,
    reachTarget(out){
      if(!item||phase==='held')return;
      if(phase==='bag'){
        const ease=T.MathUtils.smoothstep(elapsed,0,.3);
        (facing??avatar.parent).getWorldQuaternion(rotation);
        out.add(offset.set(0,-.28*ease,.14*ease).applyQuaternion(rotation));
        return;
      }
      const t=Math.max(0,Math.min(1,elapsed/.9)),reach=phase==='pickup'?Math.min(1,t/.3)*(1-Math.max(0,(t-.3)/.7)):Math.min(1,t/.7);
      shelfPoint.copy(item.origin);shelfPoint.y+=.06;shelfPoint.z+=.04;
      out.lerp(item.owner.localToWorld(shelfPoint),reach);
    },
    update(dt,reduced){
      if(!item)return;
      elapsed+=dt;
      if(phase==='held'){hold();return;}
      if(phase==='bag'){
        if(reduced||elapsed>=bagDuration){reset();return;}
        hold();
        const drop=T.MathUtils.smoothstep(elapsed,.25,bagDuration);
        item.prop.position.y-=.12*drop;
        item.prop.scale.setScalar(1-drop);
        return;
      }
      const t=reduced?1:Math.max(0,Math.min(1,elapsed/.9));
      // Reach first, then lift; reverse the transfer before releasing the stock.
      const travel=phase==='pickup'?Math.max(0,(t-.3)/.7):t,e=travel*travel*(3-2*travel);
      const target=phase==='pickup'?worldCarry():item.origin;
      item.prop.position.lerpVectors(start,target,e);
      if(t===1){if(phase==='return')reset();else{phase='held';hold();}}
    },
    get phase(){return phase;},
    get state(){return {phase,id:item?.id||null,active:phase!=='empty'&&phase!=='held',held:phase==='held'};}
  };
}
