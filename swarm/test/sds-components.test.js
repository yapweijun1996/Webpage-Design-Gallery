'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dir = path.join(__dirname, '../design-system');
const entry = fs.readFileSync(path.join(dir, 'components.css'), 'utf8');
const toast = fs.readFileSync(path.join(dir, 'toast.css'), 'utf8');
assert.ok(entry.startsWith('@import "./toast.css";'));
const css = entry.replace('@import "./toast.css";', toast);
const html = fs.readFileSync(path.join(dir, 'components.html'), 'utf8');

// Independent copies of the public names in SDS_SPEC.md sections 2 and 3.
const tokens = new Set(Object.entries({
  'color-': 'bg surface surface-2 surface-inverse text text-muted text-inverse on-action border border-strong action action-hover action-active accent focus success success-bg warning warning-bg danger danger-bg info info-bg scrim scrim-strong',
  'space-': '1 2 3 4 6 8 12 16',
  'text-': 'xs sm base lg xl 2xl 3xl display',
  'font-': 'sans mono',
  'weight-': 'regular medium bold',
  'leading-': 'tight body',
  'tracking-': 'tight normal',
  'radius-': 'sm md lg pill',
  'shadow-': '1 2',
  'z-': 'base sticky bar overlay modal toast',
  'dur-': 'instant fast base slow reveal',
  'ease-': 'standard emphasized exit',
  'safe-': 'top right bottom left',
  '': 'container gutter tap header-h bar-h loader-size skeleton-base skeleton-shine',
}).flatMap(([prefix, names]) => names.split(' ').map(name => `--sds-${prefix}${name}`)));

const componentClasses = `
  container stack cluster visually-hidden eyebrow badge
  btn btn--primary btn--secondary btn--ghost btn--danger btn--sm btn--lg
  chip chip--selected card nav nav__brand nav__links nav__menu actionbar
  chapter chapter__media chapter__scrim chapter__body chapter__eyebrow chapter__title
  chapter__text chapter__actions chapter__caption rail rail__item field radio-chip
  disclosure footer prefs skeleton spinner progress toast
`.trim().split(/\s+/).map(name => `sds-${name}`);

const colorNames = new Set(`
  aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
  crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
  dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
  lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
  mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
  mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy
  oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise
  palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
  rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise
  violet wheat white whitesmoke yellow yellowgreen accentcolor accentcolortext activetext
  buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight
  highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext
`.trim().split(/\s+/));

function parseCss(source) {
  // Mask comments and strings so examples and quoted selector values cannot become declarations.
  const clean = source.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    match => match.startsWith('/*') ? ' '.repeat(match.length) : `"${' '.repeat(match.length - 2)}"`);
  const blocks = [];
  const open = [];
  for (const match of clean.matchAll(/([^{};]*)([{};]|$)/g)) {
    const [, fragment, end] = match;
    const entry = fragment.trim();
    if (end === '{') {
      const selector = source.slice(match.index, match.index + fragment.length).replace(/\/\*[\s\S]*?\*\//g, ' ').trim();
      const block = { selector, context: open.map(parent => parent.selector), declarations: [] };
      blocks.push(block);
      open.push(block);
      continue;
    }
    if (entry && open.length) {
      const declaration = /^([\w-]+)\s*:\s*([\s\S]+)$/.exec(entry);
      assert.ok(declaration, `Invalid CSS declaration in ${open.at(-1).selector}: ${entry}`);
      open.at(-1).declarations.push([declaration[1].toLowerCase(), declaration[2]]);
    }
    if (end === '}') assert.ok(open.pop(), 'Unexpected closing CSS brace');
  }
  assert.equal(open.length, 0, 'Unclosed CSS block');
  return blocks;
}

function cssClasses(blocks) {
  return new Set(blocks.filter(block => !block.selector.startsWith('@')).flatMap(({ selector }) => {
    const unquoted = selector.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
    return Array.from(unquoted.matchAll(/\.([a-z_][\w-]*)/gi), match => match[1]);
  }));
}

