#!/usr/bin/env node
'use strict';

// First enrollment seeds a project; css-scope stays alongside unscoped-selector; spacing covers margins, padding and gaps.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PROJECT = path.resolve(__dirname, '../projects/home');
const REPO_ROOT = path.resolve(__dirname, '../..');
const BASELINE_FILE = path.join(REPO_ROOT, 'swarm/design-system/ssot-baseline.json');
const VOID_TAGS = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const ROOT_TAGS = new Set(['section', 'header', 'footer']);
const RAW_TAGS = new Set('script style textarea title xmp iframe noembed noframes'.split(' '));
const NON_TEXT_TAGS = new Set(['defs', 'desc', 'head', 'template']);
const SVG_URL_ATTRS = new Set('clip-path cursor fill filter marker marker-end marker-mid marker-start mask stroke'.split(' '));
const CSS_GROUPS = new Set(['media', 'supports', 'layer', 'container', 'starting-style']);
const CSS_LITERALS = /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\\(?:[a-f\d]{1,6}(?:\r\n|[ \t\r\n\f])?|[\s\S])/gi;
const CSS_ESCAPE = /\\(?:([a-f\d]{1,6})(?:\r\n|[ \t\r\n\f])?|(\r\n|[\s\S]))/gi;
const CSS_NAME_ESCAPE = String.raw`\\(?:[a-f\d]{1,6}(?:\r\n|[ \t\r\n\f])?|[^\r\n\f])`;
const CSS_NAME_START = '(?:[a-z_\\u0080-\\uffff]|' + CSS_NAME_ESCAPE + ')';
const CSS_NAME_CHAR = '(?:[\\w\\u0080-\\uffff-]|' + CSS_NAME_ESCAPE + ')';
const CSS_IDENTIFIER = '(?:-?' + CSS_NAME_START + '|--)' + CSS_NAME_CHAR + '*';
const CSS_NUMBER = '[+-]?(?:\\d*\\.\\d+|\\d+)(?:e[+-]?\\d+)?';
const CSS_VALUE_TOKEN = new RegExp([
  String.raw`"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'`,
  CSS_NUMBER + '(?:%|' + CSS_IDENTIFIER + ')?',
  '(' + CSS_IDENTIFIER + ')(\\()?',
  '#' + CSS_NAME_CHAR + '+',
  '\\S',
].join('|'), 'gi');
const CSS_MATH = new Set(['calc', 'clamp', 'max', 'min', '(']);
const CSS_MATH_TERMS = new Set(['0', '100%', '1px', '+', '-', '*', '/', ',']);
const SDS_VARIABLE = /^--sds-[\w-]+$/;
const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|device-cmyk)$/;
const COLOR_KEYWORDS = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue '
  + 'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan '
  + 'darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen '
  + 'darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise '
  + 'darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia '
  + 'gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory '
  + 'khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow '
  + 'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey '
  + 'lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid '
  + 'mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue '
  + 'mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod '
  + 'palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple '
  + 'red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue '
  + 'slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white '
  + 'whitesmoke yellow yellowgreen').split(' '));
