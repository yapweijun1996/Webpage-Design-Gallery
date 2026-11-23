'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The preview and exported PWA resolve the same project overrides. Projects
// without a catalog use the SDS catalog for that language.
function readCatalog(designSystem, project, lang, { strict = false } = {}) {
  if (!['en', 'zh-Hans', 'ms'].includes(lang)) throw new Error('Unsupported SDS catalog language.');
  function load(root, required) {
    try {
      const directory = path.join(fs.realpathSync(root), 'i18n');
      const folder = fs.lstatSync(directory, { throwIfNoEntry: false });
      if (!folder && !required) return null;
      if (!folder?.isDirectory()) throw new Error('Expected a catalog directory.');
      const file = path.join(directory, lang + '.json');
      const stat = fs.lstatSync(file, { throwIfNoEntry: false });
      if (!stat && !required) return null;
      if (!stat?.isFile() || stat.nlink !== 1) throw new Error('Expected a regular catalog file.');
      const catalog = JSON.parse(fs.readFileSync(file, { flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW }));
      if (!catalog?.messages || typeof catalog.messages !== 'object' || Array.isArray(catalog.messages) ||
          Object.values(catalog.messages).some(value => typeof value !== 'string')) throw new Error('Expected string messages.');
      return catalog;
    } catch (error) {
      if (strict) throw new Error(`Cannot read ${lang} catalog in ${root}: ${error.message}`);
      return null;
    }
  }
  const base = load(designSystem, true);
  const local = load(project, false);
  return { meta: (local || base)?.meta || { lang }, messages: { ...base?.messages, ...local?.messages } };
}

module.exports = { readCatalog };
