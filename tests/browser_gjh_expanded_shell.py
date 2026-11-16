"""Exercise the opt-in expanded shell with real Chrome and Rapier collisions."""
import argparse
import functools
import http.server
import math
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

def position(page):
    return page.evaluate('''() => {const s=__mall.state;return {x:s.x,z:s.z,y:s.y,
      pushing:s.pushing,zone:s.zone,drawCalls:s.drawCalls,triangles:s.renderTriangles,
      camera:s.cameraObstruction,resources:s.rendererResources};}''')

def move(page, x, z, speed):
    # Real collision controller, stepped in bounded time bursts; no position teleport.
    for _ in range(30):
        a = position(page)
        dx, dz = x-a['x'], z-a['z']
        distance = math.hypot(dx, dz)
        if distance < .09:
            assert abs(a['y']) < .12 and a['camera']['avatarVisible'], a
            return
        page.evaluate('''([dx,dz,ms])=>{__mall.setInput({right:dx,forward:-dz,yaw:0});__mall.step(ms)}''',
            [dx/distance,dz/distance,min(5000,max(17,distance/speed*1000))])
        b = position(page)
        assert math.hypot(a['x']-b['x'],a['z']-b['z']) > .04, ('blocked', (x,z), a, b)
    raise AssertionError(('failed to reach waypoint', (x,z), position(page)))

def open_map(page):
    if page.locator('#header-map').is_visible():
        page.locator('#header-map').click()
    assert page.locator('#mall-map').evaluate('(e)=>e.open')

