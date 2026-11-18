"""Check each GJH landing's visitor journey in a real browser and refresh its previews."""

import argparse
import functools
import http.server
import io
import os
import re
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[3]
DEMOS = Path(__file__).resolve().parent
VERSIONS = [1, *range(5, 22)]
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
    20: ('.shortcut-list a[href="#featured-product"]', '#featured-product'),
    21: ('.shortcut-list a[href="#brand-new-moon"]', '#brand-new-moon'),
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
        if version in (20, 21):
            expect(page.locator('h1')).to_have_count(1)
            if page.viewport_size['width'] == 390:
                strip_selector = '.shortcuts' if version == 20 else '.brand-strip'
                expect(page.locator(strip_selector)).to_be_in_viewport()
                expect(page.locator(selector)).to_be_in_viewport(ratio=1)
            if page.viewport_size['width'] == 1440 or (
                version == 21 and page.viewport_size['width'] == 390
            ):
                for action in page.locator('.hero-actions a').all():
                    expect(action).to_be_in_viewport(ratio=1)
        activate(page, selector)
        page.wait_for_url('**/' + target)
        expect(page.locator(target)).to_be_in_viewport()
        if version == 21:
            expect(page.locator('#brand-new-moon-heading')).to_be_focused()
            expect(page.locator(target).get_by_role('link', name='View Brand, New Moon')).to_have_attribute(
                'href', 'https://www.gjh.com.sg/newmoon/')
            if page.viewport_size['width'] <= 390:
                controls = page.locator('main :is(a, button, input, textarea):visible, '
                                        '.page-header :is(a, summary):visible, .page-footer a:visible')
                assert controls.evaluate_all("""nodes => nodes.every(node => {
                  const {width, height} = node.getBoundingClientRect();
                  return width >= 44 && height >= 44;
                })""")
                trigger = page.locator('#mobile-menu summary')
                trigger.press('Enter')
                menu_contact = page.locator('#mobile-menu').get_by_role('link', name='Contact')
                expect(menu_contact).to_be_visible()
                menu_contact.press('Escape')
                expect(trigger).to_be_focused()
                expect(menu_contact).to_be_hidden()
        if version in (20, 21):
            portfolio_enquiry(page, version)
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


def portfolio_enquiry(page, version):
    product = 'New Moon Premium Wild Caught New Zealand Abalone 425g'
    featured = page.locator('#featured-product')
    expect(featured.get_by_role('heading')).to_have_text(product)
    expect(featured.get_by_role('link', name='View Product')).to_have_attribute(
        'href', 'https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/')
    page.locator('#enquiry-requirements').fill('Quantity and delivery location')
    featured.get_by_role('link', name='Enquire About This Product').click()
    expect(page.locator('#enquiry')).to_be_focused()
    expect(page.locator('#enquiry-brand')).to_have_value('New Moon')
    expect(page.locator('#enquiry-product')).to_have_value(product)
    expect(page.locator('#enquiry-requirements')).to_have_value('Quantity and delivery location')
    expect(page.get_by_role('link', name='Open Official Contact')).to_have_attribute(
        'href', 'https://www.gjhglobal.com/contact-us/')

    # Exercise manual copying even on a browser that grants clipboard access.
    page.evaluate("""Object.defineProperty(navigator, 'clipboard', {
      value: {writeText: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))}
    })""")
    page.get_by_role('button', name='Copy Enquiry Details').click()
    draft = page.locator('#enquiry-draft')
    expect(draft).to_be_focused()
    expect(draft).to_have_attribute('readonly', '')
    expect(draft).to_have_value(f'Brand: New Moon\nProduct: {product}\nPurchase requirements: Quantity and delivery location')
    assert draft.evaluate('field => field.selectionStart === 0 && field.selectionEnd === field.value.length')

    page.get_by_role('button', name='Lifestyle', exact=True).click()
    expect(page.locator('.brand-card[data-category]:visible')).to_have_count(1)
    if version == 21:
        expect(page.locator('#brand-status')).to_have_text('1 brand shown.')
    page.locator('.shortcut-list').get_by_role('link', name='MILI', exact=True).click()
    focus_target = '#brand-mili-heading' if version == 21 else '#brand-mili'
    active_filter = 'All' if version == 21 else 'Food & Beverage'
    expect(page.locator(focus_target)).to_be_focused()
    expect(page.get_by_role('button', name=active_filter, exact=True)).to_have_attribute('aria-pressed', 'true')
    page.locator('#brand-mili').get_by_role('link', name='Enquire about MILI').click()
    expect(page.locator('#enquiry-brand')).to_have_value('MILI')
    expect(page.locator('#enquiry-product')).to_have_value('')
    expect(page.locator('#enquiry-requirements')).to_have_value('Quantity and delivery location')
    page.get_by_role('button', name='All', exact=True).click()
    expect(page.locator('.brand-card[data-category]:visible')).to_have_count(5)
    assert page.evaluate("!performance.getEntriesByType('resource').some(entry => entry.name.includes('/v11/'))")