const COLOR_PROPERTY = /(?:^|-)color$|^(?:background(?:-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|outline|column-rule|text-decoration|text-emphasis|-webkit-text-stroke|fill|stroke|caret|box-shadow|text-shadow|(?:backdrop-)?filter)$/;
const COLOR_ARGUMENTS = /(?:^|-)gradient$|^(?:drop-shadow|color-mix|light-dark|contrast-color|image)$/;
const SPACING_PROPERTY = /^(?:(?:scroll-)?(?:margin|padding)(?:-[\w-]+)?|(?:grid-)?(?:row-|column-)?gap|border-spacing)$/;
const FONT_LENGTH = new RegExp('^' + CSS_NUMBER + '(?:px|rem|em)$', 'i');
const SPACING_LENGTH = new RegExp('^' + CSS_NUMBER + '(?:[a-z]+|%)?$', 'i');
const DURATION = new RegExp('^' + CSS_NUMBER + 'm?s$', 'i');
const Z_INDEX = new RegExp('^' + CSS_NUMBER + '$', 'i');
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
  const textNodes = [];
  const stack = [];
  let outside = false;
  let end = 0;

  function readText(stop) {
    const parent = stack.at(-1);
    const text = decodeHtml(source.slice(end, stop));
    if (!parent) {
      if (text.trim()) outside = true;
    } else if (!parent.hiddenText && !parent.translatedText) {
      const content = text.replace(/&(?:nbsp|ensp|emsp|thinsp|zwnj|zwj|lrm|rlm|copy|reg|trade|middot|bull|[lrud]arr);/gi, ' ');
      if (/[\p{L}\p{N}]/u.test(content)) textNodes.push({ tag: parent.tag, text: content.trim() });
    }
  }

  for (let match; (match = markup.exec(source));) {
    const [token, close, name, attrSource] = match;
    readText(match.index);
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
    const attrs = htmlAttributes(attrSource);
    const element = {
      tag: tagName, attrs, foreign, closed: false,
      hiddenText: parent?.hiddenText || attrs.has('hidden') || NON_TEXT_TAGS.has(tagName) || RAW_TAGS.has(tagName),
      translatedText: parent?.translatedText || Boolean(attrs.get('data-i18n')?.trim()),
    };
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
  readText(source.length);
  return { roots, elements, outside, textNodes };
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
  for (const match of code.matchAll(/(?<![\w\u0080-\uffff-])[\w\u0080-\uffff-]+\(/g)) {
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
  const property = decodeCss(statement.text.slice(0, colon)).trim().toLowerCase();
  if (!/^(?:--)?[\w-]+$/.test(property)) return null;
  const value = statement.code.slice(colon + 1).trim();
  return {
    property, value: value.replace(/\s*!\s*important$/i, '').trim(),
    important: /!\s*important$/i.test(value), sourceValue: statement.text.slice(colon + 1),
  };
}

function cssValueTerms(value) {
  const terms = [];
  const stack = [terms];
  for (const [source, identifier, opening] of value.matchAll(CSS_VALUE_TOKEN)) {
    if (source === ')' && stack.length > 1) {
      stack.pop();
    } else if (opening || source === '(') {
      const name = opening ? decodeCss(identifier).toLowerCase() : '(';
      const args = [];
      stack.at(-1).push({ name, args });
      stack.push(args);
    } else {
      stack.at(-1).push({ token: decodeCss(source) });
    }
  }
  return terms;
}

function tokenReference(term) {
  return SDS_VARIABLE.test(term.args[0]?.token ?? '');
}

function someCssTerm(terms, inspect) {
  return terms.some(term => term.name !== 'url' && (inspect(term) || (term.args && someCssTerm(term.args, inspect))));
}

function tokenMath(terms) {
  return terms.every(term => {
    if (!term.args) return CSS_MATH_TERMS.has(term.token.toLowerCase());
    if (term.name === 'var') return tokenReference(term) && tokenMath(term.args.slice(1));
    return CSS_MATH.has(term.name) && tokenMath(term.args);
  });
}

function rawNumericValue(terms, literal) {
  return terms.some(term => {
    if (!term.args) return term.token !== '0' && literal.test(term.token);
    if (term.name === 'url') return false;
    if (term.name === 'var') return !tokenReference(term) || rawNumericValue(term.args.slice(1), literal);
    if (CSS_MATH.has(term.name)) return !tokenMath(term.args);
    return rawNumericValue(term.args, literal);
  });
}

function inspectSdsDeclaration({ property, sourceValue }, report) {
  const terms = cssValueTerms(sourceValue);
  if (terms.at(-2)?.token === '!' && terms.at(-1)?.token?.toLowerCase() === 'important') {
    terms.splice(-2);
    report('error', 'important', 'Remove !important from ' + property + '.');
  }
  const custom = property.startsWith('--');
  const colorProperty = COLOR_PROPERTY.test(property);
  const colorAlias = custom && /(?:^|[-_])(?:colou?r|bg|ink|scrim)(?:[-_]|$)/.test(property);
  const rawColor = someCssTerm(terms, term => {
    const word = term.token?.toLowerCase() ?? '';
    if (term.name === 'var') {
      return (colorProperty && !tokenReference(term))
        || (custom && /^--sds-(?:color-|skeleton-(?:base|shine)$)/.test(term.args[0]?.token ?? ''));
    }
    return COLOR_FUNCTION.test(term.name)
      || /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/.test(word)
      || ((colorProperty || custom) && COLOR_KEYWORDS.has(word))
      || (COLOR_ARGUMENTS.test(term.name)
        && someCssTerm(term.args, arg => COLOR_KEYWORDS.has(arg.token?.toLowerCase())))
      || (custom && /^(?:transparent|currentcolor)$/.test(word));
  });
  if (colorAlias || rawColor) report('error', 'raw-color', 'Use an SDS color token directly in ' + property + '.');

  const slash = terms.findIndex(term => term.token === '/');
  const fontTerms = property === 'font' && slash !== -1 ? terms.slice(0, slash) : terms;
  if (/^font(?:-size)?$/.test(property) && rawNumericValue(fontTerms, FONT_LENGTH)) {
    report('error', 'raw-font-size', 'Use an SDS font-size token in ' + property + '.');
  }
  const durationProperty = /^(?:-webkit-)?(?:animation|transition)(?:-(?:duration|delay))?$/.test(property);
  if (someCssTerm(terms, term => DURATION.test(term.token))
    || (durationProperty && rawNumericValue(terms, DURATION))) {
    report('error', 'raw-duration', 'Use an SDS duration token in ' + property + '.');
  }
  const easingProperty = /^(?:-webkit-)?(?:animation|transition)(?:-timing-function)?$/.test(property);
  if (someCssTerm(terms, term => /^(?:cubic-bezier|steps|linear)$/.test(term.name)
    || ((easingProperty || custom) && /^(?:ease(?:-in(?:-out)?|-out)?|linear|step-start|step-end)$/.test(term.token?.toLowerCase()))
    || (property.endsWith('-timing-function') && term.name === 'var' && !tokenReference(term)))) {
    report('error', 'raw-easing', 'Use an SDS easing token in ' + property + '.');
  }
  if (property === 'z-index' && rawNumericValue(terms, Z_INDEX)) {
    report('error', 'raw-z-index', 'Use an SDS stacking token in z-index.');
  }
  if (SPACING_PROPERTY.test(property) && rawNumericValue(terms, SPACING_LENGTH)) {
    report('warn', 'raw-spacing', 'Use an SDS spacing token in ' + property + '.');
  }
}

function inspectSdsDeclarations(statements, report) {
  for (const statement of statements) {
    if (statement.children) {
      inspectSdsDeclarations(statement.children, report);
    } else {
      const item = declaration(statement);
      if (item) inspectSdsDeclaration(item, report);
    }
  }
}

function collectCss(source, report, { scope, inline = false, header = false, controls, palette }) {
  const css = cssSource(source);
  const statements = cssStatements(css);
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
        const message = `Scope every selector in "${statement.text}" to .${scope}.`;
        report('error', 'css-scope', message);
        if (!keyframes) report('error', 'unscoped-selector', message);
      }
      if (!keyframes && children.some((selector, index) => {
        if (facts[index].scoped) return false;
        const last = selectorParts(selector).at(-1)?.piece ?? '';
        return /^\.sds-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(last);
      })) {
        report('error', 'redefine-sds-base', 'Scope overrides of SDS base classes to .' + scope + '.');
      }
      walk(statement.children, {
        ...context, selectors: frame ? [] : children, scoped, keyframes: false,
        tap: !frame && facts.some(fact => isTapSelector(fact, controls)),
      });
    }
  }
  walk(statements, {
    selectors: [], conditions: [], scoped: false, keyframes: false, guarded: false, tap: inline && controls.length > 0,
  });
  inspectSdsDeclarations(statements, report);
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
  for (const { tag, text } of html.textNodes) {
    const preview = text.replace(/\s+/g, ' ').slice(0, 60);
    report('warn', 'no-i18n-text', 'Add a data-i18n key for the text in <' + tag + '> (' + preview + ').');
  }
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
  const counts = new Map();
  for (const { rule } of findings) counts.set(rule, (counts.get(rule) ?? 0) + 1);
  return {
    project, sections, findings, errors, warnings: findings.length - errors,
    counts: Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    baseline: { status: 'not-requested', projectName: path.basename(project), offenders: [] },
  };
}

