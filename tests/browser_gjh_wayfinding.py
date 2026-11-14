"""Entrance plaque visibility and the real three-store map journey."""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import platform
import threading

from playwright.sync_api import sync_playwright

from browser_gjh_budget import ROOT, Quiet


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT.parent / 'evidence/v11-wayfinding')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(
        ('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    results = []
    backend = os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader')
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=os.environ['GALLERY_CHROME'],
                args=[f'--use-angle={backend}', '--enable-unsafe-swiftshader'])
            for width, height in [(1440, 900), (768, 1024), (390, 844)]:
                page = browser.new_page(viewport={'width': width, 'height': height},
                                        has_touch=width < 1000, reduced_motion='reduce',
                                        service_workers='block')
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/',
                          timeout=60000)
                page.wait_for_function('__mall?.ready && __sceneReady', timeout=60000)
                page.locator('#guide-start').click()
                page.wait_for_function('document.activeElement.id === "scene"')
                page.evaluate('__mall.setInput({}); __mall.step(17)')
                signs = page.evaluate('__mall.state.roomSigns')
                expected = ['newmoon', 'mili', 'gogo'] if width == 1440 else ['mili']
                for zone in expected:
                    sign = next(item for item in signs if item['zone'] == zone)
                    assert sign['visible'], sign
                    assert 0 <= sign['left'] < sign['right'] <= width, sign
                    assert 83 < sign['top'] < sign['bottom'] < height, sign
                    assert sign['bottom'] - sign['top'] >= 14, sign
                page.screenshot(path=str(args.output / f'entrance-{width}.png'))
                journeys = []
                for zone, name in [('newmoon', 'New Moon'), ('mili', 'MILI'), ('gogo', 'GOGO')]:
                    if width == 390:
                        page.locator('#header-map').click()
                        page.wait_for_function('__mall.mode === "menu"')
                    elif not page.locator('#mall-map').evaluate('e => e.open'):
                        # The welcome guide closes the desktop map; use the entrance kiosk.
                        page.locator('#inspect').click()
                    button = page.locator(f'[data-teleport="{zone}"]')
                    assert button.get_attribute('aria-label') == f'Go to the {name} storefront'
                    assert button.evaluate('e => {const r=e.getBoundingClientRect();'
                                           'return e.contains(document.elementFromPoint('
                                           'r.x+r.width/2,r.y+r.height/2));}')
                    button.focus()
                    page.keyboard.press('Enter')
                    page.wait_for_function('document.activeElement.id === "scene"')
                    state = page.evaluate('__mall.step(17)')
                    # Teleports land on the courtyard side of the intended entrance.
                    expected_x = {'newmoon': -10, 'mili': 0, 'gogo': 10}[zone]
                    assert abs(state['x'] - expected_x) < 1, state
                    page.screenshot(path=str(args.output / f'door-{zone}-{width}.png'))
                    journeys.append(zone)
                if width == 390:
                    page.locator('#header-map').click()
                    page.keyboard.press('Escape')
                    assert page.locator('#header-map').evaluate('e => e === document.activeElement')
                    assert not page.locator('#mall-map').evaluate('e => e.open')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert not errors, errors
                results.append({'viewport': [width, height], 'entranceSigns': signs,
                                'keyboardMapJourneys': journeys, 'pageErrors': errors})
                page.close()
            version = browser.version
            browser.close()
    finally:
        server.shutdown()
    report = {'environment': f'{platform.system()} {platform.machine()} Chromium {version} / {backend}',
              'limitations': ['Browser touch emulation, not physical-device certification',
                              'Projected plaque bounds do not establish text contrast or readability'],
              'results': results}
    (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    run()
