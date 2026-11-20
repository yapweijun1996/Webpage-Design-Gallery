'use strict';

const fs = require('node:fs');
const path = require('node:path');

let layersPath;
try {
  layersPath = require.resolve('./layers');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
const LAYERS = layersPath ? require(layersPath).LAYERS
  : ['layout', 'type', 'color', 'imagery', 'icons', 'motion', 'polish'];

const ROSTER_FILE = path.join(__dirname, '..', 'squad', 'roster.json');
const SECTION_BASE = /^\d{2}-[\w-]+$/;
const REQUIRED_IDS = ['layout', 'qa'];
const MAX_SQUAD = 8;
const NON_LAYER_WRITES = new Map([
  ['image-gen', ['assets/generated/{base}-*.png']],
  ['copy', []],
  ['researcher', ['research.md']],
]);

const IMAGE_GENERATION = [
  /\b(?:image[- ]gen(?:eration|erator)?|text[- ]to[- ]image)\b/i,
  /\b(?:new|generate|create|replace|swap(?:\s+out)?)\s+(?:(?:an?|the|our|old|existing|new|custom|hero|background)\s+)*(?:images?|artwork|photos?|pictures?|illustrations?)\b/i,
];

// Pair new assets with their CSS treatment before filling the remaining specialist slots.
const KEYWORDS = [
  ['imagery', /\b(?:images?|imagery|photos?|photography|pictures?|illustrations?|artwork|crops?|cropping|overlays?|filters?)\b/i],
  ['researcher', /\b(?:research(?:er)?|fact[- ]check(?:ing)?|citations?|sources?|brand (?:facts?|guidelines?|history))\b/i],
  ['icons', /\b(?:icons?|svgs?|pictograms?|glyphs?)\b/i],
  ['color', /\b(?:colou?rs?|palettes?|themes?|contrast|gradients?|dark mode|light mode)\b/i],
  ['type', /\b(?:typography|type|typefaces?|fonts?|headings?|line[- ]height|letter[- ]spacing)\b/i],
  ['copy', /\b(?:copy(?:writing|writer)?|wording|rewrite|headlines?|taglines?|text|labels?|ctas?)\b/i],
  ['motion', /\b(?:motion|animat(?:e|ed|ion|ions)|transitions?|parallax|reveal)\b/i],
];
const SCOPE_KEYWORDS = [
  ['imagery', /\b(?:img|picture)\b/i],
  ['icons', /\bsvg\b/i],
  ['type', /\bh[1-6]\b/i],
];

const isText = value => typeof value === 'string' && value.trim().length > 0;

function checkedWrites({ id, layer, writes }) {
  let allowed;
  if (NON_LAYER_WRITES.has(id) && layer === null) {
    allowed = NON_LAYER_WRITES.get(id);
  } else {
    const expectedLayer = id === 'qa' ? 'polish' : id;
    if (id === 'polish' || layer !== expectedLayer || !LAYERS.includes(layer)) {
      throw new Error(`Invalid squad layer for ${id}: ${layer}.`);
    }
    allowed = [`sections/{base}.${layer}.css`];
    if (id === 'layout') allowed.unshift('sections/{base}.html');
  }
  if (!Array.isArray(writes) || writes.length !== allowed.length || !allowed.every(glob => writes.includes(glob))) {
    throw new Error(`Invalid squad writes for ${id}.`);
  }
  return writes;
}

function roster() {
  const specialists = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
  if (!Array.isArray(specialists)) throw new Error('Squad roster must be an array.');

  const ids = new Set();
  const layers = new Set();
  for (const [index, spec] of specialists.entries()) {
    if (typeof spec?.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id)) {
      throw new Error(`Invalid squad specialist ID at index ${index}.`);
    }
    const { id, title, layer, role, runner, mission } = spec;
    if (ids.has(id)) throw new Error(`Duplicate squad specialist ID: ${id}.`);
    if (!['codex', 'pi'].includes(runner)) throw new Error(`Invalid squad runner for ${id}: ${runner}.`);
    if (![title, role, mission].every(isText)) throw new Error(`Missing squad title, role, or mission for ${id}.`);
    if (layer !== null && layers.has(layer)) throw new Error(`Duplicate squad layer: ${layer}.`);
    checkedWrites(spec);
    ids.add(id);
    if (layer !== null) layers.add(layer);
  }
  if (!REQUIRED_IDS.every(id => ids.has(id))) throw new Error('Squad roster requires layout and qa.');
  return specialists;
}

function pickSquad(scope, request, specialists = roster()) {
  const byId = new Map(specialists.map(spec => [spec.id, spec]));
  if (!REQUIRED_IDS.every(id => byId.has(id))) throw new Error('Squad roster requires layout and qa.');

  const requestText = typeof request === 'string' ? request : request?.text ?? '';
  const elements = Array.isArray(scope?.elements) ? scope.elements : [];
  const scopeText = elements.map(element => `${element?.tag ?? ''} ${element?.path ?? ''}`).join(' ');
  const requested = KEYWORDS.filter(([, pattern]) => pattern.test(requestText)).map(([id]) => id);
  if (IMAGE_GENERATION.some(pattern => pattern.test(requestText))) requested.unshift('imagery', 'image-gen');
  const inferred = SCOPE_KEYWORDS.filter(([, pattern]) => pattern.test(scopeText)).map(([id]) => id);

  const ids = new Set([...REQUIRED_IDS, ...requested, ...inferred]);
  return [...ids].map(id => byId.get(id)).filter(Boolean).slice(0, MAX_SQUAD);
}

function waves(squad) {
  const research = [];
  const parallel = [];
  const layout = [];
  const qa = [];
  const byId = new Map([['researcher', research], ['layout', layout], ['qa', qa]]);
  for (const spec of squad) (byId.get(spec.id) ?? parallel).push(spec);
  return [research, parallel, layout, qa].filter(wave => wave.length > 0);
}

function ownedGlobs(spec, base) {
  if (typeof base !== 'string' || !SECTION_BASE.test(base)) throw new Error(`Invalid section base: ${base}.`);
  return checkedWrites(spec).map(glob => glob.replace('{base}', base));
}

function promptFor(spec, { base, scopeLine }) {
  const writes = ownedGlobs(spec, base);
  return [
    `You are the ${spec.title} for ${base}.`,
    spec.mission,
    writes.length ? `Write only to ${writes.join(', ')}.` : 'Send your proposals through chat. This role has no writable project files.',
    spec.layer && `Scope CSS selectors under .s-${base.slice(0, 2)} or #${base}.`,
    scopeLine,
  ].filter(Boolean).join('\n');
}

module.exports = { roster, pickSquad, waves, ownedGlobs, promptFor };
