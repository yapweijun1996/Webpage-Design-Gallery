export const decalClearance = .003;
export const floorFinishOffset = .006;
export const floorInlayOffset = .006;

export function decalHeight(surface, offset = decalClearance) {
  return surface + offset;
}

export function decalMaterial(material, units = -2) {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = units;
  if (material.transparent) material.depthWrite = false;
  return material;
}

// Draw transparent surface effects before the room's glazing.
export function placeDecal(mesh, order = -2) {
  mesh.renderOrder = order;
  return mesh;
}
