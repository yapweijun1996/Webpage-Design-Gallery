"""Actual mall integration: nonblocking progress and standard gamepad adapter."""
from browser_gjh_guide import *
from browser_gjh_all_seats import move

def run():
 OUT.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[f'--use-angle={os.environ.get("GALLERY_WEBGL_BACKEND","swiftshader")}', '--enable-unsafe-swiftshader'])
   page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script("""window.padState={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.padState?[window.padState]:[]});""")
   page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/',wait_until='domcontentloaded',timeout=60000)
   page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=90000);guide(page)
   initial=state(page);page.evaluate('padState.axes[2]=.5');page.wait_for_function('document.querySelector("#guide-dialog .ob-mode").textContent==="Gamepad"')
   assert state(page)['x']==initial['x'] and state(page)['z']==initial['z']
   page.evaluate('padState.axes[2]=0');page.locator('#guide-start').click();closed(page)
   page.locator('.ob-tip').wait_for(state='visible');page.wait_for_function('document.activeElement.id==="scene"')
   page.evaluate('padState.axes[1]=-1');page.wait_for_function('z=>__mall.state.z<z-.12',arg=initial['z']);page.evaluate('padState.axes[1]=0')
   page.wait_for_function('document.querySelector(".ob-tip h3").textContent==="Look around"')
   page.screenshot(path=str(OUT/'tutorial-look-desktop.png'))
   page.evaluate('padState.axes[2]=.8');page.wait_for_function('Math.abs(__mall.state.yaw)>.12');page.evaluate('padState.axes[2]=0')
   page.wait_for_function('document.querySelector(".ob-tip h3").textContent==="Inspect"')
   # Let the real frame loop consume the neutral stick before manual stepping;
   # otherwise its last sampled look input continues turning during the fixture.
   page.evaluate('''async () => {await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)}''')
   page.evaluate('__mall.teleport("mili")')
   # Arrange proximity by walking around the table with the normal collider.
   move(page,1.4,-3.5);move(page,1.4,-7.8);move(page,0,-7.8)
   page.evaluate('__mall.setInput(null)')
   page.wait_for_function('__mall.state.nearby==="mili"');page.evaluate('padState.buttons[0].pressed=true')
   page.locator('#product-dialog').wait_for(state='visible');page.evaluate('padState.buttons[0].pressed=false')
   page.locator('#product-close').click();page.wait_for_function('!document.querySelector("#product-dialog").open')
   page.wait_for_function('document.querySelector(".ob-tip h3").textContent==="You’re ready!"')
   # The current scene suppresses tutorial tips while an interaction prompt owns
   # the HUD. Walk clear so the real completion control is visible again.
   move(page,1.4,-7.8);move(page,1.4,-3.5);page.evaluate('__mall.setInput(null)')
   page.wait_for_function('!__mall.state.nearby')
   page.get_by_role('button',name='Keep exploring',exact=True).click()
   page.evaluate('padState.buttons[9].pressed=true');page.wait_for_function('document.querySelector("#keyboard-help").open');page.evaluate('padState.buttons[9].pressed=false')
   page.wait_for_timeout(50)
   page.evaluate('padState.buttons[1].pressed=true');page.wait_for_function('!document.querySelector("#keyboard-help").open');page.evaluate('padState.buttons[1].pressed=false')
   page.locator('#keyboard-help').evaluate('el=>el.open=true');page.locator('#guide-reopen').click();guide(page)
   page.locator('#guide-show-next').uncheck();page.keyboard.press('Escape');closed(page)
   page.evaluate('sessionStorage.removeItem("gjh-v11-guide-seen-v1")')
   page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=90000)
   assert not page.locator('#guide-dialog').is_visible()
   page.locator('#keyboard-help').evaluate('el=>el.open=true');page.locator('#guide-reopen').click();guide(page)
   assert not page.locator('#guide-show-next').is_checked()
   page.keyboard.press('Escape');closed(page)
   page.evaluate('padState=null');page.wait_for_timeout(100);stopped=state(page);page.wait_for_timeout(100)
   after=state(page);assert abs(after['x']-stopped['x'])<.001 and abs(after['z']-stopped['z'])<.001
   assert not errors,errors
   browser.close()
 finally:server.shutdown()
 result={'gamepadMovementCameraInspect':'PASS','modalInputIsolation':'PASS','nonblockingRealActionProgress':'PASS','menuBackAndDisconnect':'PASS','autoWelcomePreferenceAndManualReplay':'PASS','pageErrors':errors,'limitation':'Synthetic standard-controller snapshots through the actual application frame loop; physical controller not tested.'}
 (OUT/'integration-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':run()
