import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {opaqueBatch} from './opaque-batch.js';

// Keep the four authored wheel transforms as animation anchors. Only rendering is batched.
function batchCart(T, cart) {
  const meshes = []; cart.traverse(node => { if (node.isMesh) meshes.push(node); });
  const wheels = meshes.filter(node => node.name.startsWith('CASTER_Wheel'));
  const body = meshes.filter(node => !wheels.includes(node));
  const sameArray = (a, b) => a && b && a.constructor === b.constructor && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const compatible = mesh => !mesh.isSkinnedMesh && !mesh.morphTargetInfluences?.length && !mesh.children.length &&
    Object.keys(mesh.geometry.attributes).sort().join(',') === 'normal,position' &&
    ['position', 'normal'].every(key => mesh.geometry.attributes[key].isBufferAttribute && mesh.geometry.attributes[key].itemSize === 3) &&
    mesh.geometry.attributes.position.count > 0 && mesh.geometry.attributes.position.count === mesh.geometry.attributes.normal.count &&
    mesh.material?.type === 'MeshStandardMaterial' &&
    !mesh.material.transparent && mesh.material.opacity === 1 && mesh.material.side === T.DoubleSide &&
    !mesh.material.vertexColors && mesh.material.emissive.getHex() === 0 &&
    !Object.entries(mesh.material).some(([key, value]) => (key === 'map' || key.endsWith('Map')) && value);
  // Unreviewed replacement geometry retains its original representation and functionality.
  if (wheels.length !== 4 || body.length !== 19 || !meshes.every(compatible) || !body.every(mesh =>
      Boolean(mesh.geometry.index) === Boolean(body[0].geometry.index) && ['position', 'normal'].every(key =>
        mesh.geometry.attributes[key].normalized === body[0].geometry.attributes[key].normalized &&
        mesh.geometry.attributes[key].array.constructor === body[0].geometry.attributes[key].array.constructor)) || !wheels.every(wheel =>
      wheel.material === wheels[0].material && sameArray(wheel.geometry.attributes.position.array, wheels[0].geometry.attributes.position.array) &&
      sameArray(wheel.geometry.attributes.normal.array, wheels[0].geometry.attributes.normal.array) &&
      sameArray(wheel.geometry.index?.array, wheels[0].geometry.index?.array))) return;
  cart.updateWorldMatrix(true, true);
  const inverse = new T.Matrix4().copy(cart.matrixWorld).invert(), parts = [];
  for (const mesh of body) {
    const geometry = mesh.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    const count = geometry.attributes.position.count, colour = new Float32Array(count * 3), surface = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      colour.set([mesh.material.color.r, mesh.material.color.g, mesh.material.color.b], i * 3);
      surface.set([mesh.material.roughness, mesh.material.metalness], i * 2);
    }
    geometry.setAttribute('color', new T.BufferAttribute(colour, 3)); geometry.setAttribute('obSurface', new T.BufferAttribute(surface, 2)); parts.push(geometry);
  }
  const staticBody = opaqueBatch(T, parts, true); staticBody.name = 'Opaque cart body';
  const wheelBatch = new T.InstancedMesh(wheels[0].geometry, wheels[0].material, 4);
  wheelBatch.name = 'Instanced cart wheels'; wheelBatch.castShadow = wheelBatch.receiveShadow = true;
  wheelBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const anchors = new Map();
  for (const mesh of meshes) {
    const anchor = new T.Object3D().copy(mesh, false); mesh.parent.add(anchor); mesh.removeFromParent(); anchors.set(mesh, anchor);
  }
  cart.add(staticBody, wheelBatch);
  const relative = new T.Matrix4(), batchInverse = new T.Matrix4();
  function syncWheels() {
    cart.updateWorldMatrix(true, true); batchInverse.copy(wheelBatch.matrixWorld).invert();
    wheels.forEach((wheel, i) => wheelBatch.setMatrixAt(i, relative.multiplyMatrices(batchInverse, anchors.get(wheel).matrixWorld)));
    wheelBatch.instanceMatrix.needsUpdate = true;
  }
  syncWheels();
  // Frustum culling precedes render/shadow callbacks. Enclose every possible spin,
  // using each anchor centre and the maximum native vertex distance from its pivot.
  const bounds = new T.Box3(), point = new T.Vector3(), position = wheelBatch.geometry.attributes.position;
  let radius = 0;
  for (let i = 0; i < position.count; i++) radius = Math.max(radius, point.fromBufferAttribute(position, i).length());
  for (let i = 0; i < 4; i++) {
    wheelBatch.getMatrixAt(i, relative); const reach = radius * relative.getMaxScaleOnAxis(); point.setFromMatrixPosition(relative);
    bounds.expandByPoint(point.clone().addScalar(-reach)); bounds.expandByPoint(point.clone().addScalar(reach));
  }
  wheelBatch.boundingBox = bounds; wheelBatch.boundingSphere = bounds.getBoundingSphere(new T.Sphere());
  wheelBatch.onBeforeRender = syncWheels; wheelBatch.onBeforeShadow = syncWheels;
  // Rubber and the shared wheel prototype remain live; dispose only removed prototypes.
  const geometries = new Set(meshes.map(mesh => mesh.geometry)), materials = new Set(meshes.map(mesh => mesh.material));
  geometries.delete(wheelBatch.geometry); materials.delete(wheelBatch.material);
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}

/** Optional owner-authored prop. A fixed pushing pose, not IK or wheel physics. */
export async function createPushCart(T, avatar, visual) {
  let active=false, count=0, saved=null;
  const joints=['LeftShoulder','LeftElbow','RightShoulder','RightElbow'].map(n=>avatar.getObjectByName(n));
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
  let cart;
  try {
    const response=await fetch(new URL('./shopping-cart.glb',import.meta.url),{signal:abort.signal});
    if(!response.ok)throw Error('unavailable');
    const buffer=await response.arrayBuffer();
    if(buffer.byteLength>600000)throw Error('budget');
    const data=new DataView(buffer),json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,data.getUint32(12,true))));
    if((json.images||[]).length||(json.buffers||[]).some(b=>b.uri)||(json.extensionsRequired||[]).length)throw Error('external');
    cart=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    if(joints.some(n=>!n))throw Error('joints');
  } catch {
    return {set(){return false;},setCount(){},restore(){},apply(){},get state(){return {available:false,active:false};}};
  } finally {clearTimeout(timer);}
  batchCart(T, cart);
  cart.name='DemoPushCart';cart.rotation.y=Math.PI;cart.position.set(0,.025,-.82);cart.visible=false;visual.add(cart);
  cart.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  const parcel=new T.Mesh(new T.BoxGeometry(.23,.28,.22),new T.MeshStandardMaterial({color:0xb48751,roughness:1}));
  parcel.name='SelectionIndicator';parcel.position.set(0,.57,.08);parcel.visible=false;cart.add(parcel);
  function restore(){if(saved){joints.forEach((n,i)=>n.quaternion.copy(saved[i]));saved=null;}}
  return {set(value){restore();active=Boolean(value);cart.visible=active;return true;},setCount(value){count=value;parcel.visible=count>0;},restore,apply(){if(!active)return;saved=joints.map(n=>n.quaternion.clone());joints[0].rotation.set(-1.05,0,0);joints[2].rotation.set(-1.05,0,0);joints[1].rotation.set(-.95,0,0);joints[3].rotation.set(-.95,0,0);},get state(){return {available:true,active,count,mode:'simplified-push',wheelPhysics:false,ik:false};}};
}
