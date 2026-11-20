'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const EXPORTER = path.resolve(__dirname, '../tools/export-page.js');
const TOKENS = ':root { --dc-bg: white; --dc-font: system-ui; }';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-export-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'swarm/projects/home');
  const sections = path.join(project, 'sections');
  const exporter = path.join(root, 'swarm/tools/export-page.js');
  const dist = path.join(project, 'dist');
  const output = path.join(root, 'offline page');
  fs.mkdirSync(sections, { recursive: true });
  fs.mkdirSync(path.dirname(exporter), { recursive: true });
  fs.mkdirSync(path.join(root, 'swarm/lib'));
  fs.copyFileSync(EXPORTER, exporter);
  fs.copyFileSync(require.resolve('../lib/layers'), path.join(root, 'swarm/lib/layers.js'));
  fs.writeFileSync(path.join(project, 'tokens.css'), TOKENS);

  return {
    root, project, sections, dist, output,
    section(name, html, css) {
      fs.writeFileSync(path.join(sections, `${name}.html`), html);
      if (css !== undefined) fs.writeFileSync(path.join(sections, `${name}.css`), css);
    },
    asset(name, content, directory = 'assets/companies/gjh') {
      const file = path.join(root, directory, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    },
    run(...args) {
      const result = spawnSync(process.execPath, [exporter, '--no-pwa', ...args], { cwd: os.tmpdir(), encoding: 'utf8' });
      assert.ifError(result.error);
      return result;
    },
  };
}

test('exports sections in order with inline styles, defaults and byte counts', t => {
  const f = fixture(t);
  const hero = '<section class="s-02"><h1>Café</h1></section>';
  const heroCss = '.s-02 { color: blue; }';
  const footer = '<section class="s-10"><h2>Footer</h2></section>';
  const footerCss = '.s-10 { color: red; }';
  f.section('10-footer', footer, footerCss);
  f.section('02-hero', hero, heroCss);
  f.section('draft', '<h1>Ignore this draft</h1>');

  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const page = fs.readFileSync(path.join(f.dist, 'index.html'), 'utf8');
  assert.match(page, /^<!doctype html>\n<html lang="en">/);
  assert.match(page, /<meta charset="utf-8">/);
  assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(page, /<title>home<\/title>/);
  assert.match(page, /\*\{box-sizing:border-box\}/);
  assert.match(page, /background:var\(--dc-bg\)/);
  assert.match(page, /font-family:var\(--dc-font\)/);
  assert.match(page, /scroll-behavior:smooth/);
  assert.ok(page.indexOf(TOKENS) < page.indexOf('*{box-sizing'));
  assert.ok(page.includes(`<style>\n${heroCss}\n</style>\n<style>\n${footerCss}\n</style>`));
  assert.ok(page.includes(`<main>\n${hero}\n${footer}\n</main>`));
  assert.match(result.stdout, /Sections included: 2/);
  assert.ok(result.stdout.includes(`02-hero.html: ${Buffer.byteLength(hero)} HTML bytes, ${Buffer.byteLength(heroCss)} CSS bytes`));
  assert.ok(result.stdout.includes(`(${Buffer.byteLength(page)} bytes)`));
  assert.match(result.stdout, /Images copied: 0.*\nImages missing: 0/);
});

test('--no-pwa preserves the previous page bytes and writes no PWA files', t => {
  const f = fixture(t);
  f.section('01-hero', '<h1>Legacy {{VERSION}}</h1>', '.s-01 { color: blue; }');
  const result = f.run(f.project, '--title', 'A & B <C>');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(f.dist), ['index.html']);
  assert.equal(fs.readFileSync(path.join(f.dist, 'index.html'), 'utf8'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A &amp; B &lt;C&gt;</title>
<style>
${TOKENS}
</style>
<style>

*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--dc-bg);color:var(--dc-ink);font-family:var(--dc-font);font-size:var(--dc-text-base);line-height:var(--dc-leading)}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}

