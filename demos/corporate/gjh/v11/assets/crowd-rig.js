import * as T from '../vendor/three.module.min.js';

const JOINTS = 65;
const HIPS = 'mixamorigHips';
const CLIPS = ['idle', 'walk', 'wave', 'nod'];

export function skinnedParts(scene) {
  const parts = [];
  scene.updateMatrixWorld(true);
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const {geometry, material, skeleton} = mesh;
    if (!mesh.isSkinnedMesh || !geometry.attributes.skinIndex || !geometry.attributes.skinWeight ||
        !geometry.attributes.normal || !skeleton || skeleton.bones.length !== JOINTS ||
        new Set(skeleton.bones.map(bone => bone.name)).size !== JOINTS ||
        skeleton.bones.some(bone => !bone.name.startsWith('mixamorig') || scene.getObjectByName(bone.name) !== bone) ||
        !material?.isMeshStandardMaterial || material.transparent || Object.keys(geometry.morphAttributes).length ||
        Object.values(material).some(value => value?.isTexture && Math.max(value.image.width, value.image.height) > 1024))
      throw new Error('Invalid modular NPC skin or material');
    parts.push(mesh);
  });
  if (!parts.length) throw new Error('Modular NPC skin is missing');
  return parts;
}

function relaxedHands(library) {
  const poses = new Map();
  for (const side of ['Left', 'Right']) {
    const clip = T.AnimationClip.findByName(library.animations, `hand_open_relaxed_${side[0]}`);
    const finger = new RegExp(`^mixamorig${side}Hand(?:Thumb|Index|Middle|Ring|Pinky)[1-4]$`);
    if (!clip?.validate() || clip.tracks.length !== 20) throw new Error('Invalid modular NPC hand pose');
    for (const track of clip.tracks) {
      const {nodeName, propertyName} = T.PropertyBinding.parseTrackName(track.name);
      if (!finger.test(nodeName) || poses.has(nodeName) || propertyName !== 'quaternion' || track.times.length !== 1)
        throw new Error('Invalid modular NPC finger channel');
      poses.set(nodeName, track.values);
    }
  }
  return poses;
}

export function retargetCrowdClips(source, bones, gestures) {
  source.scene.updateMatrixWorld(true);
  const hands = relaxedHands(gestures);
  const joints = new Map(bones.map(bone => {
    const original = source.scene.getObjectByName(bone.name);
    // Animation-only GLBs have joint nodes without a glTF skin declaration.
    if (!original) throw new Error('Modular NPC motion joint is missing');
    const basis = bone.getWorldQuaternion(new T.Quaternion()).invert()
      .multiply(original.getWorldQuaternion(new T.Quaternion()));
    const toTarget = bone.quaternion.clone().multiply(basis).multiply(original.quaternion.clone().invert());
    return [bone.name, {bone, original, toTarget, inverse: basis.invert()}];
  }));
  const rotation = new T.Quaternion();
  return Object.fromEntries(CLIPS.map(name => {
    const clip = T.AnimationClip.findByName(source.animations, name);
    if (!clip?.validate() || !(clip.duration > 0 && clip.duration <= 10)) throw new Error('Invalid modular NPC motion');
    const tracks = [], seen = new Set();
    for (const track of clip.tracks) {
      const {nodeName, propertyName} = T.PropertyBinding.parseTrackName(track.name);
      const joint = joints.get(nodeName);
      if (!joint) continue;
      if (propertyName === 'quaternion') {
        const pose = hands.get(nodeName);
        if (pose) tracks.push(new T.QuaternionKeyframeTrack(track.name, [0], pose));
        else {
          const mapped = track.clone();
          for (let i = 0; i < mapped.values.length; i += 4) {
            rotation.fromArray(mapped.values, i).premultiply(joint.toTarget)
              .multiply(joint.inverse).normalize().toArray(mapped.values, i);
          }
          tracks.push(mapped);
        }
        seen.add(nodeName);
      } else if (nodeName === HIPS && propertyName === 'position') {
        const mapped = track.clone();
        const {x, y, z} = joint.bone.position;
        for (let i = 0; i < mapped.values.length; i += 3) {
          mapped.values[i] = x;
          mapped.values[i + 1] += y - joint.original.position.y;
          mapped.values[i + 2] = z;
        }
        tracks.push(mapped);
      }
    }
    if (seen.size !== JOINTS || tracks.length !== JOINTS + 1) throw new Error('Incomplete modular NPC motion');
    return [name, new T.AnimationClip(name, clip.duration, tracks)];
  }));
}

export function fitCrowdPart(part, skeleton) {
  const byName = new Map(skeleton.bones.map((bone, index) => [bone.name, index]));
  const indices = part.skeleton.bones.map(bone => byName.get(bone.name));
  if (indices.includes(undefined)) throw new Error('Modular NPC joints do not match body');
  const mesh = part.clone(false);
  part.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
  if (indices.some((index, original) => index !== original)) {
    mesh.geometry = part.geometry.clone();
    const joints = mesh.geometry.attributes.skinIndex;
    for (let i = 0; i < joints.count; i++) {
      joints.setXYZW(i, indices[joints.getX(i)], indices[joints.getY(i)], indices[joints.getZ(i)], indices[joints.getW(i)]);
    }
  }
  return mesh;
}
