"""Verify automatic preview loading, failures, cancellation and focus recovery."""
import argparse
import functools
import http.server
import json
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


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
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=[
                '--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            for width, height in ([(390, 844)] if args.live else [(390, 844), (1440, 900)]):
                page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
                page.goto(url)
                page.wait_for_function('__mall.ready && __sceneReady', timeout=60000)
                page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
                for sku in ['nz-425g', 'au-425g', 'sa-425g', 'mx-454g']:
                    page.locator(f'[data-inspect="new-moon-{sku}-front"]').click()
                    page.wait_for_function('__newMoonPreview.state.loaded', timeout=30000)
                    assert page.locator('#product-preview-canvas').is_visible()
                    assert 'scroll or pinch to zoom' in page.locator('#product-preview-status').inner_text()
                    assert page.evaluate('document.activeElement.id') == 'product-close'
                    page.keyboard.press('Tab')
                    assert page.evaluate('document.activeElement.id') == 'product-preview-canvas'
                    page.keyboard.press('Escape')
                    page.wait_for_function('!document.querySelector("#product-dialog").open && __newMoonPreview.state.activeResources === 0')
                    results.append({'viewport': [width, height], 'sku': sku, 'automaticPreviewAndFocus': 'PASS'})
                if not args.live:
                    pattern = '**/new-moon-can-nz-425g-lod1.glb'
                    pending = []
                    page.route(pattern, lambda route: pending.append(route))
                    page.locator('[data-inspect="new-moon-nz-425g-front"]').click()
                    page.wait_for_function('__newMoonPreview.state.loading')
                    page.wait_for_timeout(200)
                    assert pending and 'Loading' in page.locator('#product-preview-status').inner_text()
                    page.keyboard.press('Escape')
                    page.wait_for_function('!document.querySelector("#product-dialog").open')
                    page.unroute(pattern)
                    page.locator('[data-inspect="new-moon-au-425g-front"]').click()
                    page.wait_for_function('__newMoonPreview.state.loaded', timeout=30000)
                    try:
                        pending[0].fulfill(status=200, body=(ROOT / 'demos/corporate/gjh/v11/assets/new-moon-can-nz-425g-lod1.glb').read_bytes())
                    except Exception:
                        pass  # The browser may already have cancelled the old request.
                    page.wait_for_timeout(300)
                    assert page.evaluate('__newMoonPreview.state.sku') == 'au-425g'
                    assert page.evaluate('__newMoonPreview.state.loaded')
                    page.keyboard.press('Escape')
                    page.locator('[data-inspect="new-moon-mx-454g-front"]').click()
                    page.wait_for_function('__newMoonPreview.state.loaded', timeout=30000)
                    page.set_viewport_size({'width': 844, 'height': 390})
                    page.wait_for_timeout(300)
                    bounds = page.evaluate('__newMoonPreview.state.projectedBounds')
                    assert -1 < bounds['minX'] < bounds['maxX'] < 1 and -1 < bounds['minY'] < bounds['maxY'] < 1
                    page.keyboard.press('Escape')
                    results.append({'viewport': [width, height], 'lateRequestAndResize': 'PASS'})
                    if width == 390:
                        page.evaluate("""async () => {
                          const {GLTFLoader} = await import('./vendor/GLTFLoader.js');
                          const original = GLTFLoader.prototype.parseAsync;
                          window.lateDisposals = 0;
                          GLTFLoader.prototype.parseAsync = async function (...args) {
                            const result = await original.apply(this, args);
                            result.scene.traverse(object => object.geometry?.addEventListener('dispose', () => window.lateDisposals++));
                            await new Promise(resolve => setTimeout(resolve, 8500));
                            return result;
                          };
                        }""")
                        page.locator('[data-inspect="new-moon-nz-425g-front"]').click()
                        page.wait_for_function('__newMoonPreview.state.reason === "load-deadline"', timeout=12000)
                        page.wait_for_function('window.lateDisposals > 0', timeout=5000)
                        assert page.locator('#product-image').is_visible()
                        assert page.evaluate('__newMoonPreview.state.activeResources') == 0
                        page.keyboard.press('Escape')
                        results.append({'lateParseDisposed': 'PASS'})
                page.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(json.dumps(results, indent=2))


if __name__ == '__main__':
    run()
