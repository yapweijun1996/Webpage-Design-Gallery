"""Verify neutral planned spaces and their map/directory correspondence."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet, move, open_map

ROOT = Path(__file__).resolve().parents[1]
SCREENS = Path(os.environ.get('GJH_STAGE6_SCREENS', '/tmp/gjh-stage6-screens'))
SCREENS.mkdir(parents=True, exist_ok=True)

def run():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'), '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            for width, height in [(320,700), (390,844), (768,1024), (1440,900), (844,390)]:
                context = browser.new_context(viewport={'width':width,'height':height}, has_touch=width<1000, reduced_motion='reduce', service_workers='block')
                context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
                page = context.new_page(); errors=[]
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(url+'?layout=expanded'); page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                assert page.evaluate('window.__sceneReady === true')
                open_map(page)
                labels = page.locator('.expanded-map-number').all_text_contents()
                assert labels == [f'{i:02d}' for i in range(1,18)], labels
                assert '04 to 17 are planned and closed' in page.locator('.floorplan').get_attribute('aria-label')
                assert page.locator('.map-planned').count() == 14 and page.locator('[data-teleport]').count() == 3
                if page.locator('#map-close').is_visible(): page.locator('#map-close').click()
                page.locator('#view-toggle').click()
                detail = page.locator('#planned-spaces'); assert detail.is_visible()
                summary=detail.locator('summary'); summary.focus(); page.keyboard.press('Enter')
                assert detail.evaluate('(e)=>e.open')
                items=detail.locator('li').all_text_contents()
                assert len(items)==14 and [x.split(' ')[0] for x in items]==[f'S{i:02d}' for i in range(4,18)], items
                assert all('Planned' in x for x in items)
                assert detail.locator('a,button').count()==0
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                for ident in ['newmoon','mili','gogo']:
                    assert page.locator(f'[data-visit-store="{ident}"]').is_visible()
                if width in (390,1440):
                    detail.scroll_into_view_if_needed();page.screenshot(path=str(SCREENS/f'directory-{width}.png'))
                if width==1440:
                    page.locator('[data-visit-store="newmoon"]').click()
                    move(page,20,2.5,2.65)
                    page.evaluate('__mall.setInput({forward:0,yaw:0});__mall.step(50)')
                    page.screenshot(path=str(SCREENS/'north-storefront.png'))
                assert not errors,errors
                print(f'PASS {width}x{height}: numbered map, keyboard directory, closed spaces and open-store controls',flush=True)
                context.close()
            for mode in ['default','no-js','physics-failure']:
                context=browser.new_context(java_script_enabled=mode!='no-js',service_workers='block')
                page=context.new_page()
                if mode=='physics-failure': page.route('**/rapier.mjs',lambda route:route.abort())
                page.goto(url+('' if mode=='default' else '?layout=expanded'))
                if mode=='physics-failure': page.wait_for_function('window.__sceneFailed',timeout=90000)
                if mode=='default': page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
                assert page.locator('[data-store]').count()==3 and page.locator('.product-card').count()==4
                if mode in ('default','no-js'): assert page.locator('#planned-spaces').is_hidden()
                else: assert page.locator('#planned-spaces').is_visible() and page.locator('#planned-space-list li').count()==14
                print(f'PASS {mode}: truthful directory fallback',flush=True); context.close()
            browser.close()
    finally: server.shutdown(); server.server_close()
if __name__=='__main__': run()