function lintCss(blocks) {
  const findings = [];
  for (const { selector, declarations } of blocks) {
    for (const [property, value] of declarations) {
      const report = reason => findings.push(`${reason} in ${selector} (${property}: ${value})`);
      for (const [, name] of value.matchAll(/\bvar\(\s*(--[\w-]+)/gi)) {
        if (!tokens.has(name)) report(`Unknown token ${name}`);
      }

      const literals = value.toLowerCase().replace(/\bvar\(\s*--[\w-]+|\burl\([^)]*\)/g, ' ');
      const words = literals.match(/(?<![\w-])[a-z]+(?![\w-])/g) || [];
      if (/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i.test(literals) ||
          words.some(word => colorNames.has(word))) report('Raw colour');
      if (/^font(?:-size)?$/.test(property) && /(?:\d|\.)px\b/.test(literals)) report('Raw px font size');
      if (/^(?:animation|transition)(?:-|$)/.test(property)) {
        if (/(?:\d|\.)(?:ms|s)\b/.test(literals)) report('Raw duration');
        if (/\b(?:ease(?:-in-out|-in|-out)?|linear|step-start|step-end|steps|cubic-bezier)\b/.test(literals)) report('Raw easing');
      }
      if (/!\s*important\b/.test(literals)) report('Forbidden !important');
    }
  }
  return findings;
}

function parseTags(source) {
  const clean = source.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  return Array.from(clean.matchAll(/<([a-z][\w-]*)(\s+(?:"[^"]*"|'[^']*'|[^'">])*)?>/gi),
    ([, name, attributes = '']) => ({
      name: name.toLowerCase(),
      attrs: Object.fromEntries(Array.from(attributes.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g),
        ([, key, double, single, bare]) => [key.toLowerCase(), double ?? single ?? bare ?? ''])),
    }));
}

function tagClasses(tag) {
  return (tag.attrs.class || '').split(/\s+/).filter(Boolean);
}

const rules = parseCss(css);
const tags = parseTags(html);

test('component and demo styles consume only the public tokens and contain no banned literals', () => {
  const inlineStyles = Array.from(html.matchAll(/<style>([\s\S]*?)<\/style>/g), match => match[1]);
  const findings = lintCss([...rules, ...inlineStyles.flatMap(parseCss)]);
  assert.deepEqual(findings, [], findings.join('\n'));
});

test('the CSS checks reject each planted raw literal and unknown token', () => {
  const violations = [
    ['background: #f0f', 'Raw colour'],
    ['border: 1px solid ReBeccapurple', 'Raw colour'],
    ['color: rgb(0 0 0 / 80%)', 'Raw colour'],
    ['color: hsl(120deg 50% 50%)', 'Raw colour'],
    ['color: var(--sds-color-text, red)', 'Raw colour'],
    ['font-size: clamp(2rem, 5vw, 48px)', 'Raw px font size'],
    ['font: 600 16px / 1.2 sans-serif', 'Raw px font size'],
    ['animation-duration: .2s', 'Raw duration'],
    ['transition: opacity 5ms', 'Raw duration'],
    ['transition: transform var(--sds-dur-fast) ease-in-out', 'Raw easing'],
    ['animation-timing-function: cubic-bezier(.2, .8, .8, 1)', 'Raw easing'],
    ['animation-timing-function: linear(0, 1)', 'Raw easing'],
    ['display: none ! IMPORTANT', 'Forbidden !important'],
    ['color: var(--sds-missing)', 'Unknown token --sds-missing'],
    ['color: var(--other-color)', 'Unknown token --other-color'],
  ];
  for (const [declaration, reason] of violations) {
    const findings = lintCss(parseCss(`@media (min-width: 48rem) { .bad { ${declaration} } }`));
    assert.equal(findings.length, 1, declaration);
    assert.ok(findings[0].startsWith(reason), findings[0]);
  }
});

test('the CSS checks accept token shorthands, safe keywords, and comment and string edge cases', () => {
  const fixture = `
    /* .ignored { color: red !important; } */
    .good:where([data-example="{.fake}"]) {
      content: "{ color: red; animation: foo 5ms linear; }";
      background: linear-gradient(90deg, var(--sds-color-scrim), transparent);
      border: 1px solid currentColor;
      font: var(--sds-weight-bold) var(--sds-text-base) / var(--sds-leading-body) var(--sds-font-sans);
      animation: pulse var(--sds-dur-fast) var(--sds-ease-standard);
    }
  `;
  const blocks = parseCss(fixture);
  assert.deepEqual(lintCss(blocks), []);
  assert.deepEqual([...cssClasses(blocks)], ['good']);
});

