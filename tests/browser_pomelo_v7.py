"""Validate V7 pages and generate honest screenshots from the rendered site."""
import functools
import http.server
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGES = ('index', 'commerce', 'how-it-works', 'services', 'about', 'contact')
DEMO = ROOT / 'demos/corporate/pomelo-stem/v7'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def main():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/demos/corporate/pomelo-stem/v7/'
    errors = []
    try:
        with sync_playwright() as p:
            path = os.environ.get('GALLERY_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
            browser = p.chromium.launch(executable_path=path, headless=True)
            for width, height in ((1440, 900), (768, 1024), (390, 844), (320, 780)):
                context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                for locale in ('', 'zh/', 'ms/'):
                    for name in PAGES:
                        response = page.goto(base + locale + name + '.html', wait_until='load')
                        assert response.status == 200, (width, locale, name, response.status)
                        assert page.locator('h1').count() == 1, (width, locale, name)
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, locale, name, page.evaluate('document.documentElement.scrollWidth'))
                        assert page.locator('main').inner_text().strip(), (width, locale, name)
                        assert page.locator('[data-update] .version').inner_text() == '7.0.0'
                        if name == 'contact':
                            assert page.locator('form input').first.is_disabled()
                            assert page.locator('a[href="https://wa.me/601139023123"]').count() >= 1
                page.goto(base + 'index.html')
                page.locator('[data-theme-toggle]').click()
                assert page.locator('html').get_attribute('data-theme') == 'dark'
                page.reload()
                assert page.locator('html').get_attribute('data-theme') == 'dark'
                page.locator('[data-theme-toggle]').click()
                page.locator('.controls details.panel').first.locator('summary').click()
                page.locator('.panel-menu a[href="./zh/index.html"]').click()
                assert page.url.endswith('/zh/index.html')
                if width in (1440, 768, 390):
                    page.goto(base + 'index.html', wait_until='load')
                    page.screenshot(path=str(DEMO / 'screenshots' / f'{width}.png'))
                context.close()
            context = browser.new_context(viewport={'width':1440,'height':900})
            page = context.new_page()
            page.goto(base + 'contact.html')
            page.route('**/release.json?*', lambda route: route.fulfill(status=200, content_type='application/json', body='{"version":"7.0.1"}'))
            page.locator('[data-update] summary').click()
            page.locator('[data-apply]').wait_for(state='visible')
            assert '7.0.1' in page.locator('[data-status]').inner_text()
            page.locator('[data-apply]').click()
            page.wait_for_load_state('load')
            page.wait_for_function("document.querySelector('[data-status]').textContent.includes('could not be verified')")
            page.unroute_all(behavior='ignoreErrors')
            page.route('**/release.json?*', lambda route: route.abort('failed'))
            page.locator('[data-retry]').click()
            page.wait_for_function("document.querySelector('[data-status]').textContent.includes('Could not check')")
            assert page.locator('[data-apply]').is_hidden()
            assert not errors, errors
            context.close()
            nojs = browser.new_context(java_script_enabled=False)
            static = nojs.new_page()
            static.goto(base + 'commerce.html')
            assert static.locator('h1').is_visible() and static.get_by_role('link', name='Contact Us').first.is_visible()
            nojs.close()
            browser.close()
        print('PASS: 72 page/viewport checks, themes, locale navigation, disabled contact form and update detection')
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
