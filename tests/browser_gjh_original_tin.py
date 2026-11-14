"""Exercise the real original-tin GLB, controls, responsive layout and failure lifecycle."""
import functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT.parent/'evidence'/'original-tin-browser'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def copyfile(self,source,output):
  try:super().copyfile(source,output)
  except (BrokenPipeError,ConnectionResetError):pass

def snapshot(page):return page.evaluate('window.__originalTin.state')
def framed(page):
 b=snapshot(page)['projectedBounds'];assert b and min(b['minX'],b['minY'])>-.97 and max(b['maxX'],b['maxY'])<.97,b
def directory(page,url):
 # Standalone viewer must work even when the mall physics runtime cannot start.
 page.route('**/rapier.mjs',lambda route:route.abort())
 page.goto(url)
 page.locator('#original-tin-open').wait_for(state='visible')
def open_loaded(page):
 page.locator('#original-tin-open').click()
 page.wait_for_function('window.__originalTin.state.loaded')

def run():
 assert (ROOT/'demos/corporate/gjh/v11/assets/original-demo-food-tin.glb').exists(), 'Real GLB required; no loaded-test skip allowed'
 EVIDENCE.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
 results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   for width,height in [(320,740),(390,844),(768,1024),(1440,900)]:
    page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
    requests=[];page.on('request',lambda request: requests.append(request.url) if 'original-demo-food-tin.glb' in request.url else None)
    directory(page,url);assert not requests,'Model must load lazily'
    open_loaded(page);before=snapshot(page)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('#original-tin-dialog').is_visible()
    assert 'not New Moon' in page.locator('#original-tin-description').inner_text() or 'Not New Moon' in page.locator('#original-tin-description').inner_text()
    page.get_by_role('button',name='Orbit tin right',exact=True).click();assert snapshot(page)['yaw']!=before['yaw']
    page.get_by_role('button',name='Orbit tin up',exact=True).click();assert snapshot(page)['pitch']!=before['pitch']
    page.get_by_role('button',name='Zoom in',exact=True).click();assert snapshot(page)['zoom']!=before['zoom']
    page.locator('#original-tin-clip').fill('1');page.locator('#original-tin-clip').dispatch_event('input');assert snapshot(page)['amount']==1
    framed(page);page.screenshot(path=str(EVIDENCE/f'open-{width}.png'))
    page.locator('#original-tin-explode').fill('1');page.locator('#original-tin-explode').dispatch_event('input');assert snapshot(page)['amount']==1
    framed(page);page.screenshot(path=str(EVIDENCE/f'exploded-{width}.png'))
    page.locator('#original-tin-reset').click();reset=snapshot(page)
    assert abs(reset['yaw']-before['yaw'])<1e-6 and abs(reset['pitch']-before['pitch'])<1e-6 and reset['amount']==0,reset
    assert reset['zoom']==before['zoom'],reset
    frames=reset['frames'];page.wait_for_timeout(250);assert snapshot(page)['frames']==frames,'No continuous render loop'
    page.locator('#original-tin-close').focus();page.keyboard.press('Shift+Tab');assert page.locator('#original-tin-dialog :focus').count()==1
    page.keyboard.press('Escape');page.wait_for_function('window.__originalTin.state.liveContexts===0');assert not page.locator('#original-tin-dialog').is_visible();assert snapshot(page)['liveContexts']==0
    assert page.locator('#original-tin-open').evaluate('el=>el===document.activeElement')
    open_loaded(page);assert snapshot(page)['amount']==0
    page.keyboard.press('Escape');page.wait_for_function('window.__originalTin.state.liveContexts===0')
    # Existing branded detail stays intact and separately labelled.
    page.locator('[data-inspect="new-moon-nz-425g-front"]').click();assert page.locator('#product-image').get_attribute('src').endswith('new-moon-nz-425g-front.jpg')
    assert page.locator('#product-shop').get_attribute('href')=='https://www.gjheshop.com/'
    page.keyboard.press('Escape')
    results.append({'width':width,'controls':'PASS','lifecycle':'PASS','state':reset});page.close()
   page=browser.new_page();directory(page,url)
   page.route('**/original-demo-food-tin.glb',lambda route:route.abort())
   page.locator('#original-tin-open').click();page.wait_for_function("document.querySelector('#original-tin-status').textContent.toLowerCase().includes('unavailable')")
   assert snapshot(page)['liveContexts']==0
   page.keyboard.press('Escape');page.wait_for_function('window.__originalTin.state.liveContexts===0');page.unroute('**/original-demo-food-tin.glb');open_loaded(page);page.keyboard.press('Escape');page.close()
   page=browser.new_page();page.add_init_script("""const original=window.fetch;window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0]).includes('original-demo-food-tin.glb')) {const bytes=await response.arrayBuffer();await new Promise(r=>setTimeout(r,500));return new Response(bytes,{status:200});}return response;}""")
   directory(page,url);page.locator('#original-tin-open').click();page.wait_for_timeout(100);page.keyboard.press('Escape');page.wait_for_timeout(700)
   assert snapshot(page)['liveContexts']==0 and not snapshot(page)['loaded'];open_loaded(page);page.keyboard.press('Escape');page.close()
   results.append({'failureRecovery':'PASS','closeDuringLoad':'PASS'})
   browser.close()
 finally:server.shutdown()
 (EVIDENCE/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
if __name__=='__main__':run()
