"""Real Chromium input-capture interruption regression (not physical-device QA)."""
from browser_gjh_budget import ROOT, Quiet, functools, http, threading, sync_playwright, os, json
from pathlib import Path
import argparse

def run():
 parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--output',default=str(ROOT.parent/'evidence'/'v11-pointer'));args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();records=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for width,height in [(390,844),(844,390)]:
    page=browser.new_page(viewport={'width':width,'height':height},has_touch=True,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"')
    page.evaluate('''()=>{window.pointerEvents=[];for(const type of ['pointerdown','gotpointercapture','lostpointercapture'])scene.addEventListener(type,e=>pointerEvents.push({type,id:e.pointerId,trusted:e.isTrusted}));}''')
    cdp=page.context.new_cdp_session(page)
    def touch(kind,x=None,y=None):cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if x is None else [{'x':x,'y':y,'id':1}]})
    def advance():return page.evaluate('__mall.step(250)')
    # Stop the animation loop without replacing real input with injected movement.
    page.evaluate('__mall.step(0)')
    box=page.locator('#joystick').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2-26
    touch('touchStart',x,y);touch('touchMove',x,y-1)
    before=page.evaluate('__mall.state');moving=advance();assert moving['z']<before['z']-.2,'Joystick must first move'
    page.evaluate('scene.releasePointerCapture(pointerEvents.findLast(e=>e.type==="pointerdown").id)');touch('touchMove',x,y-2)
    page.wait_for_function('pointerEvents.some(e=>e.type==="lostpointercapture" && e.trusted)')
    stopped=page.evaluate('__mall.state');after=advance();delta=abs(after['z']-stopped['z'])+abs(after['x']-stopped['x'])
    print(json.dumps({'viewport':[width,height],'captureLossMovementDelta':delta,'events':page.evaluate('pointerEvents')}),flush=True)
    assert delta<.01,'Lost capture must stop joystick movement'
    assert page.locator('.joystick-thumb').evaluate('e=>e.style.transform')=='','Joystick must recenter'
    touch('touchEnd')
    # A fresh touch still works, and cancellation also clears movement.
    touch('touchStart',x,y);touch('touchMove',x,y-1);before=page.evaluate('__mall.state');moving=advance();assert moving['z']<before['z']-.2
    touch('touchCancel');stopped=page.evaluate('__mall.state');after=advance();assert abs(after['z']-stopped['z'])<.01
    # Actual mouse capture loss must stop camera rotation on later hover moves.
    page.mouse.move(width*.6,height*.55);page.mouse.down();page.mouse.move(width*.6+12,height*.55)
    yaw=page.evaluate('__mall.state.yaw');assert abs(yaw)>.01
    page.evaluate('scene.releasePointerCapture(pointerEvents.findLast(e=>e.type==="pointerdown").id)');page.mouse.move(width*.6+28,height*.55)
    assert abs(page.evaluate('__mall.state.yaw')-yaw)<.0001,'Lost capture must stop camera drag';page.mouse.up()
    # Keyboard movement remains available after either interruption.
    page.locator('#scene').focus();before=page.evaluate('__mall.state');page.keyboard.down('ArrowUp');after=advance();page.keyboard.up('ArrowUp');assert abs(after['z']-before['z'])>.2
    assert not errors,errors
    records.append({'viewport':[width,height],'joystickLossStops':'PASS','joystickCancelStops':'PASS','freshTouchRecovers':'PASS','mouseLossStopsDrag':'PASS','keyboardRecovers':'PASS','events':page.evaluate('pointerEvents'),'errors':errors});page.close()
   browser.close()
 finally:server.shutdown()
 (out/'report.json').write_text(json.dumps({'environment':'Linux ARM64 Chromium/SwiftShader; real browser CDP touch/mouse inputs and explicit capture release; not physical devices','results':records},indent=2));print(json.dumps(records,indent=2))
if __name__=='__main__':run()
