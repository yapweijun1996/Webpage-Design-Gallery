"""One courtyard seat: actual approach, anchored pose and safe standing."""
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');args=ap.parse_args();out=ROOT.parent/'evidence/v11-seat';out.mkdir(exist_ok=True);s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();rows=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.url else [(390,680),(1440,900)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce');ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-list').click();closed(page);page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.locator('#product-close').click();page.locator('#view-toggle').click()
    page.evaluate('__mall.teleport("atrium");__mall.setInput({right:-1});__mall.step(1400);__mall.setInput({forward:1});__mall.step(1400);__mall.setInput({right:-1});__mall.step(750);__mall.setInput({forward:0});__mall.step(20)');assert state(page)['nearby']=='courtyard-seat',state(page);page.screenshot(path=str(out/f'approach-{w}.png'))
    page.locator('#inspect').click();page.evaluate('__mall.step(20)');a=state(page);assert a['seated'] and a['character']['seated'];assert page.locator('#inspect').inner_text()=='Stand up';page.screenshot(path=str(out/f'seated-{w}.png'))
    page.evaluate('__mall.setInput({forward:1,right:1,run:true});__mall.step(500)');c=state(page);assert c['x']==a['x'] and c['z']==a['z'];assert c['character']['carrying']['count']==1
    page.locator('#scene').focus();page.keyboard.down('e');page.evaluate('__mall.step(200)');page.keyboard.up('e');assert state(page)['yaw']!=a['yaw'] and state(page)['x']==a['x']
    # Dialog Escape closes only the dialog; it must not leave the seat.
    page.locator('#bag-open').click();page.keyboard.press('Escape');assert state(page)['seated'];page.locator('#scene').focus();page.keyboard.press('Escape');page.evaluate('__mall.setInput({forward:0});__mall.step(100)');assert not state(page)['seated'];assert abs(state(page)['z']-8.3)<.001;assert page.locator('#bag-open').inner_text()=='Bag (1)';page.screenshot(path=str(out/f'standing-{w}.png'))
    page.locator('#inspect').click();assert state(page)['seated'];page.locator('#view-toggle').click();assert not state(page)['seated'];page.locator('#view-toggle').click();page.evaluate('__mall.step(20)');page.locator('#inspect').click();assert state(page)['seated'];page.evaluate('__mall.teleport("newmoon")');assert not state(page)['seated'];rows.append({'viewport':[w,h],'approachSitStand':'PASS','movementLock':'PASS','modalEscapeListTeleportExit':'PASS','bagPreserved':'PASS'});page.close()
   b.close()
 finally:s.shutdown()
 (out/('live-report.json' if args.url else 'report.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
if __name__=='__main__':run()