test('all public classes have selectors and live examples without unknown classes', () => {
  const selectors = cssClasses(rules);
  const examples = new Set(tags.flatMap(tagClasses));
  for (const name of componentClasses) {
    assert.ok(selectors.has(name), `components.css is missing .${name}`);
    assert.ok(examples.has(name), `components.html is missing an example of .${name}`);
  }
  for (const name of examples) assert.ok(selectors.has(name), `Unknown class in components.html: ${name}`);
  assert.deepEqual(parseTags('<!-- <a class=wrong> --><script>"<b class=wrong>"</script><div title=">" class=right>')
    .flatMap(tagClasses), ['right']);
});

test('the sheet links the three relative stylesheets in cascade order and has local chapter media', () => {
  const hrefs = tags.filter(tag => tag.name === 'link' && tag.attrs.rel === 'stylesheet').map(tag => tag.attrs.href);
  assert.deepEqual(hrefs, ['tokens.css', 'themes.css', 'components.css']);
  const image = tags.find(tag => tag.name === 'img' && tagClasses(tag).includes('sds-chapter__media'));
  assert.ok(image?.attrs.alt && image.attrs.width && image.attrs.height, 'Chapter image needs alt and intrinsic dimensions');
  assert.ok(image.attrs.src.startsWith('../') && fs.existsSync(path.resolve(dir, image.attrs.src)), 'Chapter image needs an existing relative path');
  assert.equal(tags.filter(tag => tag.name === 'h1').length, 1);
});

test('the sheet demonstrates keyboard access, native states, Chinese text, and exact 40 percent expansion', () => {
  const elements = name => tags.filter(tag => tagClasses(tag).includes(`sds-${name}`));
  assert.ok(elements('btn').some(tag => tag.name === 'button' && 'disabled' in tag.attrs));
  assert.ok(elements('btn').some(tag => tag.attrs['aria-busy'] === 'true'));
  assert.ok(elements('rail').some(tag => tag.attrs.tabindex === '0' && tag.attrs['aria-label']));
  assert.ok(elements('nav__menu').some(tag => tag.name === 'details'));
  assert.ok(elements('disclosure').some(tag => 'open' in tag.attrs));
  assert.ok(elements('disclosure').some(tag => !('open' in tag.attrs)));
  const radios = tags.filter(tag => tag.name === 'input' && tag.attrs.type === 'radio');
  assert.ok(radios.some(tag => 'checked' in tag.attrs));
  assert.ok(radios.some(tag => 'disabled' in tag.attrs));
  const progress = elements('progress').filter(tag => tag.name === 'progress');
  assert.ok(progress.some(tag => 'value' in tag.attrs) && progress.some(tag => !('value' in tag.attrs)));

  const long = html.match(/id="long-copy">([^<]+)</)[1];
  const expanded = html.match(/id="expanded-copy">([^<]+)</)[1];
  assert.ok(expanded.startsWith(long));
  assert.equal(expanded.length * 5, long.length * 7);
  assert.match(html, /<article[^>]*lang="zh-Hans"[^>]*>\s*<h3>\p{Script=Han}+/u);
});

function declarationsFor(selector, context = () => true) {
  const block = rules.find(rule => rule.selector === selector && context(rule.context));
  assert.ok(block, `Missing CSS rule for ${selector}`);
  return Object.fromEntries(block.declarations);
}

