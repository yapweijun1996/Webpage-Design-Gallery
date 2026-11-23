'use strict';

const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { isDeepStrictEqual } = require('node:util');
const { compose } = require('./composer');
const { validate } = require('./contract');
const { parseSectionFile } = require('./layers');
const { isRecord, loadAll, validateSlots, validateTokens } = require('./recipes');

const EXPORTER = path.join(__dirname, '../tools/export-page.js');
const CANVAS_TOKENS = path.join(__dirname, '../../design-canvas/tokens.css');
const ANCHOR_ID = /^v(?:00[1-9]|0[1-9]\d|[1-9]\d{2,})$/;
const GENERATED_IMAGE = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i;

class FastStageConflictError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}

function requireRealDirectory(dir) {
  const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stat?.isDirectory() || fs.realpathSync.native(dir) !== dir) throw new Error('Invalid Fast Path staging directory.');
}

function readRegularFile(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || fs.realpathSync.native(file) !== file) {
      throw new Error('Expected a regular Fast Path input file.');
    }
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}

function lockedInputs(project, { recipe, brand }, anchor) {
  let bytes;
  let contract;
  try {
    if (typeof anchor.id !== 'string' || !ANCHOR_ID.test(anchor.id)) throw new Error('Invalid anchor ID.');
    bytes = readRegularFile(path.join(project, 'anchors', anchor.id, 'contract.json'));
    if (createHash('sha256').update(bytes).digest('hex') !== anchor.contractHash) throw new Error('Changed anchor contract.');
    contract = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new FastStageConflictError('The locked design contract changed or could not be read.');
  }

  if (!isRecord(contract)) throw new FastStageConflictError('The locked design contract is invalid.');
  const { anchorId, anchorSha256, rules, ...base } = contract;
  if (anchorId !== anchor.id || !isRecord(anchorSha256) || !isRecord(rules) || !validate(base).ok) {
    throw new FastStageConflictError('The locked design contract is invalid.');
  }
  if (base.recipe !== recipe || base.brand !== brand) {
    throw new FastStageConflictError('The requested recipe or brand differs from the locked design contract.');
  }
  const { recipes, brands, blocks } = loadAll();
  if (!Object.hasOwn(recipes, recipe) || !recipes[recipe].brands.includes(brand)) {
    throw new FastStageConflictError('The locked recipe or brand is unavailable in Fast Path.');
  }
  const expected = recipes[recipe].sections;
  if (base.sections.length !== expected.length || expected.some((section, index) =>
    section.id !== base.sections[index].id || section.block !== base.sections[index].block)) {
    throw new FastStageConflictError('The locked section order or blocks differ from the Fast Path recipe.');
  }
  try {
    validateTokens(base.tokens, 'locked tokens');
    const roles = Object.keys(brands[brand].tokens);
    if (Object.keys(base.tokens).length !== roles.length || roles.some(role => !Object.hasOwn(base.tokens, role))) {
      throw new TypeError('Token roles differ from the brand kit.');
    }
    for (const section of base.sections) validateSlots(section.slots, blocks[section.block].slots, section.id);
  } catch {
    throw new FastStageConflictError('The locked slots or tokens cannot be rendered by this Fast Path recipe.');
  }

  const overrides = { tokens: base.tokens, sections: Object.fromEntries(base.sections.map(section => [section.id, section.slots])) };
  return { bytes, contract, overrides };
}

function copySectionSupport(project, stage, signal) {
  const sections = path.join(project, 'sections');
  if (!fs.lstatSync(sections, { throwIfNoEntry: false })) return [];
  requireRealDirectory(sections);
  const files = [];

  function copy(relative, isRoot) {
    const source = path.join(sections, relative);
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      signal?.throwIfAborted();
      if (isRoot && (parseSectionFile(entry.name) || /^\d{2}-.+\.html$/.test(entry.name))) continue;
      const name = path.join(relative, entry.name);
      const dest = path.join(stage, 'sections', name);
      if (entry.isDirectory()) {
        requireRealDirectory(path.join(sections, name));
        fs.mkdirSync(dest);
        copy(name, false);
      } else if (entry.isFile()) {
        fs.writeFileSync(dest, readRegularFile(path.join(sections, name)), { flag: 'wx' });
        files.push(path.posix.join('sections', ...name.split(path.sep)));
      } else throw new FastStageConflictError('A section support file could not be safely preserved.');
    }
  }

  copy('', true);
  return files;
}

