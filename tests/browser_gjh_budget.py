"""Reproducible laboratory payload, rendering and modal-lifecycle audit for V11."""
from gjh_startup_test_helpers import mall_entry_url
import argparse,functools,http.server,json,os,platform,threading,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_lift import save
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'evidence'/'v11-budget'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass

def run(out=OUT):
 backend=os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader')
 out.mkdir(parents=True,exist_ok=True);server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}';url=base+'/demos/corporate/gjh/v11/';results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+backend,'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   for width,height in [(320,740),(390,844),(768,1024),(1440,900),(844,390)]:
    context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',service_workers='block');page=context.new_page();external=[];errors=[]
    page.on('request',lambda r:external.append(r.url) if r.url.startswith('http') and not r.url.startswith(base+'/') else None);page.on('pageerror',lambda e:errors.append(str(e)))
    start=time.monotonic();page.goto(mall_entry_url(url));page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000);page.locator('#guide-card').wait_for(state='visible');ready_ms=round((time.monotonic()-start)*1000)

    initial=page.evaluate('performance.getEntriesByType("resource").map(e=>({path:new URL(e.name).pathname,bytes:e.decodedBodySize}))');assert not any('original-demo-food-tin.glb' in r['path'] for r in initial),'Original tin must remain lazy'
    save(out/f'ready-{width}x{height}.json',{'viewport':[width,height],'resources':initial,'count':len(initial),'decodedBytes':sum(r['bytes'] for r in initial)})
    assert sum(r['bytes'] for r in initial)<=10*1024*1024,'Ready-stage decoded payload exceeds 10 MiB laboratory budget'
    assert len(initial)<=45,'Ready-stage resource count exceeds 45'
    page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#scene').focus();page.wait_for_function('document.querySelector("#guide-card").hidden && document.activeElement.id==="scene"');page.evaluate('__mall.setInput({});__mall.step(17)')
    calls={}
    for zone in ['atrium','newmoon','mili','gogo']:
     page.evaluate('(z)=>{__mall.teleport(z);__mall.step(17)}',zone);calls[zone]=page.evaluate('__mall.state.drawCalls')
    assert max(calls.values())<=200,calls
    # The header owns compact Map opening; its hidden details summary is not a control.
    compact=page.evaluate("matchMedia('(max-width: 650px), (max-height: 560px) and (orientation: landscape)').matches")
    if compact:
     assert page.locator('#header-map').is_visible()
     page.locator('#header-map').click()
     assert page.locator('#mall-map').evaluate('e=>e.open')
     for target in page.locator('[data-teleport]').all():
      box=target.bounding_box();assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=height,box
      assert target.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'),'Map target obstructed'
     run=page.locator('#run-toggle')
     # Compact panels pause exploration and intentionally hide movement controls.
     run.wait_for(state='hidden')
     assert run.is_hidden(),'Run must be hidden while the compact map is open'
     page.screenshot(path=str(out/f'map-{width}x{height}.png'))
     page.locator('#map-close').click()
     run.wait_for(state='visible')
     assert run.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'),'Run obstructed after closing map'
     run.click();assert run.get_attribute('aria-pressed')=='true';run.click();assert run.get_attribute('aria-pressed')=='false'
     for selector in ['#keyboard-help > summary','#header-map','#run-toggle']:
      box=page.locator(selector).bounding_box();assert box and box['width']>=44 and box['height']>=44,(selector,box)

    page.locator('#view-toggle').click();page.locator('#store-list').wait_for(state='visible');before=page.evaluate('__mall.state.frames');page.wait_for_timeout(250);assert page.evaluate('__mall.state.frames')==before,'List must pause mall rendering'
    # Repeated modal cycles exercise late disposal and avoid confusing HTTP cache with live GPU resources.
    cycles=[]
    for cycle in range(5):
     page.locator('#original-tin-open').click();page.wait_for_function('__originalTin.state.loaded',timeout=60000);loaded=page.evaluate('__originalTin.state');assert loaded['liveContexts']==1 and loaded['activeResources']==1,loaded
     page.locator('#original-tin-close').click();page.wait_for_function('!document.querySelector("#original-tin-dialog").open && __originalTin.state.activeResources===0');closed=page.evaluate('__originalTin.state');assert closed['liveContexts']==0,closed;cycles.append({'activeResources':closed['activeResources'],'liveContexts':closed['liveContexts']})
    assert not errors and not external,(errors,external)
    results.append({'viewport':[width,height],'readyMsObserved':ready_ms,'coldResourceCount':len(initial),'coldDecodedBytes':sum(r['bytes'] for r in initial),'resources':initial,'drawCalls':calls,'mapTargets':'PASS' if compact else 'not-applicable','compactMapControls':'PASS' if compact else 'not-applicable','fiveCloseCycles':cycles,'guideAndListRenderPause':'PASS','externalRequests':external,'pageErrors':errors});context.close()
   version=browser.version;browser.close()
 finally:server.shutdown()
 report={'environment':f'{platform.system()} {platform.machine()}, Chromium/ANGLE {backend}, reduced motion, local uncompressed HTTP, fresh contexts, service workers blocked','browser':version,'limitations':['Ready times are observations, not production performance guarantees','Decoded payload is not compressed wire traffic or GPU memory','Not physical Android/iOS, Safari or screen-reader coverage'],'results':results}
 save(out/'report.json',report);print(json.dumps(report,indent=2))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--evidence',type=Path,default=OUT);run(parser.parse_args().evidence)
