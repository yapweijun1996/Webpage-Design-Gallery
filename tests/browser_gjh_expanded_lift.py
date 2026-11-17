"""Exercise the expanded lift and its two guarded landings in Chrome."""
from gjh_startup_test_helpers import mall_entry_url
import functools, http.server, math, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('GJH_STAGE7_SCREENS','/tmp/gjh-stage7-screens'));OUT.mkdir(parents=True,exist_ok=True)
def state(page): return page.evaluate('__mall.state')
def move(page,x,z,speed=2.65):
    for _ in range(35):
        s=state(page);dx=x-s['x'];dz=z-s['z'];dist=math.hypot(dx,dz)
        if dist<.1:return
        page.evaluate('''([dx,dz,ms])=>{__mall.setInput({right:dx,forward:-dz,yaw:0});__mall.step(ms)}''',[dx/dist,dz/dist,min(1500,max(17,dist/speed*1000))])
        after=state(page)
        assert math.hypot(after['x']-s['x'],after['z']-s['z'])>.025,('blocked',x,z,s['x'],s['z'],after['x'],after['z'],after['y'])
    raise AssertionError(('unreached',x,z,state(page)))
def run():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        for width,height in [(320,700),(390,844),(768,1024),(844,390),(1440,900)]:
          c=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',service_workers='block')
          c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
          page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000);assert page.evaluate('window.__sceneReady'),errors
          page.evaluate('__mall.teleport("newmoon")');move(page,-10,10);move(page,-6.4,10)
          assert state(page)['nearby']=='visitor-elevator',(width,state(page)['nearby'])
          if width in (390,1440):page.screenshot(path=str(OUT/f'ground-{width}.png'))
          page.locator('#inspect').click();page.evaluate('__mall.setInput({});__mall.step(5000)');assert abs(state(page)['y']-7.2)<.1,state(page)['y']
          assert state(page)['zone']=='upper'
          move(page,-7,10);assert abs(state(page)['y']-7.2)<.1
          if width in (390,1440):page.screenshot(path=str(OUT/f'upper-{width}.png'))
          if width==1440:
            page.evaluate('__mall.setInput({right:-1,yaw:0});__mall.step(3000);__mall.setInput({});__mall.step(20)')
            assert state(page)['x']>-8.8 and abs(state(page)['y']-7.2)<.1
            move(page,-7,10)
            for x,z in [(-7,5.5),(1,5.5),(1,14.5),(-7,14.5),(-7,10)]:move(page,x,z)
            assert abs(state(page)['y']-7.2)<.1
          move(page,-6.4,10);assert state(page)['nearby']=='visitor-elevator'
          page.locator('#inspect').click();page.evaluate('__mall.setInput({});__mall.step(5000)');assert abs(state(page)['y'])<.1
          move(page,-7.5,10);assert abs(state(page)['y'])<.1
          if width==1440:
            move(page,-6.4,10);page.locator('#inspect').click();page.evaluate('__mall.setInput({});__mall.step(5000)')
            assert state(page)['zone']=='upper'
            page.locator('[data-teleport="newmoon"]').click();assert abs(state(page)['y'])<.1 and abs(state(page)['x']+10)<.1
          assert not errors,errors
          print(f'PASS {width}x{height}: approach, bidirectional lift and both exits',flush=True);c.close()
        # Services are separate from the lift lobby and remain actionable.
        c=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce',service_workers='block')
        c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady',timeout=90000)
        page.evaluate('__mall.teleport("entry")');move(page,-5,42.2);assert state(page)['nearby']=='mall-directory'
        page.locator('#inspect').click();assert page.locator('#mall-map').evaluate('(e)=>e.open')
        page.evaluate('__mall.teleport("entry")');move(page,25,46);assert state(page)['nearby']=='service-desk',state(page)['nearby']
        page.locator('#inspect').click();assert 'self-service' in page.locator('#amenity-dialog').inner_text();page.keyboard.press('Escape')
        page.wait_for_function('!document.querySelector("#amenity-dialog").open')
        page.evaluate('__mall.teleport("newmoon")');move(page,-10,18);move(page,-7,19);assert state(page)['nearby']=='featured-showcase',state(page)['nearby']
        page.locator('#inspect').click();assert page.locator('#amenity-dialog [data-object-action]').count()==4;page.keyboard.press('Escape')
        print('PASS relocated directory, self-service desk and four-product showcase',flush=True);c.close()
        # A cart can approach the lift but cannot be carried between levels.
        c=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce',service_workers='block')
        c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady',timeout=90000)
        page.evaluate('__mall.teleport("newmoon")');move(page,-10,10);page.locator('#scene-cart').click();assert state(page)['pushing']
        move(page,-6.6,10,1.8);assert state(page)['nearby']=='visitor-elevator'
        page.locator('#inspect').click();assert not state(page)['elevatorTravel'] and abs(state(page)['y'])<.1
        assert 'stow the cart' in page.locator('#mall-status').inner_text().lower()
        print('PASS cart cannot travel in visitor-only lift',flush=True);c.close()
        c=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce',service_workers='block')
        c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady',timeout=90000)
        page.evaluate('__mall.teleport("newmoon")');move(page,-10,-2.6);move(page,-10,-7.4)
        shelf=page.evaluate("__mall.state.shelves.find(s=>s.id==='new-moon-nz-425g-front')")
        move(page,(shelf['min']['x']+shelf['max']['x'])/2,-7.4)
        page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.step(1600)')
        assert state(page)['character']['physicalProduct']['phase']=='held'
        for x,z in [(-10,-7.4),(-10,-2.6),(-10,2.4),(-10,10),(-6.4,10)]:move(page,x,z)
        assert state(page)['nearby']=='visitor-elevator';page.locator('#inspect').click()
        assert not state(page)['elevatorTravel'] and 'return held products' in page.locator('#mall-status').inner_text().lower()
        print('PASS held product cannot travel in visitor-only lift',flush=True);c.close()
        c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='no-preference',service_workers='block')
        c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady',timeout=90000)
        page.evaluate('__mall.teleport("newmoon")');move(page,-10,10);move(page,-6.4,10)
        page.evaluate("()=>{document.querySelector('#inspect').click();__mall.setInput({});__mall.step(500)}")
        page.locator('#view-toggle').click();before=state(page)['y'];page.evaluate('__mall.step(2000)')
        assert abs(state(page)['y']-before)<.001 and state(page)['elevatorTravel']
        page.locator('#view-toggle').click();page.evaluate('__mall.setInput({});__mall.step(4000)');assert abs(state(page)['y']-7.2)<.1
        print('PASS directory pause and resume during lift travel',flush=True);c.close()
        # Native WebGL loss settles a moving rider at the nearest guarded landing.
        # The physical lift first boards horizontally; these times reach the
        # lower and upper portions of the actual vertical journey.
        for elapsed in [1100,2400]:
          c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='no-preference',service_workers='block')
          c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady',timeout=90000)
          page.locator('#view-toggle').click();page.locator('[data-add]').first.click();page.locator('#view-toggle').click()
          page.evaluate('__mall.teleport("newmoon")');move(page,-10,10);move(page,-6.4,10)
          page.evaluate("()=>{document.querySelector('#inspect').click();__mall.setInput({});}");page.evaluate('ms=>__mall.step(ms)',elapsed)
          trip=state(page);assert trip['elevatorTravel'] and .2<trip['y']<7,trip['y']
          page.evaluate("()=>{window.__liftLoss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__liftLoss)throw Error('No loss extension');__liftLoss.loseContext()}")
          page.wait_for_function('__mall.state.graphics.status === "lost" || __mall.state.graphics.status === "failed"')
          settled=state(page);floor=0 if trip['y']<3.6 else 7.2
          assert abs(settled['y']-floor)<.1 and not settled['elevatorTravel'],settled['y']
          page.evaluate('__liftLoss.restoreContext()');page.wait_for_function('__mall.ready && __mall.state.graphics.validations>0',timeout=60000)
          page.locator('#graphics-return').click();page.wait_for_function('document.querySelector("#scene").offsetWidth>0')
          move(page,-7,10);assert abs(state(page)['y']-floor)<.1 and '1' in page.locator('#bag-open').inner_text()
          print(f'PASS graphics interruption at {elapsed}ms: safe floor {floor}, movement and bag',flush=True);c.close()
        c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
        c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();page.goto(mall_entry_url(url+'&visitor=v1'));page.wait_for_function('window.__sceneReady',timeout=90000)
        page.locator('#view-toggle').click();assert 'lift is available with Visitor v2' in page.locator('#layout-preview-notice').inner_text()
        assert page.locator('[data-store]').count()==3
        print('PASS Visitor v1 retains ground-floor stores and explains lift availability',flush=True);c.close()
        browser.close()
    finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
