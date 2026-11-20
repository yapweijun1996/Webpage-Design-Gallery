import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

const staticNodes = ['Portal','GoldTrim','Pilasters','Sconces','Planters','ElevatorSign','MarbleInlay','FloorIndicator'];
const elevatorPriority = () => -10;

// The GLB stays independently editable. Two fixed landings share one mesh,
// one car follows the existing physics rig, and four leaves share one draw.
export function assembleElevatorKit(T, source, layout) {
  const {upper,expanded} = layout;
  source.updateMatrixWorld(true);
  const root = new T.Group();
  root.name = 'Courtyard elevator kit';
  if (expanded) {
    root.position.set(layout.shaft.minX,0,layout.z);
    root.rotation.y = -Math.PI/2;
  } else {
    root.position.set(layout.x,0,layout.z-1.36);
    root.rotation.y = Math.PI;
    root.scale.set(.74,1,.70);
  }

  const parts = [], displays = [];
  let vertex = 0;
  for (const y of [0,upper]) {
    for (const name of staticNodes) {
      const upperLanding=expanded && y===upper;
      if(upperLanding && (name==='MarbleInlay' || name==='Planters'))continue;
      const part = source.getObjectByName(name);
      // Classic has a raised courtyard mosaic with brass at +0.043 m.
      const apronOffset = !expanded && y===0 && name==='MarbleInlay' ? .045 : 0;
      const geo = part.geometry.clone().applyMatrix4(part.matrixWorld).translate(0,y+apronOffset,0);
      if(upperLanding && name==='ElevatorSign')geo.scale(.74,1,1);
      if(upperLanding && name==='FloorIndicator')geo.translate(0,0,.055);
      if (name === 'FloorIndicator') displays.push([vertex, geo.attributes.uv.array.slice()]);
      parts.push(geo);
      vertex += geo.attributes.position.count;
    }
  }
  const body = new T.Mesh(mergeGeometries(parts),source.getObjectByName('Portal').material);
  body.name = 'Lift landings';
  for (const geo of parts) geo.dispose();
  const car = source.getObjectByName('Cabin').clone(false);
  const left = source.getObjectByName('DoorLeft'), right = source.getObjectByName('DoorRight');
  const doors = new T.InstancedMesh(left.geometry,left.material,4);
  doors.name = 'Lift landing doors';
  // The glass and its opaque steel stiles share one front-sided pass.
  doors.material.depthWrite = false;
  doors.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const matrix = new T.Matrix4(), home = [left.position.x,right.position.x];
  const previous = [-1,-1];
  function setDoors(index, fraction) {
    if (fraction === previous[index]) return;
    previous[index] = fraction;
    for (let side=0; side<2; side++) {
      const x = home[side] + (side ? 1 : -1)*1.02*fraction;
      matrix.makeTranslation(x,index*upper,left.position.z);
      doors.setMatrixAt(index*2+side,matrix);
    }
    doors.instanceMatrix.needsUpdate = true;
  }
  // An enclosing bound for both end poses avoids per-frame bound computation.
  setDoors(0,1); setDoors(1,1); doors.computeBoundingSphere();
  const uv = body.geometry.attributes.uv;
  let displaySlot = -1;
  root.add(body,car,doors);
  return {root,
    update(height, ground, upperDoor, slot) {
      car.position.y = expanded ? height : Math.max(height,.025);
      setDoors(0,ground); setDoors(1,upperDoor);
      if (slot === displaySlot) return;
      displaySlot = slot;
      for (const [start, base] of displays) {
        for (let i=0; i<base.length; i+=2) uv.setX(start+i/2,base[i]+slot*96/512);
      }
      uv.needsUpdate = true;
    },
    dispose() {
      root.removeFromParent();
      body.geometry.dispose();
      doors.dispose();
      const textures = new Set(), materials = new Set(), geometries = new Set();
      source.traverse(node => {
        if (!node.isMesh) return;
        materials.add(node.material); geometries.add(node.geometry);
      });
      for (const mat of materials) {
        for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
        mat.dispose();
      }
      const images = new Set();
      for (const tex of textures) { images.add(tex.source.data); tex.dispose(); }
      for (const image of images) image?.close?.();
      for (const geo of geometries) geo.dispose();
    }
  };
}

export function createKitLoader(T, scene, layout, prepareModel, onMount) {
  let active, request, tier, status = 'pending';
  let height=0, ground=0, upper=0, slot=0;
  function update(y, g, u, s) {
    height=y; ground=g; upper=u; slot=s;
    active?.update(y,g,u,s);
  }
  async function select(next) {
    if (tier===next) return;
    request?.abort();
    const controller = new AbortController();
    request=controller; tier=next; status='pending';
    let stage;
    try {
      const url = new URL('./elevator/'+next+'.glb',import.meta.url);
      const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]);
      const response = await fetch(url,{signal});
      if (!response.ok) throw new Error('Elevator model unavailable');
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(),new URL('.',url).href);
      stage=assembleElevatorKit(T,gltf.scene,layout);
      controller.signal.throwIfAborted();
      stage.update(height,ground,upper,slot);
      await prepareModel(stage.root,{signal:controller.signal,priority:elevatorPriority,late:false});
      controller.signal.throwIfAborted();
      active?.dispose();
      active=stage; stage=null;
      active.update(height,ground,upper,slot);
      scene.add(active.root);
      onMount();
      status='loaded';
    } catch {
      if (request===controller) status='fallback';
    } finally { stage?.dispose(); }
  }
  return {select,update,get status(){return status;},get tier(){return tier;},
    dispose(){request?.abort();active?.dispose();active=null;}
  };
}
