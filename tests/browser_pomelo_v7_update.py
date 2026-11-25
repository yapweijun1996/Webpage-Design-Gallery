"""Exercise V7 update with a real parent-scoped service worker and two releases."""
import functools
import http.server
import json
import threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/demos/corporate/pomelo-stem/v7/'

class Handler(http.server.SimpleHTTPRequestHandler):
    release = 0
    def log_message(self, *args):
        pass
    def send_text(self, text, mime):
        data = text.encode()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        path = urlsplit(self.path).path
        build = 'new' if Handler.release else 'old'
        version = '7.1.1' if Handler.release else '7.1.0'
        if path == '/bootstrap':
            return self.send_text('<!doctype html><title>Worker test</title>', 'text/html')
        if path == '/version.json':
            return self.send_text(json.dumps({'version':'1.0.0','build':build}), 'application/json')
        if path == PREFIX + 'release.json':
            return self.send_text(json.dumps({'version':version}), 'application/json')
        if path == PREFIX + 'index.html':
            html = (ROOT / path.lstrip('/')).read_text(encoding='utf-8').replace('7.1.0', version)
            return self.send_text(html, 'text/html')
        if path == '/v7-test-sw.js':
            # Separate cached navigations reproduce the Gallery worker's parent scope.
            source = """
const BUILD = BUILD_VALUE;
const URL_PATH = PATH_VALUE;
self.addEventListener('install', event => event.waitUntil((async () => {
  const response = await fetch(URL_PATH + '?fresh=' + BUILD, {cache:'no-store'});
  const cache = await caches.open('v7-test-' + BUILD);
  await cache.put(URL_PATH, response);
})()));
self.addEventListener('message', event => {
  if (event.data.type === 'GET_VERSION') event.ports[0].postMessage({version:'1.0.0',build:BUILD});
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate' && url.pathname === URL_PATH) {
    event.respondWith(caches.open('v7-test-' + BUILD).then(cache => cache.match(URL_PATH)));
  }
});
""".replace('BUILD_VALUE', json.dumps(build)).replace('PATH_VALUE', json.dumps(PREFIX + 'index.html'))
            return self.send_text(source, 'application/javascript')
        return super().do_GET()

def main():
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
            context = browser.new_context()
            page = context.new_page()
            page.goto(base + '/bootstrap')
            page.evaluate("navigator.serviceWorker.register('/v7-test-sw.js', {scope:'/'}).then(() => navigator.serviceWorker.ready)")
            page.goto(base + PREFIX + 'index.html')
            assert page.evaluate('!!navigator.serviceWorker.controller')
            assert page.locator('[data-update] .version').inner_text() == '7.1.0'
            Handler.release = 1
            page.locator('[data-update] summary').click()
            page.locator('[data-apply]').wait_for(state='visible')
            assert '7.1.1' in page.locator('[data-status]').inner_text()
            page.locator('[data-apply]').click()
            page.wait_for_function("document.querySelector('[data-update] .version').textContent === '7.1.1'", timeout=25000)
            page.wait_for_function("document.querySelector('[data-status]').textContent === 'Update applied.'")
            browser.close()
        print('PASS: parent worker update and V7 version verified after reload')
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
