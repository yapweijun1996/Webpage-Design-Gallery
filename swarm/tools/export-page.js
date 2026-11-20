#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const SWARM_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SWARM_ROOT, '..');
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

function imageRewriter(outDir, copied, missing, unresolved) {
  const mappings = IMAGE_PREFIXES.map(({ prefix, directory, filenamePrefix }) => {
    const root = path.resolve(REPO_ROOT, directory);
    return { prefix, filenamePrefix, root: fs.existsSync(root) ? fs.realpathSync(root) : null };
  });
  const assetsDir = path.join(outDir, 'assets');
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
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.copyFileSync(file, path.join(assetsDir, filename));
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
  const css = rewriteCss(optionalText(cssFile, warnings), rewriteImage, minify);
  return { file, headings, html, css };
}

function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, title: { type: 'string' }, minify: { type: 'boolean' } },
  });
  if (positionals.length > 1) {
    throw new Error('Usage: node swarm/tools/export-page.js [projectDir] [--out dir] [--title "text"] [--minify]');
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
  const title = (values.title ?? path.basename(projectDir)).replace(/[&<>]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
  })[character]);
  const copied = new Map();
  const missing = new Set();
  const unresolved = new Set();
  const warnings = [];
  const rewriteImage = imageRewriter(output, copied, missing, unresolved);
  const minify = values.minify;
  const tokens = rewriteCss(optionalText(path.join(projectDir, 'tokens.css'), warnings), rewriteImage, minify);
  const sections = files.map(file => processSection(file, sectionsDir, rewriteImage, minify, warnings));
  const headings = sections.reduce((count, section) => count + section.headings, 0);
  if (headings !== 1) warnings.push(`Expected exactly one <h1>, found ${headings}`);

  const styles = [tokens, rewriteCss(BASE_CSS, rewriteImage, minify), ...sections.map(section => section.css)];
  const page = [
    '<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    ...styles.map(css => `<style>\n${css}\n</style>`),
    '</head>', '<body>', '<main>', ...sections.map(section => section.html),
    '</main>', '</body>', '</html>', '',
  ].join('\n');
  fs.mkdirSync(output, { recursive: true });
  const destination = path.join(output, 'index.html');
  fs.writeFileSync(destination, page);

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
