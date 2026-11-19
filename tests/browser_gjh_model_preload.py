"""Exercise cold expanded-mall model preloading and optional-model fallback.

Run with GALLERY_CHROME=/path/to/chrome python3 tests/browser_gjh_model_preload.py.
Use GALLERY_WEBGL_BACKEND=metal on supported Macs for representative timing.
The resource checks are not a GPU warm-up or a frame-rate certification.
"""
import functools
import http.server
import json
import os
import threading
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get('GALLERY_TEST_ROOT', Path(__file__).resolve().parents[1])).resolve()
HEROES = ('pharmacy-counter', 'speaker-soundbar', 'tv-demo-table', 'tv-floor-stand',
          'electronic-keyboard', 'battery-display-rack', 'cordless-phone-display')
HERO_STORES = (4, 5, 13, 14, 15, 16, 17)
FURNISHINGS = ('teaCup', 'teaKettle', 'pantryRack', 'coffeeMachine')


class Server(http.server.SimpleHTTPRequestHandler):
    scenario = 'success'
    def log_message(self, *args):
        pass
    def do_GET(self):
        if self.scenario == 'chandelier-missing' and urlparse(self.path).path.endswith('/atrium-chandelier.glb'):
            self.send_error(404)
            return
        if self.scenario in ('deadline', 'early', 'directory') and '/gallery-assets/' in urlparse(self.path).path and urlparse(self.path).path.endswith('.glb'):
            time.sleep(35)
        if urlparse(self.path).path.endswith('/pharmacy-counter.glb'):
            if self.scenario == 'missing':
                self.send_error(404)
                return
            if self.scenario == 'corrupt':
                body=b'not a valid glTF model'
                self.send_response(200)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if self.scenario in ('slow', 'early', 'directory', 'loss'):
                time.sleep(11)
        try:
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass


def compact(page):
    return page.evaluate('''() => {
      const state=__mall.state, report=__mall.performanceReport();
      return {ready:__mall.ready, mode:__mall.mode, graphics:state.graphics, visitorLod:state.character.lod,
        gpu:state.gpu, preload:state.modelPreload, message:document.querySelector('#model-preload-status')?.textContent, fps:report.fps, p95Ms:report.p95Ms, drawCalls:report.drawCalls,
        furn:Object.fromEntries(Object.entries(state.furnishings).map(([k,v])=>[k,v.status])),
        heroes:Object.fromEntries([4,5,13,14,15,16,17].map(n=>[n,__mall.heroVisibility(n)?.loaded]))};
    }''')


