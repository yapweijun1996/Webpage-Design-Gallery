// Front-label projection follows v10's verified crop; unseen backs stay plain metal.
export function addProducts(T, scene, textures, brass) {
  const ids = ['nz-425g', 'au-425g', 'sa-425g', 'mx-454g'];
  const profile = [[0, -.485], [.95, -.485], [.98, -.5], [1, -.49], [1, -.465], [.972, -.445], [.972, .445], [1, .465], [1, .49], [.98, .5], [.95, .5], [.95, .475], [0, .475]].map(([r, y]) => new T.Vector2(r, y));
  const bodyGeometry = new T.LatheGeometry(profile, 24);
  const labelGeometry = new T.CylinderGeometry(.974, .974, 512 / 594, 24, 1, true, -Math.PI / 2, Math.PI);
  const body = new T.InstancedMesh(bodyGeometry, brass, 36), matrix = new T.Matrix4();
  const pos = new T.Vector3(), scale = new T.Vector3(.52 * 360 / 594 / 2, .52, .52 * 360 / 594 / 2), rotation = new T.Quaternion();
  let bodyIndex = 0;
  const interactables = [];
  for (let i = 0; i < ids.length; i++) {
    const id = `new-moon-${ids[i]}-front`, source = textures.get(`${id}.jpg`);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    for (let column = 0; column < 512; column++) {
      const x0 = 326 + (Math.sin((column / 512 - .5) * Math.PI) + 1) * 174;
      const x1 = 326 + (Math.sin(((column + 1) / 512 - .5) * Math.PI) + 1) * 174;
      context.drawImage(source.image, x0 * source.image.width / 1000, 315 * source.image.height / 1000, (x1 - x0) * source.image.width / 1000, 512 * source.image.height / 1000, column, 0, 1, 512);
    }
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const labels = new T.InstancedMesh(labelGeometry, new T.MeshStandardMaterial({map: texture, roughness: .65}), 9);
    let index = 0;
    const x = -12.85 + i * 1.9;
    for (const shelf of [.465, 1.295, 2.125]) for (const dx of [-.44, 0, .44]) {
      pos.set(x + dx, shelf + .26, -9.04); matrix.compose(pos, rotation, scale); body.setMatrixAt(bodyIndex++, matrix); labels.setMatrixAt(index++, matrix);
    }
    labels.castShadow = true; labels.receiveShadow = true; scene.add(labels);
    interactables.push({id, x, z: -8.3, radius: 1.9});
  }
  body.castShadow = body.receiveShadow = true; scene.add(body);
  return interactables;
}
