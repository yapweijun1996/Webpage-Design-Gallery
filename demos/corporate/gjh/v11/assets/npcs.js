import {prepareCrowdMaterial, prepareTripoMaterial} from './character-tripo-material.js';
import {DoubleSide,PropertyBinding} from '../vendor/three.module.min.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {loadTripoNpc} from './npc-tripo.js';
import {createVisitorCustomization} from './visitor-v2-customization.js';
import {disposeVisitorScene, loadVisitorGLTF} from './visitor-gltf.js';

// Visitors share the V2 rig's clips, materials and unmerged geometry.
export const NPC_ROUTES = Object.freeze({
  classic: Object.freeze([[-11,3],[-8,3],[-2,3],[2,3],[8,3],[11,3],[-11,7],[-11,15],[-3,16],[3,16],[11,15],[11,7]]),
  expanded: Object.freeze([[-12,4],[-8,4],[0,4],[10,4],[20,4],[30,4],[32,12],[32,20],[32,32],[30,39],[20,39],[10,39],[0,39],[-10,39],[-12,32],[-12,20],[-12,12]])
});
const LOAD_DISTANCE = 18, UNLOAD_DISTANCE = 22, PLAYER_CLEARANCE = 1.6;
const BOY_SCALE = 1.6, BOY_FLOOR_OFFSET = .035, BOY_SEAT_OFFSET = .29;
const BOY_LOD_FAR = 12, BOY_LOD_NEAR = 10;
const CLIP_NAMES = ['idle','walk','sit'];
const DESKTOP_LIMITS = {low:2,balanced:4,detailed:6};
const MOBILE_LIMITS = {low:1,balanced:2,detailed:3};
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const ignoreRaycast = () => {};

function visibleDrawCalls(root) {
  let count=0;
  function visit(node) {
    if(!node.visible) return;
    if(node.isMesh || node.isLine || node.isPoints || node.isSprite) {
      const materials=Array.isArray(node.material) ? node.geometry.groups.map(group=>node.material[group.materialIndex]) : [node.material];
      for(const material of materials) {
        if(material?.visible) count+=material.transparent && material.side===DoubleSide && !material.forceSinglePass ? 2 : 1;
      }
    }
    for(const child of node.children) visit(child);
  }
  visit(root);
  return Math.max(1,count);
}

function rigTriangles(root) {
  let count = 0;
  root.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry, material = node.material;
    const triangles = (n, mat) => Math.ceil(n/3) *
      (mat?.transparent && mat.side === DoubleSide && !mat.forceSinglePass ? 2 : 1);
    if (Array.isArray(material)) {
      for (const {count:n,materialIndex} of geometry.groups) count += triangles(n,material[materialIndex]);
    } else count += triangles(geometry.index?.count ?? geometry.attributes.position.count,material);
  });
  return count;
}

// The two batching passes share the same strict geometry, binding and object contract.
function compatibleNpcGeometry(other,node) {
  const a=other.geometry,geometry=node.geometry,attrs=Object.keys(geometry.attributes).sort();
  if(other.parent!==node.parent || Boolean(other.isSkinnedMesh)!==Boolean(node.isSkinnedMesh) ||
    other.renderOrder!==node.renderOrder || other.layers.mask!==node.layers.mask || other.frustumCulled!==node.frustumCulled ||
    other.castShadow!==node.castShadow || other.receiveShadow!==node.receiveShadow ||
    !other.matrix.equals(node.matrix) || Boolean(a.index)!==Boolean(geometry.index) ||
    Object.keys(a.attributes).sort().join(',')!==attrs.join(',')) return false;
  if(attrs.some(name=>{
    const x=a.attributes[name],y=geometry.attributes[name];
    return x.itemSize!==y.itemSize || x.normalized!==y.normalized || x.array.constructor!==y.array.constructor || x.gpuType!==y.gpuType;
  })) return false;
  if(node.isSkinnedMesh && (!other.bindMatrix.equals(node.bindMatrix) || other.bindMode!==node.bindMode ||
    other.skeleton.bones.length!==node.skeleton.bones.length ||
    other.skeleton.bones.some((bone,i)=>bone!==node.skeleton.bones[i] || !other.skeleton.boneInverses[i].equals(node.skeleton.boneInverses[i])))) return false;
  return true;
}

