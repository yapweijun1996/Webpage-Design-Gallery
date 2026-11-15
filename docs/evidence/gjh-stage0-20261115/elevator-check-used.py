import json, sys
from pathlib import Path
sys.path.insert(0,'/tmp/gjh-stage0-wH3H0BrK/current/tests')
from browser_gjh_all_seats import move
from playwright.sync_api import sync_playwright
out=Path('/tmp/gjh-stage0-wH3H0BrK/current-captures')
base='http://127.0.0.1:8771/demos/corporate/gjh/v11/'
rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
 for width,height in [(1440,900),(390,844)]:
  c=b.new_context(viewport={'width':width,'height':height},device_scale_factor=2,has_touch=width<1000,service_workers='block');page=c.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto(base);page.wait_for_function('window.__mall?.ready&&window.__sceneReady',timeout=90000)
   page.locator('#guide-start').click();page.locator('[data-ob-action=skip]').click();page.wait_for_function('!__mall.state.paused')
   page.evaluate('__mall.teleport("atrium")');move(page,0,15)
   s=page.evaluate('__mall.state');assert s['nearby']=='visitor-elevator',s['nearby']
   page.screenshot(path=str(out/f'elevator-ground-v2-{width}.png'),scale='css')
   page.locator('#scene').focus();page.keyboard.press('f');page.evaluate('__mall.step(4000)')
   up=page.evaluate('__mall.state');assert up['y']>7 and not up['elevatorTravel'],(up['y'],up['elevatorTravel'])
   page.screenshot(path=str(out/f'elevator-upper-v2-{width}.png'),scale='css')
   assert up['nearby']=='visitor-elevator',up['nearby']
   page.locator('#scene').focus();page.keyboard.press('f');page.evaluate('__mall.step(4000)')
   down=page.evaluate('__mall.state');assert abs(down['y'])<.1 and not down['elevatorTravel'],(down['y'],down['elevatorTravel'])
   rows.append({'viewport':[width,height],'upY':up['y'],'downY':down['y'],'roundTrip':'PASS','errors':errors})
   print(json.dumps(rows[-1]),flush=True)
  except Exception as e:
   rows.append({'viewport':[width,height],'failure':str(e),'errors':errors});print(json.dumps(rows[-1]),flush=True)
  finally:c.close()
 b.close()
(out/'elevator-results.json').write_text(json.dumps(rows,indent=2)+'\n')
sys.exit(1 if any('failure' in x or x.get('errors') for x in rows) else 0)
