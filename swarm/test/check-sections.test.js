'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { checkProject } = require('../tools/check-sections');

const cli = path.join(__dirname, '../tools/check-sections.js');

function fixture(t, sections, brief) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-check-sections-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'sections'));
  if (brief !== undefined) fs.writeFileSync(path.join(project, 'brief.md'), brief);
  for (const [id, { html, css }] of Object.entries(sections)) {
    if (html !== undefined) fs.writeFileSync(path.join(project, 'sections', id + '.html'), html);
    if (css !== undefined) fs.writeFileSync(path.join(project, 'sections', id + '.css'), css);
  }
  return project;
}

function fragment(id, body = '', tag = 'section') {
  return '<' + tag + ' class="s-' + id.slice(0, 2) + '" id="' + id + '">' + body + '</' + tag + '>';
}

function rules(result, severity) {
  return result.findings.filter(finding => finding.severity === severity).map(finding => finding.rule).sort();
}

test('valid fragments support link, root and wrapper variations', t => {
  const html = '<!-- intro -->\n<SECTION id=02-main-hero class="other s-02" data-copy="a > b">'
    + '<h1 data-i18n=hero.title>Café</h1><a href="#03-footer" data-i18n=hero.contact>Contact</a>'
    + '<a href="https://example.test" data-i18n=hero.offsite>Offsite</a>'
    + '<img src="./sample.webp" alt="" width="100" height="60">'
    + '<svg><defs><path id="shape" d="M0 0" /></defs><use href="#shape" /></svg></SECTION>';
  const css = [
    '.s-02:focus, .theme .s-02 > h1 { color: var(--sds-color-text); }',
    '@supports (display: grid) { @media (width >= 48em) { .s-02 .chart { width: 600px; } } }',
    '@keyframes reveal { from { opacity: 0; } 60%, to { opacity: 1; } }',
    ':is(.s-02, .s-02.active) > p { margin: 0; }',
    '.s-02 > h1 + p { margin: 0; }',
  ].join('\n');
  const project = fixture(t, {
    '03-footer': { html: fragment('03-footer', '', 'footer'), css: '' },
    '02-main-hero': { html, css },
    '01-header': { html: fragment('01-header', '', 'header'), css: '.s-01 { position: fixed; }' },
  });
  const result = checkProject(project);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.sections.map(row => row.section), ['01-header', '02-main-hero', '03-footer']);
  assert.deepEqual(result.sections[1], {
    section: '02-main-hero', htmlBytes: Buffer.byteLength(html), cssBytes: Buffer.byteLength(css), findings: 0,
  });
});

test('each non-empty HTML file must have one matching top-level root', t => {
  const project = fixture(t, {
    '01-extra-root': { html: fragment('01-extra-root') + '<span></span>', css: '' },
    '02-wrong-class': { html: '<section class=s-20 id=02-wrong-class></section>', css: '' },
    '03-wrong-id': { html: '<section class=s-03 id=not-the-id></section>', css: '' },
    '04-wrong-tag': { html: fragment('04-wrong-tag', '', 'div'), css: '' },
    '05-top-text': { html: 'stray ' + fragment('05-top-text'), css: '' },
    '06-unclosed': { html: '<section class=s-06 id=06-unclosed><span></span>', css: '' },
  });
  const result = checkProject(project);
  assert.equal(result.errors, 6);
  assert.deepEqual(rules(result, 'error'), Array(6).fill('section-root'));
});

test('real HTML tags, resource attributes and inline CSS are checked', t => {
  const html = fragment('01-hero', [
    '<h1 data-i18n=hero.title>Hero</h1><head></head><html><body></body></html>',
    '<SCRIPT>let example = "<h1>ignored</h1>";</SCRIPT>',
    '<img src="https&#58;//example.test/pic.png" width=100 height=32>',
    '<button ONCLICK="if (1 > 0) run()" data-i18n=hero.cta>Go</button>',
    '<a href=https://example.test data-i18n=hero.link>Link</a><link href="//example.test/styles.css">',
    '<div style="background: url(https://example.test/inline.png)"></div>',
    '<img srcset="./local.png 1x,https://example.test/remote.png 2x" alt="" width=100 height=32>',
    '<svg><use xlink:href="https://example.test/icons.svg#shape" />'
      + '<path fill="url(https://example.test/paint.svg#color)" />'
      + '<style><![CDATA[.s-01 path { filter: url(https://example.test/filter.svg#blur); }]]></style></svg>',
    '<style>body { margin: 0 }</style>',
  ].join('\n'));
  const result = checkProject(fixture(t, { '01-hero': { html, css: '' } }));
  assert.deepEqual(rules(result, 'error'), [
    'css-scope', ...Array(3).fill('document-tag'), ...Array(7).fill('external-resource'),
    'inline-handler', 'missing-alt', 'script-tag', 'unscoped-selector',
  ]);
  assert.equal(result.sections[0].findings, 15);
  assert.deepEqual(rules(result, 'warn'), []);
});

