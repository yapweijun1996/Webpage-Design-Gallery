"""Small-screen map/Run hit testing and orientation-change regression."""
from browser_gjh_budget import *
def overlap(a,b):
 return min(a['x']+a['width'],b['x']+b['width'])>max(a['x'],b['x']) and min(a['y']+a['height'],b['y']+b['height'])>max(a['y'],b['y'])
def run():
 OUT.mkdir(parents=True,exist_ok=True);server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();records=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce');page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"')
   # Same page and open map across rotations, rather than isolated clean-page layouts.
   for width,height in [(390,844),(844,390),(667,375),(568,320),(390,844)]:
    page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150)
    if not page.locator('#mall-map').evaluate('e=>e.open'):page.locator('#mall-map>summary').click()
    button=page.locator('#run-toggle');box=button.bounding_box();assert box['width']>=44 and box['height']>=44
    assert box['x']>=18 and box['x']+box['width']<=width-18 and box['y']>=18 and box['y']+box['height']<=height-18,box
    for selector in ['#joystick','#keyboard-help>summary','#mall-map']:
     assert not overlap(box,page.locator(selector).bounding_box()),(width,height,selector,box)
    assert button.evaluate('e=>{let r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
    button.focus();page.keyboard.press('Space');assert button.get_attribute('aria-pressed')=='true';page.keyboard.press('Space');assert button.get_attribute('aria-pressed')=='false'
    page.screenshot(path=str(OUT/f'landscape-controls-{width}x{height}.png'))
    page.locator('#mall-map>summary').click();closed=button.bounding_box();assert closed['x']>width/2,'Run must return to the right when map closes'
    records.append({'viewport':[width,height],'mapOpenRunBounds':box,'nonOverlap':'PASS','keyboardToggle':'PASS','closedPositionRestored':'PASS'})
    page.locator('#mall-map>summary').click()
   b.close()
 finally:server.shutdown()
 (OUT/'landscape.json').write_text(json.dumps(records,indent=2));print(json.dumps(records,indent=2))
if __name__=='__main__':run()