def portfolio_without_javascript(browser, url, version):
    with browser.new_context(viewport={'width': 390, 'height': 844}, java_script_enabled=False) as context:
        page = context.new_page()
        page.goto(url, wait_until='domcontentloaded')
        expect(page.locator('.brand-card[data-category]:visible')).to_have_count(5)
        page.locator(INTERNAL[version][0]).click()
        expect(page.locator(INTERNAL[version][1])).to_be_in_viewport()
        if version == 21:
            menu = page.locator('#mobile-menu summary')
            menu.click()
            expect(page.locator('#mobile-menu').get_by_role('link', name='Contact')).to_be_visible()
            menu.click()
            expect(page.get_by_role('button', name='Copy Enquiry Details')).to_be_hidden()
        page.get_by_role('link', name='Enquire About This Product').click()
        expect(page.get_by_role('link', name='Open Official Contact')).to_have_attribute(
            'href', 'https://www.gjhglobal.com/contact-us/')
        expect(page.get_by_role('link', name='Open Official Contact')).to_be_in_viewport()


def exhibition_iframe(browser, origin):
    with browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block') as context:
        page = context.new_page()
        page.goto(f'{origin}/compare/index.html?company=gjh&left=v20&right=v21')
        frame = page.frame_locator('iframe[title="Product Exhibition live demo"]')
        frame.locator('#featured-product [data-enquire]').click()
        expect(frame.locator('#enquiry-brand')).to_have_value('New Moon')
        copy = frame.get_by_role('button', name='Copy Enquiry Details')
        copy.evaluate("""() => Object.defineProperty(navigator, 'clipboard', {
          value: {writeText: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))}
        })""")
        copy.click()
        draft = frame.locator('#enquiry-draft')
        expect(draft).to_have_attribute('readonly', '')
        expect(draft).to_have_value(re.compile(r'Product: New Moon Premium Wild Caught New Zealand Abalone 425g'))
        frame.get_by_role('button', name='Select All').click()
        expect(draft).to_be_focused()
        assert draft.evaluate('field => field.selectionStart === 0 && field.selectionEnd === field.value.length')


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
    (folder / 'screenshots').mkdir(exist_ok=True)
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
            origin = f'http://127.0.0.1:{server.server_port}'
            for version in versions:
                url = f'{origin}/demos/corporate/gjh/v{version}/'
                widths = dict(VIEWPORTS)
                if capture and version in (1, 5, 6, 7):
                    widths[375] = 812
                for width, height in widths.items():
                    with browser.new_context(viewport={'width': width, 'height': height},
                                             reduced_motion='reduce', service_workers='block') as context:
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        if version == 21:
                            page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                        page.goto(url, wait_until='domcontentloaded')
                        page.evaluate('document.fonts.ready')
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (version, width)
                        if capture and width != 320:
                            capture_preview(page, version, width)
                        journey(page, version)
                        assert not errors, (version, width, errors)
                        print(f'V{version} {width}px PASS', flush=True)
                if version in (20, 21):
                    portfolio_without_javascript(browser, url, version)
                    print(f'V{version} 390px without JavaScript PASS', flush=True)
                if version == 21:
                    exhibition_iframe(browser, origin)
                    print('V21 gallery iframe clipboard fallback PASS', flush=True)
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
