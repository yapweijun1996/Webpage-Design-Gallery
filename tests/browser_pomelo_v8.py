"""Browser checks for Pomelo STEM V8; also writes the gallery screenshots and thumbnail."""
import functools
import http.server
import io
import json
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demos/corporate/pomelo-stem/v8'
PAGES = ('index', 'commerce', 'services', 'about', 'contact')
VERSION = json.loads((DEMO / 'release.json').read_text('utf-8'))['version']
major, minor, patch = map(int, VERSION.split('.'))
NEWER = f'{major}.{minor}.{patch + 1}'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def launch(p):
    path = os.environ.get('GALLERY_CHROME')
    return p.chromium.launch(executable_path=path, headless=True) if path else p.chromium.launch(headless=True)


def main():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/demos/corporate/pomelo-stem/v8/'
    errors = []
    try:
        with sync_playwright() as p:
            browser = launch(p)
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
