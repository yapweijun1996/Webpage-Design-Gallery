"""Matched expanded-mall material screenshots, resources, and fallback."""
from gjh_startup_test_helpers import mall_entry_url, wait_for_quality
import argparse,functools,http.server,json,os,threading,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet
ROOT=Path(__file__).resolve().parents[1]
def run():
 p=argparse.ArgumentParser();p.add_argument('--screens',type=Path,required=True);p.add_argument('--fallback',action='store_true');args=p.parse_args();args.screens.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   print('Browser:',browser.version,flush=True)
   for w,h in [(320,700),(390,844),(768,1024),(844,390),(1440,900)]:
    c=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=2,has_touch=w<1000,reduced_motion='reduce',service_workers='block')
    c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    page=c.new_page();errors=[];console=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda message:console.append(f'{message.type}: {message.text}') if message.type in ('warning','error') else None)
    started=time.monotonic();page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000);ready=round(time.monotonic()-started,3)
    assert page.evaluate('window.__sceneReady===true') and not errors,errors
    page.wait_for_load_state('networkidle')
    if w==390:
     page.locator('#keyboard-help>summary').click()
     for tier in ['low','balanced','detailed','auto']:
      page.locator('#graphics-quality').select_option(tier)
      wait_for_quality(page,tier)
      if tier!='auto':assert page.evaluate('__mall.state.graphics.quality.tier')==tier
     page.locator('#keyboard-help>summary').click()
    def capture(label):
     page.evaluate('__mall.setInput({forward:0,yaw:0});__mall.step(100)')
     state=page.evaluate('''()=>{const s=__mall.state;return {x:s.x,y:s.y,z:s.z,draw:s.drawCalls,triangles:s.renderTriangles,resources:s.rendererResources,quality:s.graphics.quality}}''')
     page.screenshot(path=str(args.screens/f'{label}-{w}.png'))
     return state
    points={'entry':capture('entry')}
    assert page.evaluate('__mall.teleport("newmoon")');points['store']=capture('store')
    assert page.evaluate('__mall.teleport("atrium")');points['courtyard']=capture('courtyard')
    resources=page.evaluate('''()=>{const a=performance.getEntriesByType('resource');return {requests:a.length,encoded:a.reduce((n,x)=>n+x.encodedBodySize,0),decoded:a.reduce((n,x)=>n+x.decodedBodySize,0)}}''')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    fixtureWarnings=[item for item in console if 'Service Worker registration blocked by Playwright' in item]
    unexpectedConsole=[item for item in console if item not in fixtureWarnings]
    assert not unexpectedConsole,unexpectedConsole
    print(json.dumps({'viewport':[w,h],'readySeconds':ready,'points':points,'network':resources,'pageErrors':errors,'consoleWarningsOrErrors':unexpectedConsole,'serviceWorkerBlockedByFixture':len(fixtureWarnings)}),flush=True);c.close()
   if args.fallback:
    c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
    c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed');window.__materialFailures=0;const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){if(type==='2d'&&this.width===256&&this.height===256){window.__materialFailures++;return null}return old.call(this,type,...rest)}")
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
    assert page.evaluate('window.__sceneReady===true') and not errors,errors
    assert page.evaluate('window.__materialFailures > 0')
    assert page.evaluate('__mall.teleport("newmoon")');page.locator('#view-toggle').click();assert page.locator('[data-store]').count()==3
    print('PASS simulated procedural texture creation failure retains scene and directory',flush=True);c.close()
    c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
    c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    page=c.new_page();errors=[];blocked=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def block(route):
     blocked.append(route.request.url);route.abort()
    page.route('**/natural-materials.js',block)
    page.goto(mall_entry_url(url));page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
    assert page.evaluate('window.__sceneReady===true') and not errors and blocked,(errors,blocked)
    assert page.evaluate('__mall.teleport("mili")');page.locator('#view-toggle').click();assert page.locator('[data-store]').count()==3
    print('PASS missing optional texture module retains scene and directory',flush=True);c.close()
   browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
