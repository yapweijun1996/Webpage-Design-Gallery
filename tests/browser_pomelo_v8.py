"""Browser checks for Pomelo STEM V8; also writes the gallery screenshots and thumbnail."""
import functools
import http.server
import io
import json
import os
from pathlib import Path
import threading
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demos/corporate/pomelo-stem/v8'
PAGES = ('index', 'commerce', 'services', 'about', 'contact')
RELEASE = json.loads((DEMO / 'release.json').read_text('utf-8'))
VERSION = RELEASE['version']
major, minor, patch = map(int, VERSION.split('.'))
NEWER = f'{major}.{minor}.{patch + 1}'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def launch(p):
    path = os.environ.get('GALLERY_CHROME')
    return p.chromium.launch(executable_path=path, headless=True) if path else p.chromium.launch(headless=True)


def check_toasts(browser, base, errors):
    """Exercise real motion, replacement and dismissal without writing screenshots."""
    for width, height in ((1440, 900), (768, 1024), (390, 844), (320, 568)):
        context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='no-preference', service_workers='block')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(base + 'index.html', wait_until='load')
            page.evaluate("document.documentElement.setAttribute('data-theme', 'light')")
            toggle = page.locator('[data-theme-toggle]').first
            toggle.evaluate('button => button.click()')
            page.wait_for_function("document.querySelector('.toast[data-key=theme]') !== null")
            strings = page.evaluate("JSON.parse(document.querySelector('#i18n-runtime').textContent)")
            assert page.locator('.toast__title').inner_text() == strings['toast.themeDark.title'], width
            assert page.locator('.toast__detail').inner_text() == strings['toast.themeDark.detail'], width
            page.evaluate("window.__themeToast = document.querySelector('.toast[data-key=theme]'); window.__themeIcon = window.__themeToast.querySelector('svg').outerHTML; window.__themeDetail = window.__themeToast.querySelector('.toast__detail').textContent")
            toggle.evaluate('button => button.click()')
            assert page.locator('.toast').count() == 1, width
            assert page.locator('.toast__title').inner_text() == strings['toast.themeLight.title'], width
            assert page.locator('.toast__detail').inner_text() == strings['toast.themeLight.detail'], width
            assert page.evaluate("window.__themeDetail !== window.__themeToast.querySelector('.toast__detail').textContent"), width
            assert page.evaluate("window.__themeToast === document.querySelector('.toast[data-key=theme]')"), width
            assert page.evaluate("window.__themeIcon !== window.__themeToast.querySelector('svg').outerHTML"), width
            page.locator('.toast__close').evaluate('button => button.click()')
            page.wait_for_function("document.querySelector('.toast') === null")

            # Sample every animation frame while the button is visible, including enter/exit/replace.
            page.evaluate('window.scrollTo(0, innerHeight * 3)')
            page.wait_for_function("document.querySelector('[data-back-to-top]').dataset.state === 'visible'")
            page.wait_for_timeout(250)
            page.evaluate("""() => {
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
                    window.__clearanceSamples += 1;
                    if (toast.top - box.bottom < gap - 0.5 || box.top < 0 || box.bottom > innerHeight) {
                      window.__clearanceFailures.push({toastTop: toast.top, buttonTop: box.top, buttonBottom: box.bottom, gap});
                    }
                  }
                }
                requestAnimationFrame(sample);
              };
              requestAnimationFrame(sample);
            }""")
            page.evaluate("""async () => {
              const {toast} = await import('./assets/js/core/toast.js');
              toast({key: 'clearance', messageKey: 'toast.themeLight.title', detailKey: 'toast.themeLight.detail', sticky: true});
            }""")
            page.wait_for_timeout(260)
            box = page.locator('.toast').bounding_box()
            assert box['width'] <= 360 and box['height'] >= 64, (width, box)
            title = page.locator('.toast__title').bounding_box()
            detail = page.locator('.toast__detail').bounding_box()
            assert detail['y'] >= title['y'] + title['height'], (width, title, detail)
            one_line_each = page.locator('.toast__text').evaluate("text => [...text.children].every(line => line.getBoundingClientRect().height <= parseFloat(getComputedStyle(line).lineHeight) + 0.5)")
            if one_line_each:
                assert 64 <= box['height'] <= 70, (width, box)
            assert page.locator('.toast-region').evaluate('region => parseFloat(getComputedStyle(region).rowGap)') == 8
            close = page.locator('.toast__close').bounding_box()
            assert close['width'] >= 44 and close['height'] >= 44, (width, close)
            page.evaluate("""async () => {
              const {toast} = await import('./assets/js/core/toast.js');
              toast({type: 'success', messageKey: 'toast.online.title', detailKey: 'toast.online.detail', sticky: true});
              toast({type: 'warning', messageKey: 'toast.formNotSent.title', detailKey: 'toast.formNotSent.detail', sticky: true});
            }""")
            page.wait_for_timeout(260)
            assert page.locator('.toast').count() == 3
            assert page.locator('.toast__title').count() == page.locator('.toast__detail:visible').count() == 3
            assert page.locator('.toast__title, .toast__detail').evaluate_all("lines => lines.every(line => getComputedStyle(line).webkitLineClamp === '2' && line.getBoundingClientRect().height <= 2 * parseFloat(getComputedStyle(line).lineHeight) + 0.5)"), width
            page.evaluate("""async () => {
              const {toast} = await import('./assets/js/core/toast.js');
              const {t} = await import('./assets/js/core/i18n.js');
              toast({key: 'clearance', type: 'error', messageKey: 'toast.updateError.title', detailKey: 'toast.updateError.detail',
                action: {label: t('update.retry'), onClick() {}}});
            }""")
            page.wait_for_timeout(260)
            assert page.locator('.toast').count() == 3
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            action = page.locator('.toast__action').bounding_box()
            assert action['width'] >= 44 and action['height'] >= 44, (width, action)
            page.locator('.toast__close').first.evaluate('button => button.click()')
            page.wait_for_timeout(260)
            page.locator('.toast__close').evaluate_all('buttons => buttons.forEach(button => button.click())')
            page.wait_for_function("document.querySelector('.toast') === null")
            page.evaluate('window.__clearanceActive = false')
            assert page.evaluate('window.__clearanceSamples') > 10, width
            assert not page.evaluate('window.__clearanceFailures'), (width, page.evaluate('window.__clearanceFailures'))
        finally:
            context.close()

    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(base + 'index.html', wait_until='load')
        page.mouse.move(0, 0)
        started = time.monotonic()
        page.evaluate("""async () => {
          const {toast} = await import('./assets/js/core/toast.js');
          window.__timedToast = toast({messageKey: 'toast.themeLight.title', detailKey: 'toast.themeLight.detail'});
        }""")
        page.wait_for_function('!window.__timedToast.isConnected', timeout=3500)
        assert time.monotonic() - started >= 2.8
        page.evaluate("""async () => {
          const {toast} = await import('./assets/js/core/toast.js');
          window.__timedToast = toast({messageKey: 'toast.themeLight.title', detailKey: 'toast.themeLight.detail'});
        }""")
        page.locator('.toast').hover()
        page.wait_for_timeout(3500)
        assert page.locator('.toast').count() == 1
        page.locator('.toast__close').focus()
        page.mouse.move(0, 0)
        page.wait_for_timeout(3500)
        assert page.locator('.toast').count() == 1
        page.locator('[data-menu-open]').focus()
        page.wait_for_function('!window.__timedToast.isConnected', timeout=3500)
    finally:
        context.close()