test('comments, strings and raw HTML text do not create findings', t => {
  const html = fragment('01-content',
    '<!-- <img src=https://example.test><script></script> -->'
    + '<textarea><h1>literal</h1><img src=https://example.test></textarea>'
    + '<span data-i18n=content.copy title="onclick=foo() > #abc">Text</span>'
    + '<img alt="" src=./local.png width=16 height=16>');
  const css = [
    '/* body { color: #abc; background: url(https://example.test); } */',
    '.s-01 [data-copy="}, ; .s-99, :root"]::before {',
    '  content: "url(https://example.test) #abc rgb(0 0 0) !important } ;";',
    '  background: url("data:image/svg+xml,<svg id=\'#abc\'></svg>"); opacity: 1;',
    '}',
  ].join('\n');
  const result = checkProject(fixture(t, { '01-content': { html, css } }));
  assert.deepEqual(result.findings, []);
});

test('selector lists, functional pseudos and nested rules cannot escape scope', t => {
  const html = fragment('02-hero', '<h1>Hero</h1>');
  const css = [
    '.s-02 p, .outside { display: block; }',
    '@supports (display: grid) { @media (min-width: 700px) { #escape { display: grid; } } }',
    '@keyframes show { from, 50% { opacity: 0; } to { opacity: 1; } }',
    '.s-02x, .fake:not(.s-02), [data-class=".s-02"] { display: block; }',
    ':is(.s-02, .outside) p { display: block; }',
    '.s-02 + .outside { display: block; }',
    '.s-02 :root { display: block; }',
    '.s-02 { & > p, &.dark { display: block; } & ~ aside { opacity: 0; } }',
    '@keyframes invalid { .s-02 { opacity: 1; } }',
  ].join('\n');
  const result = checkProject(fixture(t, { '02-hero': { html, css } }));
  assert.deepEqual(rules(result, 'error'), [...Array(8).fill('css-scope'), ...Array(7).fill('unscoped-selector')]);
});

test('CSS URLs handle quoting, parentheses, escapes and imports', t => {
  const html = fragment('01-prose', '<p>Prose</p>');
  const css = [
    '@import "https://example.test/theme.css";',
    '.s-01 { background: url("https://example.test/a)b.png"), url(\\68 ttps://example.test/a.png), \\75rl(https://example.test/b.png); }',
    '.s-01 { mask: url(#shape); background-image: url(/local.png); }',
  ].join('\n');
  const result = checkProject(fixture(t, { '01-prose': { html, css } }));
  assert.deepEqual(rules(result, 'error'), ['css-scope', ...Array(4).fill('external-resource')]);
});

test('the lowest-numbered hero owns the page h1 and anchors target section roots', t => {
  const project = fixture(t, {
    '05-hero-repeat': { html: fragment('05-hero-repeat', '<h1>Later</h1>'), css: '' },
    '01-header': { html: fragment('01-header', '<h1>Early</h1><a href=#02-main-hero>Hero</a>'), css: '' },
    '02-main-hero': { html: fragment('02-main-hero', '<h1>First</h1><h1>Duplicate</h1><p id=inner>Inner</p>'
      + '<a href="#inner">Child</a><a href="#missing">Missing</a>'), css: '' },
    '06-empty': { html: '  \n<!-- unbuilt -->\n', css: '' },
  });
  const result = checkProject(project);
  assert.deepEqual(rules(result, 'error'), [...Array(2).fill('h1-outside-hero'), ...Array(3).fill('multiple-h1')]);
  assert.deepEqual(rules(result, 'warn'), ['empty-html', ...Array(8).fill('no-i18n-text'), 'unknown-anchor', 'unknown-anchor']);
  assert.equal(result.sections.find(section => section.section === '02-main-hero').findings, 8);
});

