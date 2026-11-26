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
                        assert page.locator('[data-update] .version').inner_text() == '7.18.2'
                        if width <= 700:
                            for control in page.locator('.controls .control, .controls summary').all():
                                if control.is_visible():
                                    box = control.bounding_box()
                                    assert box['width'] >= 44 and box['height'] >= 44, (width, locale, name, box)
                        if name == 'index':
                            assert page.locator('.hero-photo').get_attribute('src').endswith('merchant.webp')
                            assert page.locator('.hero-copy .eyebrow img').get_attribute('src').endswith('pomelo-compact.svg')
                            story_image = page.locator('.story-editorial-images img').first
                            assert story_image.get_attribute('src').endswith('ceramic-editorial.webp')
                            assert page.locator('.story-editorial-images img').count() == 1
                            assert page.locator('.merchant-story .story-step').count() == 3
                            assert page.locator('.home-services .card').count() == 3
                            if width <= 700:
                                assert page.locator('.merchant-story').evaluate('(el) => parseFloat(getComputedStyle(el).paddingTop)') == 48
                                for link in page.locator('.home-services .text-link').all():
                                    assert link.bounding_box()['height'] >= 44
                            story_image.scroll_into_view_if_needed()
                            page.wait_for_function("[...document.querySelectorAll('.story-editorial-images img')].every((img) => img.naturalWidth > 0)")
                        if name == 'commerce':
                            assert page.locator('.tour-products .object-basket').count() == 1
                            if width in (320, 568):
                                for product in page.locator('.tour-products .demo-product').all():
                                    assert product.bounding_box()['height'] >= 44
                                    assert float(product.locator('b').evaluate('(el) => parseFloat(getComputedStyle(el).fontSize)')) >= 14
                                    assert product.locator('b').bounding_box()['width'] >= 80
                            for view in page.locator('[data-order-view]').all():
                                assert view.is_visible() and 'PS-0125' in view.inner_text()
                                assert 'RM 96.00' in view.inner_text()
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
            posted_scenes = []
            page.on('request', lambda request: posted_scenes.append(request.url) if request.method != 'GET' else None)
            for locale, names, statuses, materials, delivery, ai_answer in (
                ('', ('Ceramic mug', 'Everyday bowl', 'Woven basket'), ('New order', 'Preparing'), ('Ceramic', 'Ceramic', 'Woven fibre'), 'Courier delivery', 'Your two ceramic mugs are being prepared'),
                ('zh/', ('陶瓷杯', '日用碗', '编织篮'), ('新订单', '准备中'), ('陶瓷', '陶瓷', '编织纤维'), '快递配送', '你的两只陶瓷杯正在为快递配送做准备'),
                ('ms/', ('Cawan seramik', 'Mangkuk harian', 'Bakul anyaman'), ('Pesanan baharu', 'Sedang disiapkan'), ('Seramik', 'Seramik', 'Serat anyaman'), 'Penghantaran kurier', 'Dua cawan seramik anda sedang disediakan'),
            ):
                for target_id in ('home-studio', 'home-ai'):
                    page.goto(base + locale + 'index.html')
                    page.locator(f'.value-card[href="#{target_id}"]').focus()
                    page.keyboard.press('Enter')
                    target = page.locator(f'#{target_id}')
                    assert page.url.endswith('#' + target_id)
                    assert target.evaluate('element => element === document.activeElement')
                    assert page.locator('#' + target.get_attribute('aria-labelledby')).inner_text().strip()
                page.goto(base + locale + 'commerce.html')
                for kind, amounts in (('delivery', ('RM 39.90', 'RM 79.80', 'RM 8.00', 'RM 87.80')), ('pickup', ('RM 32.00', 'RM 96.00', 'RM 0.00'))):
                    explanation = page.locator(f'[data-order-context="{kind}"]')
                    explanation.locator('summary').focus()
                    page.keyboard.press('Enter')
                    assert explanation.get_attribute('open') is not None
                    assert all(value in explanation.inner_text() for value in amounts)
                    page.keyboard.press('Enter')
                    assert explanation.get_attribute('open') is None
                comparison = page.locator('[data-comparison]')
                visible_cards = comparison.locator('[data-compare-card]:visible')
                assert visible_cards.evaluate_all("cards => cards.map(card => card.dataset.compareCard)") == ['0', '1']
                comparison.locator('[data-compare-first]').select_option('2')
                comparison.locator('[data-compare-second]').select_option('0')
                assert visible_cards.evaluate_all("cards => cards.map(card => card.dataset.compareCard)") == ['2', '0']
                for card, selector in zip(visible_cards.all(), ('[data-compare-first]', '[data-compare-second]')):
                    label = comparison.locator(selector).locator('..').evaluate('(label) => label.firstChild.textContent.trim()')
                    assert card.locator('[data-compare-position]').text_content().strip() == label
                    ids = card.get_attribute('aria-labelledby').split()
                    assert len(ids) == 2 and card.locator('#' + ids[0]).text_content().strip() == label
                    assert names[int(card.get_attribute('data-compare-card'))] in card.locator('#' + ids[1]).inner_text()
                comparison.locator('[data-compare-second]').select_option('2')
                assert visible_cards.count() == 1 and visible_cards.first.get_attribute('data-compare-card') == '2'
                assert comparison.locator('[data-compare-same]').is_visible()
                assert all(comparison.locator(selector).locator('..').evaluate('(label) => label.firstChild.textContent.trim()') in visible_cards.first.locator('[data-compare-position]').text_content() for selector in ('[data-compare-first]', '[data-compare-second]'))
                pickup_link = page.locator('a[href="#sample-pickup"]')
                pickup_link.focus()
                page.keyboard.press('Enter')
                pickup_target = page.locator('#sample-pickup')
                assert page.url.endswith('#sample-pickup')
                assert pickup_target.evaluate('element => element === document.activeElement')
                assert pickup_target.get_attribute('aria-labelledby') == 'sample-pickup-heading'
                link = page.locator('[data-open-delivery]')
                link.focus()
                page.keyboard.press('Enter')
                target = page.locator('#scene-1-1')
                assert page.locator('[data-tour-panel="1"]').is_visible()
                assert target.is_visible() and target.evaluate('element => element === document.activeElement')
                assert target.get_attribute('role') == 'region' and 'PS-0124' in target.get_attribute('aria-label')
                assert page.url.endswith('#scene-1-1')
                assert target.evaluate('element => { const r = element.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }')
                page.locator('[data-tour-tab="0"]').click()
                for i, name in enumerate(names):
                    page.locator('[data-product-button]').nth(i).click()
                    detail = page.locator('[data-scene-kind="0"] [data-scene-detail]').nth(i)
                    assert detail.is_visible() and name in detail.inner_text()
                    assert ('RM 39.90', 'RM 32.00', 'RM 48.00')[i] in detail.inner_text()
                    assert f'PH-00{i+1}' in detail.inner_text() and materials[i] in detail.inner_text()
                    assert detail.locator('.sample-product-details').get_attribute('open') is not None
                    context_detail = detail.locator('[data-product-context]')
                    context_detail.locator('summary').focus()
                    page.keyboard.press('Enter')
                    assert context_detail.get_attribute('open') is not None
                    assert all(value in context_detail.inner_text() for value in (name, f'PH-00{i+1}', materials[i], ('RM 39.90', 'RM 32.00', 'RM 48.00')[i]))
                    page.keyboard.press('Enter')
                    assert context_detail.get_attribute('open') is None
                    card = page.locator('[data-product-button]').nth(i)
                    assert card.locator('[data-product-state]').inner_text() == card.get_attribute('data-selected-label')
                    announcement = page.locator('[data-scene-kind="0"] [data-scene-status]').text_content()
                    assert name in announcement and ('RM 39.90', 'RM 32.00', 'RM 48.00')[i] in announcement
                    choice = detail.locator('[data-estimate-choice]')
                    choice.focus()
                    page.keyboard.press('Enter')
                    assert page.locator('[data-estimate-product]').evaluate('(el) => document.activeElement === el')
                    assert page.locator('[data-estimate-product]').input_value() == ('3990', '3200', '4800')[i]
                    assert ('RM 39.90', 'RM 32.00', 'RM 48.00')[i] in page.locator('[data-estimate-breakdown]').inner_text()
                    detail.locator('[data-view-studio]').click()
                    assert page.locator('[data-tour-panel="1"]').is_visible()
                    listing = page.locator('[data-studio-product]').nth(i)
                    assert listing.is_visible() and name in listing.inner_text()
                    assert all(value in listing.inner_text() for value in (f'PH-00{i+1}', materials[i], ('RM 39.90', 'RM 32.00', 'RM 48.00')[i]))
                    assert name in page.locator('[data-scene-kind="1"] [data-scene-status]').text_content()
                    assert sum(item.is_visible() for item in page.locator('[data-studio-product]').all()) == 1
                    page.locator('[data-tour-tab="0"]').click()
                page.locator('[data-tour-tab="1"]').click()
                for i, status in enumerate(statuses, 1):
                    page.locator('[data-scene-kind="1"] [data-scene-button]').nth(i).click()
                    detail = page.locator('[data-scene-kind="1"] [data-scene-detail]').nth(i)
                    assert detail.locator('.pill').inner_text() == status
                    assert delivery in detail.locator('.sample-fulfilment').inner_text()
                    assert detail.locator('.sample-order-progress [aria-current=step]').inner_text() == status
                    assert status in page.locator('[data-scene-kind="1"] [data-scene-status]').text_content()
                    assert all(value in detail.inner_text() for value in ('#PS-0124', 'PH-001', 'RM 79.80', 'RM 8.00', 'RM 87.80'))
                    handoff = detail.locator('.sample-handoff')
                    handoff.locator('summary').focus()
                    page.keyboard.press('Enter')
                    assert handoff.get_attribute('open') is not None
                    assert 'PH-001' in handoff.inner_text()
                    page.keyboard.press('Space')
                    assert handoff.get_attribute('open') is None
                estimator = page.locator('[data-estimator]')
                product = estimator.locator('[data-estimate-product]')
                quantity = estimator.locator('[data-estimate-quantity]')
                for value, count, expected in (('3990', '2', 'RM 79.80'), ('3200', '3', 'RM 96.00'), ('4800', '6', 'RM 288.00')):
                    product.select_option(value)
                    quantity.select_option(count)
                    assert estimator.locator('[data-estimate-total]').inner_text() == expected
                assert '#PS-0125' in page.locator('[data-order-view=customer]').inner_text()
                assert 'RM 96.00' in page.locator('[data-order-view=customer]').inner_text()
                pickup = page.locator('[data-pickup-example]')
                checks = pickup.locator('[data-prep-check]')
                preparing = pickup.get_attribute('data-preparing')
                ready = pickup.get_attribute('data-ready')
                assert pickup.locator('[data-prep-progress]').all_inner_texts() == ['0 / 2', '0 / 2']
                checks.nth(0).focus()
                page.keyboard.press('Space')
                assert pickup.locator('[data-pickup-status]').all_inner_texts() == [preparing, preparing]
                assert pickup.locator('[data-prep-progress]').all_inner_texts() == ['1 / 2', '1 / 2']
                checks.nth(1).focus()
                page.keyboard.press('Space')
                assert pickup.locator('[data-pickup-status]').all_inner_texts() == [ready, ready]
                assert page.locator('[data-index-pickup-status]').inner_text() == ready
                assert pickup.locator('[data-prep-progress]').all_inner_texts() == ['2 / 2', '2 / 2']
                assert ready in pickup.locator('[data-pickup-announcement]').text_content()
                assert '2 / 2' in pickup.locator('[data-pickup-announcement]').text_content()
                collected = pickup.locator('[data-pickup-collected]')
                assert collected.is_enabled()
                collected.focus()
                page.keyboard.press('Space')
                completed = pickup.get_attribute('data-collected')
                assert pickup.locator('[data-pickup-status]').all_inner_texts() == [completed, completed]
                assert page.locator('[data-index-pickup-status]').inner_text() == completed
                reset = pickup.locator('[data-pickup-reset]')
                assert reset.is_enabled() and reset.bounding_box()['height'] >= 44
                comparison_before = [comparison.locator(selector).input_value() for selector in ('[data-compare-first]', '[data-compare-second]')]
                estimate_before = [page.locator(selector).input_value() for selector in ('[data-estimate-product]', '[data-estimate-quantity]')]
                reset.focus()
                page.keyboard.press('Enter')
                assert reset.evaluate('element => element === document.activeElement')
                assert all(not check.is_checked() for check in checks.all())
                assert collected.is_disabled() and not collected.is_checked()
                assert pickup.locator('[data-pickup-status]').all_inner_texts() == [preparing, preparing]
                assert page.locator('[data-index-pickup-status]').inner_text() == preparing
                assert pickup.locator('[data-prep-progress]').all_inner_texts() == ['0 / 2', '0 / 2']
                announcement = pickup.locator('[data-pickup-announcement]')
                assert pickup.get_attribute('data-reset-done') in announcement.text_content()
                assert preparing in announcement.text_content() and '0 / 2' in announcement.text_content()
                assert [comparison.locator(selector).input_value() for selector in ('[data-compare-first]', '[data-compare-second]')] == comparison_before
                assert [page.locator(selector).input_value() for selector in ('[data-estimate-product]', '[data-estimate-quantity]')] == estimate_before
                checks.nth(0).check()
                reset.press('Space')
                assert all(not check.is_checked() for check in checks.all())
                assert pickup.locator('[data-prep-progress]').all_inner_texts() == ['0 / 2', '0 / 2']
                checks.nth(0).check()
                checks.nth(1).check()
                collected.check()
                checks.nth(1).uncheck()
                assert pickup.locator('[data-pickup-status]').all_inner_texts() == [preparing, preparing]
                assert collected.is_disabled() and not collected.is_checked()
                page.locator('[data-theme-toggle]').click()
                assert page.locator('html').get_attribute('data-theme') == 'dark'
                handoff.locator('summary').press('Enter')
                assert handoff.get_attribute('open') is not None and 'PH-001' in handoff.inner_text()
                handoff.locator('summary').press('Enter')
                page.locator('[data-theme-toggle]').click()
                page.locator('[data-tour-tab="2"]').click()
                page.locator('[data-scene-kind="2"] [data-scene-button]').nth(2).click()
                assert ai_answer in page.locator('.tour-message-answer').inner_text()
                assert ai_answer in page.locator('[data-scene-kind="2"] [data-scene-status]').text_content()
            page.goto(base + 'how-it-works.html')
            page.locator('.hero-journey-row').nth(2).click()
            assert page.url.endswith('#step-3')
            page.goto(base + 'services.html')
            page.locator('.service-preview-row').first.click()
            assert page.url.endswith('#service-offerings')
            page.goto(base + 'commerce.html')
            assert page.locator('[data-scene-switch]').count() == 3
            tablist = page.locator('[data-tour-tabs]')
            assert tablist.is_visible() and tablist.get_attribute('aria-orientation') == 'horizontal'
            assert page.locator('[data-tour-panel="0"]').is_visible()
            assert page.locator('[data-tour-panel="1"]').is_hidden()
            assert page.locator('.tour-products .demo-product-price').all_inner_texts() == ['RM 39.90', 'RM 32.00', 'RM 48.00']
            page.locator('.tour-shop-action').focus()
            page.keyboard.press('Enter')
            assert page.url.endswith('#sample-collection')
            products = page.locator('[data-product-button]')
            for i, (name, price, shape, description) in enumerate((
                ('Ceramic mug', 'RM 39.90', 'object-cup', 'slow, everyday moments'),
                ('Everyday bowl', 'RM 32.00', 'object-bowl', 'daily table'),
                ('Woven basket', 'RM 48.00', 'object-basket', 'close by'),
            )):
                products.nth(i).focus()
                page.keyboard.press('Space' if i == 1 else 'Enter')
                assert products.nth(i).get_attribute('aria-pressed') == 'true'
                assert products.nth(i).evaluate('(el) => el.matches(":focus-visible")')
                detail = page.locator('[data-scene-kind="0"] [data-scene-detail]').nth(i)
                assert detail.is_visible() and name in detail.inner_text() and price in detail.inner_text() and description in detail.inner_text()
                assert detail.locator('.' + shape).count() == 1
                assert sum(button.get_attribute('aria-pressed') == 'true' for button in products.all()) == 1
            product_details = page.locator('[data-scene-kind="0"] [data-scene-detail="2"] .sample-product-details')
            product_details.locator('summary').focus()
            page.keyboard.press('Enter')
            assert product_details.get_attribute('open') is None
            page.locator('[data-scene-kind="0"] [data-view-studio="2"]').focus()
            page.keyboard.press('Enter')
            assert page.locator('[data-tour-panel="1"]').is_visible()
            assert page.locator('[data-studio-product="2"]').is_visible()
            assert page.locator('[data-scene-kind="1"] [data-scene-button="0"]').evaluate('(el) => document.activeElement === el')
            assert page.locator('[data-tour-tab="1"]').get_attribute('aria-selected') == 'true'
            studio = page.locator('[data-scene-kind="1"]')
            assert 'Ready for review' in studio.locator('[data-scene-detail="0"]').inner_text()
            for i, status, note in ((1, 'New order', 'Next: preparing'), (2, 'Preparing', 'Preparing for the customer')):
                studio.locator('[data-scene-button]').nth(i).focus()
                page.keyboard.press('Enter')
                order = studio.locator('[data-scene-detail]').nth(i)
                assert order.is_visible() and studio.locator('[data-scene-button]').nth(i).get_attribute('aria-pressed') == 'true'
                assert order.locator('.sample-order-art .object-cup').count() == 1
                assert all(value in order.inner_text() for value in ('#PS-0124', 'Ceramic mug × 2', 'RM 79.80', 'RM 8.00', 'RM 87.80', status, note))
                assert order.locator('.pill').inner_text() == status
                assert studio.locator('[data-scene-detail]').nth(3-i).is_hidden()
            page.locator('[data-tour-tab="0"]').click()
            assert products.nth(2).get_attribute('aria-pressed') == 'true'
            assert page.locator('[data-scene-kind="0"] [data-scene-detail="2"]').is_visible()
            assert product_details.get_attribute('open') is None
            page.locator('[data-tour-tab="1"]').click()
            assert studio.locator('[data-scene-detail="2"]').is_visible()
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
            page.locator('[data-tour-tab="0"]').click()
            products.nth(1).click()
            assert products.nth(1).get_attribute('aria-pressed') == 'true'
            assert page.locator('[data-scene-kind="0"] [data-scene-detail="1"]').is_visible()
            page.locator('[data-scene-kind="0"] [data-view-studio="1"]').click()
            assert page.locator('[data-studio-product="1"]').is_visible()
            page.locator('[data-scene-kind="1"] [data-scene-button="2"]').click()
            dark_handoff = page.locator('[data-scene-kind="1"] [data-scene-detail="2"] .sample-handoff')
            dark_handoff.locator('summary').press('Enter')
            assert dark_handoff.get_attribute('open') is not None and 'PH-001' in dark_handoff.inner_text()
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
            page.route('**/release.json?*', lambda route: route.fulfill(status=200, content_type='application/json', body='{"version":"7.18.3"}'))
            page.locator('[data-update] summary').click()
            page.locator('[data-apply]').wait_for(state='visible')
            assert '7.18.3' in page.locator('[data-status]').inner_text()
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
            for locale in ('', 'zh/', 'ms/'):
                for target_id in ('home-studio', 'home-ai'):
                    static.goto(base + locale + 'index.html')
                    static.locator(f'.value-card[href="#{target_id}"]').focus()
                    static.keyboard.press('Enter')
                    assert static.locator(f'#{target_id}').evaluate('element => element === document.activeElement')
                static.goto(base + locale + 'commerce.html')
                assert static.locator('h1').is_visible()
                assert static.locator('[data-tour-tabs]').is_hidden()
                assert static.locator('[data-tour-panel]').count() == 3
                assert all(panel.is_visible() for panel in static.locator('[data-tour-panel]').all())
                assert all(controls.is_hidden() for controls in static.locator('[data-scene-buttons]').all())
                assert all(button.is_disabled() for button in static.locator('[data-product-button]').all())
                assert static.locator('[data-product-hint]').is_hidden()
                assert static.locator('.collection-heading noscript span').is_visible()
                assert static.locator('.tour-shop-action').get_attribute('href') == '#sample-collection'
                assert all(detail.is_visible() for detail in static.locator('[data-scene-detail]').all())
                assert all(detail.get_attribute('open') is not None for detail in static.locator('.sample-product-details').all())
                assert all(listing.is_visible() for listing in static.locator('[data-studio-product]').all())
                for detail in static.locator('[data-product-context], [data-order-context]').all():
                    detail.locator('summary').focus()
                    static.keyboard.press('Enter')
                    assert detail.get_attribute('open') is not None
                    assert detail.locator('.sample-context-body').is_visible()
                    static.keyboard.press('Enter')
                    assert detail.get_attribute('open') is None
                for handoff in static.locator('.sample-handoff').all():
                    handoff.locator('summary').focus()
                    static.keyboard.press('Enter')
                    assert handoff.get_attribute('open') is not None and 'PH-001' in handoff.inner_text()
                assert all(action.is_hidden() for action in static.locator('[data-view-studio]').all())
                assert all(check.is_disabled() for check in static.locator('[data-prep-check]').all())
                assert static.locator('[data-pickup-collected]').is_disabled()
                assert static.locator('[data-pickup-reset]').is_disabled()
                assert static.locator('[data-estimate-product]').is_disabled()
                assert static.locator('[data-estimate-quantity]').is_disabled()
                assert static.locator('[data-estimate-total]').inner_text() == 'RM 39.90'
                assert static.locator('[data-compare-first]').is_disabled()
                assert static.locator('[data-compare-second]').is_disabled()
                assert all(card.is_visible() for card in static.locator('[data-compare-card]').all())
                static_link = static.locator('[data-open-delivery]')
                assert static_link.get_attribute('href') == '#scene-1-1'
                static_link.focus()
                static.keyboard.press('Enter')
                assert static.url.endswith('#scene-1-1') and static.locator('#scene-1-1').is_visible()
                assert static.locator('#sample-pickup').is_visible()
                assert static.locator('[data-order-view=customer]').is_visible() and static.locator('[data-order-view=seller]').is_visible()
            static.goto(base + 'contact.html')
            assert static.locator('form input').first.is_disabled()
            nojs.close()
            browser.close()
        print('PASS: 126 page/viewport checks, themes, locale navigation, sample contact form, product concept tabs and update detection')
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
