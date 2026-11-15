"""Source-pinned mall amenities: real placement, interactions, collisions and fallbacks."""
import collections,functools,http.server,json,os,threading,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_v11 import QuietHandler,drive,state
from gjh_startup_test_helpers import use_individual_assets
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'evidence/mall-amenities'
FILES={'desk':'mall-service-desk.glb','signs':'mall-wayfinding-ceiling-sign.glb','showcase':'mall-glass-showcase.glb'}
def ready(page,url):
 page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.__mall?.ready&&window.__sceneReady',timeout=90000)
 page.locator('#guide-start').click();page.wait_for_function('!document.querySelector("#guide-dialog").open&&!__mall.state.paused')
 page.locator('[data-ob-action=skip]').click()
 page.evaluate('__mall.setInput({});__mall.step(17)')
def approach(page,kind):
 page.evaluate('__mall.setInput({});__mall.teleport("atrium")')
 if kind=='desk':drive(page,400,forward=1);drive(page,3950,right=-1);drive(page,1500,forward=1)
 elif kind=='signs':page.evaluate('__mall.teleport("newmoon")');drive(page,1000,forward=-1);drive(page,1850,right=1)
 else:page.evaluate('__mall.teleport("newmoon")');drive(page,800,right=1)
 expected={'desk':'service-desk','signs':'wayfinding-west','showcase':'featured-showcase'}[kind]
 assert state(page)['nearby']==expected,{key:state(page)[key] for key in ['x','z','nearby','paused']}
 page.locator('#scene').focus()
 if page.viewport_size['width']<1000:page.locator('#inspect').click()
 else:page.keyboard.press('f')
 page.locator('#amenity-dialog').wait_for(state='visible')
def close(page):
 page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#amenity-dialog").open&&!__mall.state.paused')
