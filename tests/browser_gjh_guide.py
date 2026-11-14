"""Real-browser first-use guidance, wayfinding, focus and storage-failure coverage."""
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
 page.goto(url);page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000)

def guide(page):page.locator('#guide-dialog').wait_for(state='visible')
def closed(page):page.wait_for_function('!document.querySelector("#guide-dialog").open')
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
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   for width,height,touch in [(320,740,True),(390,844,True),(768,1024,True),(1440,900,False),(844,390,True)]:
    context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch,reduced_motion='reduce');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    ready(page,url);guide(page)
    assert page.locator('#guide-dialog :focus').count()==1
    page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.id')=='guide-list'
    page.keyboard.press('Tab');assert page.evaluate('document.activeElement.id')=='guide-close'
    assert page.locator('[data-guide-touch]').is_visible()==touch
    assert page.locator('[data-guide-desktop]').is_visible()!=touch
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    small=page.locator('#guide-dialog button').evaluate_all('els=>els.filter(e=>{let r=e.getBoundingClientRect();return r.width<44||r.height<44}).map(e=>e.id)');assert not small,small
    before=state(page);page.keyboard.press('w');page.evaluate('__mall.setInput({forward:1});__mall.step(500)');after=state(page);assert (before['x'],before['z'])==(after['x'],after['z'])
    page.evaluate('__mall.setInput(null)')
    page.screenshot(path=str(OUT/f'guide-{width}x{height}.png'))
    # Explicit wayfinding action uses existing map; no automatic store teleport.
    page.locator('#guide-map').click();closed(page);page.wait_for_function('document.activeElement.matches("[data-teleport]")')
    assert page.locator('#mall-map').evaluate('el=>el.open')
    assert not page.locator('#keyboard-help').evaluate('el=>el.open')
    page.locator('[data-teleport="newmoon"]').click();assert state(page)['x']<-5
    reopen(page);page.locator('#guide-list').click();closed(page)
    page.locator('#store-list').wait_for(state='visible')
    assert page.locator('#store-list').is_visible() and page.locator('.product-card').count()==4
    assert page.evaluate('document.activeElement.id')=='list-title'
    page.locator('#view-toggle').click();assert not page.locator('#guide-dialog').is_visible()
    reopen(page);page.keyboard.press('Escape');closed(page);page.wait_for_function('document.activeElement.id==="guide-reopen"')
    page.reload();page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000);assert not page.locator('#guide-dialog').is_visible()
    assert not errors,errors
    records.append({'viewport':[width,height],'touch':touch,'firstUse':'PASS','pause':'PASS','mapDirectoryFocus':'PASS','reopenEscape':'PASS','sessionMemory':'PASS','errors':errors});context.close()
   context=browser.new_context(viewport={'width':390,'height':844});context.add_init_script("Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Storage disabled')}})")
   page=context.new_page();ready(page,url);guide(page);page.locator('#guide-start').click();closed(page);page.wait_for_function('document.activeElement.id==="scene"')
   page.locator('#view-toggle').click();page.locator('#view-toggle').click();assert not page.locator('#guide-dialog').is_visible();context.close()
   for failure in ['wasm','nojs']:
    context=browser.new_context(java_script_enabled=failure!='nojs');page=context.new_page()
    if failure=='wasm':page.route('**/rapier.mjs',lambda r:r.abort())
    page.goto(url)
    if failure=='wasm':page.wait_for_function('window.__sceneFailed')
    assert page.locator('#store-list').is_visible() and not page.locator('#guide-dialog').is_visible()
    assert page.locator('.product-card').count()==4;context.close()
   records.append({'storageUnavailable':'PASS','WASMAndNoJSDirectory':'PASS'});browser.close()
 finally:server.shutdown()
 (OUT/'results.json').write_text(json.dumps(records,indent=2)+'\n');print(json.dumps(records,indent=2))
if __name__=='__main__':run()
