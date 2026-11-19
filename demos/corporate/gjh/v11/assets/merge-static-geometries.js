// The batch owns one material. Incompatible meshes keep their original draws.
export function mergeStaticGeometries(T, geometries) {
  const first = geometries[0];
  if (!first?.attributes.position) return null;

  const attributes = Object.entries(first.attributes);
  const indexed = first.index !== null;
  let vertices = 0, indexCount = 0;
  for (const {attributes: source, index, morphAttributes} of geometries) {
    if ((index !== null) !== indexed || Object.keys(source).length !== attributes.length ||
        Object.keys(morphAttributes).length || !source.position) return null;
    vertices += source.position.count;
    indexCount += index?.count ?? 0;
  }

  const result = new T.BufferGeometry();
  for (const [name, layout] of attributes) {
    const {itemSize, normalized, gpuType = T.FloatType} = layout;
    const ArrayType = layout.array.constructor;
    const array = new ArrayType(vertices * itemSize);
    let offset = 0;
    for (const {attributes: source} of geometries) {
      const attribute = source[name];
      if (!attribute || attribute.array.constructor !== ArrayType || attribute.itemSize !== itemSize ||
          attribute.normalized !== normalized || (attribute.gpuType ?? T.FloatType) !== gpuType ||
          attribute.count !== source.position.count || attribute.isFloat16BufferAttribute !== layout.isFloat16BufferAttribute) return null;
      if (attribute.isInterleavedBufferAttribute) {
        const {stride} = attribute.data;
        for (let vertex = 0; vertex < attribute.count; vertex++) {
          const start = vertex * stride + attribute.offset;
          array.set(attribute.array.subarray(start, start + itemSize), offset + vertex * itemSize);
        }
      } else {
        array.set(attribute.array, offset);
      }
      offset += attribute.count * itemSize;
    }
    const Attribute = layout.isFloat16BufferAttribute ? T.Float16BufferAttribute : T.BufferAttribute;
    const attribute = new Attribute(array, itemSize, normalized);
    attribute.gpuType = gpuType;
    result.setAttribute(name, attribute);
  }

  if (indexed) {
    // The largest Uint16 value is reserved for primitive restart.
    const IndexArray = vertices > 65535 ? Uint32Array : Uint16Array;
    const array = new IndexArray(indexCount);
    let offset = 0, vertexOffset = 0;
    for (const {attributes, index} of geometries) {
      for (let i = 0; i < index.count; i++) array[offset++] = index.array[i] + vertexOffset;
      vertexOffset += attributes.position.count;
    }
    result.setIndex(new T.BufferAttribute(array, 1));
  }
  return result;
}