function copyGeneratedAssets(project, stage, signal) {
  const source = path.join(project, 'assets', 'generated');
  const stat = fs.lstatSync(source, { throwIfNoEntry: false });
  if (!stat?.isDirectory() || fs.realpathSync.native(source) !== source) return;

  function copy(from, to) {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      signal?.throwIfAborted();
      const input = path.join(from, entry.name);
      const output = path.join(to, entry.name);
      if (entry.isDirectory() && fs.realpathSync.native(input) === input) copy(input, output);
      else if (entry.isFile() && GENERATED_IMAGE.test(entry.name) && fs.lstatSync(input).nlink === 1) {
        fs.mkdirSync(to, { recursive: true });
        fs.writeFileSync(output, readRegularFile(input), { flag: 'wx' });
      }
    }
  }

  copy(source, path.join(stage, 'assets', 'generated'));
}

function copyStyles(project, stage) {
  const file = path.join(project, 'tokens.css');
  const tokens = readRegularFile(fs.lstatSync(file, { throwIfNoEntry: false }) ? file : CANVAS_TOKENS);
  fs.writeFileSync(path.join(stage, 'tokens.css'), tokens, { flag: 'wx' });
}

function exportPreview(stage, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [EXPORTER, stage, '--no-pwa', '--sds', '--title', 'Live preview'], {
      signal, stdio: ['ignore', 'pipe', 'ignore'],
    });
    let failure;
    let summary = '';
    child.on('error', error => { failure = error; });
    child.stdout.setEncoding('utf8').on('data', chunk => { summary = (summary + chunk).slice(-65536); });
    // Wait for the cancelled process to close before the caller removes the stage.
    child.on('close', code => {
      if (signal?.aborted) reject(signal.reason);
      else if (failure) reject(failure);
      else if (code !== 0) reject(new Error('The Fast Path preview export failed.'));
      else resolve(summary);
    });
  });
}

async function stageFast({ projectDir, stage, selection, anchor = null, signal }) {
  signal?.throwIfAborted();
  const start = performance.now();
  const project = path.resolve(projectDir);
  const run = path.join(project, '.run');
  const output = path.resolve(stage);
  requireRealDirectory(run);
  requireRealDirectory(output);
  if (!output.startsWith(run + path.sep) || fs.readdirSync(output).length) {
    throw new Error('Fast Path requires a fresh staging directory inside the project runtime directory.');
  }

  const locked = anchor ? lockedInputs(project, selection, anchor) : null;
  const composeStart = performance.now();
  const composed = compose({ recipe: selection.recipe, brand: selection.brand, overrides: locked?.overrides, outDir: output });
  if (locked) {
    if (!isDeepStrictEqual(composed.contract.sections, locked.contract.sections)
        || !isDeepStrictEqual(composed.contract.tokens, locked.contract.tokens)) {
      throw new FastStageConflictError('The template output differs from the locked design contract.');
    }
    fs.writeFileSync(path.join(output, 'contract.json'), locked.bytes);
  }
  const composeMs = performance.now() - composeStart;
  const support = copySectionSupport(project, output, signal);
  copyGeneratedAssets(project, output, signal);
  copyStyles(project, output);
  signal?.throwIfAborted();

  const buildStart = performance.now();
  const summary = await exportPreview(output, signal);
  signal?.throwIfAborted();
  if (locked && (!/^Images missing: 0$/m.test(summary) || !/^Unresolved references: 0$/m.test(summary))) {
    throw new FastStageConflictError('The locked design references images that are unavailable for preview export.');
  }
  const dist = path.join(output, 'dist');
  if (!fs.lstatSync(path.join(dist, 'index.html'), { throwIfNoEntry: false })?.isFile()) {
    throw new Error('The Fast Path preview did not produce an index page.');
  }
  const assets = path.join(dist, 'assets');
  const images = fs.existsSync(assets) ? fs.readdirSync(assets, { withFileTypes: true })
    .filter(entry => entry.isFile()).map(entry => `dist/assets/${entry.name}`).sort() : [];
  const finish = performance.now();
  return {
    files: [...composed.files, ...support.sort(), 'dist/index.html', ...images],
    contract: locked?.contract ?? composed.contract,
    timings: { compose: composeMs, build: finish - buildStart, total: finish - start },
  };
}

module.exports = { FastStageConflictError, stageFast };
