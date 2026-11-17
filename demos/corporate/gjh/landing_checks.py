"""Check each GJH landing's visitor journey in a real browser and refresh its previews."""

import argparse
import functools
import http.server
import io
import os
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[3]
DEMOS = Path(__file__).resolve().parent
VERSIONS = [1, *range(5, 20)]
VIEWPORTS = {1440: 900, 768: 1024, 390: 844, 320: 740}
EXTERNAL = {
    5: ('.hero-covers a', 'https://www.gjh.com.sg/newmoon/'),
    13: ('.sector-desk a', 'https://www.gjh.com.sg/newmoon/'),
    16: ('.specimen-source', 'https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/'),
}
INTERNAL = {
    1: ('.division-index a', '#business-food'),
    6: ('.origin-plate', '#new-moon'),
    7: ('.partner-path a', '#business'),
    12: ('.table-index a', '#at-table-newmoon'),
    17: ('.menu-bookmarks a', '#supper'),
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, output):
        try:
            super().copyfile(source, output)
        except (BrokenPipeError, ConnectionResetError):
            pass


def activate(page, selector):
    action = page.locator(selector).first
    action.focus()
    action.press('Enter')


def journey(page, version):
    if version in EXTERNAL:
        if version == 16:
            activate(page, 'button.pack-side')
            expect(page.locator('#pack-portrait')).to_have_attribute('alt', 'Back label of the New Moon New Zealand abalone 425g tin')
            page.locator('#pack-portrait').evaluate('img => img.decode()')
            activate(page, 'button.pack-side')
            expect(page.locator('#pack-portrait')).to_have_attribute('src', 'assets/new-moon-front-480.webp')
        selector, destination = EXTERNAL[version]
        link = page.locator(selector).first
        expect(link).to_have_attribute('href', destination)
        # Exercise navigation without placing a request to a brand's production site.
        page.route(destination, lambda route: route.fulfill(content_type='text/html', body='<h1>Brand site</h1>'))
        activate(page, selector)
        expect(page.get_by_role('heading', name='Brand site')).to_be_visible()
    elif version in INTERNAL:
        selector, target = INTERNAL[version]
        activate(page, selector)
        page.wait_for_url('**/' + target)
        expect(page.locator(target)).to_be_in_viewport()
    elif version == 8:
        expect(page.locator('.epoch-index')).to_be_in_viewport(ratio=1)
        activate(page, '.epoch-index a[href="#chapter-2004"]')
        expect(page.locator('#chapter-2004')).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#journey-status')).to_contain_text('2004')
        page.reload()
        expect(page.locator('#chapter-2004')).to_have_attribute('aria-pressed', 'true')
    elif version == 9:
        activate(page, '.street-entry .entry-action')
        expect(page.locator('.scene-world')).to_have_attribute('data-current-room', 'mili')
        expect(page.locator('#map-mili-detail')).to_have_text('Pantry')
    elif version == 10:
        page.wait_for_function("document.body.dataset.view === '3d'", timeout=90000)
        activate(page, '[data-arcade-room="newmoon"]')
        expect(page.locator('body')).to_have_attribute('data-room', 'newmoon')
        expect(page.locator('.scene-products')).to_be_visible()
    elif version == 11:
        expect(page.locator('#mall-arrivals')).to_be_visible()
        expect(page.locator('.arrival-board li')).to_have_count(4)
        activate(page, '#arrival-products')
        page.wait_for_url('**/#featured-heading')
        expect(page.locator('#featured-heading')).to_be_focused()
        expect(page.locator('#store-list .product-card:visible')).to_have_count(4)
        page.locator('#product-search').fill('mexico')
        expect(page.locator('#store-list .product-card:visible')).to_have_count(1)
        assert page.evaluate("!performance.getEntriesByType('resource').some(r => /rapier|three\\.module|\\.glb(?:$|[?#])/.test(r.name))")
        page.go_back()
        expect(page.locator('#mall-arrivals')).to_be_visible()
        activate(page, '.arrival-board a[href="#arrival-nz"]')
        expect(page.locator('#arrival-nz')).to_be_focused()
        page.go_back()
        expect(page.locator('#mall-arrivals')).to_be_visible()
    elif version == 14:
        page.locator('#counter-view').focus()
        page.keyboard.press('ArrowRight')
        expect(page.locator('.archive-image')).to_be_visible()
        expect(page.locator('.counter-image')).to_be_hidden()
        page.keyboard.press('ArrowLeft')
        expect(page.locator('.counter-image')).to_be_visible()
    elif version == 15:
        activate(page, '.brand-row.mili .range-note summary')
        expect(page.locator('.brand-row.mili details p')).to_contain_text('Canned vegetables')
        expect(page.locator('.brand-row.mili details p')).to_be_visible()
    elif version == 18:
        activate(page, '.cover-presets a[href="#play"]')
        expect(page.locator('#play')).to_be_visible()
        expect(page.locator('.scene:visible')).to_have_count(1)
        expect(page.locator('.channels a[href="#play"]')).to_have_attribute('aria-current', 'true')
    elif version == 19:
        if not page.locator('.retail-setting').evaluate('details => details.open'):
            activate(page, '.retail-setting summary')
        page.locator('#retail-setting').select_option('online')
        activate(page, '#prepare-brief')
        assert 'online retail' in page.locator('#brief-text').input_value()
        page.locator('#retail-setting').select_option('')
        expect(page.locator('#brief-result')).to_be_hidden()


