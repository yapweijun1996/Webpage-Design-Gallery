// Catalog checks count empty stub values as present keys; the runtime treats them as untranslated.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const languages = ['en', 'zh-Hans', 'ms'];
const keyPattern = /^[a-z0-9.-]+$/;
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const rawTags = new Set('iframe noembed noframes script style textarea title xmp'.split(' '));
const hiddenTags = new Set('desc head iframe noembed noframes noscript script style template title'.split(' '));
const entities = {
  amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: '\u00a0',
  bull: '•', cent: '¢', colon: ':', copy: '©', deg: '°', euro: '€', hellip: '…', laquo: '«',
  ldquo: '“', lsquo: '‘', mdash: '\u2014', middot: '·', ndash: '–', pound: '£', raquo: '»',
  rdquo: '”', reg: '®', rsquo: '’', times: '×', trade: '™', yen: '¥',
};

function decode(text) {
  return text.replace(/&(?:#(x[\da-f]+|\d+);?|([a-z][a-z\d]*);)/gi, (entity, numeric, name) => {
    if (!numeric) return Object.hasOwn(entities, name) ? entities[name] : entity;
    const point = /^x/i.test(numeric) ? parseInt(numeric.slice(1), 16) : Number(numeric);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : '\ufffd';
  });
}

function attributes(source) {
  const result = new Map();
  const pattern = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const [, raw, double, single, bare] of source.matchAll(pattern)) {
    const name = raw.toLowerCase();
    if (!result.has(name)) result.set(name, decode(double ?? single ?? bare ?? ''));
  }
  return result;
}

function normalize(text) {
  return text.replace(/[\t\r\n\f ]+/g, ' ').replace(/^ | $/g, '');
}

function scanFragment(source, file, collect, warn, error) {
  const stack = [];
  const textEntries = [];
  const markup = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![a-z][^>]*>|<(\/?)([a-z][^\s/'"<>]*)((?:"[^"]*"|'[^']*'|[^'"<>])*)>/gi;
  const location = offset => `${file}:${source.slice(0, offset).split(/\r\n?|\n/).length}`;
  let end = 0;

  function readText(raw, offset, literal = false) {
    const value = literal ? raw : decode(raw);
    for (const frame of stack) {
      if (frame.entry) frame.entry.parts.push(value);
    }
    const parent = stack.at(-1);
    const visible = normalize(value);
    if (visible.trim() && !parent?.hidden && !parent?.translated) {
      warn(`${location(offset + raw.search(/\S/))} [no-i18n-text] Visible text without data-i18n: ${JSON.stringify(visible.slice(0, 90))}`);
    }
  }

  for (let match; (match = markup.exec(source));) {
    readText(source.slice(end, match.index), end);
    end = markup.lastIndex;
    const [, closing, rawTag, rawAttrs] = match;
    if (!rawTag) continue;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const open = stack.findLastIndex(frame => frame.tag === tag);
      if (open >= 0) stack.length = open;
      continue;
    }

    const attrs = attributes(rawAttrs);
    const origin = location(match.index);
    let entry;
    if (attrs.has('data-i18n')) {
      const key = attrs.get('data-i18n');
      if (!keyPattern.test(key)) error(`${origin} Invalid data-i18n key ${JSON.stringify(key)}.`);
      else {
        entry = { key, origin, parts: [] };
        textEntries.push(entry);
      }
    }

    for (const rawBinding of (attrs.get('data-i18n-attr') || '').split(';')) {
      const binding = rawBinding.trim();
      if (!binding) continue;
      const match = /^([\w-]+)\s*:\s*([a-z0-9.-]+)$/.exec(binding);
      if (!match) {
        error(`${origin} Invalid data-i18n-attr binding ${JSON.stringify(binding)}.`);
        continue;
      }
      const [, rawAttr, key] = match;
      const attr = rawAttr.toLowerCase();
      if (attrs.has(attr)) collect(key, attrs.get(attr), origin);
      else error(`${origin} Missing inline ${attr} attribute for ${key}.`);
    }

    const parent = stack.at(-1);
    const foreign = tag === 'svg' || tag === 'math' || (parent?.foreign && parent.tag !== 'foreignobject');
    if (voidTags.has(tag) || (foreign && /\/\s*$/.test(rawAttrs))) continue;
    const hiddenStyle = /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))\s*(?:!important\s*)?(?:;|$)/i;
    stack.push({
      tag, entry, foreign, translated: Boolean(entry || parent?.translated),
      hidden: parent?.hidden || hiddenTags.has(tag) || attrs.has('hidden') || hiddenStyle.test(attrs.get('style') || ''),
    });

    if (rawTags.has(tag)) {
      const close = new RegExp(`</${tag}(?=[\\s/>])`, 'gi');
      close.lastIndex = end;
      const next = close.exec(source)?.index ?? source.length;
      if (tag === 'textarea' || tag === 'title' || tag === 'xmp') {
        readText(source.slice(end, next), end, tag === 'xmp');
      }
      end = markup.lastIndex = next;
    }
  }
  readText(source.slice(end), end);
  for (const { key, parts, origin } of textEntries) collect(key, normalize(parts.join('')), origin);
}

function extract(project, warn, error) {
  const dir = path.join(project, 'sections');
  const entries = new Map();
  function collect(key, text, origin) {
    const previous = entries.get(key);
    if (!previous) entries.set(key, { text, origin });
    else if (previous.text !== text) {
      error(`${origin} Duplicate key ${key} has different text (${JSON.stringify(previous.text)} at ${previous.origin}, ${JSON.stringify(text)} here).`);
    }
  }
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.html')) continue;
    scanFragment(fs.readFileSync(path.join(dir, name), 'utf8'), `sections/${name}`, collect, warn, error);
  }
  return Object.fromEntries([...entries.keys()].sort().map(key => [key, entries.get(key).text]));
}

