// The model is already turned to face -Z when the seated pose is captured.
export function createTripoPoses(T, mesh, visual, authoredSeat) {
  const bones = mesh.skeleton.bones;
  function joint(name) {
    const bone = bones.find(node => node.name.replace(/^mixamorig:?/, '') === name);
    if (!bone) throw new Error(`Missing Mixamo joint: ${name}`);
    return bone;
  }
  const hips = joint('Hips');
  const legs = ['Left', 'Right'].map(side => [joint(side + 'UpLeg'), joint(side + 'Leg'), joint(side + 'Foot')]);
  const arms = ['Left', 'Right'].map(side => [joint(side + 'Arm'), joint(side + 'ForeArm'),
    joint(side + 'Hand'), joint(side + 'HandMiddle1')]);
  const origin = new T.Vector3(), middle = new T.Vector3(), end = new T.Vector3();
  const direction = new T.Vector3(), bend = new T.Vector3(), elbow = new T.Vector3(), wrist = new T.Vector3();
  const from = new T.Vector3(), to = new T.Vector3(), aimOrigin = new T.Vector3();
  const rotation = new T.Quaternion(), parentRotation = new T.Quaternion();

  function aim(bone, child, point) {
    bone.getWorldPosition(aimOrigin);
    child.getWorldPosition(from).sub(aimOrigin).normalize();
    to.copy(point).sub(aimOrigin).normalize();
    rotation.setFromUnitVectors(from, to);
    bone.parent.getWorldQuaternion(parentRotation);
    rotation.premultiply(parentRotation.invert());
    bone.quaternion.premultiply(rotation.multiply(parentRotation.invert()));
  }

  const originalHip = hips.position.clone();
  const bootRotations = legs.map(([, , foot]) => foot.getWorldQuaternion(new T.Quaternion()));
  const bootHeights = legs.map(([, , foot]) => foot.getWorldPosition(new T.Vector3()).y);
  const originalRotations = bones.map(bone => bone.quaternion.clone());
  const palmBasis = new T.Matrix4();
  const [upper, forearm, hand, knuckle] = arms[1], clavicle = upper.parent;
  const carryJoints = [upper, forearm, hand];
  if (clavicle.name.endsWith('Shoulder')) carryJoints.push(clavicle);
  const carryBase = carryJoints.map(joint => originalRotations[bones.indexOf(joint)]);
  let seatHip, seatRotations, posed = false;
  if (!authoredSeat) {
    // Fallback for exports without a sit clip.
    hips.getWorldPosition(origin);
    hips.position.copy(hips.parent.worldToLocal(origin.set(origin.x, .49, -.10)));
    for (let i = 0; i < legs.length; i++) {
      const [thigh, shin, foot] = legs[i];
      aim(thigh, shin, thigh.getWorldPosition(origin).add(to.set(0, -.10, -1)));
      aim(shin, foot, shin.getWorldPosition(origin).add(to.set(0, -1, .05)));
      foot.quaternion.copy(foot.parent.getWorldQuaternion(parentRotation).invert().multiply(bootRotations[i]));
    }
    const lapWrist = new T.Vector3(), lapPole = new T.Vector3(), lapFingers = new T.Vector3();
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      grip(i, lapWrist.set(side * .14, .55, -.23), lapPole.set(side * .40, .53, -.09),
        lapFingers.set(side * .12, .51, -.35));
    }
    seatHip = hips.position.clone();
    seatRotations = bones.map(bone => bone.quaternion.clone());
    posed = true;
    restore();
  }
  function restore() {
    if (!posed) return;
    hips.position.copy(originalHip);
    for (let i = 0; i < bones.length; i++) bones[i].quaternion.copy(originalRotations[i]);
    posed = false;
  }
  function bendLimb(upper, lower, tip, target, pole) {
    upper.getWorldPosition(origin);
    lower.getWorldPosition(middle);
    tip.getWorldPosition(end);
    const upperLength = origin.distanceTo(middle), lowerLength = middle.distanceTo(end);
    direction.copy(target).sub(origin);
    const distance = T.MathUtils.clamp(direction.length(),
      Math.abs(upperLength - lowerLength) + .001, upperLength + lowerLength - .002);
    direction.normalize();
    bend.copy(pole).sub(origin).addScaledVector(direction, -bend.dot(direction)).normalize();
    const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
    elbow.copy(origin).addScaledVector(direction, along)
      .addScaledVector(bend, Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2)));
    wrist.copy(origin).addScaledVector(direction, distance);
    aim(upper, lower, elbow);
    aim(lower, tip, wrist);
  }

  function grip(index, target, pole, palm) {
    const [upper, lower, hand, finger] = arms[index];
    bendLimb(upper, lower, hand, target, pole);
    aim(hand, finger, palm);
    return hand.getWorldPosition(end).distanceTo(target);
  }

  const footTarget = new T.Vector3(), kneePole = new T.Vector3(), bootRotation = new T.Quaternion();
  function groundBoots(weight) {
    for (let i = 0; i < legs.length; i++) {
      const [thigh, shin, foot] = legs[i];
      visual.worldToLocal(foot.getWorldPosition(footTarget));
      // The seated retarget toe joints extend the boot mesh 27 mm lower than
      // idle. The existing seat anchor is 15 mm above the floor.
      footTarget.y = T.MathUtils.lerp(footTarget.y, bootHeights[i] + .026 - .015, weight);
      // Bring the retargeted ankles back within the short legs' reach.
      footTarget.z += .04 * weight;
      visual.localToWorld(footTarget);
      bendLimb(thigh, shin, foot, footTarget, shin.getWorldPosition(kneePole));
      visual.getWorldQuaternion(bootRotation).multiply(bootRotations[i]);
      bootRotation.premultiply(foot.parent.getWorldQuaternion(parentRotation).invert());
      foot.quaternion.slerp(bootRotation, weight);
    }
  }

  return {
    rightHand: hand,
    middleKnuckle: knuckle,
    gripProduct(target, pole, palm, eyeView, waveWeight) {
      if (waveWeight === 1) return;
      if (eyeView && carryJoints.includes(clavicle)) {
        // Lift the shoulder with the arm to keep the grip within elbow reach.
        aim(clavicle, upper, target);
        clavicle.quaternion.slerp(carryBase.at(-1), .35);
      }
      bendLimb(upper, forearm, hand, target, pole);
      // Local +Y runs along the fingers. Roll the palm (-X) upward under the can.
      direction.copy(palm).sub(hand.getWorldPosition(origin)).normalize();
      bend.set(0, -1, 0).cross(direction);
      if (bend.lengthSq() > 1e-8) {
        bend.normalize();
        from.crossVectors(direction, bend);
        rotation.setFromRotationMatrix(palmBasis.makeBasis(from, direction, bend));
        hand.quaternion.copy(hand.parent.getWorldQuaternion(parentRotation).invert().multiply(rotation));
      }
      if (waveWeight > 0) {
        carryJoints.forEach((bone, i) => bone.quaternion.slerp(carryBase[i], waveWeight));
      }
    },
    restore,
    save() {
      originalHip.copy(hips.position);
      for (let i = 0; i < bones.length; i++) originalRotations[i].copy(bones[i].quaternion);
      posed = true;
    },
    sit(weight) {
      hips.position.lerp(seatHip, weight);
      for (let i = 0; i < bones.length; i++) bones[i].quaternion.slerp(seatRotations[i], weight);
    },
    grip, groundBoots
  };
}
