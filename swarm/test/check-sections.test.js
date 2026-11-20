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
    + '<h1>Café</h1><a href="#03-footer">Contact</a><a href="https://example.test">Offsite</a>'
    + '<img src="./sample.webp" alt="" width="100" height="60">'
    + '<svg><defs><path id="shape" d="M0 0" /></defs><use href="#shape" /></svg></SECTION>';
  const css = [
    '.s-02:focus, .theme .s-02 > h1 { color: var(--dc-ink); }',
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
    '<h1>Hero</h1><head></head><html><body></body></html>',
    '<SCRIPT>let example = "<h1>ignored</h1>";</SCRIPT>',
    '<img src="https&#58;//example.test/pic.png" width=100 height=32>',
    '<button ONCLICK="if (1 > 0) run()">Go</button>',
    '<a href=https://example.test>Link</a><link href="//example.test/styles.css">',
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
    'inline-handler', 'missing-alt', 'script-tag',
  ]);
  assert.equal(result.sections[0].findings, 14);
  assert.deepEqual(rules(result, 'warn'), []);
});

test('comments, strings and raw HTML text do not create findings', t => {
  const html = fragment('01-content',
    '<!-- <img src=https://example.test><script></script> -->'
    + '<textarea><h1>literal</h1><img src=https://example.test></textarea>'
    + '<span title="onclick=foo() > #abc">Text</span>'
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
  assert.deepEqual(rules(result, 'error'), Array(8).fill('css-scope'));
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
  assert.deepEqual(rules(result, 'warn'), ['empty-html', 'unknown-anchor', 'unknown-anchor']);
  assert.equal(result.sections.find(section => section.section === '02-main-hero').findings, 3);
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
  assert.deepEqual(rules(result, 'error'), []);
  assert.deepEqual(rules(result, 'warn'), [
    'fixed-position', 'fixed-width', 'fixed-width', 'hard-coded-color', 'hard-coded-color', 'hard-coded-color',
    'image-dimensions', 'small-font', 'small-tap-target', 'small-tap-target', 'too-many-important',
  ]);
});

test('a brief palette allows only leading custom properties in scoped rules', t => {
  const html = fragment('01-content', '<p style="color: #123">Text</p>');
  const css = [
    '.s-01 { --ink: #aabbcc; --line: rgba(0, 0, 0, .2); color: var(--ink); --late: #fff; }',
    '.s-01 p { background-color: hsl(0 0% 0%); padding: 0 !important; margin: 0 !important; width: auto !important; }',
  ].join('\n');
  const result = checkProject(fixture(t, { '01-content': { html, css } }, '## Palette\nDefined in CSS.'));
  assert.deepEqual(rules(result, 'error'), []);
  assert.deepEqual(rules(result, 'warn'), Array(3).fill('hard-coded-color'));
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
  assert.deepEqual(rules(JSON.parse(failure.stdout), 'error'), ['css-scope', 'file-read']);

  const human = spawnSync(process.execPath, [cli, project], { encoding: 'utf8' });
  assert.equal(human.status, 1, human.stderr);
  assert.match(human.stdout, /Section\s+HTML bytes\s+CSS bytes\s+Findings/);
  assert.match(human.stdout, /01-content\s+0\s+0\s+1/);
  assert.match(human.stdout, /2 section\(s\), 2 error\(s\), 1 warning\(s\)\./);
});
