"""V11 directory redesign: actual cards, content, keyboard and fallback checks."""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'evidence'/'list-browser'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass

def run():
 OUT.mkdir(parents=True,exist_ok=True);server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/';records=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   for width,height in [(320,740),(390,844),(768,1024),(1440,900)]:
    context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000);page.locator('#guide-list').click();page.locator('#store-list').wait_for(state='visible')
    assert page.locator('.product-card').count()==4
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    ids=page.locator('.store-list [id]').evaluate_all('els=>els.map(e=>e.id)');assert ids.index('newmoon-title')<ids.index('mili-title')<ids.index('gogo-title')<ids.index('original-demo-tin-title')
    page.screenshot(path=str(OUT/f'list-top-{width}.png'));page.locator('.product-grid').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'list-products-{width}.png'))
    for button in page.locator('.product-card [data-inspect]').all():
     assert button.evaluate('e=>getComputedStyle(e).opacity')=='1'
     assert button.bounding_box()['height']>=44
     expected=button.locator('xpath=ancestor::article[1]').get_attribute('data-product-name');button.focus();page.keyboard.press('Enter');page.locator('#product-dialog').wait_for(state='visible');assert page.locator('#product-title').inner_text()==expected
     assert page.locator('#product-shop').get_attribute('href')=='https://www.gjheshop.com/'
     page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#product-dialog").open');assert button.evaluate('e=>e===document.activeElement')
    assert not errors,errors;records.append({'width':width,'threeDToList':'PASS','allFourDetailsAndFocus':'PASS','visibleCTA':'PASS','order':'PASS','overflow':False});context.close()
   for mode in ['wasm','nojs']:
    context=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=mode!='nojs');page=context.new_page()
    if mode=='wasm':page.route('**/rapier.mjs',lambda r:r.abort())
    page.goto(url)
    if mode=='wasm':page.wait_for_function('window.__sceneFailed')
    assert page.locator('#store-list').is_visible();assert page.locator('.product-card').count()==4;assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');page.screenshot(path=str(OUT/f'fallback-{mode}.png'));context.close()
   browser.close()
 finally:server.shutdown()
 (OUT/'results.json').write_text(json.dumps(records,indent=2));print(json.dumps(records))
if __name__=='__main__':run()
