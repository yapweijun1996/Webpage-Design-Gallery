// Node fallback for browser_pomelo_v8.py::check_toasts when Python Playwright is unavailable.
// Uses an existing Playwright installation; never installs packages or browsers.
const {chromium} = require(process.env.POMELO_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.POMELO_BASE || 'http://127.0.0.1:8765/demos/corporate/pomelo-stem/v8/';
const errors = [];
let cases = 0;
const sampleClearance = () => {
  window.__clearanceActive = true;
  window.__clearanceFailures = [];
  window.__clearanceSamples = 0;
  const sample = () => {
    if (!window.__clearanceActive) return;
    const button = document.querySelector('[data-back-to-top]');
    const region = document.querySelector('[data-toast-region]');
    const gap = parseFloat(getComputedStyle(region).rowGap);
    const box = button.getBoundingClientRect();
    if (button.dataset.state === 'visible') {
      for (const item of region.children) {
        const toast = item.getBoundingClientRect();
        window.__clearanceSamples++;
        if (toast.top - box.bottom < gap - 0.5 || box.top < 0 || box.bottom > innerHeight) {
          window.__clearanceFailures.push({toastTop: toast.top, buttonTop: box.top,
            buttonBottom: box.bottom, gap, transform: getComputedStyle(button).transform});
        }
      }
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
};
async function notify(page, options) {
  await page.evaluate(async options => {
    const {toast} = await import('./assets/js/core/toast.js');
    if (options.action) options.action.onClick = () => {};
    toast(options);
  }, options);
}
const lightToast = {key: 'clearance', messageKey: 'toast.themeLight.title', detailKey: 'toast.themeLight.detail', sticky: true};
async function checkToasts(browser) {
  for (const [width, height] of [[1440,900], [768,1024], [390,844], [320,568]]) {
    const context = await browser.newContext({viewport:{width,height}, reducedMotion:'no-preference', serviceWorkers:'block'});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base + 'index.html', {waitUntil:'load'});
      await page.evaluate(() => document.documentElement.dataset.theme = 'light');
      const toggle = page.locator('[data-theme-toggle]').first();
      await toggle.evaluate(button => button.click());
      await page.waitForFunction(() => document.querySelector('.toast[data-key=theme]'));
      const strings = await page.evaluate(() => JSON.parse(document.querySelector('#i18n-runtime').textContent));
      assert.equal(await page.locator('.toast__title').innerText(), strings['toast.themeDark.title']);
      assert.equal(await page.locator('.toast__detail').innerText(), strings['toast.themeDark.detail']);
      await page.evaluate(() => {
        window.__themeToast = document.querySelector('.toast[data-key=theme]');
        window.__themeIcon = __themeToast.querySelector('svg').outerHTML;
        window.__themeDetail = __themeToast.querySelector('.toast__detail').textContent;
      });
      await toggle.evaluate(button => button.click());
      assert.equal(await page.locator('.toast').count(), 1);
      assert.equal(await page.locator('.toast__title').innerText(), strings['toast.themeLight.title']);
      assert.equal(await page.locator('.toast__detail').innerText(), strings['toast.themeLight.detail']);
      assert(await page.evaluate(() => __themeDetail !== __themeToast.querySelector('.toast__detail').textContent));
      assert(await page.evaluate(() => __themeToast === document.querySelector('.toast[data-key=theme]')));
      assert(await page.evaluate(() => __themeIcon !== __themeToast.querySelector('svg').outerHTML));
      await page.locator('.toast__close').evaluate(button => button.click());
      await page.waitForFunction(() => !document.querySelector('.toast'));
      await page.evaluate(() => scrollTo(0, innerHeight * 3));
      await page.waitForFunction(() => document.querySelector('[data-back-to-top]').dataset.state === 'visible');
      await page.waitForTimeout(250);
      await page.evaluate(sampleClearance);
      await notify(page, lightToast);
      await page.waitForTimeout(260);
      const box = await page.locator('.toast').boundingBox();
      assert(box.width <= 360 && box.height >= 64);
      const title = await page.locator('.toast__title').boundingBox();
      const detail = await page.locator('.toast__detail').boundingBox();
      assert(detail.y >= title.y + title.height);
      const singleLines = await page.locator('.toast__text').evaluate(text => [...text.children].every(line => line.getBoundingClientRect().height <= parseFloat(getComputedStyle(line).lineHeight) + 0.5));
      if (singleLines) assert(box.height >= 64 && box.height <= 70);
      assert.equal(await page.locator('.toast-region').evaluate(region => parseFloat(getComputedStyle(region).rowGap)), 8);
      const close = await page.locator('.toast__close').boundingBox();
      assert(close.width >= 44 && close.height >= 44);
      await page.evaluate(async () => {
        const {toast} = await import('./assets/js/core/toast.js');
        toast({type:'success', messageKey:'toast.online.title', detailKey:'toast.online.detail', sticky:true});
        toast({type:'warning', messageKey:'toast.formNotSent.title', detailKey:'toast.formNotSent.detail', sticky:true});
      });
      await page.waitForTimeout(260);
      assert.equal(await page.locator('.toast').count(), 3);
      assert.equal(await page.locator('.toast__title').count(), 3);
      assert.equal(await page.locator('.toast__detail:visible').count(), 3);
      assert(await page.locator('.toast__title, .toast__detail').evaluateAll(lines => lines.every(line => getComputedStyle(line).webkitLineClamp === '2' && line.getBoundingClientRect().height <= 2 * parseFloat(getComputedStyle(line).lineHeight) + 0.5)));
      await notify(page, {key:'clearance', type:'error', messageKey:'toast.updateError.title', detailKey:'toast.updateError.detail', action:{label:strings['update.retry']}});
      await page.waitForTimeout(260);
      assert.equal(await page.locator('.toast').count(), 3);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const action = await page.locator('.toast__action').boundingBox();
      assert(action.width >= 44 && action.height >= 44);
      await page.locator('.toast__close').first().evaluate(button => button.click());
      await page.waitForTimeout(260);
      await page.locator('.toast__close').evaluateAll(buttons => buttons.forEach(button => button.click()));
      await page.waitForFunction(() => !document.querySelector('.toast'));
      await page.evaluate(() => window.__clearanceActive = false);
      assert(await page.evaluate(() => __clearanceSamples > 10));
      assert.deepEqual(await page.evaluate(() => __clearanceFailures), [], `check_toasts ${width}`);
      cases++;
      // Additional regression: sample the actual scroll reveal with a toast already present.
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => document.querySelector('[data-back-to-top]').dataset.state === 'hidden');
      await page.waitForTimeout(260);
      await notify(page, lightToast);
      await page.waitForTimeout(260);
      await page.evaluate(sampleClearance);
      await page.evaluate(() => scrollTo(0, innerHeight * 3));
      await page.waitForFunction(() => document.querySelector('[data-back-to-top]').dataset.state === 'visible');
      await page.waitForTimeout(350);
      await page.evaluate(() => window.__clearanceActive = false);
      assert(await page.evaluate(() => __clearanceSamples > 0));
      assert.deepEqual(await page.evaluate(() => __clearanceFailures), [], `reveal ${width}`);
      cases++;
    } finally { await context.close(); }
  }
  const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce', serviceWorkers:'block'});
  const page = await context.newPage();
  try {
    await page.goto(base + 'index.html', {waitUntil:'load'});
    await page.mouse.move(0,0);
    const timed = async () => page.evaluate(async () => {
      const {toast} = await import('./assets/js/core/toast.js');
      window.__timedToast = toast({messageKey:'toast.themeLight.title', detailKey:'toast.themeLight.detail'});
    });
    const start = performance.now();
    await timed();
    await page.waitForFunction(() => !__timedToast.isConnected, null, {timeout:3500});
    assert(performance.now() - start >= 2800);
    await timed();
    await page.locator('.toast').hover();
    await page.waitForTimeout(3500);
    assert.equal(await page.locator('.toast').count(), 1);
    await page.locator('.toast__close').focus();
    await page.mouse.move(0,0);
    await page.waitForTimeout(3500);
    assert.equal(await page.locator('.toast').count(), 1);
    await page.locator('[data-menu-open]').focus();
    await page.waitForFunction(() => !__timedToast.isConnected, null, {timeout:3500});
    cases++;
  } finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.GALLERY_CHROME || undefined});
  try {
    await checkToasts(browser);
    assert.deepEqual(errors, []);
    console.log(`PASS ${cases} browser cases; FAIL 0; page errors 0`);
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