</style>
<style>
.s-01 { color: blue; }
</style>
</head>
<body>
<main>
<h1>Legacy {{VERSION}}</h1>
</main>
</body>
</html>
`);
});

test('exports only recognized layers after their base and rewrites minified layer images', t => {
  const f = fixture(t);
  f.section('01-hero', '<h1>Hero</h1>', '.s-01{display: block}');
  f.section('02-content', '<section></section>');
  f.section('03-legacy.name', '<aside></aside>', '.legacy{opacity: .5}');
  f.asset('layer.png', 'layer image');
  for (const [name, css] of [
    ['01-hero.polish.css', '.s-01{opacity: .9}'],
    ['01-hero.imagery.css', '.s-01 {\n  background-image: url("/gjh/layer.png#crop");\n}'],
    ['01-hero.layout.css', '.s-01{display: grid}'],
    ['01-hero.unknown.css', 'unrecognized layer'],
    ['02-content.type.css', '.s-02{font: inherit}'],
  ]) {
    fs.writeFileSync(path.join(f.sections, name), css);
  }

  const result = f.run('--minify');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.trim(), 'Warning: Missing stylesheet 02-content.css');
  const page = fs.readFileSync(path.join(f.dist, 'index.html'), 'utf8');
  assert.ok(page.includes('<style>\n.s-01{display: block} /* layer: layout */ .s-01{display: grid}'
    + ' /* layer: imagery */ .s-01 { background-image: url("assets/layer.png#crop"); }'
    + ' /* layer: polish */ .s-01{opacity: .9}\n</style>'));
  assert.ok(page.includes('<style>\n/* layer: type */ .s-02{font: inherit}\n</style>'));
  assert.ok(page.includes('<style>\n.legacy{opacity: .5}\n</style>'));
  assert.ok(!page.includes('unrecognized layer'));
  assert.equal(fs.readFileSync(path.join(f.dist, 'assets/layer.png'), 'utf8'), 'layer image');
});

test('copies and rewrites image URLs, preserving descriptors and unique flat names', t => {
  const f = fixture(t);
  f.asset('first/card.png', 'first image');
  f.asset('second/card.png', 'second image');
  f.asset('icons/space name.svg', '<svg/>');
  f.section('01-hero', `
<section class="s-01">
  <h1>Hero</h1>
  <img src="/gjh/first/card.png?size=1#preview" alt="src='/gjh/ignored.png'">
  <img SRC=/gjh/first/card.png>
  <picture><source srcset="data:image/png;base64,abcd 1x, /gjh/second/card.png 2x,
    /gjh/first/card.png 3x, https://example.com/image.png 4x"></picture>
  <img srcset="/gjh/first/card.png, /gjh/second/card.png 2x">
  <div style="background: url('/gjh/icons/space%20name.svg')"></div>
</section>`, `
.s-01 { background: url( /gjh/second/card.png ); }
.s-01::before { content: "url(/gjh/ignored.png)"; }
/* url('/gjh/ignored.png') */
`);

  const result = f.run(f.project, '--out', f.output, '--title', 'A & B <C>');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const assets = path.join(f.output, 'assets');
  const page = fs.readFileSync(path.join(f.output, 'index.html'), 'utf8');
  assert.match(page, /<title>A &amp; B &lt;C&gt;<\/title>/);
  assert.deepEqual(fs.readdirSync(assets).sort(), ['card-2.png', 'card.png', 'space-name.svg']);
  assert.equal(fs.readFileSync(path.join(assets, 'card.png'), 'utf8'), 'first image');
  assert.equal(fs.readFileSync(path.join(assets, 'card-2.png'), 'utf8'), 'second image');
  assert.match(page, /src="assets\/card\.png\?size=1#preview" alt="src='\/gjh\/ignored\.png'"/);
  assert.match(page, /SRC=assets\/card\.png>/);
  assert.match(page, /data:image\/png;base64,abcd 1x, assets\/card-2\.png 2x,\s+assets\/card\.png 3x, https:\/\/example\.com\/image\.png 4x/);
  assert.match(page, /srcset="assets\/card\.png, assets\/card-2\.png 2x"/);
  assert.ok(page.includes("url('assets/space-name.svg')"));
  assert.ok(page.includes('url( assets/card-2.png )'));
  assert.ok(page.includes('content: "url(/gjh/ignored.png)"'));
  assert.match(result.stdout, /Images copied: 3 \(29 bytes\)/);
  assert.match(result.stdout, /Images missing: 0/);
});

test('exports both asset prefixes and reports missing and unsupported URLs without failing', t => {
  const f = fixture(t);
  f.asset('v11-card.png', 'company image');
  f.asset('card.png', 'mall image', 'demos/corporate/gjh/v11/assets');
  f.section('01-hero', `
<h1>Hero</h1>
<img src="/gjh/v11-card.png">
<picture>
  <source srcset="/gjh-v11/card.png 1x, /other/srcset.png 2x, //cdn.example/card.png 3x">
  <img src="/gjh-v11/card.png">
