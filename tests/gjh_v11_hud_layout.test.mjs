import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../demos/corporate/gjh/v11/style.css');
const tokens = read('../assets/tokens.css');

function rule(selector, source = css) {
  const lines = source.split('\n');
  const block = lines.findIndex(line => line.trimStart().startsWith(`${selector}{`));
  assert.notEqual(block, -1, `Expected a rule for ${selector}`);
  return lines.slice(block).join('\n').split('{')[1].split('}')[0];
}

function pixels(token) {
  const value = tokens.match(new RegExp(`--${token}:\\s*(\\d+)px;`));
  assert.ok(value, `${token} must declare a pixel size`);
  return Number(value[1]);
}

const headerControls = '.is-3d .site-header :is(.header-location,.header-map,.bag-open,.view-toggle)';
const cornerControls = '#mall-tools>summary,#hud-objectives>summary,.hud-rail :is(button,summary),#hud-more-actions';
const cornerChips = '#mall-tools>summary,#hud-objectives>summary';
const chrome = '.is-3d :is(.site-header button,#mall-tools>summary,#hud-objectives>summary)';

test('compact header and corner chips paint at 36px inside 44px or larger touch targets', () => {
  const hud = rule('html[data-gjh-design="v11"] body.is-3d');
  const insetToken = hud.match(/--hud-chrome-inset:var\(--([\w-]+)\)/)?.[1];
  const target = pixels('size-control');
  assert.ok(target >= 44);
  assert.equal(target - 2 * pixels(insetToken), 36);
  assert.match(rule(headerControls), /min-height:var\(--size-control\);min-width:var\(--size-control\)/);
  assert.match(rule(cornerControls), /min-height:var\(--size-control\)/);
  assert.match(rule(cornerChips), /width:max-content/);
  assert.match(rule(chrome), /border:0;border-radius:(?:0|var\(--entry-flat\));background:transparent/);
  const face = rule(`${chrome}::before`);
  assert.match(face, /inset:var\(--hud-chrome-inset\)/);
  assert.match(face, /pointer-events:none/);
  assert.match(hud, /--gjh-header-size:calc\(var\(--size-control\) \+ var\(--space-1\)\)/);
  assert.ok(target + pixels('space-1') < 52);
  assert.match(hud, /--hud-corner-top:var\(--space-3\)/);
  assert.ok(pixels('space-3') >= 12);
  assert.match(rule('.scene-readouts,.hud-rail'), /top:var\(--hud-corner-top\)/);
});

test('compact HUD stacks Run above the raised joystick and reserves space for cards', () => {
  const html = read('../demos/corporate/gjh/v11/index.html');
  const ui = read('../demos/corporate/gjh/v11/assets/ui.js');
  assert.ok(/id="hud-context-stack">\s*<div[^>]+id="hud-context"/.test(html), 'context must be inside the bounded stack');
  assert.ok(ui.includes("createTutorial({parent: document.getElementById('hud-context-stack')"), 'tutorial must share the stack');

  const stack = rule('body.is-3d .mall-overlay #hud-context-stack');
  assert.ok(stack.includes('inset:auto var(--hud-context-right) var(--hud-context-bottom) var(--hud-gutter-left)'));
  assert.ok(stack.includes('max-height:calc(100% - var(--hud-context-top) - var(--hud-context-bottom))'));
  assert.ok(stack.includes('flex-direction:column-reverse'));
  assert.ok(rule('body.is-3d .mall-overlay #hud-context').includes('max-width:min(27rem,100%)'));
  const compact = '@media(pointer:coarse),(max-width:650px)';
  const compactRules = css.split(`${compact}{`)[1];
  assert.ok(compactRules.includes('--hud-stick-bottom:calc(var(--hud-gutter-bottom) + var(--gjh-space-joystick-clearance))'));
  assert.ok(compactRules.includes('--hud-run-bottom:calc(var(--hud-stick-bottom) + var(--hud-stick-size) + var(--space-2))'));
  assert.ok(compactRules.includes('--hud-context-bottom:calc(var(--hud-run-bottom) + var(--hud-control-size) + var(--space-2))'));
  const landscape = compactRules.split('@media(max-height:560px) and (orientation:landscape){')[1];
  assert.ok(landscape?.includes('--hud-context-bottom:var(--hud-stick-bottom)'));
  assert.ok(landscape?.includes('--hud-context-right:calc(var(--hud-gutter-right) + var(--hud-stick-size) + var(--space-2))'));
  assert.ok(css.includes('--hud-context-top:calc(var(--hud-corner-top) + var(--size-control) + var(--space-2))'));
  const tutorial = rule('body.is-3d .mall-overlay #guide-card');
  assert.ok(tutorial.includes('position:static') && tutorial.includes('min-height:0;overflow:auto'));
  const runRule = rule('.is-3d .touch-controls .run-toggle');
  assert.ok(runRule.includes('bottom:var(--hud-run-bottom);left:auto'));
  assert.ok(runRule.includes('right:calc(var(--hud-gutter-right) + (var(--hud-stick-size) - var(--hud-control-size)) / 2)'));
  assert.ok(rule('.is-3d .touch-controls .joystick').includes('bottom:var(--hud-stick-bottom)'));
  assert.ok(css.includes('--hud-control-size:calc(var(--size-control) + var(--space-3))'));
  assert.ok(css.includes('--hud-stick-size:calc(var(--size-control) + var(--space-8))'));
  assert.ok(css.includes('--hud-gutter-left:max(var(--space-2),env(safe-area-inset-left))'));
  assert.ok(css.includes('--hud-gutter-right:max(var(--space-2),env(safe-area-inset-right))'));
  assert.ok(css.includes('--hud-gutter-bottom:max(var(--space-1),env(safe-area-inset-bottom))'));

  const target = pixels('size-control'), gap = pixels('space-2');
  const cornerTop = pixels('space-3');
  const run = target + pixels('space-3'), stick = target + pixels('space-8');
  const viewports = [320, 360, 375, 390, 393, 430].map(width => [width, 600]);
  viewports.push([393, 852], [360, 640], [852, 393], [932, 430], [844, 390], [740, 320]);
  for (const [width, height] of viewports) {
    for (const insets of [[0, 0, 0, 0], [47, 32, 34, 12]]) {
      const [left, right, bottom, top] = insets;
      const shortLandscape = width > height && height <= 560;
      const stickBottom = height - bottom - Math.max(bottom, pixels('space-1')) - 20;
      const stickLeft = width - right - Math.max(right, gap) - stick;
      const runTop = stickBottom - stick - gap - run;
      const cardRight = shortLandscape ? stickLeft - gap : width - right - Math.max(right, gap);
      const cardWidth = Math.min(27 * 16, cardRight - left - Math.max(left, gap));
      const cardBottom = shortLandscape ? stickBottom : runTop - gap;
      const header = target + pixels('space-1') + top;
      const chipsBottom = header + cornerTop + target;
      const stackTop = chipsBottom + gap;
      const viewport = `${width}x${height} with insets ${insets}`;
      assert.ok(cardWidth >= 2 * target + 3 * gap, viewport);
      assert.ok(shortLandscape ? stickLeft - cardRight >= 8 : runTop - cardBottom >= 8, viewport);
      assert.ok(stackTop - chipsBottom >= 8, viewport);
      assert.ok(cardBottom - stackTop >= 2 * target + 2 * gap, viewport);
    }
  }
});

