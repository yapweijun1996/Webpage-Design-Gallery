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
            for width, height in ((1440, 900), (1100, 800), (768, 1024), (390, 844), (375, 812), (320, 568), (568, 320)):
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
                        assert page.locator('[data-update] .version').inner_text() == '7.5.0'
                        if width <= 700:
                            for control in page.locator('.controls .control, .controls summary').all():
                                if control.is_visible():
                                    box = control.bounding_box()
                                    assert box['width'] >= 44 and box['height'] >= 44, (width, locale, name, box)
                        if name == 'index':
                            assert page.locator('.hero-photo').get_attribute('src').endswith('merchant.webp')
                            story_image = page.locator('.story-image img')
                            assert story_image.get_attribute('src').endswith('ceramic-study.webp')
                            story_image.scroll_into_view_if_needed()
                            page.wait_for_function("document.querySelector('.story-image img').naturalWidth > 0")
                        if name == 'commerce':
                            assert page.locator('.demo-product-art .object-basket').count() == 1
                            shop_image = page.locator('.tour-shop-hero img')
                            shop_image.scroll_into_view_if_needed()
                            page.wait_for_function("document.querySelector('.tour-shop-hero img').naturalWidth > 0")
                        if name == 'contact':
                            assert page.locator('form input').first.is_enabled()
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
                page.goto(base + 'index.html')
                page.wait_for_url('**/zh/index.html')
                page.locator('.controls details.panel').first.locator('summary').click()
                page.locator('.panel-menu a[data-locale="en"]').click()
                page.wait_for_url('**/v7/index.html')
                if width in (1440, 768, 390):
                    page.goto(base + 'index.html', wait_until='load')
                    page.locator('.loader').wait_for(state='hidden')
                    page.screenshot(path=str(DEMO / 'screenshots' / f'{width}.png'))
                context.close()
            context = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce')
            page = context.new_page()
            page.goto(base + 'how-it-works.html')
            page.locator('.hero-journey-row').nth(2).click()
            assert page.url.endswith('#step-3')
            page.goto(base + 'services.html')
            page.locator('.service-preview-row').first.click()
            assert page.url.endswith('#service-offerings')
            page.goto(base + 'commerce.html')
            posted_scenes = []
            page.on('request', lambda request: posted_scenes.append(request.url) if request.method != 'GET' else None)
            assert page.locator('[data-scene-switch]').count() == 3
            page.locator('[data-scene-switch]').nth(0).locator('[data-scene-button]').nth(1).click()
            assert page.locator('[data-scene-switch]').nth(0).locator('[data-scene-detail]').nth(1).is_visible()
            assert page.locator('[data-scene-switch]').nth(0).locator('[data-scene-button]').nth(1).get_attribute('aria-pressed') == 'true'
            tablist = page.locator('[data-tour-tabs]')
            assert tablist.is_visible() and tablist.get_attribute('aria-orientation') == 'horizontal'
            assert page.locator('[data-tour-panel="0"]').is_visible()
            assert page.locator('[data-tour-panel="1"]').is_hidden()
            assert page.locator('.demo-product-price').all_inner_texts() == ['RM 39.90', 'RM 32.00', 'RM 48.00']
            page.locator('[data-tour-tab="1"]').click()
            assert page.locator('[data-tour-panel="1"]').is_visible()
            order = page.locator('.sample-order')
            assert order.locator('.sample-order-art .object-cup').count() == 1
            assert all(value in order.inner_text() for value in ('#PS-0124', 'Ceramic mug × 2', 'RM 79.80', 'RM 8.00', 'RM 87.80', 'New order', 'Next: preparing'))
            assert page.locator('[data-tour-tab="1"]').get_attribute('aria-selected') == 'true'
            page.locator('[data-scene-switch]').nth(1).locator('[data-scene-button]').nth(2).click()
            assert 'Preparing' in page.locator('[data-scene-switch]').nth(1).locator('[data-scene-detail]').nth(2).inner_text()
            page.locator('[data-tour-tab="1"]').press('ArrowRight')
            assert page.locator('[data-tour-panel="2"]').is_visible()
            assert page.locator('[data-tour-tab="2"]').evaluate('(el) => document.activeElement === el')
            assert 'No AI request is sent.' in page.locator('[data-tour-panel="2"]').inner_text()
            page.locator('[data-scene-switch]').nth(2).locator('[data-scene-button]').nth(1).click()
            assert page.locator('[data-scene-switch]').nth(2).locator('[data-scene-detail]').nth(1).is_visible()
            assert 'Share a ceramic mug' in page.locator('.tour-message-user').inner_text()
            assert 'warm drink' in page.locator('.tour-message-answer').inner_text()
            assert 'Future concept' in page.locator('.future-section').inner_text()
            assert not posted_scenes, posted_scenes
            page.locator('[data-theme-toggle]').click()
            page.wait_for_function("document.documentElement.dataset.theme === 'dark'")
            assert page.locator('h1').is_visible()
            context.close()
            context = browser.new_context(viewport={'width':1440,'height':900})
            page = context.new_page()
            page.goto(base + 'contact.html')
            posted = []
            page.on('request', lambda request: posted.append(request.url) if request.method != 'GET' else None)
            page.locator('form input[name="name"]').fill('Sample name')
            page.locator('form button[type="submit"]').click()
            assert page.locator('[data-demo-result]').inner_text() == 'This is a preview only. No enquiry was sent.'
            assert page.locator('form input[name="name"]').input_value() == 'Sample name'
            assert not posted, posted
            page.goto(base + 'contact.html')
            page.route('**/release.json?*', lambda route: route.fulfill(status=200, content_type='application/json', body='{"version":"7.5.1"}'))
            page.locator('[data-update] summary').click()
            page.locator('[data-apply]').wait_for(state='visible')
            assert '7.5.1' in page.locator('[data-status]').inner_text()
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
            assert static.locator('[data-tour-tabs]').is_hidden()
            assert static.locator('[data-tour-panel]').count() == 3
            assert all(panel.is_visible() for panel in static.locator('[data-tour-panel]').all())
            assert static.locator('[data-scene-buttons]').first.is_hidden()
            assert all(detail.is_visible() for detail in static.locator('[data-scene-detail]').all())
            static.goto(base + 'contact.html')
            assert static.locator('form input').first.is_disabled()
            nojs.close()
            browser.close()
        print('PASS: 126 page/viewport checks, themes, locale navigation, sample contact form, product concept tabs and update detection')
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
