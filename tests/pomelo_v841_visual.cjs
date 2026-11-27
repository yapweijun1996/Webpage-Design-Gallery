// Layout and theme regression checks; captures stay outside generated gallery media.
const {chromium} = require(process.env.POMELO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.POMELO_BASE || 'http://127.0.0.1:8765/demos/corporate/pomelo-stem/v8/';
const capture = process.env.POMELO_CAPTURE;
if (capture) fs.mkdirSync(capture, {recursive:true});
(async () => {
  const browser = await chromium.launch({headless:true});
  let cases = 0;
  try {
    for (const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568]]) {
      for (const locale of ['', 'zh/', 'ms/']) {
        const context = await browser.newContext({viewport:{width,height}, reducedMotion:'reduce', serviceWorkers:'block'});
        const page = await context.newPage();
        try {
          await page.goto(base + locale + 'index.html');
          await page.evaluate(() => document.fonts.ready);
          for (const theme of ['light','dark']) {
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            const metrics = await page.evaluate(() => {
              const cards = [...document.querySelectorAll('.home-feature')].map(el => el.getBoundingClientRect().height);
              const button = getComputedStyle(document.querySelector('.hero-cta .button--primary'));
              const hero = document.querySelector('.hero--home');
              return {cards, origin:button.backgroundOrigin, height:document.documentElement.scrollHeight,
                overflow:document.documentElement.scrollWidth > innerWidth,
                fade:getComputedStyle(hero).backgroundImage, mask:getComputedStyle(hero,'::after').maskImage};
            });
            assert(Math.max(...metrics.cards) - Math.min(...metrics.cards) < 0.5, JSON.stringify({width,locale,theme,metrics}));
            assert.equal(metrics.origin, 'border-box');
            assert(!metrics.overflow);
            assert(metrics.fade.startsWith('linear-gradient'));
            assert(metrics.mask.startsWith('linear-gradient'));
            if (width <= 390) {
              assert(metrics.height <= (width === 320 ? 6000 : 5900), JSON.stringify({width,locale,theme,metrics}));
              console.log('height', width, locale || 'en', theme, metrics.height);
            }
            if (capture && !locale) await page.screenshot({path:path.join(capture,`hero-${width}-${theme}.png`)});
            await page.locator('.hero-cta .button--primary').hover();
            assert.equal(await page.locator('.hero-cta .button--primary').evaluate(el => getComputedStyle(el).backgroundOrigin), 'border-box');
            await page.mouse.move(0,0);
            cases++;
          }
        } finally { await context.close(); }
      }
    }
    console.log(`PASS ${cases} visual/height cases; FAIL 0`);
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