def check_release_recheck(browser, base, errors):
    """Cover same-version builds, generic dirty-page consent and focus during eviction."""
    context = browser.new_context(viewport={'width': 320, 'height': 568}, reduced_motion='no-preference', service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.route('**/release.json*', lambda route: route.fulfill(content_type='application/json', body=json.dumps({
            'version': VERSION, 'build': RELEASE['build'] + '.recheck',
        })))
        titles = {
            '': 'Reload and lose unsaved changes?',
            'zh/': '重新加载并清除未保存的内容？',
            'ms/': 'Muat semula dan buang perubahan yang belum disimpan?',
        }
        for locale, title in titles.items():
            page.goto(base + locale + 'commerce.html', wait_until='load')
            page.evaluate("""async () => {
              const root = new URL(document.querySelector('meta[name="pomelo-root"]').content, document.baseURI);
              await (await import(new URL('assets/js/core/update.js', root))).check({manual: true});
            }""")
            page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'available'")
            assert page.locator('.update-button__chip').inner_text() == 'v' + VERSION
            assert page.locator('.toast[data-key="update"]').count() == 1
            page.locator('[data-add="mug"]').click()
            assert page.locator('[data-commerce-demo]').get_attribute('data-dirty') == 'true'
            page.locator('[data-update]').click()
            page.locator('.dialog[role="alertdialog"]').wait_for()
            assert page.locator('.dialog__title').inner_text() == title, locale
            page.keyboard.press('Escape')
            page.locator('.dialog').wait_for(state='detached')
            assert page.locator('[data-update]').get_attribute('data-state') == 'available'

        # Restored/autofilled input must trigger consent without an input event or data-dirty.
        page.goto(base + 'contact.html', wait_until='load')
        page.evaluate("""async () => {
          document.querySelector('form input').value = 'Restored input';
          const module = await import('./assets/js/core/update.js');
          void module.apply();
        }""")
        page.locator('.dialog[role="alertdialog"]').wait_for()
        assert not page.locator('[data-dirty="true"]').count()
        assert page.locator('.dialog__title').inner_text() == titles['']
        page.keyboard.press('Escape')
        page.locator('.dialog').wait_for(state='detached')

        page.goto(base + 'index.html', wait_until='load')
        page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'available'")
        page.locator('.toast__close').evaluate_all('buttons => buttons.forEach(button => button.click())')
        page.wait_for_function("document.querySelector('[data-toast-region]').hidden")
        page.evaluate("""async () => {
          const {toast} = await import('./assets/js/core/toast.js');
          const region = document.querySelector('[data-toast-region]');
          if (!region.hidden) throw new Error('Empty toast region must be hidden');
          const first = toast({key: 'focus-first', title: 'First', sticky: true});
          const second = toast({key: 'focus-second', title: 'Second', sticky: true});
          toast({key: 'focus-third', title: 'Third', sticky: true});
          first.querySelector('.toast__close').focus();
          toast({key: 'focus-fourth', title: 'Fourth', sticky: true});
          if (first.isConnected || region.children.length !== 3) throw new Error('Capacity eviction failed');
          if (document.activeElement !== second.querySelector('.toast__close') || !document.activeElement.isConnected) {
            throw new Error('Focused eviction must move focus to the next toast close button');
          }
          if (region.hidden || region.getAttribute('role') !== 'region' || !region.getAttribute('aria-label')) {
            throw new Error('Populated toast region must remain accessible and named');
          }
        }""")
        assert page.evaluate("document.activeElement.matches('.toast__close') && document.activeElement.isConnected")
        page.locator('.toast__close').evaluate_all('buttons => buttons.forEach(button => button.click())')
        page.wait_for_function("document.querySelector('[data-toast-region]').hidden")
        assert page.locator('[role="status"]').count() >= 1
        assert page.locator('[role="alert"]').count() == 1
    finally:
        context.close()


def main():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/demos/corporate/pomelo-stem/v8/'
    errors = []
    try:
        with sync_playwright() as p:
            browser = launch(p)
            check_toasts(browser, base, errors)
            check_release_recheck(browser, base, errors)
            for width, height in ((1440, 900), (768, 1024), (390, 844), (375, 812), (320, 568)):
                context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
                for locale in ('', 'zh/', 'ms/'):
                    for name in PAGES:
                        response = page.goto(base + locale + name + '.html', wait_until='load')
                        assert response.status == 200, (width, locale, name)
                        assert page.locator('h1').count() == 1, (width, locale, name)
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, locale, name)
                        assert page.locator('.update-button__chip').inner_text() == 'v' + VERSION
                        if width == 390 and name == 'index':
                            assert page.evaluate('document.documentElement.scrollHeight') <= 5900, (locale, page.evaluate('document.documentElement.scrollHeight'))
                        if width <= 400:
                            for control in page.locator('a[href]:visible, button:visible, .check-group label:visible').all():
                                if control.get_attribute('class') == 'skip-link':
                                    continue
                                box = control.bounding_box()
                                assert box['width'] >= 44 and box['height'] >= 44, (width, locale, name, control.evaluate('el => el.outerHTML'), box)
                if width in (1440, 768, 390):
                    page.goto(base + 'index.html', wait_until='load')
                    page.wait_for_function("[...document.images].filter(i => i.loading !== 'lazy').every(i => i.complete)")
                    page.screenshot(path=str(DEMO / 'screenshots' / f'{width}.png'))
                    if width == 1440:
                        from PIL import Image
                        image = Image.open(io.BytesIO(page.screenshot())).convert('RGB').resize((720, 450), Image.LANCZOS)
                        image.save(DEMO / 'assets/thumbnail.webp', 'WEBP', quality=82)
                context.close()

            context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', service_workers='block')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            # Commerce: tabs switch without moving the page, add-to-order updates count and toasts.
            page.goto(base + 'commerce.html')
            page.locator('#tab-shop').scroll_into_view_if_needed()
            y = page.evaluate('scrollY')
            page.locator('[data-add="mug"]').click()
            page.locator('[data-add="bowl"]').click()
            page.locator('.toast').first.wait_for()
            assert page.locator('[data-order-count]').inner_text() == '2'
            page.locator('#tab-order').click()
            assert page.locator('#panel-order').is_visible()
            assert abs(page.evaluate('scrollY') - y) < 2
            assert page.locator('[data-order-total]').inner_text().replace('\xa0', ' ') == 'RM 83.00', page.locator('[data-order-total]').inner_text()
            page.keyboard.press('ArrowRight')
            assert page.evaluate("document.activeElement.getAttribute('role')") == 'tab'
            # Demo note opens an accessible dialog that traps focus and closes on Escape.
            page.locator('[data-demo-note]').first.click()
            dialog = page.locator('.dialog')
            dialog.wait_for()
            assert dialog.get_attribute('role') in ('dialog', 'alertdialog')
            assert page.evaluate("document.querySelector('.dialog').contains(document.activeElement)")
            for _ in range(5):
                page.keyboard.press('Tab')
                assert page.evaluate("document.querySelector('.dialog').contains(document.activeElement)")
            page.keyboard.press('Escape')
            dialog.wait_for(state='detached')
            # Mobile menu sheet.
            page.locator('[data-menu-open]').click()
            assert page.locator('.dialog .dialog-nav a').count() == 5
            page.keyboard.press('Escape')
            # Language button: disclosure with keyboard support, page does not move.
            page.goto(base + 'services.html#faq')
            lang_button = page.locator('[data-lang-menu] button')
            assert lang_button.is_visible() and lang_button.get_attribute('aria-expanded') == 'false'
            y = page.evaluate('scrollY')
            lang_button.click()
            assert lang_button.get_attribute('aria-expanded') == 'true'
            assert abs(page.evaluate('scrollY') - y) < 2
            assert page.locator('[data-lang-menu] [aria-current="true"]').get_attribute('data-lang') == 'en'
            assert page.locator('[data-lang-menu] a[data-lang="zh"]').get_attribute('href').endswith('services.html#faq')
            box = page.locator('[data-lang-menu] ul').bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= 390, box
            page.keyboard.press('Escape')
            assert lang_button.get_attribute('aria-expanded') == 'false'
            assert page.evaluate("document.activeElement.closest('[data-lang-menu]') !== null")
            lang_button.focus()
            page.keyboard.press('ArrowDown')
            assert page.evaluate("document.activeElement.dataset.lang") == 'en'
            page.mouse.click(5, 400)
            assert lang_button.get_attribute('aria-expanded') == 'false'
            page.locator('[data-lang-menu] button').click()
            page.locator('[data-lang-menu] a[data-lang="ms"]').click()
            page.wait_for_url('**/ms/services.html#faq')
            # Back-to-top appears after scrolling, returns to top and focuses h1.
            page.goto(base + 'index.html')
            top = page.locator('[data-back-to-top]')
            assert top.get_attribute('data-state') == 'hidden'
            page.evaluate('window.scrollTo(0, innerHeight * 3)')
            page.wait_for_function("document.querySelector('[data-back-to-top]').dataset.state === 'visible'")
            tb = top.bounding_box()
            assert tb['width'] >= 44 and tb['x'] + tb['width'] <= 390 and tb['y'] + tb['height'] <= 844
            top.click()
            page.wait_for_function('scrollY === 0')
            page.wait_for_function("document.activeElement && document.activeElement.tagName === 'H1'")
            page.wait_for_function("document.querySelector('[data-back-to-top]').dataset.state === 'hidden'")
            # Four distinct toasts do not freeze the page and at most three stay.
            page.goto(base + 'commerce.html')
            for item in ('mug', 'bowl', 'basket'):
                page.locator(f'[data-add="{item}"]').click()
            page.locator('[data-theme-toggle]').first.evaluate('b => b.click()')
            assert page.evaluate('1 + 1') == 2
            assert page.locator('.toast-region .toast:not(.is-leaving)').count() <= 3
            page.evaluate("document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('pomelo-v8-theme')")
            # Theme toggle persists.
            page.goto(base + 'index.html')
            page.locator('[data-menu-open]').click()
            page.locator('.dialog [data-theme-toggle]').click()
            assert page.locator('html').get_attribute('data-theme') == 'dark'
            page.keyboard.press('Escape')
            page.reload()
            assert page.locator('html').get_attribute('data-theme') == 'dark'
            # Update button: manual check says current, then a newer release offers an update.
            page.locator('[data-update]').click()
            page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'current'")
            page.route('**/release.json*', lambda route: route.fulfill(content_type='application/json', body=json.dumps({'version': NEWER, 'build': '20990101.1'})))
            page.evaluate("localStorage.clear()")
            page.reload()
            page.locator('[data-update]').click()
            page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'available'")
            page.unroute('**/release.json*')
            # Contact form validates without sending anything.
            posted = []
            page.on('request', lambda request: posted.append(request.url) if request.method != 'GET' else None)
            page.goto(base + 'contact.html')
            page.locator('form button[type="submit"]').click()
            assert page.locator('[aria-invalid="true"]').count() >= 1
            assert not posted
            context.close()

            # Service worker installs and serves the home page offline.
            context = browser.new_context(viewport={'width': 1440, 'height': 900})
            page = context.new_page()
            page.goto(base + 'index.html')
            page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null || (navigator.serviceWorker.ready.then(() => location.reload()), false)", timeout=15000)
            page.wait_for_function("caches.keys().then(k => k.some(n => n.startsWith('pomelo-v8-')))", timeout=15000)
            context.set_offline(True)
            page.reload()
            assert page.locator('h1').count() == 1
            context.close()
            browser.close()
    finally:
        server.shutdown()
    assert not errors, errors
    print('Pomelo V8 browser checks passed')


if __name__ == '__main__':
    main()
