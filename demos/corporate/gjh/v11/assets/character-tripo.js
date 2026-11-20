import {prepareTripoMaterial} from './character-tripo-material.js';
import {createFirstPersonHand} from './visitor-carry-hand.js';
import {createTripoPoses} from './character-tripo-pose.js';
import {createLazyCart} from './push-cart.js';
import {disposeVisitorScene, loadVisitorGLTF} from './visitor-gltf.js';
import {createProductTransfer} from './visitor-v2-contact.js';
import {createVisitorLOD} from './visitor-v2-lod.js';
import {createSeatContact} from './seat-contact.js';

const model = 'gjh-tripo-visitor';
const movementKeys = ['idle', 'walk', 'run'];
const emotes = ['wave', 'nod', 'jump', 'dance'];
const clipNames = Object.freeze({idle: 'idle', walk: 'walk', run: 'sprint',
  wave: 'wave', nod: 'nod', jump: 'jump', dance: 'dance'});
const noCustomization = Object.freeze({available: false});
const unavailable = () => false;

export function normalizeTripoHeight(minY, maxY) {
  const nativeHeight = maxY - minY;
  if (!Number.isFinite(nativeHeight) || nativeHeight <= 0) throw new Error('Invalid Tripo bounds');
  const scale = 1.7 / nativeHeight;
  return {nativeHeight, scale, floorOffset: -minY * scale};
}

export function mapTripoClips(T, source, hips) {
  const clips = {};
  const rootTrack = `${hips.name}.position`;
  for (const [key, name] of Object.entries(clipNames)) {
    const sourceName = key === 'run' ? 'run' : name;
    const clip = source.find(candidate => candidate.name === sourceName);
    if (!(clip?.duration > 0) || !Number.isFinite(clip.duration) || !clip.tracks?.length) {
      throw new Error(`Tripo animation missing or empty: ${sourceName}`);
    }
    const tracks = clip.tracks.map(track => {
      if (track.name !== rootTrack) return track;
      // Rapier owns travel. Retain the authored vertical motion, including jump.
      const inPlace = track.clone();
      for (let i = 0; i < inPlace.values.length; i += 3) {
        inPlace.values[i] = hips.position.x;
        inPlace.values[i + 2] = hips.position.z;
      }
      return inPlace;
    });
    clips[key] = new T.AnimationClip(name, clip.duration, tracks, clip.blendMode);
  }
  return clips;
}

function createSitClip(T, source, hips, placement) {
  const sit = source.find(clip => clip.name === 'sit' && clip.tracks.length);
  if (!sit) return null;
  // The retarget starts already seated. Frames 0–64 settle the arms into
  // the hold; the ending lowers the arms while the pelvis stays seated.
  const clip = T.AnimationUtils.subclip(sit, 'sit', 0, 65, 24);
  const translation = clip.tracks.find(track => track.name === `${hips.name}.position`);
  if (translation) {
    placement.updateWorldMatrix(true, true);
    const from = hips.getWorldPosition(new T.Vector3());
    // Calibrate the retarget to the front of the mall's upholstered seat pan.
    const delta = hips.parent.worldToLocal(from.clone().add(new T.Vector3(0, .18, -.25)))
      .sub(hips.parent.worldToLocal(from));
    for (let i = 0; i < translation.values.length; i += 3) {
      translation.values[i] += delta.x;
      translation.values[i + 1] += delta.y;
      translation.values[i + 2] += delta.z;
    }
  }
  return clip;
}

