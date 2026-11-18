import {PropertyBinding} from '../vendor/three.module.min.js';
import {disposeVisitorScene, loadVisitorGLTF} from './visitor-gltf.js';

const CLIP_NAMES = ['idle','walk','run','sit','wave','nod'];
const HIP_POSITION = `${PropertyBinding.sanitizeNodeName('mixamorig:Hips')}.position`;

export function tripoNpcClips(animations) {
  const clips = {};
  for (const name of CLIP_NAMES) {
    const clip = animations?.find(candidate => candidate.name === name);
    if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0 || !clip.tracks.length || !clip.validate()) return null;
    clips[name] = clip;
  }
  const hips = clips.walk.tracks.find(track => track.name === HIP_POSITION);
  if (!hips || hips.getValueSize() !== 3 || hips.times.length < 2) return null;
  // Rapier-checked route movement owns world translation. Remove the walk's
  // accumulated horizontal travel while preserving its periodic sway and lift.
  const walk = clips.walk.clone();
  const {times,values} = walk.tracks.find(track => track.name === HIP_POSITION);
  const last = times.length - 1;
  const span = times[last] - times[0];
  if (!(span > 0)) return null;
  const dx = values[last*3] - values[0], dz = values[last*3+2] - values[2];
  for (let i = 0; i <= last; i++) {
    const phase = (times[i] - times[0]) / span;
    values[i*3] -= phase * dx;
    values[i*3+2] -= phase * dz;
  }
  clips.walk = walk;
  return clips;
}

function skinnedPart(root) {
  let mesh = null, count = 0;
  root?.traverse(node => {
    if (node.isMesh) { mesh = node; count++; }
  });
  if (count !== 1 || !mesh.isSkinnedMesh || !mesh.name ||
      !mesh.geometry?.attributes.skinIndex || !mesh.geometry.attributes.skinWeight ||
      !mesh.skeleton?.bones.length || mesh.skeleton.bones.some(bone => root.getObjectByName(bone.name) !== bone)) return null;
  root.updateMatrixWorld(true);
  return mesh;
}

function canShareSkin(high, low) {
  const sameMatrix = (a,b) => a.elements.every((value,i) => Math.abs(value-b.elements[i]) < 1e-5);
  return low.name === high.name && low.bindMode === high.bindMode &&
    Object.keys(high.geometry.attributes).every(name =>
      low.geometry.attributes[name]?.itemSize === high.geometry.attributes[name].itemSize) &&
    sameMatrix(low.matrixWorld,high.matrixWorld) && sameMatrix(low.bindMatrix,high.bindMatrix) &&
    low.skeleton.bones.length === high.skeleton.bones.length &&
    low.skeleton.bones.every((bone,i) => bone.name === high.skeleton.bones[i].name &&
      sameMatrix(low.skeleton.boneInverses[i],high.skeleton.boneInverses[i]));
}

function loadModel(level, signal) {
  if (signal.aborted) return null;
  const url = new URL(level === 0 ? './gjh-tripo-npc-boy.glb' : './gjh-tripo-npc-boy-lod1.glb', import.meta.url);
  return loadVisitorGLTF(url);
}

export async function loadTripoNpc(signal, readModel = loadModel) {
  const [base, detail] = await Promise.allSettled([0,1].map(async level => readModel(level,signal)));
  const high = base.value?.scene, low = detail.value?.scene;
  let accepted = false, lowGeometry = null;
  try {
    if (signal.aborted) return null;
    const mesh = skinnedPart(high), clips = tripoNpcClips(base.value?.animations);
    if (!mesh?.material?.map || !clips) return null;
    const lowMesh = skinnedPart(low);
    if (lowMesh && canShareSkin(mesh,lowMesh)) {
      lowGeometry = lowMesh.geometry;
      // Transfer the geometry before disposing the rest of the LOD scene.
      lowMesh.geometry = null;
    }
    accepted = true;
    return {
      scene:high, clips, meshName:mesh.name, lowGeometry,
      dispose() { disposeVisitorScene(high); lowGeometry?.dispose(); }
    };
  } finally {
    if (low) disposeVisitorScene(low);
    if (high && !accepted) disposeVisitorScene(high);
  }
}
