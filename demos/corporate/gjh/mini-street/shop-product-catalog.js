// Reuse the v11 LOD1 models and packshots. Provenance and packaging limitations
// are recorded in v11/assets/newmoon-demo-source.json and the model metadata.
const dimensions = Object.freeze([0.07750000059604645, 0.12399169057607651, 0.07750000059604645]);

function createProduct({id, title, origin, size, modelSha256}) {
  return Object.freeze({
    id,
    name: `New Moon ${origin} Abalone`,
    title,
    origin,
    size,
    photo: new URL(`../v11/assets/new-moon-${id}-front.webp`, import.meta.url).href,
    modelUrl: new URL(`../v11/assets/new-moon-can-${id}-lod1.glb`, import.meta.url).href,
    modelSha256,
    dimensions,
    frontYaw: 0,
  });
}

export const NEW_MOON_PRODUCTS = Object.freeze([
  createProduct({
    id: "au-425g",
    title: "Australian abalone",
    origin: "Australia",
    size: "425 g",
    modelSha256: "d1ae9ff1b35a65c6bb4cafb4a70ff3dd746bf3f70c8ffdac3f93546478feacde",
  }),
  createProduct({
    id: "nz-425g",
    title: "New Zealand abalone",
    origin: "New Zealand",
    size: "425 g",
    modelSha256: "fcb92b1c62e10338a3295cb56006365da747ad7f25d6b6bec0964d600b742cdb",
  }),
  createProduct({
    id: "sa-425g",
    title: "South African abalone",
    origin: "South Africa",
    size: "425 g",
    modelSha256: "7728989f5e4c695c7b4765d219501349898ca1e72f0630bde13c66fc9811e0b5",
  }),
  createProduct({
    id: "mx-454g",
    title: "Mexican abalone",
    origin: "Mexico",
    size: "454 g",
    modelSha256: "52f8952ca698cc77c6aaf8f1ef5c607a31c401817e6bf6741426e17510164acb",
  }),
]);

export const NEW_MOON_DEFAULT_PRODUCT = NEW_MOON_PRODUCTS[0];

export function getNewMoonProduct(id) {
  return NEW_MOON_PRODUCTS.find(product => product.id === id);
}