function readBaseline() {
  let source;
  try {
    source = fs.readFileSync(BASELINE_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  const baseline = JSON.parse(source);
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(baseline) || Object.values(baseline).some(counts => !isObject(counts)
    || Object.values(counts).some(count => !Number.isSafeInteger(count) || count < 0))) {
    throw new Error('Expected project names mapped to rule counts of zero or greater.');
  }
  return baseline;
}

function checkBaseline(result, update) {
  const verdict = result.baseline;
  try {
    const baseline = readBaseline();
    const projectName = verdict.projectName;
    const enrolled = Object.hasOwn(baseline, projectName);
    const allowed = enrolled ? baseline[projectName] : {};
    if (!update || enrolled) {
      verdict.offenders = Object.entries(result.counts).flatMap(([rule, count]) => {
        const limit = Object.hasOwn(allowed, rule) ? allowed[rule] : 0;
        return count > limit ? [{ rule, count, baseline: limit }] : [];
      });
    }
    if (verdict.offenders.length) {
      verdict.status = 'fail';
      if (update) verdict.message = 'Refusing to raise baseline counts. Resolve the listed increases before updating.';
      return;
    }
    if (update) {
      if (result.counts['file-read']) throw new Error('Resolve file-read errors before updating the baseline.');
      const rules = [...new Set([...Object.keys(allowed), ...Object.keys(result.counts)])].sort();
      const next = Object.fromEntries(rules.map(rule => [rule, Object.hasOwn(result.counts, rule) ? result.counts[rule] : 0]));
      if (!enrolled || rules.some(rule => next[rule] !== allowed[rule])) {
        const updated = { ...baseline, [projectName]: next };
        fs.writeFileSync(BASELINE_FILE, JSON.stringify(updated, null, 2) + '\n');
        verdict.message = enrolled ? 'Lowered baseline counts.' : 'Recorded initial baseline counts.';
      } else {
        verdict.message = 'Baseline counts are current.';
      }
    }
    verdict.status = 'pass';
  } catch (error) {
    verdict.status = 'error';
    verdict.message = 'Cannot ' + (update ? 'update' : 'check') + ' ssot-baseline.json. ' + error.message;
  }
}

function runSsotChecks(project) {
  const checks = [
    ['swarm/design-system/build.js', ['--check']],
    ['swarm/tools/i18n-extract.js', [project, '--check']],
  ];
  return checks.map(([file, args]) => {
    const script = path.join(REPO_ROOT, file);
    if (!fs.existsSync(script)) {
      return { check: file, status: 'skip', output: 'Skipped because the script is missing.' };
    }
    const run = spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const output = [run.stdout?.trim(), run.stderr?.trim(), run.error?.message].filter(Boolean).join('\n');
    return { check: file, status: run.status === 0 ? 'pass' : 'fail', output };
  });
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
  const { baseline } = result;
  if (baseline.status !== 'not-requested') {
    console.log(`Baseline ${baseline.status} (${baseline.projectName}).`);
    if (baseline.message) console.log(baseline.message);
    for (const offender of baseline.offenders) {
      console.log(`[${offender.rule}] Count ${offender.count} exceeds baseline ${offender.baseline}.`);
    }
  }
  for (const { check, status, output } of result.ssot ?? []) {
    console.log(`SSOT ${status}: ${check}`);
    if (output) console.log(output);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = new Set(['--json', '--baseline', '--update-baseline', '--ssot']);
  const positional = args.filter(arg => !flags.has(arg));
  if (positional.length > 1 || positional[0]?.startsWith('-')) {
    console.error('Usage: node swarm/tools/check-sections.js [projectDir] [--baseline|--update-baseline] [--ssot] [--json]');
    process.exitCode = 1;
  } else {
    const result = checkProject(positional[0]);
    const update = args.includes('--update-baseline');
    const ratchet = update || args.includes('--baseline');
    if (ratchet) checkBaseline(result, update);
    if (args.includes('--ssot')) result.ssot = runSsotChecks(result.project);
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else printReport(result);
    const failed = ratchet ? result.baseline.status !== 'pass' : result.errors > 0;
    process.exitCode = failed || result.ssot?.some(check => check.status === 'fail') ? 1 : 0;
  }
}

module.exports = { checkProject };
