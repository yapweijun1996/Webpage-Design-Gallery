"""Apply a seasonal decoration from the paused public menu at three screen sizes."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_lift import Quiet
from gjh_menu_test_helpers import open_decor_theme

ROOT = Path(__file__).resolve().parents[1]


def apply_theme(page, theme):
    page.locator('#mall-theme-select').select_option(theme)
    page.locator('#mall-theme-apply').click()
    page.wait_for_function(
        'id => __mall.state.theme.active === id && !__mall.state.theme.pending', arg=theme, timeout=30000)
    assert page.locator('#mall-theme-dialog').is_visible()
    assert page.evaluate('__mall.state.paused')
    assert page.locator('#mall-theme-apply').is_enabled()


def check_viewport(browser, url, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 1000,
                                  service_workers='block')
    try:
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        page.locator('#arrival-walk').click()
        page.wait_for_function('window.__sceneReady === true', timeout=90000)
        open_decor_theme(page)
        position = '() => { const {x,y,z} = __mall.state; return [x,y,z]; }'
        before = page.evaluate(position)
        for theme in ('everyday', 'lunar-new-year', 'everyday'):
            apply_theme(page, theme)
            assert page.evaluate(position) == before
        page.locator('#mall-theme-close').click()
        page.wait_for_function('!__mall.state.paused')
        assert not errors, errors
        print(f'PASS {width}x{height}: paused theme prepared, restored and closed', flush=True)
    finally:
        context.close()


def run():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                args=['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'metal'), '--ignore-gpu-blocklist'])
            try:
                for width, height in ((390, 844), (768, 1024), (1440, 900)):
                    check_viewport(browser, url, width, height)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
