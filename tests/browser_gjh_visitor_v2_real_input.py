"""Normal-motion journeys driven by browser keyboard/touch, never simulation hooks."""
import json
import math
import os
import time
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('GJH_REAL_OUTPUT', str(ROOT / 'docs/evidence/visitor-v2-ux')))
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('GJH_V2_URL', 'http://127.0.0.1:18773/demos/corporate/gjh/v11/')
SUITE = os.environ.get('GJH_REAL_SUITE', 'all')
results, errors, warnings = [], [], []
outcome="running"


def write_report(path, payload):
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise RuntimeError('Unsafe report target')
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.visitor-qa-', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(json.dumps(payload, indent=2))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists(): temporary.unlink()


def state(page):
    # Read-only telemetry is an oracle; all changes come from real browser input.
    return page.evaluate('()=>window.__mall.state')


def wait(page, expression, timeout=30000):
    page.wait_for_function('()=>(' + expression + ')', timeout=timeout)


def shot(page, name):
    page.screenshot(path=str(OUT / (name + '.png')))


def check(name, detail=None):
    results.append({'check': name, 'result': 'pass', 'detail': detail})
    print('PASS', name, flush=True)


def start(browser, width, height, touch=False):
    context = browser.new_context(viewport={'width': width, 'height': height},
                                  has_touch=touch, reduced_motion='no-preference')
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: warnings.append(m.text) if m.type in ['warning', 'error'] else None)
    print('START',width,height,'touch' if touch else 'keyboard',flush=True)
    page.set_default_timeout(90000)
    page.goto(URL,wait_until='domcontentloaded',timeout=90000)
    wait(page, 'window.__mall?.ready', 90000)
    guide = page.locator('#guide-skip')
    if guide.is_visible():
        guide.click()
    if page.locator('#header-map').is_visible() and page.locator('#mall-map').evaluate('(el)=>el.open'):
        page.locator('#header-map').click()
    assert state(page)['reducedMotion'] is False
    page.evaluate('''()=>{
      window.__visitorQA=[];let previous='';
      function observe(){
        const s=window.__mall.state,p={phase:s.character.physicalProduct?.phase,approaching:s.productApproaching,seat:s.seatPhase,focus:s.cameraFocus};
        const key=JSON.stringify(p);
        if(key!==previous){window.__visitorQA.push(p);previous=key;}
        requestAnimationFrame(observe);
      }
      observe();
    }''')
    print('READY',flush=True)
    return context, page


def store(page, zone, touch=False):
    action = 'tap' if touch else 'click'
    if not page.locator('#mall-map').evaluate('(el)=>el.open'):
        getattr(page.locator('#header-map'), action)()
    getattr(page.get_by_role('button', name=f'Go to the {zone} storefront', exact=True), action)()
    wait(page, '!window.__mall.state.paused')
    page.locator('#scene').focus()


def go(page, x, z, touch=False, tolerance=.22):
    """Navigate a clear authored route with real held keys or a real touch stick."""
    print('WALK',x,z,flush=True)
    box=page.locator('#scene').bounding_box()
    getattr(page.locator('#scene'),'tap' if touch else 'click')(position={'x':box['width']*.55,'y':box['height']*.66})
    wait(page, 'document.activeElement.id==="scene"')
    deadline = time.monotonic() + 45
    cdp = page.context.new_cdp_session(page) if touch else None
    previous = None
    while True:
        s = state(page)
        dx, dz = x-s['x'], z-s['z']
        if math.hypot(dx, dz) <= tolerance:
            break
        assert time.monotonic() < deadline, ('route stalled', x, z, s['x'], s['z'], s['mode'])
        f = -dx*math.sin(s['yaw'])-dz*math.cos(s['yaw'])
        r = dx*math.cos(s['yaw'])-dz*math.sin(s['yaw'])
        keys = (['w' if f > 0 else 's'] if abs(f) > tolerance/2 else []) + \
               (['d' if r > 0 else 'a'] if abs(r) > tolerance/2 else [])
        if touch:
            # Browser-generated touch input traverses the same pointer handlers as a finger.
            box = page.locator('#scene').bounding_box()
            cx, cy = box['x']+box['width']*.52, box['y']+box['height']*.65
            length = max(.0001, math.hypot(f, r))
            cdp.send('Input.dispatchTouchEvent', {'type':'touchStart', 'touchPoints':[{'x':cx,'y':cy,'id':1}]})
            cdp.send('Input.dispatchTouchEvent', {'type':'touchMove', 'touchPoints':[{'x':cx+40*r/length,'y':cy-40*f/length,'id':1}]})
        else:
            for key in keys: page.keyboard.down(key)
        page.wait_for_timeout(max(25,min(160,math.hypot(dx,dz)*220)))
        if touch:
            cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        else:
            for key in keys: page.keyboard.up(key)
        previous = s
    if cdp: cdp.detach()


