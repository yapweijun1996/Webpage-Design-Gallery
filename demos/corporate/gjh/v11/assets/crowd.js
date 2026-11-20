import * as T from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {disposeVisitorScene} from './visitor-gltf.js';
import {fitCrowdPart, retargetCrowdClips, skinnedParts} from './crowd-rig.js';

const MANIFEST = new URL('./chibi-crowd/manifest.json', import.meta.url);
const SLOTS = ['body', 'hair', 'top', 'bottom', 'shoes'];
const FILE_LIMIT = 1536 * 1024, LOAD_LIMIT = 6 * 1024 * 1024;
const TRIANGLE_LIMIT = {body:10000, hair:3000, top:6000, bottom:6000, shoes:3500};
const PALETTES = [
  ['#fff1e0', '#ddad96', '#c4e1dd', '#a5b7df', '#f2e7d6'],
  ['#e8f0ff', '#b9a6c9', '#ebc5a0', '#bed0bd', '#d4c3be'],
  ['#fff0ec', '#efc2a2', '#b9caec', '#c8abc2', '#d6ddf2'],
  ['#edf7e9', '#c19c89', '#ebd7a4', '#c2d4ea', '#e8dad0'],
  ['#f2edff', '#dbc8bf', '#bcdecb', '#d3ab96', '#d9dcdc'],
];

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function validateManifest(data, compact = false) {
  if (data?.version !== 1 || !Number.isInteger(data.seed) || !Array.isArray(data.modules))
    throw new Error('Invalid crowd manifest');
  const entries = data.modules.filter(item => item?.status === 'verified').map(entry =>
    compact && entry.slot === 'body' && entry.compact
      ? {...entry, file:entry.compact.file, bytes:entry.compact.bytes, sha256:entry.compact.sha256} : entry);
  const motion = data.animation?.motion, gestures = data.animation?.gestures;
  const ids = new Set(), files = new Set();
  if (!entries.some(item => item.slot === 'body') || entries.some(item => !SLOTS.includes(item.slot)))
    throw new Error('Invalid crowd slots');
  const bodies = new Set(entries.filter(item => item.slot === 'body').map(item => item.id));
  for (const entry of [...entries, motion, gestures]) {
    if (entry?.status !== 'verified' || typeof entry.id !== 'string' || !/^[a-z0-9-]+$/.test(entry.id) ||
        typeof entry.file !== 'string' || !/^[a-z0-9_-]+\.glb$/.test(entry.file) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > FILE_LIMIT ||
        ids.has(entry.id) || files.has(entry.file) || (entry.bodyIds !== undefined &&
        (entry.slot === 'body' || !Array.isArray(entry.bodyIds) || !entry.bodyIds.length ||
        entry.bodyIds.some(id => !bodies.has(id)))) || (entry.excludesSlots !== undefined &&
        (!Array.isArray(entry.excludesSlots) || entry.excludesSlots.some(slot => SLOTS.indexOf(slot) <= SLOTS.indexOf(entry.slot)))))
      throw new Error('Invalid crowd asset receipt');
    ids.add(entry.id); files.add(entry.file);
  }
  if ([...entries, motion, gestures].reduce((total, entry) => total + entry.bytes, 0) > LOAD_LIMIT)
    throw new Error('Modular NPC assets exceed the resident file budget');
  return {seed:data.seed, entries, motion, gestures};
}

function outfitFor(entries, random) {
  const outfit = {};
  for (const slot of SLOTS) {
    if (Object.values(outfit).some(item => item.excludesSlots?.includes(slot))) continue;
    const choices = entries.filter(item => item.slot === slot && (!item.bodyIds || item.bodyIds.includes(outfit.body?.id)));
    if (choices.length) outfit[slot] = choices[Math.floor(random() * choices.length)];
  }
  return outfit;
}

async function loadAsset(loader, entry, signal) {
  const response = await fetch(new URL(entry.file, MANIFEST), {signal, redirect:'error'});
  if (!response.ok) throw new Error('Crowd asset is unavailable');
  const data = await response.arrayBuffer();
  if (data.byteLength !== entry.bytes) throw new Error('Crowd asset size changed');
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== entry.sha256) throw new Error('Crowd asset checksum changed');
  }
  const view = new DataView(data);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== data.byteLength || view.getUint32(16, true) !== 0x4e4f534a)
    throw new Error('Invalid crowd GLB header');
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, view.getUint32(12, true))));
  if ([...(gltf.buffers || []), ...(gltf.images || [])].some(item => item.uri !== undefined))
    throw new Error('Crowd GLB contains a resource URI');
  signal.throwIfAborted();
  const asset = await loader.parseAsync(data, '');
  if (signal.aborted) { disposeVisitorScene(asset.scene); signal.throwIfAborted(); }
  return asset;
}

