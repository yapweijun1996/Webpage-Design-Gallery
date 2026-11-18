// Draw the live forearm and hand while the eye camera hides the full skin.
// The subset uses the same vertex attributes, material and animated skeleton.
export function createFirstPersonHand(T, visual, skin, wrist) {
  let arm;
  function build() {
    const bones = new Set();
    wrist.parent.traverse(bone => bones.add(bone));
    const {geometry, skeleton} = skin;
    const {skinIndex, skinWeight} = geometry.attributes;
    const selected = new Uint8Array(skinIndex.count);
    for (let i = 0; i < selected.length; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) {
        if (bones.has(skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
      }
      selected[i] = weight >= .5;
    }
    const indices = [], source = geometry.index;
    for (let i = 0; i < (source?.count ?? selected.length); i += 3) {
      const a = source ? source.getX(i) : i;
      const b = source ? source.getX(i+1) : i+1;
      const c = source ? source.getX(i+2) : i+2;
      if (selected[a] && selected[b] && selected[c]) indices.push(a, b, c);
    }
    const subset = new T.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) subset.setAttribute(name, attribute);
    subset.setIndex(indices);
    arm = new T.SkinnedMesh(subset, skin.material);
    arm.name = 'FirstPersonCarryHand';
    arm.bind(skeleton, skin.bindMatrix);
    arm.frustumCulled = false;
    visual.add(arm);
  }
  return visible => {
    if (visible && !arm) build();
    if (arm) arm.visible = visible;
  };
}
