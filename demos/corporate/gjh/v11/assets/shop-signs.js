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
    const bay = layout.slots[index];
    const faceWidth = bay.side === 'north' ? 8.6 : 6.8;
    // Paint in the physical fascia's aspect ratio before packing the atlas.
    // Otherwise the shorter side bays squeeze letters into narrow vertical bars.
    const logicalWidth = rowHeight * faceWidth / 1.18;
    const finishes = {7:'#632b21', 8:'#193565', 9:'#182f4d', 11:'#613232'};
    const y = index * rowHeight;
    context.save();
    context.translate(0, y);
    context.scale(width / logicalWidth, 1);
    context.fillStyle = finishes[index + 1] || '#19362d';
    context.fillRect(0, 0, logicalWidth, rowHeight);
    context.strokeStyle = '#b79c63'; context.lineWidth = 1.5;
    context.strokeRect(4, 5, logicalWidth - 8, rowHeight - 10);
    const logo = logos[index];
    if (logo) {
      const scale = Math.min(65 / logo.width, 32 / logo.height);
      const w = logo.width * scale, h = logo.height * scale;
      context.drawImage(logo, 18 + (65-w)/2, (rowHeight-h)/2, w, h);
    }
    const heritage = [1,2,4,5,6,7,10,11,12].includes(index+1);
    context.fillStyle = index === 8 ? '#ffca49' : '#f6e7c7';
    context.font = heritage ? '54px Georgia, serif' : '600 49px Arial, sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(name, logicalWidth / 2, rowHeight * .52, logicalWidth - 185);
    context.restore();
  });
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const positions = [], uvs = [], indices = [];
  layout.slots.forEach(bay => {
    const index = Number(bay.number) - 1;
    const x = bay.side === 'north' ? (bay.minX + bay.maxX) / 2 : bay.side === 'west' ? bay.maxX + .27 : bay.minX - .27;
    const z = bay.side === 'north' ? (Number(bay.number) <= 3 ? .48 : .26) : (bay.minZ + bay.maxZ) / 2;
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