// Merge only interchangeable, unanimated leaf parts. No source buffer is changed
// or disposed, and no transform is baked into geometry used by another rig.
function optimizeNpcTemplate(root,protectedNodes) {
  const owned=[],groups=[];
  root.updateMatrixWorld(true);
  function visit(node) {
    if(!node.visible) return;
    if(node.isLOD) node.autoUpdate=false;
    const geometry=node.geometry;
    if(node.isMesh && !node.isInstancedMesh && !node.isBatchedMesh && node.parent && !node.children.length &&
      !protectedNodes.has(node) && !Array.isArray(node.material) && node.material && !node.material.transparent &&
      !node.morphTargetInfluences?.length && !Object.keys(geometry.morphAttributes).length &&
      !geometry.groups.length && geometry.drawRange.start===0 && geometry.drawRange.count===Infinity) {
      const attrs=Object.keys(geometry.attributes).sort();
      const supported=attrs.every(name=>geometry.attributes[name].isBufferAttribute && !geometry.attributes[name].isInstancedBufferAttribute);
      const matches=other=>other.material===node.material && compatibleNpcGeometry(other,node);
      if(supported) {
        const group=groups.find(group=>matches(group[0]));
        if(group) group.push(node); else groups.push([node]);
      }
    }
    for(const child of node.children) visit(child);
  }
  visit(root);
  for(const group of groups) {
    if(group.length<2) continue;
    const geometry=mergeGeometries(group.map(node=>node.geometry));
    if(!geometry) continue;
    owned.push(geometry);
    group[0].geometry=geometry;
    if(group[0].isSkinnedMesh) { group[0].boundingBox=null; group[0].boundingSphere=null; }
    for(const node of group.slice(1)) node.parent.remove(node);
  }
  return owned;
}

// The shipped visitor's opaque colour-only parts share the same rough PBR
// surface. Preserve those colours per vertex while sharing one draw material.
function mergeVisitorColours(T,root,protectedNodes) {
  const names=new Set(['GJH emerald polo','Warm peach skin','Cream white','Swept chestnut hair',
    'Denim cuff','Navy denim','Hoodie slate','Backpack charcoal','Backpack trim']);
  const groups=[],signatures=new WeakMap();
  function materialSignature(material) {
    if(signatures.has(material))return signatures.get(material);
    let signature=null;
    try { const data=material.toJSON(); delete data.metadata; delete data.uuid; delete data.name; delete data.color; signature=JSON.stringify(data); }
    catch { /* Leave unrepresentable materials separate. */ }
    signatures.set(material,signature);return signature;
  }
  root.updateMatrixWorld(true);
  root.traverseVisible(node=>{
    const m=node.material,g=node.geometry;
    if (!node.visible || !node.isSkinnedMesh || node.isInstancedMesh || node.isBatchedMesh || node.children.length || !node.parent || protectedNodes.has(node) ||
        !node.name.startsWith('V2_') || !m?.isMeshStandardMaterial || !names.has(m.name) || m.transparent ||
        m.opacity!==1 || m.vertexColors || m.alphaTest || m.emissive.getHex()!==0 || m.map || m.normalMap ||
        m.roughnessMap || m.metalnessMap || m.emissiveMap || m.alphaMap || m.aoMap || m.lightMap || m.envMap ||
        m.onBeforeCompile!==T.Material.prototype.onBeforeCompile || m.onBeforeRender!==T.Material.prototype.onBeforeRender ||
        m.customProgramCacheKey!==T.Material.prototype.customProgramCacheKey ||
        node.onBeforeRender!==T.Object3D.prototype.onBeforeRender || node.onAfterRender!==T.Object3D.prototype.onAfterRender ||
        node.morphTargetInfluences?.length || Object.keys(g.morphAttributes).length || g.groups.length ||
        g.drawRange.start!==0 || g.drawRange.count!==Infinity) return;
    const signature=materialSignature(m),attrs=Object.keys(g.attributes).sort();
    if(!signature || attrs.includes('color') || attrs.some(k=>!g.attributes[k].isBufferAttribute || g.attributes[k].isInstancedBufferAttribute)) return;
    const same=other=>materialSignature(other.material)===signature && compatibleNpcGeometry(other,node);
    const group=groups.find(candidate=>same(candidate[0]));
    if(group)group.push(node);else groups.push([node]);
  });
  const geometries=[],materials=[];
  for(const group of groups) {
    if(group.length<2)continue;
    const parts=group.map(node=>{
      const g=node.geometry.clone(),count=g.attributes.position.count,c=node.material.color,colors=new Float32Array(count*3);
      for(let i=0;i<count;i++){colors[3*i]=c.r;colors[3*i+1]=c.g;colors[3*i+2]=c.b;}
      g.setAttribute('color',new T.BufferAttribute(colors,3));return g;
    });
    const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());
    if(!merged)continue;
    const material=group[0].material.clone();material.color.setRGB(1,1,1);material.vertexColors=true;
    geometries.push(merged);materials.push(material);group[0].geometry=merged;group[0].material=material;
    group[0].boundingBox=null;group[0].boundingSphere=null;
    for(const node of group.slice(1))node.parent.remove(node);
  }
  return {geometries,materials};
}

