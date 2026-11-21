'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FIELD = /^[a-z][a-zA-Z0-9]*$/;
const TOKEN = /^--sds-color-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REFERENCE = /^\$[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/;
const SECTION_ID = /^(?:0[1-9]|[1-9][0-9])-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SCALARS = new Set(['text', 'link', 'image', 'dimension']);
const LOCAL_IMAGE = /^\/(?!\/)(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/;
const SDS_TOKENS = new Set(fs.readFileSync(path.join(ROOT, 'design-system', 'tokens.css'), 'utf8')
  .match(/--sds-color-[\w-]+(?=:)/g));
let cache;
let hits = 0;

function isRecord(value) {
  return value !== null && typeof value === 'object'
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function requireSchema(valid, label) {
  if (!valid) throw new TypeError(`Invalid fast path schema: ${label}`);
}

function stringList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.trim())
    && new Set(value).size === value.length;
}

function validateTokens(tokens, label) {
  requireSchema(isRecord(tokens) && Object.entries(tokens).every(([key, value]) =>
    SLUG.test(key) && typeof value === 'string' && TOKEN.test(value) && SDS_TOKENS.has(value)), label);
}

function safeLink(value) {
  if (/[\x00-\x20\x7f\\]/.test(value)) return false;
  if (/^#[a-zA-Z0-9][\w-]*$/.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateValue(value, schema, label) {
  if (isRecord(schema)) {
    requireSchema(Array.isArray(value) && value.length > 0 && value.length <= 24, label);
    value.forEach((row, index) => validateSlots(row, schema.items, `${label}[${index}]`));
    return;
  }
  const text = typeof value === 'string' && value.length <= 4096;
  const valid = schema === 'dimension' ? Number.isSafeInteger(value) && value > 0 && value <= 10000
    : text && (schema === 'text' || (schema === 'link' && safeLink(value))
      || (schema === 'image' && LOCAL_IMAGE.test(value)));
  requireSchema(valid, label);
}

function validateSlots(slots, definitions, label) {
  requireSchema(isRecord(slots) && Object.keys(slots).length === Object.keys(definitions).length, label);
  for (const [key, schema] of Object.entries(definitions)) {
    requireSchema(Object.hasOwn(slots, key), `${label}.${key}`);
    validateValue(slots[key], schema, `${label}.${key}`);
  }
}

function resolveSlots(section, brand) {
  return Object.fromEntries(Object.entries(section.slots).map(([name, binding]) => {
    if (typeof binding !== 'string' || !REFERENCE.test(binding)) return [name, binding];
    const value = binding.slice(1).split('.').reduce((node, key) =>
      isRecord(node) && Object.hasOwn(node, key) ? node[key] : undefined, brand.content);
    return [name, value];
  }));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot load fast path data from ${file}: ${error.message}`, { cause: error });
  }
}

function loadJsonDirectory(directory) {
  const root = path.join(ROOT, directory);
  return Object.fromEntries(fs.readdirSync(root, { withFileTypes: true })
    .filter(file => file.isFile() && file.name.endsWith('.json'))
    .map(file => file.name).sort().map(name => {
      const id = path.basename(name, '.json');
      const data = readJson(path.join(root, name));
      requireSchema(SLUG.test(id) && isRecord(data) && data.id === id, `${directory}/${name}`);
      return [id, data];
    }));
}

function loadBlocks() {
  const root = path.join(ROOT, 'blocks');
  return Object.fromEntries(fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort().map(id => {
      const dir = path.join(root, id);
      const block = readJson(path.join(dir, 'block.json'));
      requireSchema(SLUG.test(id) && isRecord(block) && block.id === id, `block ${id}`);
      requireSchema(isRecord(block.slots) && Object.entries(block.slots).every(([name, type]) =>
        FIELD.test(name) && !['id', 'index', 'scope'].includes(name) && (SCALARS.has(type) || (isRecord(type)
          && isRecord(type.items) && Object.keys(type.items).length > 0 && Object.entries(type.items)
            .every(([field, scalar]) => FIELD.test(field) && field !== 'index' && SCALARS.has(scalar))))), `block ${id} slots`);
      requireSchema(stringList(block.tokens) && block.tokens.every(name => SLUG.test(name)), `block ${id} tokens`);
      const html = fs.readFileSync(path.join(dir, 'block.html'), 'utf8');
      const css = fs.readFileSync(path.join(dir, 'block.css'), 'utf8');
      requireSchema(html.trim() && css.trim(), `block ${id} templates`);
      return [id, { ...block, html, css }];
    }));
}

function validateCatalog(recipes, blocks, brands) {
  for (const brand of Object.values(brands)) {
    requireSchema(typeof brand.name === 'string' && brand.name.trim()
      && stringList(brand.aliases) && isRecord(brand.content), `brand ${brand.id}`);
    validateTokens(brand.tokens, `brand ${brand.id} tokens`);
  }

  for (const recipe of Object.values(recipes)) {
    requireSchema(stringList(recipe.keywords) && stringList(recipe.brands) && recipe.brands.includes(recipe.defaultBrand)
      && recipe.brands.every(id => Object.hasOwn(brands, id)), `recipe ${recipe.id} routing`);
    requireSchema(Array.isArray(recipe.sections) && recipe.sections.length > 0 && recipe.sections.length < 100,
      `recipe ${recipe.id} sections`);

    for (const [index, section] of recipe.sections.entries()) {
      const label = `recipe ${recipe.id} section ${index + 1}`;
      requireSchema(isRecord(section) && typeof section.id === 'string' && SECTION_ID.test(section.id)
        && Number(section.id.slice(0, 2)) === index + 1 && Object.hasOwn(blocks, section.block)
        && isRecord(section.slots), label);
      const block = blocks[section.block];
      for (const id of recipe.brands) {
        const brand = brands[id];
        requireSchema(block.tokens.every(name => Object.hasOwn(brand.tokens, name)), `${label} ${id} tokens`);
        validateSlots(resolveSlots(section, brand), block.slots, `${label} ${id} slots`);
      }
    }
  }
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function loadAll({ cold = false } = {}) {
  if (cold) clearCache();
  if (cache) {
    hits += 1;
    return cache;
  }

  const recipes = loadJsonDirectory('recipes');
  const blocks = loadBlocks();
  const brands = loadJsonDirectory('brands');
  validateCatalog(recipes, blocks, brands);
  cache = Object.freeze({ recipes: freeze(recipes), blocks: freeze(blocks), brands: freeze(brands), get hits() { return hits; } });
  return cache;
}

function clearCache() {
  cache = undefined;
  hits = 0;
}

module.exports = { loadAll, clearCache, resolveSlots, validateSlots, validateTokens, isRecord };
