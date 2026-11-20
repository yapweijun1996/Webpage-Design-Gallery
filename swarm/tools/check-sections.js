#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PROJECT = path.resolve(__dirname, '../projects/home');
const VOID_TAGS = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const ROOT_TAGS = new Set(['section', 'header', 'footer']);
const RAW_TAGS = new Set('script style textarea title xmp iframe noembed noframes'.split(' '));
const SVG_URL_ATTRS = new Set('clip-path cursor fill filter marker marker-end marker-mid marker-start mask stroke'.split(' '));
const CSS_GROUPS = new Set(['media', 'supports', 'layer', 'container', 'starting-style']);
const CSS_LITERALS = /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\\(?:[a-f\d]{1,6}(?:\r\n|[ \t\r\n\f])?|[\s\S])/gi;
const CSS_ESCAPE = /\\(?:([a-f\d]{1,6})(?:\r\n|[ \t\r\n\f])?|(\r\n|[\s\S]))/gi;
const HTML_NAMES = { amp: '&', apos: "'", colon: ':', gt: '>', lt: '<', newline: '\n', num: '#', quot: '"', sol: '/', tab: '\t' };
const HTML_SPACE = /[ \t\r\n\f]+/;

function codePoint(number) {
  return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '\ufffd';
}

function decodeHtml(value) {
  return value.replace(/&(?:#(x[\da-f]+|\d+);?|([a-z]+);)/gi, (entity, numeric, name) => {
    if (numeric) {
      return codePoint(numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric));
    }
    return Object.hasOwn(HTML_NAMES, name.toLowerCase()) ? HTML_NAMES[name.toLowerCase()] : entity;
  });
}

function decodeCss(value) {
  return value.replace(CSS_ESCAPE, (_, hex, literal) =>
    hex ? codePoint(parseInt(hex, 16)) : literal.replace(/[\r\n\f]/g, ''));
}

function externalUrl(value) {
  return /^(?:https?:|\/\/)/i.test(value.trim().replace(/[\t\r\n]/g, ''));
}

function htmlAttributes(source) {
  const attrs = new Map();
  const attribute = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const [, name, double, single, bare] of source.matchAll(attribute)) {
    const key = name.toLowerCase();
    if (!attrs.has(key)) attrs.set(key, decodeHtml(double ?? single ?? bare ?? ''));
  }
  return attrs;
}

