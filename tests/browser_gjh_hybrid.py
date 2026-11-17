"""Check the hybrid directory, demo bag and 3D handoff in real Chrome."""
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROME = os.environ.get('GALLERY_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
ARGS = ['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=CHROME, args=ARGS)
            try:
                for width, height in [(1440, 900), (390, 844), (320, 700)]:
                    context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
                    context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1', 'dismissed')")
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                    assert page.evaluate('window.__sceneReady === true'), '3D mall failed to start'
                    if page.locator('#experience').is_visible():
                        page.locator('#view-toggle').click()
                    assert page.locator('#store-list').is_visible()
                    assert page.locator('[data-store]:visible').count() == 3
                    page.locator('[data-store-filter="mili"]').click()
                    assert page.locator('[data-store]:visible').count() == 1
                    assert page.locator('[data-store="mili"]').is_visible()
                    page.locator('[data-store="mili"] .brand-inspect').click()
                    assert page.locator('#product-image').get_attribute('src') == 'assets/mili-brand-cover.jpg'
                    page.keyboard.press('Escape')
                    mili_gallery = page.locator('[data-store="mili"] .brand-concepts')
                    mili_gallery.locator('summary').click()
                    assert mili_gallery.evaluate('(element) => element.open')
                    assert mili_gallery.locator('.brand-concept-grid img').count() == 3
                    mili_gallery.locator('.brand-concept-grid img').first.scroll_into_view_if_needed()
                    mili_gallery.locator('.brand-concept-grid img').first.evaluate('(image) => image.decode()')
                    mili_gallery.locator('summary').click()
                    page.locator('#hero-shop').click()
                    assert page.locator('[data-store]:visible').count() == 3
                    assert page.locator('.brand-concepts').count() == 3
                    assert page.locator('.brand-concept-grid img').count() == 9
                    assert page.locator('.product-card .brand-concepts').count() == 0
                    for brand in ('newmoon', 'mili', 'gogo'):
                        assert page.locator(f'[data-store="{brand}"] > .brand-concepts').count() == 1
                    page.locator('#product-search').fill('Mexico')
                    assert page.locator('.product-card:visible').count() == 1
                    page.locator('#product-search').fill('no matching product')
                    assert page.locator('.product-card:visible').count() == 0
                    assert 'No products' in page.locator('#product-results').inner_text()
                    page.locator('#product-search').fill('')
                    page.locator('#product-sort').select_option('name')
                    page.locator('[data-add]').first.click()
                    assert '1' in page.locator('#bag-open').inner_text()
                    assert 'Added' in page.locator('.product-feedback:visible').first.inner_text()
                    page.locator('[data-inspect]').first.click()
                    assert page.locator('#product-dialog').is_visible()
                    page.keyboard.press('Escape')
                    assert not page.locator('#product-dialog').is_visible()
                    page.locator('#bag-open').click()
                    assert page.locator('#bag-dialog').is_visible()
                    page.locator('#bag-close').click()
                    page.locator('#visit-newmoon-3d').click()
                    assert page.locator('#scene').is_visible()
                    page.wait_for_function("Math.abs(window.__mall.state.x + 10) < 0.5 && Math.abs(window.__mall.state.z - 2.4) < 0.5", timeout=10000)
                    page.locator('#view-toggle').click()
                    assert page.locator('#store-list').is_visible()
                    assert '1' in page.locator('#bag-open').inner_text()
                    page.locator('.concept-gallery summary').click()
                    assert page.locator('.concept-grid img').count() == 20
                    page.locator('.concept-gallery summary').click()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    assert page.locator('#context-rewards').evaluate('(el) => el.scrollWidth <= el.clientWidth')
                    assert not errors, errors
                    print(f'{width}px: PASS')
                    context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    run()