function assetParts(scene, slot) {
  const parts = skinnedParts(scene);
  const triangles = parts.reduce((total, mesh) => total +
    (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
  if (!Number.isInteger(triangles) || triangles <= 0 || triangles > TRIANGLE_LIMIT[slot])
    throw new Error('Modular NPC module exceeds its triangle budget');
  return {parts, triangles};
}

function describeBody(parts, motion, gestures) {
  const skeleton = parts[0].skeleton, bounds = new T.Box3(), partBounds = new T.Box3();
  if (parts.some(part => part.skeleton !== skeleton))
    throw new Error('A modular NPC body must share one skin');
  for (const part of parts) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    bounds.union(partBounds.copy(part.geometry.boundingBox).applyMatrix4(part.matrixWorld));
  }
  const height = bounds.max.y - bounds.min.y;
  if (!(height > .5 && height < 3)) throw new Error('Invalid modular NPC body height');
  return {skeleton, height, ground:bounds.min.y, clips:retargetCrowdClips(motion, skeleton.bones, gestures)};
}

// This library owns immutable source buffers. Only skeletons and tinted materials
// are per visitor. It has no scene, simulation, visibility or admission of its own.
export async function loadModularLooks(signal, {requireClothing = true, compact = false} = {}) {
  const controller = new AbortController(), abort = () => controller.abort();
  const timer = setTimeout(abort, 8000);
  signal.addEventListener('abort', abort, {once:true});
  if (signal.aborted) abort();
  const owned = [], remapped = new Set();
  function dispose() {
    for (const geometry of remapped) geometry.dispose();
    for (const source of owned) disposeVisitorScene(source.scene);
  }
  try {
    const response = await fetch(MANIFEST, {signal:controller.signal, redirect:'error'});
    if (!response.ok) throw new Error('Modular NPC manifest unavailable');
    const {seed, entries, motion, gestures} = validateManifest(await response.json(), compact);
    // The bare body wears only shorts. Without a verified top the crowd must keep the clothed legacy visitors.
    if (requireClothing && !entries.some(entry => entry.slot === 'top')) throw new Error('Modular NPC wardrobe has no clothing');
    const loader = new GLTFLoader();
    async function read(entry) {
      const model = await loadAsset(loader, entry, controller.signal);
      owned.push(model);
      return model;
    }
    const motionSource = await read(motion), gestureSource = await read(gestures);
    const modules = new Map();
    for (const entry of entries) {
      const source = await read(entry);
      const {parts, triangles} = assetParts(source.scene, entry.slot);
      modules.set(entry.id, {source, parts, triangles,
        body:entry.slot === 'body' ? describeBody(parts, motionSource, gestureSource) : null,
        fit:new Map()});
    }
    controller.signal.throwIfAborted();
    function createLook(serial, cloneNpcRig) {
      const random = rng(seed ^ Math.imul(serial + 1, 0x9e3779b1));
      const outfit = outfitFor(entries, random);
      const bodyEntry = modules.get(outfit.body.id);
      const {height, ground, clips} = bodyEntry.body;
      const attachments = [];
      let triangles = bodyEntry.triangles, calls = bodyEntry.parts.length;
      for (const slot of SLOTS.slice(1)) {
        if (!outfit[slot]) continue;
        const module = modules.get(outfit[slot].id);
        triangles += module.triangles;
        calls += module.parts.length;
        if (triangles > 20000 || calls > 12) throw new Error('Modular NPC outfit exceeds its render budget');
        if (!module.fit.has(outfit.body.id)) {
          const fitted = module.parts.map(part => {
            const mesh = fitCrowdPart(part, bodyEntry.body.skeleton);
            if (mesh.geometry !== part.geometry) remapped.add(mesh.geometry);
            return mesh;
          });
          module.fit.set(outfit.body.id, fitted);
        }
        attachments.push([slot, module.fit.get(outfit.body.id)]);
      }
      const tint = PALETTES[Math.floor(random() * PALETTES.length)];
      const variation = .95 + random() * .1;
      const avatar = cloneNpcRig(bodyEntry.source.scene);
      const skeleton = avatar.getObjectByName(bodyEntry.parts[0].name).skeleton;
      const materials = [];
      function style(mesh, slot) {
        mesh.material = mesh.material.clone();
        mesh.material.color.multiply(new T.Color(tint[SLOTS.indexOf(slot)]));
        materials.push(mesh.material);
        // Rest bounds miss arm movement during greetings. Reuse a conservative
        // local-space sphere without running a per-vertex CPU bounds pass.
        mesh.boundingSphere = new T.Sphere(new T.Vector3(0, height / 2, 0), height * 1.5);
      }
      avatar.traverse(node => { if (node.isSkinnedMesh) style(node, 'body'); });
      for (const [slot, parts] of attachments) {
        for (const part of parts) {
          const mesh = part.clone(false);
          avatar.add(mesh);
          mesh.bind(skeleton, part.bindMatrix);
          style(mesh, slot);
        }
      }
      const scale = 1.55 / height * variation;
      return {avatar, clips, materials, scale, groundOffset:-ground * scale, triangles,
        appearance:Object.fromEntries(Object.entries(outfit).map(([slot, entry]) => [slot, entry.id])),
        tint, variation, greeting:random() < .5 ? 'wave' : 'nod'};
    }
    return {createLook, dispose};
  } catch (error) {
    dispose();
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