test('warnings detect mobile and token risks without flagging responsive guards', t => {
  const html = fragment('02-hero', '<h1>Hero</h1><button class=cta>Go</button><a href="/more">More</a>'
    + '<img src="./example.png" alt="Example" width=120>');
  const css = [
    '.s-02 { --shade: #123; color: rgb(1 2 3); background: hsl(0 0% 0%); }',
    '.s-02 .cta { min-height: 43px; } .s-02 :is(a, button) { height: 30px; }',
    '.s-02 .cta svg, .s-02 a::before, .s-02 p { height: 10px; }',
    '.s-02 a { height: 44px; } .s-02 h1 { font-size: 12px; }',
    '.s-02 p { font-size: 11.5px; position: fixed; width: 450px; }',
    '.s-02 blockquote { width: 500px; max-width: 95%; }',
    '.s-02 cite { width: 500px; } .s-02 cite { max-width: 100vw; }',
    '.s-02 address { width: 500px; } @media (max-width: 393px) { .s-02 address { width: auto; } }',
    '@media (width >= 48em) { .s-02 form { width: 600px; } }',
    '@media (width > 393px) { .s-02 figure { width: 600px; } }',
    '@media (prefers-reduced-motion: reduce) { .s-02 pre { min-width: 420px; } }',
    '.s-02 em { color: inherit !important; margin: 0 !important; padding: 0 !important; display: block !important; }',
  ].join('\n');
  const result = checkProject(fixture(t, { '02-hero': { html, css } }));
  assert.deepEqual(rules(result, 'error'), [
    ...Array(4).fill('important'), ...Array(3).fill('raw-color'), ...Array(2).fill('raw-font-size'),
  ]);
  assert.deepEqual(rules(result, 'warn'), [
    'fixed-position', 'fixed-width', 'fixed-width', 'hard-coded-color', 'hard-coded-color', 'hard-coded-color',
    'image-dimensions', ...Array(3).fill('no-i18n-text'),
    'small-font', 'small-tap-target', 'small-tap-target', 'too-many-important',
  ]);
});

test('a brief palette allows only leading custom properties in scoped rules', t => {
  const html = fragment('01-content', '<p style="color: #123">Text</p>');
  const css = [
    '.s-01 { --ink: #aabbcc; --line: rgba(0, 0, 0, .2); color: var(--ink); --late: #fff; }',
    '.s-01 p { background-color: hsl(0 0% 0%); padding: 0 !important; margin: 0 !important; width: auto !important; }',
  ].join('\n');
  const result = checkProject(fixture(t, { '01-content': { html, css } }, '## Palette\nDefined in CSS.'));
  assert.deepEqual(rules(result, 'error'), [...Array(3).fill('important'), ...Array(6).fill('raw-color')]);
  assert.deepEqual(rules(result, 'warn'), [...Array(3).fill('hard-coded-color'), 'no-i18n-text']);
});

test('the CLI emits pure JSON or a summary and reserves status 1 for errors', t => {
  const project = fixture(t, { '01-content': { html: '', css: '' } });
  const warning = spawnSync(process.execPath, [cli, project, '--json'], { encoding: 'utf8' });
  assert.equal(warning.status, 0, warning.stderr);
  assert.equal(warning.stderr, '');
  assert.deepEqual(JSON.parse(warning.stdout), checkProject(project));
  assert.equal(JSON.parse(warning.stdout).warnings, 1);

  fs.writeFileSync(path.join(project, 'sections/02-orphan.css'), 'body { color: inherit; }');
  const failure = spawnSync(process.execPath, [cli, '--json', project], { encoding: 'utf8' });
  assert.equal(failure.status, 1, failure.stderr);
  assert.deepEqual(rules(JSON.parse(failure.stdout), 'error'), ['css-scope', 'file-read', 'unscoped-selector']);

  const human = spawnSync(process.execPath, [cli, project], { encoding: 'utf8' });
  assert.equal(human.status, 1, human.stderr);
  assert.match(human.stdout, /Section\s+HTML bytes\s+CSS bytes\s+Findings/);
  assert.match(human.stdout, /01-content\s+0\s+0\s+1/);
  assert.match(human.stdout, /2 section\(s\), 3 error\(s\), 1 warning\(s\)\./);
});

