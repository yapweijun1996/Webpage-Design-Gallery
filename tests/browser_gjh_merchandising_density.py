"""Verify nearby product Inspect opens the readable product viewer directly."""
from gjh_startup_test_helpers import mall_entry_url
import argparse, functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_shelf_focus import approach

ROOT = Path(__file__).resolve().parents[1]
URL_PATH = '/demos/corporate/gjh/v11/'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/evidence/v11-merchandising-density')
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    rows = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME', '/usr/bin/google-chrome'),
                                         args=['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--ignore-gpu-blocklist'])
            for width, height in [(1440, 900), (390, 844)]:
                page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=width < 650,
                                        reduced_motion='reduce', service_workers='block')
                errors = []; page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(mall_entry_url(f'http://127.0.0.1:{server.server_port}{URL_PATH}'))
                page.wait_for_function('__mall?.ready && __sceneReady', timeout=60000)
                page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#scene').focus(); page.wait_for_function('document.activeElement.id === "scene"')
                assets = page.evaluate('__mall.state.productAssets')
                assert assets['totalInstances'] == 204
                for record in assets['cans'].values():
                    assert record['instances'] == 51 and record['frontFacings'] == 17
                    # Exact float32 GLB source bounds, confirmed by unchanged asset hashes.
                    assert record['dimensions'] == [0.07750000059604645, 0.12399169057607651, 0.07750000059604645]
                    assert record['actualBoundsScale'] == [1.000000007690922, 1, 1.000000007690922]
                    positions = record['placements']; assert len(positions) == 51
                    assert sorted({p['y'] for p in positions}) == [.451, .991, 1.531]
                    assert record['reserveIndex'] == 25
                    for i,a in enumerate(positions):
                        for b in positions[i+1:]:
                            assert abs(a['y']-b['y'])>=.1239 or abs(a['x']-b['x'])>=.0775
                for sku in ('nz-425g' , 'au-425g', 'sa-425g', 'mx-454g'):
                    approach(page, sku)
                    page.screenshot(path=str(args.output / f'after-nearby-{sku}-{width}.png'), full_page=True)
                    page.locator('#inspect').click()
                    page.locator('#product-dialog').wait_for(state='visible')
                    assert page.locator('#shelf-dialog').is_hidden()
                    assert page.evaluate('__mall.mode') == 'inspect'
                    assert page.locator('#product-title').inner_text().startswith('New Moon Premium')
                    page.wait_for_function("__newMoonPreview.state.loaded || __newMoonPreview.state.status === 'error'", timeout=10000)
                    preview = page.evaluate('__newMoonPreview.state')
                    assert preview['sku'] == sku and preview['mode'] == '3d' and preview['loaded'], preview
                    page.screenshot(path=str(args.output / f'after-direct-product-{sku}-{width}.png'), full_page=True)
                    for _ in range(2):
                        page.locator('#product-close').click(); page.wait_for_function('!document.querySelector("#product-dialog").open')
                        assert page.evaluate('__mall.mode') in ('explore', 'cart')
                        assert page.locator('#shelf-dialog').is_hidden()
                        page.locator('#inspect').click(); page.locator('#product-dialog').wait_for(state='visible')
                        assert page.locator('#shelf-dialog').is_hidden()
                        page.wait_for_function("__newMoonPreview.state.loaded || __newMoonPreview.state.status === 'error'", timeout=10000)
                    if sku == 'nz-425g': page.locator('#product-add').click()
                    page.locator('#product-close').click(); page.wait_for_function('!document.querySelector("#product-dialog").open')
                assert page.evaluate('__mall.state.drawCalls') < 150
                page.locator('#bag-open').click(); page.locator('#bag-dialog').wait_for(state='visible')
                assert page.locator('#bag-items li').count() == 1
                page.screenshot(path=str(args.output / f'after-bag-{width}.png'), full_page=True)
                page.locator('#bag-close').click(); page.wait_for_function('!document.querySelector("#bag-dialog").open')
                assert not errors, errors
                rows.append({'viewport': [width, height], 'directInspect': 'PASS', 'fourSkus': 'PASS', 'repeatCloseReopen': 'PASS', 'bag': 'PASS', 'pageErrors': errors})
                page.close()
            browser.close()
    finally:
        server.shutdown()
    (args.output / 'report.json').write_text(json.dumps(rows, indent=2) + '\n')
    print(json.dumps(rows))

if __name__ == '__main__': run()
