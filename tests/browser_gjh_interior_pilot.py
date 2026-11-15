"""E2E of all eight pilot assets, scene contracts and independent failure paths."""
import collections
import functools
import http.server
import importlib.util
import json
import math
import os
import statistics
import tempfile
import threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'demos/corporate/gjh/v11/assets'
DEFINITIONS=json.loads((ASSETS/'interior-pilot.json').read_text())['assets']
FILES={r['kind']:r['file'] for r in DEFINITIONS}
SPEC=importlib.util.spec_from_file_location('gallery',ROOT/'scripts/build_gallery.py')
gallery=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(gallery)
OUT=ROOT/'docs/screenshots/interior-pilot-release'

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def copyfile(self,source,target):
        try:super().copyfile(source,target)
        except (BrokenPipeError,ConnectionResetError):pass


def state(page):return page.evaluate('()=>__mall.state')


def drive(page,ms=20,forward=0,right=0,yaw=0):
    return page.evaluate('o=>{__mall.setInput(o);return __mall.step(o.ms)}',{'ms':ms,'forward':forward,'right':right,'yaw':yaw})


def walk_to(page,x,z):
    for _ in range(180):
        s=state(page);dx=x-s['x'];dz=z-s['z'];length=math.hypot(dx,dz)
        if length<.07:break
        drive(page,max(17,min(100,length/2.65*1000)),forward=-dz/length,right=dx/length)
    else:raise AssertionError(('route obstructed',x,z,state(page)))
    drive(page)


def boot(context,url):
    page=context.new_page();errors=[];requests=collections.Counter()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:requests.update([Path(urlsplit(request.url).path).name]))
    page.goto(url,wait_until='domcontentloaded');page.wait_for_function('()=>window.__mall?.ready && window.__sceneReady',timeout=60000)
    if page.locator('#guide-dialog').is_visible():page.locator('#guide-start').click()
    if page.locator('.ob-ui').count():
        skip=page.locator('[data-ob-action="skip"]');skip.wait_for(state='visible');skip.click()
    page.locator('#scene').focus();drive(page)
    return page,errors,requests


def asset_states(s):return {**s['furnishings'],'shelf':s['productAssets']['shelf']}


def open_map(page):
    if page.locator('#mall-map').evaluate('(e)=>e.open'):return
    if page.locator('#header-map').is_visible():page.locator('#header-map').click()
    else:page.locator('#mall-map summary').click()


