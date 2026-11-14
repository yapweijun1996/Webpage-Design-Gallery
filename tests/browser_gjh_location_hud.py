"""Zone transitions must update HUD without throwing or stopping animation."""
from browser_gjh_guide import *
import argparse
ap=argparse.ArgumentParser();ap.add_argument('--url');args=ap.parse_args()
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for w,h,touch in ([(390,844,True)] if args.url else [(390,844,True),(1440,900,False)]):
   page=b.new_page(viewport={'width':w,'height':h},has_touch=touch);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"')
   for zone,label in [('newmoon','New Moon'),('mili','MILI'),('gogo','GOGO')]:
    page.evaluate('(zone)=>{__mall.teleport(zone);__mall.setInput({forward:1});__mall.step(2500)}',zone)
    assert state(page)['zone']==zone,state(page)['z'];assert page.locator('#location-name').inner_text()==label
    assert page.locator(f'[data-teleport="{zone}"]').get_attribute('aria-current')=='location'
    page.evaluate('__mall.setInput({forward:0});__mall.step(20)')
    if zone=='newmoon':page.screenshot(path=str(ROOT.parent/f'evidence/location-after-{w}.png'))
    page.evaluate('__mall.teleport("atrium")');assert page.locator('#location-name').inner_text()=='The courtyard'
   # Exercise the requestAnimationFrame path, not only the deterministic step hook.
   page.evaluate('__mall.teleport("newmoon");__mall.setInput(null)');page.locator('#scene').focus();page.keyboard.down('w');page.wait_for_function('__mall.state.zone==="newmoon"');page.keyboard.up('w');frames=state(page)['frames'];page.wait_for_function('(frames)=>__mall.state.frames>frames',arg=frames);assert not errors,errors;print(w,'three zones, courtyard, map state, animation, zero pageerrors PASS');page.close()
  b.close()
finally:s.shutdown()