function parseHtml(source) {
  // Comments and quoted attribute values may contain an arbitrary '>'.
  const markup = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![a-z][^>]*>|<(\/?)([a-z][^\s/'"<>]*)((?:"[^"]*"|'[^']*'|[^'"<>])*)>/gi;
  const roots = [];
  const elements = [];
  const stack = [];
  let outside = false;
  let end = 0;

  for (let match; (match = markup.exec(source));) {
    const [token, close, name, attrSource] = match;
    if (!stack.length && decodeHtml(source.slice(end, match.index)).trim()) outside = true;
    end = markup.lastIndex;
    if (!name) {
      if (!stack.length && !token.startsWith('<!--')) outside = true;
      continue;
    }

    const tagName = name.toLowerCase();
    if (close) {
      const open = stack.findLastIndex(element => element.tag === tagName);
      if (open >= 0) {
        stack[open].closed = true;
        stack.length = open;
      } else if (!stack.length) {
        outside = true;
      }
      continue;
    }

    const parent = stack.at(-1);
    const foreign = tagName === 'svg' || tagName === 'math'
      || (parent?.foreign && parent.tag !== 'foreignobject');
    const element = { tag: tagName, attrs: htmlAttributes(attrSource), foreign, closed: false };
    elements.push(element);
    if (!parent) roots.push(element);
    if (VOID_TAGS.has(tagName) || (foreign && /\/\s*$/.test(attrSource))) continue;
    stack.push(element);

    if ((!foreign && RAW_TAGS.has(tagName)) || tagName === 'style' || tagName === 'script') {
      const closingTag = new RegExp(`</${tagName}(?=[\\s/>])`, 'gi');
      closingTag.lastIndex = end;
      const closing = closingTag.exec(source);
      markup.lastIndex = closing?.index ?? source.length;
      if (tagName === 'style') element.css = source.slice(end, markup.lastIndex);
      end = markup.lastIndex;
    }
  }
  if (!stack.length && decodeHtml(source.slice(end)).trim()) outside = true;
  return { roots, elements, outside };
}

function cssSource(source) {
  // Keep offsets while hiding strings and escapes from delimiter and value checks.
  const text = source.replace(CSS_LITERALS, token => token.startsWith('/*') ? ' '.repeat(token.length) : token);
  return { text, code: text.replace(CSS_LITERALS, token => '\ue000'.repeat(token.length)) };
}

function* cssDelimiters(code, wanted) {
  let depth = 0;
  for (let index = 0; index < code.length; index += 1) {
    const character = code[index];
    if (!depth && wanted.includes(character)) yield index;
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth = Math.max(0, depth - 1);
  }
}

function splitCss(code, delimiters) {
  const parts = [];
  let start = 0;
  for (const index of cssDelimiters(code, delimiters)) {
    parts.push(code.slice(start, index));
    start = index + 1;
  }
  parts.push(code.slice(start));
  return parts;
}

function cssStatements({ text, code }) {
  let start = 0;
  let list = [];
  const stack = [];

  function take(end) {
    return { text: text.slice(start, end).trim(), code: code.slice(start, end).trim() };
  }

  for (const index of cssDelimiters(code, '{};')) {
    const statement = take(index);
    if (code[index] === '{') {
      statement.children = [];
      list.push(statement);
      stack.push(list);
      list = statement.children;
    } else {
      if (statement.code) list.push(statement);
      if (code[index] === '}' && stack.length) list = stack.pop();
    }
    start = index + 1;
  }
  const last = take(code.length);
  if (last.code) list.push(last);
  return stack[0] ?? list;
}

function selectorParts(selector) {
  const compounds = [];
  let start = 0;
  let combinator = '';
  for (const index of cssDelimiters(selector, ' \t\r\n\f>+~|')) {
    const piece = selector.slice(start, index);
    if (piece) {
      compounds.push({ piece, combinator });
      combinator = '';
    }
    if (!/\s/.test(selector[index])) combinator = selector[index];
    else if (!combinator) combinator = ' ';
    start = index + 1;
  }
  if (start < selector.length) compounds.push({ piece: selector.slice(start), combinator });
  return compounds;
}

function selectorFacts(compound, scope) {
  const bits = {
    scoped: false, hasRoot: false, classes: [], ids: [], attributes: [], alternatives: [],
    type: /^[a-z][\w-]*/i.exec(compound)?.[0].toLowerCase(), universal: compound.startsWith('*'),
  };
  const component = /\[\s*([\w-]+)[^\]]*\]|([.#])([\w\u0080-\uffff-]+)|(::?)([\w-]+)(\()?/g;
  for (let token; (token = component.exec(compound));) {
    const [, attribute, prefix, name, pseudo, pseudoName, opening] = token;
    if (attribute) {
      bits.attributes.push(attribute.toLowerCase());
    } else if (prefix === '.') {
      bits.classes.push(name);
      if (name === scope) bits.scoped = true;
    } else if (prefix === '#') {
      bits.ids.push(name);
    } else if (pseudo) {
      const name = pseudoName.toLowerCase();
      if (pseudo === '::' || /^(?:before|after|first-letter|first-line)$/.test(name)) bits.pseudoElement = true;
      if (name === 'root') bits.hasRoot = true;
      if (opening) {
        let depth = 1;
        const start = component.lastIndex;
        let end = start;
        while (end < compound.length && depth) {
          if (compound[end] === '(') depth += 1;
          if (compound[end] === ')') depth -= 1;
          end += 1;
        }
        const argument = compound.slice(start, depth ? end : end - 1);
        const alternatives = splitCss(argument, ',').map(selector => selectorFactsForList(selector, scope));
        if (alternatives.some(branch => branch.hasRoot)) bits.hasRoot = true;
        if (/^(?:is|where)$/.test(name)) {
          bits.alternatives.push(...alternatives);
          if (alternatives.every(branch => branch.scoped)) bits.scoped = true;
        }
        component.lastIndex = end;
      }
    }
  }
  return bits;
}

function selectorFactsForList(selector, scope) {
  let scoped = false;
  let ancestorScoped = false;
  let hasRoot = false;
  let target;
  for (const { piece, combinator } of selectorParts(selector.trim())) {
    if (combinator === ' ' || combinator === '>') ancestorScoped = scoped;
    if (combinator === '|') ancestorScoped = false;
    target = selectorFacts(piece, scope);
    scoped = target.scoped || ancestorScoped;
    hasRoot ||= target.hasRoot;
  }
  return { scoped, hasRoot, target };
}

function isTapSelector({ target }, controls) {
  if (!target || target.pseudoElement) return false;
  if (target.type) return target.type === 'a' || target.type === 'button';
  if (target.alternatives.some(alternative => isTapSelector(alternative, controls))) return true;
  if (!target.universal && !target.classes.length && !target.ids.length && !target.attributes.length) return false;
  return controls.some(({ attrs }) =>
    target.ids.every(id => attrs.get('id') === id)
    && target.attributes.every(name => attrs.has(name))
    && target.classes.every(name => (attrs.get('class') ?? '').split(HTML_SPACE).includes(name)));
}

function cssUrls({ text, code }) {
  const urls = [];
  for (const match of code.matchAll(/[\w\u0080-\uffff-]+\(/g)) {
    const start = match.index + match[0].length;
    if (decodeCss(text.slice(match.index, start - 1)).toLowerCase() !== 'url') continue;
    const end = code.indexOf(')', start);
    if (end !== -1) urls.push(unquoteCss(text.slice(start, end)));
  }
  return urls;
}

function unquoteCss(value) {
  return decodeCss(value.trim().replace(/^(["'])([\s\S]*)\1$/, '$2'));
}

function pixels(value) {
  const match = /^([+-]?(?:\d*\.\d+|\d+))px$/i.exec(value);
  return match ? Number(match[1]) : null;
}

function desktopMedia(query) {
  // Every comma-separated alternative must exclude the 393px viewport.
  return splitCss(query, ',').every(branch => {
    if (/\b(?:not|or)\b/i.test(branch)) return false;
    const forward = /\(\s*(?:min-width\s*:|width\s*(>=|>))\s*([\d.]+)(px|r?em)\b/i.exec(branch);
    const reverse = /\(\s*([\d.]+)(px|r?em)\s*(<=|<)\s*width\b/i.exec(branch);
    if (!forward && !reverse) return false;
    const [, comparison, size, unit] = forward ?? [null, reverse[3], reverse[1], reverse[2]];
    const boundary = mediaPixels(size, unit);
    return boundary > 393 || (boundary === 393 && (comparison === '>' || comparison === '<'));
  });
}

function mobileMedia(condition) {
  return splitCss(condition.slice(6), ',').some(branch => {
    const match = /^\s*(?:(?:only\s+)?screen\s+and\s+)?\(\s*(?:max-width\s*:|width\s*(<=|<))\s*([\d.]+)(px|r?em)\s*\)\s*$/i.exec(branch);
    if (!match) return false;
    const [, comparison, size, unit] = match;
    const boundary = mediaPixels(size, unit);
    return boundary > 393 || (boundary === 393 && comparison !== '<');
  });
}

function mediaPixels(size, unit) {
  return Number(size) * (unit.toLowerCase() === 'px' ? 1 : 16);
}

function declaration(statement) {
  const colon = statement.code.indexOf(':');
  if (colon < 1) return null;
  const property = statement.code.slice(0, colon).trim().toLowerCase();
  if (!/^(?:--)?[\w-]+$/.test(property)) return null;
  const value = statement.code.slice(colon + 1).trim();
  return { property, value: value.replace(/\s*!\s*important$/i, '').trim(), important: /!\s*important$/i.test(value) };
}

function collectCss(source, report, { scope, inline = false, header = false, controls, palette }) {
  const css = cssSource(source);
  const rules = [];
  for (const url of cssUrls(css)) {
    if (externalUrl(url)) report('error', 'external-resource', 'CSS url() loads an external resource.');
  }
  function walk(statements, context) {
    const rule = { ...context, declarations: [] };
    const { selectors, keyframes, conditions, guarded } = context;
    const parent = selectors.length ? `:is(${selectors.join(',')})` : '';
    rules.push(rule);
    for (const statement of statements) {
      const atRule = /^@([\w-]+)/i.exec(statement.code)?.[1].toLowerCase();
      if (atRule) {
        if (atRule === 'import') {
          const url = /^@import\s+("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')/i.exec(statement.text)?.[1];
          if (url && externalUrl(unquoteCss(url))) report('error', 'external-resource', 'CSS @import loads an external resource.');
        }
        if (statement.children && CSS_GROUPS.has(atRule)) {
          walk(statement.children, {
            ...context,
            conditions: [...conditions, statement.code],
            guarded: guarded || (atRule === 'media' && desktopMedia(statement.code.slice(6))),
          });
        } else if (statement.children && /^(?:-webkit-)?keyframes$/.test(atRule)) {
          walk(statement.children, { ...context, selectors: [], scoped: false, tap: false, keyframes: true });
        } else {
          report('error', 'css-scope', `@${atRule} cannot be scoped to .${scope}.`);
        }
        continue;
      }
      if (!statement.children) {
        const found = declaration(statement);
        if (found) rule.declarations.push(found);
        continue;
      }
      const children = splitCss(statement.code, ',').map(selector => {
        const clean = selector.trim();
        if (!parent) return clean;
        return clean.includes('&') ? clean.replace(/&/g, parent) : `${parent} ${clean}`;
      });
      const facts = children.map(selector => selectorFactsForList(selector, scope));
      const frame = keyframes && children.every(selector => /^(?:from|to|(?:\d*\.)?\d+%)$/i.test(selector));
      const scoped = !keyframes && facts.every(fact => fact.scoped && !fact.hasRoot);
      if (!scoped && !frame) {
        report('error', 'css-scope', `Scope every selector in "${statement.text}" to .${scope}.`);
      }
      walk(statement.children, {
        ...context, selectors: frame ? [] : children, scoped, keyframes: false,
        tap: !frame && facts.some(fact => isTapSelector(fact, controls)),
      });
    }
  }
  walk(cssStatements(css), {
    selectors: [], conditions: [], scoped: false, keyframes: false, guarded: false, tap: inline && controls.length > 0,
  });
  let important = 0;
  for (const [index, { declarations, selectors, scoped, conditions, guarded, tap }] of rules.entries()) {
    let leadingTokens = true;
    for (const item of declarations) {
      const { property, value } = item;
      leadingTokens &&= property.startsWith('--');
      if (item.important) important += 1;
      if (!(palette && scoped && leadingTokens)
        && /(?<![\w-])(?:#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])|(?:rgba?|hsla?)\()/i.test(withoutUrls(value))) {
        report('warn', 'hard-coded-color', `Use a color token in ${property}.`);
      }
      const size = pixels(value);
      if (/^font(?:-size)?$/.test(property) && [...value.matchAll(/(?<![\w.-])(\d*\.\d+|\d+)px\b/gi)]
        .some(match => Number(match[1]) < 12 && (property === 'font-size' || !match.input.slice(0, match.index).includes('/')))) {
        report('warn', 'small-font', `Font size in ${property} is below 12px.`);
      }
      if (/^(?:min-)?(?:width|inline-size)$/.test(property) && size > 393 && !guarded) {
        const max = property.endsWith('inline-size') ? 'max-inline-size' : 'max-width';
        const hasGuard = rules.some((candidate, otherIndex) => {
          if (candidate.declarations !== declarations && (!selectors.length
            || !selectors.every(selector => candidate.selectors.includes(selector)))) return false;
          const extra = candidate.conditions.filter(condition => !conditions.includes(condition));
          if (extra.some(condition => !/^@media\b/i.test(condition) || !mobileMedia(condition))) return false;
          return candidate.declarations.some(other =>
            (!property.startsWith('min-') && other.property === max && responsiveCap(other.value))
            || (extra.length && otherIndex > index && other.property === property && (!item.important || other.important)
              && (responsiveCap(other.value) || /^auto$/i.test(other.value))));
        });
        if (!hasGuard) report('warn', 'fixed-width', `${property}: ${value} exceeds 393px without a responsive guard.`);
      }
      if (property === 'position' && /^fixed$/i.test(value) && !header) {
        report('warn', 'fixed-position', 'Reserve position: fixed for the header section.');
      }
      if (tap && /^(?:min-)?(?:height|block-size)$/.test(property) && size !== null && size < 44) {
        report('warn', 'small-tap-target', `${property}: ${value} is below 44px for a button or link.`);
      }
    }
  }
  return important;
}

function responsiveCap(value) {
  const size = pixels(value);
  const relative = /^(\d+(?:\.\d+)?)(?:%|[dls]?vw)$/i.exec(value);
  return (size !== null && size <= 393) || (relative && Number(relative[1]) <= 100)
    || /^(?:calc|min)\(\s*100(?:%|[dls]?vw)\s*[-,)]/i.test(value);
}

function withoutUrls(value) {
  return value.replace(/(?<![\w-])url\([^)]*\)/gi, '');
}

function hasExternalSrcset(value) {
  const candidate = /[^ \t\r\n\f,][^ \t\r\n\f]*/g;
  for (let match; (match = candidate.exec(value));) {
    if (externalUrl(match[0])) return true;
    // A URL can contain commas (notably data URLs). Descriptors end at the next comma.
    if (!match[0].endsWith(',')) {
      const next = value.indexOf(',', candidate.lastIndex);
      if (next === -1) break;
      candidate.lastIndex = next + 1;
    }
  }
  return false;
}

function inspectHtml(html, report, options, sectionIds) {
  for (const { tag, attrs, css, foreign } of html.elements) {
    if (tag === 'script') report('error', 'script-tag', 'Scripts are forbidden in section fragments.');
    if (/^(?:html|head|body)$/.test(tag)) {
      report('error', 'document-tag', `<${tag}> belongs to the page, outside section fragments.`);
    }
    for (const [name, value] of attrs) {
      if (/^on./i.test(name)) report('error', 'inline-handler', `Remove ${name} from <${tag}>.`);
      const link = tag === 'a' && name === 'href';
      if (!link && /^(?:src|href|xlink:href|poster)$/.test(name) && externalUrl(value)) {
        report('error', 'external-resource', `<${tag}> ${name} loads an external resource.`);
      }
      if (name === 'srcset' && hasExternalSrcset(value)) {
        report('error', 'external-resource', `<${tag}> srcset loads an external resource.`);
      }
      if (foreign && SVG_URL_ATTRS.has(name) && cssUrls(cssSource(value)).some(externalUrl)) {
        report('error', 'external-resource', `<${tag}> ${name} loads an external resource.`);
      }
      if ((link || (tag === 'area' && name === 'href')) && value.trim().startsWith('#')) {
        const anchor = value.trim().slice(1);
        if (anchor && !sectionIds.has(anchor)) report('warn', 'unknown-anchor', `No section has the id "${anchor}".`);
      }
    }
    if (tag === 'img') {
      if (!attrs.has('alt')) report('error', 'missing-alt', '<img> requires an alt attribute.');
      if (!attrs.get('width')?.trim() || !attrs.get('height')?.trim()) {
        report('warn', 'image-dimensions', '<img> should declare both width and height.');
      }
    }
    if (attrs.has('style')) {
      options.important += collectCss(attrs.get('style'), report, {
        ...options, inline: true, controls: isControl({ tag, attrs }) ? [{ tag, attrs }] : [],
      });
    }
    if (css) options.important += collectCss(foreign ? css.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '') : css, report, options);
  }
}

function isControl({ tag, attrs }) {
  return tag === 'button' || (tag === 'a' && attrs.has('href'));
}

function checkProject(projectDir = DEFAULT_PROJECT) {
  const project = path.resolve(projectDir);
  const findings = [];
  const sections = [];
  function report(file, severity, rule, message) {
    findings.push({ severity, file, rule, message });
  }
  function read(file, required = true) {
    try {
      const data = fs.readFileSync(path.join(project, file));
      return { source: data.toString('utf8'), bytes: data.length };
    } catch (error) {
      if (required || error.code !== 'ENOENT') {
        report(file, 'error', 'file-read', `Cannot read file (${error.code ?? error.message}).`);
      }
      return { source: '', bytes: 0, missing: true };
    }
  }

  let files = [];
  try {
    files = fs.readdirSync(path.join(project, 'sections'));
  } catch (error) {
    report('sections', 'error', 'file-read', `Cannot read sections directory (${error.code ?? error.message}).`);
  }
  const palette = /\bPalette\b/i.test(read('brief.md', false).source);
  const ids = [...new Set(files.filter(file => /^\d{2}-[\w-]+\.(?:html|css)$/.test(file))
    .map(file => path.parse(file).name))].sort();
  const fragments = ids.map(id => {
    const htmlFile = `sections/${id}.html`;
    const cssFile = `sections/${id}.css`;
    const html = read(htmlFile);
    const css = read(cssFile);
    const parsed = parseHtml(html.source);
    const [root] = parsed.roots;
    const scope = `s-${id.slice(0, 2)}`;
    const validRoot = parsed.roots.length === 1 && !parsed.outside && root.closed && ROOT_TAGS.has(root.tag)
      && root.attrs.get('id') === id && (root.attrs.get('class') ?? '').split(HTML_SPACE).includes(scope);
    return { id, htmlFile, cssFile, html, css, parsed, root, validRoot, scope };
  });

  const hero = ids.find(id => /hero/i.test(id.slice(3)));
  const namedHeader = ids.find(id => /^\d{2}-header$/i.test(id));
  const header = namedHeader ?? fragments.find(fragment => fragment.validRoot && fragment.root.tag === 'header')?.id;
  const sectionIds = new Set(fragments.filter(fragment => fragment.validRoot).map(fragment => fragment.id));
  const headings = fragments.flatMap(fragment => fragment.parsed.elements
    .filter(element => element.tag === 'h1').map(() => fragment.id));
  const firstHeading = headings.includes(hero) ? hero : headings[0];
  let keptHeading = false;

  for (const fragment of fragments) {
    const { id, htmlFile, cssFile, html, css, parsed, validRoot, scope } = fragment;
    const htmlReport = report.bind(null, htmlFile);
    const cssReport = report.bind(null, cssFile);
    const options = { scope, palette, header: id === header, controls: parsed.elements.filter(isControl), important: 0 };
    if (!html.missing) {
      if (!parsed.roots.length && !parsed.outside) htmlReport('warn', 'empty-html', 'The section HTML is empty.');
      else if (!validRoot) htmlReport('error', 'section-root', `Expected one section, header, or footer root with id="${id}" and class "${scope}".`);
    }
    // Large inline data: URIs bloat the page and bypass the image library; ask for a normal URL instead.
    for (const [file, text] of [[htmlFile, html.source], [cssFile, css.source]]) {
      const big = (text.match(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=]{20000,}/gi) || []).length;
      if (big) report(file, 'warn', 'inline-large-data-uri', `${big} inline data: URI(s) over 20 KB; reference the image by URL instead.`);
    }
    inspectHtml(parsed, htmlReport, options, sectionIds);
    for (const element of parsed.elements) {
      if (element.tag !== 'h1') continue;
      if (id !== hero) htmlReport('error', 'h1-outside-hero', 'Only the first hero section may contain an <h1>.');
      if (id === firstHeading && !keptHeading) keptHeading = true;
      else htmlReport('error', 'multiple-h1', 'The page must have at most one <h1>.');
    }
    const cssImportant = collectCss(css.source, cssReport, options);
    const important = options.important + cssImportant;
    if (important > 3) {
      const importantReport = cssImportant ? cssReport : htmlReport;
      importantReport('warn', 'too-many-important', `The section uses !important ${important} times.`);
    }
    const count = findings.filter(finding => finding.file === htmlFile || finding.file === cssFile).length;
    sections.push({ section: id, htmlBytes: html.bytes, cssBytes: css.bytes, findings: count });
  }
  const errors = findings.filter(finding => finding.severity === 'error').length;
  return { project, sections, findings, errors, warnings: findings.length - errors };
}

function printReport(result) {
  const rows = [
    ['Section', 'HTML bytes', 'CSS bytes', 'Findings'],
    ...result.sections.map(row => [row.section, row.htmlBytes, row.cssBytes, row.findings].map(String)),
  ];
  const widths = rows[0].map((_, index) => Math.max(...rows.map(row => row[index].length)));
  console.log(rows.map(row => row.map((cell, index) =>
    index ? cell.padStart(widths[index]) : cell.padEnd(widths[index])).join('  ')).join('\n'));
  for (const { severity, file, rule, message } of result.findings) {
    console.log(`${severity} ${file} [${rule}] ${message}`);
  }
  console.log(`${result.sections.length} section(s), ${result.errors} error(s), ${result.warnings} warning(s).`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const positional = args.filter(arg => arg !== '--json');
  if (positional.length > 1 || positional[0]?.startsWith('-')) {
    console.error('Usage: node swarm/tools/check-sections.js [projectDir] [--json]');
    process.exitCode = 1;
  } else {
    const result = checkProject(positional[0]);
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else printReport(result);
    process.exitCode = result.errors ? 1 : 0;
  }
}

module.exports = { checkProject };
