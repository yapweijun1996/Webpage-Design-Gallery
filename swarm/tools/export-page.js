#!/usr/bin/env node
'use strict';

// SDS starts in English with no brand and all catalogs by default. PWA export preserves unmanaged output files by refusing to overwrite their directory.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { assembleCss, parseSectionFile } = require('../lib/layers');

const SWARM_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SWARM_ROOT, '..');
const SDS_ROOT = path.join(SWARM_ROOT, 'design-system');
const SHELL = path.join(SDS_ROOT, 'shell');
const LANGUAGES = { en: 'English', 'zh-Hans': '简体中文', ms: 'Bahasa Melayu' };
const BRANDS = ['none', 'forest-gold', 'gjh-classic'];
const SDS_STYLES = ['tokens.css', 'themes.css', 'components.css'];
const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const IMAGE_PREFIXES = [
  { prefix: '/gjh/', directory: 'assets/companies/gjh', filenamePrefix: '' },
  { prefix: '/gjh-v11/', directory: 'demos/corporate/gjh/v11/assets', filenamePrefix: 'v11-' },
];
const BASE_CSS = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--dc-bg);color:var(--dc-ink);font-family:var(--dc-font);font-size:var(--dc-text-base);line-height:var(--dc-leading)}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
const PWA_BASE_CSS = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--sds-color-bg);color:var(--sds-color-text);font-family:var(--sds-font-sans);font-size:var(--sds-text-base);line-height:var(--sds-leading-body)}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

const CSS_STRING = String.raw`"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'`;
const CSS_URL = String.raw`(?<open>(?<![\w-])url\([ \t\n\f\r]*)(?<url>${CSS_STRING}|(?:\\[\s\S]|[^\s"'()\\])+)(?=[ \t\n\f\r]*\))`;
const CSS_TOKENS = new RegExp(
  String.raw`/\*[\s\S]*?(?:\*/|$)|${CSS_URL}|${CSS_STRING}|\\(?:[0-9a-f]{1,6}(?:\r\n|[ \t\n\f\r])?|\r\n|[\s\S])|(?<space>[ \t\n\f\r]+)`,
  'gi',
);

const HTML_ATTRIBUTES = String.raw`(?:[^"'<>]|"[^"]*"|'[^']*')*`;
const HTML_TOKENS = new RegExp(
  String.raw`<!--[\s\S]*?(?:-->|$)|<(?<raw>script|style|textarea|title)(?=[ \t\n\f\r/>])(?<rawAttrs>${HTML_ATTRIBUTES})>(?<body>[\s\S]*?)(?<close></\k<raw>[ \t\n\f\r]*>|$)|<(?<tag>[a-z][^ \t\n\f\r/<>'"]*)(?<attrs>${HTML_ATTRIBUTES})>`,
  'gi',
);
const HTML_ATTRIBUTE = /([^ \t\n\f\r"'<>/=]+)(?:[ \t\n\f\r]*=[ \t\n\f\r]*(?:"([^"]*)"|'([^']*)'|([^ \t\n\f\r>]+)))?/g;

function optionalText(file, warnings) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    warnings.push(`Missing stylesheet ${path.basename(file)}`);
    return '';
  }
}