def product_journey(page, prefix, touch=False):
    store(page, 'New Moon', touch)
    go(page, -11.21, 1, touch)
    go(page, -11.21, -6.8, touch)
    assert page.get_by_role('button',name='Pick up product',exact=True).is_disabled()
    go(page, -11.21, -7.55, touch)
    action = 'tap' if touch else 'click'
    getattr(page.get_by_role('button', name='Pick up product', exact=True), action)()
    wait(page, 'window.__mall.state.cameraFocus==="product"')
    wait(page, 'window.__mall.state.character.physicalProduct.phase==="held"')
    assert 'AUSTRALIA' in page.locator('#held-product-status').inner_text().upper()
    assert not state(page)['cameraOccluded']
    assert page.evaluate('()=>__visitorQA.some(s=>s.phase==="pickup"&&s.approaching)')
    shot(page, prefix+'-held')
    if touch:
        page.set_viewport_size({'width':844,'height':390})
        page.wait_for_timeout(200)
        a=page.locator('#held-product-status').bounding_box();b=page.locator('.scene-disclaimer').bounding_box()
        assert a['y']+a['height']<=b['y'] or b['y']+b['height']<=a['y']
        shot(page,'touch-landscape-held')
        page.set_viewport_size({'width':390,'height':844})
    check(prefix+' normal-motion pickup / side view', state(page)['cameraFocus'])
    # Leaving the shelf must preserve item identity and a usable return instruction.
    go(page, -11.21, -4.8, touch)
    assert page.locator('#held-product-status').is_visible()
    assert 'NEW MOON' in page.locator('#held-product-status').inner_text().upper()
    getattr(page.locator('#scene-cart'), action)()
    assert 'Return' in page.locator('#cart-status').inner_text()
    assert 'Australia' in page.locator('#cart-status').inner_text()
    getattr(page.locator('#bag-close'), action)()
    go(page, -13.2, -4.8, touch)
    go(page, -13.2, -7.55, touch)
    assert page.get_by_role('button', name='Return to shelf', exact=True).is_disabled()
    assert 'AUSTRALIA' in page.locator('#held-product-status').inner_text().upper()
    shot(page, prefix+'-wrong-shelf')
    go(page, -11.21, -7.55, touch)
    getattr(page.get_by_role('button', name='Return to shelf', exact=True), action)()
    wait(page, 'window.__mall.state.character.physicalProduct.phase==="empty"')
    assert page.evaluate('()=>__visitorQA.some(s=>s.phase==="return")')
    wait(page, 'window.__mall.state.cameraFocus===null')
    assert page.locator('#held-product-status').is_hidden()
    getattr(page.locator('#bag-open'),action)()
    assert 'Return Australia' not in page.locator('#cart-status').inner_text()
    getattr(page.locator('#bag-close'),action)()
    check(prefix+' persistent held status / truthful cart refusal / original-shelf return')
    # A real Inspect remains usable after returning a held item.
    getattr(page.locator('#inspect'),action)()
    page.locator('#product-dialog').wait_for(state='visible')
    getattr(page.locator('#product-close'),action)()
    page.locator('#product-dialog').wait_for(state='hidden')
    go(page,-11.21,-4.8,touch)
    shot(page,prefix+'-inspect-return')
    check(prefix+' real Inspect remains usable after shelf return')


def camera_journey(page, prefix, touch=False):
    # Real movement reaches an enclosed wall; no gameplay state is injected.
    store(page, 'New Moon', touch)
    go(page, -10, 17, touch, tolerance=.45)
    page.wait_for_timeout(300)
    s=state(page)
    distance=math.dist(s['camera']['position'],[s['x'],s['y']+1.24,s['z']])
    assert distance>=1.15 or s['cameraOccluded']
    shot(page,prefix+'-camera-compressed')
    # Walk around the terrace's 36cm side rather than through the step collider.
    go(page,-14,17,touch)
    go(page,-14,11,touch)
    wait(page, '!window.__mall.state.cameraOccluded')
    shot(page,prefix+'-camera-restored')
    check(prefix+' compressed camera / avatar restoration')


