"""Targeted cart state and conservative collision envelope checks."""
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');args=ap.parse_args();out=ROOT.parent/'evidence/v11-cart';out.mkdir(exist_ok=True);s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();rows=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.url else [(390,680),(844,390),(1440,900)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce');ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-list').click();closed(page);page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.locator('#product-close').click();page.locator('#view-toggle').click();page.evaluate('__mall.teleport("atrium")');page.locator('#bag-open').click();page.locator('#cart-toggle').click();assert state(page)['pushing'],state(page);page.evaluate('__mall.setInput({forward:0});__mall.step(20)');a=state(page);assert a['character']['cart']['count']==1 and not a['character']['carrying']['visible'];page.screenshot(path=str(out/f'active-{w}.png'));assert page.locator('#joystick').evaluate('e=>getComputedStyle(e).visibility')=='hidden';assert page.locator('#inspect').evaluate('e=>e.getBoundingClientRect().height')>=44;assert page.locator('#inspect-prompt').evaluate('e=>e.getBoundingClientRect().bottom') < h-35
    page.evaluate('__mall.setInput({forward:-1,run:true});__mall.step(1000)');c=state(page);assert 1<c['z']-a['z']<2.0;assert c['animation']!='run';page.evaluate('__mall.setInput({forward:0,yaw:.7});__mall.step(300)');page.screenshot(path=str(out/f'moving-view-{w}.png'));page.evaluate('__mall.setInput({forward:0,yaw:0});__mall.step(20)')
    page.evaluate('__mall.setInput({forward:-1,run:true});__mall.step(5000)');c=state(page);assert c['z']<16.6,c;page.evaluate('__mall.setInput({forward:0,yaw:3.14});__mall.step(300)');assert state(page)['z']<16.6
    page.locator('#bag-open').click();page.screenshot(path=str(out/f'bag-{w}.png'));page.locator('#cart-toggle').click();assert not state(page)['pushing'];assert state(page)['character']['carrying']['visible'];assert page.locator('#bag-open').inner_text()=='Bag (1)';page.locator('#bag-close').click()
    # Walk closer to the wall with the smaller visitor capsule: cart must refuse expansion.
    page.evaluate('__mall.setInput({forward:1,yaw:3.14159265});__mall.step(1000)');page.locator('#bag-open').click();page.locator('#cart-toggle').click();assert not state(page)['pushing'];assert 'open space' in page.locator('#cart-status').inner_text();page.screenshot(path=str(out/f'blocked-{w}.png'));page.locator('#bag-close').click()
    page.evaluate('__mall.teleport("atrium")');page.locator('#bag-open').click();page.locator('#cart-toggle').click();assert state(page)['pushing'];page.locator('#view-toggle').click();assert not state(page)['pushing'];page.locator('#view-toggle').click();page.locator('#bag-open').click();page.locator('#cart-toggle').click();assert state(page)['pushing'];page.evaluate('__mall.teleport("newmoon")');assert not state(page)['pushing'];rows.append({'viewport':[w,h],'cartDeployStow':'PASS','slowerNoSprint':'PASS','wallClearanceAndBlockedDeploy':'PASS','bagPreserved':'PASS','listTeleportStow':'PASS'});page.close()
   if not args.url:
    page=b.new_page(viewport={'width':390,'height':680});page.route('**/shopping-cart.glb',lambda r:r.abort());ready(page,f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-start').click();closed(page);page.locator('#bag-open').click();assert page.locator('#cart-controls').is_hidden();assert not state(page)['character']['cart']['available'];page.close();rows.append({'optionalCartLoadFailureKeepsMall':'PASS'})
   b.close()
 finally:s.shutdown()
 (out/('live-report.json' if args.url else 'report.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
if __name__=='__main__':run()
