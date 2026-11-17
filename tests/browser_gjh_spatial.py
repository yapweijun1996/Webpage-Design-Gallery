"""Real-browser parity of the current scene, map, directory and fallbacks."""
from gjh_startup_test_helpers import mall_entry_url
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_all_seats import move

ROOT = Path(__file__).resolve().parents[1]
STORES = [('newmoon','01','New Moon',-10,14),('mili','02','MILI',0,114),('gogo','03','GOGO',10,214)]

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
    def copyfile(self,source,output):
        try: super().copyfile(source,output)
        except (BrokenPipeError,ConnectionResetError): pass


def run():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[
                '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),
                '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            for width,height,query in [(1440,900,''),(390,844,''),(390,844,'?visitor=v1')]:
                context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,
                    reduced_motion='reduce',service_workers='block')
                context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
                page=context.new_page();errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.goto(mall_entry_url(url+query),wait_until='domcontentloaded')
                page.wait_for_function('window.__sceneReady === true',timeout=90000)
                assert page.locator('#scene').is_visible()
                if width >= 1000: page.locator('#header-map').click()
                assert page.locator('#location-name').text_content()=='The courtyard'
                assert page.locator('[data-map-store]').count()==3
                for ident,number,label,x,map_x in STORES:
                    rect=page.locator(f'[data-map-store="{ident}"]')
                    assert float(rect.get_attribute('x'))==map_x
                    button=page.locator(f'[data-teleport="{ident}"]')
                    assert button.get_attribute('aria-label')==f'Go to the {label} storefront'
                    assert button.locator('span').text_content()==number and label in button.text_content()
                    assert page.locator(f'[data-store="{ident}"] h2').first.inner_text()==label
                    assert page.locator(f'[data-store-filter="{ident}"]').inner_text().strip()==label
                    if width<1000:
                        page.locator('#header-map').click()
                        page.wait_for_function('document.querySelector("#mall-map").open')
                    button.click()
                    page.wait_for_function('x=>Math.abs(__mall.state.x-x)<.1 && Math.abs(__mall.state.z-2.4)<.1',arg=x)
                    dot=page.locator('#player-dot')
                    assert abs(float(dot.get_attribute('cx'))-(x+15)*10)<1
                    assert abs(float(dot.get_attribute('cy'))-134)<1
                    page.evaluate('__mall.setInput({forward:1});__mall.step(1600);__mall.setInput({forward:0});__mall.step(20)')
                    state=page.evaluate('__mall.state')
                    assert state['zone']==ident and state['z']<0 and state['doors'][ident]>.9,(ident,state['zone'],state['z'],state['doors'])
                    assert page.locator('#location-name').text_content()==label
                before=page.evaluate('({x:__mall.state.x,z:__mall.state.z})')
                assert not page.evaluate('__mall.teleport("__proto__")')
                after=page.evaluate('({x:__mall.state.x,z:__mall.state.z})')
                assert before==after
                if width==1440 and not query:
                    # The actual elevator rejects travel while in motion. The map
                    # must not announce an arrival when the request is rejected.
                    page.evaluate('__mall.teleport("atrium")');move(page,0,15)
                    assert page.evaluate('__mall.state.nearby')=='visitor-elevator'
                    # Freeze the real action immediately after its DOM click so a
                    # slow host cannot finish the ride before the assertion.
                    assert page.evaluate('''() => {
                      document.querySelector('#inspect').click();
                      const started = __mall.state.elevatorTravel;
                      __mall.setInput({forward:0}); return started;
                    }''')
                    page.locator('[data-teleport="mili"]').click()
                    assert 'unavailable right now' in page.locator('#mall-status').inner_text()
                    assert page.evaluate('__mall.state.elevatorTravel')
                    page.evaluate('__mall.setInput({forward:0});__mall.step(4000)')
                page.locator('#view-toggle').click();assert page.locator('#store-list').is_visible()
                assert page.locator('#location-name').text_content()=='The store directory'
                for ident,number,label,_,_ in STORES:
                    page.locator(f'[data-store-filter="{ident}"]').click()
                    assert page.locator('[data-store]:visible').count()==1
                    store=page.locator(f'[data-store="{ident}"]')
                    assert store.is_visible() and store.locator('.store-story > .eyebrow').text_content()==f'{number} / The {label} store'
                    store.locator('[data-inspect]').first.click();assert page.locator('#product-dialog').is_visible()
                    page.locator('#product-close').click();page.wait_for_function('!document.querySelector("#product-dialog").open')
                page.locator('[data-store-filter="all"]').click()
                assert page.locator('[data-store]:visible').count()==3 and page.locator('.product-card').count()==4
                page.locator('#view-toggle').click()
                assert page.locator('#location-name').text_content()==('Upper level' if width==1440 and not query else 'GOGO')
                assert not errors,errors
                print(f'PASS {width}x{height} {query or "default V2"}: map, physical doors, directory and details',flush=True)
                context.close()
            for mode in ['no-js','physics-failure']:
                context=browser.new_context(java_script_enabled=mode!='no-js',service_workers='block')
                page=context.new_page()
                if mode=='physics-failure': page.route('**/rapier.mjs',lambda route:route.abort())
                page.goto(mall_entry_url(url) if mode!='no-js' else url,wait_until='domcontentloaded')
                if mode=='physics-failure':page.wait_for_function('window.__sceneFailed === true',timeout=90000)
                assert page.locator('#store-list').is_visible()
                assert page.locator('[data-store]').count()==3 and page.locator('.product-card').count()==4
                for ident,number,label,_,_ in STORES:
                    assert page.locator(f'#{ident}-title').inner_text()==label
                    assert page.locator(f'[data-store="{ident}"] .store-story > .eyebrow').text_content()==f'{number} / The {label} store'
                if mode=='no-js':assert page.locator('noscript').count()>0
                else:
                    page.locator('[data-store-filter="mili"]').click()
                    assert page.locator('[data-store="mili"]').is_visible()
                print(f'PASS {mode} directory fallback',flush=True)
                context.close()
            browser.close()
    finally:
        server.shutdown();server.server_close()

if __name__=='__main__':run()
