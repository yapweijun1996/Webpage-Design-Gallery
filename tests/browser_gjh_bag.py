"""Focused demo-only selection, fallback, session and modal evidence."""
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');args=ap.parse_args();out=ROOT.parent/'evidence/v11-demo-bag';out.mkdir(exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();reports=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.url else [(320,680),(390,680),(844,390)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=True,reduced_motion='reduce');ready(page,args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-list').click();closed(page)
    buttons=page.locator('.product-card [data-inspect]');assert buttons.count()==4
    for i in range(4):
     buttons.nth(i).click();page.locator('#product-add').click();assert 'Added to demo bag' in page.locator('#product-bag-status').inner_text();assert page.locator('#product-shop').get_attribute('href')=='https://www.gjheshop.com/'
     if i==0:page.screenshot(path=str(out/f'product-{w}.png'))
     page.locator('#product-close').click()
    assert page.locator('#bag-open').inner_text()=='Bag (4)';page.locator('#bag-open').click();assert page.locator('#bag-items li').count()==4;page.screenshot(path=str(out/f'bag-{w}.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('#bag-dialog button').evaluate_all('els=>els.filter(e=>!e.hidden).every(e=>e.getBoundingClientRect().height>=44)')
    page.locator('#bag-items li').first.get_by_role('button',name='Increase',exact=False).click();assert page.locator('#bag-open').inner_text()=='Bag (5)';page.locator('#bag-items li').first.get_by_role('button',name='Decrease',exact=False).click()
    page.locator('#bag-items li').first.get_by_role('button',name='Remove',exact=False).click();assert page.locator('#bag-items li').count()==3
    page.keyboard.press('Escape');page.wait_for_function('document.activeElement.id==="bag-open"');page.reload();page.wait_for_function('window.__mall?.ready && window.__sceneReady');assert page.locator('#bag-open').inner_text()=='Bag (3)'
    page.locator('#bag-open').click();s=state(page);page.keyboard.press('w');page.evaluate('__mall.step(400)');a=state(page);assert abs(s['x']-a['x'])<1e-5 and abs(s['z']-a['z'])<1e-5
    page.locator('#bag-clear').click();assert page.locator('#bag-empty').is_visible();page.locator('#bag-close').click();assert page.locator('#bag-open').inner_text()=='Bag (0)';reports.append({'viewport':[w,h],'fourSKUAddQuantityRemoveClearSession':'PASS','modalPauseFocus':'PASS'});page.close()
   if not args.url:
    page=b.new_page(viewport={'width':390,'height':680});page.add_init_script("Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked')}})");page.route('**/rapier.mjs',lambda r:r.abort());page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.locator('#product-close').click();page.locator('#bag-open').click();assert page.locator('#bag-items li').count()==1;reports.append({'blockedStorageAnd3DFallback':'PASS'});page.close()
   b.close()
 finally:server.shutdown()
 (out/('live-report.json' if args.url else 'report.json')).write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
if __name__=='__main__':run()
