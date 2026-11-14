"""Focused real touch evidence for anywhere-origin movement and independent look."""
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--live',action='store_true');args=ap.parse_args();out=ROOT.parent/'evidence/v11-floating-stick';out.mkdir(exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();records=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.live else [(390,680),(844,390)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=True,reduced_motion='reduce');ready(page,args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.screenshot(path=str(out/f'guide-{w}.png'));page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"');page.evaluate('__mall.step(0)')
    cdp=page.context.new_cdp_session(page);points={}
    def send(kind):
     cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':list(points.values())})
     page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    def down(i,x,y):points[i]={'id':i,'x':x,'y':y};send('touchStart')
    def move(i,x,y):points[i]={'id':i,'x':x,'y':y};send('touchMove')
    def up(i):
     ended=points.pop(i);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[ended]})
     page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    def tick():return page.evaluate('__mall.step(400)')
    def stopped(before):
     after=tick();assert abs(after['x']-before['x'])<1e-5 and abs(after['z']-before['z'])<1e-5 and after['yaw']==before['yaw'],{k:after[k]-before[k] for k in ['x','z','yaw']}
    bounds=page.locator('#scene').bounding_box();y=bounds['y']+bounds['height']*.42
    for fraction in [.12,.5,.88]:
     page.evaluate('__mall.teleport("atrium")');x=w*fraction;assert page.evaluate('([x,y])=>document.elementFromPoint(x,y).id',[x,y])=='scene'
     before=state(page);down(1,x,y);tick();stopped(before);move(1,x,y-40);after=tick();assert after['z']<before['z']-.5 and after['yaw']==before['yaw']
     if fraction==.88:page.screenshot(path=str(out/f'{"live" if args.live else "after"}-{w}.png'))
     up(1);stopped(state(page));assert not page.locator('#joystick').evaluate('e=>e.classList.contains("is-floating")')
    page.evaluate('__mall.teleport("atrium")');x=w*.25;down(1,x,y);down(2,w*.7,y);move(1,x,y-35);move(2,w*.8,y);s=tick();assert s['z']<11.5 and s['yaw']<-.1,s
    # Third finger does not alter either assigned role.
    down(3,w*.55,y+45);move(3,w*.6,y+70);assert state(page)['yaw']==s['yaw'];up(3)
    # Releasing movement must not promote the remaining look finger to movement.
    up(1);s=state(page);move(2,w*.83,y);t=tick();assert abs(t['x']-s['x'])<1e-5 and abs(t['z']-s['z'])<1e-5 and t['yaw']!=s['yaw'];up(2);stopped(state(page))
    # Cancel and lost capture each clear movement; a new gesture starts normally.
    down(1,x,y);move(1,x,y-40);tick();points.clear();send('touchCancel');stopped(state(page))
    page.evaluate('window.lastTouchPointer=null;document.querySelector("#scene").addEventListener("pointerdown",e=>window.lastTouchPointer=e.pointerId,{once:true})');down(1,x,y);move(1,x,y-40);tick();page.evaluate('document.querySelector("#scene").releasePointerCapture(window.lastTouchPointer)');move(1,x,y-50);stopped(state(page));up(1)
    # HUD clicks remain HUD actions, and a modal absorbs new touches.
    s=state(page);page.locator('#run-toggle').tap();stopped(s);assert page.locator('#run-toggle').get_attribute('aria-pressed')=='true';page.locator('#run-toggle').tap()
    reopen(page);s=state(page);down(1,5,5);move(1,35,25);up(1);stopped(s);page.locator('#guide-close').click();closed(page)
    page.locator('#keyboard-help').evaluate('e=>e.open=false');page.locator('#scene').focus();page.evaluate('__mall.step(0)')
    down(1,x,y);move(1,x,y-40);tick();page.set_viewport_size({'width':w,'height':h-30});page.wait_for_function('!document.querySelector("#joystick").classList.contains("is-floating")');stopped(state(page));points.clear();send('touchCancel')
    records.append({'viewport':[w,h],'leftCenterRightOrigins':'PASS','tapDeadzone':'PASS','twoTouchRolesAndThirdIgnored':'PASS','releaseCancelLostCaptureResize':'PASS','runAndModalIsolation':'PASS'});page.close()
   b.close()
 finally:server.shutdown()
 (out/('live-report.json' if args.live else 'report.json')).write_text(json.dumps(records,indent=2));print(json.dumps(records,indent=2))
if __name__=='__main__':run()
