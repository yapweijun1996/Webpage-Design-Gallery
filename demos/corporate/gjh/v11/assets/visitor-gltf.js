import {fetchStartupAsset} from './startup-asset-pack.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

export function disposeVisitorScene(scene) {
  const resources = new Set();
  scene.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    if (node.skeleton) resources.add(node.skeleton);
    if (!node.material) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources) {
    resource.dispose();
    if (resource.isTexture) resource.source.data?.close?.();
  }
}

export async function loadVisitorGLTF(url) {
  const controller = new AbortController();
  let timer, abandoned = false;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      abandoned = true;
      controller.abort();
      reject(new Error('Visitor model timed out'));
    }, 8000);
  });
  try {
    const load = async () => {
      const response = await fetchStartupAsset(url, {signal: controller.signal});
      if (!response.ok) throw new Error('Visitor model unavailable');
      const buffer = await response.arrayBuffer();
      const gltf = await new GLTFLoader().parseAsync(buffer, new URL('.', url).href);
      if (abandoned) disposeVisitorScene(gltf.scene);
      return gltf;
    };
    return await Promise.race([load(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
