import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/gjh-stage0-wH3H0BrK/current-captures')
rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--enable-unsafe-swiftshader'])
 for w,h in [(320,568),(390,844),(639,826),(768,1024),(1440,900)]:
  c=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2,has_touch=w<1000,service_workers='block');pge=c.new_page();pge.goto('http://127.0.0.1:8771/demos/corporate/gjh/v11/');pge.wait_for_function('window.__mall?.ready&&window.__sceneReady',timeout=90000);pge.locator('#guide-start').click();pge.locator('[data-ob-action=skip]').click();pge.wait_for_function('!__mall.state.paused')
  data=pge.evaluate('''()=>{const e=document.querySelector('#view-toggle'),r=e.getBoundingClientRect(),parent=e.parentElement,ps=getComputedStyle(parent),s=getComputedStyle(e);return {innerWidth,scrollWidth:document.documentElement.scrollWidth,button:{left:r.left,right:r.right,width:r.width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,text:e.innerText,overflow:s.overflow,textOverflow:s.textOverflow},headerOverflow:ps.overflow,visiblyOutside:r.right>innerWidth||r.left<0}}''')
  rows.append(data);print(json.dumps(data),flush=True);c.close()
 b.close()
(out/'header-results.json').write_text(json.dumps(rows,indent=2)+'\n')
