/** Simplified authored-node presentation, not IK or a shelf pickup simulation. */
export function createCollectionGesture(T, avatar) {
  const shoulder=avatar.getObjectByName('LeftShoulder'), elbow=avatar.getObjectByName('LeftElbow');
  const hand=new T.Group();hand.name='CollectionHand';hand.position.set(0,-.19,.025);elbow?.add(hand);
  let elapsed=0, prop=null, sku=null, saved=null;
  function restore(){if(saved){shoulder.quaternion.copy(saved[0]);elbow.quaternion.copy(saved[1]);saved=null;}}
  function cancel(){restore();if(prop)hand.remove(prop);prop=null;sku=null;elapsed=0;}
  function start(item,id){if(prop||!shoulder||!elbow||!item)return false;prop=item;sku=id;elapsed=0;prop.position.set(0,-.04,-.01);prop.rotation.x=1.15;hand.add(prop);return true;}
  function update(dt){
    if(!prop)return;
    elapsed+=dt;if(elapsed>=1.35){cancel();return;}
    const rise=elapsed<.4?elapsed/.4:elapsed<.85?1:(1.35-elapsed)/.5;
    const ease=rise*rise*(3-2*rise);saved=[shoulder.quaternion.clone(),elbow.quaternion.clone()];
    shoulder.rotation.set(-.2-.25*ease,0,-.32-.43*ease);elbow.rotation.set(-.15-1.1*ease,0,0);
    prop.rotation.x=.15+1.1*ease;
  }
  return {start,cancel,restore,update,get state(){return {active:Boolean(prop),sku,elapsed,simplified:true,ik:false};}};
}
