import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const demo = new URL('../demos/corporate/gjh/v11/', import.meta.url);
const css = readFileSync(new URL('style.css', demo), 'utf8');
const html = readFileSync(new URL('index.html', demo), 'utf8');
const loader = readFileSync(new URL('assets/loader.js', demo), 'utf8');

test('v11 page navigation has one sticky bar and one responsive tabs landmark', () => {
  const sticky = [...css.matchAll(/([^{}]+)\{[^{}]*position:\s*sticky\b[^{}]*\}/g)]
    .map(match => match[1].trim())
    .filter(selector => /(?:site-header|site-secondary|site-tabs|context-navigation-global)/.test(selector));
  assert.deepEqual(sticky, ['body:not(.is-3d) .site-header']);
  assert.match(css, /body:not\(\.is-3d\) \.site-header\{\s*position:sticky;top:0;z-index:50/);
  assert.match(css, /\.site-tabs\{position:relative;z-index:49/);
  assert.match(css, /body:not\(\.is-3d\) \.context-navigation-global\{display:none\}/);
  assert.equal((html.match(/<nav class="site-tabs"/g) ?? []).length, 1);
  assert.match(html, /<a href="#mall-arrivals" aria-current="page">Home<\/a>\s*<a href="#store-list">Shops<\/a>/);
  assert.match(loader, /if \(compactHeader.matches\) secondary.append\(tabs, settings\)/);
  assert.match(loader, /wordmark.after\(tabs\)/);
});

test('v11 page header, anchors and notices share the responsive height token', () => {
  assert.match(css, /:root\{[^}]*--header-h:64px/);
  assert.match(css, /@media\(max-width:650px\)\{:root\{--header-h:56px\}/);
  assert.match(loader, /matchMedia\('\(max-width: 650px\)'\)/);
  assert.match(css, /scroll-padding-top:calc\(var\(--header-h\) \+ 16px\)/);
  assert.doesNotMatch(css, /scroll-margin-top:/);
  assert.match(css, /position:sticky;top:0;z-index:50;\s*height:calc\(var\(--header-h\) \+ var\(--header-safe-top\)\)/);
  for (const notice of ['.mall-update-notice', '.mall-connection-notice']) {
    const rule = css.split(`\n${notice}{`)[1].split('}')[0];
    assert.match(rule, /top:calc\(var\(--header-h\)/);
  }
});

test('v11 tabs and page settings retain visible keyboard focus and 44px targets', () => {
  assert.match(css, /\.site-tabs \[aria-current="page"\]::after\{[^}]*height:3px;background:var\(--header-gold\)/);
  assert.match(css, /\.site-tabs a,\.site-enter\{[^}]*min-width:44px;min-height:44px/);
  assert.match(css, /\.site-settings :is\(button,select\)\{min-width:44px;min-height:44px/);
  assert.match(css, /\.site-secondary\) :is\(a,button,select\):focus-visible,[^}]*outline:3px solid var\(--header-gold\);outline-offset:2px/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{html\{scroll-behavior:auto\}/);
});