export function npcLimit({tier='balanced',mobile=false,enabled=true}={}) {
  if (!enabled) return 0;
  const limits = mobile ? MOBILE_LIMITS : DESKTOP_LIMITS;
  return limits[tier] ?? limits.balanced;
}

// Pure current-frame admission: cuts never wait; growth needs eight consecutive
// safe measurements and four spare calls beyond the next visitor's full cost.
export function nextNpcAdmission(previous={}, options={}) {
  return updateAdmission(previous, options, {});
}

function updateAdmission(previous, {nonNpcCalls,callsPerNpc,limit=0,active=limit,drawCallBudget=200,
  totalCallCap=200, nonNpcTriangles=0, trianglesPerNpc=0, triangleCap=Infinity, advance=true}, output) {
  const known=Number.isFinite(nonNpcCalls) && nonNpcCalls>=0;
  const allowance=Number.isFinite(drawCallBudget)?Math.max(0,drawCallBudget):0;
  const headroom=known?Math.max(0,Math.min(totalCallCap-Math.ceil(nonNpcCalls),allowance)):0;
  const cost=Number.isFinite(callsPerNpc) && callsPerNpc>0?Math.ceil(callsPerNpc):0;
  const cap=Number.isFinite(limit) && Number.isFinite(active)?Math.max(0,Math.floor(Math.min(limit,active))):0;
  const triangleCapacity = !Number.isFinite(triangleCap) || !trianglesPerNpc ? cap :
    Number.isFinite(nonNpcTriangles) ? Math.floor(Math.max(0,triangleCap-nonNpcTriangles)/trianglesPerNpc) : 0;
  const capacity=cost?Math.min(cap,Math.floor(headroom/cost),triangleCapacity):0;
  const before=Math.max(0,Math.floor(previous.admitted||0));
  let admitted=Math.min(before,capacity),safeFrames=previous.safeFrames||0;
  if(!known || admitted<before || admitted>=capacity || headroom<(admitted+1)*cost+4) safeFrames=0;
  else if(advance && ++safeFrames>=8) { admitted++; safeFrames=0; }
  output.admitted=admitted;
  output.safeFrames=safeFrames;
  output.capacity=capacity;
  output.headroom=headroom;
  output.budgetKnown=known;
  output.nonNpcCalls=known?Math.ceil(nonNpcCalls):null;
  return output;
}

// Equivalent to SkeletonUtils.clone for a self-contained glTF hierarchy: bones
// must be remapped, while geometries, materials, textures and clips remain shared.
export function cloneNpcRig(source) {
  const clone=source.clone(true), originals=[], copies=[];
  source.traverse(node=>originals.push(node));
  clone.traverse(node=>copies.push(node));
  const remap=new Map(originals.map((node,i)=>[node,copies[i]])), skeletons=new Map();
  for (let i=0;i<originals.length;i++) {
    const original=originals[i], copy=copies[i];
    if(Array.isArray(original.material)) copy.material=original.material.slice();
    if (!original.isSkinnedMesh) continue;
    if (!skeletons.has(original.skeleton)) {
      const skeleton=original.skeleton.clone();
      skeleton.bones=original.skeleton.bones.map(bone=>{
        const result=remap.get(bone);
        if (!result) throw new Error('NPC skeleton bone is outside the visitor model');
        return result;
      });
      skeletons.set(original.skeleton,skeleton);
    }
    copy.bind(skeletons.get(original.skeleton),original.bindMatrix);
  }
  return clone;
}

export async function loadNpcSystem(T, options) {
  const source = await loadVisitorGLTF(new URL('./gjh-mall-visitor-v2.glb', import.meta.url));
  let customization;
  const disposeSource = () => {
    customization?.dispose();
    disposeVisitorScene(source.scene);
  };
  try {
    customization = createVisitorCustomization(source.scene);
    return createNpcSystem(T, {...options, source, disposeSource});
  } catch (error) {
    disposeSource();
    throw error;
  }
}

