"""Real-browser nonmodal guidance, wayfinding, replay and persistence coverage."""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'evidence'/'guide-browser'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass

def ready(page,url):
 page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000)

def guide(page):page.locator('#guide-card').wait_for(state='visible')
def closed(page):page.locator('#guide-card').wait_for(state='hidden')
def state(page):return page.evaluate('window.__mall.state')
def reopen(page):
 page.locator('#keyboard-help').evaluate('el=>el.open=true');page.locator('#guide-reopen').click();guide(page)

def run():
 OUT.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
 records=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[f'--use-angle={os.environ.get("GALLERY_WEBGL_BACKEND","swiftshader")}', '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   for width,height,touch in [(320,740,True),(390,844,True),(768,1024,True),(1440,900,False),(844,390,True)]:
    context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch,reduced_motion='reduce');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    ready(page,url);guide(page)
    card=page.locator('#guide-card')
    assert card.evaluate('e=>e.tagName==="SECTION" && e.getAttribute("role")==="region" && e.getAttribute("aria-modal")!=="true"')
    assert page.locator('#guide-count').inner_text()=='1/3'
    assert page.locator('#guide-back').is_disabled()
    assert ('joystick' if touch else 'WASD') in page.locator('#guide-step-copy').inner_text()
    assert not state(page)['paused']
    assert not page.locator('#mall-map').evaluate('e=>e.open')
    assert page.locator('#header-map').is_visible()
    page.locator('#guide-next').click();assert page.locator('#guide-count').inner_text()=='2/3'
    page.locator('#guide-back').click();assert page.locator('#guide-count').inner_text()=='1/3'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    small=card.locator('button').evaluate_all('els=>els.filter(e=>{let r=e.getBoundingClientRect();return r.width<44||r.height<44}).map(e=>e.id)');assert not small,small
    page.screenshot(path=str(OUT/f'guide-{width}x{height}.png'))
    # The card does not block the actual map entry or directory switch.
    page.locator('#header-map').click();closed(page)
    assert page.locator('#mall-map').evaluate('el=>el.open')
    page.wait_for_function('document.activeElement.matches("[data-teleport]")')
    page.locator('[data-teleport="newmoon"]').click();assert state(page)['x']<-5
    if page.locator('#mall-map').evaluate('e=>e.open'):page.locator('#header-map').click()
    guide(page);page.locator('#guide-skip').click();closed(page)
    page.locator('#scene').focus()
    assert page.evaluate('localStorage.getItem("gjh-v11-tutorial-v1")')=='dismissed'
    page.locator('#view-toggle').click()
    assert page.locator('#store-list').is_visible() and page.locator('.product-card').count()==4
    assert page.evaluate('document.activeElement.id')=='list-title'
    page.locator('#view-toggle').click();closed(page)
    page.reload();page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000);closed(page)
    reopen(page);assert page.locator('#guide-count').inner_text()=='1/3'
    for _ in range(3):page.locator('#guide-next').click()
    closed(page);assert page.evaluate('localStorage.getItem("gjh-v11-tutorial-v1")')=='completed'
    page.reload();page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000);closed(page)
    page.locator('#rail-guide').click();guide(page)
    assert page.locator('#guide-count').inner_text()=='1/3'
    page.locator('#guide-skip').click();closed(page)
    assert not errors,errors
    records.append({'viewport':[width,height],'touch':touch,'nonmodalFirstUse':'PASS','manualStepsAndBack':'PASS','mapDirectory':'PASS','helpAndRailReplay':'PASS','dismissedAndCompletedPersistence':'PASS','errors':errors});context.close()
   context=browser.new_context(viewport={'width':390,'height':844});context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage disabled')}})")
   page=context.new_page();ready(page,url);guide(page);page.locator('#guide-skip').click();closed(page);page.locator('#scene').focus()
   page.locator('#view-toggle').click();page.locator('#view-toggle').click();closed(page);context.close()
   for failure in ['wasm','nojs']:
    context=browser.new_context(java_script_enabled=failure!='nojs');page=context.new_page()
    if failure=='wasm':page.route('**/rapier.mjs',lambda r:r.abort())
    page.goto(url)
    if failure=='wasm':page.wait_for_function('window.__sceneFailed')
    assert page.locator('#store-list').is_visible() and not page.locator('#guide-card').is_visible()
    assert page.locator('.product-card').count()==4;context.close()
   records.append({'storageUnavailable':'PASS','WASMAndNoJSDirectory':'PASS'});browser.close()
 finally:server.shutdown()
 (OUT/'results.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(records,indent=2))
if __name__=='__main__':run()
