import {escalatorLayout as layout, escalatorHeight} from './lift-layout.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

// The walking surface is continuous. The visible steps and fixed handrails follow the same profile.
export function buildEscalator(T,R,physics,scene,staticParts,glassParts,geometry) {
  const e=layout;
  function span(kind,start,end,z,width,top,depth,collision) {
    const first=escalatorHeight(start)+top, last=escalatorHeight(end)+top;
    const angle=Math.atan2(last-first,end-start), length=Math.hypot(end-start,last-first);
    const x=(start+end)/2+Math.sin(angle)*depth/2, y=(first+last)/2-Math.cos(angle)*depth/2;
    if(kind==='glass')glassParts.push(new T.BoxGeometry(length,depth,width).rotateZ(angle).translate(x,y,z));
    else if(kind)staticParts.push(geometry(kind,0,0,0,length,depth,width).rotateZ(angle).translate(x,y,z));
    if(collision)physics.createCollider(R.ColliderDesc.cuboid(length/2,depth/2,width/2)
      .setRotation({x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)}).setTranslation(x,y,z));
  }
  const ends=[e.upperEdge,e.upperFlat,e.lowerFlat,e.lowerEdge];
  for(let i=1;i<ends.length;i++){
    const a=ends[i-1],b=ends[i];
    span('panel',a,b,e.z,e.width,-.10,.34,false);
    span(null,a,b,e.z,e.width,0,.38,true);
    for(const side of [-1,1]){
      const z=e.z+side*(e.width-.12)/2;
      span(null,a,b,z,.12,.90,1.10,true);
      span('stone',a,b,z,.12,.19,.42,false);
      span('glass',a,b,z,.035,.84,.68,false);
      span('panel',a,b,z,.15,.93,.08,false);
      span('rail',a,b,z,.13,.85,.025,false);
      const bays=Math.ceil((b-a)/1.5);
      for(let j=0;j<bays;j++){
        const x=a+(j+.5)*(b-a)/bays;
        staticParts.push(geometry('rail',x,escalatorHeight(x)+.49,z,.055,.72,.055));
      }
    }
  }
  // A flush plate carries the joint to the ground without an open riser under the comb.
  for(const [x,y] of [[e.upperEdge,e.rise],[e.lowerEdge,0]]){
    staticParts.push(geometry('rail',x,y+.012,e.z,.30,.026,e.clearWidth));
  }
  function colouredBox(w,h,d,colour,dx,dy) {
    const g=new T.BoxGeometry(w,h,d).toNonIndexed().translate(dx,dy,0);
    const rgb=new T.Color(colour), values=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<values.length;i+=3)rgb.toArray(values,i);
    g.setAttribute('color',new T.BufferAttribute(values,3));return g;
  }
  const spanX=e.lowerEdge-e.upperEdge, pitch=spanX/e.stepCount;
  const parts=[colouredBox(pitch-.007,.185,e.clearWidth,0x4d5753,0,-.078),
    colouredBox(.025,.010,e.clearWidth-.03,0xe4bc6c,pitch/2-.020,.020)];
  const steps=new T.InstancedMesh(mergeGeometries(parts),new T.MeshStandardMaterial({vertexColors:true,roughness:.61,metalness:.23}),e.stepCount);
  parts.forEach(part=>part.dispose());
  steps.name='Ascending escalator treads';
  steps.instanceMatrix.setUsage(T.DynamicDrawUsage);
  steps.boundingSphere=new T.Sphere(new T.Vector3((e.upperEdge+e.lowerEdge)/2,e.rise/2,e.z),Math.hypot(spanX,e.rise,e.width)/2+.4);
  const matrix=new T.Matrix4();
  let phase=0;
  function advance(dt,freeze=false,viewer) {
    const wasVisible=steps.visible;
    if(viewer)steps.visible=Math.hypot(viewer.x-(e.lowerEdge+e.upperEdge)/2,viewer.z-e.z)<30;
    if(!steps.visible || dt && freeze && wasVisible)return;
    phase=(phase+dt*e.speed)%pitch;
    for(let i=0;i<e.stepCount;i++){
      const x=e.upperEdge+((i+.5)*pitch-phase+spanX)%spanX;
      steps.setMatrixAt(i,matrix.makeTranslation(x,escalatorHeight(x),e.z));
    }
    steps.instanceMatrix.needsUpdate=true;
  }
  advance(0);scene.add(steps);
  return {advance};
}
