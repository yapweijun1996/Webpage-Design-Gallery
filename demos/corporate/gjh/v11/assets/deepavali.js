import {atriumLayout} from './atrium-layout.js';

const {garden,event}=atriumLayout;
const point=(x,z)=>Object.freeze({x,z});
// Lamps stay on the existing collidable planter. The floor motif is a flat,
// non-colliding visual; suspended decorations leave the event floor open.
export const DEEPAVALI_DECOR_LAYOUT=Object.freeze({
  lamps:Object.freeze([point(garden.x-2.8,garden.z),point(garden.x+2.8,garden.z)]),lampRadius:.48,
  motif:Object.freeze({x:7,z:29,radius:2.3}),
  garlands:Object.freeze([25,28,31].flatMap(z=>Array.from({length:34},(_,i)=>point(4.55+i*.33,z)))),
  garlandBottom:5.15,
  banner:Object.freeze({x:(event.minX+event.maxX)/2,z:31.8,y:6.65,width:7.2,height:.78})
});

/** Original decorative forms are owned and disposed by the theme stage. */
export function prepareDeepavaliDecor(T,scene,theme,{signal}={}) {
  const group=new T.Group();group.name='Deepavali decorations';group.userData.mallThemeDecoration='deepavali';
  const geometries=[],materials=[];let disposed=false;
  const geometry=g=>(geometries.push(g),g),material=m=>(materials.push(m),m);
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();
    for(const m of materials){m.map?.dispose();m.dispose();}
    for(const g of geometries)g.dispose();
  }
  try {
    if(signal?.aborted)throw new Error('Theme preparation cancelled');
    const sphere=geometry(new T.SphereGeometry(1,12,8));
    const bowl=geometry(new T.SphereGeometry(1,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2));
    const cylinder=geometry(new T.CylinderGeometry(1,1,1,16));
    const gold=material(new T.MeshStandardMaterial({color:0xd5a54c,metalness:.55,roughness:.38}));
    const clay=material(new T.MeshStandardMaterial({color:0xa24b2b,roughness:.8}));
    const marigold=material(new T.MeshStandardMaterial({color:0xf39b19,roughness:.75}));
    const pink=material(new T.MeshStandardMaterial({color:0xd94c83,roughness:.7}));
    const light=material(new T.MeshBasicMaterial({color:0xffd77c}));
    const batches=new Map(),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
    function add(g,m,x,y,z,sx,sy,sz){
      let byMaterial=batches.get(g);if(!byMaterial){byMaterial=new Map();batches.set(g,byMaterial);}
      if(!byMaterial.has(m))byMaterial.set(m,[]);
      position.set(x,y,z);scale.set(sx,sy,sz);rotation.identity();
      matrix.compose(position,rotation,scale);byMaterial.get(m).push(matrix.clone());
    }
    for(const {x,z} of DEEPAVALI_DECOR_LAYOUT.lamps){
      add(cylinder,gold,x,.68,z,.3,.38,.3);
      add(cylinder,gold,x,.9,z,.38,.08,.38);
      add(bowl,clay,x,1.2,z,.43,.23,.43);
      add(cylinder,gold,x,1.205,z,.3,.025,.3);
      add(sphere,light,x,1.42,z,.11,.24,.11);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        add(sphere,i%2?pink:marigold,x+Math.cos(a)*.37,.98,z+Math.sin(a)*.37,.085,.07,.085);
      }
    }
    for(const p of DEEPAVALI_DECOR_LAYOUT.garlands){
      const index=Math.round((p.x-4.55)/.33),sag=Math.sin(index*Math.PI/33);
      add(sphere,index%4===0?pink:marigold,p.x,6.05-sag*.28,p.z,.115,.115,.115);
      if(index%5===0){
        add(cylinder,gold,p.x,5.87-sag*.28,p.z,.014,.25,.014);
        add(sphere,light,p.x,5.68-sag*.28,p.z,.085,.11,.085);
      }
    }
    for(const [g,byMaterial] of batches)for(const [m,transforms] of byMaterial){
      const mesh=new T.InstancedMesh(g,m,transforms.length);transforms.forEach((transform,i)=>mesh.setMatrixAt(i,transform));
      mesh.computeBoundingSphere();mesh.receiveShadow=true;group.add(mesh);
    }
    // A decorative rangoli-inspired graphic, not a recreation of a specific
    // community's sacred pattern or a physical obstacle.
    const motifCanvas=document.createElement('canvas');motifCanvas.width=1024;motifCanvas.height=1024;
    const motifContext=motifCanvas.getContext('2d');if(!motifContext)throw new Error('Seasonal floor motif unavailable');
    motifContext.translate(512,512);
    for(let i=0;i<16;i++){
      motifContext.save();motifContext.rotate(i*Math.PI/8);
      motifContext.fillStyle=i%2?'#e78325':'#d63778';motifContext.strokeStyle='#ffdc85';motifContext.lineWidth=8;
      motifContext.beginPath();motifContext.ellipse(0,-325,58,130,0,0,Math.PI*2);motifContext.fill();motifContext.stroke();motifContext.restore();
    }
    for(let i=0;i<12;i++){
      motifContext.save();motifContext.rotate(i*Math.PI/6);
      motifContext.fillStyle=i%2?'#168b87':'#79438c';motifContext.strokeStyle='#ffe6a0';motifContext.lineWidth=7;
      motifContext.beginPath();motifContext.ellipse(0,-200,70,120,0,0,Math.PI*2);motifContext.fill();motifContext.stroke();motifContext.restore();
    }
    motifContext.fillStyle='#e9a428';motifContext.beginPath();motifContext.arc(0,0,88,0,Math.PI*2);motifContext.fill();
    motifContext.fillStyle='#ffedb1';motifContext.beginPath();motifContext.arc(0,0,40,0,Math.PI*2);motifContext.fill();
    const motifTexture=new T.CanvasTexture(motifCanvas);motifTexture.colorSpace=T.SRGBColorSpace;
    const motifMaterial=material(new T.MeshBasicMaterial({map:motifTexture,transparent:true,depthWrite:false,side:T.DoubleSide}));
    const motif=new T.Mesh(geometry(new T.PlaneGeometry(DEEPAVALI_DECOR_LAYOUT.motif.radius*2,DEEPAVALI_DECOR_LAYOUT.motif.radius*2)),motifMaterial);
    motif.rotation.x=-Math.PI/2;motif.position.set(DEEPAVALI_DECOR_LAYOUT.motif.x,.012,DEEPAVALI_DECOR_LAYOUT.motif.z);group.add(motif);
    const bannerCanvas=document.createElement('canvas');bannerCanvas.width=1024;bannerCanvas.height=128;
    const ctx=bannerCanvas.getContext('2d');if(!ctx)throw new Error('Seasonal banner unavailable');
    ctx.fillStyle='#65245c';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#f1c56e';ctx.lineWidth=4;ctx.strokeRect(9,9,1006,110);
    ctx.fillStyle='#fff0c2';ctx.font='bold 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('HAPPY DEEPAVALI',512,66);
    const bannerTexture=new T.CanvasTexture(bannerCanvas);bannerTexture.colorSpace=T.SRGBColorSpace;
    const banner=new T.Mesh(geometry(new T.PlaneGeometry(DEEPAVALI_DECOR_LAYOUT.banner.width,DEEPAVALI_DECOR_LAYOUT.banner.height)),material(new T.MeshBasicMaterial({map:bannerTexture,side:T.DoubleSide})));
    banner.position.set(DEEPAVALI_DECOR_LAYOUT.banner.x,DEEPAVALI_DECOR_LAYOUT.banner.y,DEEPAVALI_DECOR_LAYOUT.banner.z);group.add(banner);
    if(signal?.aborted)throw new Error('Theme preparation cancelled');
    return {value:theme,mount(){if(disposed)throw new Error('Theme stage was disposed');if(group.parent!==scene)scene.add(group);},dispose};
  } catch(error) {dispose();throw error;}
}
