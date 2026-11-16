"""Exercise bundled startup, model integrity and real fallback paths."""
import functools
import hashlib
import http.server
import json
import os
import struct
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'demos/corporate/gjh/v11/assets'
CAN = 'new-moon-can-nz-425g-lod1.glb'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, output):
        try:
            super().copyfile(source, output)
        except (BrokenPipeError, ConnectionResetError):
            pass


def run():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=['--use-angle=metal'])
            cases = ['normal', 'missing-pack', 'truncated-pack', 'corrupt-model', 'slow-pack', 'individual-failure', 'missing-world', 'native-loss-before-pack']
            selected = os.environ.get('GJH_PACK_CASE')
            if selected:
                assert selected in cases
                cases = [selected]
            for mode in cases:
                context = browser.new_context(viewport={'width':390, 'height':844}, reduced_motion='reduce', service_workers='block')
                context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
                page = context.new_page()
                requests, errors, pending = [], [], []
                page.on('request', lambda request: requests.append(request.url))
                page.on('pageerror', lambda error: errors.append(str(error)))
                if mode in ('missing-pack', 'individual-failure'):
                    page.route('**/startup-assets.pack', lambda route: route.abort())
                if mode == 'individual-failure':
                    page.route('**/' + CAN, lambda route: route.abort())
                if mode == 'missing-world':
                    page.route('**/assets/world.bundle.js', lambda route: route.abort())
                if mode in ('slow-pack', 'native-loss-before-pack'):
                    page.route('**/startup-assets.pack', lambda route: pending.append(route))
                if mode in ('truncated-pack', 'corrupt-model'):
                    data = bytearray((ASSETS / 'startup-assets.pack').read_bytes())
                    if mode == 'truncated-pack':
                        del data[-10:]
                    else:
                        header = struct.unpack_from('<I', data, 8)[0]
                        entries = json.loads(data[12:12 + header])
                        offset, length = entries[CAN]
                        data[12 + header + offset + length - 1] ^= 1
                    page.route('**/startup-assets.pack', lambda route: route.fulfill(status=200, body=bytes(data)))
                start = time.monotonic()
                page.goto(base, wait_until='domcontentloaded')
                if mode == 'native-loss-before-pack':
                    for _ in range(150):
                        if pending:
                            break
                        page.wait_for_timeout(20)
                    assert pending, 'The real startup pack must reach its held response'
                    page.evaluate("()=>{window.__packLoss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__packLoss)throw Error('Native context-loss extension unavailable');__packLoss.loseContext();}")
                    page.wait_for_function('__mall.state.graphics.status==="lost"')
                    page.evaluate('__packLoss.restoreContext()')
                    page.wait_for_function('!document.querySelector("#scene").getContext("webgl2").isContextLost()')
                    assert not page.evaluate('__mall.ready')
                    assert page.locator('[data-store]').count() == 3 and page.locator('.product-card').count() == 4
                    held = pending.pop()
                    response = held.fetch()
                    response_hash = hashlib.sha256(response.body()).hexdigest()
                    assert response.ok and response_hash == hashlib.sha256((ASSETS / 'startup-assets.pack').read_bytes()).hexdigest()
                    held.fulfill(response=response)
                if mode == 'native-loss-before-pack':
                    # __sceneFailed also marks the expected temporary interruption.
                    page.wait_for_function('(__mall.ready && __sceneReady && __mall.state.graphics.validations>0) || __mall.state.graphics.status==="failed"', timeout=90000)
                else:
                    page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                if mode == 'missing-world':
                    assert page.evaluate('window.__sceneFailed === true')
                    assert page.locator('#fallback-message').is_visible()
                    assert page.locator('[data-store]').count() == 3
                else:
                    assert page.evaluate('window.__sceneReady === true'), mode
                    records = page.evaluate('__mall.state.productAssets.cans')
                    expected = 'fallback' if mode in ('corrupt-model', 'individual-failure') else 'loaded'
                    assert records['nz-425g']['status'] == expected, (mode, records['nz-425g'])
                    assert all(records[sku]['status'] == 'loaded' for sku in ('au-425g', 'sa-425g', 'mx-454g'))
                    if mode == 'corrupt-model':
                        assert records['nz-425g']['reason'] == 'hash-mismatch'
                    if mode in ('missing-pack', 'truncated-pack', 'slow-pack', 'individual-failure'):
                        assert any(url.endswith('/' + CAN) for url in requests), (mode, requests)
                    if mode in ('normal', 'native-loss-before-pack'):
                        assert sum(url.endswith('/startup-assets.pack') for url in requests) == 1
                        names = json.loads((ROOT / 'data/gjh-startup-assets.json').read_text())
                        assert not [name for name in names if any(url.endswith('/' + name) for url in requests)]
                    if mode == 'slow-pack':
                        assert pending and time.monotonic() - start >= 3.5
                    if mode == 'native-loss-before-pack':
                        page.wait_for_function('__mall.state.graphics.validations>0')
                        page.locator('#graphics-return').click()
                        assert page.evaluate('__mall.state.capsuleEnabled')
                        print(f'PASS native startup context loss: pack body SHA256 {response_hash}', flush=True)
                    page.locator('#view-toggle').click()
                    assert page.locator('[data-store]').count() == 3 and page.locator('.product-card').count() == 4
                assert not errors, (mode, errors)
                print(f'PASS {mode}: bounded loading, model integrity and directory', flush=True)
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
