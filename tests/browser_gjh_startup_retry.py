"""Exercise transient and persistent mall texture failures without navigation retries."""
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TARGET = '/demos/corporate/gjh/v11/assets/new-moon-logo.svg'


class Handler(http.server.SimpleHTTPRequestHandler):
    failures = 0
    requests = 0

    def do_GET(self):
        if self.path.split('?')[0] == TARGET:
            type(self).requests += 1
            if type(self).requests <= type(self).failures:
                self.send_error(503)
                return
        super().do_GET()

    def log_message(self, *args):
        pass


def main():
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/index.html#experience'
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=[
                '--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'),
                '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
            ])
            try:
                for failures in (2, 100):
                    Handler.failures, Handler.requests = failures, 0
                    context = browser.new_context(service_workers='block')
                    page = context.new_page()
                    navigations = []
                    page.on('framenavigated', lambda frame: navigations.append(frame.url) if frame == page.main_frame else None)
                    page.goto(url)
                    page.wait_for_function('window.__mall?.ready || window.__sceneFailed', timeout=60000)
                    if failures == 2:
                        assert page.evaluate('window.__mall.ready && window.__sceneReady'), 'Transient texture failure prevented startup'
                        assert page.locator('#scene').is_visible()
                        assert Handler.requests >= 3, Handler.requests
                    else:
                        assert page.evaluate('window.__sceneFailed && !window.__mall.ready')
                        assert page.locator('#store-list').is_visible()
                        assert 2 <= Handler.requests <= 4, Handler.requests
                    assert len(navigations) == 1, navigations
                    context.close()
                    print(f'{"transient recovery" if failures == 2 else "persistent fallback"}: PASS')
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == '__main__':
    main()