const declarationCases = [
  ['raw-color', 'error', [
    'color: Rebeccapurple', 'color: rgb(0 0 0 / 50%)', 'background: linear-gradient(#fff, hsl(0 0% 0%))',
    'border: 1px solid var(--ink)', '--tint: var(--sds-color-action)', '--brand: currentColor',
    'outline: 1px solid var(--sds-color-focus, red)', 'color: \\72 ed',
    'border-image: linear-gradient(red, blue) 1',
  ], 'color: var(--sds-color-text); border: 1px solid currentColor; background: transparent'],
  ['raw-font-size', 'error', [
    'font-size: 14px', 'font-size: 1.25rem', 'font: italic 1em/1.4 sans-serif', 'font-size: 16\\70 x',
    'font-size: clamp(var(--sds-text-sm), 4vw, var(--sds-text-lg))',
    'font-size: var(--sds-text-base, 16px)', 'font-size: var(--local-size)',
  ], 'font: italic var(--sds-text-base)/1.4 sans-serif; font-size: clamp(var(--sds-text-sm), 100%, var(--sds-text-lg))'],
  ['raw-duration', 'error', [
    'transition-duration: 0ms', 'animation: rise .5s var(--sds-ease-standard)',
    'animation-delay: -120ms', 'transition: opacity calc(2 * var(--sds-dur-fast))',
  ], 'animation: rise var(--sds-dur-fast) var(--sds-ease-standard); animation-delay: 0'],
  ['raw-easing', 'error', [
    'animation: rise var(--sds-dur-base) ease-in-out', 'transition-timing-function: cubic-bezier(.4, 0, .2, 1)',
    'animation-timing-function: steps(2, end)', 'transition: opacity var(--sds-dur-fast) linear(0, 1)',
    'animation-timing-function: var(--old-easing)',
  ], 'animation-timing-function: var(--sds-ease-standard); animation-name: linear'],
  ['raw-z-index', 'error', ['z-index: 3', 'z-index: -2', 'z-index: calc(var(--sds-z-base) + 2)'],
    'z-index: var(--sds-z-sticky); z-index: 0'],
  ['raw-spacing', 'warn', [
    'padding-inline: 8px 0', 'margin-block: 0 1rem', 'column-gap: min(100%, 2em)', 'row-gap: 10%',
  ], 'padding: var(--sds-space-2) 0; gap: min(100%, var(--sds-space-4)); margin: auto'],
  ['important', 'error', ['opacity: 1 !important', 'display: grid ! /* comment */ IMPORTANT', 'margin: 0 !\\69 mportant'],
    'opacity: 1; content: " !important "'],
];

for (const [rule, severity, violations, clean] of declarationCases) {
  test(rule + ' reports each planted CSS declaration and accepts tokenized values', t => {
    const css = violations.map(value => '.s-01 { ' + value + '; }').join('\n');
    const result = checkProject(fixture(t, {
      '01-bad': { html: fragment('01-bad'), css },
      '02-clean': { html: fragment('02-clean'), css: '.s-02 { ' + clean + '; }' },
    }));
    const findings = result.findings.filter(finding => finding.rule === rule);
    assert.equal(findings.length, violations.length);
    assert.ok(findings.every(finding => finding.file === 'sections/01-bad.css' && finding.severity === severity));
    assert.equal(result.sections[1].findings, 0);
  });
}

test('SDS rules also inspect inline and embedded CSS and accept nested token math', t => {
  const html = fragment('01-content', '<p style="color: &#114;ed; z-index: 2; opacity:1 !important"></p>'
    + '<style>.s-01 p { font-size: 1em; padding: 2px; }</style>'
    + '<p style="color: inherit; border-color: currentColor; background: transparent;"></p>');
  const css = [
    '.s-01 { font-size: clamp(var(--sds-text-sm), max(100%, var(--sds-text-base)), var(--sds-text-lg)); }',
    '.s-01 p { margin: calc(var(--sds-space-2) + (1px - 0)); padding: min(var(--sds-space-2), 100%); }',
    '.s-01 a { z-index: calc(var(--sds-z-base) + 0); transition: none; background: url("/red/black.png"); }',
    '.s-01 p::before { content: "black !important 20px"; font-family: Ivory, sans-serif; }',
  ].join('\n');
  const result = checkProject(fixture(t, { '01-content': { html, css } }));
  assert.deepEqual(rules(result, 'error'), ['important', 'raw-color', 'raw-font-size', 'raw-z-index']);
  assert.deepEqual(rules(result, 'warn'), ['raw-spacing']);
  assert.ok(result.findings.every(finding => finding.file === 'sections/01-content.html'));
});

