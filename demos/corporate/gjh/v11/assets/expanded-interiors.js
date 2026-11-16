import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

// Furniture is a single vertex-coloured draw per bay; the image is a second draw.
// Coordinates inside each bay have the glazed front on local +Z.
export async function createExpandedInteriors(T, expandedLayout, scene) {
  const slots = expandedLayout.slots.filter(slot => Number(slot.number) >= 4 && Number(slot.number) <= 17);
  const loader = new T.TextureLoader().setCrossOrigin(undefined);
  const textures = await Promise.all(slots.map(slot => loader.loadAsync(new URL(`./brand-kit/S${slot.number}-hero.webp`, import.meta.url).href)));
  const material = new T.MeshStandardMaterial({vertexColors:true, roughness:.78, emissive:0x30281b, emissiveIntensity:.22});
  const posterGeometry = new T.PlaneGeometry(4, 2.7);
  const shops = [];
  const ivory = 0xeee4d1, green = 0x526e5b, gold = 0xc6a66b, wood = 0x8b674a;
  const accents = {4:0x785a68, 5:0x913f35, 6:0x667887, 7:0x9c4937, 8:0x477aac,
    9:0x294f7c, 10:0x478c86, 11:0x843e43, 12:0x6f9690, 13:0x33383b,
    14:0x665079, 15:0x292725, 16:0x4b9993, 17:0x62696a};

  slots.forEach((slot, index) => {
    const number = Number(slot.number), side = slot.side;
    const width = side === 'north' ? slot.maxX-slot.minX : slot.maxZ-slot.minZ;
    const depth = side === 'north' ? slot.maxZ-slot.minZ : slot.maxX-slot.minX;
    const group = new T.Group();
    group.name = `S${slot.number} interior`;
    group.position.set((slot.minX+slot.maxX)/2, 0, (slot.minZ+slot.maxZ)/2);
    group.rotation.y = side === 'west' ? Math.PI/2 : side === 'east' ? -Math.PI/2 : 0;
    const back = -depth/2 + .18, front = depth/2;
    const parts = [];
    let heroOffset = 0;
    function add(geometry, x, y, z, color) {
      geometry.translate(x + heroOffset, y, z);
      const c = new T.Color(color), colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i=0; i<colors.length; i+=3) { colors[i]=c.r; colors[i+1]=c.g; colors[i+2]=c.b; }
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      parts.push(geometry);
    }
    function box(x,y,z,w,h,d,color) { add(new T.BoxGeometry(w,h,d),x,y,z,color); }
    function cylinder(x,y,z,r,h,color) { add(new T.CylinderGeometry(r,r,h,12),x,y,z,color); }
    // Architectural backdrop, floor and a warm illuminated picture surround.
    box(0,2.45,back-.08,width-.35,4.9,.16,ivory);
    box(0,.035,0,width-.35,.07,depth-.4,0xd6c6a7);
    box(0,2.9,back+.08,4.3,3,.12,gold);
    box(0,4.45,back+.16,4.5,.1,.16,0xffe5a7);
    for (const x of [-2,2]) box(x,4.7,0,.1,.08,depth-1,0xffe5a7);
    box(0,.17,back+.14,width-.45,.25,.18,green);
    // Bring category displays forward so their contents read from the arcade.
    const shelf = back + 2.9;
    for (const sign of [-1,1]) {
      const x = sign*(width/2-1.05);
      box(x,1.3,shelf,1.65,2.6,.72,wood);
      box(x,1.35,shelf+.38,1.45,2.25,.06,green);
      if (number >= 13) {
        box(x,1.36,shelf+.43,1.25,.85,.06,0x23343b);
        box(x,1.36,shelf+.47,1.08,.68,.03,accents[number]);
        box(x,.72,shelf+.75,1.5,.12,1.05,gold);
        box(x,.36,shelf+.75,1.3,.72,.8,wood);
      } else for (const y of [.55,1.12,1.69,2.26]) {
        box(x,y,shelf+.51,1.5,.09,.36,gold);
        for (let i=-1;i<=1;i++) {
          const px=x+i*.4;
          if (number >= 7 && number <= 11) {
            cylinder(px,y+.18,shelf+.52,.15,.27,number===8?0xcba76c:ivory);
            cylinder(px,y+.33,shelf+.52,.155,.035,accents[number]);
          } else {
            box(px,y+.21,shelf+.52,.3,.34,.15,ivory);
            box(px,y+.23,shelf+.61,.22,.13,.025,accents[number]);
          }
        }
      }
    }
    heroOffset = 2.6;
    // Front pedestal and a large category silhouette, intentionally unlabelled.
    const heroZ = front-1.75;
    box(0,.47,heroZ,2.1,.9,1.05,green);
    box(0,.95,heroZ,2.25,.08,1.2,gold);
    const accent = accents[number];
    if (number >= 7 && number <= 11) {
      cylinder(0,1.5,heroZ,.37,1.05,number===8?0xd6b778:ivory);
      cylinder(0,2.04,heroZ,.38,.09,accent);
      box(0,1.53,heroZ+.375,.56,.38,.025,accent);
    } else if (number === 14) {
      box(0,1.64,heroZ,1.65,.95,.12,0x20292d);
      box(0,1.64,heroZ+.07,1.48,.78,.025,0x506e78);
      box(0,1.1,heroZ,.12,.19,.2,0x34383a);
    } else if (number === 15) {
      box(0,1.38,heroZ,1.85,.74,.65,0x282522);
      box(0,1.78,heroZ+.18,1.72,.07,.37,ivory);
      for (let i=-6;i<=6;i++) box(i*.125,1.83,heroZ+.09,.045,.05,.17,0x262626);
    } else if (number === 13) {
      box(0,1.42,heroZ,.16,.83,.18,accent);
      box(0,1.84,heroZ,.85,.12,.18,accent);
      box(-.39,1.58,heroZ,.12,.46,.2,accent);
      box(.39,1.58,heroZ,.12,.46,.2,accent);
    } else if (number === 17) {
      box(0,1.12,heroZ,.8,.24,.6,accent);
      box(0,1.59,heroZ,.35,.83,.19,ivory);
      box(0,1.73,heroZ+.11,.22,.2,.025,accent);
      for (let i=-1;i<=1;i++) for (let j=0;j<3;j++) box(i*.07,1.52-j*.08,heroZ+.11,.035,.035,.02,accent);
    } else if (number === 16) {
      cylinder(0,1.5,heroZ,.35,.19,ivory);
      cylinder(0,1.61,heroZ,.16,.035,accent);
    } else {
      box(0,1.57,heroZ,.73,1.18,.35,ivory);
      box(0,1.59,heroZ+.19,.56,.46,.03,accent);
      box(0,2.19,heroZ,.73,.07,.36,gold);
    }
    const merged = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    const furniture = new T.Mesh(merged, material);
    furniture.name = `S${slot.number} furnishings`;
    group.add(furniture);
    const texture = textures[index];
    texture.colorSpace = T.SRGBColorSpace;
    const poster = new T.Mesh(posterGeometry, new T.MeshBasicMaterial({map:texture}));
    poster.name = `S${slot.number} hero image`;
    poster.position.set(0,2.9,back+.151);
    group.add(poster);
    group.visible = false;
    scene.add(group);
    shops.push({group, x:group.position.x, z:group.position.z});
  });
  return {update(visitor) {
    for (const shop of shops) {
      const dx=visitor.x-shop.x, dz=visitor.z-shop.z;
      shop.group.visible = Math.abs(visitor.y) < 5 && dx*dx+dz*dz < 17*17;
    }
  }};
}
