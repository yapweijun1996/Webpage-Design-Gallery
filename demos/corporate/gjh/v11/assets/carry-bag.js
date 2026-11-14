/** Original generic shopping-bag prop; a carrying cue, not a pickup simulation. */
export function createCarryBag(T, avatar) {
  const shoulder = avatar.getObjectByName('RightShoulder'), elbow = avatar.getObjectByName('RightElbow');
  if (!shoulder || !elbow) return {setCount() {}, restore() {}, apply() {}, get state() { return {available:false, visible:false, count:0}; }};
  const group = new T.Group(); group.name = 'DemoShoppingBag'; group.position.set(0, -.19, 0); group.visible = false;
  const paper = new T.MeshStandardMaterial({color:0xb48751, roughness:.94}), handleMaterial = new T.MeshStandardMaterial({color:0x765735, roughness:1});
  function panel(x,y,z,sx,sy,sz) {const mesh=new T.Mesh(new T.BoxGeometry(sx,sy,sz),paper);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  panel(0,-.21,-.075,.25,.24,.008);panel(0,-.21,.075,.25,.24,.008);
  panel(-.121,-.21,0,.008,.24,.15);panel(.121,-.21,0,.008,.24,.15);panel(0,-.326,0,.25,.008,.15);
  for (const z of [-.07,.07]) {
    const curve = new T.QuadraticBezierCurve3(new T.Vector3(-.065,-.09,z),new T.Vector3(0,.09,-z),new T.Vector3(.065,-.09,z));
    const handle = new T.Mesh(new T.TubeGeometry(curve,12,.006,4,false),handleMaterial);handle.castShadow=true;group.add(handle);
  }
  elbow.add(group);let count=0, saved=null;
  function restore() { if (saved) { shoulder.quaternion.copy(saved[0]); elbow.quaternion.copy(saved[1]); saved=null; } }
  function apply() {
    if (!count) return;
    saved=[shoulder.quaternion.clone(),elbow.quaternion.clone()];
    // The authored articulated arm has no hand/finger rig or pickup clip.
    // Keep it beside the body rather than letting locomotion swing the prop through it.
    shoulder.rotation.set(-.12,0,.28);elbow.rotation.set(-.12,0,0);
  }
  return {setCount(value) {count=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;group.visible=count>0;if(!count)restore();},restore,apply,get state(){return {available:true,visible:group.visible,count,mode:'generic-carry-cue',pickupAnimation:false};}};
}
