"""Eight actual benches, procedural transitions and interruption boundaries."""
from browser_gjh_guide import *
import argparse

def move(page,x,z):
 for _ in range(160):
  a=state(page);dx=x-a['x'];dz=z-a['z'];d=(dx*dx+dz*dz)**.5
  if d<.065:break
  page.evaluate('([dx,dz,ms])=>{__mall.setInput({right:dx,forward:-dz,yaw:0});__mall.step(ms)}',[dx/d,dz/d,max(17,min(100,d/2.65*1000))])
 else:raise AssertionError(('route obstructed',x,z,state(page)))
 page.evaluate('__mall.setInput({forward:0});__mall.step(20)')

def approach_published_seat(page, index, seat):
 """Walk around furniture to the authored exit point with collisions enabled."""
 if index < 4:
  page.evaluate('__mall.teleport("atrium")')
  if seat['facing'] == 1:
   # The kiosk obstructs the old x=-5.7 route; pass between it and the plinth.
   aisle = -3 if seat['x'] < 0 else 3
   move(page, aisle, 12)
   move(page, aisle, seat['exitZ'])
  else:
   move(page, -2, seat['exitZ'])
 else:
  center = 0 if index < 6 else 10
  page.evaluate('zone=>__mall.teleport(zone)', 'mili' if index < 6 else 'gogo')
  x = center + (-1.4 if seat['x'] < center else 1.4)
  move(page, x, 2.4)
  move(page, x, seat['exitZ'])
 move(page, seat['exitX'], seat['exitZ'])

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--capture-only',action='store_true');ap.add_argument('--stores-only',action='store_true');ap.add_argument('--indices');ap.add_argument('--width',type=int,default=390);args=ap.parse_args();out=ROOT.parent/'evidence/v11-all-seats';out=out/'landscape' if args.width==844 else out;out.mkdir(exist_ok=True);s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();rows=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[f'--use-angle={os.environ.get("GALLERY_WEBGL_BACKEND","swiftshader")}','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':args.width,'height':390 if args.width==844 else 680},has_touch=True,reduced_motion='no-preference');ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click();closed(page);page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.locator('#product-close').click();page.locator('#view-toggle').click();seats=state(page)['seats'];assert len(seats)==8 and len({s['id'] for s in seats})==8
   for i,seat in enumerate(seats):
    if args.indices and i not in [int(n) for n in args.indices.split(',')]:continue
    if args.stores_only and i<4:continue
    if args.capture_only and i not in [0,2]:continue
    approach_published_seat(page,i,seat)
    assert state(page)['nearby']==seat['id'],state(page);page.evaluate('__mall.setInput({forward:0,yaw:.3,pitch:.2});__mall.step(20)');viewBefore=state(page);page.locator('#inspect').click();page.evaluate('__mall.setInput({forward:0});__mall.step(350)');assert state(page)['seatPhase']=='sit',state(page)
    if args.capture_only:
     page.screenshot(path=str(out/f'phase-{i+1}-0.png'))
     for sample in range(1,4):
      page.evaluate('__mall.step(216.7)');page.screenshot(path=str(out/f'phase-{i+1}-{sample}.png'))
    else:page.evaluate('__mall.step(200)')
    mid=state(page);assert 0<mid['character']['seatWeight']<1
    if i in [0,2,4,6]:page.screenshot(path=str(out/f'mid-{i+1}.png'))
    page.evaluate('__mall.step(800)');a=state(page);assert a['seatPhase']=='seated' and a['seatId']==seat['id'];assert a['cameraFocus']=='seat' and a['cameraDistance']>=5;assert abs(a['facing']-(0 if seat['facing']==1 else 3.14159265))<.01;page.screenshot(path=str(out/f'seated-{i+1}.png'))
    page.locator('#inspect').click();page.evaluate('__mall.setInput({forward:1});__mall.step(300)');a=state(page);assert a['seatPhase']=='stand' and 0<a['character']['seatWeight']<1;
    if args.capture_only:
     page.screenshot(path=str(out/f'stand-{i+1}-1.png'));page.evaluate('__mall.step(300)');page.screenshot(path=str(out/f'stand-{i+1}-2.png'));page.evaluate('__mall.step(400)');page.screenshot(path=str(out/f'stand-{i+1}-3.png'))
    else:page.evaluate('__mall.step(700)')
    a=state(page);assert not a['seated'] and a['seatPhase']=='idle';assert a['cameraFocus'] is None and a['cameraDistance']>3.2 and abs(a['yaw']-viewBefore['yaw'])<.001 and abs(a['pitch']-viewBefore['pitch'])<.001;assert abs(a['z']-seat['exitZ'])<.05 and a['character']['carrying']['count']==1
    rows.append({'id':seat['id'],'approachTransitionStand':'PASS'})
   # Reverse from intermediate sitting progress, not from a teleported endpoint.
   page.locator('#inspect').click();page.evaluate('__mall.setInput({forward:0});__mall.step(650)');before=state(page);page.locator('#scene').focus();page.keyboard.press('Escape');after=state(page);assert abs(after['z']-before['z'])<.01;page.evaluate('__mall.step(200)');assert state(page)['character']['seatWeight']<before['character']['seatWeight'];page.locator('#bag-open').click();paused=state(page);page.evaluate('__mall.step(400)');assert state(page)['character']['seatWeight']==paused['character']['seatWeight'];page.keyboard.press('Escape');assert state(page)['seated'];page.locator('#scene').focus();page.keyboard.press('Escape');page.evaluate('__mall.step(900)');assert not state(page)['seated'];rows.append({'reverseContinuousModalPauseRepeatedCancel':'PASS'})
   page.locator('#inspect').click();page.evaluate('__mall.setInput({forward:0});__mall.step(500)');page.locator('#bag-open').click();assert page.locator('#cart-toggle').is_disabled();page.locator('#bag-close').click();page.locator('#view-toggle').click();assert not state(page)['seated'] and state(page)['seatId'] is None;page.locator('#view-toggle').click();page.evaluate('__mall.step(20)');page.locator('#inspect').click();page.evaluate('__mall.setInput({forward:0});__mall.step(500)');page.evaluate('__mall.teleport("atrium")');assert not state(page)['seated'] and state(page)['character']['seatWeight']==0;rows.append({'transitionListTeleportResetCartBlocked':'PASS'});b.close()
 finally:s.shutdown()
 (out/(f'subset-{args.indices}-{args.width}-report.json' if args.indices else 'stores-report.json' if args.stores_only else 'capture-report.json' if args.capture_only else 'live-report.json' if args.url else 'report.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
if __name__=='__main__':run()