def run():
    parser=argparse.ArgumentParser()
    parser.add_argument('--screens',type=Path)
    args=parser.parse_args()
    if args.screens: args.screens.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[
                '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),
                '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            print('Browser:',browser.version,flush=True)
            for width,height,visitor in [(320,700,''),(390,844,''),(768,1024,''),(1440,900,''),(844,390,''),(390,844,'&visitor=v1')]:
                context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,
                    device_scale_factor=2,reduced_motion='reduce',service_workers='block')
                context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
                page=context.new_page(); errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(url+'?layout=expanded'+visitor,wait_until='domcontentloaded')
                page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
                assert page.evaluate('window.__sceneReady === true'), 'expanded 3D initialization failed'
                assert abs(position(page)['x']-10)<.1 and abs(position(page)['z']-45)<.1
                if args.screens and not visitor and width in (390,768,1440):
                    page.screenshot(path=str(args.screens/f'entry-{width}.png'))
                # Trusted keyboard input reaches the real movement controller.
                page.locator('#scene').focus(); before=position(page)
                page.keyboard.down('w');page.wait_for_timeout(350);page.keyboard.up('w')
                assert position(page)['z'] < before['z']-.2, ('keyboard movement',width,before,position(page))
                if width==390 and not visitor:
                    # Chromium dispatches actual touch events to the canvas, including pointer capture.
                    cdp=context.new_cdp_session(page);before=position(page)
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':200,'y':350}]})
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':200,'y':300}]})
                    page.wait_for_timeout(350)
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                    assert position(page)['z'] < before['z']-.15, ('touch movement',before,position(page))
                open_map(page)
                assert page.locator('.expanded-map-number').count()==17
                assert page.locator('.map-planned').count()==14
                assert page.locator('[data-teleport]').count()==3
                if args.screens and not visitor and width in (390,768,1440):
                    page.screenshot(path=str(args.screens/f'map-{width}.png'))
                for ident, x in [('newmoon',-10),('mili',0),('gogo',10)]:
                    button=page.locator(f'[data-teleport="{ident}"]')
                    button.scroll_into_view_if_needed();box=button.bounding_box()
                    assert box['width']>=44 and box['height']>=44,box
                    button.click();page.wait_for_function('(x)=>Math.abs(__mall.state.x-x)<.1 && Math.abs(__mall.state.z-2.4)<.1',arg=x)
                    dot=page.locator('#player-dot')
                    assert abs(float(dot.get_attribute('cx'))-(x+25)*10)<1
                    assert abs(float(dot.get_attribute('cy'))-144)<1
                    page.evaluate('__mall.setInput({forward:1});__mall.step(1600);__mall.setInput({forward:0});__mall.step(20)')
                    assert position(page)['zone']==ident and position(page)['z']<0,position(page)
                    if ident!='gogo':open_map(page)
                page.locator('#view-toggle').click()
                assert page.locator('[data-store]:visible').count()==3 and page.locator('.product-card').count()==4
                assert page.locator('#layout-preview-notice').is_visible()
                page.locator('[data-add]').first.click();assert '1' in page.locator('#bag-open').inner_text()
                page.locator('#bag-open').click();assert page.locator('#bag-items li').count()==1
                page.locator('#bag-close').click();page.locator('#view-toggle').click()
                assert '1' in page.locator('#bag-open').inner_text()
                assert not errors,errors
                print(f'PASS {width}x{height} {visitor or "visitor=v2"}: keyboard, map, three real doors, directory and bag',flush=True)
                if width==1440:
                    assert page.evaluate('__mall.teleport("entry")')
                    directory=page.evaluate("async()=> (await import('./assets/lift-layout.js')).liftLayout.directory")
                    # Approach the relocated kiosk from the open entrance aisle.
                    move(page,10,46.2,2.65)
                    move(page,directory['x'],46.2,2.65)
                    assert page.evaluate('__mall.state.nearby')=='mall-directory'
                    page.locator('#inspect').click()
                    assert page.locator('#mall-map').evaluate('(e)=>e.open')
                    print('PASS expanded directory kiosk opens the live map',flush=True)
                    assert page.evaluate('__mall.teleport("entry")')
                    for x,z in [(10,39),(32,39),(32,3),(-12,3),(-12,39),(10,39)]: move(page,x,z,2.65)
                    page.evaluate('__mall.setInput({forward:0});__mall.step(20)')
                    page.locator('#scene-cart').click();assert position(page)['pushing']
                    for x,z in [(-12,39),(-12,3),(32,3),(32,39),(10,39)]: move(page,x,z,1.8)
                    print('PASS continuous loop: avatar clockwise, cart counterclockwise; end metrics:',position(page),flush=True)
                    if args.screens: page.screenshot(path=str(args.screens/'cart-1440.png'))
                if width==390 and not visitor:
                    page.locator('#view-toggle').click();page.locator('#layout-preview-link').click()
                    page.wait_for_function('window.__sceneReady',timeout=90000)
                    assert not page.evaluate('document.body.classList.contains("is-expanded")')
                    assert '1' in page.locator('#bag-open').inner_text()
                    page.locator('#view-toggle').click();page.locator('#layout-preview-link').click()
                    page.wait_for_function('window.__sceneReady',timeout=90000)
                    assert page.evaluate('document.body.classList.contains("is-expanded")')
                    assert '1' in page.locator('#bag-open').inner_text()
                    print('PASS reversible layout navigation preserves the tab bag',flush=True)
                context.close()
            # The opt-in shell must retain the existing recovery and list fallback.
            context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
            context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
            page=context.new_page();page.goto(url+'?layout=expanded');page.wait_for_function('window.__sceneReady',timeout=90000)
            page.locator('#view-toggle').click();page.locator('[data-add]').first.click();page.locator('#view-toggle').click()
            page.evaluate("window.__lossExtension=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__lossExtension)throw Error('Context-loss extension unavailable');__lossExtension.loseContext()")
            page.wait_for_function('__mall.state.graphics.status === "lost" || __mall.state.graphics.status === "failed"')
            assert page.locator('#store-list').is_visible() and '1' in page.locator('#bag-open').inner_text()
            page.evaluate('__lossExtension.restoreContext()')
            page.wait_for_function('__mall.ready && __mall.state.graphics.validations>0',timeout=60000)
            assert page.locator('#graphics-return').is_visible();page.locator('#graphics-return').click()
            assert page.locator('#scene').is_visible() and '1' in page.locator('#bag-open').inner_text()
            print('PASS expanded real WebGL context loss and recovery preserves the bag',flush=True);context.close()
            for mode in ['no-js','physics-failure']:
                context=browser.new_context(java_script_enabled=mode!='no-js',service_workers='block')
                page=context.new_page()
                if mode=='physics-failure':page.route('**/rapier.mjs',lambda route:route.abort())
                page.goto(url+'?layout=expanded')
                if mode=='physics-failure':page.wait_for_function('window.__sceneFailed',timeout=90000)
                assert page.locator('#store-list').is_visible() and page.locator('[data-store]').count()==3
                assert page.locator('.product-card').count()==4
                print(f'PASS expanded {mode} directory fallback',flush=True);context.close()
            browser.close()
    finally:
        server.shutdown();server.server_close()

if __name__=='__main__': run()
