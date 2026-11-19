import {createContactSolver} from './visitor-v2-contact.js';

// A seat anchor describes the upholstery surface. The visitor wrapper still
// uses a floor-level origin and faces -Z. Fit the animated rig inside it.
export function createSeatContact(T, visual, rig, {prefix = '', tripo = false} = {}) {
  const pelvis = tripo ? rig.getObjectByName(`${prefix}Hips`) : null;
  const legNames = tripo ? ['UpLeg', 'Leg', 'Foot'] : ['Hip', 'Knee', 'Foot'];
  const legs = ['Left', 'Right'].map(side => {
    const names = legNames.map(name => prefix + side + name);
    const joints = names.map(name => rig.getObjectByName(name));
    const foot = joints[2];
    const point = visual.worldToLocal(foot.getWorldPosition(new T.Vector3()));
    const rotation = visual.getWorldQuaternion(new T.Quaternion()).invert()
      .multiply(foot.getWorldQuaternion(new T.Quaternion()));
    return {names, joints, point, rotation, saved: joints.map(() => new T.Quaternion())};
  });
  const rest = new T.Vector3(), point = new T.Vector3(), other = new T.Vector3(), target = new T.Vector3();
  const pole = new T.Vector3(), hip = new T.Vector3(), knee = new T.Vector3(), footRotation = new T.Quaternion();
  const facing = new T.Quaternion();
  const solver = createContactSolver(T, rig);
  let applied = false;

  function restore() {
    if (!applied) return;
    rig.position.copy(rest);
    for (const {joints, saved} of legs) joints.forEach((joint, i) => joint.quaternion.copy(saved[i]));
    applied = false;
  }

  function apply(seat, weight) {
    rest.copy(rig.position);
    for (const {joints, saved} of legs) joints.forEach((joint, i) => saved[i].copy(joint.quaternion));
    applied = true;
    if (pelvis) pelvis.getWorldPosition(point);
    else legs[0].joints[0].getWorldPosition(point).lerp(legs[1].joints[0].getWorldPosition(other), .5);
    visual.worldToLocal(point);
    // The hip joint is above and ahead of the part of the body that touches
    // the cushion. The offsets are in metres for the normalized visitor rigs.
    const originY = visual.getWorldPosition(other).y;
    const hipHeight = tripo ? .115 : .075;
    const hipInset = tripo ? .11 : .17;
    target.set(0, seat.y - originY + hipHeight, hipInset - seat.frontEdge);
    rig.position.add(target.sub(point).multiplyScalar(weight));

    visual.getWorldQuaternion(facing);
    return legs.map(({names, joints: [upper, lower, foot], point: restFoot, rotation}) => {
      visual.worldToLocal(upper.getWorldPosition(hip));
      visual.worldToLocal(lower.getWorldPosition(knee));
      visual.worldToLocal(foot.getWorldPosition(point));
      target.set(restFoot.x, seat.footY - originY + restFoot.y + (tripo ? .026 : 0), -seat.frontEdge - .04);
      // Deep cushions can exhaust a short rig's reach. Keep the ankle on the
      // floor and fit its fore/aft placement to the actual leg lengths.
      const reach = hip.distanceTo(knee) + knee.distanceTo(point) - .003;
      const maxForward = Math.sqrt(Math.max(0, reach ** 2 - (target.y - hip.y) ** 2 - (target.x - hip.x) ** 2));
      target.z = Math.max(target.z, hip.z - maxForward);
      target.lerp(point, 1 - weight);
      const error = solver.solveTwoBone(names, visual.localToWorld(target),
        visual.localToWorld(pole.set(hip.x, hip.y, hip.z - 1)));
      foot.parent.getWorldQuaternion(footRotation).invert().multiply(facing).multiply(rotation);
      foot.quaternion.slerp(footRotation, weight);
      return error;
    });
  }

  return {apply, restore};
}
