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
export function createProductTransfer(T, avatar, hand = avatar.getObjectByName('RightHand'), facing = avatar.parent,
  grip = new T.Vector3(), eyeHand) {
  const bagDuration = .45;
  const point = new T.Vector3(), offset = new T.Vector3(), shelfPoint = new T.Vector3();
  const rotation = new T.Quaternion(), shelfRotation = new T.Quaternion(), carryRotation = new T.Quaternion();
  const bagScale = new T.Vector3();
  let item = null, phase = 'empty', elapsed = 0, centerHeight = 0, firstPerson = false;

  function presentHand() { eyeHand?.show(firstPerson && (phase === 'held' || phase === 'bag')); }
  function worldCarry() {
    // grip marks the can centre in bone space. The product GLB pivots at its base.
    hand.localToWorld(point.copy(grip));
    point.y -= centerHeight;
    return point;
  }
  function hold() {
    if (firstPerson && eyeHand) {
      if (item.prop.parent !== eyeHand.grip) eyeHand.grip.add(item.prop);
      item.prop.position.set(0, -centerHeight, 0);
      item.prop.quaternion.identity();
      return;
    }
    if (item.prop.parent !== facing) facing.attach(item.prop);
    item.prop.position.copy(facing.worldToLocal(worldCarry()));
    item.prop.quaternion.identity(); // Facing turns only about world Y.
  }
  function reset() {
    item?.release();
    item = null;
    phase = 'empty';
    elapsed = 0;
    presentHand();
  }
  return {
    setFirstPerson(value) {
      firstPerson = value;
      presentHand();
      if (phase === 'held' || phase === 'bag') hold();
    },
    pick(token) {
      if (item || !token) return false;
      eyeHand?.prepare();
      item = token;
      item.owner = item.prop.parent;
      shelfRotation.copy(item.prop.quaternion);
      centerHeight = (item.centerY ?? 0) * item.prop.getWorldScale(offset).y;
      phase = 'pickup';
      elapsed = -(token.approachDelay || 0);
      return true;
    },
    putBack() {
      if (phase !== 'held') return false;
      item.owner.attach(item.prop);
      phase = 'return';
      elapsed = 0;
      presentHand();
      return true;
    },
    putInBag(id, reduced) {
      if (phase !== 'held' || item.id !== id) return false;
      phase = 'bag';
      elapsed = 0;
      bagScale.copy(item.prop.scale);
      if (reduced) reset();
      return true;
    },
    cancel() {
      if (phase === 'pickup' || phase === 'bag') reset();
      else if (phase === 'return') { phase = 'held'; elapsed = 0; hold(); presentHand(); }
    },
    reset,
    reachTarget(out) {
      if (!item || phase === 'held') return;
      if (phase === 'bag') {
        const ease = T.MathUtils.smoothstep(elapsed, 0, .3);
        facing.getWorldQuaternion(rotation);
        out.add(offset.set(0, -.28*ease, .14*ease).applyQuaternion(rotation));
        return;
      }
      const t = T.MathUtils.clamp(elapsed / .9, 0, 1);
      const reach = phase === 'pickup' ? Math.min(1, t/.3)*(1-Math.max(0, (t-.3)/.7)) : Math.min(1, t/.7);
      shelfPoint.copy(item.origin);
      shelfPoint.y += .06;
      shelfPoint.z += .04;
      out.lerp(item.owner.localToWorld(shelfPoint), reach);
    },
    update(dt, reduced) {
      if (!item) return;
      elapsed += dt;
      if (phase === 'held') { hold(); return; }
      if (phase === 'bag') {
        if (reduced || elapsed >= bagDuration) { reset(); return; }
        hold();
        if (firstPerson && eyeHand) eyeHand.grip.position.y = -.075 * T.MathUtils.smoothstep(elapsed, 0, bagDuration);
        const drop = T.MathUtils.smoothstep(elapsed, .25, bagDuration);
        item.prop.scale.copy(bagScale).multiplyScalar(1 - drop);
        // Shrink about the grip, settling the last 15 mm into the lowered hand.
        item.prop.position.y += ((item.centerY ?? 0) * bagScale.y - .015) * drop;
        return;
      }
      const t = reduced ? 1 : T.MathUtils.clamp(elapsed / .9, 0, 1);
      // Exchange at full reach. While carrying, the live palm owns the pose.
      const contact = phase === 'pickup' ? T.MathUtils.smoothstep(t, .3, .45) :
        1 - T.MathUtils.smoothstep(t, .7, 1);
      const localGrip = item.owner.worldToLocal(worldCarry());
      item.prop.position.lerpVectors(item.origin, localGrip, contact);
      item.owner.getWorldQuaternion(carryRotation).invert().multiply(facing.getWorldQuaternion(rotation));
      item.prop.quaternion.slerpQuaternions(shelfRotation, carryRotation, contact);
      if (t === 1) {
        if (phase === 'return') reset();
        else { phase = 'held'; hold(); presentHand(); }
      }
    },
    get phase() { return phase; },
    get state() { return {phase, id:item?.id || null, active:phase !== 'empty' && phase !== 'held', held:phase === 'held'}; }
  };
}
