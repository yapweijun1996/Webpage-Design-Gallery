"""Test the real v2 GLB, contact solver, shelf reservation and LOD in Chrome."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('GJH_V2_URL','http://127.0.0.1:18769/demos/corporate/gjh/v11/?visitor=v2'))
    page.wait_for_function('window.__mall?.ready',timeout=60000)
    result=page.evaluate((ROOT/'tests/visitor-v2-runtime.js').read_text())
    assert not errors, errors
    print(json.dumps({'runtime':result,'errors':errors},indent=2))
    page.emulate_media(reduced_motion='reduce')
    reduced=page.evaluate((ROOT/'tests/visitor-v2-runtime.js').read_text())
    print(json.dumps({'reducedMotion':reduced},indent=2))
    assert not errors, errors
    page.close()
    for width,height in ([] if os.environ.get('GJH_MODULE_ONLY')=='1' else [(390,844),(1280,800)]):
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(os.environ.get('GJH_V2_URL','http://127.0.0.1:18769/demos/corporate/gjh/v11/?visitor=v2'))
        page.wait_for_function('window.__mall?.ready',timeout=60000)
        start=page.get_by_role('button',name='Start exploring',exact=True)
        if start.is_visible():
            start.click()
            page.wait_for_function("!document.querySelector('#guide-dialog').open")
        skip=page.get_by_role('button',name='Skip tutorial',exact=True)
        if skip.is_visible(): skip.click()
        if page.locator('#mall-map').evaluate('(n)=>n.open') and width<650:
            page.locator('#header-map').click()
        page.locator('#scene').focus()
        page.wait_for_function("document.activeElement.id==='scene'")
        resumed_at=page.evaluate('__mall.state.frames')
        page.wait_for_function('(frames)=>__mall.state.frames>frames',arg=resumed_at,timeout=60000)
        page.evaluate("""()=>{__mall.teleport('newmoon');__mall.setInput({forward:1});__mall.step(3900);__mall.setInput({forward:0});}""")
        print('Approach',page.evaluate('({x:__mall.state.x,z:__mall.state.z,nearby:__mall.state.nearby,guide:document.querySelector("#guide-dialog").open,map:document.querySelector("#mall-map").open})'),flush=True)
        page.get_by_role('button',name='Pick up product',exact=True).click()
        page.evaluate('__mall.step(1000)')
        assert page.evaluate('__mall.state.character.physicalProduct.phase')=='held'
        rect=page.get_by_role('button',name='Return to shelf',exact=True).bounding_box()
        assert rect['width']>=44 and rect['x']>=0 and rect['x']+rect['width']<=width
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(ROOT/f'docs/evidence/visitor-v2/held-{width}.png'))
        page.get_by_role('button',name='Return to shelf',exact=True).click()
        page.evaluate('__mall.step(1000)')
        assert page.evaluate('__mall.state.character.physicalProduct.phase')=='empty'
        print(f'PASS physical pickup and return UI {width}x{height}',flush=True)
        page.evaluate("""()=>{__mall.teleport('atrium');__mall.setInput({right:-1});__mall.step(1400);__mall.setInput({forward:1});__mall.step(1400);__mall.setInput({right:-1});__mall.step(750);__mall.setInput({forward:0});__mall.step(20);}""")
        assert page.evaluate('__mall.state.nearby')=='courtyard-seat'
        page.locator('#inspect').click()
        page.evaluate('__mall.step(40)')
        assert page.evaluate('__mall.state.seated')
        assert page.evaluate('Math.max(...__mall.state.character.contacts.feet)<.005')
        page.locator('#inspect').click()
        page.evaluate('__mall.step(100)')
        assert not page.evaluate('__mall.state.seated')
        print(f'PASS actual seat and stand UI {width}x{height}',flush=True)
        page.evaluate("__mall.teleport('atrium');__mall.setInput({forward:0});__mall.step(20)")
        page.locator('#bag-open').click()
        page.locator('#cart-toggle').click()
        assert page.evaluate('__mall.state.pushing')
        page.evaluate("__mall.setInput({forward:1});__mall.step(500);__mall.setInput({forward:0});__mall.step(40)")
        assert page.evaluate('Math.max(...__mall.state.character.contacts.hands)<.005')
        page.locator('#bag-open').click()
        page.locator('#cart-toggle').click()
        page.locator('#bag-close').click()
        assert not page.evaluate('__mall.state.pushing')
        print(f'PASS actual cart UI {width}x{height}',flush=True)
        page.close()
    assert not errors, errors
    browser.close()
