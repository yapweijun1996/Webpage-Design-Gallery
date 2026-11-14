// Experimental two-level test space. The static slabs own collision; during
// travel the player controller owns the kinematic rider and calls setHeight.
export function createElevatorV2(T, R, physics, scene) {
  const x = 0, z = 16, upper = 7.2;
  const slabMaterial = new T.MeshStandardMaterial({color: 0x35584d, roughness: .8});
  const railMaterial = new T.MeshStandardMaterial({color: 0xb59b62, metalness: .55, roughness: .35});
  const panelMaterial = new T.MeshStandardMaterial({color: 0x183a30, roughness: .5});
  function box(material, px, py, pz, sx, sy, sz, collision = false) {
    const mesh = new T.Mesh(new T.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(px, py, pz); mesh.receiveShadow = true; scene.add(mesh);
    if (collision) physics.createCollider(R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(px, py, pz));
  }
  // A genuine separate walking surface above the original roof.
  box(slabMaterial, 0, upper - .2, 13, 12, .4, 10, true);
  box(panelMaterial, -6, upper + .55, 13, .15, 1.1, 10, true);
  box(panelMaterial, 6, upper + .55, 13, .15, 1.1, 10, true);
  box(panelMaterial, 0, upper + .55, 8, 12, 1.1, .15, true);
  box(panelMaterial, 0, upper + .55, 18, 12, 1.1, .15, true);
  for (const side of [-1, 1]) box(railMaterial, side * 6, upper + 1.13, 13, .12, .1, 10);
  box(railMaterial, 0, upper + 1.13, 8, 12, .1, .12);
  box(railMaterial, 0, upper + 1.13, 18, 12, .1, .12);
  // The cabin follows the rider, rather than making a floor change a map jump.
  const cabin = new T.Group(); cabin.position.set(x, 0, z); scene.add(cabin);
  function part(material, px, py, pz, sx, sy, sz) {
    const mesh = new T.Mesh(new T.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(px, py, pz); cabin.add(mesh);
  }
  part(railMaterial, 0, .045, 0, 2.4, .08, 2.4);
  part(panelMaterial, 0, 1.25, -1.18, 2.4, 2.5, .08);
  for (const side of [-1, 1]) part(railMaterial, side * 1.17, 1.25, -1.1, .08, 2.5, .12);
  part(railMaterial, 0, 2.52, -1.1, 2.4, .08, .12);
  const label = document.createElement('canvas'); label.width = 512; label.height = 128;
  const ctx = label.getContext('2d'); ctx.fillStyle = '#17372e'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#f5e8cb'; ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ELEVATOR', 256, 82);
  const sign = new T.Mesh(new T.PlaneGeometry(1.8, .45), new T.MeshBasicMaterial({map: new T.CanvasTexture(label)}));
  sign.position.set(0, 2.15, -1.12); cabin.add(sign);
  return {
    x, z, upper,
    setHeight(y) { cabin.position.y = y; },
    interactables: [0, upper].map(y => ({id:'visitor-elevator', x, z, y, radius:1.45})),
  };
}
