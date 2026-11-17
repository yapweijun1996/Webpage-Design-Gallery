"""Exercise automatic store doors with real Chrome and Rapier collisions."""
import functools
import http.server
import importlib.util
import os
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_gjh_v11 import dismiss_tutorial, drive, state, walk_to

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gallery', ROOT / 'scripts/build_gallery.py')
gallery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gallery)


def run():
    with tempfile.TemporaryDirectory(prefix='gjh-auto-doors-') as folder:
        gallery.build(Path(folder) / 'gallery')
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=folder))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader'])
                try:
                    for layout in ('classic', 'expanded'):
                        for width, height, reduced in ((1440, 900, 'no-preference'), (390, 844, 'reduce')):
                            context = browser.new_context(viewport={'width':width, 'height':height}, has_touch=width<1000, reduced_motion=reduced, service_workers='block')
                            page = context.new_page()
                            page.goto(f'http://127.0.0.1:{server.server_port}/gallery/demos/corporate/gjh/v11/?layout={layout}')
                            page.wait_for_function('window.__sceneReady && window.__mall?.ready', timeout=90000)
                            dismiss_tutorial(page)
                            if layout == 'expanded':
                                assert len(state(page)['doors']) == 17
                                assert page.locator('#mall-map [data-map-store]').count() == 17
                            for zone, x in (('newmoon',-10), ('mili',0), ('gogo',10)):
                                assert page.evaluate('zone => __mall.teleport(zone)', zone)
                                opened = drive(page, 1000)
                                assert opened['doors'][zone] > .99, (layout, zone, opened)
                                assert all(value == 0 for name, value in opened['doors'].items() if name != zone), opened['doors']
                                assert opened['nearby'] != f'{zone}-door', opened
                                assert page.evaluate('__mall.teleport("atrium")')
                                closed = drive(page, 1000)
                                assert closed['doors'][zone] == 0, (layout, zone, closed)
                                assert page.evaluate('zone => __mall.teleport(zone)', zone)
                                assert drive(page, 1000)['doors'][zone] > .99
                                # Walk through the physical moving colliders and remain open in the threshold.
                                walk_to(page, x, -.5)
                                assert state(page)['doors'][zone] > .99
                                if zone == 'newmoon':
                                    walk_to(page, x, -5.5)
                                    assert drive(page, 1000)['doors'][zone] == 0
                                    walk_to(page, x, -4.5)
                                    assert drive(page, 1000)['doors'][zone] > .99
                                    walk_to(page, x, .5)
                                assert page.evaluate('__mall.teleport("atrium")')
                                assert drive(page, 1000)['doors'][zone] == 0
                            if layout == 'expanded':
                                # Exercise an additional entrance on each facade orientation.
                                for number, inside, outside in ((4, (20, -.6), (20, 2.4)),
                                                                 (6, (-15.6, 4), (-12.6, 4)),
                                                                 (12, (35.6, 4), (32.6, 4))):
                                    zone = f'planned-space-{number:02d}'
                                    assert page.evaluate('zone=>__mall.teleport(zone)', zone)
                                    assert drive(page, 1000)['doors'][zone] > .99
                                    assert page.evaluate('__mall.teleport("atrium")')
                                    assert drive(page, 1000)['doors'][zone] == 0
                                    assert page.evaluate('zone=>__mall.teleport(zone)', zone)
                                    drive(page, 1000)
                                    walk_to(page, *inside)
                                    assert state(page)['zone'] == zone
                                    assert state(page)['doors'][zone] > .99
                                    walk_to(page, *outside)
                                    assert state(page)['zone'] != zone
                            print(f'PASS {layout} {width}x{height} {reduced}: proximity, close, walk through and re-open', flush=True)
                            context.close()
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    run()
