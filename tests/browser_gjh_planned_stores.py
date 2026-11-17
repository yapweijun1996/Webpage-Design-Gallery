"""Verify visitable concept stores and their map/directory correspondence."""
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
                context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
                page = context.new_page(); errors=[]
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(url+'?layout=expanded'); page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                assert page.evaluate('window.__sceneReady === true')
                open_map(page)
                labels = page.locator('#mall-map .expanded-map-number').all_text_contents()
                assert labels == [f'{i:02d}' for i in range(1,18)], labels
                assert '17 stores open to explore' in page.locator('#mall-map .floorplan').get_attribute('aria-label')
                assert page.locator('#mall-map [data-map-store]').count() == 17 and page.locator('#map-destination option').count() == 17
                page.locator('#map-destination').select_option('planned-space-17')
                page.locator('#map-visit').focus()
                page.keyboard.press('Enter')
                page.wait_for_function('Math.abs(__mall.state.x - 32.6) < 0.1 && Math.abs(__mall.state.z - 44) < 0.1')
                if page.locator('#map-close').is_visible(): page.locator('#map-close').click()
                page.locator('#view-toggle').click()
                detail = page.locator('#planned-spaces-directory'); assert detail.is_visible()
                if detail.evaluate('(e)=>e.open'): detail.locator('summary').click()
                summary=detail.locator('summary'); summary.focus(); page.keyboard.press('Enter')
                assert detail.evaluate('(e)=>e.open')
                items=detail.locator('li').all_text_contents()
                assert len(items)==14 and [detail.locator('li').nth(i).get_attribute('data-planned-number') for i in range(14)]==[f'{i:02d}' for i in range(4,18)], items
                assert all('Visit ' in x and ' in 3D' in x for x in items)
                assert detail.locator('[data-visit-store]:visible').count()==14
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                for ident in ['newmoon','mili','gogo']:
                    assert page.locator(f'[data-visit-store="{ident}"]').is_visible()
                if width in (390,1440):
                    detail.scroll_into_view_if_needed();page.screenshot(path=str(SCREENS/f'directory-{width}.png'))
                if width==1440:
                    settings=page.locator('.mall-app-settings')
                    settings.locator('summary').click()
                    language=settings.locator('[data-mall-language]')
                    for code,heading,action in [('zh-Hans','概念店（14）','在 3D 中参观 Casio'),('ms','Kedai konsep (14)','Lawati Casio dalam 3D')]:
                        language.select_option(code)
                        assert detail.locator('summary').inner_text()==heading
                        assert detail.locator('[data-visit-store="planned-space-15"]').inner_text()==action
                    language.select_option('en')
                    settings.locator('summary').click()
                    page.locator('[data-visit-store="planned-space-04"]').click()
                    page.wait_for_function('Math.abs(__mall.state.x - 20) < 0.1 && Math.abs(__mall.state.z - 2.4) < 0.1')
                    page.screenshot(path=str(SCREENS/'north-storefront.png'))
                assert not errors,errors
                print(f'PASS {width}x{height}: numbered map, keyboard map travel, directory and concept store controls',flush=True)
                context.close()
            for mode in ['default','no-js','physics-failure']:
                context=browser.new_context(java_script_enabled=mode!='no-js',service_workers='block')
                page=context.new_page()
                if mode=='physics-failure': page.route('**/rapier.mjs',lambda route:route.abort())
                page.goto(url+('' if mode=='default' else '?layout=expanded'))
                if mode=='physics-failure': page.wait_for_function('window.__sceneFailed',timeout=90000)
                if mode=='default': page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
                assert page.locator('[data-store]').count()==3 and page.locator('.product-card').count()==4
                assert page.locator('#planned-spaces-directory').count()==1 and page.locator('#planned-spaces-list li').count()==14
                if mode!='default': assert page.locator('#planned-spaces-directory [data-visit-store]:visible').count()==0
                print(f'PASS {mode}: truthful directory fallback',flush=True); context.close()
            browser.close()
    finally: server.shutdown(); server.server_close()
if __name__=='__main__': run()