export async function createCharacterTripo(T, createLocomotionContinuity, prepareModel, portrait) {
  const compactEntry = Boolean(portrait?.compactEntry);
  let highResolution = Boolean(portrait?.highResolution && !compactEntry);
  let nearModel = compactEntry ? 'gjh-tripo-entry' : highResolution ? model + '-2k' : model;
  let gltf;
  try {
    gltf = await loadVisitorGLTF(new URL(`./${nearModel}.glb`, import.meta.url));
  } catch (error) {
    if (!highResolution && !compactEntry) throw error;
    highResolution = false;
    nearModel = model;
    gltf = await loadVisitorGLTF(new URL(`./${model}.glb`, import.meta.url));
  }
  const asset = `assets/${nearModel}.glb`;
  const avatar = gltf.scene;
  let mesh, meshCount = 0, mixer, lod;
  try {
    avatar.traverse(node => { if (node.isMesh) { mesh = node; meshCount++; } });
    if (meshCount !== 1 || !mesh.isSkinnedMesh || Array.isArray(mesh.material) || !mesh.material.map) {
      throw new Error('Expected one textured Tripo skin');
    }
    const prepareMaterial = material => {
      prepareTripoMaterial(material);
      if (highResolution || (compactEntry && portrait.highResolution)) material.userData.portraitLift = .55;
    };
    prepareMaterial(mesh.material);
    if (portrait) {
      // Eyes and glasses are painted into the one opaque base-colour map.
      mesh.material.map.magFilter = T.LinearFilter;
      mesh.material.map.minFilter = T.LinearMipmapLinearFilter;
      mesh.material.map.anisotropy = Math.min(mesh.material.map.anisotropy, Math.max(1, portrait.anisotropy));
      mesh.material.map.needsUpdate = true;
    }
    const hips = mesh.skeleton.bones.find(bone => /^mixamorig:?Hips$/.test(bone.name));
    if (!hips) throw new Error('Tripo hips missing');
    const clips = mapTripoClips(T, gltf.animations, hips);
    const bounds = new T.Box3().setFromObject(avatar, true);
    const {nativeHeight, scale, floorOffset} = normalizeTripoHeight(bounds.min.y, bounds.max.y);
    const visual = new T.Group(), placement = new T.Group();
    placement.rotation.y = Math.PI;
    placement.scale.setScalar(scale);
    placement.position.y = floorOffset;
    visual.add(placement);
    placement.add(avatar);
    mesh.castShadow = mesh.receiveShadow = true;
    const portraitMaterial = mesh.material;
    if (portrait) await portrait.preload(mesh);
    if (compactEntry && prepareModel) {
      void portrait.entry.then(async () => {
        if (disposed || !portrait.canUpgrade()) return;
        const url = new URL(portrait.highResolution ? './gjh-tripo-portrait-2k.webp' : './gjh-tripo-portrait.webp', import.meta.url);
        const response = await fetch(url, {priority:'low'});
        if (!response.ok) return;
        const bitmap = await createImageBitmap(await response.blob(), {colorSpaceConversion:'none'});
        const base = portraitMaterial.map, map = base.clone();
        // A cloned texture shares its source. Replace it before assigning the image.
        map.source = new T.Source(bitmap);
        map.needsUpdate = true;
        const material = portraitMaterial.clone();
        material.map = map;
        prepareMaterial(material);
        const proxy = mesh.clone(false);
        proxy.material = material;
        try {
          await prepareModel(proxy, {fence:true,late:false});
          if (disposed || !portrait.canUpgrade()) return;
          portraitMaterial.map = map;
          base.dispose();
          base.source.data?.close?.();
        } finally {
          material.dispose();
          if (disposed || portraitMaterial.map !== map) { map.dispose(); bitmap.close(); }
        }
      }).catch(() => {});
    }
    // A skinned mesh caches its first animated bounding sphere. A fixed player
    // mesh can jump outside that sphere, so use the existing camera occlusion.
    mesh.frustumCulled = false;

    mixer = new T.AnimationMixer(avatar);
    const actions = Object.fromEntries(Object.entries(clips).map(([key, clip]) => [key, mixer.clipAction(clip)]));
    const locomotionWeights = {idle: 1, walk: 0, run: 0};
    for (const key of movementKeys) actions[key].setEffectiveWeight(locomotionWeights[key]).play();
    for (const key of emotes) actions[key].setLoop(T.LoopOnce, 1);
    const sit = createSitClip(T, gltf.animations, hips, placement);
    const availableClips = sit ? Object.freeze({...clipNames, sit: sit.name}) : clipNames;
    const sitAction = sit && mixer.clipAction(sit).setLoop(T.LoopOnce, 1);
    if (sitAction) {
      // The player owns reversible sit/stand progress, including interrupted
      // entries and immediate reduced-motion poses. Sample once per progress value.
      sitAction.clampWhenFinished = true;
    }
    mixer.setTime(.5);
    const poses = createTripoPoses(T, mesh, visual, Boolean(sitAction));
    const seatContact = createSeatContact(T, visual, placement, {tripo:true, prefix:hips.name.slice(0, -4)});
    if (sitAction) {
      sitAction.setEffectiveWeight(0).play();
      sitAction.paused = true;
    }
    const wrist = poses.rightHand;
    // Tripo's knuckles lie along local +Y and the inside of the palm faces -X.
    const grip = poses.middleKnuckle.position.clone().multiplyScalar(.65);
    grip.x -= .060 / scale;
    const eyeHand = createFirstPersonHand(T, visual, undefined, prepareModel);
    const transfer = createProductTransfer(T, avatar, wrist, visual, grip, eyeHand);
    lod = createVisitorLOD(T, placement, {
      url: new URL(`./${model}-lod1.glb`, import.meta.url), swapMaterial: true, prepareMaterial, prepareModel, entry:portrait?.entry
    });

    const resolveLocomotion = createLocomotionContinuity();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const target = new T.Vector3(), pole = new T.Vector3(), palm = new T.Vector3();
    const previous = new T.Vector3(), current = new T.Vector3();
    const wheels = [], handErrors = [0, 0];
    let prop, pushing = false, hasPrevious = false, disposed = false;
    let animation = 'idle', seatWeight = 0, emoteName = null, emoteTime = 0;
    let emoteAction = null, queuedEmote = null, arrivalWave = false;
    const cart = createLazyCart(T, avatar, visual, {fixedPose:false, prepareModel}, () => {
      prop = visual.getObjectByName('DemoPushCart');
      if (disposed && prop) { disposeVisitorScene(prop); prop.removeFromParent(); return; }
      prop?.traverse(node => { if (node.name.startsWith('CASTER_Wheel')) wheels.push(node); });
    });

    function stopEmote() {
      emoteAction?.stop();
      emoteAction = emoteName = null;
      arrivalWave = false;
      placement.rotation.y = Math.PI;
    }
    function startEmote(name, arrival = false) {
      emoteName = name;
      emoteTime = 0;
      arrivalWave = arrival;
      emoteAction = actions[name].reset().setEffectiveWeight(0).play();
    }
    const canEmote = (name, arrival) => !disposed && !reducedMotion.matches && animation === 'idle' &&
      seatWeight === 0 && !pushing && (transfer.phase === 'empty' || (transfer.phase === 'held' && name === 'wave' && !arrival));
    function emote(name, {arrival = false} = {}) {
      if (!canEmote(name, arrival) || !emotes.includes(name)) return false;
      if (emoteAction) {
        if (queuedEmote || arrival) return false;
        queuedEmote = name;
      } else startEmote(name, arrival);
      return true;
    }
    function updateProduct(dt, waveWeight = 0) {
      target.set(.40, 1.01, -.18);
      palm.set(.52, 1.01, -.25);
      visual.localToWorld(target);
      transfer.reachTarget(target);
      visual.localToWorld(pole.set(.40, .70, -.20));
      visual.localToWorld(palm);
      poses.gripProduct(target, pole, palm.lerp(target, .3), waveWeight);
      transfer.update(dt, reducedMotion.matches);
    }
    function update(actual, dt, requested = actual, playbackRate = 1, seat) {
      if (disposed) return;
      const movement = resolveLocomotion(actual, requested, dt);
      if (movement !== animation) {
        if (movement !== 'idle') actions[movement].time = animation === 'idle' ? 0 :
          actions[animation].time / clips[animation].duration * clips[movement].duration;
        animation = movement;
      }
      let emoteWeight = 0;
      if (emoteAction) {
        emoteTime += dt;
        const remaining = clips[emoteName].duration - emoteTime;
        if (!canEmote(emoteName, arrivalWave) || requested !== 'idle') {
          stopEmote();
          queuedEmote = null;
        } else if (remaining <= 0) {
          stopEmote();
          if (queuedEmote) {
            startEmote(queuedEmote);
            queuedEmote = null;
          }
        } else {
          emoteWeight = Math.min(1, emoteTime / .16, remaining / .20);
          emoteAction.setEffectiveWeight(emoteWeight);
          if (arrivalWave) {
            const turn = T.MathUtils.smoothstep(emoteTime, 0, .38) *
              T.MathUtils.smoothstep(remaining, 0, .38);
            placement.rotation.y = Math.PI * (1 + turn);
          }
        }
      }
      const sitBlend = sitAction ? T.MathUtils.smoothstep(seatWeight, 0, .65) : 0;
      if (sitAction) {
        sitAction.time = sit.duration * seatWeight;
        sitAction.setEffectiveWeight(sitBlend);
      }
      actions.run.setEffectiveTimeScale(playbackRate);
      actions.walk.setEffectiveTimeScale(playbackRate);
      actions.idle.paused = reducedMotion.matches || seatWeight === 1;
      const blend = dt && !reducedMotion.matches ? 1 - Math.exp(-10 * dt) : 1;
      for (const key of movementKeys) {
        const weight = key === animation ? 1 : 0;
        const next = T.MathUtils.lerp(locomotionWeights[key], weight, blend);
        locomotionWeights[key] = Math.abs(weight - next) < .001 ? weight : next;
        actions[key].setEffectiveWeight(locomotionWeights[key] * (1 - emoteWeight) * (1 - sitBlend));
      }
      // Mixer bindings can skip unchanged samples, especially in reduced motion.
      // Restore the animated base before applying a procedural pose again.
      seatContact.restore();
      poses.restore();
      mixer.update(dt);
      if (seatWeight > 0 || pushing || transfer.phase !== 'empty') poses.save();
      if (seatWeight > 0) {
        if (!sitAction) poses.sit(seatWeight);
        if (seat) seatContact.apply(seat, seatWeight);
        else if (sitAction) poses.groundBoots(sitBlend);
      }
      if (transfer.phase !== 'empty') updateProduct(dt, emoteWeight);
      if (!pushing) { hasPrevious = false; return; }
      for (let i = 0; i < 2; i++) {
        const x = i === 0 ? -.20 : .20;
        prop.localToWorld(palm.set(-x, 1.02, -.39));
        prop.localToWorld(target.set(-x, 1.02, -.435));
        visual.localToWorld(pole.set(x * 2, .68, -.22));
        handErrors[i] = poses.grip(i, target, pole, palm);
      }
      visual.getWorldPosition(current);
      if (hasPrevious) {
        const spin = current.distanceTo(previous) / .07;
        for (const wheel of wheels) wheel.rotation.x += spin;
      }
      previous.copy(current);
      hasPrevious = true;
    }

    return {
      visual, emote, update, updateLOD: lod.update, frameCarry: eyeHand.frame,
      setCameraOccluded(value, firstPerson) {
        placement.visible = !value;
        transfer.setFirstPerson(firstPerson);
      },
      get seatWeight() { return seatWeight; },
      get productPhase() { return transfer.phase; },
      setBagCount(value) { cart.setCount(Math.max(0, Number(value) || 0)); },
      prepareCart:cart.prepare,
      setCart(value) {
        if (value && (!cart?.state.available || seatWeight > 0)) return false;
        pushing = Boolean(value);
        cart?.set(pushing);
        if (!pushing) hasPrevious = false;
        return true;
      },
      setSeatProgress(value) { seatWeight = T.MathUtils.clamp(value, 0, 1); },
      setSeated(value) { seatWeight = value ? 1 : 0; },
      startCollection: unavailable,
      cancelCollection() { stopEmote(); queuedEmote = null; transfer.cancel(); },
      pickProduct: transfer.pick, returnProduct: transfer.putBack, bagProduct: transfer.putInBag, resetProduct: transfer.reset,
      customize: unavailable,
      dispose() {
        if (disposed) return;
        disposed = true;
        transfer.reset();
        eyeHand.dispose();
        mixer.stopAllAction();
        mixer.uncacheRoot(avatar);
        lod.dispose();
        disposeVisitorScene(visual);
        visual.removeFromParent();
      },
      get animation() { return animation; },
      get state() {
        const physicalProduct = transfer.state;
        return {model, asset, nativeHeight, scale, clips: availableClips,
          lod: lod.state, emote: emoteName, queuedEmote,
          cart: {...cart.state, mode: 'contact-ik', ik: true, wheelMotion: 'distance-driven'},
          seated: seatWeight > 0, seatWeight, carrying: {available: false, visible: false, count:cart.state.count ?? 0},
          collection: {available: false, active: physicalProduct.active}, physicalProduct, customization: noCustomization,
          contacts: {hands: pushing ? handErrors.slice() : [], feet: []},
          weights: Object.fromEntries(movementKeys.map(key => [key, actions[key].getEffectiveWeight()]))};
      }
    };
  } catch (error) {
    mixer?.stopAllAction();
    mixer?.uncacheRoot(avatar);
    lod?.dispose();
    disposeVisitorScene(avatar);
    throw error;
  }
}
