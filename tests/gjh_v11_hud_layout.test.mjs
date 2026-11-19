import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../demos/corporate/gjh/v11/style.css');
const tokens = read('../assets/tokens.css');

function rule(selector) {
  const lines = css.split('\n');
  const block = lines.findIndex(line => line.trimStart().startsWith(`${selector}{`));
  assert.notEqual(block, -1, `Expected a rule for ${selector}`);
  return lines.slice(block).join('\n').split('{')[1].split('}')[0];
}

function pixels(token) {
  const value = tokens.match(new RegExp(`--${token}:\\s*(\\d+)px;`));
  assert.ok(value, `${token} must declare a pixel size`);
  return Number(value[1]);
}

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
  assert.ok(compactRules.includes('--hud-stick-bottom:calc(var(--hud-gutter-bottom) + 20px)'));
  assert.ok(compactRules.includes('--hud-run-bottom:calc(var(--hud-stick-bottom) + var(--hud-stick-size) + var(--space-2))'));
  assert.ok(compactRules.includes('--hud-context-bottom:calc(var(--hud-run-bottom) + var(--hud-control-size) + var(--space-2))'));
  const landscape = compactRules.split('@media(max-height:560px) and (orientation:landscape){')[1];
  assert.ok(landscape?.includes('--hud-context-bottom:var(--hud-stick-bottom)'));
  assert.ok(landscape?.includes('--hud-context-right:calc(var(--hud-gutter-right) + var(--hud-stick-size) + var(--space-2))'));
  assert.ok(css.includes('--hud-context-top:calc(var(--size-control) + var(--space-2) + var(--space-2))'));
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
  const run = target + pixels('space-3'), stick = target + pixels('space-8');
  const viewports = [320, 360, 375, 390, 393, 430].map(width => [width, 600]);
  viewports.push([932, 430], [844, 390], [740, 320]);
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
      const header = target + Math.max(top, gap) + top;
      const chipsBottom = header + gap + target;
      const stackTop = header + target + 2 * gap;
      const viewport = `${width}x${height} with insets ${insets}`;
      assert.ok(cardWidth >= 2 * target + 3 * gap, viewport);
      assert.ok(shortLandscape ? stickLeft - cardRight >= 8 : runTop - cardBottom >= 8, viewport);
      assert.ok(stackTop - chipsBottom >= 8, viewport);
      assert.ok(cardBottom - stackTop >= 2 * target + 2 * gap, viewport);
    }
  }
});

test('held item copy uses two lines above a wrapping row of full-size actions', () => {
  const held = 'body.is-3d .mall-overlay #hud-context[data-context="held"]';
  assert.ok(rule(held).includes('flex-direction:column'));
  assert.ok(rule(`${held} .inspect-prompt`).includes('flex-wrap:wrap'));
  const action = rule('body.is-3d .mall-overlay #hud-context .hud-held-action');
  assert.ok(action.includes('min-height:var(--size-control)') && action.includes('max-width:100%'));
  assert.ok(rule('body.is-3d .mall-overlay #hud-context .held-product-status').includes('-webkit-line-clamp:2'));
  assert.ok(pixels('size-control') >= 44);
});

test('a closed map has no layout box at any viewport', () => {
  assert.ok(rule('.mall-overlay .mall-map:not([open])').includes('display:none'));
});

test('location name can truncate in its own track without squeezing the dot or map button', () => {
  assert.ok(rule('.is-3d .site-header .header-location').includes('grid-template-columns:auto minmax(0,1fr) auto'));
  const name = rule('.site-header #location-name');
  assert.ok(name.includes('overflow:hidden') && name.includes('text-overflow:ellipsis') && name.includes('white-space:nowrap'));
  assert.ok(css.includes('grid-template-columns:auto minmax(0,1fr)}'));
});

test('the pickup label fits on one line while the product name ellipsizes', () => {
  const action = rule('body.is-3d .mall-overlay #hud-context .hud-pickup-action');
  assert.ok(action.includes('white-space:nowrap') && action.includes('width:max-content') && action.includes('max-width:none'));
  const name = rule('body.is-3d .mall-overlay #hud-context #nearby-name');
  const contextCopy = rule('body.is-3d .mall-overlay #hud-context :is(.held-product-status,#nearby-name)');
  assert.ok(contextCopy.includes('overflow:hidden') && name.includes('text-overflow:ellipsis') && name.includes('white-space:nowrap'));
});

test('the objective summary reserves room for all three progress dots', () => {
  assert.ok(rule('.hud-objective-dots').includes('flex:none'));
  assert.ok(rule('#hud-objectives>summary').includes('white-space:nowrap'));
});