def run_scenario(browser, base, scenario):
    context = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1,
                                  reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    requests = Counter()
    errors = []
    failures = []
    response_status = {}
    page.on('requestfailed', lambda request: failures.append((urlparse(request.url).path, request.failure)))
    page.on('response', lambda response: response_status.update({urlparse(response.url).path: response.status}) if '.glb' in response.url else None)
    page.on('request', lambda request: requests.update([urlparse(request.url).path]) if '.glb' in request.url else None)
    page.on('pageerror', lambda error: errors.append(str(error)))
    start = time.monotonic()
    try:
        page.goto(base, wait_until='domcontentloaded')
        page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=90000)
        first_frame_ms = round((time.monotonic() - start) * 1000)
        if scenario == 'slow':
            page.wait_for_function("window.__mall.state.modelPreload?.models['./pharmacy-counter.glb'] === 'loading'", timeout=30000)
            assert page.locator('#loader-enter-now').is_visible()
            assert not page.evaluate('window.mallLoader.snapshot().ready')
        page.wait_for_function('window.mallLoader?.snapshot().ready', timeout=45000)
        ready_ms = round((time.monotonic() - start) * 1000)
        expected = page.evaluate('''async () => {
          const west=await import('./assets/gallery-west-shops.js');
          const east=await import('./assets/gallery-east-shops.js');
          return [...new Set(Object.values({...west.westShopPlacements,...east.eastShopPlacements})
            .flat().map(p => new URL(p.file, new URL('./assets/', document.baseURI)).pathname))];
        }''')
        expected += ['/demos/corporate/gjh/v11/assets/' + name + '.glb' for name in HEROES]
        deadline = time.monotonic() + float(os.environ.get('GALLERY_MODEL_SETTLE_TIMEOUT', '100'))
        while time.monotonic() < deadline:
            state = compact(page)
            preload = state['preload']
            if preload and preload['settled'] == preload['total'] == 14 and all(requests[path] for path in expected) and all(state['furn'][x] in ('loaded', 'fallback') for x in FURNISHINGS):
                if all(state['heroes'][str(n)] for n in HERO_STORES if scenario not in ('missing','corrupt','slow') or n not in (4, 5)):
                    break
            page.wait_for_timeout(250)
        preload = state['preload']
        assert state['visitorLod']['available'] and not state['visitorLod']['failed'], state['visitorLod']
        assert preload['sceneModels']['Gallery lift directory standee'] == 'loaded', preload['sceneModels']
        assert preload['sceneModels']['Gallery atrium chandelier'] == ('fallback' if scenario == 'chandelier-missing' else 'loaded'), preload['sceneModels']
        assert preload and preload['settled'] == preload['total'] == 14, preload
        assert len(preload['models']) == len(expected), (preload['models'], expected)
        assert all(shop['status'] == 'settled' and shop['galleryLoaded'] == 1 and shop['galleryFailed'] == 0 for shop in preload['shops']), preload['shops']
        assert all(status == ('fallback' if scenario in ('missing','corrupt','slow') and name == './pharmacy-counter.glb' else 'loaded') for name, status in preload['models'].items()), preload['models']
        missing = [path for path in expected if not requests[path]]
        assert not missing, f'{scenario}: models never requested: {missing}'
        assert all(state['furn'][x] == 'loaded' for x in FURNISHINGS), state['furn']
        assert all(state['heroes'][str(n)] for n in HERO_STORES if scenario not in ('missing','corrupt','slow') or n not in (4, 5)), state['heroes']
        if scenario in ('missing','corrupt','slow'):
            target = '/demos/corporate/gjh/v11/assets/pharmacy-counter.glb'
            failure_deadline = time.monotonic() + 15
            while time.monotonic() < failure_deadline:
                if scenario == 'missing' and response_status.get(target) == 404:
                    break
                if scenario == 'corrupt' and response_status.get(target) == 200:
                    break
                if scenario == 'slow' and any(path == target for path, _ in failures):
                    break
                page.wait_for_timeout(100)
            if scenario == 'missing':
                assert response_status.get(target) == 404, response_status
            elif scenario == 'corrupt':
                assert response_status.get(target) == 200, response_status
            else:
                assert any(path == target for path, _ in failures), (failures, response_status)
            assert not state['heroes']['4'] and not state['heroes']['5'], state['heroes']
        settled_ms = round((time.monotonic() - start) * 1000)
        # Let in-flight rejection/timeout work settle before comparing re-entry counts.
        page.wait_for_timeout(1000)
        before = {path: requests[path] for path in expected}
        for number in range(4, 18):
            assert page.evaluate("id => __mall.teleport('planned-space-' + id)", f'{number:02d}')
            page.wait_for_timeout(100)
        assert page.evaluate("__mall.teleport('atrium')")
        page.wait_for_timeout(1000)
        after = {path: requests[path] for path in expected}
        later = compact(page)['preload']
        assert later['shops'] == preload['shops'], (preload['shops'], later['shops'])
        assert before == after, f'{scenario}: repeated shop entry requested models: {before} -> {after}'
        assert all(count == 1 for count in after.values()), f'{scenario}: duplicate requests: {after}'
        assert not errors, errors
        print(json.dumps({'scenario': scenario, 'firstFrameMs': first_frame_ms, 'loaderReadyMs': ready_ms, 'modelRequestsSettledMs': settled_ms,
                          'uniqueModels': len(expected), 'snapshot': compact(page)}), flush=True)
    finally:
        context.close()


