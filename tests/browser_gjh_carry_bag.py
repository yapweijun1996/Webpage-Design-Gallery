"""Demo bag-to-character synchronization and locomotion screenshots."""
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--quick',action='store_true');args=ap.parse_args();out=ROOT.parent/'evidence/v11-carry-bag';out.mkdir(exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();rows=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.url or args.quick else [(390,680),(844,390),(1440,900)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce');ready(page,args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-list').click();closed(page);assert state(page)['character']['carrying']['visible']==False
    page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.locator('#product-close').click();page.locator('#view-toggle').click();page.evaluate('__mall.teleport("atrium");__mall.setInput({right:1});__mall.step(1000);__mall.setInput({forward:0});__mall.step(200)');c=state(page)['character']['carrying'];assert c['visible'] and c['count']==1 and not c['pickupAnimation'];page.screenshot(path=str(out/f'idle-{w}.png'))
    page.evaluate('__mall.setInput({forward:1});__mall.step(500)');assert state(page)['animation']=='walk';page.screenshot(path=str(out/f'walk-{w}.png'))
    page.evaluate('__mall.setInput({forward:1,run:true});__mall.step(300)');assert state(page)['animation']=='run';page.screenshot(path=str(out/f'run-{w}.png'));page.evaluate('__mall.setInput({forward:0})')
    page.reload();page.wait_for_function('window.__mall?.ready && window.__sceneReady');assert state(page)['character']['carrying']['count']==1;page.evaluate('__mall.setInput({forward:0});__mall.step(100)');page.locator('#bag-open').click();page.locator('#bag-clear').click();page.locator('#bag-close').click();page.evaluate('__mall.step(100)');assert not state(page)['character']['carrying']['visible'];page.screenshot(path=str(out/f'empty-{w}.png'));rows.append({'viewport':[w,h],'stateSyncEmptyAddClear':'PASS','idleWalkRunCarry':'PASS'});page.close()
   b.close()
 finally:server.shutdown()
 (out/('live-report.json' if args.url else 'report.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
if __name__=='__main__':run()
