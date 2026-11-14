/** Explicit seated presentation for the one reviewed courtyard bench, not IK. */
export function createSeatedPose(avatar) {
 const nodes=['LeftHip','RightHip','LeftKnee','RightKnee','LeftShoulder','RightShoulder','LeftElbow','RightElbow'].map(name=>avatar.getObjectByName(name));
 let active=false,saved=null;
 function restore(){if(saved){nodes.forEach((node,i)=>node.quaternion.copy(saved[i]));saved=null;}}
 function apply(){if(!active)return;saved=nodes.map(node=>node.quaternion.clone());nodes.forEach((node,i)=>node.rotation.set(i<2?-Math.PI/2:i<4?Math.PI/2:i<6?-.3:-.95,0,0));}
 return {set(value){restore();active=Boolean(value)&&nodes.every(Boolean);},restore,apply,get active(){return active;}};
}
