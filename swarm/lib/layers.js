'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LAYERS = Object.freeze(['layout', 'type', 'color', 'imagery', 'icons', 'motion', 'polish']);
const SECTION_BASE = String.raw`\d{2}-[\w-]+`;
const BASE_PATTERN = new RegExp(`^${SECTION_BASE}$`);
const FILE_PATTERN = new RegExp(`^(${SECTION_BASE})\\.(html|css|([a-z]+)\\.css)$`);

function requireBase(base) {
  if (typeof base !== 'string' || !BASE_PATTERN.test(base)) throw new Error(`Invalid section base: ${String(base)}`);
}

function layerFile(sectionBase, layer) {
  requireBase(sectionBase);
  if (!LAYERS.includes(layer)) throw new Error(`Unknown layer: ${String(layer)}`);
  return `${sectionBase}.${layer}.css`;
}

function parseSectionFile(name) {
  const match = typeof name === 'string' && FILE_PATTERN.exec(name);
  if (!match) return null;
  const [, base, suffix, layer] = match;
  if (layer) return LAYERS.includes(layer) ? { base, kind: 'layer', layer } : null;
  return { base, kind: suffix === 'html' ? 'html' : 'base' };
}

function optionalFile(read) {
  try {
    return read();
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) throw error;
  }
}

function cssTarget(root, file) {
  return optionalFile(() => {
    const target = fs.realpathSync(file);
    const relative = path.relative(root, target);
    if (relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`)
      && fs.statSync(target).isFile()) return target;
  });
}

function listLayers(sectionsDir, base) {
  requireBase(base);
  const root = optionalFile(() => fs.realpathSync(sectionsDir));
  if (!root) return [];
  return LAYERS.flatMap(layer => {
    const file = path.join(sectionsDir, layerFile(base, layer));
    return cssTarget(root, file) ? [{ layer, file }] : [];
  });
}

function assembleCss(sectionsDir, base) {
  requireBase(base);
  const root = optionalFile(() => fs.realpathSync(sectionsDir));
  if (!root) return '';
  function read(name) {
    const target = cssTarget(root, path.join(root, name));
    if (target) return optionalFile(() => fs.readFileSync(target, 'utf8'));
  }

  const parts = [read(`${base}.css`) ?? ''].filter(Boolean);
  for (const layer of LAYERS) {
    const source = read(layerFile(base, layer));
    if (source !== undefined) parts.push(`/* layer: ${layer} */\n${source}`);
  }
  return parts.join('\n');
}

module.exports = { LAYERS, layerFile, parseSectionFile, listLayers, assembleCss };
