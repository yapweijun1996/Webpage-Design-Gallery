import {loadStaticAsset} from './static-asset.js';
// Fit the public rooms to the existing circulation and collision footprints.
// All architecture except the printed court directory joins the world's batches.
export function buildPublicArchitecture(T, {scene, materials, geometry, box, solid, lightPool, garden}) {
  const timber = 'vaultOak';
  materials.vaultOak=materials.oak.clone();
  materials.vaultOak.color.set(0xc4a27c);
  materials.vaultOak.emissive.set(0xa37b4e);
  materials.vaultOak.emissiveIntensity=.32;
  const tau = 2 * Math.PI;

  // A continuous barrel vault. The same ellipse drives the curved timber
  // lining, pale transverse ribs and fine concealed strips between bays.
  function arch(center, z, spring, radius, rise, depth, thickness, material) {
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      const point = n => {
        const a = Math.PI * (n / segments - .5);
        return [center + Math.sin(a) * radius, spring + Math.cos(a) * rise];
      };
      const [x0,y0] = point(i), [x1,y1] = point(i + 1);
      solid('box',material,(x0+x1)/2,(y0+y1)/2,z,
        Math.hypot(x1-x0,y1-y0)+.018,thickness,depth,0,0,'XYZ',Math.atan2(y1-y0,x1-x0));
    }
  }
  arch(10,33.3,5.16,8.1,3.02,28.9,.18,timber);
  for (const z of [19.05,24.8,30.55,36.3,42.05,47.55]) {
    arch(10,z,5.1,8.06,3.0,.36,.24,'ivory');
    arch(10,z-.23,5.14,8.05,3,.075,.09,'glow');
  }
  for (const x of [1.87,18.13]) {
    box('ivory',x,5.08,33.3,.46,.45,29);
    box('brass',x,4.86,33.3,.47,.075,29);
  }

  // A green terrazzo runner with multiscale aggregate, set into the marble.
  const canvas = document.createElement('canvas');
  canvas.width=canvas.height=384;
  const ctx=canvas.getContext('2d');
  let seed=68421;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(ctx) {
    ctx.fillStyle='#abbab2';ctx.fillRect(0,0,384,384);
    const chips=['#e1e3d4','#7f9489','#d6d6b9','#a1b4a5','#637f76'];
    for(let i=0;i<12500;i++){
      const x=random()*384,y=random()*384,sz=.45+random()**3*2.15;
      ctx.fillStyle=chips[i%chips.length];ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(x+sz,y+sz*.12);ctx.lineTo(x+sz*.67,y+sz);ctx.closePath();ctx.fill();
    }
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(4,15);map.anisotropy=4;
    materials.courtStone.map=map;
  }
  materials.courtStone.color.set(0x738d81);
  box('courtStone',10,-.006,33,6.05,.009,29.6);
  for(const x of [6.95,13.05]){
    box('ivory',x,.004,33,.12,.012,29.6);
    box('brass',x,.013,33,.025,.008,29.6);
  }

  // Recessed arcade lights and stone pilasters sit against the closed shop
  // fronts. Keep the walkable aisle, threshold openings and signage clear.
  for(const side of [-1,1]){
    const front=side<0?-15:35;
    const inside=-side;
    for(let i=0;i<6;i++){
      const z=i*8+4;
      box('oak',front+inside*.7,5.94,z,1.55,.27,7.96);
      box('ivory',front+inside*1.47,6.02,z,.16,.52,8);
      box('glow',front+inside*1.38,5.77,z,.06,.035,7.75);
      for(const dz of [-2.45,2.45]){
        box('brass',front+inside*.77,5.78,z+dz,.31,.06,.31);
        box('glow',front+inside*.77,5.737,z+dz,.21,.04,.21);
      }
      box('ivory',front+side*.03,2.88,z-3.88,.45,5.76,.35);
      box('brass',front+inside*.22,2.75,z-3.88,.10,1.03,.19);
      box('glow',front+inside*.284,2.76,z-3.88,.065,.76,.12);
    }
  }

  // Glazed roof over the open landing, entirely above the upper camera zone.
  // Beyond the guardrail, a shallow clerestory wall gives the balcony a real
  // architectural horizon without pretending the upper deck has more shops.
  for(const z of [-2.8,1.5,5.8,10.1,14.4,18.7,23]){
    arch(-3,z,13.1,13.15,3.9,.12,.15,'green');
  }
  for(let i=0;i<=12;i++){
    const a=(i/12-.5)*Math.PI,x=-3+13.15*Math.sin(a),y=13.1+3.9*Math.cos(a);
    box('green',x,y,10.1,.07,.09,26.1);
  }
  arch(-3,10.1,13.14,13.18,3.91,26.05,.036,'glass');
  for(const z of [-2.75,22.85]){
    box('ivory',-3,10.68,z,26.2,.45,.58);
    box('oak',-3,10.38,z,26.2,.15,.63);
    for(const x of [-15,-11,-7,-3,1,5,9]){
      box('ivory',x,9.54,z,.38,2.2,.55);
      box('green',x+1.0,9.54,z,.075,2.15,.17);
      box('brass',x,9.6,z+.3,.11,.7,.06);
    }
    box('green',-3,8.48,z,26.2,.14,.35);
    box('glass',-3,9.55,z,26.2,2.05,.10);
    for(const x of [-15.4,9.4])box('ivory',x,10.7,z,.4,4.85,.48);
  }

  // Warm recessed lunettes wrap the two outward-facing sides of the gallery.
  // Their openings frame the lower court instead of looking into bare sky.
  function galleryWindow(x,z,turn) {
    const c=Math.cos(turn),sn=Math.sin(turn);
    const piece=(mat,along,y,depth,w,h,d)=>solid('box',mat,x+c*along+sn*depth,y,z-sn*along+c*depth,w,h,d,turn);
    // The apron connects the clerestory to the shop roofs below. Leaving it
    // open would expose sky through the gap when seen from the lift landing.
    piece('ivory',0,7.05,-.14,4.31,2.90,.54);
    piece('oak',0,8.30,.16,4.31,.18,.30);
    piece('ivory',0,10.9,0,4.31,4.9,.48);
    piece('green',0,10.95,.29,3.65,3.95,.14);
    piece('vaultOak',0,10.89,.38,3.35,3.53,.12);
    for(const side of [-1,1]){
      piece('oak',side*1.2,10.6,.49,.16,2.84,.12);
      piece('brass',side*1.60,10.85,.50,.06,3.36,.08);
    }
    piece('glow',0,12.36,.50,3.13,.05,.10);
    piece('ivory',0,9.15,.52,3.42,.17,.46);
    piece('green',0,11.85,.50,3.38,.10,.12);
    // A shallow timber display shelf and ceramic vessels give the bays an
    // inhabited foreground behind their darker storefront frames.
    piece('oak',-.18,9.83,.63,2.13,.09,.30);
    for(const [along,height] of [[-.84,.34],[-.50,.52],[.44,.22]]){
      solid('sphere','cream',x+c*along+sn*.66,9.88+height*.5,z-sn*along+c*.66,
        .14,height*.5,.13);
      piece('brass',along,9.91+height,.67,.12,.04,.12);
    }
    for(let n=0;n<9;n++){
      const a=(n+.5)*Math.PI/9;
      // Narrow timber reveals behind the transom catch the overhead light.
      piece('ivory',(n-4)*.382,12.82+.19*Math.sin(a),.48,.385,.50-.34*Math.sin(a),.24);
    }
  }
  for(let i=0;i<6;i++){
    galleryWindow(-13.85+i*4.3,-3.55,0);
    galleryWindow(-16.42,-.9+i*4.3,Math.PI/2);
  }

  // A sculpted shade tree grows from the existing central planting bed.
  // Each leaf is a folded six-triangle blade, not a high-poly sphere.
  const leaf=new T.BufferGeometry();
  leaf.setAttribute('position',new T.Float32BufferAttribute([
    0,0,-.55,-.23,.06,-.12,0,.12,.05, .23,.06,-.12, .18,.02,.30, 0,-.04,.55,-.18,.02,.30
  ],3));
  leaf.setIndex([0,2,1,0,3,2,1,2,6,6,2,5,2,4,5,2,3,4]);leaf.computeVertexNormals();
  geometry.publicLeaf=leaf;
  const leafColors=['canopySage','canopyOlive'];
  for(const [name,tone] of [['canopySage',0x749153],['canopyOlive',0x4b743e]]){
    materials[name]=new T.MeshStandardMaterial({color:tone,roughness:.84,side:T.DoubleSide,
      emissive:tone,emissiveIntensity:.16});
  }
  const branch=(from,to,girth)=>{
    const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],length=Math.hypot(dx,dy,dz);
    solid('cylinder','wood',(from[0]+to[0])/2,(from[1]+to[1])/2,(from[2]+to[2])/2,
      girth,length,girth,Math.atan2(dx,dz),Math.acos(dy/length),'YXZ');
  };
  const tree=(x,z,height)=>{
    const trunk=[x,.42,z],fork=[x+.15,height*.51,z-.12];
    branch(trunk,fork,.15*height/5.6);
    for(let b=0;b<9;b++){
      const a=b*2.399963, r=height*(.22+.17*random());
      const joint=[x+Math.cos(a)*r*.62,height*(.60+.12*random()),z+Math.sin(a)*r*.62];
      branch(fork,joint,.078);
      for(let j=0;j<3;j++){
        const angle=a+(j-1)*.57;
        const tip=[joint[0]+Math.cos(angle)*r*.72,height*(.78+.19*random()),joint[2]+Math.sin(angle)*r*.72];
        branch(joint,tip,.033);
        for(let n=0;n<58;n++){
          const theta=random()*tau,dist=Math.sqrt(random())*height*.215;
          const size=.32+random()*.45;
          solid('publicLeaf',leafColors[n%2],tip[0]+Math.cos(theta)*dist,tip[1]+(random()-.45)*height*.17,tip[2]+Math.sin(theta)*dist,
            size,1,size,theta,(random()-.5)*1.25,'YXZ');
        }
      }
    }
  };
  tree(garden.x-.8,garden.z,5.9);
  for(const lounge of [-4,24])tree(lounge-2.35,27,4.2);
  // The lift's moving cabin still uses the entire clear shaft. Only the
  // fixed side guards receive the stone door surround; the entrance stays clear.
  for(const z of [8.37,11.63]){
    box('ivory',-4.99,1.87,z,.31,3.74,.46);
    box('brass',-5.16,1.74,z,.055,2.2,.13);
    box('glow',-5.194,1.78,z,.035,.76,.06);
    box('oak',-4.99,5.27,z,.30,3.14,.37);
  }
  box('green',-5.01,3.78,10,.33,.36,3.82);
  box('brass',-5.20,3.62,10,.03,.05,3.52);
  box('ivory',-5.02,4.02,10,.36,.19,3.94);
  // Planting sits south of the shaft and clear of the west boarding route.
  cylinderPlanter(-4.25,14.1);
  function cylinderPlanter(x,z){
    solid('cylinder','ivory',x,.29,z,.96,.58,.96);
    solid('cylinder','oak',x,.61,z,1.05,.12,1.05);
    solid('cylinder','wood',x,.676,z,.79,.02,.79);
    box('wood',x,.30,z,1.40,.60,1.40,true);
    tree(x,z,4.55);
  }
  // This original gallery fixture is a static sign beside the actual lift.
  // Optional loading never delays the first interactive frame.
  const totem = new T.Group();
  totem.name='Gallery lift directory standee';totem.position.set(-6.1,0,13.75);
  totem.rotation.y=-Math.PI*.34;totem.scale.setScalar(1.16);scene.add(totem);
  box('wood',-6.1,.06,13.75,.66,.12,.66,true);
  const fallback=new T.Mesh(geometry.box,materials.ivory);
  fallback.position.y=.95;fallback.scale.set(.87,1.9,.18);totem.add(fallback);
  loadStaticAsset(T,{file:'mall-directory-standee.glb',asset_id:'ASSET_MallDirectoryStandee',
    sha256:'639fd4bb992d9453326c04dc936f727d870368fcee8a0cacc651d9a8cf59b4e6',dimensions_m:[.90,1.90,.35],rootExtras:{units:'metres'}},import.meta.url)
    .then(record=>{
      totem.userData.sourceStatus=record.status;
      if(record.status!=='loaded')return;
      totem.remove(fallback);
      for(const primitive of record.primitives){
        const mesh=new T.Mesh(primitive.geometry,primitive.material);
        mesh.applyMatrix4(primitive.matrix);totem.add(mesh);
      }
    });
  // The directory tablet and its base are inside the closed planter footprint.
  const tabletX=12.85,tabletZ=17.16;
  box('ivory',tabletX,1.69,tabletZ,1.15,2.4,.22);
  box('brass',tabletX,1.69,tabletZ+.118,1.06,2.29,.025);
  const panel=document.createElement('canvas');panel.width=384;panel.height=768;
  const ink=panel.getContext('2d');
  if(ink){
    ink.fillStyle='#eadfca';ink.fillRect(0,0,384,768);
    ink.fillStyle='#214238';ink.font='600 24px Arial';ink.fillText('G J H',34,85);
    ink.font='38px Georgia';ink.fillText('Directory',34,163);
    for(const [i,label] of ['STORES','GALLERY LIFT','GUEST SERVICES'].entries()){
      const y=300+i*100;ink.fillStyle='#88795b';ink.fillRect(34,y-46,315,2);
      ink.font='600 20px Arial';ink.fillStyle='#284338';ink.fillText(label,34,y);const dir=i===2?1:-1,tip=316+dir*9;
      ink.strokeStyle='#284338';ink.lineWidth=2;ink.beginPath();
      ink.moveTo(316-dir*6,y);ink.lineTo(tip,y-15);
      ink.lineTo(tip-dir*10,y-15);ink.moveTo(tip,y-15);ink.lineTo(tip,y-5);ink.stroke();
    }
    const map=new T.CanvasTexture(panel);map.colorSpace=T.SRGBColorSpace;
    // Printed insert on the stock blank standee. Both the original moulded
    // jade frame and the double-sided backlit panels stay intact.
    const print=new T.Mesh(geometry.plane,new T.MeshBasicMaterial({map}));
    print.name='Gallery standee printed directions';print.position.set(0,1.065,.093);
    print.scale.set(.69,1.30,1);totem.add(print);
    const mesh=new T.Mesh(geometry.plane,new T.MeshBasicMaterial({map}));
    mesh.name='Wayfinding court directory';mesh.position.set(tabletX,1.69,tabletZ+.138);mesh.scale.set(1.01,2.24,1);scene.add(mesh);
  }
  for(const x of [garden.x-2.65,garden.x+1.65]){
    box('oak',x,.52,garden.z+1.35,2.4,.12,.40);
    box('glow',x,.32,garden.z+1.47,2.25,.025,.02);
  }
  lightPool(garden.x,.053,garden.z+1.7,9,2.5);
}
