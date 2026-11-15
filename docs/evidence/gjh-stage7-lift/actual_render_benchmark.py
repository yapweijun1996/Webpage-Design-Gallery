"""Paired real autorender-loop intervals, requiring advancing render counters."""
import json,sys,subprocess,tarfile,io,functools,http.server,threading,tempfile,statistics,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path('/private/tmp/gallery-expanded-stage7/primary/final-copy');REPO=Path('/private/tmp/gallery-task-lod');OUT=Path('/private/tmp/gallery-expanded-stage7/primary/actual-render');OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT/'tests'));from browser_gjh_interior_pilot import Handler,boot,state,gallery
from browser_gjh_lift import save
result={'scope':'Clean sequential native Metal, instrumented real autorender-loop intervals; 30 advancing-render warmup frames then120distinct rendered frames/state. No GPU timer-query, fieldFPS, physicaldevice or throughput certification.','samples':[]}
def capture(page):
 page.evaluate('()=>__mall.setInput(null)')
 page.evaluate('()=>new Promise(resolve=>{let first=__mall.state.frames;function tick(){if(__mall.state.frames-first>=30)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)})')
 rows=page.evaluate('''()=>new Promise(resolve=>{let previousTime,previousFrame;const rows=[];function tick(now){const s=__mall.state;if(previousTime!==undefined)rows.push({ms:now-previousTime,frame:s.frames,advance:s.frames-previousFrame,calls:s.drawCalls,triangles:s.renderTriangles,resources:s.rendererResources});previousTime=now;previousFrame=s.frames;if(rows.length<120)requestAnimationFrame(tick);else resolve(rows)}requestAnimationFrame(tick)})''')
 assert len(rows)==120 and all(v['advance']>=1 for v in rows),('non-advancing render frame',rows)
 intervals=sorted(v['ms'] for v in rows);return {'frames':rows,'medianMs':statistics.median(intervals),'p95Ms':intervals[113],'minRenderAdvance':min(v['advance'] for v in rows),'renderCounterRange':[rows[0]['frame'],rows[-1]['frame']],'maxCalls':max(v['calls'] for v in rows),'maxTriangles':max(v['triangles'] for v in rows),'resourcesFinal':rows[-1]['resources']}
source={str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (REPO/'demos/corporate/gjh/v11').rglob('*') if p.is_file()}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
 for phase in ('baselinef1-classic','baselinef1-expanded','current-classic','current-expanded'):
  with tempfile.TemporaryDirectory(prefix='shell-real-render-') as temp:
   site=Path(temp)/'site';gallery.build(site)
   if phase.startswith('baselinef1'):
    archive=subprocess.check_output(['git','archive','f1e210856a98e29220c8a0ebb38dbc9ab7ca3b50','demos/corporate/gjh/v11','assets/onboarding','design-system/onboarding'],cwd=REPO)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
     for member in tar:
      if member.isfile():path=site/member.name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(tar.extractfile(member).read())
   server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=temp));threading.Thread(target=server.serve_forever,daemon=True).start()
   try:
    for width,height,quality in ((390,844,'auto'),(1440,900,'detailed')):
     context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',service_workers='block');context.add_init_script('localStorage.setItem("gjh-v11-graphics-quality-v1",'+json.dumps(quality)+')')
     page,errors,_=boot(context,f'http://127.0.0.1:{server.server_port}/site/demos/corporate/gjh/v11/'+('?layout=expanded' if phase.endswith('expanded') else ''))
     for cart in (False,True):
      if cart:
       page.locator('#view-toggle').click();page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.keyboard.press('Escape');page.locator('#view-toggle').click();page.locator('#bag-open').click();page.locator('#cart-toggle').click();assert state(page)['pushing']
      measurement=capture(page);s=state(page)
      if phase.startswith('current'):assert measurement['maxCalls']<=200,measurement
      row={'phase':phase,'viewport':[width,height],'preference':quality,'cartActive':cart,'quality':s['graphics']['quality'],'shadows':s['graphics']['shadows'],'hardware':page.evaluate('()=>({cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory,dpr:devicePixelRatio})'),'measurement':measurement,'errors':errors.copy()};assert not errors and s['illegalCount']==0
      result['samples'].append(row);save(OUT/'report.json',result);print('REAL RENDER',phase,width,'cart',cart,'calls',measurement['maxCalls'],'median',measurement['medianMs'],'p95',measurement['p95Ms'],'advancing120',flush=True)
     context.close()
   finally:server.shutdown();server.server_close()
 browser.close()
result['sourceSHA256']=source;result['sourcesUnchanged']=all(hashlib.sha256((REPO/path).read_bytes()).hexdigest()==h for path,h in source.items());assert result['sourcesUnchanged'];save(OUT/'report.json',result);print('ACTUAL RENDER BENCHMARK PASS',len(result['samples']),flush=True)
