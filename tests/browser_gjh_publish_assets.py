"""Open the generated Pages artifact with its real CSS and physics binary."""
import functools
import http.server
import importlib.util
import os
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_gallery', ROOT / 'scripts/build_gallery.py')
gallery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gallery)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, output):
        try:
            super().copyfile(source, output)
        except (BrokenPipeError, ConnectionResetError):
            pass


def run():
    with tempfile.TemporaryDirectory(prefix='gjh-publish-') as temporary:
        output = Path(temporary) / 'gallery'
        gallery.build(output)
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=['--use-angle=metal'])
                for query in ('?layout=classic', ''):
                    context = browser.new_context(viewport={'width':390, 'height':844}, reduced_motion='reduce', service_workers='block')
                    context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
                    page = context.new_page()
                    errors, failed = [], []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('response', lambda response: failed.append((response.url, response.status)) if response.status >= 400 else None)
                    page.goto(f'http://127.0.0.1:{server.server_port}/gallery/demos/corporate/gjh/v11/{query}')
                    page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                    assert page.evaluate('window.__sceneReady === true')
                    assert page.locator('#scene').is_visible()
                    paths = page.evaluate("performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname)")
                    assert any(path.endswith('/style.bundle.css') for path in paths)
                    assert any(path.endswith('/rapier_bg.wasm') for path in paths)
                    assert not errors and not failed, (errors, failed)
                    print(f'PASS published artifact {query or "default"}: 3D, CSS and WASM', flush=True)
                    context.close()
                browser.close()
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    run()
