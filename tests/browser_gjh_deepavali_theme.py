"""Real Deepavali/Everyday/Lunar New Year/Christmas transitions, clearances and failure recovery."""
from gjh_startup_test_helpers import mall_entry_url, set_off_season_date
import argparse,functools,http.server,io,json,os,threading
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet,move
ROOT=Path(__file__).resolve().parents[1]
KEY='gjh-v11-mall-theme-v1'
def run():
 parser=argparse.ArgumentParser();parser.add_argument('--screens',type=Path);args=parser.parse_args()
 if args.screens:args.screens.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
 def fresh(browser,w=390,h=844,init=''):
  c=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=2,has_touch=w<1000,reduced_motion='reduce',service_workers='block')
  c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed');"+init)
  p=c.new_page();set_off_season_date(p);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));return c,p,errors
 def ready(p,query=''):
  p.goto(mall_entry_url(url+query));p.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000);assert p.evaluate('window.__sceneReady===true')
 def open_theme(p):
  p.locator('#mall-theme-open').click();assert p.locator('#mall-theme-dialog').is_visible()
 def choose(p,ident):
  p.locator('#mall-theme-select').select_option(ident);p.locator('#mall-theme-apply').click()
  p.wait_for_function('id=>__mall.state.theme?.active===id',arg=ident,timeout=30000)
 def close(p):p.keyboard.press('Escape');p.wait_for_function('!document.querySelector("#mall-theme-dialog").open')
 def switch(p,ident):open_theme(p);choose(p,ident);close(p);p.evaluate('__mall.setInput({});__mall.step(100)')
 def state(p):return p.evaluate('''()=>{const s=__mall.state;return {theme:s.theme,decor:s.themeDecorations,x:s.x,y:s.y,z:s.z,children:s.graphics.sceneChildren,resources:s.rendererResources}}''')
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   print('Browser:',browser.version,flush=True)
   for w,h in [(320,700),(390,844),(768,1024),(844,390),(1440,900)]:
    c,p,errors=fresh(browser,w,h);ready(p);p.wait_for_load_state('networkidle');p.evaluate('__mall.setInput({});__mall.step(100)')
    assert state(p)['theme']['active']=='everyday' and state(p)['decor']==[]
    before=Image.open(io.BytesIO(p.locator('#scene').screenshot())).convert('RGB')
    switch(p,'deepavali');active=state(p);assert active['decor']==['deepavali'] and p.evaluate('(k)=>localStorage.getItem(k)',KEY)=='deepavali'
    after=Image.open(io.BytesIO(p.locator('#scene').screenshot())).convert('RGB')
    visual=sum(ImageStat.Stat(ImageChops.difference(before,after)).mean)/3;assert visual>1,visual
    if args.screens:p.screenshot(path=str(args.screens/f'deepavali-{w}.png'))
    if w==1440 and args.screens:
     move(p,4,34.5,2.65);p.evaluate('__mall.setInput({forward:0,yaw:0});__mall.step(100)');p.screenshot(path=str(args.screens/'deepavali-event-1440.png'))
    if w==390:
     p.reload();p.wait_for_function('window.__sceneReady',timeout=90000);assert state(p)['theme']['active']=='deepavali' and state(p)['decor']==['deepavali']
    switch(p,'lunar-new-year');assert state(p)['decor']==['lunar-new-year']
    switch(p,'deepavali');assert state(p)['decor']==['deepavali']
    switch(p,'christmas');assert state(p)['decor']==['christmas']
    switch(p,'deepavali');assert state(p)['decor']==['deepavali']
    switch(p,'everyday');assert state(p)['decor']==[] and p.evaluate('(k)=>localStorage.getItem(k)',KEY)=='everyday'
    assert not errors,errors
    print(f'PASS {w}x{h}: visible Deepavali scene, local persistence and return to Everyday (pixel difference {visual:.2f})',flush=True);c.close()
   # Repeated real replacements and same-theme applications must not grow resources.
   c,p,errors=fresh(browser,1440,900);ready(p);p.wait_for_load_state('networkidle')
   switch(p,'deepavali');first=state(p);open_theme(p);choose(p,'deepavali');close(p);p.evaluate('__mall.setInput({});__mall.step(100)')
   assert state(p)['decor']==['deepavali'] and state(p)['children']==first['children'] and state(p)['resources']==first['resources']
   switch(p,'everyday');base=state(p)
   for _ in range(3):switch(p,'lunar-new-year');switch(p,'christmas');switch(p,'deepavali');switch(p,'everyday')
   end=state(p);assert end['decor']==[] and end['children']==base['children'] and end['resources']==base['resources'],(base,end)
   print('PASS repeated switch-back and reapply dispose decorations without resource growth',flush=True);c.close()
   # The optional seasonal module may fail and then succeed on retry, without reload.
   c,p,errors=fresh(browser);ready(p);blocked=[];requests=[]
   p.on('request',lambda r:requests.append(r.url) if 'deepavali.js' in r.url else None)
   def abort(route):blocked.append(route.request.url);route.abort()
   p.route('**/deepavali.js*',abort);open_theme(p);p.locator('#mall-theme-select').select_option('deepavali');p.locator('#mall-theme-apply').click()
   p.wait_for_function('document.querySelector("#mall-theme-status").textContent.includes("could not be applied")');assert blocked and state(p)['theme']['active']=='everyday' and state(p)['decor']==[]
   p.unroute('**/deepavali.js*');choose(p,'deepavali');assert len(requests)>=2 and 'retry=' in requests[-1];close(p)
   assert state(p)['decor']==['deepavali'] and not errors,errors
   print('PASS missing seasonal module keeps Everyday and succeeds on same-page retry',flush=True);c.close()
   # A saved seasonal preference must not prevent startup when its pack is unavailable.
   c,p,errors=fresh(browser,init=f"localStorage.setItem('{KEY}','deepavali');")
   p.route('**/deepavali.js*',lambda route:route.abort());ready(p)
   assert state(p)['theme']['active']=='everyday' and state(p)['decor']==[]
   p.unroute('**/deepavali.js*');switch(p,'deepavali');assert state(p)['decor']==['deepavali'] and not errors
   print('PASS unavailable saved seasonal pack falls back and retries on the same page',flush=True);c.close()
   # Failure of either canvas disposes partial resources and keeps Christmas active.
   c,p,errors=fresh(browser);ready(p);p.wait_for_load_state('networkidle');switch(p,'christmas');base=state(p)
   open_theme(p)
   for height in (1024,128):
    p.evaluate("height=>{window.__ctxOriginal=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(t==='2d'&&this.width===1024&&this.height===height)return null;return __ctxOriginal.call(this,t,...a)}}",height)
    p.locator('#mall-theme-select').select_option('deepavali');p.locator('#mall-theme-apply').click()
    p.wait_for_function('document.querySelector("#mall-theme-status").textContent.includes("could not be applied")');assert state(p)['theme']['active']=='christmas' and state(p)['decor']==['christmas'] and state(p)['children']==base['children']
    p.evaluate('()=>{HTMLCanvasElement.prototype.getContext=window.__ctxOriginal}')
   choose(p,'deepavali');close(p);assert state(p)['decor']==['deepavali']
   print('PASS motif and banner allocation failures keep Christmas and retry without reload',flush=True);c.close()
   # Closing a slow preparation must not mount its late result.
   c,p,errors=fresh(browser);ready(p);pending=[]
   p.route('**/deepavali.js*',lambda route:pending.append(route));open_theme(p);p.locator('#mall-theme-select').select_option('deepavali');p.locator('#mall-theme-apply').click()
   p.wait_for_timeout(350);assert pending and state(p)['theme']['pending']=='deepavali'
   close(p);pending.pop().continue_();p.wait_for_timeout(500);assert state(p)['theme']['active']=='everyday' and state(p)['decor']==[]
   switch(p,'deepavali');assert state(p)['decor']==['deepavali']
   print('PASS cancelled slow preparation never mounts; a later selection succeeds',flush=True);c.close()
   # Graphics loss also cancels an in-flight seasonal preparation.
   c,p,errors=fresh(browser);ready(p);pending=[]
   p.route('**/deepavali.js*',lambda route:pending.append(route));open_theme(p);p.locator('#mall-theme-select').select_option('deepavali');p.locator('#mall-theme-apply').click()
   p.wait_for_timeout(350);assert pending and state(p)['theme']['pending']=='deepavali'
   p.evaluate("window.__loss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__loss)throw Error('No loss extension');__loss.loseContext()")
   p.wait_for_function('__mall.state.graphics.status === "lost" || __mall.state.graphics.status === "failed"');pending.pop().continue_();p.wait_for_timeout(500)
   assert state(p)['theme']['active']=='everyday' and state(p)['decor']==[]
   p.evaluate('__loss.restoreContext()');p.wait_for_function('__mall.ready && __mall.state.graphics.validations>0',timeout=60000);p.locator('#graphics-return').click()
   p.unroute('**/deepavali.js*');switch(p,'deepavali');assert state(p)['decor']==['deepavali']
   print('PASS graphics loss cancels pending decorations and permits later selection',flush=True);c.close()
   # Real WebGL loss retains the active seasonal stage and bag.
   c,p,errors=fresh(browser);ready(p);p.locator('#view-toggle').click();p.locator('[data-add]').first.click();p.locator('#view-toggle').click();switch(p,'deepavali')
   p.evaluate("window.__loss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__loss)throw Error('No loss extension');__loss.loseContext()")
   p.wait_for_function('__mall.state.graphics.status === "lost" || __mall.state.graphics.status === "failed"');assert state(p)['theme']['suspended']
   p.evaluate('__loss.restoreContext()');p.wait_for_function('__mall.ready && __mall.state.graphics.validations>0',timeout=60000)
   assert state(p)['theme']['active']=='deepavali' and state(p)['decor']==['deepavali'] and '1' in p.locator('#bag-open').inner_text()
   p.locator('#graphics-return').click();switch(p,'everyday');assert state(p)['decor']==[]
   print('PASS native graphics recovery retains Deepavali decorations and bag, then restores Everyday',flush=True);c.close()
   # Walking, cart loop, event floor, real lift and product details remain functional.
   c,p,errors=fresh(browser,1440,900);ready(p);switch(p,'deepavali');p.evaluate('__mall.teleport("entry")');move(p,10,39,2.65)
   p.locator('#scene-cart').click();assert p.evaluate('__mall.state.pushing')
   for x,z in [(32,39),(32,3),(-12,3),(-12,39),(10,39),(10,29),(5,29),(15,29),(10,29)]:move(p,x,z,1.8)
   p.locator('#scene-cart').click();assert not p.evaluate('__mall.state.pushing')
   p.evaluate('__mall.teleport("newmoon")');move(p,-10,10,2.65);move(p,-5.8,10,2.65);assert p.evaluate('__mall.state.nearby')=='visitor-elevator'
   p.locator('#inspect').click();p.evaluate('__mall.setInput({});__mall.step(200)');assert abs(p.evaluate('__mall.state.y')-7.2)<.1
   p.evaluate('__mall.teleport("newmoon")');p.locator('#view-toggle').click();p.locator('[data-inspect="new-moon-nz-425g-front"]').click();assert p.locator('#product-dialog').is_visible();p.locator('#product-add').click();p.locator('#product-close').click()
   assert '1' in p.locator('#bag-open').inner_text() and not errors,errors
   print('PASS Deepavali cart loop/event, lift, product detail and bag',flush=True);c.close()
   c,p,errors=fresh(browser);ready(p,'&visitor=v1');switch(p,'deepavali');assert state(p)['decor']==['deepavali'];switch(p,'everyday');assert state(p)['decor']==[] and not errors
   print('PASS Visitor v1 Deepavali and Everyday',flush=True);c.close();browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
