"""Mode guidance follows the visible preview without replacing load/error messages."""
from browser_gjh_budget import ROOT,Quiet,functools,http,threading,sync_playwright,os,json
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--live',action='store_true');args=ap.parse_args()
 out=ROOT.parent/'evidence/v11-preview-mode';out.mkdir(exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,844)] if args.live else [(390,844),(1440,900)]):
    page=b.new_page(viewport={'width':w,'height':h});page.goto(args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-list').click()
    for sku in ['nz-425g','au-425g','sa-425g','mx-454g']:
     page.locator(f'[data-inspect="new-moon-{sku}-front"]').click();status=page.locator('#product-preview-status')
     assert status.inner_text()=='Official packshot shown by default. The 3D preview is an unofficial demo.'
     page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded')
     for repeat in range(2):
      assert status.inner_text().startswith('Unofficial 3D demo. Drag') and page.locator('#product-preview-canvas').is_visible()
      page.locator('#product-preview-image').click();assert status.inner_text()=='Official packshot shown. Choose Show 3D preview to return to the unofficial interactive demo.'
      assert page.locator('#product-image').is_visible() and page.locator('#product-preview-canvas').is_hidden()
      assert page.evaluate('document.activeElement.id==="product-preview-3d"')
      if sku=='mx-454g' and repeat==0:
       page.evaluate('document.querySelector("#product-dialog").scrollTop=0');page.screenshot(path=str(out/f'{"live-" if args.live else "after-"}{w}.png'))
      page.locator('#product-preview-3d').click();assert page.evaluate('document.activeElement.id==="product-preview-canvas"')
     page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#product-dialog").open && __newMoonPreview.state.activeResources===0')
     results.append({'viewport':[w,h],'sku':sku,'modeRoundtrips':2,'guidanceAndFocus':'PASS'})
    if not args.live:
     pending=[];pattern='**/new-moon-can-nz-425g-lod1.glb';page.route(pattern,lambda r:pending.append(r));page.locator('[data-inspect="new-moon-nz-425g-front"]').click();page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loading');page.wait_for_timeout(200)
     assert status.inner_text()=='Loading unofficial 3D demo…';assert pending;pending.pop().fulfill(status=404,body='missing');page.wait_for_function('__newMoonPreview.state.status==="error"')
     assert 'unavailable' in status.inner_text() and 'Retry' in status.inner_text();assert page.locator('#product-image').is_visible();page.unroute(pattern)
     page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded');assert status.inner_text().startswith('Unofficial 3D demo. Drag');page.keyboard.press('Escape');results.append({'viewport':[w,h],'loadingFailureRetry':'PASS'})
    page.close()
   b.close()
 finally:server.shutdown()
 (out/('live-report.json' if args.live else 'report.json')).write_text(json.dumps(results,indent=2));print(json.dumps(results))
if __name__=='__main__':run()