def cart_journey(page, prefix, touch=False):
    store(page, 'MILI', touch)
    action = 'tap' if touch else 'click'
    getattr(page.locator('#scene-cart'), action)()
    wait(page, 'window.__mall.state.pushing')
    before = state(page)
    go(page, 4, 2.4, touch)
    assert math.hypot(state(page)['x']-before['x'], state(page)['z']-before['z'])>.5
    assert page.locator('#scene-cart').inner_text() == 'Stow cart'
    shot(page, prefix+'-cart')
    getattr(page.locator('#scene-cart'), action)()
    wait(page, '!window.__mall.state.pushing')
    assert page.locator('#scene-cart').get_attribute('aria-pressed')=='false'
    if touch:
        page.locator('#header-map').tap()
        page.locator('#scene-cart').wait_for(state='hidden',timeout=5000)
        page.locator('#header-map').tap()
        page.locator('#scene-cart').wait_for(state='visible',timeout=5000)
    check(prefix+' direct cart entry / real movement / direct stow')


def seat_journey(page, seat, prefix, touch=False):
    zone = 'MILI' if seat['z']>0 else 'GOGO' if seat['x']>5 else 'MILI'
    store(page, zone, touch)
    if seat['z']>0:
        lane = -4 if seat['x']<0 else 4
        go(page,lane,2.4,touch)
        go(page,lane,seat['exitZ'],touch)
        go(page,seat['exitX'],seat['exitZ'],touch)
    else:
        centre=10 if seat['x']>5 else 0
        go(page,centre,-1.2,touch)
        go(page,seat['exitX'],-1.2,touch)
        # The open seat side now faces the entrance; no route behind the bench.
        go(page,seat['exitX'],seat['exitZ']+.55,touch)
    action = 'tap' if touch else 'click'
    trace_start=page.evaluate('()=>__visitorQA.length')
    getattr(page.get_by_role('button', name='Sit on '+seat['name'], exact=True), action)()
    wait(page, 'window.__mall.state.seatPhase==="seated"')
    assert state(page)['seatId']==seat['id']
    assert page.evaluate('(i)=>__visitorQA.slice(i).some(s=>s.seat==="align"||s.seat==="sit")',trace_start)
    assert page.locator('.mall-intro').is_hidden()
    shot(page,prefix+'-'+seat['id']+'-seated')
    getattr(page.get_by_role('button', name='Stand up from bench', exact=True), action)()
    wait(page, '!window.__mall.state.seated')
    check(prefix+' normal sit/stand '+seat['name'])


