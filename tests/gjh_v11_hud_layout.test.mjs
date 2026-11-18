import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../demos/corporate/gjh/v11/style.css');
const tokens = read('../assets/tokens.css');

function rule(selector) {
  const blocks = css.split(`${selector}{`).slice(1);
  assert.equal(blocks.length, 1, `Expected one rule for ${selector}`);
  return blocks[0].split('}')[0];
}

function pixels(token) {
  const value = tokens.match(new RegExp(`--${token}:\\s*(\\d+)px;`));
  assert.ok(value, `${token} must declare a pixel size`);
  return Number(value[1]);
}

test('compact HUD cards share a safe envelope above Run and the resting joystick', () => {
  const html = read('../demos/corporate/gjh/v11/index.html');
  const ui = read('../demos/corporate/gjh/v11/assets/ui.js');
  assert.ok(/id="hud-context-stack">\s*<div[^>]+id="hud-context"/.test(html), 'context must be inside the bounded stack');
  assert.ok(ui.includes("createTutorial({parent: document.getElementById('hud-context-stack')"), 'tutorial must share the stack');

  const stack = rule('body.is-3d .mall-overlay #hud-context-stack');
  assert.ok(stack.includes('inset:auto var(--hud-gutter-right) var(--hud-context-bottom) var(--hud-gutter-left)'));
  assert.ok(stack.includes('max-height:calc(100% - var(--hud-context-top) - var(--hud-context-bottom))'));
  assert.ok(stack.includes('flex-direction:column-reverse'));
  assert.ok(rule('body.is-3d .mall-overlay #hud-context').includes('max-width:min(27rem,100%)'));
  const compact = '@media(pointer:coarse),(max-width:650px),(max-height:560px) and (orientation:landscape)';
  const compactRules = css.split(`${compact}{`)[1];
  assert.ok(compactRules?.includes('--hud-context-bottom:calc(var(--hud-gutter-bottom) + max(var(--hud-stick-size),var(--hud-control-size)) + var(--space-2))'));
  assert.ok(css.includes('--hud-context-top:calc(var(--size-control) + var(--space-2) + var(--space-2))'));
  const tutorial = rule('body.is-3d .mall-overlay #guide-card');
  assert.ok(tutorial.includes('position:static') && tutorial.includes('min-height:0;overflow:auto'));
  assert.ok(rule('.is-3d .touch-controls .run-toggle').includes('bottom:var(--hud-gutter-bottom)'));
  assert.ok(rule('.is-3d .touch-controls .joystick').includes('bottom:var(--hud-gutter-bottom)'));
  assert.ok(css.includes('--hud-control-size:calc(var(--size-control) + var(--space-3))'));
  assert.ok(css.includes('--hud-stick-size:calc(var(--size-control) + var(--space-8))'));
  assert.ok(css.includes('--hud-gutter-left:max(var(--space-2),env(safe-area-inset-left))'));
  assert.ok(css.includes('--hud-gutter-right:max(var(--space-2),env(safe-area-inset-right))'));
  assert.ok(css.includes('--hud-gutter-bottom:max(var(--space-1),env(safe-area-inset-bottom))'));

  const target = pixels('size-control'), gap = pixels('space-2');
  const run = target + pixels('space-3'), stick = target + pixels('space-8');
  const viewports = [320, 360, 375, 390, 393, 430].map(width => [width, 612]);
  viewports.push([844, 390]);
  for (const [width, height] of viewports) {
    for (const insets of [[0, 0, 0, 0], [47, 32, 34, 12]]) {
      const [left, right, bottom, top] = insets;
      const gutter = Math.max(bottom, pixels('space-1'));
      const cardWidth = Math.min(27 * 16, width - Math.max(left, gap) - Math.max(right, gap));
      const cardBottom = height - gutter - Math.max(stick, run) - gap;
      const header = target + Math.max(top, gap);
      const chipsBottom = header + gap + target;
      const stackTop = header + target + 2 * gap;
      const viewport = `${width}x${height} with insets ${insets}`;
      assert.ok(cardWidth >= 2 * target + 3 * gap, viewport);
      assert.ok(height - gutter - stick - cardBottom >= 8, viewport);
      assert.ok(height - gutter - run - cardBottom >= 8, viewport);
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
  assert.ok(rule('body.is-3d .mall-overlay #hud-context :is(.held-product-status,#nearby-name)').includes('-webkit-line-clamp:2'));
  assert.ok(pixels('size-control') >= 44);
});
