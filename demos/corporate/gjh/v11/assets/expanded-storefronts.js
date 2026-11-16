// Static display fronts for the fourteen unavailable bays. The glazing and
// doors are visual only; the world owns the closed-bay collision boundaries.
export function addExpandedStorefronts(T, layout, scene) {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const batches = {
    frame: {material: new T.MeshStandardMaterial({color: 0x163c30, roughness: .66}), matrices: []},
    brass: {material: new T.MeshStandardMaterial({color: 0xb99a5c, metalness: .65, roughness: .38}), matrices: []},
    glass: {material: new T.MeshStandardMaterial({color: 0xb9d9d0, metalness: .05, roughness: .18,
      transparent: true, opacity: .23, depthWrite: false}), matrices: []}
  };
  const transform = new T.Object3D();
  for (const bay of layout.slots) {
    if (bay.available) continue;
    const angle = bay.side === 'north' ? 0 : bay.side === 'west' ? Math.PI / 2 : -Math.PI / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = bay.side === 'north' ? (bay.minX + bay.maxX) / 2 : bay.side === 'west' ? bay.maxX : bay.minX;
    const z = bay.side === 'north' ? bay.maxZ : (bay.minZ + bay.maxZ) / 2;
    const width = (bay.side === 'north' ? bay.maxX - bay.minX : bay.maxZ - bay.minZ) - .6;
    // Local positive Z always faces the concourse.
    const box = (kind, along, y, depth, w, h, d) => {
      transform.position.set(x + along * cos + depth * sin, y, z - along * sin + depth * cos);
      transform.rotation.set(0, angle, 0);
      transform.scale.set(w, h, d);
      transform.updateMatrix();
      batches[kind].matrices.push(transform.matrix.clone());
    };
    const windowWidth = (width - 2.7) / 2;
    const windowCenter = 1.3 + windowWidth / 2;
    box('frame', 0, 4.75, 0, width, 1.5, .36);
    box('brass', 0, 4.02, .21, width, .055, .08);
    box('brass', 0, 5.48, .21, width, .055, .08);
    for (const side of [-1, 1]) {
      box('glass', side * windowCenter, 2.17, 0, windowWidth, 3.35, .06);
      box('frame', side * windowCenter, .25, .07, windowWidth, .5, .22);
      box('brass', side * windowCenter, .51, .2, windowWidth, .045, .05);
      box('frame', side * (width / 2 - .07), 2.02, .08, .14, 4.04, .24);
      box('frame', side * 1.3, 2.02, .08, .12, 4.04, .24);
      box('brass', side * windowCenter, 2.4, .12, windowWidth, .035, .05);
      // Two glazed, closed leaves keep a recognisable doorway in every bay.
      box('glass', side * .64, 1.97, .025, 1.2, 3.86, .06);
      box('frame', side * .64, .12, .09, 1.2, .24, .18);
      box('frame', side * .04, 2, .1, .08, 4, .18);
      box('brass', side * .18, 1.16, .21, .045, .55, .06);
    }
    box('frame', 0, 4, .08, width, .16, .24);
  }
  const meshes = [];
  for (const [kind, batch] of Object.entries(batches)) {
    if (!batch.matrices.length) continue;
    const mesh = new T.InstancedMesh(geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.name = `Expanded storefront ${kind}`;
    mesh.receiveShadow = kind !== 'glass';
    mesh.computeBoundingSphere();
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
