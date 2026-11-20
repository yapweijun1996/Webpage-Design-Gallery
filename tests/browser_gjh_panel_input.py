"""Compact reading panels isolate real touch input without pausing desktop overview."""
from gjh_menu_test_helpers import open_menu_page
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');args=ap.parse_args();out=ROOT.parent/'evidence/v11-panel-input';out.mkdir(exist_ok=True);s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();rows=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.url else [(390,680),(844,390),(1440,900)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='no-preference');page.add_init_script("localStorage.setItem('gjh.v11.fullscreenJoystick', 'true')");ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#scene').focus();page.wait_for_function('document.activeElement.id==="scene"');page.evaluate('__mall.step(0)');cdp=page.context.new_cdp_session(page)
    def touch(kind,x,y):
     cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':1,'x':x,'y':y}]});page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    if w==1440:
     if not page.locator('#mall-map').evaluate('e=>e.open'):page.locator('#mall-map').evaluate('e=>e.open=true')
     assert page.locator('#mall-map').evaluate('e=>e.open');a=state(page);page.evaluate('__mall.setInput({forward:1});__mall.step(400)');assert state(page)['z']<a['z']-.5;assert page.locator('.map-content .compact-panel-note').is_hidden();rows.append({'viewport':[w,h],'desktopOverviewStillLive':'PASS'});page.close();continue
    for panel,x in [('mall-map',20),('keyboard-help',w-5)]:
     if panel=='mall-map': page.locator('#header-map').tap()
     else: open_menu_page(page, 'help')
     page.wait_for_function('document.body.classList.contains("is-panel-open")');assert page.locator(f'#{panel}').evaluate('e=>e.open');y=250 if h>400 else 180;assert page.evaluate('([x,y])=>document.elementFromPoint(x,y).id',[x,y])!=('scene' if panel=='keyboard-help' else 'keyboard-help');a=state(page);touch('touchStart',x,y);touch('touchMove',x,y-40);page.evaluate('__mall.step(400)');c=state(page);assert abs(c['z']-a['z'])<1e-6 and c['yaw']==a['yaw'];touch('touchEnd',x,y-40);assert page.locator('#run-toggle').evaluate('e=>getComputedStyle(e).visibility')=='hidden';page.screenshot(path=str(out/f'after-{panel}-{w}.png'));page.keyboard.press('Escape');page.wait_for_function('!document.body.classList.contains("is-panel-open")');assert not page.locator(f'#{panel}').evaluate('e=>e.open');assert page.evaluate('document.activeElement.id')==('header-map' if panel=='mall-map' else 'mall-tools')
    page.locator('#scene').focus();a=state(page);touch('touchStart',w/2,180);touch('touchMove',w/2,140);page.evaluate('__mall.step(400)');assert state(page)['z']<a['z']-.5;touch('touchEnd',w/2,140);a=state(page);page.evaluate('__mall.step(300)');assert abs(state(page)['z']-a['z'])<1e-5
    page.locator('#header-map').tap();page.locator('[data-teleport="newmoon"]').click();assert not page.locator('#mall-map').evaluate('e=>e.open');assert state(page)['x']==-10;open_menu_page(page, "help");page.locator('#header-menu').evaluate('e=>e.focus()');assert page.locator('#keyboard-help').evaluate('e=>e.contains(document.activeElement)');page.keyboard.press('Escape');assert not page.locator('#keyboard-help').evaluate('e=>e.open');
    if w==390:
     page.locator('#scene').focus();page.evaluate('__mall.teleport("atrium");__mall.step(0)');touch('touchStart',w/2,180);touch('touchMove',w/2,140);page.evaluate('__mall.step(100)');page.locator('#mall-map').evaluate('e=>e.open=true');page.wait_for_function('document.body.classList.contains("is-panel-open")&&!document.querySelector("#joystick").classList.contains("is-floating")');a=state(page);page.locator('#mall-map').evaluate('e=>e.open=false');page.wait_for_function('!document.body.classList.contains("is-panel-open")');touch('touchMove',w/2,130);page.evaluate('__mall.step(300)');assert abs(state(page)['z']-a['z'])<1e-5;touch('touchEnd',w/2,130)
     page.evaluate('__mall.teleport("atrium");__mall.setInput({right:-1});__mall.step(1400);__mall.setInput({forward:1});__mall.step(1400);__mall.setInput({right:-1});__mall.step(750);__mall.setInput({forward:0});__mall.step(20)');page.locator('#inspect').click();page.evaluate('__mall.setInput({forward:0});__mall.step(500)');assert state(page)['seated'];page.locator('#header-map').tap();a=state(page);page.evaluate('__mall.step(500)');assert state(page)['character']['seatWeight']==a['character']['seatWeight'];page.keyboard.press('Escape');assert state(page)['seated'];page.evaluate('__mall.step(1000)');open_menu_page(page, "help");page.keyboard.press('Escape');assert state(page)['seated']
    rows.append({'viewport':[w,h],'mapHelpTouchPaused':'PASS','escapeFocus':'PASS','freshGestureAndRelease':'PASS','mapDestinationResumes':'PASS','backgroundFocusIsolation':'PASS'});page.close()
   b.close()
 finally:s.shutdown()
 (out/('live-report.json' if args.url else 'report.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
if __name__=='__main__':run()