def capture_preview(page, version, width):
    # V10 and V11 are immersive viewport captures. Other design-detail assets show the whole page.
    if version < 10 or version > 11:
        page.evaluate("""async () => {
          document.querySelectorAll('img').forEach(image => image.loading = 'eager');
          await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
          if (document.querySelector('.reveal')) {
            for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
              scrollTo({top:y, behavior:'instant'}); await new Promise(requestAnimationFrame);
            }
          }
          scrollTo({top:0, behavior:'instant'});
        }""")
    if not (version == 11 and width in (390, 768)):
        page.wait_for_function('window.scrollY === 0')
    frame = page.screenshot(full_page=version not in (10, 11),
                            animations='allow' if version == 11 else 'disabled', scale='css', timeout=90000)
    folder = DEMOS / f'v{version}'
    (folder / 'screenshots' / f'{width}.png').write_bytes(frame)
    if width == 1440:
        with Image.open(io.BytesIO(frame)) as image:
            image.crop((0, 0, 1440, 900)).resize((720, 450), Image.Resampling.LANCZOS).save(
                folder / 'assets/thumbnail.webp', quality=88)


def run(versions, capture):
    handler = functools.partial(Handler, directory=ROOT)
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as server, sync_playwright() as playwright:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        browser = playwright.chromium.launch(
            channel='chrome', executable_path=os.environ.get('GALLERY_CHROME'),
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        try:
            for version in versions:
                widths = dict(VIEWPORTS)
                if capture and version in (1, 5, 6, 7):
                    widths[375] = 812
                for width, height in widths.items():
                    with browser.new_context(viewport={'width': width, 'height': height},
                                             reduced_motion='reduce', service_workers='block') as context:
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v{version}/',
                                  wait_until='domcontentloaded')
                        page.evaluate('document.fonts.ready')
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (version, width)
                        if capture and width != 320:
                            capture_preview(page, version, width)
                        journey(page, version)
                        assert not errors, (version, width, errors)
                        print(f'V{version} {width}px PASS', flush=True)
        finally:
            browser.close()
            server.shutdown()
            thread.join()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--versions', nargs='+', type=int, choices=VERSIONS, default=VERSIONS)
    parser.add_argument('--capture', action='store_true')
    args = parser.parse_args()
    run(args.versions, args.capture)