test('no-i18n-text reports visible text nodes without a key', t => {
  const html = fragment('01-content', '<p>Copy <span data-i18n=content.topic>Topic</span> 123</p>'
    + '<p data-i18n-attr="title:content.title">中文</p><p data-i18n="">Unmarked</p>'
    + '<p data-i18n=content.nested><span>Covered</span></p><div hidden><p>Hidden</p></div>'
    + '<template><p>Template</p></template><!-- Comment --><p>&nbsp; &rarr; &#8594;</p>');
  const result = checkProject(fixture(t, { '01-content': { html, css: '' } }));
  assert.deepEqual(rules(result, 'error'), []);
  assert.deepEqual(rules(result, 'warn'), Array(4).fill('no-i18n-text'));
  assert.deepEqual(result.findings.map(finding => finding.message.match(/\((.*)\)/)[1]), ['Copy', '123', '中文', 'Unmarked']);
});

test('missing-alt requires the attribute and accepts decorative and translated alternatives', t => {
  const html = fragment('01-content', '<img src=bad.png width=32 height=32>'
    + '<img src=decorative.png alt="" width=32 height=32>'
    + '<img src=good.png alt="A diagram" data-i18n-attr="alt:content.diagram" width=32 height=32>');
  const result = checkProject(fixture(t, { '01-content': { html, css: '' } }));
  assert.deepEqual(rules(result, 'error'), ['missing-alt']);
  assert.deepEqual(rules(result, 'warn'), []);
});

test('redefine-sds-base and unscoped-selector distinguish scoped overrides and bare base targets', t => {
  const css = [
    '.sds-btn, .outer .sds-card { color: inherit; }',
    '.s-01 + .sds-chip { color: inherit; }',
    '.outer .sds-btn--primary, .outer .sds-nav__brand, .outer .sds-chip:hover { color: inherit; }',
    '.s-01 .sds-btn, .s-01.sds-card { color: inherit; }',
    '.s-01 { & > .sds-chip { color: inherit; } }',
  ].join('\n');
  const result = checkProject(fixture(t, { '01-content': { html: fragment('01-content'), css } }));
  assert.deepEqual(rules(result, 'error'), [
    ...Array(3).fill('css-scope'), ...Array(2).fill('redefine-sds-base'), ...Array(3).fill('unscoped-selector'),
  ]);
  assert.deepEqual(rules(result, 'warn'), []);
});

test('inline-large-data-uri retains its existing boundary without treating a URL as a color', t => {
  const image = 'data:image/png;base64,';
  const html = fragment('01-content', '<img alt="" width=32 height=32 src="' + image + 'A'.repeat(19999) + '">');
  const css = '.s-01 { background-image: url("' + image + 'A'.repeat(20000) + '"); }';
  const result = checkProject(fixture(t, { '01-content': { html, css } }));
  assert.deepEqual(rules(result, 'error'), []);
  assert.deepEqual(rules(result, 'warn'), ['inline-large-data-uri']);
  assert.equal(result.findings[0].file, 'sections/01-content.css');
});

function isolatedCli(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-check-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['swarm/tools', 'swarm/design-system']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  const script = path.join(root, 'swarm/tools/check-sections.js');
  fs.copyFileSync(cli, script);
  const run = (project, ...flags) => spawnSync(process.execPath, [script, project, ...flags], { cwd: root, encoding: 'utf8' });
  return { root, run, baselineFile: path.join(root, 'swarm/design-system/ssot-baseline.json') };
}

