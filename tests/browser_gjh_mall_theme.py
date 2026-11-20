"""Mall-theme settings, retained visitor state and recovery on real Chrome."""
from gjh_menu_test_helpers import close_menu, open_decor_theme, open_menu_page
from gjh_startup_test_helpers import mall_entry_url, set_off_season_date
import argparse,functools,http.server,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_lift import move
from browser_gjh_expanded_shell import Quiet
ROOT=Path(__file__).resolve().parents[1]
KEY='gjh-v11-mall-theme-v1'
def run():
 parser=argparse.ArgumentParser();parser.add_argument('--screens',type=Path);args=parser.parse_args()
 if args.screens:args.screens.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
 def fresh(browser,w=390,h=844,motion='reduce',init=''):
  c=browser.new_context(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion=motion,service_workers='block')
  c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed');"+init)
  p=c.new_page();set_off_season_date(p);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));return c,p,errors
 def ready(p):p.goto(mall_entry_url(url));p.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000);assert p.evaluate('window.__sceneReady===true')
 def open_theme(p,button='#mall-theme-open'):
  if button == '#mall-theme-open': open_decor_theme(p)
  else: p.locator(button).click()
  d=p.locator('#mall-theme-dialog');assert d.is_visible();assert p.evaluate('document.activeElement.id')=='mall-theme-title';return d
 def apply(p,ident=None):
  if ident:p.locator('#mall-theme-select').select_option(ident)
  p.locator('#mall-theme-apply').click()
  if ident:p.wait_for_function('id=>__mall.state.theme.active===id',arg=ident,timeout=30000)
  else:p.wait_for_function('document.querySelector("#mall-theme-status").textContent.includes("active")')
 def close(p,opener):
  p.keyboard.press('Escape');p.wait_for_function('!document.querySelector("#mall-theme-dialog").open');p.wait_for_function('id=>document.activeElement.id===id',arg='mall-tools' if opener == 'mall-theme-open' else opener)
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   print('Browser:',browser.version,flush=True)
   for w,h in [(320,700),(390,844),(768,1024),(844,390),(1440,900)]:
    c,p,errors=fresh(browser,w,h);ready(p)
    open_menu_page(p, 'about')
    button=p.locator('#mall-theme-open');assert button.is_visible();r=button.bounding_box();assert r['width']>=44 and r['height']>=44 and r['x']>=0 and r['x']+r['width']<=w,r
    assert button.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
    close_menu(p)
    p.locator('#view-toggle').click();p.locator('[data-add]').first.click();p.locator('#view-toggle').click()
    before=p.evaluate('''()=>{let s=__mall.state;return {x:s.x,y:s.y,z:s.z,scene:s.graphics.sceneId,children:s.graphics.sceneChildren,resources:s.rendererResources}}''')
    d=open_theme(p);bounds=d.bounding_box();assert bounds['x']>=0 and bounds['y']>=0 and bounds['x']+bounds['width']<=w+.5 and bounds['y']+bounds['height']<=h+.5,bounds
    assert p.locator('#mall-theme-select option').count()==5 and p.locator('#mall-theme-select').input_value()=='automatic'
    assert p.locator('#mall-theme-select option[value="deepavali"]').inner_text()=='Deepavali'
    assert p.evaluate('__mall.state.paused')
    p.locator('#mall-theme-close').focus();p.keyboard.press('Shift+Tab');assert p.evaluate('document.activeElement.id')=='mall-theme-apply'
    p.keyboard.press('Tab');assert p.evaluate('document.activeElement.id')=='mall-theme-close'
    for i in range(8):apply(p,'everyday')
    assert p.evaluate('(key)=>localStorage.getItem(key)',KEY)=='everyday'
    assert p.locator('#mall-theme-status').inner_text()=='Everyday is already active.'
    after=p.evaluate('''()=>{let s=__mall.state;return {x:s.x,y:s.y,z:s.z,scene:s.graphics.sceneId,children:s.graphics.sceneChildren,resources:s.rendererResources}}''');assert before==after,(before,after)
    assert '1' in p.locator('#bag-open').inner_text() and not errors,errors
    if args.screens and w in (320,390,768,844,1440):p.screenshot(path=str(args.screens/f'settings-{w}.png'))
    close(p,'mall-theme-open');assert not p.evaluate('__mall.state.paused')
    p.locator('#view-toggle').click();p.locator('#directory-theme-open').scroll_into_view_if_needed()
    if args.screens and w in (390,1440):p.screenshot(path=str(args.screens/f'directory-{w}.png'))
    open_theme(p,'#directory-theme-open');apply(p);close(p,'directory-theme-open')
    assert p.locator('[data-store]').count()==3 and p.locator('.product-card').count()==4
    print(f'PASS {w}x{h}: discoverable settings, focus, repeated apply, retained bag and resources',flush=True);c.close()
   # Unknown persisted values are never treated as a supported theme.
   c,p,errors=fresh(browser,init=f"if (!localStorage.getItem('{KEY}')) localStorage.setItem('{KEY}','unknown-theme');");ready(p);open_theme(p)
   assert p.locator('#mall-theme-select').input_value()=='automatic' and 'Automatic: Everyday' in p.locator('#mall-theme-status').inner_text()
   apply(p,'everyday');assert p.evaluate('(key)=>localStorage.getItem(key)',KEY)=='everyday';close(p,'mall-theme-open')
   p.reload();p.wait_for_function('window.__sceneReady',timeout=90000);open_theme(p);assert p.locator('#mall-theme-select').input_value()=='everyday'
   print('PASS invalid saved theme falls back, is replaced and survives reload',flush=True);c.close()
   c,p,errors=fresh(browser,init="Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError')}});");ready(p);open_theme(p);apply(p,'everyday')
   assert 'session' in p.locator('#mall-theme-status').inner_text() and p.evaluate('__mall.state.theme.saved===false')
   print('PASS unavailable local storage retains in-memory theme',flush=True);c.close()
   # A missing optional coordinator must not make the mall unavailable.
   c,p,errors=fresh(browser);blocked=[]
   def abort(route):blocked.append(route.request.url);route.abort()
   p.route('**/mall-themes.js',abort);ready(p);assert blocked;open_theme(p)
   assert p.locator('#mall-theme-apply').is_disabled() and 'unavailable' in p.locator('#mall-theme-status').inner_text()
   assert not errors,errors;print('PASS missing theme module preserves 3D and reports unavailable settings',flush=True);c.close()
   # Modal settings suspend a pushed cart without stowing it.
   c,p,errors=fresh(browser,1440,900);ready(p);p.evaluate('__mall.teleport("atrium")');p.locator('#scene-cart').click();assert p.evaluate('__mall.state.pushing')
   open_theme(p);apply(p,'christmas');assert p.evaluate('__mall.state.pushing && __mall.state.paused');close(p,'mall-theme-open');assert p.evaluate('__mall.state.pushing && !__mall.state.paused')
   print('PASS theme change preserves active cart',flush=True);c.close()
   c,p,errors=fresh(browser,1440,900);ready(p);p.evaluate('__mall.teleport("entry")');seat=p.evaluate('__mall.state.seats[0]')
   for x,z in [(10,35),(-8,35),(-8,21),(seat['exitX'],21),(seat['exitX'],seat['exitZ'])]:move(p,x,z)
   p.locator('#inspect').click();p.evaluate('__mall.step(40)');assert p.evaluate('__mall.state.seated')
   open_theme(p);apply(p,'lunar-new-year');assert p.evaluate('__mall.state.seated && __mall.state.paused');close(p,'mall-theme-open')
   assert p.evaluate('__mall.state.seated && !__mall.state.paused');p.locator('#inspect').click();p.evaluate('__mall.step(50)');assert not p.evaluate('__mall.state.seated')
   print('PASS theme change preserves a seated visitor',flush=True);c.close()
   c,p,errors=fresh(browser,1440,900);ready(p);p.evaluate('__mall.teleport("newmoon")');move(p,-10,-2.6);move(p,-10,-7.4)
   shelf=p.evaluate("__mall.state.shelves.find(s=>s.id==='new-moon-nz-425g-front')");move(p,(shelf['min']['x']+shelf['max']['x'])/2,-7.4)
   p.get_by_role('button',name='Pick up product',exact=True).click();p.evaluate('__mall.step(1600)');assert p.evaluate('__mall.state.character.physicalProduct.phase==="held"')
   open_theme(p);apply(p,'deepavali');close(p,'mall-theme-open');assert p.evaluate('__mall.state.character.physicalProduct.phase==="held"')
   p.get_by_role('button',name='Return to shelf',exact=True).click();p.evaluate('__mall.step(1600)');assert p.evaluate('__mall.state.character.physicalProduct.phase==="empty"')
   print('PASS theme change preserves a carried physical product',flush=True);c.close()
   # Interrupt an actual lift journey with the settings modal; it resumes afterward.
   c,p,errors=fresh(browser,motion='no-preference');ready(p);p.evaluate('__mall.teleport("newmoon")');move(p,-10,10);move(p,-5.8,10)
   p.evaluate("()=>{document.querySelector('#inspect').click();__mall.setInput({});__mall.step(500)}");assert p.evaluate('__mall.state.elevatorTravel')
   open_theme(p);before=p.evaluate('__mall.state.y');apply(p,'christmas');p.evaluate('__mall.step(2000)');assert abs(p.evaluate('__mall.state.y')-before)<.001
   close(p,'mall-theme-open');p.evaluate('__mall.setInput({});__mall.step(4000)');assert abs(p.evaluate('__mall.state.y')-7.2)<.1
   print('PASS settings pause and resume an active elevator journey',flush=True);c.close()
   # Real WebGL loss closes settings and preserves the chosen theme and bag.
   c,p,errors=fresh(browser);ready(p);p.locator('#view-toggle').click();p.locator('[data-add]').first.click();p.locator('#view-toggle').click();open_theme(p);apply(p)
   p.evaluate("window.__loss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__loss)throw Error('No loss extension');__loss.loseContext()")
   p.wait_for_function('__mall.state.graphics.status === "lost" || __mall.state.graphics.status === "failed"');p.wait_for_function('!document.querySelector("#mall-theme-dialog").open')
   assert p.evaluate('__mall.state.theme.suspended') and '1' in p.locator('#bag-open').inner_text()
   open_theme(p,'#directory-theme-open');assert p.locator('#mall-theme-apply').is_disabled();close(p,'directory-theme-open')
   p.evaluate('__loss.restoreContext()');p.wait_for_function('__mall.ready && __mall.state.graphics.validations>0',timeout=60000)
   assert p.evaluate('__mall.state.theme.active==="everyday" && !__mall.state.theme.suspended');p.locator('#graphics-return').click()
   assert '1' in p.locator('#bag-open').inner_text();open_theme(p);apply(p,'everyday');close(p,'mall-theme-open')
   print('PASS graphics loss and restoration retain theme and bag',flush=True);c.close()
   c,p,errors=fresh(browser);p.goto(mall_entry_url(url+'&visitor=v1'));p.wait_for_function('window.__sceneReady',timeout=90000)
   open_theme(p);apply(p,'everyday');close(p,'mall-theme-open');assert p.evaluate('__mall.state.theme.active==="everyday"') and not errors
   print('PASS Visitor v1 expanded theme settings',flush=True);c.close()
   # The expanded default exposes its theme settings; the static fallback keeps the control hidden.
   c,p,errors=fresh(browser);p.goto(mall_entry_url(url.replace('?layout=expanded','')));p.wait_for_function('window.__sceneReady',timeout=90000)
   open_menu_page(p, 'about');assert p.locator('#mall-theme-open').is_visible();close_menu(p);assert p.locator('[data-space-id]').count()==14;c.close()
   c=browser.new_context(java_script_enabled=False,service_workers='block');p=c.new_page();p.goto(url.replace('?layout=expanded',''));assert p.locator('#directory-theme-open').is_hidden() and p.locator('[data-store]').count()==3;c.close()
   print('PASS expanded default and no-JavaScript directory',flush=True);browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
