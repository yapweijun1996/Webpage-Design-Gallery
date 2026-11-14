import {createSeatedPose} from './seated-pose.js';
import {createCollectionGesture} from './collection-gesture.js';
import {createCarryBag} from './carry-bag.js';
/** Authored visitor presentation; locomotion and collision belong to player.js. */
export function createLocomotionContinuity() {
  // Bridge isolated contact corrections, never movement from rest or released input.
  let grace = 0;
  return (actual, requested, dt) => {
    if (requested === 'idle') {
      grace = 0;
      return 'idle';
    }
    if (actual !== 'idle') {
      grace = .06;
      return requested;
    }
    grace = Math.max(0, grace - dt);
    return grace > 0 ? requested : 'idle';
  };
}

export async function createCharacter(T) {
  const {GLTFLoader} = await import('../vendor/GLTFLoader.js');
  const model = 'gjh-mall-visitor';
  const asset = `assets/${model}.glb`;
  const gltf = await new GLTFLoader().loadAsync(new URL(`./${model}.glb`, import.meta.url).href);
  const avatar = gltf.scene;
  const bounds = new T.Box3().setFromObject(avatar);
  const nativeHeight = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(nativeHeight) || nativeHeight < 1.6 || nativeHeight > 1.85 || Math.abs(bounds.min.y) > .08) {
    throw new Error('Visitor model must be authored at metre scale with feet at floor zero');
  }
  // The authored face points +Z; the existing controller moves forward along -Z.
  // Source meshes and clips stay unchanged; carrying applies an optional arm presentation pose.
  avatar.rotation.y = Math.PI;
  avatar.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  const carryBag = createCarryBag(T, avatar);
  const collection = createCollectionGesture(T, avatar);
  const seated = createSeatedPose(avatar);
  const visual = new T.Group();
  visual.add(avatar);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clips = Object.freeze({idle: 'idle', walk: 'walk', run: 'sprint'});
  const mixer = new T.AnimationMixer(avatar);
  const actions = {};
  for (const [state, name] of Object.entries(clips)) {
    const clip = gltf.animations.find(candidate => candidate.name === name);
    if (!clip || clip.duration <= 0 || !clip.tracks.length) {
      throw new Error(`Character animation missing or empty: ${name}`);
    }
    actions[state] = mixer.clipAction(clip);
    actions[state].setEffectiveWeight(state === 'idle' ? 1 : 0).play();
  }
  let animation = 'idle';
  const resolveLocomotion = createLocomotionContinuity();
  actions.idle.paused = reducedMotion.matches;
  mixer.update(0);

  function update(actual, dt, requested = actual) {
    const state = resolveLocomotion(actual, requested, dt);
    if (state !== animation) {
      // Preserve footfall phase when changing pace, including interrupted fades.
      if (state !== 'idle') {
        actions[state].time = animation === 'idle' ? 0
          : actions[animation].time / actions[animation].getClip().duration * actions[state].getClip().duration;
      }
      animation = state;
    }
    const blend = 1 - Math.exp(-10 * dt);
    for (const [name, action] of Object.entries(actions)) {
      const weight = name === state ? 1 : 0;
      if (action.getEffectiveWeight() === weight) continue;
      const nextWeight = T.MathUtils.lerp(action.getEffectiveWeight(), weight, blend);
      action.setEffectiveWeight(Math.abs(weight - nextWeight) < .001 ? weight : nextWeight);
    }
    actions.idle.paused = reducedMotion.matches;
    carryBag.restore(); collection.restore(); seated.restore();
    mixer.update(dt);
    carryBag.apply(); collection.update(dt); seated.apply();
  }

  return {
    visual,
    update,
    setBagCount: carryBag.setCount,
    setSeated(value){collection.cancel();seated.set(value);carryBag.setSeated(value);},
    startCollection: collection.start, cancelCollection: collection.cancel,
    get animation() { return animation; },
    get state() {
      return Object.freeze({
        model, asset, nativeHeight, scale: 1, clips, seated:seated.active, carrying: carryBag.state, collection: collection.state,
        weights: Object.freeze(Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, action.getEffectiveWeight()])))
      });
    }
  };
}
