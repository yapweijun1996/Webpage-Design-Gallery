"""Focused simplified collection action and cancellation contract."""
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');args=ap.parse_args();out=ROOT.parent/'evidence/v11-collect';out.mkdir(exist_ok=True);s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();rows=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for reduced in [False,True]:
    page=b.new_page(viewport={'width':390,'height':680},has_touch=True,reduced_motion='reduce' if reduced else 'no-preference');ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-start').click();closed(page);page.evaluate('__mall.setInput({right:1});__mall.step(1000);__mall.setInput({forward:0});__mall.step(200)');page.locator('#view-toggle').click()
    for i in range(4):
     page.locator('.product-card [data-inspect]').nth(i).click()
     page.locator('#product-collect').scroll_into_view_if_needed()
     if i==0 and not reduced:page.screenshot(path=str(out/'actions-390.png'))
     # Two synchronous clicks model duplicate activation; the closed-dialog guard admits one.
     page.locator('#product-collect').evaluate('e=>{e.click();e.click()}');page.evaluate('__mall.step(0)');assert page.locator('#bag-open').inner_text()==f'Bag ({i+1})';assert page.locator('#experience').is_visible();assert page.evaluate('document.activeElement.id')=='scene'
     c=state(page)['character']['collection'];assert c['active']!=reduced
     if not reduced:
      assert c['sku'] in ['new-moon-nz-425g-front','new-moon-au-425g-front','new-moon-sa-425g-front','new-moon-mx-454g-front'];page.evaluate('__mall.step(400)')
      assert not page.locator('#inspect-prompt').is_visible()
      if i==0:page.screenshot(path=str(out/'gesture-390.png'))
      if i==1:page.locator('#bag-open').click();assert not state(page)['character']['collection']['active'];page.locator('#bag-close').click()
      elif i==2:page.evaluate('window.dispatchEvent(new Event("blur"))');assert not state(page)['character']['collection']['active']
      else:
       page.evaluate('__mall.step(1600)');assert not state(page)['character']['collection']['active']
       if state(page)['nearby']:assert page.locator('#inspect-prompt').is_visible()
     assert page.locator('#bag-open').inner_text()==f'Bag ({i+1})';page.locator('#view-toggle').click()
    # Existing Add remains the non-animated alternative and shares the nine-unit cap.
    page.locator('.product-card [data-inspect]').first.click()
    for _ in range(8):page.locator('#product-add').click()
    assert page.locator('#product-add').is_disabled() and page.locator('#product-collect').is_disabled();page.locator('#product-close').click();rows.append({'reducedMotion':reduced,'fourSKUOnceOnlyAndCap':'PASS','focusReturn':'PASS','completionModalBlurCancellation':'PASS'});page.close()
   b.close()
 finally:s.shutdown()
 (out/('live-report.json' if args.url else 'report.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
if __name__=='__main__':run()
