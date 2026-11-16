"""Verify automatic New Moon previews, gesture zoom, fallback and resource cleanup."""
import argparse
import functools
import http.server
import json
import os
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SKUS = ['nz-425g', 'au-425g', 'sa-425g', 'mx-454g']


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--live', action='store_true')
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    results = []

    def state(page):
        return page.evaluate('__newMoonPreview.state')

    def ready(page):
        page.goto(url)
        page.wait_for_function('__mall.ready && __sceneReady', timeout=60000)
        page.locator('#guide-start').click()
        page.locator('#view-toggle').click()

    def open_sku(page, sku):
        page.locator(f'[data-inspect="new-moon-{sku}-front"]').click()
        page.locator('#product-dialog').wait_for(state='visible')
        assert state(page)['sku'] == sku

    def loaded(page):
        page.wait_for_function('__newMoonPreview.state.loaded', timeout=30000)
        assert page.locator('#product-preview-canvas').is_visible()
        assert page.locator('#product-preview button, .product-preview-actions, .product-preview-controls').count() == 0

    def close(page):
        page.keyboard.press('Escape')
        page.wait_for_function('!document.querySelector("#product-dialog").open && __newMoonPreview.state.activeResources===0')

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=[
                '--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            with tempfile.TemporaryDirectory(prefix='gjh-detail-preview-') as output:
                for width, height in ([(390, 844)] if args.live else [(390, 844), (844, 390), (1440, 900)]):
                    page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=width < 1000, reduced_motion='reduce')
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    ready(page)
                    for sku in SKUS:
                        open_sku(page, sku)
                        loaded(page)
                        s = state(page)
                        bounds = s['projectedBounds']
                        assert -1 < bounds['minX'] < bounds['maxX'] < 1 and -1 < bounds['minY'] < bounds['maxY'] < 1, s
                        assert page.evaluate('document.activeElement.id') == 'product-close'
                        canvas = page.locator('#product-preview-canvas')
                        canvas.focus()
                        page.keyboard.press('ArrowRight')
                        assert state(page)['yaw'] > s['yaw']
                        page.keyboard.press('+')
                        assert state(page)['zoom'] < s['zoom']
                        page.keyboard.press('-')
                        assert abs(state(page)['zoom'] - s['zoom']) < .001
                        page.keyboard.press('r')
                        assert state(page)['yaw'] == 0 and state(page)['zoom'] == 1.15
                        canvas.scroll_into_view_if_needed()
                        box = canvas.bounding_box()
                        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
                        if width < 1000:
                            cdp = page.context.new_cdp_session(page)
                            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x - 40, 'y': y, 'id': 1}, {'x': x + 40, 'y': y, 'id': 2}]})
                            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x - 65, 'y': y, 'id': 1}, {'x': x + 65, 'y': y, 'id': 2}]})
                            page.wait_for_function('__newMoonPreview.state.zoom < 1.0')
                            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x - 25, 'y': y, 'id': 1}, {'x': x + 25, 'y': y, 'id': 2}]})
                            page.wait_for_function('__newMoonPreview.state.zoom > 1.15')
                            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                            cdp.detach()
                        else:
                            page.mouse.move(x, y)
                            page.mouse.wheel(0, -300)
                            assert state(page)['zoom'] < 1, state(page)
                            page.mouse.wheel(0, 500)
                            assert state(page)['zoom'] > 1.15, state(page)
                        canvas.focus()
                        page.keyboard.press('r')
                        page.mouse.move(x, y)
                        page.mouse.down()
                        page.mouse.move(x + 35, y + 10, steps=4)
                        page.mouse.up()
                        assert state(page)['yaw'] > .2, state(page)
                        assert 'scroll or pinch to zoom' in page.locator('#product-preview-status').inner_text()
                        assert page.evaluate('document.querySelector("#product-dialog").scrollWidth <= document.querySelector("#product-dialog").clientWidth + 1')
                        page.screenshot(path=str(Path(output) / f'{sku}-{width}.png'))
                        frames = state(page)['renderCount']
                        page.wait_for_timeout(250)
                        assert state(page)['renderCount'] == frames
                        close(page)
                        page.wait_for_function('document.activeElement.matches("[data-inspect]")')
                    for brand in ['mili', 'gogo']:
                        page.locator(f'[data-inspect="{brand}"]').click()
                        assert page.locator('#product-image').is_visible() and page.locator('#product-preview-canvas').is_hidden()
                        close(page)
                    assert not errors, errors
                    results.append({'viewport': [width, height], 'automatic3D': SKUS, 'zoom': 'pinch' if width < 1000 else 'wheel', 'keyboard': 'PASS', 'cleanup': 'PASS'})
                    page.close()
                if not args.live:
                    page = browser.new_page(viewport={'width': 390, 'height': 844})
                    ready(page)
                    pattern = '**/new-moon-can-nz-425g-lod1.glb'
                    for mode in ['404', 'hash']:
                        page.route(pattern, lambda route: route.fulfill(status=404 if mode == '404' else 200, body=b'wrong'))
                        open_sku(page, 'nz-425g')
                        page.wait_for_function('__newMoonPreview.state.status === "error"')
                        assert page.locator('#product-image').is_visible() and state(page)['activeResources'] == 0
                        assert 'Close and reopen to retry' in page.locator('#product-preview-status').inner_text()
                        results.append({'fault': mode, 'reason': state(page)['reason']})
                        close(page)
                        page.unroute(pattern)
                    open_sku(page, 'nz-425g')
                    loaded(page)
                    page.evaluate('document.querySelector("#product-preview-canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
                    page.wait_for_function('__newMoonPreview.state.reason === "context-lost"')
                    assert state(page)['activeResources'] == 0 and page.locator('#product-image').is_visible()
                    close(page)
                    open_sku(page, 'nz-425g')
                    loaded(page)
                    close(page)
                    results.append({'contextLossAndReopen': 'PASS'})
                    page.close()
                    page = browser.new_page(viewport={'width': 390, 'height': 844})
                    page.add_init_script('HTMLCanvasElement.prototype.getContext=()=>null')
                    page.goto(url)
                    page.locator('.product-inspect').first.wait_for(state='visible')
                    open_sku(page, 'nz-425g')
                    page.wait_for_function('__newMoonPreview.state.status === "error"', timeout=30000)
                    assert page.locator('#product-image').is_visible() and state(page)['activeResources'] == 0
                    close(page)
                    results.append({'noWebGLImageFallback': 'PASS'})
                    page.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    run()
