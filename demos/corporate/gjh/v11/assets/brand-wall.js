const SLOT_COUNT = 17;
const COLUMNS = 4;
const LOGO_FILES = Object.freeze(['new-moon','mili','gogo','borsch-med','pien-tze-huang','flying-wheel','gu-long','skippy','spam','california-mexico','hormel','zeria','sony','lg','casio','gp','gigaset']);

function image(url) {
  return new Promise(resolve => {
    const item = new Image();
    item.onload = () => resolve(item);
    item.onerror = () => resolve(null);
    item.src = url;
  });
}

function wrap(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(/\s+/);
  let line = '', lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y + lines++ * lineHeight, maxWidth);
      line = word;
      if (lines === maxLines - 1) break;
    } else line = next;
  }
  if (lines < maxLines && line) context.fillText(line, x, y + lines * lineHeight, maxWidth);
}

export async function addBrandWallAtlas(T, scene, deckY) {
  const kitResponse = await fetch(new URL('./brand-kit/brand-kit.json', import.meta.url));
  if (!kitResponse.ok) throw new Error('Brand-kit metadata unavailable');
  const kit = await kitResponse.json();
  const entries = Array.from({length:SLOT_COUNT}, (_, index) => kit[`S${String(index + 1).padStart(2, '0')}`]);
  if (entries.some((entry, index) => !entry || entry.slot !== `S${String(index + 1).padStart(2, '0')}` ||
      typeof entry.brand !== 'string' || typeof entry.tagline !== 'string' || typeof entry.story !== 'string')) {
    throw new Error('Brand-kit plaque records are incomplete');
  }
  const logos = await Promise.all(entries.map((entry,index) =>
    image(new URL(`./brands/${entry.slot}-${LOGO_FILES[index]}.webp`, import.meta.url).href)));
  const cellWidth = 256, cellHeight = 224;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.scale(canvas.width / (cellWidth * COLUMNS), canvas.height / (cellHeight * Math.ceil(SLOT_COUNT / COLUMNS)));
  entries.forEach((entry, index) => {
    const x = index % COLUMNS * cellWidth, y = Math.floor(index / COLUMNS) * cellHeight;
    context.fillStyle = '#f4efdf'; context.fillRect(x, y, cellWidth, cellHeight);
    context.fillStyle = '#174638'; context.fillRect(x + 7, y + 7, cellWidth - 14, cellHeight - 14);
    context.strokeStyle = '#d0ae65'; context.lineWidth = 3; context.strokeRect(x + 11, y + 11, cellWidth - 22, cellHeight - 22);
    const logo = logos[index];
    if (logo) {
      const scale = Math.min(212 / logo.width, 112 / logo.height);
      const width = logo.width * scale, height = logo.height * scale;
      context.drawImage(logo, x + (cellWidth - width) / 2, y + 20 + (112 - height) / 2, width, height);
    } else {
      context.fillStyle = '#f4efdf'; context.font = 'bold 30px Arial'; context.textAlign = 'center';
      context.fillText(entry.brand, x + cellWidth / 2, y + 82, 220);
    }
    context.fillStyle = '#f4efdf'; context.font = 'bold 17px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle';
    wrap(context, entry.tagline, x + cellWidth / 2, y + 166, 218, 19, 2);
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const positions = [], uvs = [], indices = [], interactables = [], records = {};
  entries.forEach((entry, index) => {
    const column = index % COLUMNS, row = Math.floor(index / COLUMNS);
    const x = -6.25 + column * 2.15, y = deckY + 2.16 - row * .455, z = 15.69;
    const width = 2, height = .40;
    positions.push(x+width/2,y-height/2,z, x-width/2,y-height/2,z,
      x-width/2,y+height/2,z, x+width/2,y+height/2,z);
    const left = column / COLUMNS, right = (column + 1) / COLUMNS;
    const top = 1 - row / Math.ceil(SLOT_COUNT / COLUMNS), bottom = 1 - (row + 1) / Math.ceil(SLOT_COUNT / COLUMNS);
    uvs.push(left,bottom,right,bottom,right,top,left,top);
    const vertex = index * 4; indices.push(vertex,vertex+1,vertex+2,vertex,vertex+2,vertex+3);
    const id = `brand-plaque-${entry.slot}`;
    interactables.push({id,x:x+(row-2)*.13,y:deckY,z:14.50+column*.05,radius:1.35});
    records[id] = {name:entry.brand,brand:entry.brand,tagline:entry.tagline,story:entry.story,
      image:`assets/brands/${entry.slot}-${LOGO_FILES[index]}.webp`, action:'brand-story',
      kind:'Brand plaque · independent virtual mall concept',alt:`${entry.brand} logo`};
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({map:texture,toneMapped:false}));
  mesh.name = 'Seventeen brand wall plaques'; mesh.userData.deckLod = true;
  mesh.visible = false;
  scene.add(mesh);
  return {mesh,interactables,records};
}
