"""Browser checks for the V7 product, comparison, and sample-order journeys."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

def run():
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/demos/corporate/pomelo-stem/v7/'
    checks = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
            for width,height in ((320,568),(390,844),(1440,900)):
                for locale in ('', 'zh/', 'ms/'):
                    for javascript in (True, False):
                        context = browser.new_context(viewport={'width':width,'height':height}, java_script_enabled=javascript, reduced_motion='reduce')
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        response = page.goto(base + locale + 'commerce.html', wait_until='load')
                        assert response.status == 200
                        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                        assert page.locator('.commerce-return').count() == 5
                        page.locator('.commerce-return').first.focus()
                        page.keyboard.press('Enter')
                        assert page.evaluate('location.hash') == '#commerce-guide'
                        assert page.evaluate('document.activeElement.id') == 'commerce-guide'
                        for target in ('sample-order-delivery','sample-order-pickup'):
                            assert page.locator('#'+target).count() == 1
                        if javascript:
                            page.locator('[data-product-button="1"]').click()
                            page.locator('[data-product-context="1"]').locator('summary').click()
                            link = page.locator('[data-scene-detail="1"] .product-order-link').first
                            link.focus(); page.keyboard.press('Enter')
                            assert page.evaluate('document.activeElement.id') == 'sample-order-pickup'
                            page.locator('[data-product-button="2"]').click()
                            page.locator('[data-compare-second]').select_option('2')
                            page.locator('[data-compare-choice="2"]').click()
                            assert page.locator('[data-compare-first]').input_value() == '2'
                            assert page.locator('[data-compare-second]').input_value() == '2'
                            assert page.locator('[data-compare-same]').is_visible()
                            assert page.locator('[data-compare-card]:visible').count() == 1
                            assert page.locator('[data-compare-first]').evaluate('(el) => document.activeElement === el')
                            page.locator('[data-tour-tab="1"]').click()
                            scene=page.locator('[data-scene-kind="1"]')
                            scene.locator('[data-scene-button="2"]').click()
                            assert page.locator('[data-index-delivery-status]').inner_text() == scene.locator('[data-scene-detail="2"] .sample-order-head .pill').inner_text()
                            scene.locator('[data-scene-button="1"]').click()
                            assert page.locator('[data-index-delivery-status]').inner_text() == scene.locator('[data-scene-detail="1"] .sample-order-head .pill').inner_text()
                        else:
                            assert page.locator('[data-compare-choice]:visible').count() == 0
                            assert page.locator('[data-compare-card]:visible').count() == 3
                        page.locator('.order-product-return').first.focus()
                        page.keyboard.press('Enter')
                        assert page.evaluate('document.activeElement.id') == 'product-preview'
                        assert not errors, errors
                        context.close(); checks += 1
            browser.close()
    finally:
        server.shutdown(); server.server_close()
    print(f'PASS: {checks} localized responsive sample-journey checks')

if __name__ == '__main__': run()
