"""Check split physics loading, its fallback, and visitor selection."""
from gjh_startup_test_helpers import mall_entry_url, use_individual_assets
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
            for query, expected_model, block_tripo in (
                ('', 'gjh-tripo-visitor', False),
                ('?visitor=v2', 'gjh-mall-visitor-v2', False),
                ('?visitor=v1', 'gjh-mall-visitor', False),
                ('', 'gjh-mall-visitor-v2', True),
            ):
                context = browser.new_context(reduced_motion='reduce', service_workers='block')
                context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                blocked_models = []
                if block_tripo:
                    # A packed entry avatar can satisfy startup before the standalone portrait is requested.
                    use_individual_assets(page)
                    def reject_model(route):
                        blocked_models.append(route.request.url.rsplit('/', 1)[-1])
                        route.abort()
                    page.route('**/gjh-tripo-{entry,visitor,visitor-2k}.glb', reject_model)
                page.goto(mall_entry_url(base + query))
                page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                assert page.evaluate('window.__sceneReady === true')
                assert page.evaluate('__mall.state.character.model') == expected_model
                if block_tripo:
                    assert {'gjh-tripo-entry.glb', 'gjh-tripo-visitor.glb'} <= set(blocked_models), blocked_models
                paths = page.evaluate("performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname)")
                assert any(path.endswith('/rapier_bg.wasm') for path in paths), paths
                v1_modules = ('/seated-pose.js', '/collection-gesture.js', '/carry-bag.js')
                assert all(any(path.endswith(name) for path in paths) == (query == '?visitor=v1') for name in v1_modules), paths
                controls = page.locator('#controls-copy .visitor-v2-controls select').evaluate_all('els => els.map(el => el.name)')
                expected_controls = ['hair', 'hairColor', 'outfit', 'skin', 'shoes', 'glasses', 'backpack', 'watch']
                assert controls == (expected_controls if expected_model == 'gjh-mall-visitor-v2' else []), controls
                assert page.evaluate("!__mall.emote('wave')"), 'Reduced motion must suppress emotes'
                assert not errors, errors
                source = 'blocked Tripo fallback' if block_tripo else query or 'default'
                print(f'PASS {source} -> {expected_model}: physics loaded and visitor modules scoped', flush=True)
                if expected_model == 'gjh-tripo-visitor':
                    colours = page.evaluate('''async () => {
                      const T=await import('./vendor/three.module.min.js');
                      const {createElevatorV2}=await import('./assets/elevator-v2.js');
                      const {EVERYDAY,LUNAR_NEW_YEAR}=await import('./assets/mall-themes.js');
                      const R={ColliderDesc:{cuboid:()=>({setRotation(){return this;},setTranslation(){return this;}})}};
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
            page.goto(mall_entry_url(base))
            page.wait_for_function('window.__sceneFailed === true', timeout=90000)
            reason = 'physics engine could not start'
            status = page.locator('#loader-status')
            status.wait_for(state='visible')
            assert reason in status.inner_text()
            browse = page.get_by_role('link', name='Browse the store directory')
            assert browse.get_attribute('href') == '#store-list'
            browse.click()
            page.locator('#fallback-message').wait_for(state='visible')
            assert reason in page.locator('#fallback-message').inner_text()
            directory = page.locator('#store-list')
            assert directory.is_visible()
            stores = directory.locator('[data-store]').evaluate_all('els => els.map(el => el.dataset.store)')
            products = directory.locator('.product-card').evaluate_all('els => els.map(el => el.dataset.product)')
            assert stores == ['newmoon', 'mili', 'gogo'], stores
            assert products == [f'new-moon-{sku}-front' for sku in ('nz-425g', 'au-425g', 'sa-425g', 'mx-454g')], products
            print('PASS blocked WASM: accessible directory fallback', flush=True)
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    run()
