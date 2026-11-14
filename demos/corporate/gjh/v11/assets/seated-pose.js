/** Explicit seated presentation blended procedural seat pose; no IK or authored sit clip. */
export function createSeatedPose(avatar) {
 const nodes=['LeftHip','RightHip','LeftKnee','RightKnee','LeftShoulder','RightShoulder','LeftElbow','RightElbow'].map(name=>avatar.getObjectByName(name));
 let weight=0,saved=null;
 function restore(){if(saved){nodes.forEach((node,i)=>node.quaternion.copy(saved[i]));saved=null;}}
 function apply(){if(!weight)return;saved=nodes.map(node=>node.quaternion.clone());nodes.forEach((node,i)=>{const base=node.quaternion.clone();node.rotation.set(i<2?-Math.PI/2:i<4?Math.PI/2:i<6?-.3:-.95,0,0);const target=node.quaternion.clone();node.quaternion.copy(base).slerp(target,weight);});}
 return {set(value){restore();weight=value&&nodes.every(Boolean)?1:0;},setProgress(value){restore();weight=nodes.every(Boolean)?Math.max(0,Math.min(1,value)):0;},restore,apply,get active(){return weight>0;},get weight(){return weight;}};
}