test('a closed map has no layout box at any viewport', () => {
  assert.ok(rule('.mall-overlay .mall-map:not([open])').includes('display:none'));
});

test('the location chip keeps the dot, ellipsized name, and chevron on one centered row', () => {
  assert.match(rule(headerControls), /display:inline-flex;align-items:center/);
  const location = rule('.is-3d .site-header .header-location');
  assert.match(location, /flex-flow:row nowrap/);
  assert.match(location, /flex:0 1 auto;max-width:16rem/);
  assert.match(rule('.is-3d #location-map>:not(#location-name)'), /flex:none/);
  const name = rule('.site-header #location-name');
  assert.match(name, /min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
  assert.match(rule(headerControls), /flex:0 0 auto/);
  assert.doesNotMatch(css, /\.is-3d #location-map>[^{}]+\{[^}]*display:none/);
});

test('the Tools icon and label fit on one row without sharing a grid cell', () => {
  assert.match(rule(cornerControls), /display:flex;align-items:center;justify-content:center/);
  assert.match(rule(cornerChips), /width:max-content;.*gap:var\(--space-2\);/s);
  assert.match(rule(cornerChips), /padding-inline:var\(--space-3\);white-space:nowrap/);
  for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (selector.includes('#mall-tools>summary')) {
      assert.doesNotMatch(declarations, /display:grid|grid-area:|(?:^|;)width:var\(--size-control\)/);
    }
  }
});

test('interaction and held-product cards share a padded flex row with nonwrapping actions', () => {
  const card = 'body.is-3d .mall-overlay #hud-context';
  assert.match(rule(card), /display:flex/);
  assert.match(rule(`${card}:is([data-context="held"],[data-context="interaction"])`),
    /gap:var\(--space-3\);padding:var\(--space-3\)/);
  assert.ok(pixels('space-3') >= 12);
  assert.match(rule(`${card} .inspect-prompt`), /display:flex;align-items:center;gap:inherit/);
  assert.match(rule('#hud-context .nearby-card'), /flex:1 1 auto;align-items:center;min-width:0/);
  const action = rule(`${card} :is(#inspect,.hud-pickup-action,.hud-held-action)`);
  assert.ok(action.includes('white-space:nowrap') && action.includes('width:max-content') && action.includes('max-width:none'));
  assert.match(rule(`${card} .hud-held-action`), /min-height:var\(--size-control\)/);
  assert.match(rule(`${card} :is(.held-product-status,#nearby-name)`), /min-width:0;.*overflow:hidden;text-overflow:ellipsis/);
  assert.match(rule(`${card} .held-product-status`), /-webkit-line-clamp:2/);
  assert.match(rule(`${card} #nearby-name`), /white-space:nowrap/);
});

test('the HUD centers its icons and resting joystick knob independently of badges and labels', () => {
  const center = /display:grid;.*place-items:center/;
  const compactHeader = css.split('@media(max-width:999px){')[1];
  assert.match(rule('.is-3d .site-header :is(.header-map,.bag-open,.view-toggle)', compactHeader), center);
  assert.match(rule('.is-3d :is(.site-header button,#mall-tools>summary) svg'), /display:block;margin:0/);
  assert.match(rule('.is-3d .hud-bag-count'), /position:absolute/);
  assert.match(rule('#hud-more-actions'), center);
  assert.match(rule('body.is-3d .mall-overlay :is(#inspect,#run-toggle,.hud-pickup-action)'), center);
  assert.match(rule('.is-3d .touch-controls .joystick'), center);
  assert.match(rule('.is-3d .touch-controls .joystick-thumb'), /position:static/);
  assert.doesNotMatch(read('../demos/corporate/gjh/v11/index.html'), /joystick-label/);
});

test('the objective summary reserves room for all three progress dots', () => {
  assert.ok(rule('.hud-objective-dots').includes('flex:none'));
  assert.ok(rule(cornerChips).includes('white-space:nowrap'));
});
