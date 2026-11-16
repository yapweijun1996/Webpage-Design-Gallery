const SHOPS = Object.freeze([
  ['New Moon', 'S01-new-moon.webp'], ['MILI', 'S02-mili.webp'], ['GOGO', 'S03-gogo.webp'],
  ['Borsch Med', 'S04-borsch-med.webp'], ['Pien Tze Huang', 'S05-pien-tze-huang.webp'],
  ['Flying Wheel', 'S06-flying-wheel.webp'], ['Gu Long', 'S07-gu-long.webp'], ['Skippy', 'S08-skippy.webp'],
  ['SPAM', 'S09-spam.webp'], ['California Mexico', 'S10-california-mexico.webp'], ['Hormel', 'S11-hormel.webp'],
  ['Zeria', 'S12-zeria.webp'], ['Sony', 'S13-sony.webp'], ['LG', 'S14-lg.webp'], ['Casio', 'S15-casio.webp'],
  ['GP', 'S16-gp.webp'], ['Gigaset', 'S17-gigaset.webp'],
]);
const SLOT_COUNT = 17;

function loadImage(url) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export async function addShopSignAtlas(T, layout, scene) {
  const width = 1536, rowHeight = 112;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = rowHeight * SLOT_COUNT;
  const context = canvas.getContext('2d');
  const logos = await Promise.all(SHOPS.map(([, file]) => loadImage(new URL(`./brands/${file}`, import.meta.url).href)));
  SHOPS.forEach(([name], index) => {
    const y = index * rowHeight;
    context.fillStyle = '#102e26'; context.fillRect(0, y, width, rowHeight);
    context.strokeStyle = '#d0b36e'; context.lineWidth = 8; context.strokeRect(8, y + 8, width - 16, rowHeight - 16);
    if(index===0){context.fillStyle='#b53a32';context.fillRect(16,y+rowHeight-10,width-32,4);}
    const logo = logos[index];
    if (logo) {
      const maxLogoWidth = 380, maxLogoHeight = 80;
      const scale = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
      const logoWidth = logo.width * scale, logoHeight = logo.height * scale;
      context.drawImage(logo, 32 + (maxLogoWidth - logoWidth) / 2, y + (rowHeight - logoHeight) / 2, logoWidth, logoHeight);
    }
    context.fillStyle = '#fff4dd'; context.font = 'bold 44px Arial';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(name, 980, y + rowHeight / 2, 960);
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const positions = [], uvs = [], indices = [];
  layout.slots.forEach(bay => {
    if (bay.available) return;
    const index = Number(bay.number) - 1;
    const x = bay.side === 'north' ? (bay.minX + bay.maxX) / 2 : bay.side === 'west' ? bay.maxX + .27 : bay.minX - .27;
    const z = bay.side === 'north' ? .26 : (bay.minZ + bay.maxZ) / 2;
    // Keep the atlas face toward the approach; DoubleSide alone would mirror the
    // lettering when a visitor sees the back of a reversed quad.
    const angle = bay.side === 'north' ? 0 : bay.side === 'west' ? Math.PI / 2 : -Math.PI / 2;
    const widthOnWall = bay.side === 'north' ? 8.6 : 6.8;
    const height = 1.18, cos = Math.cos(angle), sin = Math.sin(angle);
    for (const [dx, dy] of [[-widthOnWall / 2, -height / 2], [widthOnWall / 2, -height / 2],
      [widthOnWall / 2, height / 2], [-widthOnWall / 2, height / 2]]) {
      positions.push(x + dx * cos, 4.75 + dy, z - dx * sin);
    }
    const bottom = 1 - (index + 1) / SLOT_COUNT, top = 1 - index / SLOT_COUNT;
    uvs.push(0, bottom, 1, bottom, 1, top, 0, top);
    const vertex = positions.length / 3 - 4;
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({map: texture, side: T.DoubleSide}));
  mesh.name = 'Expanded branded shop signs';
  scene.add(mesh);
  return mesh;
}
