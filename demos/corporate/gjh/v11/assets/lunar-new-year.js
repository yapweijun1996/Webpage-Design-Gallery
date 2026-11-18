import {atriumLayout} from './atrium-layout.js';

const garden=atriumLayout.garden, event=atriumLayout.event;
const point=(x,z)=>Object.freeze({x,z});
// Ground decorations remain within the existing collidable planter; lanterns
// hang above the event reservation, leaving its floor and the ring clear.
export const LUNAR_DECOR_LAYOUT=Object.freeze({
  trees:Object.freeze([point(garden.x-2.8,garden.z),point(garden.x+2.8,garden.z)]),
  treeRadius:.68,
  lanterns:Object.freeze([5.5,10,14.5].flatMap(x=>[25,28,31].map(z=>point(x,z)))),
  lanternBottom:4.82,
  banner:Object.freeze({x:(event.minX+event.maxX)/2,z:31.8,y:6.65,width:7.2,height:.78})
});

/** Original, brand-neutral decorations; all geometry and materials belong to
 * this stage and are removable without modifying shared mall assets. */
export function prepareLunarDecor(T, scene, theme, {signal}={}) {
  const group=new T.Group();group.name='Lunar New Year decorations';group.userData.mallThemeDecoration='lunar-new-year';
  const geometries=[],materials=[];let disposed=false;
  const ownGeometry=g=>(geometries.push(g),g),ownMaterial=m=>(materials.push(m),m);
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();
    for(const material of materials){material.map?.dispose();material.dispose();}
    for(const geometry of geometries)geometry.dispose();
  }
  try {
    if(signal?.aborted)throw new Error('Theme preparation cancelled');
    const sphere=ownGeometry(new T.SphereGeometry(1,16,12));
    const cylinder=ownGeometry(new T.CylinderGeometry(1,1,1,12));
    const torus=ownGeometry(new T.TorusGeometry(1,.018,6,24));
    const red=ownMaterial(new T.MeshStandardMaterial({color:0xb31f28,emissive:0x4c080b,emissiveIntensity:.22,roughness:.52}));
    const gold=ownMaterial(new T.MeshStandardMaterial({color:0xd4ad59,metalness:.62,roughness:.34}));
    const bark=ownMaterial(new T.MeshStandardMaterial({color:0x68452d,roughness:.9}));
    const foliage=ownMaterial(new T.MeshStandardMaterial({color:0x35643c,roughness:.82}));
    const leaves=ownMaterial(new T.MeshStandardMaterial({color:0x49784a,roughness:.8}));
    const fruit=ownMaterial(new T.MeshStandardMaterial({color:0xf2981e,roughness:.48}));
    const blossom=ownMaterial(new T.MeshStandardMaterial({color:0xf2b6b2,roughness:.68}));
    const batches=new Map(),matrix=new T.Matrix4(),pos=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
    function add(geometry,material,x,y,z,sx,sy,sz,angle=0){
      let byMaterial=batches.get(geometry);if(!byMaterial){byMaterial=new Map();batches.set(geometry,byMaterial);}
      if(!byMaterial.has(material))byMaterial.set(material,[]);
      pos.set(x,y,z);scale.set(sx,sy,sz);rotation.setFromAxisAngle(new T.Vector3(0,1,0),angle);
      matrix.compose(pos,rotation,scale);byMaterial.get(material).push(matrix.clone());
    }
    function branch(x1,y1,z1,x2,y2,z2,radius){
      const start=new T.Vector3(x1,y1,z1),end=new T.Vector3(x2,y2,z2),delta=end.clone().sub(start);
      let byMaterial=batches.get(cylinder);if(!byMaterial){byMaterial=new Map();batches.set(cylinder,byMaterial);}
      if(!byMaterial.has(bark))byMaterial.set(bark,[]);
      matrix.compose(start.add(end).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()),new T.Vector3(radius,delta.length(),radius));
      byMaterial.get(bark).push(matrix.clone());
    }
    for(const {x,z} of LUNAR_DECOR_LAYOUT.lanterns){
      add(cylinder,gold,x,7.35,z,.018,1.9,.018);
      add(sphere,red,x,6.05,z,.51,.39,.51);
      for(let rib=0;rib<4;rib++)add(torus,gold,x,6.05,z,.51,.39,.51,rib*Math.PI/4);
      for(const y of [5.68,6.42])add(cylinder,gold,x,y,z,.17,.085,.17);
      add(cylinder,red,x,5.36,z,.045,.58,.045);
      add(sphere,gold,x,5.03,z,.065,.075,.065);
    }
    for(const {x,z} of LUNAR_DECOR_LAYOUT.trees){
      add(cylinder,bark,x,1.3,z,.075,1.5,.075);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,dx=Math.cos(a)*.37,dz=Math.sin(a)*.37;
        branch(x,1.45,z,x+dx,2.25,z+dz,.028);
        add(sphere,i%2?foliage:leaves,x+dx,2.27+(i%3)*.12,z+dz,.29,.3,.27);
        add(sphere,fruit,x+Math.cos(a)*.5,2.28+(i%3)*.12,z+Math.sin(a)*.5,.09,.095,.09);
        add(sphere,fruit,x+Math.cos(a+.25)*.26,2.56,z+Math.sin(a+.25)*.26,.075,.08,.075);
      }
      add(sphere,foliage,x,2.52,z,.37,.34,.37);
      // Small blossom sprays use the same existing planter footprint.
      for(const side of [-1,1]){
        branch(x,1.25,z,x+side*.55,2.85,z,.022);
        for(let j=0;j<4;j++)add(sphere,blossom,x+side*(.27+j*.09),2.07+j*.24,z+(j%2?.09:-.09),.09,.075,.09);
      }
    }
    for(const [geometry,byMaterial] of batches)for(const [material,transforms] of byMaterial){
      const mesh=new T.InstancedMesh(geometry,material,transforms.length);transforms.forEach((transform,i)=>mesh.setMatrixAt(i,transform));
      mesh.computeBoundingSphere();mesh.receiveShadow=true;group.add(mesh);
    }
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Seasonal banner unavailable');
    ctx.fillStyle='#9d1e26';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#e4c477';ctx.lineWidth=4;ctx.strokeRect(9,9,1006,110);
    ctx.fillStyle='#f8e5b5';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('HAPPY LUNAR NEW YEAR',512,66);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const bannerMaterial=ownMaterial(new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
    const bannerGeometry=ownGeometry(new T.PlaneGeometry(LUNAR_DECOR_LAYOUT.banner.width,LUNAR_DECOR_LAYOUT.banner.height));
    const banner=new T.Mesh(bannerGeometry,bannerMaterial);banner.position.set(LUNAR_DECOR_LAYOUT.banner.x,LUNAR_DECOR_LAYOUT.banner.y,LUNAR_DECOR_LAYOUT.banner.z);group.add(banner);
    if(signal?.aborted)throw new Error('Theme preparation cancelled');
    return {value:theme,group,mount(){if(disposed)throw new Error('Theme stage was disposed');if(group.parent!==scene)scene.add(group);},dispose};
  } catch(error) {dispose();throw error;}
}
