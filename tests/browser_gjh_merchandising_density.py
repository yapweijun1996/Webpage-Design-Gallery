"""Focused native-scale New Moon density, reservation, and visual evidence check."""
import argparse, functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_shelf_focus import approach, open_shelf, close_shelf, state

ROOT = Path(__file__).resolve().parents[1]
URL_PATH = '/demos/corporate/gjh/v11/'

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/evidence/v11-merchandising-density')
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start(); rows=[]
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME', '/usr/bin/google-chrome'), args=['--use-angle=swiftshader', '--ignore-gpu-blocklist'])
            for width, height in ((1440, 900), (390, 844)):
                page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=width < 650, reduced_motion='reduce', service_workers='block')
                errors=[]; page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(f'http://127.0.0.1:{server.server_port}{URL_PATH}'); page.wait_for_function('__mall?.ready && __sceneReady', timeout=60000)
                page.locator('#guide-start').click(); page.wait_for_function('document.activeElement.id === "scene"')
                approach(page, 'nz-425g'); before = state(page); assets = before['productAssets']; cans = assets['cans']
                assert assets['totalInstances'] == 36 and assets['frontFacings'] == 18
                for sku, record in cans.items():
                    assert record['instances'] == 9 and record['dimensions'] == [0.0775, 0.12399169057607651, 0.0775]
                    assert record['depthRows'] == 1 and isinstance(record['reserveIndex'], int)
                    reserve = record['placements'][record['reserveIndex']]
                    assert reserve['y'] == sorted({p['y'] for p in positions})[1] and reserve['z'] == max(p['z'] for p in positions)
                    positions = record['placements']; assert len(positions) == 9 and all(p['y'] > 0 for p in positions)
                    for i, left in enumerate(positions):
                        for right in positions[i + 1:]:
                            assert abs(left['x'] - right['x']) >= .0775 or abs(left['z'] - right['z']) >= .0775, (sku, left, right)
                page.screenshot(path=str(args.output / f'before-{width}.png'), full_page=True)
                origin = cans['nz-425g']['placements'][cans['nz-425g']['reserveIndex']]
                open_shelf(page, 'touch' if width < 650 else 'keyboard'); page.screenshot(path=str(args.output / f'after-{width}.png'), full_page=True)
                page.locator('#shelf-target').click(); page.locator('#shelf-add').click()
                close_shelf(page, 'close'); page.get_by_role('button', name='Pick up product', exact=True).click(); page.evaluate('__mall.step(1000)')
                assert state(page)['character']['physicalProduct']['phase'] == 'held'
                page.get_by_role('button', name='Return to shelf', exact=True).click(); page.evaluate('__mall.step(1200)')
                assert state(page)['character']['physicalProduct']['phase'] == 'empty'
                after = state(page)['productAssets']['cans']['nz-425g']['placements'][state(page)['productAssets']['cans']['nz-425g']['reserveIndex']]
                assert after == origin
                assert not errors, errors
                rows.append({'viewport':[width,height], 'frontFacings':18, 'instances':36, 'nativeBounds':'PASS', 'supportNoOverlap':'PASS', 'pickupReturn':'PASS', 'drawCalls':state(page)['drawCalls'], 'directInspect':'covered-by-existing-test'})
                page.close()
            browser.close()
    finally: server.shutdown()
    (args.output / 'report.json').write_text(json.dumps(rows, indent=2) + '\n'); print(json.dumps(rows))

if __name__ == '__main__': run()
