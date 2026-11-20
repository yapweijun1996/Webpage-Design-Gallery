// This rig has modeled eyes, catchlights, brows, nose and a separate smile,
// but no UVs. Colour the shared NPC template once, before its sliced upload.
export function paintVisitorFace(T, root, compact, ownedGeometry, ownedMaterials) {
  const chestnut = new T.Color('#955031'), amber = new T.Color('#ecad64');
  const pupil = new T.Color('#20151b'), blush = new T.Color('#e39785');
  const brow = new T.Color('#673e30'), lip = new T.Color('#eb8e84');
  const ink = new T.Color(), position = new T.Vector3();

  root.traverse(node => {
    if (!node.isSkinnedMesh) return;
    const eyes = node.name === 'V2_body_Glasses_and_eyes';
    const mouth = node.name === 'V2_body_Warm_smile';
    const body = compact.geometries.includes(node.geometry);
    if (!eyes && !mouth && !body) return;
    if (!body) {
      node.geometry = node.geometry.clone();
      node.material = node.material.clone();
      ownedGeometry.push(node.geometry);
      ownedMaterials.push(node.material);
    }
    const geom = node.geometry, attr = geom.attributes.position;
    const colors = body ? geom.attributes.color : new T.Float32BufferAttribute(new Float32Array(attr.count*3), 3);
    for (let i=0; i<attr.count; i++) {
      position.fromBufferAttribute(attr,i);
      const {x,y,z} = position;
      if (body) {
        if (y<1.26 || y>1.51 || z<.1) continue;
        ink.fromBufferAttribute(colors,i);
        if (ink.r>.8 && ink.g<.65) {
          const cheek = Math.hypot((Math.abs(x)-.14)/.064,(y-1.318)/.04);
          const nose = Math.hypot(x/.026,(y-1.332)/.028);
          ink.lerp(blush,.65*Math.max(0,1-Math.min(cheek,nose)));
        } else if (ink.r<.06 && y>1.473 && z>.143 && Math.abs(x)<.156) {
          ink.lerp(brow,Math.min(1,(y-1.473)/.035));
        }
      } else if (mouth) {
        ink.copy(node.material.color).lerp(lip,Math.max(0,Math.min(1,(1.255-y)/.024)));
      } else {
        ink.copy(node.material.color);
        const dx = (Math.abs(x)-.0965)/.0325, dy = (y-1.3845)/.0485;
        const radius = Math.hypot(dx,dy);
        if (z>.158 && radius<.98) {
          ink.copy(chestnut).lerp(amber,Math.max(0,-dy));
          if (radius<.54 || dy>.65) ink.copy(pupil);
        }
      }
      colors.setXYZ(i,ink.r,ink.g,ink.b);
    }
    if (!body) {
      geom.setAttribute('color',colors);
      node.material.color.setRGB(1,1,1);
      node.material.vertexColors = true;
    }
  });
}