</picture>
<img src="/other/x.png">
<img src="/gjh-v11/missing.png">
<link rel="icon" HREF='/gjh-v11/card.png'>
<link rel="preload" href="/other/href.png">
<a href="/contact">Contact</a>
`, `.hero { background: url('/gjh-v11/card.png'); mask-image: url(/other/css.png); }
.other { background: url(/other/x.png); }`);

  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Images copied: 2 \(23 bytes\)/);
  assert.match(result.stdout, /Images missing: 1\n  \/gjh-v11\/missing\.png\nUnresolved references: 4/);
  assert.deepEqual(result.stderr.trim().split(/\r?\n/), [
    '/other/srcset.png', '/other/x.png', '/other/href.png', '/other/css.png',
  ].map(url => `Warning: Unresolved root-relative reference ${url} (unavailable offline)`));

  const assets = path.join(f.dist, 'assets');
  assert.deepEqual(fs.readdirSync(assets).sort(), ['v11-card-2.png', 'v11-card.png']);
  assert.equal(fs.readFileSync(path.join(assets, 'v11-card.png'), 'utf8'), 'company image');
  assert.equal(fs.readFileSync(path.join(assets, 'v11-card-2.png'), 'utf8'), 'mall image');
  const page = fs.readFileSync(path.join(f.dist, 'index.html'), 'utf8');
  assert.ok(page.includes('src="assets/v11-card.png"'));
  assert.ok(page.includes('src="assets/v11-card-2.png"'));
  assert.ok(page.includes('srcset="assets/v11-card-2.png 1x, /other/srcset.png 2x, //cdn.example/card.png 3x"'));
  assert.ok(page.includes("HREF='assets/v11-card-2.png'"));
  assert.ok(page.includes("url('assets/v11-card-2.png')"));
  assert.ok(page.includes('src="/gjh-v11/missing.png"'));
  assert.ok(page.includes('src="/other/x.png"'));
  assert.ok(page.includes('href="/other/href.png"'));
  assert.ok(page.includes('url(/other/css.png)'));
});

test('reports missing mapped image URLs and fragment validation warnings without failing', t => {
  const f = fixture(t);
  f.section('01-hero', `
<section class="s-01">
  <!-- <h1>Comment</h1><script></script><img src="/gjh/comment.png"> -->
  <textarea><h1>Example</h1></textarea>
  <h1 title="<h1>">First</h1><H1>Second</H1>
  <script type="example"><h1>Inert payload</h1></script>
  <img src="/gjh/missing.png" srcset="/gjh/missing.png 1x, /gjh/%ZZ.png 2x">
</section>`, '.s-01 { background: url(/gjh/missing.png); }');

  const result = f.run(f.project);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Expected exactly one <h1>, found 2/);
  assert.match(result.stderr, /01-hero.html contains 1 <script>/);
  assert.match(result.stdout, /Images missing: 2\n  \/gjh\/missing.png\n  \/gjh\/%ZZ.png/);
  const page = fs.readFileSync(path.join(f.dist, 'index.html'), 'utf8');
  assert.ok(page.includes('src="/gjh/missing.png" srcset="/gjh/missing.png 1x, /gjh/%ZZ.png 2x"'));
  assert.ok(page.includes('url(/gjh/missing.png)'));
});

test('minifies only CSS whitespace and warns about missing optional stylesheets', t => {
  const f = fixture(t);
  const css = `.s-01   .detail {\n  content: "two   spaces";\n  width: calc(100%   -   2px);\n  background: url("data:image/svg+xml, hello   world");\n}`;
  const html = '<section class="s-01"><h1>Keep   these spaces</h1></section>';
  f.section('01-hero', html, css);
  f.section('02-other', '<section class="s-02"></section>');

  const result = f.run('--minify', f.project);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Missing stylesheet 02-other.css/);
  const page = fs.readFileSync(path.join(f.dist, 'index.html'), 'utf8');
  assert.ok(page.includes(html));
  assert.ok(page.includes('.s-01 .detail { content: "two   spaces"; width: calc(100% - 2px); background: url("data:image/svg+xml, hello   world"); }'));
});

test('fails when the project or sections are missing', t => {
  const f = fixture(t);
  const missing = f.run(path.join(f.root, 'missing'));
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Project directory not found/);

  const noSections = f.run(f.root);
  assert.equal(noSections.status, 1);
  assert.match(noSections.stderr, /Sections directory not found/);

  const empty = f.run(f.project);
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /No section fragments found/);
  assert.equal(fs.existsSync(f.dist), false);
});
