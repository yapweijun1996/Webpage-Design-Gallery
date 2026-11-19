import {atriumLayout} from './atrium-layout.js';
import {opaqueBatch} from './opaque-batch.js';

const {garden,event}=atriumLayout;
const point=(x,z)=>Object.freeze({x,z});
const treeX=garden.x-2.5;
// The planter already blocks entry; every ground prop remains inside it.
export const CHRISTMAS_DECOR_LAYOUT=Object.freeze({
  tree:point(treeX,garden.z),treeRadius:1.3,
  gifts:Object.freeze([
    Object.freeze({x:treeX-1.05,z:garden.z-.7,radius:.4}),
    Object.freeze({x:treeX+1.05,z:garden.z-.7,radius:.4}),
    Object.freeze({x:treeX-1.05,z:garden.z+.7,radius:.4}),
    Object.freeze({x:treeX+1.05,z:garden.z+.7,radius:.4})
  ]),
  lights:Object.freeze([25,28,31].flatMap(z=>Array.from({length:12},(_,i)=>point(4.5+i,z)))),
  lightsBottom:5.65,
  banner:Object.freeze({x:(event.minX+event.maxX)/2,z:31.8,y:6.65,width:7.2,height:.78})
});

/** This stage owns its generated meshes and can be removed as a single unit. */
export function prepareChristmasDecor(T,scene,theme,{signal}={}) {
  const group=new T.Group();group.name='Christmas decorations';group.userData.mallThemeDecoration='christmas';
  const geometries=[],materials=[];let disposed=false;
  const geometry=g=>(geometries.push(g),g),material=m=>(materials.push(m),m);
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();
    for(const m of materials){m.map?.dispose();m.dispose();}
    for(const g of geometries)g.dispose();
  }
  try {
    if(signal?.aborted)throw new Error('Theme preparation cancelled');
    const cone=geometry(new T.ConeGeometry(1,1,24));
    const cylinder=geometry(new T.CylinderGeometry(1,1,1,12));
    const sphere=geometry(new T.SphereGeometry(1,12,8));
    const box=geometry(new T.BoxGeometry(1,1,1));
    const pine=material(new T.MeshStandardMaterial({color:0x175039,roughness:.88}));
    const pineLight=material(new T.MeshStandardMaterial({color:0x236548,roughness:.84}));
    const bark=material(new T.MeshStandardMaterial({color:0x68452d,roughness:.9}));
    const gold=material(new T.MeshStandardMaterial({color:0xd7ad55,metalness:.55,roughness:.36}));
    const red=material(new T.MeshStandardMaterial({color:0xa8202e,roughness:.55}));
    const cream=material(new T.MeshStandardMaterial({color:0xf2e3c5,roughness:.65}));
    const light=material(new T.MeshBasicMaterial({color:0xffdb8c}));
    const batches=new Map(),matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();
    function add(g,m,x,y,z,sx,sy,sz,axis='y',angle=0){
      let byMaterial=batches.get(g);if(!byMaterial){byMaterial=new Map();batches.set(g,byMaterial);}
      if(!byMaterial.has(m))byMaterial.set(m,[]);
      position.set(x,y,z);scale.set(sx,sy,sz);rotation.setFromAxisAngle(axis==='z'?new T.Vector3(0,0,1):new T.Vector3(0,1,0),angle);
      matrix.compose(position,rotation,scale);byMaterial.get(m).push(matrix.clone());
    }
    const {x,z}=CHRISTMAS_DECOR_LAYOUT.tree;
    add(cylinder,bark,x,1.2,z,.14,1.45,.14);
    const layers=[{y:2.05,r:1.22,h:2.55},{y:3.25,r:.94,h:2.25},{y:4.25,r:.65,h:2}];
    layers.forEach((layer,i)=>{
      add(cone,i===1?pineLight:pine,x,layer.y,z,layer.r,layer.h,layer.r);
      for(let row=0;row<4;row++)for(let n=0;n<16;n++){
        const y=layer.y-layer.h*.4+row*layer.h*.19,angle=n*Math.PI/8+row*.17;
        const radius=layer.r*(.89-row*.19);
        add(sphere,(n+row)%3===0?pineLight:pine,x+Math.cos(angle)*radius,y,z+Math.sin(angle)*radius,.17,.11,.17);
      }
      for(let row=0;row<3;row++)for(let n=0;n<8;n++){
        const y=layer.y-layer.h*.32+row*layer.h*.22;
        const radius=layer.r*(.82-row*.22)+.035,angle=n*Math.PI/4+row*.32+i*.23;
        add(sphere,(n+row)%3===0?red:gold,x+Math.cos(angle)*radius,y,z+Math.sin(angle)*radius,.09,.09,.09);
        add(sphere,light,x+Math.cos(angle+.2)*(radius+.025),y+.13,z+Math.sin(angle+.2)*(radius+.025),.047,.047,.047);
      }
    });
    CHRISTMAS_DECOR_LAYOUT.gifts.forEach((p,i)=>{
      const h=i%2?.55:.42,w=i%2?.48:.6;
      add(box,i%2?cream:red,p.x,garden.height+h/2,p.z,w,h,w);
      add(box,gold,p.x,garden.height+h+.008,p.z,w+.02,.022,.065);
      add(box,gold,p.x,garden.height+h+.01,p.z,.065,.025,w+.02);
    });
    for(const lineZ of [25,28,31])add(cylinder,gold,10,6.03,lineZ,.018,11,.018,'z',Math.PI/2);
    for(const p of CHRISTMAS_DECOR_LAYOUT.lights){
      add(cylinder,gold,p.x,5.91,p.z,.012,.22,.012);
      add(sphere,light,p.x,5.77,p.z,.09,.1,.09);
    }
    const opaque = [], lowParts = [];
    const lowSphere = geometry(new T.SphereGeometry(1,8,5));
    for(const [g,byMaterial] of batches)for(const [m,transforms] of byMaterial){
      const mesh=new T.InstancedMesh(g,m,transforms.length);transforms.forEach((transform,i)=>mesh.setMatrixAt(i,transform));
      mesh.computeBoundingSphere();mesh.receiveShadow=true;group.add(mesh);
      if (!m.isMeshStandardMaterial) continue;
      mesh.name = 'Christmas tree, gifts or garland';
      opaque.push(mesh);
      for (const transform of transforms) {
        const part = (g === sphere ? lowSphere : g).clone().applyMatrix4(transform);
        const count = part.attributes.position.count;
        const colors = new Float32Array(count * 3), surfaces = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
          m.color.toArray(colors, i * 3);
          surfaces[i * 2] = m.roughness;
          surfaces[i * 2 + 1] = m.metalness;
        }
        part.setAttribute('color', new T.BufferAttribute(colors,3));
        part.setAttribute('obSurface', new T.BufferAttribute(surfaces,2));
        lowParts.push(part);
      }
    }
    const lowBatch = opaqueBatch(T,lowParts,false);
    lowBatch.name = 'Christmas tree, gifts and garland';
    lowBatch.visible = false;
    geometries.push(lowBatch.geometry);
    materials.push(lowBatch.material);
    group.add(lowBatch);
    const starShape=new T.Shape();
    for(let i=0;i<10;i++){
      const angle=Math.PI/2+i*Math.PI/5,r=i%2?.18:.42;
      const px=Math.cos(angle)*r,py=Math.sin(angle)*r;
      if(i===0)starShape.moveTo(px,py);else starShape.lineTo(px,py);
    }
    starShape.closePath();
    const star=new T.Mesh(geometry(new T.ShapeGeometry(starShape)),material(new T.MeshBasicMaterial({color:0xffdc82,side:T.DoubleSide})));
    star.position.set(x,5.52,z);group.add(star);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Seasonal banner unavailable');
    ctx.fillStyle='#174d39';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#e4c477';ctx.lineWidth=4;ctx.strokeRect(9,9,1006,110);
    ctx.fillStyle='#f8e5b5';ctx.font='bold 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('MERRY CHRISTMAS',512,66);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const banner=new T.Mesh(geometry(new T.PlaneGeometry(CHRISTMAS_DECOR_LAYOUT.banner.width,CHRISTMAS_DECOR_LAYOUT.banner.height)),material(new T.MeshBasicMaterial({map:texture,side:T.DoubleSide})));
    banner.position.set(CHRISTMAS_DECOR_LAYOUT.banner.x,CHRISTMAS_DECOR_LAYOUT.banner.y,CHRISTMAS_DECOR_LAYOUT.banner.z);group.add(banner);
    if(signal?.aborted)throw new Error('Theme preparation cancelled');
    return {value:theme,group,
      setTier(tier) {
        lowBatch.visible = tier === 'low';
        for (const mesh of opaque) mesh.visible = !lowBatch.visible;
      },
      mount(){if(disposed)throw new Error('Theme stage was disposed');if(group.parent!==scene)scene.add(group);},dispose};
  } catch(error) {dispose();throw error;}
}