def run():
 OUT.mkdir(parents=True,exist_ok=True)
 receipts=json.loads((ROOT/'demos/corporate/gjh/v11/assets/amenities-sources.json').read_text())
 for record in receipts['assets']:
  data=(ROOT/'demos/corporate/gjh/v11/assets'/record['file']).read_bytes()
  assert hashlib.sha256(data).hexdigest()==record['sha256'] and len(data)==record['bytes']
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/index.html?visitor=v1';results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[f'--use-angle={os.environ.get("GALLERY_WEBGL_BACKEND","swiftshader")}','--enable-unsafe-swiftshader'])
   for width,height in [(1440,900),(768,1024),(390,844)]:
    c=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce');page=c.new_page();errors=[];counts=collections.Counter()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:counts.update([Path(request.url.split('?')[0]).name]))
    ready(page,url);s=state(page)
    if width==390:
     assert page.locator('.ob-help:visible').count()==0
     assert page.locator('#keyboard-help>summary').is_visible()
    assert s['amenities']['displayedProducts']==4,s['amenities']
    assert counts['startup-assets.pack']==1,counts
    for kind,file in FILES.items():assert s['amenities'][kind]['status']=='loaded' and counts[file]==0,s['amenities']
    assert s['amenities']['signs']['instances']==2
    assert s['amenities']['showcase']['doorPose']=='closed'
    assert s['drawCalls']<=200,s['drawCalls']
    page.screenshot(path=str(OUT/f'atrium-{width}.png'))
    approach(page,'desk');before=state(page)
    assert page.locator('#amenity-dialog .ob-primary').count()==0
    assert 'Get help' in page.locator('#inspect').get_attribute('aria-label')
    assert page.evaluate('document.activeElement.id')=='amenity-dialog-title'
    page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.dataset.objectAction')=='help'
    page.keyboard.press('Tab');assert page.locator('#amenity-dialog .ob-close').evaluate('e=>e===document.activeElement')
    page.evaluate('__mall.setInput({forward:1});__mall.step(200)');assert state(page)['z']==before['z']
    page.screenshot(path=str(OUT/f'service-desk-{width}.png'))
    page.locator('[data-object-action=help]').click();page.locator('#guide-dialog').wait_for(state='visible');page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#guide-dialog").open&&!__mall.state.paused')
    # The model has a solid conservative footprint, with an approachable guest side.
    approach(page,'desk');close(page);drive(page,17);page.screenshot(path=str(OUT/f'desk-model-{width}.png'));stopped=drive(page,1800,forward=1);assert stopped['z']>=6.5,stopped
    approach(page,'signs');assert 'Choose a store' in page.locator('#inspect').get_attribute('aria-label');page.screenshot(path=str(OUT/f'wayfinding-{width}.png'))
    page.locator('[data-object-action=gogo]').click();page.wait_for_function('Math.abs(__mall.state.x-10)<.05')
    approach(page,'showcase');page.screenshot(path=str(OUT/f'showcase-{width}.png'))
    assert page.locator('#amenity-dialog [data-object-action]').count()==4
    assert page.locator('#amenity-dialog .ob-primary').count()==0
    assert page.locator('#amenity-dialog img').count()==4
    page.wait_for_function('[...document.querySelectorAll("#amenity-dialog img")].every(image=>image.complete&&image.naturalWidth>0)')
    assert 'New Zealand abalone' in page.locator('#amenity-dialog [data-object-action]').first.inner_text()
    page.locator('#amenity-dialog [data-object-action]').first.click();page.locator('#product-dialog').wait_for(state='visible')
    assert 'New Zealand' in page.locator('#product-title').inner_text()
    page.locator('#product-add').click();assert '1' in page.locator('#bag-open').inner_text()
    page.locator('#product-close').click();page.wait_for_function('!document.querySelector("#product-dialog").open')
    approach(page,'showcase');close(page);drive(page,17);page.screenshot(path=str(OUT/f'showcase-model-{width}.png'));stopped=drive(page,1500,right=1);assert stopped['x']<=-7.65,stopped
    page.locator('#view-toggle').click();page.locator('[data-amenity=service-desk]').click();page.locator('[data-object-action=newmoon]').click();page.wait_for_function('document.activeElement.id==="newmoon-title"')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-amenity=featured-showcase]').click();panel=page.locator('#amenity-dialog')
    page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#amenity-dialog").open')
    page.wait_for_function('document.activeElement.dataset.amenity==="featured-showcase"')

    assert not errors,errors
    results.append({'viewport':[width,height],'assets':s['amenities'],'drawCalls':s['drawCalls'],'singleFetch':'PASS','serviceHelpFocusPause':'PASS','signNavigation':'PASS','showcaseProductBag':'PASS','collisions':'PASS','directoryActions':'PASS','errors':errors});c.close()
   for width,height,locale,theme in [(320,480,'en','light'),(844,390,'zh-CN','dark')]:
    c=browser.new_context(viewport={'width':width,'height':height},has_touch=True,reduced_motion='reduce')
    c.add_init_script(f'localStorage.setItem("ob:gjh-v11:preferences:v1",JSON.stringify({json.dumps({"locale":locale,"theme":theme})}))')
    page=c.new_page();ready(page,url);page.locator('#view-toggle').click();page.locator('[data-amenity=featured-showcase]').click();panel=page.locator('#amenity-dialog')
    assert panel.get_attribute('lang')==locale and panel.get_attribute('data-ob-theme')==theme
    box=panel.bounding_box();assert box['width']<=560 and box['height']<=height-32 and box['x']>=15 and box['y']>=15,box
    assert panel.locator('img').count()==4
    if locale=='zh-CN':
     assert '新西兰鲍鱼' in panel.inner_text()
     assert '新西兰鲍鱼' in panel.locator('[data-object-action]').first.get_attribute('aria-label')
     assert 'New Moon Premium' in panel.locator('[data-object-action]').first.get_attribute('aria-label')
    assert panel.evaluate('e=>e.scrollHeight>e.clientHeight')
    page.screenshot(path=str(OUT/f'short-panel-top-{width}.png'))
    panel.evaluate('e=>e.scrollTop=(e.scrollHeight-e.clientHeight)/2')
    assert panel.locator('.ob-close').evaluate('e=>{const r=e.getBoundingClientRect(),d=e.closest("dialog").getBoundingClientRect();return r.top>=d.top&&r.bottom<=d.bottom}')
    panel.evaluate('e=>e.scrollTop=e.scrollHeight');page.screenshot(path=str(OUT/f'short-panel-bottom-{width}.png'))
    assert panel.locator('.ob-close').evaluate('e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}')
    panel.locator('.ob-close').click();page.wait_for_function('!document.querySelector("#amenity-dialog").open')
    page.wait_for_function('document.activeElement.dataset.amenity==="featured-showcase"')
    page.locator('[data-amenity=featured-showcase]').click();assert panel.evaluate('e=>e.scrollTop')==0
    page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#amenity-dialog").open')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    results.append({'viewport':[width,height],'theme':theme,'locale':locale,'shortPanelScrollStickyCloseReopen':'PASS','focusRestore':'PASS'});c.close()
   for kind,file in FILES.items():
    c=browser.new_context(viewport={'width':390,'height':844},has_touch=True);page=c.new_page();use_individual_assets(page);page.route(f'**/{file}',lambda route:route.abort())
    ready(page,url);s=state(page)
    if width==390:
     assert page.locator('.ob-help:visible').count()==0
     assert page.locator('#keyboard-help>summary').is_visible()
    assert s['amenities'][kind]['status']=='fallback',s['amenities']
    assert all(s['amenities'][other]['status']=='loaded' for other in FILES if other!=kind)
    approach(page,kind);assert page.locator('#amenity-dialog').is_visible()
    results.append({'missing':kind,'independentFallback':'PASS','interactionStillAvailable':'PASS'});c.close()
   c=browser.new_context();page=c.new_page();use_individual_assets(page);data=bytearray((ROOT/'demos/corporate/gjh/v11/assets'/FILES['desk']).read_bytes());data[-1]^=1
   page.route(f'**/{FILES["desk"]}',lambda route:route.fulfill(status=200,body=bytes(data),content_type='model/gltf-binary'))
   ready(page,url);assert state(page)['amenities']['desk']['reason']=='hash-mismatch';results.append({'corruptedDeskHashRejected':'PASS'});c.close()
   browser.close()
 finally:server.shutdown()
 (OUT/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
if __name__=='__main__':run()
