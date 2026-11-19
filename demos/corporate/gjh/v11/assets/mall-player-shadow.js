// Preserve the key's direction while translating its shadow projection in
// light-space texel steps. World XZ snapping would still shimmer at this angle.
export function createPlayerShadow(T, scene, key) {
  const span = 16, size = 1024, texel = span/size;
  const {shadow,target} = key;
  const offset = key.position.clone().sub(target.position);
  const back = offset.clone().normalize();
  const right = new T.Vector3().crossVectors(shadow.camera.up,back).normalize();
  const up = new T.Vector3().crossVectors(back,right);
  const centre = new T.Vector3();
  shadow.mapSize.set(size,size);
  Object.assign(shadow.camera,{left:-span/2,right:span/2,top:span/2,bottom:-span/2,near:.5,far:50});
  shadow.camera.updateProjectionMatrix();
  shadow.normalBias = .025;
  shadow.bias = -.00025;
  scene.add(target);
  const snap = value => Math.round(value/texel)*texel;
  return {
    update({x,y,z}) {
      centre.set(x,y,z);
      target.position.copy(right).multiplyScalar(snap(centre.dot(right)))
        .addScaledVector(up,snap(centre.dot(up)))
        .addScaledVector(back,centre.dot(back));
      key.position.copy(target.position).add(offset);
    }
  };
}