test('responsive components use safe areas, tap size, snap points, and a contrast-backed chapter', () => {
  const nav = declarationsFor('.sds-nav');
  assert.equal(nav.position, 'sticky');
  assert.equal(nav['padding-block-start'], 'var(--sds-safe-top)');
  const bar = declarationsFor('.sds-actionbar');
  assert.equal(bar.position, 'fixed');
  assert.match(bar['min-block-size'], /var\(--sds-bar-h\).*var\(--sds-safe-bottom\)/);
  const floating = declarationsFor('.sds-actionbar', context => context.includes('@media (min-width: 48rem)'));
  assert.equal(floating['border-radius'], 'var(--sds-radius-pill)');
  assert.match(floating.left, /var\(--sds-safe-left\)/);
  assert.match(floating.right, /var\(--sds-safe-right\)/);

  const controlSizes = declarationsFor('.sds-btn,\n.sds-chip,\n.sds-radio-chip');
  assert.equal(controlSizes['min-inline-size'], 'var(--sds-tap)');
  assert.equal(controlSizes['min-block-size'], 'var(--sds-tap)');
  assert.ok(rules.some(rule => rule.selector.includes(':focus-visible') && rule.declarations.some(
    ([property, value]) => property === 'outline' && value.includes('var(--sds-color-focus)'))));

  assert.equal(declarationsFor('.sds-rail')['overflow-x'], 'auto');
  assert.match(declarationsFor('.sds-rail')['scroll-snap-type'], /mandatory/);
  assert.equal(declarationsFor('.sds-rail__item')['scroll-snap-align'], 'start');
  assert.equal(declarationsFor('.sds-chapter')['min-height'], '100svh');
  assert.equal(declarationsFor('.sds-chapter__media')['object-fit'], 'cover');
  assert.equal(declarationsFor('.sds-chapter__scrim').background, 'var(--sds-color-scrim)');
  const copy = declarationsFor('.sds-chapter__body,\n.sds-chapter__caption');
  assert.equal(copy.background, 'var(--sds-color-surface)');
  assert.equal(copy.color, 'var(--sds-color-text)');
  assert.equal(declarationsFor(':lang(zh)')['word-break'], 'keep-all');
  assert.equal(declarationsFor(':lang(zh)')['line-break'], 'strict');
});

test('reveal stays visible by default and supports all modes, delays and the runtime hook', () => {
  const supported = '@supports (animation-timeline: view())';
  const fallback = '@supports not (animation-timeline: view())';
  const noPreference = '@media (prefers-reduced-motion: no-preference)';
  const enhanced = support => context => context.includes(support) && context.includes(noPreference);
  assert.equal(declarationsFor('[data-reveal]', enhanced(supported))['animation-timeline'], 'view()');
  for (const mode of ['fade', 'rise', 'scale']) {
    assert.equal(declarationsFor(`[data-reveal="${mode}"]`, enhanced(supported))['animation-name'], `sds-${mode}`);
    assert.equal(declarationsFor(`[data-reveal="${mode}"][data-revealed]`, enhanced(fallback))['animation-name'], `sds-${mode}`);
  }
  for (const delay of ['1', '2', '3', '4']) {
    const selector = `[data-reveal-delay="${delay}"]`;
    assert.equal(declarationsFor(selector, enhanced(supported))['animation-range-start'], `entry ${delay}0%`);
    assert.match(declarationsFor(`[data-revealed]${selector}`, enhanced(fallback))['animation-delay'], /var\(--sds-dur-fast\)/);
    assert.ok(tags.some(tag => tag.attrs['data-reveal-delay'] === delay), `Missing sample reveal delay ${delay}`);
  }
  const defaultRules = rules.filter(rule => !rule.context.includes(noPreference) && rule.selector.includes('[data-reveal'));
  for (const { declarations } of defaultRules) {
    assert.ok(!declarations.some(([property, value]) =>
      /^(opacity|visibility|display|animation)/.test(property) && !(property === 'animation' && value === 'none')));
  }
});

test('motion changes only opacity and transform, with an explicit reduced-motion override', () => {
  const moving = rules.filter(rule => rule.context.some(parent => parent.startsWith('@keyframes')));
  assert.ok(moving.length > 0);
  for (const rule of moving) {
    for (const [property] of rule.declarations) assert.ok(['opacity', 'transform'].includes(property), `Animated ${property}`);
  }
  const reduce = rules.filter(rule => rule.context.includes('@media (prefers-reduced-motion: reduce)'));
  for (const selector of ['.sds-spinner', '.sds-btn[aria-busy="true"]::before', '.sds-skeleton::after', '[data-reveal]']) {
    assert.ok(reduce.some(rule => rule.selector.includes(selector) &&
      rule.declarations.some(([property, value]) => property === 'animation' && value === 'none')), `Missing reduced-motion override for ${selector}`);
  }
  assert.ok(reduce.some(rule => rule.declarations.some(([property, value]) => property === 'transition' && value === 'none')));
  assert.equal(declarationsFor('.sds-skeleton::after').position, 'absolute');
});

