"""Real kiosk, three-store map, collision and independent asset failure checks."""
from browser_gjh_budget import *
def run():
 OUT.mkdir(parents=True,exist_ok=True);server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();records=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);
   for width,height,failure in [(390,844,False),(1440,900,False),(390,844,True)]:
    context=b.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if failure:page.route('**/mall-directory-kiosk.glb',lambda route:route.fulfill(status=404,body=''))
    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"');page.evaluate('__mall.setInput({});__mall.step(17)')
    state=page.evaluate('__mall.state');asset=state['furnishings']['kiosk'];assert asset['status']==('fallback' if failure else 'loaded') and asset['instances']==1
    assert state['nearby']=='mall-directory';assert 'Decorative screen' in page.locator('#nearby-name').inner_text()
    page.screenshot(path=str(OUT/f'kiosk-{width}-fallback-{failure}.png'))
    page.keyboard.press('f');page.wait_for_function('document.activeElement.matches("[data-teleport]")');assert page.locator('#mall-map').evaluate('e=>e.open');assert not page.locator('#product-dialog').evaluate('e=>e.open')
    for zone in ['newmoon','mili','gogo']:
     page.evaluate('__mall.teleport("atrium");__mall.step(17)');page.locator('#inspect').click();page.locator(f'[data-teleport="{zone}"]').click();page.wait_for_function('document.activeElement.id==="scene"');s=page.evaluate('__mall.state');assert abs(s['x']-{'newmoon':-10,'mili':0,'gogo':10}[zone])<.01
    # The kiosk is left of the central entrance path. Walking left contacts its collider.
    page.evaluate('__mall.teleport("atrium");__mall.setInput({forward:1});for(let i=0;i<120 && __mall.state.z>9.95;i++)__mall.step(17);__mall.setInput({right:-1});__mall.step(1500)');s=page.evaluate('__mall.state');assert s['x']>-2.75,s
    page.evaluate('__mall.teleport("atrium");__mall.setInput({forward:1});__mall.step(600)');s=page.evaluate('__mall.state');assert s['z']<11.5,s
    assert not errors,errors;records.append({'width':width,'failure':failure,'asset':asset,'mapThreeStores':'PASS','collisionAndCentralPath':'PASS'});context.close()
   b.close()
 finally:server.shutdown()
 (OUT/'kiosk.json').write_text(json.dumps(records,indent=2));print(json.dumps(records,indent=2))
if __name__=='__main__':run()
