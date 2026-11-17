"""Check map arrival, physical entry, browsing and return for every shop."""
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet


def run():
    root = Path(__file__).resolve().parents[1]
    with http.server.ThreadingHTTPServer(
        ('127.0.0.1', 0), functools.partial(Quiet, directory=str(root))
    ) as server, sync_playwright() as playwright:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        browser = playwright.chromium.launch(
            executable_path=os.environ['GALLERY_CHROME'],
            args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'),
                  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        try:
            page = browser.new_page(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce')
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
            page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/')
            page.wait_for_function('window.__mall?.ready', timeout=90000)
            for number in range(1, 18):
                result = page.evaluate("""async n => {
                    const {walkShop} = await import('/tests/gjh_shop_walkthrough.mjs');
                    const result = await walkShop(window,n);
                    if (n >= 4) {
                        const {checkShopCollisions} = await import('/tests/gjh_shop_collisions.mjs');
                        await checkShopCollisions(window,n);
                    }
                    return result;
                }""", number)
                print(f"S{number:02} entered, browsed and exited: {result['browsed']}", flush=True)
            assert not errors, errors
        finally:
            browser.close()
            server.shutdown()


if __name__ == '__main__':
    run()