function demoFixture() {
  const listeners = new Map();
  const nodes = new Map();
  const root = {
    lang: 'en',
    dataset: { theme: 'auto', brand: 'none' },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  function node(selector) {
    if (!nodes.has(selector)) {
      const attributes = new Map();
      const classes = new Set();
      nodes.set(selector, {
        classList: { toggle(name, selected) { if (selected) classes.add(name); else classes.delete(name); } },
        classes,
        focused: false,
        hidden: false,
        textContent: '',
        lastElementChild: { hidden: false },
        getAttribute(name) { return attributes.get(name); },
        setAttribute(name, value) { attributes.set(name, value); },
        matches(candidate) { return candidate.split(', ').includes(selector); },
        closest() { return this; },
        focus() { this.focused = true; },
      });
    }
    return nodes.get(selector);
  }
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, { document: { documentElement: root, querySelector: node } }, { filename: 'components.html' });
  return {
    root,
    node,
    change(sdsSelect, value) { listeners.get('change')({ target: { dataset: { sdsSelect }, value } }); },
    click(target) {
      let prevented = false;
      listeners.get('click')({ target, preventDefault() { prevented = true; } });
      return prevented;
    },
  };
}

test('preference changes switch all themes, brands and preview languages and ignore unknown values', () => {
  const { root, change, node } = demoFixture();
  for (const theme of ['light', 'dark', 'auto']) {
    change('theme', theme);
    assert.equal(root.dataset.theme, theme);
  }
  for (const brand of ['forest-gold', 'gjh-classic', 'none']) {
    change('brand', brand);
    assert.equal(root.dataset.brand, brand);
  }
  const heading = node('[data-sheet-language="title"]');
  for (const [language, title] of [['zh-Hans', '自提预览'], ['ms', 'Pratonton ambilan'], ['en', 'Pickup preview']]) {
    change('lang', language);
    assert.equal(root.lang, language);
    assert.equal(heading.textContent, title);
  }
  change('lang', '__proto__');
  change('theme', 'broken');
  change('brand', 'broken');
  assert.deepEqual(root.dataset, { theme: 'auto', brand: 'none' });
  assert.equal(root.lang, 'en');
  assert.equal(heading.textContent, 'Pickup preview');
});

test('the sheet toggles chip selection, busy and loading states while blocking disabled actions', () => {
  const { node, click } = demoFixture();
  const chip = node('[data-sheet-chip]');
  click(chip);
  assert.equal(chip.getAttribute('aria-pressed'), 'true');
  assert.ok(chip.classes.has('sds-chip--selected'));
  click(chip);
  assert.equal(chip.getAttribute('aria-pressed'), 'false');
  assert.ok(!chip.classes.has('sds-chip--selected'));
  chip.setAttribute('aria-disabled', 'true');
  assert.equal(click(chip), true);
  assert.equal(chip.getAttribute('aria-pressed'), 'false');

  const busy = node('[data-sheet-toggle-busy]');
  busy.setAttribute('aria-busy', 'false');
  click(busy);
  assert.equal(busy.getAttribute('aria-busy'), 'true');
  click(busy);
  assert.equal(busy.getAttribute('aria-busy'), 'false');

  const load = node('[data-sheet-loading]');
  const switchLoad = node('[data-sheet-toggle-load]');
  load.setAttribute('aria-busy', 'true');
  click(switchLoad);
  assert.equal(load.getAttribute('aria-busy'), 'false');
  assert.equal(load.lastElementChild.hidden, true);
  assert.equal(switchLoad.textContent, 'Show skeleton');
  click(switchLoad);
  assert.equal(load.getAttribute('aria-busy'), 'true');
  assert.equal(load.lastElementChild.hidden, false);
  assert.equal(switchLoad.textContent, 'Show loaded content');
});

test('the toast demo supports action and dismissal and restores focus to its trigger', () => {
  const { node, click } = demoFixture();
  const toast = node('#update-toast');
  const trigger = node('[data-sheet-show-toast]');
  const update = node('[data-sheet-update]');
  const status = node('[data-sheet-toast-status]');
  for (const [action, message] of [[update, 'Example update accepted.'], [node('[data-sheet-dismiss]'), 'Update dismissed.']]) {
    toast.hidden = true;
    trigger.focused = false;
    update.focused = false;
    click(trigger);
    assert.equal(toast.hidden, false);
    assert.equal(status.textContent, '');
    assert.equal(update.focused, true);
    click(action);
    assert.equal(toast.hidden, true);
    assert.equal(status.textContent, message);
    assert.equal(trigger.focused, true);
  }
});
