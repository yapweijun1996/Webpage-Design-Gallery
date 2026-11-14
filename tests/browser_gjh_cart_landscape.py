import sys
sys.path.insert(0,'tests')
from browser_gjh_guide import *
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':844,'height':390},has_touch=True,reduced_motion='reduce');ready(page,f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-start').click();closed(page);page.locator('#bag-open').click();page.locator('#cart-toggle').click();page.evaluate('__mall.setInput({forward:0});__mall.step(20)');assert state(page)['pushing'];page.screenshot(path=str(ROOT.parent/'evidence/v11-cart/active-844.png'));r=page.locator('#inspect-prompt').bounding_box();assert r['x']+r['width']<300 and r['y']>100 and r['y']+r['height']<350,r;print('PASS landscape prompt side placement',r);b.close()
finally:s.shutdown()
