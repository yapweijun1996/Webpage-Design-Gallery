import {fasciaBand} from './signage/config.js';
import {shopEntrance} from './expanded-layout.js';

// Batch facade trim and sliding glass leaves across the expanded mall.
export function addExpandedStorefronts(T, layout, scene, signs, lowTrimMaterial) {
  const geometry = new T.BoxGeometry(1, 1, 1);
  const batches = {
    frame: {material: new T.MeshStandardMaterial({color: 0x102a22, roughness: .29, metalness: .16}), matrices: []},
    brass: {material: new T.MeshStandardMaterial({color: 0xc9a55e, metalness: .78, roughness: .28}), matrices: []},
    accent: {material: new T.MeshStandardMaterial({color: 0xffffff, roughness: .58}), matrices: [], colours: []},
    glass: {material: new T.MeshBasicMaterial({color: 0xb9d9d0,
      transparent: true, opacity: .065, depthWrite: false}), matrices: []}
  };
  const transform = new T.Object3D();
  const slidingParts = new Map();
  for (const bay of layout.slots) {
    const number = Number(bay.number);
    const {x,z,alongX:cos,normalX:sin,yaw:angle} = shopEntrance(bay);
    const width = (bay.side === 'north' ? bay.maxX - bay.minX : bay.maxZ - bay.minZ) - .6;
    // Local positive Z always faces the concourse.
    const box = (kind, along, y, depth, w, h, d, leaf = 0, colour) => {
      transform.position.set(x + along * cos + depth * sin, y, z - along * sin + depth * cos);
      transform.rotation.set(0, angle, 0);
      transform.scale.set(w, h, d);
      transform.updateMatrix();
      batches[kind].matrices.push(transform.matrix.clone());
      if (leaf) {
        if (!slidingParts.has(bay.number)) slidingParts.set(bay.number, []);
        slidingParts.get(bay.number).push({kind,index:batches[kind].matrices.length-1,dx:leaf*cos,dz:-leaf*sin});
      }
      if (kind === 'accent') batches.accent.colours.push(colour ?? signs.get('S'+bay.number).palette.accent);
    };
    if (number <= 3) {
      // Leave the existing 4.7 m entrance and its moving leaves unobstructed.
      box('accent', 0, 5.55, .32, width, .14, .24);
      for (const side of [-1, 1]) {
        box('accent', side * 2.47, 1.95, .21, .12, 3.7, .08);
      }
      continue;
    }
    const windowWidth = (width - 2.7) / 2;
    const windowCenter = 1.3 + windowWidth / 2;
    box('frame', 0, 4.75, 0, width, 1.5, .36);
    const band=fasciaBand(bay);
    box('brass', 0, band.bottom, .21, width, .055, .08);
    box('brass', 0, band.top, .21, width, .055, .08);
    // A projecting colour strip and coloured door jambs give each bay a
    // distinctive silhouette without adding per-store materials or meshes.
    box('brass', 0, 5.55, .24, width, .055, .29);
    box('brass', 0, 3.94, .22, 2.65, .055, .08);
    for (const side of [-1, 1]) {
      box('glass', side * windowCenter, 2.17, 0, windowWidth, 3.35, .06);
      // LG's display plinth uses the existing coloured trim batch.
      box(number===14 ? 'accent' : 'frame', side * windowCenter, .25, .07, windowWidth, .5, .22, 0, 0x92806a);
      box('brass', side * windowCenter, .51, .2, windowWidth, .045, .05);
      box('frame', side * (width / 2 - .07), 2.02, .08, .14, 4.04, .24);
      box('frame', side * 1.3, 2.02, .08, .12, 4.04, .24);
      box('brass', side * 1.3, 2.02, .22, .035, 3.72, .04);
      // Alternate slim and broad end markers to distinguish adjacent bays.
      box('accent', side * (width / 2 - .35), 3.69, .22, number % 2 ? .18 : .38, .32, .08);

      // Each leaf retracts behind its fixed window when approached from either side.
      box('glass', side * .64, 1.97, .025, 1.2, 3.86, .06, side);
      box('frame', side * .64, .12, .09, 1.2, .24, .18, side);
      box('brass', side * .019, 2, .1, .022, 4, .035, side);
      box('brass', side * .18, 1.16, .21, .045, .55, .06, side);
    }
    box('frame', 0, 4, .08, width, .16, .24);
  }
  const meshes = {};
  for (const [kind, batch] of Object.entries(batches)) {
    if (!batch.matrices.length) continue;
    const mesh = new T.InstancedMesh(geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    if (batch.colours) {
      const color=new T.Color();
      batch.colours.forEach((tint,index) => mesh.setColorAt(index,color.set(tint)));
      mesh.instanceColor.needsUpdate=true;
    }
    mesh.name = `Expanded storefront ${kind}`;
    mesh.receiveShadow = kind !== 'glass';
    mesh.computeBoundingSphere();
    scene.add(mesh);
    meshes[kind] = mesh;
  }
  const trim = ['frame','brass','accent'];
  let lowTrim;
  if (lowTrimMaterial) {
    const count = trim.reduce((total,kind) => total + batches[kind].matrices.length, 0);
    const surfaces = new T.InstancedBufferAttribute(new Float32Array(count*2),2);
    const lowGeometry = geometry.clone().setAttribute('instanceSurface',surfaces);
    lowTrim = new T.InstancedMesh(lowGeometry,lowTrimMaterial,count);
    lowTrim.name = 'Expanded storefront trim';
    lowTrim.receiveShadow = true;
    lowTrim.visible = false;
    lowTrim.instanceMatrix.setUsage(T.DynamicDrawUsage);
    const color = new T.Color();
    let offset = 0;
    for (const kind of trim) {
      const {matrices, material, colours} = batches[kind];
      batches[kind].lowOffset = offset;
      matrices.forEach((matrix,index) => {
        const target = offset + index;
        lowTrim.setMatrixAt(target,matrix);
        lowTrim.setColorAt(target,colours ? color.set(colours[index]) : material.color);
        surfaces.setXY(target,material.roughness,material.metalness);
      });
      offset += matrices.length;
    }
    lowTrim.computeBoundingSphere();
    scene.add(lowTrim);
  }
  const moved = new T.Matrix4();
  function slide(number, travel) {
    for(const {kind,index,dx,dz} of slidingParts.get(number)) {
      moved.copy(batches[kind].matrices[index]);
      moved.elements[12]+=dx*travel; moved.elements[14]+=dz*travel;
      meshes[kind].setMatrixAt(index,moved); meshes[kind].instanceMatrix.needsUpdate=true;
      const offset = batches[kind].lowOffset;
      if (offset !== undefined) {
        lowTrim.setMatrixAt(offset+index,moved);
        lowTrim.instanceMatrix.needsUpdate = true;
      }
    }
  }
  slide.setTier = tier => {
    const low = tier === 'low';
    if (!lowTrim || lowTrim.visible === low) return;
    lowTrim.visible = low;
    for (const kind of trim) meshes[kind].visible = !low;
  };
  return slide;
}