test('baseline enrolls once, tolerates recorded findings, lowers counts and refuses regressions', t => {
  const { run, baselineFile } = isolatedCli(t);
  const project = fixture(t, {
    '01-content': { html: fragment('01-content'), css: '.s-01 { color: red; background: blue; padding: 8px; }' },
  });
  const projectName = path.basename(project);
  const cssFile = path.join(project, 'sections/01-content.css');
  const first = run(project, '--baseline', '--json');
  assert.equal(first.status, 1, first.stderr);
  assert.deepEqual(JSON.parse(first.stdout).baseline, {
    status: 'fail', projectName,
    offenders: [{ rule: 'raw-color', count: 2, baseline: 0 }, { rule: 'raw-spacing', count: 1, baseline: 0 }],
  });
  const enrollment = run(project, '--update-baseline');
  assert.equal(enrollment.status, 0, enrollment.stderr);
  assert.match(enrollment.stdout, /Recorded initial baseline counts/);
  assert.deepEqual(JSON.parse(fs.readFileSync(baselineFile)), { [projectName]: { 'raw-color': 2, 'raw-spacing': 1 } });

  const accepted = run(project, '--baseline', '--json');
  assert.equal(accepted.status, 0, accepted.stderr);
  const report = JSON.parse(accepted.stdout);
  assert.deepEqual(report.baseline, { status: 'pass', projectName, offenders: [] });
  assert.deepEqual(report.counts, { 'raw-color': 2, 'raw-spacing': 1 });
  assert.equal(report.errors, 2);
  assert.ok(report.findings.some(finding => finding.rule === 'raw-color'));

  fs.writeFileSync(cssFile, '.s-01 { color: red; }');
  const lowered = run(project, '--update-baseline');
  assert.equal(lowered.status, 0, lowered.stderr);
  assert.match(lowered.stdout, /Lowered baseline counts/);
  const saved = fs.readFileSync(baselineFile, 'utf8');
  assert.deepEqual(JSON.parse(saved), { [projectName]: { 'raw-color': 1, 'raw-spacing': 0 } });

  fs.writeFileSync(cssFile, '.s-01 { padding: 8px; opacity: 1 !important; }');
  const refused = run(project, '--update-baseline');
  assert.equal(refused.status, 1, refused.stderr);
  assert.match(refused.stdout, /Refusing to raise baseline counts/);
  assert.match(refused.stdout, /\[important\] Count 1 exceeds baseline 0/);
  assert.match(refused.stdout, /\[raw-spacing\] Count 1 exceeds baseline 0/);
  assert.equal(fs.readFileSync(baselineFile, 'utf8'), saved);
  assert.equal(run(project, '--baseline').status, 1);
});

test('an invalid baseline file fails with a structured error and remains intact', t => {
  const { run, baselineFile } = isolatedCli(t);
  const project = fixture(t, { '01-content': { html: fragment('01-content'), css: '' } });
  const corrupt = '{"project":{"raw-color":-1}}';
  fs.writeFileSync(baselineFile, corrupt);
  const failure = run(project, '--update-baseline', '--json');
  assert.equal(failure.status, 1, failure.stderr);
  const report = JSON.parse(failure.stdout);
  assert.equal(report.baseline.status, 'error');
  assert.match(report.baseline.message, /rule counts of zero or greater/);
  assert.equal(fs.readFileSync(baselineFile, 'utf8'), corrupt);
});

test('--ssot skips missing peer tools and reports passing and failing subprocesses in JSON', t => {
  const { root, run } = isolatedCli(t);
  const project = fixture(t, { '01-content': { html: fragment('01-content'), css: '' } });
  const skip = run(project, '--ssot');
  assert.equal(skip.status, 0, skip.stderr);
  assert.match(skip.stdout, /SSOT skip: swarm\/design-system\/build\.js\nSkipped because the script is missing/);
  assert.match(skip.stdout, /SSOT skip: swarm\/tools\/i18n-extract\.js/);
  fs.writeFileSync(path.join(root, 'swarm/design-system/build.js'),
    'if (process.argv.slice(2).join() !== "--check") process.exit(2); console.log("Tokens current");');
  fs.writeFileSync(path.join(root, 'swarm/tools/i18n-extract.js'),
    'if (process.argv[2] !== ' + JSON.stringify(project) + ' || process.argv[3] !== "--check") process.exit(2);'
    + 'console.error("Catalog stale"); process.exit(1);');
  const failure = run(project, '--ssot', '--json');
  assert.equal(failure.status, 1, failure.stderr);
  assert.equal(failure.stderr, '');
  assert.deepEqual(JSON.parse(failure.stdout).ssot, [
    { check: 'swarm/design-system/build.js', status: 'pass', output: 'Tokens current' },
    { check: 'swarm/tools/i18n-extract.js', status: 'fail', output: 'Catalog stale' },
  ]);
});

test('the real GJH archive matches its enrolled baseline', () => {
  const project = path.join(__dirname, '../archive/gjh-home-run1');
  const result = spawnSync(process.execPath, [cli, project, '--baseline', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../design-system/ssot-baseline.json'), 'utf8'));
  assert.equal(report.sections.length, 10);
  assert.ok(report.counts['raw-color'] > 0);
  assert.deepEqual(report.counts, baseline['gjh-home-run1']);
  assert.deepEqual(report.baseline, { status: 'pass', projectName: 'gjh-home-run1', offenders: [] });
});
