import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base = 'http://127.0.0.1:8772/demos/corporate/gjh/v11/index.html'
out = Path('/tmp/gjh-stage0-wH3H0BrK/latest-captures')
out.mkdir(exist_ok=True)
rows = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args=['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    browser_version=browser.version
    for width,height in [(1440,900),(768,1024),(639,826),(390,844),(320,568)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,has_touch=width<1000,service_workers='block')
        page=ctx.new_page(); errors=[]; warnings=[]; failed=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: (errors if m.type=='error' else warnings).append(m.text) if m.type in ('error','warning') else None)
        page.on('requestfailed', lambda r: failed.append({'url':r.url,'failure':r.failure}))
        try:
            page.goto(base,wait_until='domcontentloaded',timeout=90000)
            page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=90000)
            observed_ms=page.evaluate('performance.now()')
            page.locator('#guide-start').click(timeout=15000)
            page.locator('[data-ob-action=skip]').click(timeout=15000)
            page.wait_for_function('!__mall.state.paused')
            page.evaluate('__mall.setInput({}); __mall.step(17)')
            page.screenshot(path=str(out/f'atrium-v2-{width}.png'),scale='css')
            metrics=page.evaluate('''async () => {
              __mall.setInput(null);
              const a=[]; let prev;
              for(let i=0;i<121;i++) await new Promise(r=>requestAnimationFrame(t=>{if(prev!==undefined)a.push(t-prev);prev=t;r()}));
              a.sort((x,y)=>x-y);
              const s=__mall.state, es=performance.getEntriesByType('resource');
              const c=document.querySelector('#scene'), gl=c.getContext('webgl2'), ext=gl.getExtension('WEBGL_debug_renderer_info');
              return {drawCalls:s.drawCalls,triangles:s.renderTriangles,resources:s.rendererResources,graphics:s.graphics,
                frames:s.frames,raf:{n:a.length,medianMs:a[60],p95Ms:a[113]},renderBackend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,
                entries:es.length,transferBytes:es.reduce((n,e)=>n+e.transferSize,0),decodedBytes:es.reduce((n,e)=>n+e.decodedBodySize,0),
                overflow:document.documentElement.scrollWidth>innerWidth,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};
            }''')
            row={'viewport':[width,height],'readyObservedMs':round(observed_ms,1),'metrics':metrics,'stores':{},'errors':errors,'warnings':warnings,'failedRequests':failed}
            for zone in ('newmoon','mili','gogo'):
                ok=page.evaluate('(z)=>__mall.teleport(z)',zone)
                page.evaluate('__mall.setInput({});__mall.step(17)')
                state=page.evaluate('__mall.state')
                row['stores'][zone]={'teleportReturn':ok,'actualZone':state['zone'],'x':state['x'],'z':state['z'],'drawCalls':state['drawCalls']}
                if width in (1440,390):page.screenshot(path=str(out/f'{zone}-v2-{width}.png'),scale='css')
            page.locator('#view-toggle').click()
            row['directory']={'visible':page.locator('#store-list').is_visible(),'products':page.locator('.product-card').count()}
            if width in (1440,390): page.screenshot(path=str(out/f'directory-v2-{width}.png'),scale='css')
            rows.append(row)
            print(json.dumps({'width':width,'readyObservedMs':row['readyObservedMs'],'drawCalls':metrics['drawCalls'],'raf':metrics['raf'],'errors':errors,'failedRequests':failed,'stores':row['stores']}),flush=True)
        except Exception as e:
            print(json.dumps({'width':width,'failure':str(e),'errors':errors,'failedRequests':failed}),flush=True)
            rows.append({'viewport':[width,height],'failure':str(e),'errors':errors,'warnings':warnings,'failedRequests':failed})
        finally: ctx.close()
    browser.close()
(out/'results.json').write_text(json.dumps({'browserVersion':browser_version,'backendRequested':'ANGLE Metal','dpr':2,'serviceWorkers':'blocked','source':'isolated snapshot served over localhost','notes':'rAF is an interval sample, not device FPS or frame-time; readyObservedMs includes polling after DOMContentLoaded','rows':rows},indent=2)+'\n')
sys.exit(1 if any('failure' in row for row in rows) else 0)
