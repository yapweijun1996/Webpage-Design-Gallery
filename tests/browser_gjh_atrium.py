"""Expanded atrium: collision-safe planting, seat interactions and circulation."""
import argparse
import functools
import http.server
import os
import threading
from pathlib import Path
from gjh_startup_test_helpers import use_individual_assets
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet, move, position

ROOT=Path(__file__).resolve().parents[1]

def state(page):
    return page.evaluate('''() => {const s=__mall.state;return {x:s.x,z:s.z,y:s.y,nearby:s.nearby,
      seated:s.seated,seatId:s.seatId,seatPhase:s.seatPhase,pushing:s.pushing,
      camera:s.cameraObstruction,seats:s.seats,drawCalls:s.drawCalls,triangles:s.renderTriangles}}''')

def run():
    parser=argparse.ArgumentParser();parser.add_argument('--screens',type=Path);args=parser.parse_args()
    if args.screens:args.screens.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[
                '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),
                '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            print('Browser:',browser.version,flush=True)
            for width,height,visitor in [(320,700,''),(390,844,''),(768,1024,''),(1440,900,''),(844,390,''),(390,844,'&visitor=v1')]:
                context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,
                    has_touch=width<1000,reduced_motion='reduce',service_workers='block')
                context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
                page=context.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
                page.goto(base+visitor);page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
                assert page.evaluate('window.__sceneReady === true')
                page.locator('#view-toggle').click();page.locator('[data-add]').first.click();page.locator('#view-toggle').click()
                seats=state(page)['seats'];assert len(seats)==8
                for seat in seats[:4]:
                    assert page.evaluate('__mall.teleport("entry")')
                    # Approach each lounge from the open side, never through its furniture.
                    aisle=-8 if seat['x']<0 else 20
                    move(page,10,35,2.65);move(page,aisle,35,2.65);move(page,aisle,21,2.65)
                    move(page,seat['exitX'],21,2.65);move(page,seat['exitX'],seat['exitZ'],2.65)
                    a=state(page);assert a['nearby']==seat['id'],(seat,a)
                    if width==1440 and seat==seats[0]:
                        page.locator('#scene-cart').click()
                        assert not state(page)['pushing'] and page.locator('#bag-dialog').is_visible()
                        assert 'clear floor' in page.locator('#cart-status').inner_text()
                        page.locator('#bag-close').click()
                    if args.screens and not visitor and width in (320,390,768,844,1440) and seat==seats[0]:
                        # Face the seating from its approach side for a useful visual record.
                        page.evaluate('__mall.setInput({forward:0,yaw:Math.PI});__mall.step(20)')
                        page.screenshot(path=str(args.screens/f'lounge-{width}.png'))
                    page.locator('#inspect').click();page.evaluate('__mall.step(40)')
                    a=state(page);assert a['seated'] and a['seatId']==seat['id'] and a['camera']['avatarVisible'],a
                    assert page.locator('#inspect').inner_text()=='Stand up'
                    assert '1' in page.locator('#bag-open').inner_text()
                    if args.screens and not visitor and width in (320,390,844,1440) and seat==seats[0]:
                        page.screenshot(path=str(args.screens/f'seated-{width}.png'))
                    page.locator('#bag-open').click();assert page.locator('#cart-toggle').is_disabled()
                    page.locator('#bag-close').click();page.locator('#inspect').click();page.evaluate('__mall.step(50)')
                    a=state(page);assert not a['seated'] and abs(a['x']-seat['exitX'])<.05 and abs(a['z']-seat['exitZ'])<.05,a
                assert not errors,errors
                print(f'PASS {width}x{height} {visitor or "visitor=v2"}: four seats, camera, safe standing and retained bag',flush=True)
                if width==1440:
                    assert page.evaluate('__mall.teleport("entry")')
                    move(page,10,35,2.65);page.evaluate('__mall.setInput({forward:0});__mall.step(20)')
                    page.locator('#scene-cart').click();assert state(page)['pushing']
                    for x,z in [(10,29),(5,29),(15,29),(10,29),(10,21)]:move(page,x,z,1.8)
                    # The cart must stop at the visible garden edge, not pass through it.
                    page.evaluate('__mall.setInput({forward:1,yaw:0});__mall.step(5000);__mall.setInput({forward:0});__mall.step(20)')
                    a=state(page);assert 18.7<a['z']<19.5 and a['pushing'],a
                    if args.screens:page.screenshot(path=str(args.screens/'garden-cart-1440.png'))
                    print('PASS event-area cart traversal and visible garden collision:',a['z'],flush=True)
                context.close()
            # Missing optional furniture still yields a usable seat and collider.
            context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
            context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
            page=context.new_page();use_individual_assets(page);page.route('**/GJH_PUB_002.glb',lambda route:route.abort())
            page.goto(base);page.wait_for_function('window.__sceneReady',timeout=90000)
            assert page.evaluate('__mall.state.furnishings.bench.status')=='fallback'
            seat=state(page)['seats'][0]
            for x,z in [(10,35),(-8,35),(-8,21),(seat['exitX'],21),(seat['exitX'],seat['exitZ'])]:move(page,x,z,2.65)
            assert state(page)['nearby']==seat['id'];page.locator('#inspect').click();page.evaluate('__mall.step(40)')
            assert state(page)['seated'];page.locator('#inspect').click();page.evaluate('__mall.step(40)')
            assert not state(page)['seated'];print('PASS fallback seat asset: approach, sit and stand',flush=True)
            context.close()
            browser.close()
    finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
