'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const SYSTEM = path.join(ROOT, 'swarm/design-system');
const SOURCE = JSON.parse(fs.readFileSync(path.join(SYSTEM, 'tokens.json'), 'utf8'));
const OUTPUTS = ['tokens.css', 'themes.css', 'TOKENS.md'];
const ROLES = [
  'bg', 'surface', 'surface-2', 'surface-inverse', 'text', 'text-muted', 'text-inverse',
  'on-action', 'border', 'border-strong', 'action', 'action-hover', 'action-active', 'accent',
  'focus', 'success', 'success-bg', 'warning', 'warning-bg', 'danger', 'danger-bg', 'info',
  'info-bg', 'scrim', 'scrim-strong',
];
const COLOR_SCHEME_MEDIA = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';
const DURATIONS = { instant: '0ms', fast: '120ms', base: '220ms', slow: '400ms', reveal: '600ms' };
const BRANDS = ['forest-gold', 'gjh-classic', 'cny-red-gold'];
const MODES = ['light', 'dark'];

function stylesheetRules(css, media = '') {
  const rules = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, head, body] of clean.matchAll(/([^{}]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    const selector = head.trim();
    if (selector.startsWith('@media ')) {
      rules.push(...stylesheetRules(body, selector.slice('@media '.length)));
    } else {
      const values = Object.fromEntries(body.trim().split('\n').map(line => {
        const declaration = /^\s*([\w-]+): (.+);$/.exec(line);
        assert.ok(declaration, `Invalid declaration in ${selector}: ${line}`);
        return declaration.slice(1);
      }));
      rules.push({ media, selectors: selector.split(',').map(part => part.trim()), values });
    }
  }
  return rules;
}

function ruleValues(rules, selector, media = '') {
  const matches = rules.filter(rule => rule.media === media && rule.selectors.includes(selector));
  assert.equal(matches.length, 1, `Expected one rule for ${selector} ${media}`);
  return matches[0].values;
}

function brandSelector(brand) {
  return `[data-brand="${brand}"]`;
}

function themeSelector(mode) {
  return `[data-theme="${mode}"]`;
}

function relativeLuminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, 'Contrast values must be opaque RGB colours');
  const linear = hex.slice(1).match(/../g).map(pair => {
    const srgb = Number.parseInt(pair, 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const [red, green, blue] = linear;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function runBuild(directory, ...args) {
  const result = spawnSync(process.execPath, [path.join(directory, 'build.js'), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  return result;
}

function fixture(t, edit = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sds-tokens-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.copyFileSync(path.join(SYSTEM, 'build.js'), path.join(directory, 'build.js'));
  const source = structuredClone(SOURCE);
  edit(source);
  fs.writeFileSync(path.join(directory, 'tokens.json'), JSON.stringify(source));
  return directory;
}

const stylesheet = filename => fs.readFileSync(path.join(SYSTEM, filename), 'utf8');
const rootValues = ruleValues(stylesheetRules(stylesheet('tokens.css')), ':root');
const themeRules = stylesheetRules(stylesheet('themes.css'));

test('the tokens stylesheet exposes the complete SDS scale contract', () => {
  const exact = {
    'space-1': '4px', 'space-2': '8px', 'space-3': '12px', 'space-4': '16px',
    'space-6': '24px', 'space-8': '32px', 'space-12': '48px', 'space-16': '64px',
    'text-xs': '12px', 'text-sm': '14px', 'text-base': '16px', 'text-lg': '18px',
    'text-xl': '24px', 'text-2xl': '32px', 'text-3xl': '48px',
    'text-display': 'clamp(40px, 9vw, 104px)',
    container: '1200px', tap: '44px', 'header-h': '56px', 'bar-h': '60px',
  };
  for (const [name, value] of Object.entries(DURATIONS)) exact[`dur-${name}`] = value;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    exact[`safe-${side}`] = `env(safe-area-inset-${side}, 0px)`;
  }
  for (const [name, value] of Object.entries(exact)) assert.equal(rootValues[`--sds-${name}`], value, name);

  const otherNames = [
    'font-sans', 'font-mono', 'weight-regular', 'weight-medium', 'weight-bold', 'leading-tight',
    'leading-body', 'tracking-tight', 'tracking-normal', 'radius-sm', 'radius-md', 'radius-lg',
    'radius-pill', 'shadow-1', 'shadow-2', 'z-base', 'z-sticky', 'z-bar', 'z-overlay', 'z-modal',
    'z-toast', 'ease-standard', 'ease-emphasized', 'ease-exit', 'gutter', 'loader-size',
    'skeleton-base', 'skeleton-shine',
  ];
  for (const name of otherNames) assert.ok(rootValues[`--sds-${name}`], `Missing --sds-${name}`);
});

const MATRIX = [
  ['text', ['bg', 'surface', 'surface-2'], 4.5],
  ['text-muted', ['bg', 'surface'], 4.5],
  ['on-action', ['action', 'action-hover', 'action-active'], 4.5],
  ['text-inverse', ['surface-inverse'], 4.5],
  ['focus', ['bg', 'surface'], 3],
  ['border-strong', ['bg'], 3],
  ['success', ['success-bg'], 4.5],
  ['warning', ['warning-bg'], 4.5],
  ['danger', ['danger-bg'], 4.5],
  ['info', ['info-bg'], 4.5],
];

for (const brand of ['none', ...BRANDS]) {
  for (const mode of MODES) {
    const name = `${brand} ${mode}`;
    const raw = brand === 'none' ? SOURCE.themes[mode] : SOURCE.brands[brand][mode];
    const selector = (brand === 'none' ? '' : brandSelector(brand)) + themeSelector(mode);

    test(`${name} defines and emits each semantic role`, () => {
      const values = ruleValues(themeRules, selector);
      assert.deepEqual(Object.keys(raw).sort(), ROLES.map(role => `color-${role}`).sort());
      assert.deepEqual(Object.keys(values).sort(), ['color-scheme', ...ROLES.map(role => `--sds-color-${role}`)].sort());
      for (const role of ROLES) assert.ok(values[`--sds-color-${role}`], role);
      assert.equal(values['color-scheme'], mode);
    });

    test(`${name} meets every SDS contrast threshold`, () => {
      const values = ruleValues(themeRules, selector);
      for (const [foreground, backgrounds, minimum] of MATRIX) {
        for (const background of backgrounds) {
          const ratio = contrastRatio(values[`--sds-color-${foreground}`], values[`--sds-color-${background}`]);
          assert.ok(ratio >= minimum, `${foreground} on ${background}: ${ratio.toFixed(3)} < ${minimum}`);
        }
      }
    });
  }
}

test('default, explicit and auto selectors select the right palettes in cascade order', () => {
  const light = themeSelector('light');
  const dark = themeSelector('dark');
  const auto = themeSelector('auto');
  const defaultLight = ruleValues(themeRules, light);
  for (const role of ROLES) {
    const property = `--sds-color-${role}`;
    assert.equal(rootValues[property], defaultLight[property], property);
  }
  assert.equal(ruleValues(themeRules, ':root')['color-scheme'], 'light');
  assert.deepEqual(ruleValues(themeRules, auto), defaultLight);
  assert.deepEqual(ruleValues(themeRules, auto, COLOR_SCHEME_MEDIA), ruleValues(themeRules, dark));
  assert.ok(themeRules.findIndex(rule => rule.media === COLOR_SCHEME_MEDIA) >
    themeRules.findIndex(rule => rule.selectors.includes(auto)));

  const lastTheme = themeRules.findLastIndex(rule => rule.selectors.some(selector => selector.startsWith('[data-theme=')));
  const firstBrand = themeRules.findIndex(rule => rule.selectors.some(selector => selector.startsWith('[data-brand=')));
  assert.ok(firstBrand > lastTheme, 'Brand layers must follow all base theme rules');
  for (const brand of BRANDS) {
    const selector = brandSelector(brand);
    const lightValues = ruleValues(themeRules, selector + light);
    assert.deepEqual(ruleValues(themeRules, selector), lightValues);
    assert.deepEqual(ruleValues(themeRules, selector + auto), lightValues);
    assert.deepEqual(ruleValues(themeRules, selector + auto, COLOR_SCHEME_MEDIA), ruleValues(themeRules, selector + dark));
    assert.ok(themeRules.findIndex(rule => rule.media === COLOR_SCHEME_MEDIA && rule.selectors.includes(selector + auto)) >
      themeRules.findIndex(rule => rule.selectors.includes(selector + auto)));
  }
});

test('forest-gold dark preserves the home direction palette', () => {
  const values = ruleValues(themeRules, brandSelector('forest-gold') + themeSelector('dark'));
  assert.equal(values['--sds-color-bg'], '#101C16');
  assert.equal(values['--sds-color-surface'], '#192A20');
  assert.equal(values['--sds-color-surface-2'], '#24402F');
  assert.equal(values['--sds-color-text'], '#F4EFE4');
  assert.equal(values['--sds-color-action'], '#E0BD6A');
  assert.equal(values['--sds-color-action-hover'], '#F0D487');
  assert.equal(values['--sds-color-on-action'], '#101C16');
});

test('generated CSS has no unresolved references and owns only --sds- custom properties', () => {
  for (const file of OUTPUTS.filter(name => name.endsWith('.css'))) {
    const css = stylesheet(file);
    assert.doesNotMatch(css, /\{\s*[\w.-]+\s*\}/, file);
    const properties = css.match(/--[\w-]+/g);
    assert.ok(properties?.length, file);
    for (const property of properties) assert.ok(property.startsWith('--sds-'), `${file}: ${property}`);
  }
});

test('reduced motion overrides every duration token to 0.01ms', () => {
  const durations = Object.keys(rootValues).filter(name => name.startsWith('--sds-dur-'));
  assert.ok(durations.length >= Object.keys(DURATIONS).length);
  assert.deepEqual(ruleValues(themeRules, ':root', REDUCED_MOTION_MEDIA),
    Object.fromEntries(durations.map(name => [name, '0.01ms'])));
});

test('the token reference documents each generated property in every palette', () => {
  const document = stylesheet('TOKENS.md');
  const columns = ['Token', 'Light', 'Dark', ...BRANDS.flatMap(brand => MODES.map(mode => `${brand} ${mode}`))];
  assert.ok(document.includes(`| ${columns.join(' | ')} |`));
  const palettes = ['none', ...BRANDS].flatMap(brand => MODES.map(mode => {
    const selector = (brand === 'none' ? '' : brandSelector(brand)) + themeSelector(mode);
    return ruleValues(themeRules, selector);
  }));
  const rows = document.split('\n').filter(line => line.startsWith('| `--sds-'));
  const expected = Object.keys(rootValues).sort().map(property => {
    const values = palettes.map(palette => palette[property] ?? rootValues[property]);
    return `| ${[property, ...values].map(value => `\`${value}\``).join(' | ')} |`;
  });
  assert.deepEqual(rows, expected);
});

test('the builder resolves chained and embedded primitive references', t => {
  const directory = fixture(t, source => {
    source.primitives.size.alias = '{size.unit}';
    source.primitives.size.chain = '{size.alias}';
    source.scale.layout.gutter = 'clamp({size.chain}, 4vw, {size.unit})';
    source.scale.dur.fixture = '10ms';
    source.primitives.color.alias = '{color.slate-50}';
    source.brands['forest-gold'].light['color-bg'] = '{color.alias}';
  });
  const result = runBuild(directory);
  assert.equal(result.status, 0, result.stderr);
  const values = ruleValues(stylesheetRules(fs.readFileSync(path.join(directory, 'tokens.css'), 'utf8')), ':root');
  const rules = stylesheetRules(fs.readFileSync(path.join(directory, 'themes.css'), 'utf8'));
  assert.equal(values['--sds-size-chain'], '4px');
  assert.equal(values['--sds-gutter'], 'clamp(4px, 4vw, 4px)');
  assert.equal(ruleValues(rules, brandSelector('forest-gold') + themeSelector('light'))['--sds-color-bg'], '#F8FAFC');
  assert.equal(ruleValues(rules, ':root', REDUCED_MOTION_MEDIA)['--sds-dur-fixture'], '0.01ms');
});

test('the builder rejects an unknown reference and reports its location', t => {
  const directory = fixture(t, source => { source.themes.dark['color-text'] = '{color.unlisted}'; });
  const result = runBuild(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown token reference \{color\.unlisted\} in themes\.dark\.color-text/);
  for (const file of OUTPUTS) assert.equal(fs.existsSync(path.join(directory, file)), false, file);
});

test('the builder rejects a circular reference and reports its chain', t => {
  const directory = fixture(t, source => {
    source.primitives.size.first = '{size.second}';
    source.primitives.size.second = '{size.first}';
  });
  const result = runBuild(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Circular token reference: size\.second -> size\.first -> size\.second/);
});

test('the builder rejects a self-reference', t => {
  const directory = fixture(t, source => { source.primitives.size.unit = '{size.unit}'; });
  const result = runBuild(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Circular token reference: size\.unit -> size\.unit/);
});

test('the builder rejects a malformed reference instead of emitting braces', t => {
  const directory = fixture(t, source => { source.scale.space['1'] = '{size.unit'; });
  const result = runBuild(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Malformed token reference in scale\.space\.1/);
});

test('the builder rejects a base theme missing a required role', t => {
  const directory = fixture(t, source => { delete source.themes.light['color-focus']; });
  const result = runBuild(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /themes\.light is missing required semantic role color-focus/);
});

test('the builder rejects a brand missing a role even when the base theme defines it', t => {
  const directory = fixture(t, source => { delete source.brands['gjh-classic'].dark['color-info-bg']; });
  const result = runBuild(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /brands\.gjh-classic\.dark is missing required semantic role color-info-bg/);
});

test('--check accepts current outputs and reports a tampered tokens.css without rewriting it', t => {
  const directory = fixture(t);
  const build = runBuild(directory);
  assert.equal(build.status, 0, build.stderr);
  const check = runBuild(directory, '--check');
  assert.equal(check.status, 0, check.stderr);

  const css = path.join(directory, 'tokens.css');
  const original = fs.readFileSync(css, 'utf8');
  const tampered = original.replace('--sds-tap: 44px;', '--sds-tap: 43px;');
  assert.notEqual(tampered, original);
  fs.writeFileSync(css, tampered);
  const failed = runBuild(directory, '--check');
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /tokens\.css differs at line \d+/);
  assert.match(failed.stderr, /-\s+--sds-tap: 43px;/);
  assert.match(failed.stderr, /\+\s+--sds-tap: 44px;/);
  assert.equal(fs.readFileSync(css, 'utf8'), tampered);
});

test('--check reports all stale or missing outputs in a single run', t => {
  const directory = fixture(t);
  const build = runBuild(directory);
  assert.equal(build.status, 0, build.stderr);
  fs.appendFileSync(path.join(directory, 'themes.css'), '/* stale */\n');
  fs.unlinkSync(path.join(directory, 'TOKENS.md'));
  const failed = runBuild(directory, '--check');
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /themes\.css differs at line \d+/);
  assert.match(failed.stderr, /TOKENS\.md is missing/);
});

test('two consecutive builds emit identical bytes for all three files', t => {
  const directory = fixture(t);
  const snapshot = () => OUTPUTS.map(file => fs.readFileSync(path.join(directory, file)));
  const first = runBuild(directory);
  assert.equal(first.status, 0, first.stderr);
  const expected = snapshot();
  const second = runBuild(directory);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(snapshot(), expected);
});
