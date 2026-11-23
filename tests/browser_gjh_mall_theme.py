"""Mall-theme settings, retained visitor state and recovery on real Chrome."""
from gjh_menu_test_helpers import close_menu, open_decor_theme, open_menu_page
from gjh_startup_test_helpers import mall_entry_url, set_off_season_date
import argparse,functools,http.server,os,sys,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'docs'))
from verify_mall_support import face, probe_url, walk
from browser_gjh_newmoon_pickup_bag import BROWSE_Z, empty_hands, pickup, visit_store
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
 def ready(p,walkable=False):
  p.goto(mall_entry_url(probe_url(url) if walkable else url))
  p.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000);assert p.evaluate('window.__sceneReady===true')
  if walkable:
   p.locator('#app-loader').wait_for(state='hidden',timeout=90000);p.locator('#scene').focus()
 def open_theme(p,button='#mall-theme-open'):
  if button == '#mall-theme-open': open_decor_theme(p)
  else: p.locator(button).click()
  d=p.locator('#mall-theme-dialog');assert d.is_visible();assert p.evaluate('document.activeElement.id')=='mall-theme-title';return d
 def apply(p,ident=None):
  select=p.locator('#mall-theme-select')
  if ident:select.select_option(ident)
  choice=select.input_value();p.locator('#mall-theme-apply').click()
  p.wait_for_function('id=>{const t=__mall.state.theme;return !t.pending && t.preference===id && (id==="automatic"?t.active===t.auto?.theme:t.active===id)}',arg=choice,timeout=30000)
  if ident is None:
   status=p.locator('#mall-theme-status').inner_text()
   assert ('Automatic: Everyday' in status if choice=='automatic' else 'active' in status),status
 def close(p,opener):
  p.keyboard.press('Escape');p.wait_for_function('!document.querySelector("#mall-theme-dialog").open');p.wait_for_function('id=>document.activeElement.id===id',arg='mall-tools' if opener == 'mall-theme-open' else opener)
 def map_visit(page, destination):
  page.locator('#header-map').click()
  page.locator('#map-destination').select_option(destination)
  page.locator('#map-visit').click()
  page.wait_for_function('!document.querySelector("#mall-map").open')
 def scene_pose(page):
  return page.evaluate('() => {const s=__mall.state;return {x:s.x,y:s.y,z:s.z,scene:s.graphics.sceneId}}')
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   print('Browser:',browser.version,flush=True)
   for w,h in [(320,700),(390,844),(768,1024),(844,390),(1440,900)]:
    c,p,errors=fresh(browser,w,h);ready(p)
    open_menu_page(p, 'about')
    button=p.locator('#mall-theme-open');assert button.is_visible();button.scroll_into_view_if_needed();r=button.bounding_box();assert r['width']>=44 and r['height']>=44 and r['x']>=0 and r['x']+r['width']<=w,r
    assert button.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
    close_menu(p)
    p.locator('#view-toggle').click();p.locator('[data-add]').first.click();p.locator('#view-toggle').click()
    opening=scene_pose(p)
    d=open_theme(p);assert scene_pose(p)==opening;bounds=d.bounding_box();assert bounds['x']>=0 and bounds['y']>=0 and bounds['x']+bounds['width']<=w+.5 and bounds['y']+bounds['height']<=h+.5,bounds
    assert p.locator('#mall-theme-select option').count()==5 and p.locator('#mall-theme-select').input_value()=='automatic'
    assert p.locator('#mall-theme-select option[value="deepavali"]').inner_text()=='Deepavali'
    assert p.evaluate('__mall.state.paused')
    p.locator('#mall-theme-close').focus();p.keyboard.press('Shift+Tab');assert p.evaluate('document.activeElement.id')=='mall-theme-apply'
    p.keyboard.press('Tab');assert p.evaluate('document.activeElement.id')=='mall-theme-close'
    # Compare the already-open dialog around the repeated no-op. Opening the menu itself submits a final world draw.
    p.evaluate('() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))')
    before=p.evaluate('''()=>{let s=__mall.state;return {x:s.x,y:s.y,z:s.z,scene:s.graphics.sceneId,children:s.graphics.sceneChildren,resources:s.rendererResources}}''')
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
   c,p,errors=fresh(browser,1440,900);ready(p,walkable=True);map_visit(p,'gogo')
   for x,z in ((10,5),(19.4,5),(20,9),(20,4.7)):walk(p,x,z)
   assert p.evaluate('__mall.state.cartCapability.allowed')
   p.locator('#bag-open').click();p.locator('#cart-toggle').click()
   # Cold cart geometry shares the sliced GPU upload queue with storefront models.
   p.wait_for_function('__mall.state.pushing && !document.querySelector("#bag-dialog").open',timeout=90000)
   open_theme(p);apply(p,'christmas');assert p.evaluate('__mall.state.pushing && __mall.state.paused');close(p,'mall-theme-open');assert p.evaluate('__mall.state.pushing && !__mall.state.paused')
   assert not errors,errors;print('PASS theme change preserves active cart',flush=True);c.close()
   c,p,errors=fresh(browser,1440,900);ready(p,walkable=True)
   seat=p.evaluate('__mall.state.seats[0]')
   for x,z in [(10,35),(-8,35),(-8,21),(seat['exitX'],21),(seat['exitX'],seat['exitZ'])]:walk(p,x,z)
   p.get_by_role('button',name='Sit on '+seat['name'],exact=True).click()
   p.wait_for_function('id=>__mall.state.seated && __mall.state.seatId===id',arg=seat['id'])
   open_theme(p);apply(p,'lunar-new-year');assert p.evaluate('__mall.state.seated && __mall.state.paused');close(p,'mall-theme-open')
   assert p.evaluate('__mall.state.seated && !__mall.state.paused')
   p.get_by_role('button',name='Stand up from bench',exact=True).click();p.wait_for_function('!__mall.state.seated')
   assert not errors,errors;print('PASS theme change preserves a seated visitor',flush=True);c.close()
   c,p,errors=fresh(browser,1440,900);ready(p,walkable=True);visit_store(p,False)
   can=p.evaluate("() => {const c=__mall.state.productAssets.cans['nz-425g'];return c.placements[c.reserveIndex]}")
   walk(p,can['x'],BROWSE_Z);face(p,can['x'],can['z']);pickup(p,'new-moon-nz-425g-front',False)
   open_theme(p);apply(p,'deepavali');close(p,'mall-theme-open')
   assert p.evaluate('__mall.state.character.physicalProduct.held && __mall.state.character.physicalProduct.id==="new-moon-nz-425g-front"')
   p.get_by_role('button',name='Return to shelf',exact=True).click();empty_hands(p)
   assert not errors,errors;print('PASS theme change preserves a carried physical product',flush=True);c.close()
   # Interrupt an actual lift journey with the settings modal; it resumes afterward.
   c,p,errors=fresh(browser,motion='no-preference');ready(p);map_visit(p,'floor-upper')
   p.wait_for_function('__mall.state.elevatorTravel');open_theme(p)
   frozen=scene_pose(p);assert p.evaluate('__mall.state.elevatorTravel && __mall.state.paused')
   apply(p,'christmas');assert scene_pose(p)==frozen and p.evaluate('__mall.state.elevatorTravel')
   close(p,'mall-theme-open');p.wait_for_function('!__mall.state.elevatorTravel && Math.abs(__mall.state.y-7.2)<.1')
   assert not errors,errors;print('PASS settings pause and resume an active elevator journey',flush=True);c.close()
   # Real WebGL loss closes settings and preserves the chosen theme and bag.
   c,p,errors=fresh(browser);ready(p);p.locator('#view-toggle').click();p.locator('[data-add]').first.click();p.locator('#view-toggle').click();open_theme(p);apply(p)
   p.evaluate("window.__loss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');if(!__loss)throw Error('No loss extension');__loss.loseContext()")
   p.wait_for_function('__mall.state.graphics.status === "lost" || __mall.state.graphics.status === "failed"');p.wait_for_function('!document.querySelector("#mall-theme-dialog").open')
   assert p.evaluate('__mall.state.theme.suspended') and '1' in p.locator('#bag-open').inner_text()
   open_theme(p,'#directory-theme-open');assert p.locator('#mall-theme-apply').is_disabled();close(p,'directory-theme-open')
   p.evaluate('__loss.restoreContext()');p.wait_for_function('__mall.ready && __mall.state.graphics.validations>0',timeout=60000)
   assert p.evaluate('__mall.state.theme.active==="everyday" && !__mall.state.theme.suspended');p.locator('#graphics-return').click()
   assert '1' in p.locator('#bag-open').inner_text();open_theme(p);apply(p,'everyday');close(p,'mall-theme-open')
   assert not errors,errors;print('PASS graphics loss and restoration retain theme and bag',flush=True);c.close()
   c,p,errors=fresh(browser);p.goto(mall_entry_url(url+'&visitor=v1'));p.wait_for_function('window.__sceneReady',timeout=90000)
   assert p.evaluate('__mall.state.character.model')=='gjh-mall-visitor'
   open_theme(p);apply(p,'everyday');close(p,'mall-theme-open');assert p.evaluate('__mall.state.theme.active==="everyday"') and not errors
   print('PASS Visitor v1 expanded theme settings',flush=True);c.close()
   c,p,errors=fresh(browser);default=url.replace('?layout=expanded','')
   p.goto(mall_entry_url(default));p.wait_for_function('window.__sceneReady',timeout=90000)
   open_menu_page(p,'about');assert p.locator('#mall-theme-open').is_visible();close_menu(p)
   planned=p.locator('#mall-map [data-space-id]').evaluate_all('els=>els.map(el=>el.dataset.spaceId)')
   assert planned==[f'planned-space-{number:02d}' for number in range(4,18)] and not errors,planned
   c.close()
   c,p,errors=fresh(browser);p.goto(mall_entry_url(default+'?layout=classic'));p.wait_for_function('window.__sceneReady',timeout=90000)
   open_menu_page(p,'about');assert p.locator('#mall-theme-open').is_hidden();close_menu(p)
   assert p.locator('#mall-map [data-map-store]').evaluate_all('els=>els.map(el=>el.dataset.mapStore)')==['newmoon','mili','gogo']
   p.locator('#view-toggle').click();assert p.locator('#directory-theme-open').is_hidden() and not errors,errors;c.close()
   c=browser.new_context(java_script_enabled=False,service_workers='block');p=c.new_page();p.goto(default)
   assert p.locator('#directory-theme-open').is_hidden()
   assert p.locator('#store-list [data-store]').evaluate_all('els=>els.map(el=>el.dataset.store)')==['newmoon','mili','gogo']
   c.close();print('PASS expanded default, classic three-store controls and no-JavaScript directory',flush=True);browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
