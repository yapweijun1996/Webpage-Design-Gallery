const LOGOS = [
  'S01-new-moon.webp', 'S02-mili.webp', 'S03-gogo.webp', 'S04-borsch-med.webp',
  'S05-pien-tze-huang.webp', 'S06-flying-wheel.webp', 'S07-gu-long.webp', 'S08-skippy.webp',
  'S09-spam.webp', 'S10-california-mexico.webp', 'S11-hormel.webp', 'S12-zeria.webp',
  'S13-sony.webp', 'S14-lg.webp', 'S15-casio.webp', 'S16-gp.webp', 'S17-gigaset.webp'
];
const SLOT_COUNT = LOGOS.length;
let brandKitPromise;
export function loadBrandKit() {
  if (!brandKitPromise) brandKitPromise = fetch(new URL('./brand-kit/brand-kit.json', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error('Brand-kit metadata unavailable');
      return response.json();
    });
  return brandKitPromise;
}

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
  const [kit, logos] = await Promise.all([
    loadBrandKit(),
    Promise.all(LOGOS.map(file => loadImage(new URL(`./brands/${file}`, import.meta.url).href)))
  ]);
  LOGOS.forEach((_, index) => {
    const name = kit[`S${String(index + 1).padStart(2, '0')}`].brand;
    const y = index * rowHeight;
    context.fillStyle = '#09271d'; context.fillRect(0, y, width, rowHeight);
    context.strokeStyle = '#d0b36e'; context.lineWidth = 5; context.strokeRect(4, y + 4, width - 8, rowHeight - 8);
    const logo = logos[index];
    if (logo) {
      const maxLogoWidth = 270, maxLogoHeight = 90;
      const scale = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
      const logoWidth = logo.width * scale, logoHeight = logo.height * scale;
      context.drawImage(logo, 18 + (maxLogoWidth - logoWidth) / 2, y + (rowHeight - logoHeight) / 2, logoWidth, logoHeight);
    }
    context.fillStyle = '#fff9e9'; context.font = 'bold 72px Arial';
    context.textAlign = 'left'; context.textBaseline = 'middle';
    context.fillText(name, 315, y + rowHeight / 2, width - 340);
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const positions = [], uvs = [], indices = [];
  layout.slots.forEach(bay => {
    const index = Number(bay.number) - 1;
    const x = bay.side === 'north' ? (bay.minX + bay.maxX) / 2 : bay.side === 'west' ? bay.maxX + .27 : bay.minX - .27;
    const z = bay.side === 'north' ? (bay.available ? .48 : .26) : (bay.minZ + bay.maxZ) / 2;
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
