'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { validate } = require('./contract');
const { loadAll, resolveSlots, validateSlots, validateTokens, isRecord } = require('./recipes');
const { parseSectionFile } = require('./layers');

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const PLACEHOLDER = /\{\{([a-zA-Z][\w.-]*)\}\}/g;
const EACH = /\{\{#([a-zA-Z][\w]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ENTITIES[character]);
}

function renderFields(template, fields, map) {
  return template.replace(PLACEHOLDER, (_, key) => {
    if (!Object.hasOwn(fields, key) || !['string', 'number'].includes(typeof fields[key])) {
      throw new Error(`Unknown template field: ${key}`);
    }
    return map(fields[key]);
  });
}

function renderHtml(template, fields) {
  // Compile the source first so placeholder-shaped slot text stays literal.
  let output = '';
  let offset = 0;
  for (const match of template.matchAll(EACH)) {
    const [source, key, body] = match;
    const start = match.index;
    output += renderFields(template.slice(offset, start), fields, escapeHtml);
    if (!Object.hasOwn(fields, key) || !Array.isArray(fields[key])) {
      throw new Error(`Unknown template list: ${key}`);
    }
    output += fields[key].map((item, index) =>
      renderFields(body, { ...fields, ...item, index: index + 1 }, escapeHtml)).join('');
    offset = start + source.length;
  }
  return output + renderFields(template.slice(offset), fields, escapeHtml);
}

function catalogEntry(entries, choice, label) {
  const id = isRecord(choice) ? choice.id : choice;
  if (typeof id !== 'string' || !Object.hasOwn(entries, id)) throw new TypeError(`Unknown ${label}: ${id}`);
  return entries[id];
}

function ordered(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));
}

function requireDirectory(dir) {
  const stats = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stats) fs.mkdirSync(dir);
  else if (!stats.isDirectory()) throw new Error(`Expected a real output directory at ${dir}`);
}

function checkFile(file) {
  const stats = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stats && !stats.isFile()) throw new Error(`Expected a regular output file at ${file}`);
}

function writeOutput(root, output) {
  const sections = path.join(root, 'sections');
  requireDirectory(root);
  requireDirectory(sections);
  for (const file of output.keys()) checkFile(path.join(root, file));

  const stale = fs.readdirSync(sections).filter(name =>
    (parseSectionFile(name) || /^\d{2}-.+\.html$/.test(name)) && !output.has(`sections/${name}`));
  for (const name of stale) checkFile(path.join(sections, name));

  // Replacing files by rename leaves any external hard links to the old files intact.
  const stage = fs.mkdtempSync(path.join(sections, '.compose-'));
  try {
    for (const [file, content] of output) fs.writeFileSync(path.join(stage, path.basename(file)), content);
    for (const file of output.keys()) fs.renameSync(path.join(stage, path.basename(file)), path.join(root, file));
    for (const name of stale) fs.unlinkSync(path.join(sections, name));
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

function compose({ recipe: recipeChoice, brand: brandChoice, overrides = {}, outDir }) {
  const start = performance.now();
  if (typeof outDir !== 'string' || !outDir.trim()) throw new TypeError('An output directory is required.');
  if (!isRecord(overrides) || Object.keys(overrides).some(key => !['sections', 'tokens'].includes(key))) {
    throw new TypeError('Expected overrides with sections and/or tokens.');
  }
  const { recipes, blocks, brands } = loadAll();
  const recipe = catalogEntry(recipes, recipeChoice, 'recipe');
  const brand = catalogEntry(brands, brandChoice ?? recipe.defaultBrand, 'brand');
  if (!recipe.brands.includes(brand.id)) throw new TypeError(`Brand ${brand.id} does not support ${recipe.id}`);

  const { sections: sectionOverrides = {}, tokens: tokenOverrides = {} } = overrides;
  if (!isRecord(sectionOverrides) || Object.keys(sectionOverrides).some(id => !recipe.sections.some(section => section.id === id))) {
    throw new TypeError('Section overrides must use section IDs from the recipe.');
  }
  validateTokens(tokenOverrides, 'token overrides');
  if (Object.keys(tokenOverrides).some(name => !Object.hasOwn(brand.tokens, name))) {
    throw new TypeError('Token overrides must use token roles from the brand kit.');
  }
  const tokens = ordered({ ...brand.tokens, ...tokenOverrides });
  const contract = { version: 1, recipe: recipe.id, brand: brand.id, tokens, sections: [], owners: {} };

  const output = new Map();
  for (const section of recipe.sections) {
    const { id } = section;
    const block = blocks[section.block];
    const changes = Object.hasOwn(sectionOverrides, id) ? sectionOverrides[id] : {};
    if (!isRecord(changes)) throw new TypeError(`Expected slot overrides for ${id}`);
    const values = { ...resolveSlots(section, brand), ...changes };
    validateSlots(values, block.slots, `${id} slots`);
    const slots = Object.fromEntries(Object.keys(block.slots).map(key => {
      const value = values[key];
      return [key, Array.isArray(value) ? value.map(ordered) : value];
    }));
    const scope = `s-${id.slice(0, 2)}`;
    const tokenFields = Object.fromEntries(block.tokens.map(role => [`token.${role}`, `var(${tokens[role]})`]));
    output.set(`sections/${id}.html`, renderHtml(block.html, { ...slots, id, scope }));
    output.set(`sections/${id}.css`, renderFields(block.css, { ...tokenFields, scope }, value => value));
    contract.sections.push({ id, block: block.id, slots });
  }
  const validation = validate(contract);
  if (!validation.ok) throw new TypeError(validation.errors.map(error => error.message).join(', '));
  output.set('contract.json', JSON.stringify(contract, null, 2) + '\n');
  const rendered = performance.now();
  writeOutput(path.resolve(outDir), output);
  const finished = performance.now();
  return { files: [...output.keys()], contract, timings: { render: rendered - start, write: finished - rendered, total: finished - start } };
}

module.exports = { compose };