def run_exit(browser, base, mode):
    context = browser.new_context(viewport={'width':1280,'height':800}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    try:
        start = time.monotonic()
        page.goto(base, wait_until='domcontentloaded')
        page.locator('#loader-enter-now').wait_for(state='visible', timeout=90000)
        page.wait_for_function("Object.values(__mall.state.modelPreload.models).includes('loading')", timeout=10000)
        assert not page.evaluate('window.mallLoader.snapshot().ready')
        if mode == 'early':
            page.evaluate("document.querySelector('#loader-enter-now').addEventListener('click', () => { window.__preloadAtClick = Object.entries(__mall.state.modelPreload.models).filter(([,status]) => status === 'loading').map(([name]) => name); }, {capture:true, once:true})")
            click_start = time.monotonic()
            page.locator('#loader-enter-now').press('Enter')
            click_ms = round((time.monotonic()-click_start)*1000)
            page.wait_for_function("window.mallLoader.snapshot().ready && document.querySelector('#app-loader').hidden")
            assert page.locator('#experience').is_visible()
            assert page.evaluate("document.activeElement.id === 'scene'"), 'Early entry lost keyboard focus'
            assert page.evaluate("__mall.teleport('planned-space-04')")
            state = page.evaluate('window.__preloadAtClick')
            assert state, (state, click_ms)
        else:
            page.evaluate("document.querySelector('#loader-directory').addEventListener('click', () => { window.__preloadAtClick = Object.entries(__mall.state.modelPreload.models).filter(([,status]) => status === 'loading').map(([name]) => name); }, {capture:true, once:true})")
            page.locator('#loader-directory').click()
            assert page.evaluate('window.__preloadAtClick')
            assert page.locator('#store-list').is_visible()
            assert page.locator('#experience').is_hidden()
            assert page.evaluate('window.mallLoader.snapshot().dismissed')
        print(json.dumps({'scenario':mode, 'exitMs':round((time.monotonic()-start)*1000)}), flush=True)
    finally:
        context.close()


def run_context_loss(browser, base):
    context = browser.new_context(viewport={'width':1280,'height':800}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    try:
        page.goto(base, wait_until='domcontentloaded')
        page.wait_for_function("window.__mall?.state.modelPreload?.models['./pharmacy-counter.glb'] === 'loading'", timeout=45000)
        page.evaluate("window.__testLoss = document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context'); if (!window.__testLoss) throw Error('context loss unavailable'); window.__testLoss.loseContext()")
        page.wait_for_function('window.mallLoader.snapshot().contextLost', timeout=10000)
        assert not page.evaluate('window.mallLoader.snapshot().ready')
        page.evaluate('window.__testLoss.restoreContext()')
        page.wait_for_function('__mall.state.graphics.validations >= 1', timeout=45000)
        page.wait_for_function('window.mallLoader.snapshot().ready', timeout=45000)
        state = compact(page)
        assert state['graphics']['losses'] == state['graphics']['validations'] == 1, state['graphics']
        assert state['graphics']['quality']['tier'] == 'low', state['graphics']
        print(json.dumps({'scenario':'loss', 'loader':page.evaluate('window.mallLoader.snapshot()'),
                          'graphics':state['graphics']}), flush=True)
    finally:
        context.close()


def run_deadline(browser, base):
    context = browser.new_context(viewport={'width':1280,'height':800}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    try:
        start = time.monotonic()
        page.goto(base, wait_until='domcontentloaded')
        page.wait_for_function('window.__sceneReady && window.__mall?.ready', timeout=90000)
        start = time.monotonic()
        assert not page.evaluate('window.mallLoader.snapshot().ready')
        page.wait_for_function('window.mallLoader.snapshot().ready', timeout=40000)
        elapsed = round((time.monotonic()-start)*1000)
        assert 29000 <= elapsed < 40000, elapsed
        state = page.evaluate('__mall.state.modelPreload')
        assert state['settled'] < state['total'], state
        assert page.locator('#experience').is_visible()
        print(json.dumps({'scenario':'deadline', 'loaderReadyMs':elapsed, 'settled':state['settled'], 'total':state['total']}), flush=True)
    finally:
        context.close()


def main():
    executable = os.environ['GALLERY_CHROME']
    backend = os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader')
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=executable,
            args=['--use-angle=' + backend, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        try:
            for scenario in os.environ.get('GALLERY_PRELOAD_SCENARIOS', 'success,missing,corrupt,slow,chandelier-missing,early,directory,loss,deadline').split(','):
                handler = functools.partial(Server, directory=str(ROOT))
                Server.scenario = scenario
                with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
                    threading.Thread(target=server.serve_forever, daemon=True).start()
                    try:
                        base = f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/#experience'
                        if scenario in ('early', 'directory'):
                            run_exit(browser, base, scenario)
                        elif scenario == 'loss':
                            run_context_loss(browser, base)
                        elif scenario == 'deadline':
                            run_deadline(browser, base)
                        else:
                            run_scenario(browser, base, scenario)
                    finally:
                        server.shutdown()
        finally:
            browser.close()


if __name__ == '__main__':
    main()
