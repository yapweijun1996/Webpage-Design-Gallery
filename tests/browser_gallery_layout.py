"""Check compact collections, responsive settings and comparison interactions."""
import functools
import http.server
import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gallery import gallery, QuietHandler
from gallery_browser_helpers import open_settings, select_preference

ROOT = Path(__file__).resolve().parents[1]


def run():
    captures = ROOT / 'docs/screenshots/gallery-layout'
    captures.mkdir(parents=True, exist_ok=True)
    evidence = {'capturedAt': datetime.now(timezone.utc).isoformat(), 'cases': [],
                'limitations': ['Headless Chrome; no physical devices, Safari or screen-reader acceptance.']}
    with tempfile.TemporaryDirectory(prefix='gallery-layout-') as temporary:
        gallery.build(Path(temporary) / 'Webpage-Design-Gallery')
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/'
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
                for width in (320, 390, 559, 560, 639, 650, 651, 1440):
                    context = browser.new_context(viewport={'width': width, 'height': 826}, reduced_motion='reduce', service_workers='block')
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                    page.goto(base + 'companies/gjh/index.html', wait_until='networkidle')
                    page.wait_for_selector('html[data-preferences-ready="true"]')
                    summary = page.locator('.gallery-settings > summary')
                    for language in ('en', 'zh-Hans', 'ms'):
                        select_preference(page, '#language-select', language)
                        brand = page.locator('.site-identity')
                        visible_name = ' '.join(brand.inner_text().split())
                        assert page.get_by_role('link', name=visible_name, exact=True).and_(brand).count() == 1, language
                        for theme in ('light', 'dark'):
                            select_preference(page, '#theme-select', theme)
                            if width <= 1000:
                                panel = page.locator('.settings-panel').bounding_box()
                                assert panel['x'] >= 0 and panel['x'] + panel['width'] <= width
                                page.keyboard.press('Escape')
                                assert not page.locator('.gallery-settings').evaluate('(e)=>e.open')
                                assert summary.evaluate('(e)=>document.activeElement===e')
                            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, language)
                            header = page.locator('.site-header').bounding_box()
                            mobile_header = width <= 559
                            identity = brand.bounding_box()
                            nav = page.locator('.header-inner nav').bounding_box()
                            assert (nav['y'] >= identity['y'] + identity['height']) == mobile_header, (width, language, identity, nav)
                            if width <= 1000:
                                assert header['height'] <= (100 if mobile_header else 64), (width, language, header)
                            columns = page.locator('.design-grid').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
                            assert columns == (1 if width < 560 else 2), (width, columns)
                    select_preference(page, '#language-select', 'en')
                    if width <= 1000:
                        page.keyboard.press('Escape')
                        before = page.locator('h1').bounding_box()
                        summary.click()
                        page.wait_for_function('() => document.activeElement.id === "theme-select"')
                        assert page.locator('h1').bounding_box() == before, 'Settings reflows collection'
                        page.mouse.click(5, 400)
                        assert not page.locator('.gallery-settings').evaluate('(e)=>e.open')
                        summary.click()
                        page.keyboard.press('Escape')
                    page.locator('input[value="v5"]').check()
                    page.locator('input[value="v7"]').check()
                    assert page.locator('input[value="v1"]').is_disabled()
                    page.locator('#style-filter').select_option('minimal')
                    assert page.locator('#selection-items button').count() == 2
                    page.locator('#selection-items button').first.click()
                    assert page.locator('#selection-items button').count() == 1
                    page.locator('#clear-selection').click()
                    assert page.locator('.compare-tray').is_hidden()
                    assert page.locator('#style-filter').evaluate('(e)=>document.activeElement===e')
                    page.locator('#style-filter').select_option('')
                    page.locator('.design-card .card-action').first.focus()
                    page.locator('.design-card .card-action').first.scroll_into_view_if_needed()
                    action = page.locator('.design-card .card-action').first.bounding_box()
                    header = page.locator('.app-chrome').bounding_box()
                    assert action['y'] >= max(0, header['y'] + header['height']), (width, action, header)
                    for selector in ('.compare-checkbox', '.details-link', '.card-action'):
                        rect = page.locator('.design-card').first.locator(selector).bounding_box()
                        assert rect['height'] >= 44 and rect['width'] >= 44, (width, selector, rect)
                    # Resize with settings open: desktop and mobile must both recover.
                    if width == 639:
                        summary.click()
                        # Chrome dispatches media-query changes on a rendering update.
                        page.evaluate('''() => { window.desktopSettingsChange = new Promise(resolve =>
                            matchMedia('(max-width: 1000px)').addEventListener('change', resolve, {once:true})); }''')
                        page.set_viewport_size({'width': 1440, 'height': 826})
                        page.evaluate('window.desktopSettingsChange.then(() => true)')
                        assert page.locator('#theme-select').is_visible()
                        page.set_viewport_size({'width': width, 'height': 826})
                        page.locator('.gallery-settings:not([open])').wait_for()
                    for preview in page.locator('.design-preview').all():
                        rect = preview.bounding_box()
                        assert abs(rect['height'] - (180 if width < 560 else rect['width'] / 1.6)) < 1, (width, rect)
                    for image in page.locator('.design-preview img').all():
                        image.scroll_into_view_if_needed()
                        image.evaluate('(e)=>e.decode()')
                    page.evaluate('scrollTo(0,0)')
                    page.locator('.site-identity').focus()
                    if width in (390, 639, 1440):
                        page.screenshot(path=str(captures / f'company-{width}.png'), full_page=True)
                    metrics = page.locator('.design-card').first.bounding_box()
                    assert not errors, errors
                    evidence['cases'].append({'width': width, 'languages': 3, 'themes': 2, 'firstCard': metrics, 'settingsAndSelection': 'PASS', 'consoleErrors': errors})
                    context.close()
                evidence['browserVersion'] = browser.version
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
    (ROOT / 'docs/evidence/gallery-layout.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence, indent=2))


if __name__ == '__main__':
    run()
