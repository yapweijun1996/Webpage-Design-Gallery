import {DoubleSide,PropertyBinding} from '../vendor/three.module.min.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

// Visitors share the loaded player's clips, materials and unmerged geometry.
// Only merged buffers and cloned skeleton resources belong to this system.
export const NPC_ROUTES = Object.freeze({
  classic: Object.freeze([[-11,3],[-8,3],[-2,3],[2,3],[8,3],[11,3],[-11,7],[-11,15],[-3,16],[3,16],[11,15],[11,7]]),
  expanded: Object.freeze([[-12,4],[-8,4],[0,4],[10,4],[20,4],[30,4],[32,12],[32,20],[32,32],[30,39],[20,39],[10,39],[0,39],[-10,39],[-12,32],[-12,20],[-12,12]])
});
const LOAD_DISTANCE = 18, UNLOAD_DISTANCE = 22, PLAYER_CLEARANCE = 1.6;
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
      const matches=other=>{
        const a=other.geometry;
        if(other.parent!==node.parent || other.material!==node.material || Boolean(other.isSkinnedMesh)!==Boolean(node.isSkinnedMesh) ||
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
      };
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

export function npcLimit({tier='balanced',mobile=false,enabled=true}={}) {
  if (!enabled) return 0;
  const limits = mobile ? {low:1,balanced:2,detailed:3} : {low:2,balanced:4,detailed:6};
  return limits[tier] ?? limits.balanced;
}

// Pure current-frame admission: cuts never wait; growth needs eight consecutive
// safe measurements and four spare calls beyond the next visitor's full cost.
export function nextNpcAdmission(previous={}, {nonNpcCalls,callsPerNpc,limit=0,active=limit,drawCallBudget=200,advance=true}={}) {
  const known=Number.isFinite(nonNpcCalls) && nonNpcCalls>=0;
  const allowance=Number.isFinite(drawCallBudget)?Math.max(0,drawCallBudget):0;
  const headroom=known?Math.max(0,Math.min(200-Math.ceil(nonNpcCalls),allowance)):0;
  const cost=Number.isFinite(callsPerNpc) && callsPerNpc>0?Math.ceil(callsPerNpc):0;
  const cap=Number.isFinite(limit) && Number.isFinite(active)?Math.max(0,Math.floor(Math.min(limit,active))):0;
  const capacity=cost?Math.min(cap,Math.floor(headroom/cost)):0;
  const before=Math.max(0,Math.floor(previous.admitted||0));
  let admitted=Math.min(before,capacity),safeFrames=previous.safeFrames||0;
  if(!known || admitted<before || admitted>=capacity || headroom<(admitted+1)*cost+4) safeFrames=0;
  else if(advance && ++safeFrames>=8) { admitted++; safeFrames=0; }
  return {admitted,safeFrames,capacity,headroom,budgetKnown:known,nonNpcCalls:known?Math.ceil(nonNpcCalls):null};
}

// Equivalent to SkeletonUtils.clone for a self-contained glTF hierarchy: bones
// must be remapped, while geometries, materials, textures and clips remain shared.
export function cloneNpcRig(source) {
  const clone=source.clone(true), originals=[], copies=[];
  source.traverse(node=>originals.push(node));
  clone.traverse(node=>copies.push(node));
  const remap=new Map(originals.map((node,i)=>[node,copies[i]]));
  for (let i=0;i<originals.length;i++) {
    const original=originals[i], copy=copies[i];
    if(Array.isArray(original.material)) copy.material=original.material.slice();
    if (!original.isSkinnedMesh) continue;
    copy.skeleton=original.skeleton.clone();
    copy.skeleton.bones=original.skeleton.bones.map(bone=>{
      const result=remap.get(bone);
      if (!result) throw new Error('NPC skeleton bone is outside the visitor model');
      return result;
    });
    copy.bind(copy.skeleton,original.bindMatrix);
  }
  return clone;
}

export function createNpcSystem(T, {scene,source,seats=[],physics,R,playerCollider,playerBody,expanded=false,mobile=false,tier='balanced',enabled=true,drawCallBudget=200}) {
  let settings={mobile,tier,enabled,drawCallBudget}, disposed=false, serial=0, seatCooldown=0, showing=true, lastPlayer=null;
  let admission=nextNpcAdmission();
  const visitors=[], routes=NPC_ROUTES[expanded?'expanded':'classic'].map(([x,z])=>({x,y:0,z}));
  const clips=Object.fromEntries(['idle','walk','sit'].map(name=>[name,source?.animations?.find(clip=>clip.name===name)]));
  const available=Boolean(source?.scene && Object.values(clips).every(clip=>clip && clip.duration>0 && clip.tracks.length));
  const template=available?cloneNpcRig(source.scene):null;
  const templateSkeletons=new Set();
  let ownedGeometry=[];
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
  }
  const callsPerNpc=template?visibleDrawCalls(template):0;
  const limitForSettings=()=>available && !disposed ? npcLimit(settings) : 0;
  function applyVisibility() {
    const ordered=lastPlayer?[...visitors].sort((a,b)=>distance(a.visual.position,lastPlayer)-distance(b.visual.position,lastPlayer)):visitors;
    ordered.forEach((npc,i)=>{npc.visual.visible=showing && i<admission.admitted;});
    return showing?Math.min(admission.admitted,visitors.length):0;
  }
  function measure(nonNpcCalls,advance) {
    admission=nextNpcAdmission(admission,{nonNpcCalls,callsPerNpc,limit:limitForSettings(),active:visitors.length,drawCallBudget:settings.drawCallBudget,advance});
    return applyVisibility();
  }
  const shape=new R.Capsule(.55,.3), rotation={x:0,y:0,z:0,w:1};
  const clear = p => !physics.intersectionWithShape({x:p.x,y:(p.y||0)+.91,z:p.z},rotation,shape,undefined,undefined,playerCollider,playerBody);
  function clearPath(a,b) {
    const steps=Math.max(1,Math.ceil(distance(a,b)/.3));
    for(let i=0;i<=steps;i++) { const t=i/steps; if(!clear({x:a.x+(b.x-a.x)*t,y:a.y,z:a.z+(b.z-a.z)*t})) return false; }
    return true;
  }
  function remove(npc) {
    scene.remove(npc.visual); npc.mixer.stopAllAction(); npc.mixer.uncacheRoot(npc.avatar);
    const skeletons=new Set();
    npc.avatar.traverse(node=>{if(node.isSkinnedMesh) skeletons.add(node.skeleton);});
    for(const skeleton of skeletons) skeleton.dispose();
    visitors.splice(visitors.indexOf(npc),1);
  }
  function spawn(point,seat=null) {
    const avatar=cloneNpcRig(template), visual=new T.Group();
    avatar.visible=true; avatar.rotation.y=Math.PI; visual.add(avatar); visual.position.set(point.x,point.y||0,point.z);
    visual.rotation.y=seat?.angle||0; avatar.position.y=seat?-.13:0;
    visual.layers.set(2);
    avatar.traverse(node=>{
      node.layers.set(2);
      if(node.isMesh){node.castShadow=false;node.receiveShadow=true;node.raycast=ignoreRaycast;}
    });
    visual.visible=false;
    const mixer=new T.AnimationMixer(avatar), actions={};
    for(const name of ['idle','walk','sit']) { actions[name]=mixer.clipAction(clips[name]); actions[name].setEffectiveWeight(name===(seat?'sit':'idle')?1:0).play(); }
    actions.sit.paused=true; actions.sit.time=Math.max(0,clips.sit.duration-.00001);
    mixer.update(0); scene.add(visual);
    visitors.push({visual,avatar,mixer,actions,seat,mode:seat?'sit':'idle',target:null,delay:2+(serial++%4),route:serial%routes.length,seatTime:0});
  }
  function setMode(npc,mode) {
    if(npc.mode===mode) return;
    npc.mode=mode;
    for(const [name,action] of Object.entries(npc.actions)) action.setEffectiveWeight(name===mode?1:0);
  }
  function releaseSeat(id) {
    const npc=visitors.find(candidate=>candidate.seat?.id===id);
    if(!npc) return false;
    remove(npc); seatCooldown=20; measure(admission.nonNpcCalls,false); return true;
  }
  function update(dt,player) {
    if(disposed) return;
    const limit=limitForSettings();
    if(!player || !Number.isFinite(player.x) || !Number.isFinite(player.y) || !Number.isFinite(player.z)) return;
    lastPlayer={x:player.x,z:player.z};
    dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
    seatCooldown=Math.max(0,seatCooldown-dt);
    for(const npc of [...visitors]) {
      const p=npc.visual.position;
      if(visitors.length>limit || Math.abs(player.y-p.y)>3 || distance(p,player)>UNLOAD_DISTANCE || distance(p,player)<PLAYER_CLEARANCE || npc.seat?.id===player.seatId) { remove(npc); continue; }
      if(npc.seat && (npc.seatTime+=dt)>=18) { remove(npc); seatCooldown=20; continue; }
      if(!npc.seat) {
        npc.delay-=dt;
        if(!npc.target && npc.delay<=0) {
          for(let i=0;i<routes.length;i++) {
            const target=routes[(npc.route+i)%routes.length];
            if(distance(p,target)>1 && distance(p,target)<9 && clearPath(p,target)) { npc.target=target; npc.route=(npc.route+i+1)%routes.length; break; }
          }
          if(!npc.target) npc.delay=3;
        }
        if(npc.target) {
          const d=distance(p,npc.target), step=Math.min(d,dt*.7);
          const next={x:p.x+(npc.target.x-p.x)*step/d,y:p.y,z:p.z+(npc.target.z-p.z)*step/d};
          if(distance(next,player)<PLAYER_CLEARANCE+0.4 || visitors.some(other=>other!==npc && distance(next,other.visual.position)<1.2) || !clear(next)) setMode(npc,'idle');
          else { p.x=next.x; p.z=next.z; npc.visual.rotation.y=Math.atan2(-npc.target.x+p.x,-npc.target.z+p.z); setMode(npc,'walk'); }
          if(d<=step+.001) { npc.target=null; npc.delay=2+(serial++%4); setMode(npc,'idle'); }
        }
      }
      npc.mixer.update(dt);
    }
    if(!limit || Math.abs(player.y)>3) { measure(admission.nonNpcCalls,false); return; }
    // Seat anchors are from the world's registered seats, not invented furniture.
    // Only ground-floor, accessible and unoccupied seats are eligible.
    const candidates=[];
    for(const seat of seats) {
      if(seatCooldown>0 || seat.accessible===false || seat.floor!==0 || seat.id===player.seatId || visitors.some(n=>n.seat?.id===seat.id)) continue;
      const p={x:seat.x,y:seat.y,z:seat.z};
      if(distance(p,player)>=PLAYER_CLEARANCE+1 && distance(p,player)<=LOAD_DISTANCE && clear({x:seat.exitX,y:seat.floor,z:seat.exitZ})) candidates.push({p,seat});
    }
    // Seat at most one third of the budget; the remainder stays mobile.
    const seatedLimit=Math.max(1,Math.floor(limit/3));
    let seated=visitors.filter(n=>n.seat).length;
    for(const {p,seat} of candidates) {
      if(visitors.length>=limit || seated>=seatedLimit) break;
      if(visitors.some(n=>distance(n.visual.position,p)<2)) continue;
      spawn(p,seat); seated++;
    }
    const nearby=routes.filter(p=>distance(p,player)>=PLAYER_CLEARANCE+1 && distance(p,player)<=LOAD_DISTANCE).sort((a,b)=>distance(a,player)-distance(b,player));
    for(const p of nearby) {
      if(visitors.length>=limit) break;
      if(visitors.some(n=>distance(n.visual.position,p)<2.5) || !clear(p)) continue;
      spawn(p);
    }
    measure(admission.nonNpcCalls,false);
  }
  return {
    update, releaseSeat,
    admit(nonNpcCalls) { showing=true; return measure(nonNpcCalls,true); },
    setVisible(value) { showing=Boolean(value); applyVisibility(); },
    setDrawCallBudget(value) { settings.drawCallBudget=value; measure(admission.nonNpcCalls,false); },
    setQuality(next={}) { settings={...settings,...next}; measure(admission.nonNpcCalls,false); },
    dispose() {
      if(disposed)return;
      disposed=true;
      for(const npc of [...visitors]) remove(npc);
      for(const geometry of ownedGeometry) geometry.dispose();
      for(const skeleton of templateSkeletons) skeleton.dispose();
      admission=nextNpcAdmission();
    },
    get occupiedSeatIds() { return visitors.filter(n=>n.seat).map(n=>n.seat.id); },
    get state() {
      const visible=visitors.filter(n=>n.visual.visible).length;
      return {tier:settings.tier,enabled:settings.enabled,available,limit:limitForSettings(),active:visitors.length,visible,
        ...admission,drawCallBudget:settings.drawCallBudget,totalCallCap:200,drawCalls:visible*callsPerNpc,callsPerNpc,
        occupiedSeatIds:visitors.filter(n=>n.seat).map(n=>n.seat.id)};
    }
  };
}
