// Verified local packshots: assets/new-moon-{nz-425g,au-425g,sa-425g,mx-454g}-front.jpg.
// All four depict cylindrical cans, not boxes. The common 1000 × 1000 source
// framing places the can at x=320–680, y=272–866. Crop x=326–674, y=315–827
// stays inside the printed label, excluding the white studio background,
// separate store masthead, photographed lid and curved bottom rim.
const LABEL_CROP = {x: 326, y: 315, width: 348, height: 512};
const CAN_ASPECT = 360 / 594;
const PRODUCTS = [
  {id: 'nz-425g', x: -8.4, y: 2.59, height: 1.34},
  {id: 'au-425g', x: -5.6, y: 2.59, height: 1.34},
  {id: 'sa-425g', x: -8.4, y: 1.04, height: 1.24},
  {id: 'mx-454g', x: -5.6, y: 1.04, height: 1.24},
  {id: 'nz-425g', x: -4.65, y: 1.625, z: -5.5, height: .82}
];

function frontLabelTexture(THREE, source) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = LABEL_CROP.height;
  const context = canvas.getContext('2d');
  const scaleX = source.image.width / 1000;
  const scaleY = source.image.height / 1000;

  // This is a front-view projection, not a reconstruction of unseen artwork.
  // Inverse cylindrical projection preserves the photographed face proportions:
  // an angular strip samples x = centre + radius * sin(angle). Only the front
  // hemisphere carries the verified image; the unseen rear remains plain brass.
  for (let column = 0; column < canvas.width; column++) {
    const angle0 = (column / canvas.width - .5) * Math.PI;
    const angle1 = ((column + 1) / canvas.width - .5) * Math.PI;
    const x0 = LABEL_CROP.x + (Math.sin(angle0) + 1) * LABEL_CROP.width / 2;
    const x1 = LABEL_CROP.x + (Math.sin(angle1) + 1) * LABEL_CROP.width / 2;
    context.drawImage(
      source.image,
      x0 * scaleX, LABEL_CROP.y * scaleY,
      (x1 - x0) * scaleX, LABEL_CROP.height * scaleY,
      column, 0, 1, canvas.height
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = source.anisotropy;
  return texture;
}

/** Add source-proportioned shelf and counter cans; return selectable meshes. */
export function createProductModels(THREE, scene, textures, brassMaterial) {
  // One shared closed profile supplies the body, inset lid and rolled gold rims.
  const profile = [
    [0, -.485], [.95, -.485], [.98, -.5], [1, -.49],
    [1, -.465], [.972, -.445], [.972, .445], [1, .465],
    [1, .49], [.98, .5], [.95, .5], [.95, .475], [0, .475]
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const canGeometry = new THREE.LatheGeometry(profile, 32);
  const labelGeometry = new THREE.CylinderGeometry(
    .974, .974, LABEL_CROP.height / 594, 32, 1, true, -Math.PI / 2, Math.PI
  );
  const selectable = [];

  const labelMaterials = new Map();
  for (const product of PRODUCTS) {
    const key = `new-moon-${product.id}-front`;
    if (!labelMaterials.has(key)) {
      const texture = frontLabelTexture(THREE, textures.get(`${key}.jpg`));
      labelMaterials.set(key, new THREE.MeshStandardMaterial({map: texture, roughness: .72, metalness: .04}));
    }
    const labelMaterial = labelMaterials.get(key);
    const radius = product.height * CAN_ASPECT / 2;
    const can = new THREE.Mesh(canGeometry, brassMaterial);
    const label = new THREE.Mesh(labelGeometry, labelMaterial);

    for (const mesh of [can, label]) {
      mesh.position.set(product.x, product.y, product.z ?? -8.6);
      mesh.scale.set(radius, product.height, radius);
      mesh.userData.product = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      selectable.push(mesh);
    }
    label.position.y -= product.height * 2 / 594;
    // Shelf tops are y=1.92 and .42. These row heights preserve the source can
    // aspect ratio while seating each lower rolled rim exactly on its shelf.
  }

  // Ten main-pass draw calls; repeated can geometry and label materials are shared.
  return selectable;
}