function readCatalog(dir, lang) {
  try {
    const catalog = JSON.parse(fs.readFileSync(path.join(dir, `${lang}.json`), 'utf8'));
    const messages = catalog?.messages;
    if (!messages || typeof messages !== 'object' || Array.isArray(messages)
      || Object.values(messages).some(value => typeof value !== 'string')) {
      throw new Error('expected a messages object with string values');
    }
    return { catalog };
  } catch (error) {
    return { problem: error.code === 'ENOENT' ? 'missing catalog' : error.message };
  }
}

function inSync(catalog, source) {
  return Boolean(catalog && Object.keys(catalog.messages).length === Object.keys(source).length
    && Object.keys(source).every(key => Object.hasOwn(catalog.messages, key) && catalog.messages[key] === source[key]));
}

function writeCatalog(dir, lang, messages, flag) {
  const meta = { lang, status: lang === 'en' ? 'source' : 'machine-draft', generated: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, `${lang}.json`), `${JSON.stringify({ meta, messages }, null, 2)}\n`, { flag });
}

function main(args) {
  let project;
  let catalogs;
  let write = false;
  let check = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--write') write = true;
    else if (arg === '--check') check = true;
    else if (arg === '--catalogs') {
      catalogs = args[++index];
      if (!catalogs || catalogs.startsWith('-')) throw new Error('--catalogs requires a directory');
    } else if (!arg.startsWith('-') && !project) project = arg;
    else throw new Error(`Unexpected argument ${arg}`);
  }
  if (!project) throw new Error('Expected a project directory');
  catalogs = catalogs || path.join(project, 'i18n');

  const errors = [];
  const warn = message => console.warn(`Warning: ${message}`);
  const source = extract(project, warn, message => errors.push(message));
  for (const error of errors) console.error(`Error: ${error}`);
  if (errors.length) return 1;

  if (write) {
    fs.mkdirSync(catalogs, { recursive: true });
    const { catalog } = readCatalog(catalogs, 'en');
    if (!inSync(catalog, source) || catalog.meta?.lang !== 'en' || catalog.meta?.status !== 'source'
      || !Number.isFinite(Date.parse(catalog.meta.generated))) {
      writeCatalog(catalogs, 'en', source, 'w');
    }
    const stub = Object.fromEntries(Object.keys(source).map(key => [key, '']));
    for (const lang of languages.slice(1)) {
      try {
        writeCatalog(catalogs, lang, stub, 'wx');
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  }

  let failed = false;
  function report(message) {
    failed = true;
    if (check) console.error(`Error: ${message}`);
    else warn(message);
  }
  for (const lang of languages) {
    const { catalog, problem } = readCatalog(catalogs, lang);
    if (problem) report(`${lang}.json: ${problem}.`);
    if (lang === 'en' && !inSync(catalog, source)) report('en.json is stale. Run with --write to update it.');
    const missing = Object.keys(source).filter(key => !catalog || !Object.hasOwn(catalog.messages, key));
    if (missing.length) report(`${lang}.json missing keys: ${missing.join(', ')}.`);
  }
  return check && failed ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('Usage: node swarm/tools/i18n-extract.js <projectDir> [--write] [--check] [--catalogs <dir>]');
    process.exitCode = 1;
  }
}