def run():
    OUT.mkdir(parents=True,exist_ok=True)
    report={'runtime':'Headless Chrome / ANGLE '+os.environ.get('GALLERY_WEBGL_BACKEND','metal'),'checks':[],
            'limitations':['No physical-phone, Safari, screen-reader, packaging-fidelity or field-performance certification.']}
    with tempfile.TemporaryDirectory(prefix='gjh-pilot-e2e-') as temp:
        output=Path(temp)/'Webpage-Design-Gallery';gallery.build(output)
        assert not (output/'models').exists(), 'Authoring sources must not be published'
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=temp));threading.Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/demos/corporate/gjh/v11/?interior=pilot'
        try:
            with sync_playwright() as p:
                browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','metal'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
                for width,height in ((390,844),(639,826),(1440,1000)):
                    context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,service_workers='block',reduced_motion='reduce')
                    page,errors,requests=boot(context,url)
                    s=state(page);assets=asset_states(s)
                    assert set(assets)==set(FILES)
                    for item in DEFINITIONS:
                        record=assets[item['kind']]
                        assert record['status']=='loaded' and record['assetId']==item['asset_id'],record
                        assert requests[item['file']]==1,(item['file'],requests)
                    assert s['furnishings']['bench']['instances']==8 and s['furnishings']['planter']['instances']==11
                    assert s['productAssets']['shelf']['instances']==4 and len(s['productAssets']['cans'])==4
                    assert s['drawCalls']<=200,s['drawCalls']
                    page.screenshot(path=str(OUT/f'integrated-{width}.png'))
                    # Kiosk collision follows the relocated model, not its former coordinates.
                    walk_to(page,-3.3,12);walk_to(page,-3.3,10.4);blocked=drive(page,1500,right=-1)
                    assert -4.6<blocked['x']<-4.3,blocked
                    walk_to(page,-3.3,11.8);walk_to(page,-5.3,11.8)
                    assert state(page)['nearby']=='mall-directory'
                    page.locator('#inspect').click();assert page.locator('#mall-map').evaluate('(e)=>e.open')
                    assert page.locator('[data-teleport]').count()==3
                    page.keyboard.press('Escape')
                    # All real portals still open; stage each interior at its approach point.
                    for zone,x in (('newmoon',-10),('mili',0),('gogo',10)):
                        open_map(page);page.locator(f'[data-teleport="{zone}"]').click();drive(page)
                        walk_to(page,x,-2.3);s=state(page)
                        assert s['zone']==zone and s['doors'][zone]>.99,s
                        page.screenshot(path=str(OUT/f'{zone}-{width}.png'))
                    page.locator('#view-toggle').click()
                    for index,sku in enumerate(('nz-425g','au-425g','sa-425g','mx-454g')):
                        trigger=page.locator(f'.product-card [data-inspect="new-moon-{sku}-front"]')
                        trigger.click();assert page.locator('#product-dialog').evaluate('(e)=>e.open')
                        assert sku in page.locator('#product-image').get_attribute('src')
                        if index==0:page.locator('#product-add').click()
                        page.keyboard.press('Escape')
                    assert '1' in page.locator('#bag-open').inner_text()
                    if not page.locator('#experience').is_visible():page.locator('#view-toggle').click()
                    page.evaluate('()=>__mall.teleport("atrium")');drive(page)
                    page.locator('#bag-open').click();page.locator('#cart-toggle').click()
                    assert state(page)['pushing']
                    # Actual physics-driven cart route through the new clear side of the plinth.
                    for waypoint in [(-3.3,12),(-3.3,9.3),(-3.6,8.8),(-4.7,7.1),(-3.6,8.8),(-3.3,9.3),(-3.3,12)]:walk_to(page,*waypoint)
                    page.screenshot(path=str(OUT/f'cart-clearance-{width}.png'))
                    page.locator('#bag-open').click();page.locator('#cart-toggle').click();page.locator('#bag-close').click()
                    assert not state(page)['pushing']
                    seats=state(page)['seats'];assert len(seats)==8
                    for i in (range(8) if width==1440 else (0,4)):
                        seat=seats[i]
                        if i<4:
                            page.evaluate('()=>__mall.teleport("atrium")');drive(page)
                            side=-3.3 if seat['x']<0 else 3.3
                            walk_to(page,side,12);walk_to(page,side,seat['exitZ'])
                        else:
                            center=0 if i<6 else 10
                            page.evaluate('zone=>__mall.teleport(zone)','mili' if i<6 else 'gogo');drive(page)
                            side=center+(-1.4 if seat['x']<center else 1.4)
                            walk_to(page,side,2.4);walk_to(page,side,seat['exitZ'])
                        walk_to(page,seat['exitX'],seat['exitZ'])
                        assert state(page)['nearby']==seat['id'],state(page)
                        page.locator('#inspect').click();drive(page,1200)
                        assert state(page)['seated'],state(page)
                        page.locator('#scene').focus();page.keyboard.press('Escape');drive(page,1200)
                        assert not state(page)['seated'],state(page)
                    # Switching views reuses the scene and never reparses pilot models.
                    before=state(page)['rendererResources']
                    for _ in range(4):
                        page.locator('#view-toggle').click();page.locator('#view-toggle').click();drive(page)
                    assert state(page)['rendererResources']==before,(before,state(page)['rendererResources'])
                    assert not errors,errors
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    for item in DEFINITIONS:assert requests[item['file']]==1,requests
                    report['checks'].append({'width':width,'assetStates':assets,'oneFetchPerAsset':'PASS','kioskCollisionAndMap':'PASS','portalsAndFourProducts':'PASS','cartRouteBothDirections':'PASS','seatsTested':8 if width==1440 else 2,'viewSwitchResourcesStable':'PASS','initialDrawCalls':s['drawCalls'],'finalResources':state(page)['rendererResources'],'errors':errors})
                    context.close();print('Normal E2E PASS',width,flush=True)
                # Every asset fails independently; the remaining seven must still load.
                for failed in DEFINITIONS:
                    context=browser.new_context(viewport={'width':639,'height':826},service_workers='block',reduced_motion='reduce')
                    context.route('**/'+failed['file'],lambda route:route.fulfill(status=404,body='Pilot fault fixture'))
                    page,errors,requests=boot(context,url);assets=asset_states(state(page))
                    for item in DEFINITIONS:assert assets[item['kind']]['status']==('fallback' if item==failed else 'loaded'),(failed,item,assets)
                    page.locator('#view-toggle').click();page.locator('.product-card [data-inspect]').first.click()
                    assert page.locator('#product-dialog').evaluate('(e)=>e.open')
                    page.keyboard.press('Escape');assert not errors,errors
                    page.screenshot(path=str(OUT/f'fallback-{failed["asset_id"]}.png'))
                    report['checks'].append({'missing':failed['asset_id'],'independentFallbackAndDirectory':'PASS'})
                    context.close();print('Fallback PASS',failed['asset_id'],flush=True)
                # Hash rejection exercises a valid HTTP response with invalid bytes.
                context=browser.new_context(service_workers='block',reduced_motion='reduce')
                context.route('**/'+FILES['coffeeTable'],lambda route:route.fulfill(status=200,body=b'not a valid model'))
                page,errors,_=boot(context,url);assert state(page)['furnishings']['coffeeTable']['status']=='fallback'
                assert not errors;report['checks'].append({'corruptHashRejected':'PASS'});context.close()
                # Parsing that completes after the deadline must dispose the abandoned model.
                context=browser.new_context(service_workers='block',reduced_motion='reduce')
                loader=(ASSETS.parent/'vendor/GLTFLoader.js').read_text()
                loader+='''
const pilotOriginalParse = GLTFLoader.prototype.parseAsync;
GLTFLoader.prototype.parseAsync = async function(...args) {
  const gltf = await pilotOriginalParse.apply(this,args);
  if (gltf.scene.getObjectByName('GJH-PUB-005')) {
    gltf.scene.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>{window.__pilotLateDisposals=(window.__pilotLateDisposals||0)+1})});
    await new Promise(resolve=>setTimeout(resolve,8500));
  }
  return gltf;
};
'''
                context.route('**/vendor/GLTFLoader.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=loader))
                page,errors,_=boot(context,url)
                assert state(page)['furnishings']['coffeeTable']['status']=='fallback'
                page.wait_for_function('()=>window.__pilotLateDisposals>0',timeout=15000)
                assert not errors,errors
                report['checks'].append({'lateParseDisposed':'PASS','geometryDisposals':page.evaluate('window.__pilotLateDisposals')});context.close()
                # No WebGL: unchanged product directory must remain usable.
                context=browser.new_context(service_workers='block');context.add_init_script("const real=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:real.call(this,type,...args)}")
                page=context.new_page();page.goto(url);page.locator('.product-card [data-inspect]').first.wait_for(state='visible')
                page.locator('.product-card [data-inspect]').first.click();assert page.locator('#product-image').is_visible()
                report['checks'].append({'noWebGLDirectory':'PASS'});context.close()
                report['browserVersion']=browser.version;browser.close()
        finally:server.shutdown();server.server_close()
    (ROOT/'docs/evidence/interior-pilot-release-e2e.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PILOT E2E PASS',len(report['checks']))

if __name__=='__main__':run()