export function createNpcSystem(T, {scene,source,seats=[],physics,R,playerCollider,playerBody,expanded=false,mobile=false,tier='balanced',enabled=true,drawCallBudget=200,disposeSource,prepareModel,onModularFallback}) {
  let settings={mobile,tier,enabled,drawCallBudget}, disposed=false, serial=0, seatCooldown=0, showing=true, hasPlayer=false;
  let admission=nextNpcAdmission();
  const admissionOptions={}, lastPlayer={x:0,z:0}, nextPosition={x:0,z:0};
  const seatPoint={x:0,y:0,z:0};
  let boy=null, boyNpc=null, boyLoad=null, boyController=null, boyLoading=false, placeLoadedBoy=false, preparingBoy=null;
  let modularLoader, modularController, modularLooks, preparingModular;
  let modularStatus='deferred', appearanceSerial=0;
  // Expanded arcade waypoints are up to twelve metres apart.
  const maxLeg = expanded ? 12.5 : 9;
  const visitors=[], routes=NPC_ROUTES[expanded?'expanded':'classic'].map(([x,z])=>({x,y:0,z}));
  const nearby=new Array(routes.length);
  const clips=Object.fromEntries(CLIP_NAMES.map(name=>[name,source?.animations?.find(clip=>clip.name===name)]));
  const available=Boolean(source?.scene && Object.values(clips).every(clip=>clip && clip.duration>0 && clip.tracks.length));
  const template=available?cloneNpcRig(source.scene):null;
  const templateSkeletons=new Set();
  let ownedGeometry=[],ownedMaterials=[];
  if(template) {
    const originals=[],copies=[],protectedNodes=new Set();
    source.scene.traverse(node=>originals.push(node));
    template.traverse(node=>{
      copies.push(node);
      if(node.isSkinnedMesh) templateSkeletons.add(node.skeleton);
      if(node.isLOD) node.autoUpdate=false;
    });
    for(const clip of Object.values(clips)) for(const track of clip.tracks) {
      const target=PropertyBinding.findNode(source.scene,PropertyBinding.parseTrackName(track.name).nodeName);
      const index=originals.indexOf(target);
      if(index>=0) protectedNodes.add(copies[index]);
    }
    template.visible=true;
    ownedGeometry=optimizeNpcTemplate(template,protectedNodes);
    const compact=mergeVisitorColours(T,template,protectedNodes);
    ownedGeometry.push(...compact.geometries);ownedMaterials=compact.materials;
  }
  const visitorCalls=template?visibleDrawCalls(template):0;
  let callsPerNpc=visitorCalls;
  const limitForSettings=()=>available && !disposed ? npcLimit(settings) : 0;
  const allowModular=()=>limitForSettings()>0 && !(settings.mobile && settings.tier==='low');
  function enableModular(loader=async signal=>(await import('./crowd.js')).loadModularLooks(signal)) {
    modularLoader=loader;
  }
  function reportModularFallback() {
    if (!disposed) onModularFallback?.();
  }
  function requestModular() {
    if (!modularLoader || modularStatus!=='deferred' || !allowModular()) return;
    if (!visitors.some(npc=>!npc.seat && npc!==boyNpc)) return;
    modularStatus='loading';
    const controller=modularController=new AbortController();
    Promise.resolve().then(()=>modularLoader(controller.signal)).then(looks=>{
      if (disposed || controller.signal.aborted) looks.dispose();
      else { modularLooks=looks; modularStatus='ready'; }
    }).catch(()=>{
      if (controller.signal.aborted) return;
      modularStatus='unavailable';
      reportModularFallback();
    });
  }
  async function loadBoy(loader=loadTripoNpc) {
    if (!limitForSettings() || boyLoad) return boyLoad;
    boyController=new AbortController();
    boyLoading=true;
    boyLoad=Promise.resolve().then(()=>loader(boyController.signal)).then(asset=>{
      if (!asset) return;
      if (disposed) { asset.dispose(); return; }
      prepareTripoMaterial(asset.scene.getObjectByName(asset.meshName)?.material);
      callsPerNpc=Math.max(callsPerNpc,visibleDrawCalls(asset.scene));
      boy=asset;
      placeLoadedBoy=true;
    }).catch(()=>{ /* The existing visitor rig stays in service if the boy cannot load. */ })
      .finally(()=>{boyLoading=false;});
    return boyLoad;
  }
  function applyVisibility() {
    // Change membership only when a slot opens or closes. Crossing another
    // visitor's distance must not cause either avatar to blink out of view.
    let count = 0, readyCount = 0;
    for (const npc of visitors) {
      if (npc.admitted) count++;
      if (npc.gpuReady) readyCount++;
    }
    const target = Math.min(readyCount,admission.admitted);
    while (count !== target) {
      const add = count < target;
      let choice = null, best = add ? Infinity : -Infinity;
      for (const npc of visitors) {
        if (!npc.gpuReady || npc.admitted === add) continue;
        const d = hasPlayer ? distance(npc.visual.position,lastPlayer) : 0;
        if (add ? d < best : d > best) { best=d; choice=npc; }
      }
      choice.admitted=add;
      count += add ? 1 : -1;
    }
    for (const npc of visitors) npc.visual.visible=showing && npc.admitted;
    return showing ? target : 0;
  }
  function measure(nonNpcCalls,advance) {
    admissionOptions.nonNpcCalls=nonNpcCalls;
    admissionOptions.callsPerNpc=callsPerNpc;
    admissionOptions.limit=limitForSettings();
    admissionOptions.active=0;
    admissionOptions.trianglesPerNpc=0;
    for (const npc of visitors) if (npc.gpuReady) {
      admissionOptions.active++;
      admissionOptions.trianglesPerNpc=Math.max(admissionOptions.trianglesPerNpc,npc.triangleCost);
    }
    admissionOptions.drawCallBudget=settings.drawCallBudget;
    admissionOptions.advance=advance;
    updateAdmission(admission,admissionOptions,admission);
    return applyVisibility();
  }
  const shape=new R.Capsule(.55,.3), rotation={x:0,y:0,z:0,w:1}, facingOffset=new T.Quaternion().setFromAxisAngle(T.Object3D.DEFAULT_UP,Math.PI);
  const clearancePoint={x:0,y:0,z:0};
  function clear(x,y,z) {
    clearancePoint.x=x; clearancePoint.y=y+.91; clearancePoint.z=z;
    return !physics.intersectionWithShape(clearancePoint,rotation,shape,undefined,undefined,playerCollider,playerBody);
  }
  function clearPath(a,b) {
    const steps=Math.max(1,Math.ceil(distance(a,b)/.3));
    for(let i=0;i<=steps;i++) {
      const t=i/steps;
      if(!clear(a.x+(b.x-a.x)*t,a.y,a.z+(b.z-a.z)*t)) return false;
    }
    return true;
  }
  function disposeRig({avatar,mixer,materials}) {
    avatar.removeFromParent();
    mixer.stopAllAction(); mixer.uncacheRoot(avatar);
    const skeletons=new Set();
    avatar.traverse(node=>{if(node.isSkinnedMesh) skeletons.add(node.skeleton);});
    for(const skeleton of skeletons) skeleton.dispose();
    materials?.forEach(material=>material.dispose());
  }
  function remove(npc) {
    npc.upload?.abort();
    scene.remove(npc.visual); disposeRig(npc);
    if (npc.fallbackRig) disposeRig(npc.fallbackRig);
    if (npc===boyNpc) boyNpc=null;
    visitors.splice(visitors.indexOf(npc),1);
  }
  function clearVisitors() {
    while (visitors.length) remove(visitors[visitors.length-1]);
  }
  function makeRig(npc, asset, look=null) {
    const avatar=look?.avatar || cloneNpcRig(asset?.scene || template);
    const animationClips=look?.clips || asset?.clips || clips;
    avatar.visible=true;
    if (look) {
      avatar.scale.multiplyScalar(look.scale);
      avatar.position.y=look.groundOffset;
    } else if (asset) {
      avatar.scale.multiplyScalar(BOY_SCALE);
      avatar.position.y=npc.seat ? BOY_SEAT_OFFSET : BOY_FLOOR_OFFSET;
    } else avatar.position.y=npc.seat ? -.13 : 0;
    avatar.traverse(node=>{
      node.layers.set(2);
      if (!asset && node.isSkinnedMesh) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) prepareCrowdMaterial(material, node.name);
      }
      if(node.isMesh){node.castShadow=false;node.receiveShadow=true;node.raycast=ignoreRaycast;}
    });
    const mixer=new T.AnimationMixer(avatar), actions={};
    for(const name of look ? Object.keys(animationClips) : CLIP_NAMES) {
      actions[name]=mixer.clipAction(animationClips[name]);
      actions[name].setEffectiveWeight(name===npc.mode?1:0);
      if (name==='wave' || name==='nod') {
        actions[name].setLoop(T.LoopOnce,1);
        actions[name].clampWhenFinished=true;
      } else actions[name].play();
    }
    if (actions.sit) {
      actions.sit.paused=true;
      actions.sit.time=Math.max(0,animationClips.sit.duration-.00001);
    }
    mixer.update(0);
    const mesh=asset ? avatar.getObjectByName(asset.meshName) : null;
    return {avatar,mixer,actions,mesh,highGeometry:mesh?.geometry,look,materials:look?.materials,
      triangleCost:rigTriangles(avatar)};
  }
  function mountRig(npc, rig) {
    Object.assign(npc,rig);
    npc.facing.add(npc.avatar);
    // Keep the offset outside the animated root. The route wrapper faces -Z;
    // the boy's toes, hips and walk displacement establish asset forward +Z.
    npc.facing.quaternion.copy(npc.avatar.quaternion).invert().premultiply(facingOffset);
  }
  function spawn(point,seat=null) {
    const visual=new T.Group(), facing=new T.Group();
    visual.add(facing); visual.position.set(point.x,point.y,point.z);
    visual.rotation.y=seat?.angle||0;
    visual.layers.set(2); facing.layers.set(2); visual.visible=false;
    const npc={visual,facing,seat,admitted:false,gpuReady:!prepareModel,mode:seat?'sit':'idle',target:null,delay:2+(serial++%4),route:serial%routes.length,blockedTime:0};
    npc.appearanceIndex=appearanceSerial++;
    mountRig(npc,makeRig(npc,null));
    scene.add(visual);
    visitors.push(npc);
    if (prepareModel) {
      npc.upload=new AbortController();
      void prepareModel(npc.avatar,{signal:npc.upload.signal}).then(()=>{
        npc.gpuReady=true;
      },()=>{
        if (visitors.includes(npc)) remove(npc);
      });
    }
  }
  function placeBoy(first) {
    if (!boy || boyNpc || preparingBoy || preparingModular) return;
    const candidates=visitors.slice(first).filter(npc=>npc.gpuReady && !npc.look);
    // Modular walking clips have no approved sit pose. Use the existing boy
    // seat path when possible so another slot can use the modular wardrobe.
    const choice=candidates.find(npc=>modularLoader && allowModular() ? npc.seat : !npc.seat) || candidates[0];
    if (!choice) return;
    let rig;
    try { rig=makeRig(choice,boy); }
    catch {
      boy.dispose(); boy=null; placeLoadedBoy=false;
      return;
    }
    const mount=()=>{
      disposeRig(choice);
      mountRig(choice,rig);
      boyNpc=choice;
      placeLoadedBoy=false;
    };
    if (!prepareModel) { mount(); return; }
    const meshes=[rig.avatar];
    if (boy.lowGeometry) {
      const proxy=rig.mesh.clone(false);
      proxy.geometry=boy.lowGeometry;
      meshes.push(proxy);
    }
    const upload=new AbortController();
    choice.upload=upload;
    preparingBoy=choice;
    void prepareModel(meshes,{signal:upload.signal,alternates:boy.lowGeometry?[[rig.mesh,meshes[1]]]:[]}).then(()=>{
      if (visitors.includes(choice)) mount();
      else disposeRig(rig);
    },()=>disposeRig(rig)).finally(()=>{preparingBoy=null;});
  }
  function placeModular() {
    if (!modularLooks || !allowModular() || preparingModular || preparingBoy) return;
    const candidates=visitors.filter(npc=>npc.gpuReady && npc!==boyNpc && !npc.seat && !npc.modularAttempted);
    // Keep one existing visitor eligible for a boy load still in flight.
    const remaining=visitors.filter(npc=>npc.gpuReady && !npc.look).length;
    const choice=candidates[0];
    if (!choice || (!boyNpc && (boy || boyLoading) && remaining<=1)) return;
    choice.modularAttempted=true;
    let rig;
    try {
      rig=makeRig(choice,null,modularLooks.createLook(choice.appearanceIndex,cloneNpcRig));
    } catch {
      reportModularFallback();
      return;
    }
    const mount=()=>{
      if (!allowModular() || !visitors.includes(choice)) { disposeRig(rig); return; }
      const {avatar,mixer,actions,mesh,highGeometry,look,materials}=choice;
      choice.fallbackRig={avatar,mixer,actions,mesh,highGeometry,look,materials};
      choice.avatar.removeFromParent();
      callsPerNpc=Math.max(callsPerNpc,visibleDrawCalls(rig.avatar));
      mountRig(choice,rig);
      choice.greeting=null;
      choice.idleTime=0;
      choice.greeted=false;
    };
    if (!prepareModel) { mount(); return; }
    const upload=new AbortController();
    choice.upload=upload;
    preparingModular=choice;
    void prepareModel(rig.avatar,{signal:upload.signal}).then(mount,()=>{
      disposeRig(rig);
      if (!upload.signal.aborted) reportModularFallback();
    }).finally(()=>{preparingModular=null;});
  }
  function updateGreeting(npc, dt, reducedMotion) {
    if (reducedMotion || npc.mode!=='idle' || npc.target) {
      npc.idleTime=0;
      npc.greeted=false;
      npc.greeting=null;
    } else if (!npc.greeted && (npc.idleTime+=dt)>.55 && npc.delay>.5) {
      const action=npc.actions[npc.look.greeting];
      npc.greeting=action.reset().setEffectiveWeight(0).play();
      npc.greeted=true;
    }
    if (npc.greeting?.paused) npc.greeting=null;
    npc.actions.idle.paused=reducedMotion;
    if (reducedMotion) npc.actions.idle.time=0;
    return npc.greeting;
  }
  function updateBoy(npc, player, reducedMotion) {
    npc.actions.idle.paused=reducedMotion;
    if (reducedMotion) npc.actions.idle.time=0;
    if (!boy.lowGeometry) return;
    const mesh=npc.mesh, low=mesh.geometry===boy.lowGeometry, d=distance(npc.visual.position,player);
    const useLow=low ? d>BOY_LOD_NEAR : d>BOY_LOD_FAR;
    if (useLow!==low) mesh.geometry=useLow ? boy.lowGeometry : npc.highGeometry;
  }
  function releaseSeat(id) {
    const npc=visitors.find(candidate=>candidate.seat?.id===id);
    if(!npc) return false;
    remove(npc); seatCooldown=20; measure(admission.nonNpcCalls,false); return true;
  }
  function occupied(id) {
    for (const npc of visitors) if (npc.seat?.id===id) return true;
    return false;
  }
  function tooClose(point, clearance, except=null) {
    for (const npc of visitors) if (npc!==except && distance(point,npc.visual.position)<clearance) return true;
    return false;
  }
  function update(dt,player,reducedMotion=false) {
    if(disposed) return;
    const limit=limitForSettings();
    if(!player || !Number.isFinite(player.x) || !Number.isFinite(player.y) || !Number.isFinite(player.z)) return;
    lastPlayer.x=player.x; lastPlayer.z=player.z; hasPlayer=true;
    dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
    seatCooldown=Math.max(0,seatCooldown-dt);
    const blend=1-Math.exp(-10*dt);
    for(let i=0;i<visitors.length;) {
      const npc=visitors[i];
      const p=npc.visual.position;
      if(visitors.length>limit || Math.abs(player.y-p.y)>3 || distance(p,player)>UNLOAD_DISTANCE || (npc.seat && npc.seat.id===player.seatId)) { remove(npc); continue; }
      i++;
      if(!npc.seat) {
        npc.delay-=dt;
        if(!npc.target && npc.delay<=0) {
          for(let i=0;i<routes.length;i++) {
            const target=routes[(npc.route+i)%routes.length];
            if(distance(p,target)>1 && distance(p,target)<=maxLeg && clearPath(p,target)) { npc.target=target; npc.route=(npc.route+i+1)%routes.length; break; }
          }
          if(!npc.target) npc.delay=3;
        }
        if(npc.target) {
          const d=distance(p,npc.target), step=Math.min(d,dt*.7);
          const fraction=d>0?step/d:0;
          const dx=npc.target.x-p.x,dz=npc.target.z-p.z;
          nextPosition.x=p.x+dx*fraction; nextPosition.z=p.z+dz*fraction;
          if(distance(nextPosition,player)<PLAYER_CLEARANCE+0.4 || tooClose(nextPosition,1.2,npc) || !clear(nextPosition.x,p.y,nextPosition.z)) {
            npc.mode='idle';
            // A moving visitor or player may block a route indefinitely; retry another route.
            if ((npc.blockedTime+=dt)>=2) { npc.target=null; npc.delay=1; npc.blockedTime=0; }
          } else { p.x=nextPosition.x; p.z=nextPosition.z; npc.blockedTime=0; npc.visual.rotation.y=Math.atan2(-dx,-dz); npc.mode='walk'; }
          if(d<=step+.001) { npc.target=null; npc.delay=2+(serial++%4); npc.mode='idle'; }
        }
      }
      const greeting=npc.look ? updateGreeting(npc,dt,reducedMotion) : null;
      for(const name in npc.actions) {
        const action=npc.actions[name];
        const target=greeting ? Number(action===greeting) : Number(name===npc.mode);
        action.setEffectiveWeight(action.getEffectiveWeight()+(target-action.getEffectiveWeight())*blend);
        if (npc.look && reducedMotion && (name==='wave' || name==='nod')) action.stop();
      }
      if (npc===boyNpc) updateBoy(npc,player,reducedMotion);
      npc.mixer.update(dt);
      npc.facing.quaternion.copy(npc.avatar.quaternion).invert().premultiply(facingOffset);
    }
    if(!limit || Math.abs(player.y)>3) { measure(admission.nonNpcCalls,false); return; }
    const first=placeLoadedBoy ? 0 : visitors.length;
    // Seat anchors are from the world's registered seats, not invented furniture.
    // Only ground-floor, accessible and unoccupied seats are eligible.
    const seatedLimit=Math.max(1,Math.floor(limit/3));
    if (visitors.length<limit && seatCooldown===0) {
      let seated=0;
      for (const npc of visitors) if (npc.seat) seated++;
      for(const seat of seats) {
        if(visitors.length>=limit || seated>=seatedLimit) break;
        if(seat.accessible===false || seat.floor!==0 || seat.id===player.seatId || occupied(seat.id)) continue;
        seatPoint.x=seat.x; seatPoint.y=seat.floor+.015; seatPoint.z=seat.z;
        const d=distance(seatPoint,player);
        if(d<PLAYER_CLEARANCE+1 || d>LOAD_DISTANCE || tooClose(seatPoint,2) || !clear(seat.exitX,seat.floor,seat.exitZ)) continue;
        spawn(seatPoint,seat); seated++;
      }
    }
    if (visitors.length<limit) {
      let count=0;
      for (const route of routes) {
        const d=distance(route,player);
        if(d<PLAYER_CLEARANCE+1 || d>LOAD_DISTANCE) continue;
        let i=count++;
        while(i>0 && distance(nearby[i-1],player)>d) { nearby[i]=nearby[i-1]; i--; }
        nearby[i]=route;
      }
      for(let i=0; i<count && visitors.length<limit; i++) {
        const p=nearby[i];
        if(tooClose(p,2.5) || !clear(p.x,p.y,p.z)) continue;
        spawn(p);
      }
    }
    if (boy && !boyNpc) {
      placeBoy(first);
      if (boyNpc) updateBoy(boyNpc,player,reducedMotion);
    }
    requestModular();
    placeModular();
    measure(admission.nonNpcCalls,false);
  }
  return {
    update, releaseSeat, clearVisitors, loadBoy, enableModular,
    admit(nonNpcCalls, nonNpcTriangles = 0, budget) {
      admissionOptions.totalCallCap=budget?.calls;
      admissionOptions.triangleCap=budget?.triangles;
      admissionOptions.nonNpcTriangles=nonNpcTriangles;
      showing=true;
      return measure(nonNpcCalls,true);
    },
    setVisible(value) { showing=Boolean(value); applyVisibility(); },
    forEachVisible(visit) {
      for (const {visual,seat} of visitors) {
        if (visual.visible) visit(visual.position,visual.rotation.y,seat?.floor ?? visual.position.y);
      }
    },
    setDrawCallBudget(value) { settings.drawCallBudget=value; measure(admission.nonNpcCalls,false); },
    setQuality(next={}) {
      settings={...settings,...next};
      if (!allowModular()) {
        if (modularStatus==='loading') {
          modularController.abort();
          modularStatus='deferred';
        }
        preparingModular?.upload?.abort();
        if (preparingModular) preparingModular.modularAttempted=false;
        for (const npc of visitors) {
          if (!npc.fallbackRig) continue;
          disposeRig(npc);
          mountRig(npc,npc.fallbackRig);
          npc.fallbackRig=null;
          npc.modularAttempted=false;
        }
      }
      measure(admission.nonNpcCalls,false);
    },
    dispose() {
      if(disposed)return;
      disposed=true;
      boyController?.abort();
      modularController?.abort();
      clearVisitors();
      boy?.dispose(); boy=null;
      modularLooks?.dispose(); modularLooks=null;
      for(const geometry of ownedGeometry) geometry.dispose();
      for(const material of ownedMaterials) material.dispose();
      for(const skeleton of templateSkeletons) skeleton.dispose();
      disposeSource?.();
      admission=nextNpcAdmission();
    },
    get occupiedSeatIds() { return visitors.filter(n=>n.seat).map(n=>n.seat.id); },
    get state() {
      const visible=visitors.filter(n=>n.visual.visible).length;
      return {tier:settings.tier,enabled:settings.enabled,available,limit:limitForSettings(),active:visitors.length,visible,
        ...admission,drawCallBudget:settings.drawCallBudget,totalCallCap:admissionOptions.totalCallCap??200,drawCalls:visible*callsPerNpc,callsPerNpc,
        occupiedSeatIds:visitors.filter(n=>n.seat).map(n=>n.seat.id),
        modular:{status:modularStatus, active:visitors.filter(n=>n.look).map(n=>({
          slot:n.appearanceIndex, outfit:{...n.look.appearance}, tint:[...n.look.tint], scale:n.look.variation,
          clip:n.greeting?.getClip().name || n.mode, time:n.mixer.time, visible:n.visual.visible,
          triangles:n.look.triangles
        }))}};
    }
  };
}
