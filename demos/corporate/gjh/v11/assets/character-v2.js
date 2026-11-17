import {createVisitorLOD} from './visitor-v2-lod.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {createVisitorCustomization} from './visitor-v2-customization.js';
import {createContactSolver,createProductTransfer} from './visitor-v2-contact.js';
import {createPushCart} from './push-cart.js';

// Skinned v2 adapter; v1 remains available through the explicit visitor=v1 URL.
export async function createCharacterV2(T, createLocomotionContinuity) {
  const model = 'gjh-mall-visitor-v2';
  const gltf = await new GLTFLoader().loadAsync(new URL(`./${model}.glb`, import.meta.url).href);
  const avatar = gltf.scene;
  const lod=createVisitorLOD(T,avatar);
  const customization = createVisitorCustomization(avatar);
  const bounds = new T.Box3().setFromObject(avatar);
  const nativeHeight = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(nativeHeight) || nativeHeight < 1.6 || nativeHeight > 1.85 || Math.abs(bounds.min.y) > .08) {
    throw new Error('Visitor model must be authored at metre scale with feet at floor zero');
  }
  avatar.rotation.y = Math.PI;
  // Tiny face details and a wristwatch do not materially change the visitor's
  // floor silhouette, but each otherwise adds another full shadow-map draw.
  const shadowDetail = new Set(['V2_body_Glasses_and_eyes', 'V2_glasses_Glasses_and_eyes',
    'V2_body_Warm_smile', 'V2_watch_Glasses_and_eyes']);
  avatar.traverse(node => { if (node.isMesh) { node.castShadow = !shadowDetail.has(node.name); node.receiveShadow = true; } });
  const visual = new T.Group(); visual.add(avatar);
  const cart = await createPushCart(T, avatar, visual);
  const solver=createContactSolver(T,avatar), transfer=createProductTransfer(T,avatar);
  const contacts={hands:[],feet:[]};
  avatar.updateWorldMatrix(true,true);
  const footRest=Object.fromEntries(['Left','Right'].map(side=>[side,avatar.getObjectByName(side+'Foot').getWorldQuaternion(new T.Quaternion())]));
  const previous=new T.Vector3(),targetPoint=new T.Vector3();let hasPrevious=false;
  const wheels=[];visual.traverse(n=>{if(n.name.startsWith('CASTER_Wheel'))wheels.push(n);});
  const mixer = new T.AnimationMixer(avatar);
  const clips = Object.freeze({idle: 'idle', walk: 'walk', run: 'sprint', push: 'push', sit: 'sit'});
  const actions = {};
  for (const [key, name] of Object.entries(clips)) {
    const clip = gltf.animations.find(candidate => candidate.name === name);
    if (!clip || clip.duration <= 0 || !clip.tracks.length) throw new Error(`Character animation missing or empty: ${name}`);
    const action = actions[key] = mixer.clipAction(clip);
    action.setEffectiveWeight(key === 'idle' ? 1 : 0).play();
  }
  actions.sit.paused = true;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const resolveLocomotion = createLocomotionContinuity();
  let animation = 'idle', seatWeight = 0, pushing = false, count = 0;
  function update(actual, dt, requested = actual, sprintRate = 1) {
    actions.run.setEffectiveTimeScale(sprintRate);
    const movement = resolveLocomotion(actual, requested, dt);
    const target = pushing && movement !== 'idle' ? 'push' : movement;
    if (target !== animation) {
      if (target !== 'idle') actions[target].time = animation === 'idle' ? 0 :
        actions[animation].time / actions[animation].getClip().duration * actions[target].getClip().duration;
      animation = target;
    }
    const blend = 1 - Math.exp(-10 * dt);
    for (const [name, action] of Object.entries(actions)) {
      const weight = name === 'sit' ? seatWeight : (name === target ? 1 - seatWeight : 0);
      const next = dt ? T.MathUtils.lerp(action.getEffectiveWeight(), weight, blend) : weight;
      action.setEffectiveWeight(Math.abs(weight - next) < .001 ? weight : next);
    }
    actions.sit.time = Math.min(actions.sit.getClip().duration - .00001, Math.max(0, seatWeight) * actions.sit.getClip().duration);
    actions.idle.paused = reducedMotion.matches;
    mixer.update(dt);
    avatar.position.y=-.13*seatWeight;
    avatar.updateWorldMatrix(true,true);
    contacts.hands=[]; contacts.feet=[];
    if(pushing){
      const prop=visual.getObjectByName('DemoPushCart');
      for(const [side,x] of [['Left',-.20],['Right',.20]]){
        prop.localToWorld(targetPoint.set(x,1.02,-.39));
        contacts.hands.push(solver.solve([side+'Shoulder',side+'Elbow',side+'Hand'],targetPoint));
      }
      visual.getWorldPosition(targetPoint);
      if(hasPrevious){const distance=targetPoint.distanceTo(previous);for(const wheel of wheels)wheel.rotation.x+=distance/.07;}
      previous.copy(targetPoint);hasPrevious=true;
    }else hasPrevious=false;
    if(seatWeight>0){
      for(const [side,x] of [['Left',.117],['Right',-.117]]){
        visual.localToWorld(targetPoint.set(x,.0617+.03*seatWeight,-.28*seatWeight));
        contacts.feet.push(solver.solveTwoBone([side+'Hip',side+'Knee',side+'Foot'],targetPoint,visual.localToWorld(new T.Vector3(x,.5,-1))));
        const foot=avatar.getObjectByName(side+'Foot');
        foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(visual.getWorldQuaternion(new T.Quaternion())).multiply(footRest[side]));
      }
    }
    if(transfer.state.phase!=='empty'){
      visual.localToWorld(targetPoint.set(-.30,1.08,-.32));
      transfer.reachTarget(targetPoint);
      solver.solve(['RightShoulder','RightElbow','RightHand'],targetPoint);
    }
    transfer.update(dt,reducedMotion.matches);
  }
  update('idle', 0);
  return {
    visual, npcSource:gltf, update, updateLOD:camera=>lod.update(camera),
    setCameraOccluded(value){avatar.visible=!value;},
    setBagCount(value) { count = Math.max(0, Number(value) || 0); cart.setCount(count); },
    setCart(value) { pushing = Boolean(value) && cart.set(value); if (!value) cart.set(false); return !value || pushing; },
    setSeatProgress(value) { seatWeight = Math.max(0, Math.min(1, value)); },
    setSeated(value) { seatWeight = value ? 1 : 0; },
    startCollection() { return false; }, cancelCollection() {transfer.cancel();},
    pickProduct: token=>transfer.pick(token), returnProduct:()=>transfer.putBack(), resetProduct:()=>transfer.reset(),
    customize: customization.apply,
    get animation() { return animation === 'push' ? 'walk' : animation; },
    get state() {
      return {model, asset: `assets/${model}.glb`, nativeHeight, scale: 1, clips, lod:lod.state, cart: {...cart.state,mode:'contact-ik',ik:true,wheelMotion:'distance-driven',wheelPhysics:false},
        seated: seatWeight > 0, seatWeight, carrying: {available: false, visible: false, count},
        collection: {active: transfer.state.active, available: false}, physicalProduct:transfer.state, contacts, customization: customization.state,
        weights: Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, action.getEffectiveWeight()]))};
    }
  };
}
