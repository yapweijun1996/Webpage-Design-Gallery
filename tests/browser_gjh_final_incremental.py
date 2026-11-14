"""Final incremental performance/accessibility audit after the 1.1.14 preview integration."""
from browser_gjh_budget import ROOT,Quiet,functools,http,threading,sync_playwright,os,json
from pathlib import Path

def run():
 out=ROOT.parent/'evidence'/'v11-final-incremental';out.mkdir(parents=True,exist_ok=True)
 axe=Path(os.environ.get('GALLERY_AXE',ROOT.parent/'qa-tools/package/axe.min.js'))
 assert axe.is_file(),'Provide audited axe-core through GALLERY_AXE'
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for width,height in [(320,740),(768,1024)]:
    page=browser.new_page(viewport={'width':width,'height':height},has_touch=True,reduced_motion='reduce',service_workers='block');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000)
    initial=page.evaluate('performance.getEntriesByType("resource").map(e=>({path:new URL(e.name).pathname,bytes:e.decodedBodySize}))')
    size=sum(r['bytes'] for r in initial);assert size<=10*1024*1024 and len(initial)<=45,(size,len(initial))
    page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"');page.evaluate('__mall.setInput({})')
    calls={}
    for zone in ['atrium','newmoon','mili','gogo']:
     page.evaluate('(z)=>{__mall.teleport(z);__mall.step(17)}',zone);calls[zone]=page.evaluate('__mall.state.drawCalls')
    assert max(calls.values())<=200
    page.locator('#view-toggle').click();page.add_script_tag(path=str(axe))
    cycles=[];a11y=[]
    for n in range(5):
     page.locator('[data-inspect="new-moon-mx-454g-front"]').click()
     if n==0:
      res=page.evaluate("async()=>await axe.run(document.querySelector('#product-dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
      assert not res['violations'],res['violations'];a11y.append({'mode':'image','violations':[],'incomplete':[r['id'] for r in res['incomplete']]})
     page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded')
     before=page.evaluate('__mall.state.frames');page.wait_for_timeout(150);assert page.evaluate('__mall.state.frames')==before
     if n==0:
      res=page.evaluate("async()=>await axe.run(document.querySelector('#product-dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
      assert not res['violations'],res['violations'];a11y.append({'mode':'3d','violations':[],'incomplete':[r['id'] for r in res['incomplete']]})
      for button in page.locator('#product-dialog button:visible').all():
       b=button.bounding_box();assert b['width']>=44 and b['height']>=44,(button.get_attribute('id'),b)
      assert page.evaluate('document.querySelector("#product-dialog").scrollWidth<=document.querySelector("#product-dialog").clientWidth+1')
      page.locator('#product-close').focus();page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.id')=='product-shop';page.keyboard.press('Tab');assert page.evaluate('document.activeElement.id')=='product-close'
      page.evaluate('document.querySelector("#product-dialog").scrollTop=0');page.screenshot(path=str(out/f'preview-{width}.png'))
     page.keyboard.press('Escape');page.wait_for_function('__newMoonPreview.state.activeResources===0 && !document.querySelector("#product-dialog").open')
     cycles.append(page.evaluate('__newMoonPreview.state'))
    assert not errors,errors
    results.append({'viewport':[width,height],'readyDecodedBytes':size,'readyResourceCount':len(initial),'resources':initial,'drawCalls':calls,'axe':a11y,'fiveCloseCycles':cycles,'mallPausedDuringDetails':True,'errors':errors});page.close()
   version=browser.version;browser.close()
 finally:server.shutdown()
 report={'baseline':'1.1.13 docs/evidence/v11-newmoon-budget.json','runtimeVersion':'1.1.14','environment':'Linux ARM64 Chromium '+version+' / SwiftShader; local uncompressed HTTP, reduced motion, fresh contexts','axeVersion':'4.10.3','limitations':['Decoded resource bytes exclude document/deferred loads, not wire bytes or GPU memory','Axe is not a screen-reader or physical-device audit','Resource cleanup uses app counters and real context teardown, not driver heap instrumentation'],'results':results}
 (out/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if __name__=='__main__':run()
