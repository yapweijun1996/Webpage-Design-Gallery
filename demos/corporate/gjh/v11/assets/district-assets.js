// Integrity belongs to the layer manifest. Both street and food-court requests can be cancelled independently.
export async function districtManifest(read, base, signal) {
  const response = await read(new URL('sources.json', base), {signal});
  if (response.status !== 200) throw new Error('District manifest unavailable');
  return (await response.json()).assets;
}

export async function districtModel(loader, read, base, manifest, id, signal) {
  signal.throwIfAborted();
  const receipt = manifest.find(item => item.file === id + '.glb');
  if (!receipt) throw new Error('Missing district model receipt: ' + id);
  const response = await read(new URL(receipt.file, base), {signal});
  if (response.status !== 200) throw new Error('District model unavailable: ' + id);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== receipt.bytes) throw new Error('Incomplete district model: ' + id);
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    if (Array.from(digest, value => value.toString(16).padStart(2,'0')).join('') !== receipt.sha256)
      throw new Error('District model changed: ' + id);
  }
  signal.throwIfAborted();
  return (await loader.parseAsync(bytes, base.href)).scene;
}

export function disposeDistrictSource(source) {
  const geometries = new Set(), materials = new Set();
  source.traverse(node => {
    if (node.isMesh) { geometries.add(node.geometry); materials.add(node.material); }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
