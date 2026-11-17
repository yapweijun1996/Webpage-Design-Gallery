"""Verify animated NPC facing, route clearance and bench orientation in the running mall."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run():
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=ROOT)) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=[
                    '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND', 'metal'), '--ignore-gpu-blocklist'])
                page = browser.new_page(viewport={'width':1280,'height':800}, reduced_motion='reduce', service_workers='block')
                page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
                # Observe the production scene and colliders through the factory's public arguments.
                page.route('**/assets/npcs.js', lambda route: route.fulfill(content_type='text/javascript', body="""
                  import {createNpcSystem as createSystem} from './npcs.js?original';
                  export function createNpcSystem(T, options) {
                    const system = createSystem(T, options);
                    window.npcTest = {T,options,system};
                    return system;
                  }
                """))
                page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/#experience')
                page.wait_for_function('window.__sceneReady && window.npcTest', timeout=90000)
                result = page.evaluate((ROOT/'tests/gjh_npc_walks.mjs').read_text())
                assert result['walkers'] >= 2 and result['metres'] > 8, result
                assert result['minFacing'] > .95 and result['seatFacing'] > .95, result
                assert result['intersections'] == 0 and result['seat'], result
                print('PASS animated walking, real collider clearance and seated facing', result)
                browser.close()
        finally:
            server.shutdown()
            thread.join()


if __name__ == '__main__':
    run()
