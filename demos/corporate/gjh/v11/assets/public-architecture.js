import {mergeOpaqueMeshes} from './packed-draw.js';
import {loadStaticAsset} from './static-asset.js';
import {atriumLayout} from './atrium-layout.js';
import {setupArtworkTexture} from './artwork-textures.js';
import {decalMaterial} from './surface-decals.js';

// Fit the public rooms to the existing circulation and collision footprints.
// The authored directory and chandelier keep their exported geometry.
export function buildPublicArchitecture(T, {scene, materials, geometry, box, solid, lightPool, lightWash, garden, prepareModel, setPavingMap, ceilingBounds, daylightSkylight=false, setCanopyMaterial, artworkTier=()=> 'low'}) {
  const timber = 'vaultOak';
  materials.vaultOak=materials.oak.clone();
  materials.vaultOak.color.set(0x736558);
  materials.vaultOak.emissive.set(0x87796a);
  materials.vaultOak.emissiveIntensity=.11;
  const tau = 2 * Math.PI;

  // The masonry above each arch is a silhouette with a real opening. Reuse
  // one flat-ended extrusion for the arcade, gallery and lift portal.
  const spandrel = new T.Shape();
  spandrel.moveTo(-1,0);
  spandrel.lineTo(-1,1.14);spandrel.lineTo(1,1.14);spandrel.lineTo(1,0);
  for(let i=1;i<=20;i++){
    const a=Math.PI*i/20;
    spandrel.lineTo(Math.cos(a),Math.sin(a));
  }
  spandrel.closePath();
  geometry.archSpandrel=new T.ExtrudeGeometry(spandrel,{depth:1,bevelEnabled:false});

  // A continuous barrel vault. The same ellipse drives the curved timber
  // lining, pale transverse ribs and fine concealed strips between bays.
  function arch(center, z, spring, radius, rise, depth, thickness, material, ribClearance = 0) {
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      const point = n => {
        const a = Math.PI * (n / segments - .5);
        return [center + Math.sin(a) * radius, spring + Math.cos(a) * rise];
      };
      const [x0,y0] = point(i), [x1,y1] = point(i + 1);
      solid('box',material,(x0+x1)/2,(y0+y1)/2,z,
        Math.hypot(x1-x0,y1-y0)+.018,thickness,depth,0,0,'XYZ',Math.atan2(y1-y0,x1-x0));
      // Include the ribs beneath the continuous vault without adding player colliders.
      if (ribClearance) ceilingBounds?.((x0+x1)/2,(y0+y1)/2,z,
        x1-x0+thickness+.018,Math.abs(y1-y0)+thickness+2*ribClearance,depth);
    }
  }
  arch(10,33.3,5.16,8.1,3.02,28.9,.18,timber,.12);
  for (const z of [19.05,24.8,30.55,36.3,42.05,47.55]) {
    arch(10,z,5.1,8.06,3.0,.36,.24,'ivory');
    arch(10,z-.23,5.14,8.05,3,.075,.09,'glow');
  }
  for (const x of [1.87,18.13]) {
    box('ivory',x,5.08,33.3,.46,.45,29);
    box('brass',x,4.86,33.3,.47,.075,29);
    box('glow',x,4.815,33.3,.055,.036,28.8);
    for (const z of [21.7,27.5,33.3,39.1,44.9]) {
      lightWash?.(x,4.79,z,1.1,6.3,0,Math.PI/2,true);
    }
    const inward=x<10 ? 1 : -1;
    const turn=inward*Math.PI/2;
    // The portal line sits outside the event reservation, on the axis of
    // each vault rib. The side openings remain walkable at floor level.
    const piers=[19.05,24.8,30.55,36.3,42.05,47.55];
    for (let bay=0;bay<piers.length;bay++){
      const z=piers[bay];
      box('green',x,2.55,z,.76,5.1,.83,true);
      box('oak',x,.2,z,.79,.39,.88);
      box('brass',x,.41,z,.79,.035,.88);
      box('ivory',x,4.78,z,.88,.36,1.03);
      box('brass',x+inward*.402,2.77,z,.05,.93,.23);
      box('glow',x+inward*.442,2.77,z,.06,.71,.12);
      if(bay<piers.length-1) {
        const span=piers[bay+1]-z;
        solid('archSpandrel','ivory',x-inward*.34,3.52,z+span/2,span/2,1.36,.53,turn);
        solid('archSpandrel','green',x+inward*.19,3.50,z+span/2,span/2-.23,1.22,.066,turn);
      }
    }
  }

  // The court uses a softly veined ivory stone tile with staggered joints.
  materials.paving=new T.MeshStandardMaterial({color:0xcdbfae,roughness:.34,metalness:.09});
  const pavingURL=new URL('concourse-limestone.webp',import.meta.url);
  new T.TextureLoader().load(pavingURL.href,map=>{
    map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
    map.repeat.set(12.5,12);map.anisotropy=4;
    void setPavingMap(map);
  },undefined,()=>{});
  box('paving',10,-.013,24,49.85,.002,47.85);

  // A light sage terrazzo runner with fine aggregate, set into the marble.
  const canvas = document.createElement('canvas');
  canvas.width=canvas.height=384;
  const ctx=canvas.getContext('2d');
  let seed=68421;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(ctx) {
    ctx.fillStyle='#d7ded5';ctx.fillRect(0,0,384,384);
    const chips=['#e8e9df','#b5c2b8','#dad8c8','#c5cfc4','#a7b7ad'];
    for(let i=0;i<12500;i++){
      const x=random()*384,y=random()*384,sz=.45+random()**3*2.15;
      ctx.fillStyle=chips[i%chips.length];ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(x+sz,y+sz*.12);ctx.lineTo(x+sz*.67,y+sz);ctx.closePath();ctx.fill();
    }
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(4,15);map.anisotropy=4;
    materials.courtStone.map=map;
  }
  materials.courtStone.color.set(0xc9cbc0);
  materials.courtStone.metalness = .07;
  materials.courtStone.roughness = .33;
  box('courtStone',10,-.006,33,6.05,.009,29.6);
  for(const x of [6.95,13.05]){
    box('ivory',x,.004,33,.12,.012,29.6);
    box('brass',x,.013,33,.025,.008,29.6);
  }

  // Recessed arcade lights and stone pilasters sit against the closed shop
  // fronts. Keep the walkable aisle, threshold openings and signage clear.
  const {arcadePilaster} = atriumLayout;
  const soffitY = 5.94, soffitHeight = .27;
  for(const side of [-1,1]){
    const front=side<0?-15:35;
    const inside=-side;
    for(let i=0;i<6;i++){
      const z=i*8+4;
      box(timber,front+inside*.7,soffitY,z,1.55,soffitHeight,7.96);
      box('ivory',front+inside*1.47,6.02,z,.16,.52,8);
      box('glow',front+inside*1.38,5.77,z,.06,.035,7.75);
      lightWash?.(front+inside*1.30,5.791,z,.92,7.8,0,Math.PI/2,true);
      lightWash?.(front+inside*1.555,5.92,z,7.8,.77,inside*Math.PI/2,0,true);
      for(const dz of [-2.45,2.45]){
        box('brass',front+inside*.77,5.78,z+dz,.31,.06,.31);
        box('glow',front+inside*.77,5.737,z+dz,.21,.04,.21);
        lightWash?.(front+inside*.77,soffitY-soffitHeight/2-.008,z+dz,1.25,2.5,0,Math.PI/2);
      }
      box('green',front+side*arcadePilaster.inset,2.88,z-3.88,arcadePilaster.depth,5.76,.35);
      // Shallow arched window heads sit below the fascia and to either
      // side of the moving leaves. The storefront sign stays uninterrupted.
      for(const offset of [-2.48,2.48]){
        solid('archSpandrel','green',front+inside*.235,3.32,z+offset,
          1.15,.53,.11,inside*Math.PI/2);
      }
      box('ivory',front+inside*.07,.18,z-3.88,.59,.35,.54);
      box('ivory',front+inside*.11,5.59,z-3.88,.65,.20,.63);
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
  if(!daylightSkylight)arch(-3,10.1,13.14,13.18,3.91,26.05,.036,'glass',.14);
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
    // The glazed fanlight closes the barrel end above the clerestory.
    // Sample the actual roof ellipse so every metal mullion meets its rib.
    box('green',-3,13.14,z,26.1,.14,.14);
    for(let bay=0;bay<12;bay++){
      const dx=(bay-5.5)*2.16,edge=Math.abs(dx)+1.08;
      const h=3.9*Math.sqrt(1-(edge/13.15)**2);
      box('glass',-3+dx,13.13+h/2,z,2.12,h,.036);
      if(bay===0) continue;
      const px=dx-1.08,rise=3.9*Math.sqrt(1-(px/13.15)**2);
      box('green',-3+px,13.13+rise/2,z,.09,rise,.12);
    }
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
    // A deep jade reveal under the limestone arch reads from across
    // the void; square shelves below remain in the display window.
    solid('archSpandrel','green',x+sn*.465,11.12,z+c*.465,1.74,1.60,.13,turn);
    solid('archSpandrel','ivory',x+sn*.60,11.12,z+c*.60,1.91,1.75,.17,turn);
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
  const canopy = new T.MeshStandardMaterial({color:0xffffff,roughness:.84,side:T.DoubleSide,
    emissive:0xffffff,emissiveIntensity:.16});
  canopy.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor;');
  };
  setCanopyMaterial?.(canopy);
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
  // Keep the trunk west of the atrium arrival's chase-camera corridor.
  tree(garden.x-3.4,garden.z+1.2,5.9);
  for (const lounge of atriumLayout.lounges) {
    // Use the inner planter on the west lounge to clear the shop arrival views.
    const planter = lounge.planters[lounge.id === 'west' ? 1 : 0];
    tree(planter.x, planter.z, 4.2);
    lightPool(planter.x,.023,planter.z,2.2,2.2);
  }
  // The elevator kit owns both landing portals. These columns support the gallery above it.
  for(const z of [8.37,11.63]) box('oak',-4.99,5.27,z,.30,3.14,.37);
  // Planting sits south of the shaft and clear of the west boarding route.
  cylinderPlanter(-4.25,14.1);
  function cylinderPlanter(x,z){
    solid('cylinder','ivory',x,.29,z,.96,.58,.96);
    solid('cylinder','oak',x,.61,z,1.05,.12,1.05);
    solid('cylinder','wood',x,.676,z,.79,.02,.79);
    box('wood',x,.30,z,1.40,.60,1.40,true);
    // A raised inner planting collar leaves a continuous outer timber seat.
    solid('cylinder','green',x,.73,z,.73,.19,.73);
    for(let clump=0;clump<8;clump++){
      const bearing=clump*tau/8, cx=x+.45*Math.sin(bearing),cz=z+.45*Math.cos(bearing);
      for(let blade=0;blade<9;blade++){
        const yaw=bearing+blade*tau/9;
        solid('publicLeaf',leafColors[(clump+blade)%2],cx+.19*Math.sin(yaw),
          .90+(blade%3)*.04,cz+.19*Math.cos(yaw),.50,1,.88,yaw,-.71,'YXZ');
      }
    }
    tree(x,z,4.55);
    lightPool(x,.023,z,2.8,2.8);
  }
  // A03's trailing greenery softens the upper clerestory. Planter boxes
  // and folded blades use the existing timber and canopy instance batches.
  for (let bay=0; bay<5; bay++) {
    for (const north of [true,false]) {
      const x=north ? -12.9+4.3*bay : -15.80;
      const z=north ? -2.34 : .20+4.3*bay;
      box('oak',x,10.55,z,north ? 2.7 : .38,.26,north ? .38 : 2.7);
      for(let stem=0;stem<8;stem++){
        const along=-1.17+stem*.335;
        const count=4+Math.floor(random()*5);
        for(let n=0;n<count;n++){
          const offset=along+.10*Math.sin(n*.75+stem);
          const front=.20+.055*Math.cos(n*.66);
          solid('publicLeaf',leafColors[(stem+n)%2],x+(north?offset:front),10.78-n*.13,
            z+(north?front:offset),.58,1,.55, (north?0:Math.PI/2)+(n%2?-.63:.63),.78,'YXZ');
        }
      }
    }
  }
  // This original gallery fixture is a static sign beside the actual lift.
  // Optional loading never delays the first interactive frame.
  async function mountStaticModel(record, destination, fallback) {
    if (record.status === 'loaded') {
      const model = new T.Group();
      for (const primitive of record.primitives) {
        const mesh = new T.Mesh(primitive.geometry, primitive.material);
        mesh.applyMatrix4(primitive.matrix);
        model.add(mesh);
      }
      mergeOpaqueMeshes(T, model);
      try { await prepareModel?.(model); }
      catch {
        for (const {geometry, material} of record.primitives) { geometry.dispose(); material.dispose(); }
        destination.userData.sourceStatus = 'fallback';
        return;
      }
      if (fallback) destination.remove(fallback);
      destination.add(...model.children);
    }
    destination.userData.sourceStatus = record.status;
  }
  const totem = new T.Group();
  totem.name='Gallery lift directory standee';totem.position.set(-6.1,0,13.75);
  totem.rotation.y=-Math.PI*.34;totem.scale.setScalar(1.16);scene.add(totem);
  box('wood',-6.1,.06,13.75,.66,.12,.66,true);
  const fallback=new T.Mesh(geometry.box,materials.ivory);
  fallback.position.y=.95;fallback.scale.set(.87,1.9,.18);totem.add(fallback);
  loadStaticAsset(T,{file:'mall-directory-standee.glb',asset_id:'ASSET_MallDirectoryStandee',
    sha256:'639fd4bb992d9453326c04dc936f727d870368fcee8a0cacc651d9a8cf59b4e6',dimensions_m:[.90,1.90,.35],rootExtras:{units:'metres'}},import.meta.url)
    .then(record => mountStaticModel(record, totem, fallback));
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
    const map=setupArtworkTexture(T,new T.CanvasTexture(panel),artworkTier());
    const material=decalMaterial(new T.MeshBasicMaterial({map}),-1);
    // Printed insert on the stock blank standee. Both the original moulded
    // jade frame and the double-sided backlit panels stay intact.
    const print=new T.Mesh(geometry.plane,material);
    print.name='Gallery standee printed directions';print.position.set(0,1.065,.093);
    print.scale.set(.69,1.30,1);totem.add(print);
    const mesh=new T.Mesh(geometry.plane,material);
    mesh.name='Wayfinding court directory';mesh.position.set(tabletX,1.69,tabletZ+.138);mesh.scale.set(1.01,2.24,1);scene.add(mesh);
  }
  for(const x of [garden.x-2.65,garden.x+1.65]){
    box('oak',x,.52,garden.z+1.35,2.4,.12,.40);
    box('glow',x,.32,garden.z+1.47,2.25,.025,.02);
  }
  lightPool(garden.x,.053,garden.z+1.7,9,2.5);

  // The ceiling plate meets the underside of the central vault rib. The
  // pendant tips stay 6m above the floor, clear of visitors and the camera.
  const chandelier = new T.Group();
  chandelier.name='Gallery atrium chandelier'; chandelier.userData.sourceStatus='pending';
  chandelier.position.set(10,5.98,30.55);
  lightPool(10,.054,30.55,4.8,4.8);
  chandelier.visible=false;
  scene.add(chandelier);
  let requested=false;
  async function loadChandelier() {
    const record=await loadStaticAsset(T,{file:'atrium-chandelier.glb',asset_id:'ASSET_AtriumChandelier',
      sha256:'dd38e05584ce57f01a5323951254ef63c47fbea61b57ece525fc0ef5bfe5fb26',
      dimensions_m:[3,2,3],rootExtras:{units:'metres'}},import.meta.url);
    await mountStaticModel(record, chandelier);
  }
  requested=true;
  if ('requestIdleCallback' in window) window.requestIdleCallback(loadChandelier,{timeout:1500});
  else setTimeout(loadChandelier,0);
  return function updateChandelier(visitor) {
    const dx=visitor.x-chandelier.position.x,dz=visitor.z-chandelier.position.z;
    chandelier.visible=visitor.y<5 && dx*dx+dz*dz<24*24;
    if (!chandelier.visible || requested) return;
    requested=true;
    if ('requestIdleCallback' in window) window.requestIdleCallback(loadChandelier,{timeout:1500});
    else setTimeout(loadChandelier,0);
  };
}
