import json, sys
from pathlib import Path
sys.path.insert(0,'/tmp/gjh-stage0-wH3H0BrK/current/tests')
from browser_gjh_modes import approach_seat
from playwright.sync_api import sync_playwright
out=Path('/tmp/gjh-stage0-wH3H0BrK/current-captures')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 c=b.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce',service_workers='block');page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8771/demos/corporate/gjh/v11/');page.wait_for_function('window.__mall?.ready&&window.__sceneReady',timeout=90000)
 page.locator('#guide-start').click();page.locator('[data-ob-action=skip]').click();page.wait_for_function('!__mall.state.paused')
 page.evaluate('''()=>{__mall.teleport('atrium');__mall.setInput({right:-1});__mall.step(1400);__mall.setInput({forward:1});__mall.step(1400);__mall.setInput({right:-1});__mall.step(750);__mall.setInput({forward:0});__mall.step(20)}''')
 state=page.evaluate('__mall.state'); first={k:state[k] for k in ('x','z','nearby','seated','interaction')};page.screenshot(path=str(out/'seat-scripted-route-390.png'),scale='css')
 result={'originalRoute':first,'originalExpected':'courtyard-seat','alternateRoute':None,'errors':errors}
 try:
  approach_seat(page); state=page.evaluate('__mall.state');result['alternateRoute']={k:state[k] for k in ('x','z','nearby','seated')}
  page.locator('#inspect').click();page.evaluate('__mall.step(40)');result['alternateSeated']=page.evaluate('__mall.state.seated')
  page.locator('#inspect').click();page.evaluate('__mall.step(1000)');result['alternateStood']=not page.evaluate('__mall.state.seated')
 except Exception as e:result['alternateError']=str(e)
 print(json.dumps(result,indent=2),flush=True);(out/'seat-diagnostic.json').write_text(json.dumps(result,indent=2)+'\n');c.close();b.close()