with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=(['--use-angle=swiftshader','--enable-unsafe-swiftshader'] if os.environ.get('GJH_SOFTWARE_RENDERING')=='1' else []))
    page=None
    try:
        if SUITE in ['all','desktop','release']:
            context,page=start(browser,1280,800)
            product_journey(page,'keyboard')
            camera_journey(page,'keyboard')
            cart_journey(page,'keyboard')
            context.close()
        if SUITE=='release':
            context,page=start(browser,1280,800)
            seat=next(s for s in state(page)['seats'] if s['name']=='MILI bench 1')
            seat_journey(page,seat,'keyboard')
            context.close()
        if SUITE in ['all','seats']:
            context,page=start(browser,1280,800)
            for seat in state(page)['seats']:
                seat_journey(page,seat,'keyboard')
            context.close()
            context,page=start(browser,768,1024)
            seat=next(s for s in state(page)['seats'] if s['name']=='MILI bench 1')
            seat_journey(page,seat,'tablet')
            context.close()
        if SUITE=='tablet':
            context,page=start(browser,768,1024)
            seat=next(s for s in state(page)['seats'] if s['name']=='MILI bench 1')
            seat_journey(page,seat,'tablet')
            context.close()
        if SUITE in ['all','restrictions']:
            context,page=start(browser,1280,800)
            store(page,'New Moon')
            go(page,-11.21,1)
            go(page,-11.21,-7.55)
            page.get_by_role('button',name='Pick up product',exact=True).click()
            wait(page,'window.__mall.state.character.physicalProduct.phase==="held"')
            # The authored front aisle clears the showcase, columns and planters.
            go(page,-11.21,1.35,tolerance=.10)
            go(page,0,1.35,tolerance=.10)
            go(page,0,-1.2)
            go(page,-3,-1.2)
            go(page,-3,-4.9)
            page.get_by_role('button',name='Sit on MILI bench 1',exact=True).click()
            assert 'Return Australia' in page.locator('#nearby-name').inner_text()
            assert not state(page)['seated']
            shot(page,'held-seat-refusal')
            check('held item seat refusal identifies original product')
            go(page,-3,-1.2)
            go(page,0,-1.2)
            go(page,0,1.35,tolerance=.10)
            go(page,-11.21,1.35,tolerance=.10)
            go(page,-11.21,-7.55)
            page.get_by_role('button',name='Return to shelf',exact=True).click()
            wait(page,'window.__mall.state.character.physicalProduct.phase==="empty"')
            page.emulate_media(reduced_motion='reduce')
            page.get_by_role('button',name='Pick up product',exact=True).click()
            wait(page,'window.__mall.state.character.physicalProduct.phase==="held"')
            assert not state(page)['productApproaching']
            page.get_by_role('button',name='Return to shelf',exact=True).click()
            wait(page,'window.__mall.state.character.physicalProduct.phase==="empty"')
            assert not state(page)['productApproaching']
            check('reduced-motion safe instant approach / pickup / return')
            context.close()
        if SUITE in ['all','touch','release']:
            context,page=start(browser,390,844,True)
            product_journey(page,'touch',True)
            camera_journey(page,'touch',True)
            cart_journey(page,'touch',True)
            seat=next(s for s in state(page)['seats'] if s['name']=='MILI bench 1')
            seat_journey(page,seat,'touch',True)
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
            page.locator('#keyboard-help summary').tap()
            shot(page,'touch-help-open')
            controls=page.locator('#controls-copy')
            cdp=page.context.new_cdp_session(page)
            for fraction in [.5,1]:
                for swipe in range(3):
                    box=controls.bounding_box();cx=box['x']+box['width']*.5;bottom=box['y']+box['height']-12
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':bottom,'id':1}]})
                    for step in range(1,9):
                        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx,'y':bottom-step*(box['height']-35)/8,'id':1}]})
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                assert controls.evaluate('(el)=>el.scrollTop')>0
                shot(page,'touch-help-scroll-'+str(fraction))
            cdp.detach()
            page.locator('#keyboard-help summary').tap()
            page.locator('#scene-cart').wait_for(state='visible',timeout=5000)
            check('touch Help scroll / close / no horizontal overflow')
            context.close()
        if SUITE=='v1':
            URL=URL.split('?')[0]+'?visitor=v1'
            context,page=start(browser,1280,800)
            assert 'v2' not in state(page)['character']['model']
            seat=next(s for s in state(page)['seats'] if s['name']=='MILI bench 1')
            seat_journey(page,seat,'legacy')
            cart_journey(page,'legacy')
            check('explicit v1 character / camera / seated / cart regression')
            context.close()
        if SUITE in ['all','layout','release']:
            for width,height in [(320,568),(768,1024)]:
                context,page=start(browser,width,height,True)
                assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth')
                a=page.locator('#keyboard-help summary').bounding_box()
                b=page.locator('#scene-cart').bounding_box()
                assert a['x']+a['width']<=b['x'] and b['x']+b['width']<=width
                shot(page,'tools-'+str(width))
                check('scene tools fit '+str(width))
                context.close()
        assert not errors,errors
        outcome="pass"
    except Exception:
        outcome="fail"
        if page is not None:
            shot(page,'failure-'+SUITE)
            s=state(page)
            print('FAILURE STATE', {key:s.get(key) for key in ['x','z','mode','nearby','cameraFocus','cameraOccluded','productApproaching']},s.get('character',{}).get('physicalProduct'),flush=True)
        raise
    finally:
        browser.close()
        write_report(OUT/('real-input-'+SUITE+'.json'),{'status':outcome,'url':URL,'input':'browser keyboard and CDP touch; read-only simulation telemetry','motion':'normal, with a separate reduced-motion case','results':results,'pageErrors':errors,'consoleMessages':sorted(set(warnings))})
