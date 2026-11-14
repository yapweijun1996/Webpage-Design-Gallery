import {GLTFLoader} from '../vendor/GLTFLoader.js';
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
  cart.name='DemoPushCart';cart.rotation.y=Math.PI;cart.position.set(0,.025,-.82);cart.visible=false;visual.add(cart);
  cart.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  const parcel=new T.Mesh(new T.BoxGeometry(.23,.28,.22),new T.MeshStandardMaterial({color:0xb48751,roughness:1}));
  parcel.name='SelectionIndicator';parcel.position.set(0,.57,.08);parcel.visible=false;cart.add(parcel);
  function restore(){if(saved){joints.forEach((n,i)=>n.quaternion.copy(saved[i]));saved=null;}}
  return {set(value){restore();active=Boolean(value);cart.visible=active;return true;},setCount(value){count=value;parcel.visible=count>0;},restore,apply(){if(!active)return;saved=joints.map(n=>n.quaternion.clone());joints[0].rotation.set(-1.05,0,0);joints[2].rotation.set(-1.05,0,0);joints[1].rotation.set(-.95,0,0);joints[3].rotation.set(-.95,0,0);},get state(){return {available:true,active,count,mode:'simplified-push',wheelPhysics:false,ik:false};}};
}