function isWithin(directory, file) {
  const relative = path.relative(directory, file);
  return relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

function imageSource(relativePath, root) {
  if (!root) return;
  try {
    const candidate = path.resolve(root, decodeURIComponent(relativePath));
    if (!isWithin(root, candidate)) return;
    const file = fs.realpathSync(candidate);
    if (isWithin(root, file) && fs.statSync(file).isFile()) return file;
  } catch (error) {
    if (!(error instanceof URIError) && !['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ELOOP', 'ENAMETOOLONG', 'ERR_INVALID_ARG_VALUE'].includes(error.code)) throw error;
  }
}

function imageRewriter(writeImage, copied, missing, unresolved) {
  const mappings = IMAGE_PREFIXES.map(({ prefix, directory, filenamePrefix }) => {
    const root = path.resolve(REPO_ROOT, directory);
    return { prefix, filenamePrefix, root: fs.existsSync(root) ? fs.realpathSync(root) : null };
  });
  const usedNames = new Set();

  return function rewriteImage(url) {
    if (!url.startsWith('/') || url.startsWith('//') || missing.has(url)) return url;
    const mapping = mappings.find(({ prefix }) => url.startsWith(prefix));
    if (!mapping) {
      unresolved.add(url);
      return url;
    }
    const suffixStart = url.search(/[?#]/);
    const urlPath = suffixStart < 0 ? url : url.slice(0, suffixStart);
    const file = imageSource(urlPath.slice(mapping.prefix.length), mapping.root);
    if (!file) {
      missing.add(url);
      return url;
    }

    if (!copied.has(file)) {
      const basename = mapping.filenamePrefix + path.basename(file).replace(/[^a-z0-9._-]/gi, '-');
      const { name, ext } = path.parse(basename);
      let filename = basename;
      for (let number = 2; usedNames.has(filename.toLowerCase()); number++) {
        filename = `${name}-${number}${ext}`;
      }
      writeImage(`assets/${filename}`, file);
      usedNames.add(filename.toLowerCase());
      copied.set(file, { filename, bytes: fs.statSync(file).size });
    }

    const suffix = suffixStart < 0 ? '' : url.slice(suffixStart);
    return `assets/${copied.get(file).filename}${suffix}`;
  };
}

function rewriteCss(css, rewriteImage, minify) {
  const rewritten = css.replace(CSS_TOKENS, (token, open, url, space) => {
    if (url !== undefined) {
      const quote = /^["']/.test(url) ? url[0] : '';
      const value = quote ? url.slice(1, -1) : url;
      return open + quote + rewriteImage(value) + quote;
    }
    return minify && space ? ' ' : token;
  });
  return minify ? rewritten.trim() : rewritten;
}

function rewriteSrcset(srcset, rewriteImage) {
  // A candidate URL can contain commas. Only trailing commas or commas
  // after descriptors separate candidates.
  return srcset.replace(/([ \t\n\f\r,]*)([^ \t\n\f\r,][^ \t\n\f\r]*)(?:(?<=,)|(?:\([^)]*\)|[^,(])*,?)/g,
    (candidate, leading, url) => {
      const value = url.replace(/,+$/, '');
      return leading + rewriteImage(value) + candidate.slice(leading.length + value.length);
    });
}

function rewriteAttributes(tagName, attributes, rewriteImage, minify) {
  return attributes.replace(HTML_ATTRIBUTE, (token, name, doubleQuoted, singleQuoted, unquoted) => {
    const value = doubleQuoted ?? singleQuoted ?? unquoted;
    if (value === undefined) return token;

    let rewritten;
    const attribute = name.toLowerCase();
    switch (attribute) {
      case 'href':
      case 'src':
        if (attribute === 'href' && !['img', 'source', 'link'].includes(tagName)) return token;
        rewritten = value.replace(/[^ \t\n\f\r](?:.*[^ \t\n\f\r])?/s, rewriteImage);
        break;
      case 'srcset':
        rewritten = rewriteSrcset(value, rewriteImage);
        break;
      case 'style':
        rewritten = rewriteCss(value, rewriteImage, minify);
        break;
      default:
        return token;
    }
    const quote = doubleQuoted !== undefined ? '"' : singleQuoted !== undefined ? "'" : '';
    return token.slice(0, token.length - value.length - quote.length) + rewritten + quote;
  });
}

function processSection(file, sectionsDir, rewriteImage, minify, warnings) {
  let headings = 0;
  let scripts = 0;
  const html = fs.readFileSync(path.join(sectionsDir, file), 'utf8').replace(HTML_TOKENS, (...match) => {
    const { raw, rawAttrs, body, close, tag, attrs } = match.at(-1);
    const name = raw ?? tag;
    if (!name) return match[0];
    const lowerName = name.toLowerCase();
    if (lowerName === 'h1') headings++;
    if (lowerName === 'script') scripts++;

    const attributes = rewriteAttributes(lowerName, rawAttrs ?? attrs, rewriteImage, minify);
    const content = lowerName === 'style' ? rewriteCss(body, rewriteImage, minify) : body ?? '';
    return `<${name}${attributes}>${content}${close ?? ''}`;
  });
  if (scripts) warnings.push(`${file} contains ${scripts} <script> tag(s)`);

  const cssFile = path.join(sectionsDir, file.replace(/\.html$/, '.css'));
  const section = parseSectionFile(file);
  // The original exporter also accepts HTML filenames outside the section slug format.
  const source = section ? assembleCss(sectionsDir, section.base) : optionalText(cssFile, warnings);
  if (section && !fs.existsSync(cssFile)) warnings.push(`Missing stylesheet ${path.basename(cssFile)}`);
  const css = rewriteCss(source, rewriteImage, minify);
  return { file, headings, html, css };
}

function pwaOptions(values) {
  const brand = values.brand ?? 'none';
  if (!BRANDS.includes(brand)) throw new Error(`Unknown brand "${brand}". Choose ${BRANDS.join(', ')}.`);
  const languages = values.langs === undefined ? Object.keys(LANGUAGES) : [...new Set(values.langs.split(',').map(lang => lang.trim()))];
  for (const lang of languages) {
    if (!Object.hasOwn(LANGUAGES, lang)) throw new Error(`Unknown language "${lang}". Choose ${Object.keys(LANGUAGES).join(', ')}.`);
  }
  return { brand, languages };
}

function readPwaFile(directory, filename, encoding) {
  const file = path.join(directory, filename);
  try {
    return fs.readFileSync(file, encoding);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(`Missing SDS PWA input: ${file}`);
  }
}

function render(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (placeholder, name) => values[name] ?? placeholder);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function buildPwa(bundle, { title, htmlTitle, brand, languages, styles, body }) {
  for (const file of [...SDS_STYLES, 'runtime.js', 'i18n.js']) {
    bundle.set(`design-system/${file}`, readPwaFile(SDS_ROOT, file));
  }
  for (const language of languages) {
    const file = `i18n/${language}.json`;
    bundle.set(file, readPwaFile(SDS_ROOT, file));
  }
  for (const icon of ICONS) {
    const file = `icons/${icon}`;
    bundle.set(file, readPwaFile(SHELL, file));
  }

  const boot = readPwaFile(SDS_ROOT, 'boot.js', 'utf8');
  const themeColor = bundle.get('design-system/tokens.css').toString()
    .match(/--sds-color-bg:\s*(#[\da-f]{6}|#[\da-f]{3})\s*[;}]/i)?.[1] ?? '#ffffff';
  const pageTemplate = readPwaFile(SHELL, 'index.html.tpl', 'utf8');
  const workerTemplate = readPwaFile(SHELL, 'sw.js.tpl', 'utf8');
  const pageValues = {
    TITLE: htmlTitle,
    LANG: 'en',
    BRAND: brand,
    THEME_COLOR: themeColor,
    LANG_OPTIONS: [...new Set(['en', ...languages])].map(lang => `<option value="${lang}">${LANGUAGES[lang]}</option>`).join('\n        '),
    STYLES: [...SDS_STYLES.map(file => `<link rel="stylesheet" href="design-system/${file}">`), ...styles].join('\n  '),
    BODY: body,
    SCRIPTS: `<script>\n${boot}\n</script>\n  <script defer src="design-system/runtime.js"></script>`,
  };

  bundle.set('manifest.webmanifest', render(readPwaFile(SHELL, 'manifest.webmanifest.tpl', 'utf8'), {
    NAME: JSON.stringify(title), THEME_COLOR: JSON.stringify(themeColor),
  }));
  bundle.set('offline.html', readPwaFile(SHELL, 'offline.html'));
  bundle.set('index.html', render(pageTemplate, pageValues));
  bundle.set('sw.js', workerTemplate);

  // Hash the bundle before injecting its identity into the page and worker.
  const files = [...bundle.keys(), 'version.json'].sort();
  const contents = files.filter(file => bundle.has(file)).map(file => [file, sha256(bundle.get(file))]);
  const hash = sha256(JSON.stringify(contents));
  const version = hash.slice(0, 16);
  const cacheName = `sds-${version}-${sha256(JSON.stringify(files)).slice(0, 16)}`;
  bundle.set('index.html', render(pageTemplate, { ...pageValues, VERSION: version }));
  bundle.set('sw.js', workerTemplate.replace(/__CACHE_NAME__|__PRECACHE__/g, token => (
    JSON.stringify(token === '__CACHE_NAME__' ? cacheName : files)
  )));
  bundle.set('version.json', `${JSON.stringify({ version, hash, files }, null, 2)}\n`);
}

function existingOutputFiles(output, bundle, relative = '') {
  const current = path.join(output, relative);
  const stats = fs.lstatSync(current, { throwIfNoEntry: false });
  if (!stats) return [];
  if (stats.isFile()) return [relative];
  if (!stats.isDirectory() || bundle.has(relative)) throw new Error(`Cannot export PWA over ${current}. Use an empty --out directory.`);
  return fs.readdirSync(current).flatMap(name => existingOutputFiles(output, bundle, path.posix.join(relative, name)));
}

function writePwa(output, bundle) {
  const existing = existingOutputFiles(output, bundle);
  const extras = existing.filter(file => !bundle.has(file));
  if (extras.length) {
    let previous = [];
    if (existing.includes('version.json')) {
      try {
        const version = JSON.parse(fs.readFileSync(path.join(output, 'version.json'), 'utf8'));
        if (Array.isArray(version?.files)) previous = version.files;
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    const isStale = file => previous.includes(file) && /^(?:assets\/[\w.-]+|i18n\/(?:en|zh-Hans|ms)\.json)$/.test(file);
    const unexpected = extras.filter(file => !isStale(file));
    if (unexpected.length) throw new Error(`Unexpected files in PWA output: ${unexpected.join(', ')}. Use an empty --out directory.`);
  }

  for (const [file, data] of bundle) {
    if (file === 'version.json') continue;
    const destination = path.join(output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, data);
  }
  for (const file of extras) fs.unlinkSync(path.join(output, file));
  fs.writeFileSync(path.join(output, 'version.json'), bundle.get('version.json'));
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' }, title: { type: 'string' }, minify: { type: 'boolean' },
      'no-pwa': { type: 'boolean' }, brand: { type: 'string' }, langs: { type: 'string' },
    },
  });
  if (positionals.length > 1) {
    throw new Error('Usage: node swarm/tools/export-page.js [projectDir] [--out dir] [--title "text"] [--minify] [--no-pwa] [--brand brand] [--langs en,zh-Hans,ms]');
  }

  const projectDir = path.resolve(positionals[0] ?? path.join(SWARM_ROOT, 'projects/home'));
  if (!fs.statSync(projectDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Project directory not found: ${projectDir}`);
  }
  const sectionsDir = path.join(projectDir, 'sections');
  if (!fs.statSync(sectionsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Sections directory not found: ${sectionsDir}`);
  }
  const files = fs.readdirSync(sectionsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^\d{2}-.+\.html$/.test(entry.name))
    .map(entry => entry.name)
    .sort();
  if (!files.length) throw new Error(`No section fragments found in ${sectionsDir}`);

  const output = path.resolve(values.out ?? path.join(projectDir, 'dist'));
  const title = values.title ?? path.basename(projectDir);
  const htmlTitle = title.replace(/[&<>]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
  })[character]);
  const pwa = values['no-pwa'] ? null : pwaOptions(values);
  const bundle = new Map();
  const copied = new Map();
  const missing = new Set();
  const unresolved = new Set();
  const warnings = [];
  const rewriteImage = imageRewriter((filename, source) => {
    if (pwa) {
      bundle.set(filename, fs.readFileSync(source));
    } else {
      const destination = path.join(output, filename);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }, copied, missing, unresolved);
  const minify = values.minify;
  const tokens = rewriteCss(optionalText(path.join(projectDir, 'tokens.css'), warnings), rewriteImage, minify);
  const sections = files.map(file => processSection(file, sectionsDir, rewriteImage, minify, warnings));
  const headings = sections.reduce((count, section) => count + section.headings, 0);
  if (headings !== 1) warnings.push(`Expected exactly one <h1>, found ${headings}`);

  const baseCss = rewriteCss(pwa ? PWA_BASE_CSS : BASE_CSS, rewriteImage, minify);
  const styles = [tokens, baseCss, ...sections.map(section => section.css)].map(css => `<style>\n${css}\n</style>`);
  const body = sections.map(section => section.html).join('\n');
  const destination = path.join(output, 'index.html');
  let page;
  if (pwa) {
    buildPwa(bundle, { ...pwa, title, htmlTitle, styles, body });
    writePwa(output, bundle);
    page = bundle.get('index.html');
  } else {
    page = [
      '<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${htmlTitle}</title>`, ...styles,
      '</head>', '<body>', '<main>', body,
      '</main>', '</body>', '</html>', '',
    ].join('\n');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(destination, page);
  }

  console.log(`Sections included: ${sections.length}`);
  for (const { file, html, css } of sections) {
    console.log(`  ${file}: ${Buffer.byteLength(html)} HTML bytes, ${Buffer.byteLength(css)} CSS bytes`);
  }
  const imageBytes = [...copied.values()].reduce((total, image) => total + image.bytes, 0);
  console.log(`Images copied: ${copied.size} (${imageBytes} bytes)`);
  console.log(`Images missing: ${missing.size}`);
  for (const url of missing) console.log(`  ${url}`);
  console.log(`Unresolved references: ${unresolved.size}`);
  console.log(`Final file: ${destination} (${Buffer.byteLength(page)} bytes)`);
  for (const url of unresolved) console.warn(`Warning: Unresolved root-relative reference ${url} (unavailable offline)`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
