"""Check split physics loading, its fallback, and V1/V2 module selection."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


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
            for query in ('', '?visitor=v1'):
                context = browser.new_context(reduced_motion='reduce', service_workers='block')
                context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(base + query)
                page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                assert page.evaluate('window.__sceneReady === true')
                paths = page.evaluate("performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname)")
                assert any(path.endswith('/rapier_bg.wasm') for path in paths), paths
                v1_modules = ('/seated-pose.js', '/collection-gesture.js', '/carry-bag.js')
                assert all(any(path.endswith(name) for path in paths) == bool(query) for name in v1_modules), paths
                assert not errors, errors
                print(f'PASS {query or "visitor=v2"}: physics loaded and visitor modules scoped', flush=True)
                if not query:
                    colours = page.evaluate('''async () => {
                      const T=await import('./vendor/three.module.min.js');
                      const {createElevatorV2}=await import('./assets/elevator-v2.js');
                      const {EVERYDAY,LUNAR_NEW_YEAR}=await import('./assets/mall-themes.js');
                      const R={ColliderDesc:{cuboid:()=>({setTranslation(){return this;}})}};
                      const physics={createCollider:()=>({setEnabled(){},setTranslation(){}})};
                      const scene=new T.Scene(),lift=createElevatorV2(T,R,physics,scene,true);
                      const colours=()=>scene.children.filter(o=>o.geometry?.getAttribute('color')).map(o=>Array.from(o.geometry.getAttribute('color').array));
                      if(!lift.applyMallTheme(EVERYDAY))return false;
                      const everyday=JSON.stringify(colours());
                      if(!lift.applyMallTheme(LUNAR_NEW_YEAR))return false;
                      const lunar=JSON.stringify(colours());
                      if(lift.applyMallTheme({materials:{}})!==false || JSON.stringify(colours())!==lunar)return false;
                      return lift.applyMallTheme(EVERYDAY) && everyday!==lunar && JSON.stringify(colours())===everyday;
                    }''')
                    assert colours, 'The merged lift must switch and restore its batched theme colours'
                    print('PASS expanded lift: theme colours switch and restore', flush=True)
                context.close()
            context = browser.new_context(service_workers='block')
            page = context.new_page()
            page.route('**/rapier_bg.wasm', lambda route: route.abort())
            page.goto(base)
            page.wait_for_function('window.__sceneFailed === true', timeout=90000)
            assert page.locator('#fallback-message').is_visible()
            assert 'physics engine could not start' in page.locator('#fallback-message').inner_text()
            assert page.locator('[data-store]').count() == 3 and page.locator('.product-card').count() == 4
            print('PASS blocked WASM: accessible directory fallback', flush=True)
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
