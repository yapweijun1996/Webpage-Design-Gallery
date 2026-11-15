"""Local fixed-view frame/resource observations; not field FPS certification."""
import functools
import http.server
import json
import os
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_interior_pilot import ROOT, Handler, gallery, boot, state, FILES

def run():
    results=[]
    with tempfile.TemporaryDirectory(prefix='gjh-pilot-perf-') as tmp:
        gallery.build(Path(tmp)/'site')
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=tmp))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with sync_playwright() as p:
                browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=['--use-angle=metal','--ignore-gpu-blocklist'])
                for width,height in ((390,844),(639,826),(1440,1000)):
                    context=browser.new_context(viewport={'width':width,'height':height},service_workers='block',reduced_motion='reduce')
                    page,errors,_=boot(context,f'http://127.0.0.1:{server.server_port}/site/demos/corporate/gjh/v11/?interior=pilot')
                    times=page.evaluate("""()=>new Promise(resolve=>{let last;const times=[];function tick(now){if(last)times.push(now-last);last=now;if(times.length<120)requestAnimationFrame(tick);else resolve(times)}requestAnimationFrame(tick)})""")
                    times.sort();current=state(page)
                    resources=page.evaluate("""names=>performance.getEntriesByType('resource').filter(r=>names.some(n=>r.name.endsWith('/'+n))).map(r=>({name:r.name.split('/').pop(),decodedBytes:r.decodedBodySize,transferBytes:r.transferSize}))""",list(FILES.values()))
                    assert len(resources)==8 and sum(r['decodedBytes'] for r in resources)==1097696,resources
                    assert current['drawCalls']<=200 and not errors,current
                    results.append({'width':width,'drawCalls':current['drawCalls'],'renderTriangles':current['renderTriangles'],'rendererResources':current['rendererResources'],'frameIntervalMs':{'median':times[60],'p95':times[113],'samples':120},'pilotResources':resources})
                    context.close()
                browser.close()
        finally:server.shutdown();server.server_close()
    (ROOT/'docs/evidence/interior-pilot-release-performance.json').write_text(json.dumps({'scope':'Headless Chrome ANGLE Metal, fixed startup view, 120 rAF intervals; no baseline timing or physical-device FPS comparison.','results':results},indent=2)+'\n')
    print('PILOT PERFORMANCE PASS',len(results))
if __name__=='__main__':run()
