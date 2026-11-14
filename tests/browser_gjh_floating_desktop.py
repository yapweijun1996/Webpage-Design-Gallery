"""Bounded mouse/keyboard regression for floating touch controls."""
from browser_gjh_guide import *
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':900});ready(page,f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"');page.evaluate('__mall.step(0)');a=state(page)
  page.mouse.move(700,400);page.mouse.down();page.mouse.move(760,400,steps=3);page.mouse.up();c=page.evaluate('__mall.step(400)');assert c['yaw']<a['yaw']-.2 and abs(c['x']-a['x'])<1e-5 and abs(c['z']-a['z'])<1e-5
  page.mouse.move(850,400);assert state(page)['yaw']==c['yaw'];page.evaluate('__mall.teleport("atrium")');a=state(page);page.keyboard.down('w');c=page.evaluate('__mall.step(400)');page.keyboard.up('w');assert c['z']<a['z']-.5
  a=state(page);page.evaluate('__mall.step(400)');c=state(page);assert abs(c['z']-a['z'])<1e-5
  page.keyboard.down('e');c=page.evaluate('__mall.step(400)');page.keyboard.up('e');assert c['yaw']!=a['yaw'];b.close()
 print('PASS: desktop mouse drag/release and keyboard movement/turn/release')
finally:s.shutdown()
