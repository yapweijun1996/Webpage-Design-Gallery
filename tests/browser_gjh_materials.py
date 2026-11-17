"""Expanded-only procedural finishes: matched poses, quality, faults and late import."""
import argparse,functools,hashlib,http.server,json,os,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_lift import ROOT,Quiet,hashes,save,state,step,lobby,dock,action
ASSET=ROOT/'demos/corporate/gjh/v11/assets/natural-materials.js'

def write_source(path,text):
 if path.is_symlink() or path.exists() and not path.is_file():raise ValueError('Invalid QA source destination')
 fd,name=tempfile.mkstemp(prefix='.'+path.name+'-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:f.write(text);f.flush();os.fsync(f.fileno())
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)

def boot(browser,url,w,h,preference='auto',failure=None,instrument=None):
 c=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,has_touch=w<1000,reduced_motion='reduce',service_workers='block');c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");pending=[];requests=[]
 if failure in ['canvas-first','canvas-second']:
  fail_at=1 if failure=='canvas-first' else 2
  c.add_init_script("window.__finishCanvases=0;const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){if(type==='2d'&&this.width===256&&this.height===256){window.__finishCanvases++;if(window.__finishCanvases==="+str(fail_at)+")return null;}return old.call(this,type,...rest);}")
 if failure=='module-missing':c.route('**/natural-materials.js',lambda route:route.abort())
 elif failure=='late':c.route('**/natural-materials.js',lambda route:pending.append(route))
 elif instrument:c.route('**/natural-materials.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=instrument))
 page=c.new_page();errors=[];console=[];page.on('console',lambda m:console.append({'type':m.type,'text':m.text,'url':m.location.get('url','')}) if m.type in ['warning','error'] else None);page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.__sceneReady===true',timeout=90000)
 page.locator('#keyboard-help > summary').click();page.locator('#graphics-quality').select_option(preference);page.locator('#keyboard-help > summary').click();step(page)
 return c,page,errors,requests,pending,console

def console_result(messages,mode=None):
 fixture=[m for m in messages if 'Service Worker registration blocked by Playwright' in m['text']]
 expected=[m for m in messages if mode=='module-missing' and m['url'].split('?')[0].endswith('/natural-materials.js') and m['text']=='Failed to load resource: net::ERR_FAILED']
 context=[m for m in messages if mode=='context-restore' and m['text']=='WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost']
 unexpected=[m for m in messages if m not in fixture and m not in expected and m not in context]
 bounded=lambda records:[{'type':m['type'],'text':m['text'][:1200],'url':m['url'][:500]} for m in records[:10]]
 assert not unexpected,bounded(unexpected)
 return {'serviceWorkerBlockedByFixture':len(fixture),'fixtureWarningExamples':bounded(fixture),'expectedOptionalModuleFaults':bounded(expected),'expectedNativeContextLoss':bounded(context),'unexpected':bounded(unexpected),'capturedCount':len(messages)}

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--evidence',type=Path,required=True);ap.add_argument('--group',choices=['early','normal','failures','all'],default='all');args=ap.parse_args();out=args.evidence;out.mkdir(parents=True,exist_ok=True)
 r={'sourceHashes':hashes(),'testSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'group':args.group,'checks':[],'scope':'Real Chrome/Metal, emulated sizes and manual poses. Resource counts/network entries are observations, not physical-device/GPU-memory/performance certification.'}
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
   if args.group in ['early','normal','all']:
    cases=[(390,844,'auto'),(1440,900,'detailed')] if args.group=='early' else [(320,700,'auto'),(390,844,'auto'),(768,1024,'balanced'),(844,390,'low'),(1440,900,'detailed')]
    for w,h,preference in cases:
     c,page,errors,requests,_,console=boot(b,url+'?layout=expanded',w,h,preference);row={'viewport':[w,h],'preference':preference,'points':{},'errors':errors};r['checks'].append(row)
     def capture(name):
      s=step(page,100,yaw=0,pitch=.1);assert s['drawCalls']<=200;row['points'][name]=s;page.screenshot(path=str(out/f'{w}-{name}.png'));save(out/'report.json',r)
     capture('entry');assert page.evaluate('__mall.teleport("newmoon")');capture('store');assert page.evaluate('__mall.teleport("atrium")');capture('court')
     if w in [390,1440]:
      lobby(page);capture('west-court-walk');dock(page);action(page);step(page,5000);assert state(page)['y']>7;capture('upper');action(page);step(page,5000);assert state(page)['y']<.1
     if w==390 and args.group!='early':
      row['qualities']=[]
      for quality in ['low','balanced','detailed','auto']:
       page.locator('#keyboard-help > summary').click();page.locator('#graphics-quality').select_option(quality);page.locator('#keyboard-help > summary').click();s=step(page,100);assert s['graphics']['quality']['preference']==quality;assert s['drawCalls']<=200;row['qualities'].append(s['graphics']['quality'])
     assert len([u for u in requests if u.endswith('/natural-materials.js')])==1
     assert page.locator('[data-store]').count()==3 and page.locator('[data-product]').count()==4 and page.locator('[data-space-id]').count()==14
     row['console']=console_result(console);row['network']=page.evaluate('''()=>{const a=performance.getEntriesByType('resource');return {requests:a.length,encoded:a.reduce((n,x)=>n+x.encodedBodySize,0),decoded:a.reduce((n,x)=>n+x.decodedBodySize,0)}}''');assert not errors and state(page)['illegalCount']==0;save(out/'report.json',r);print('MATERIALS PASS',w,preference,flush=True);c.close()
   if args.group in ['failures','all']:
    original=ASSET.read_text();instrument="window.__finishModuleEvaluated=(window.__finishModuleEvaluated||0)+1;\n"+original.replace('  const created = [];',"  window.__finishFactoryCalls=(window.__finishFactoryCalls||0)+1;\n  const created = [];").replace('created.push(map);',"created.push(map);window.__finishCreated=(window.__finishCreated||0)+1;map.addEventListener('dispose',()=>{window.__finishDisposed=(window.__finishDisposed||0)+1;});")
    write_source(out/'qa-natural-materials.js',instrument);r['qaModule']={'sourceSha256':hashlib.sha256(original.encode()).hexdigest(),'servedSha256':hashlib.sha256(instrument.encode()).hexdigest(),'scope':'Factory/allocation/dispose counters only in fault fixtures; production module remains byte-identical reviewed source.'}
    flat_resources=None
    for mode in ['module-missing','canvas-first','canvas-second','late']:
     c,page,errors,requests,pending,console=boot(b,url+'?layout=expanded',390,844,failure=mode,instrument=instrument);before=state(page);row={'failure':mode,'before':before,'errors':errors};r['checks'].append(row)
     if mode=='module-missing':flat_resources=before['rendererResources']
     if mode=='late':
      assert pending;assert page.evaluate('window.__finishFactoryCalls||0')==0
      pending.pop().fulfill(status=200,content_type='text/javascript',body=instrument);page.wait_for_function('window.__finishModuleEvaluated===1');page.evaluate('__mall.setInput(null)');start=state(page)['frames'];page.wait_for_function('n=>__mall.state.frames>=n+5',arg=start);assert page.evaluate('window.__finishFactoryCalls||0')==0 and page.evaluate('window.__finishCreated||0')==0;assert state(page)['rendererResources']==before['rendererResources']
     elif mode.startswith('canvas'):
      assert page.evaluate('window.__finishFactoryCalls')==1
      expected=1 if mode=='canvas-second' else 0;assert page.evaluate('window.__finishCreated||0')==expected and page.evaluate('window.__finishDisposed||0')==expected
     assert state(page)['rendererResources']==flat_resources
     row['counts']=page.evaluate('({factory:window.__finishFactoryCalls||0,created:window.__finishCreated||0,disposed:window.__finishDisposed||0,moduleEvaluated:window.__finishModuleEvaluated||0})');row['after']=state(page)
     assert page.evaluate('__mall.teleport("newmoon")');step(page);page.locator('#view-toggle').click();assert page.locator('[data-store]').count()==3 and page.locator('[data-product]').count()==4;page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.locator('#product-close').click();assert not errors;row['console']=console_result(console,mode);page.screenshot(path=str(out/f'{mode}.png'));save(out/'report.json',r);print('MATERIAL FALLBACK PASS',mode,flush=True);c.close()
    # Actual native context loss must re-upload retained maps, not rerun the factory.
    c,page,errors,requests,_ ,console=boot(b,url+'?layout=expanded',390,844,instrument=instrument);before=state(page)
    assert page.evaluate('window.__finishFactoryCalls')==1 and page.evaluate('window.__finishCreated')==2
    page.screenshot(path=str(out/'context-before.png'))
    page.evaluate("()=>{window.__finishLoss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');__finishLoss.loseContext()}");page.wait_for_function('!__mall.ready');page.evaluate('__finishLoss.restoreContext()');page.wait_for_function('__mall.ready && __mall.state.graphics.validations>0',timeout=60000);page.locator('#graphics-return').click();after=step(page,100)
    assert page.evaluate('window.__finishFactoryCalls')==1 and page.evaluate('window.__finishCreated')==2 and page.evaluate('window.__finishDisposed||0')==0
    assert after['rendererResources']['textures']==before['rendererResources']['textures']
    assert len([u for u in requests if u.endswith('/natural-materials.js')])==1
    page.screenshot(path=str(out/'context-restored.png'));assert not errors
    r['checks'].append({'failure':'context-restore','before':before,'after':after,'factoryCalls':1,'createdTextures':2,'materialModuleRequests':1,'console':console_result(console,'context-restore')});save(out/'report.json',r);print('MATERIAL CONTEXT RESTORE PASS',flush=True);c.close()
    for query in ['?layout=classic', '?layout=classic&visitor=v1']:
     c,page,errors,requests,_,console=boot(b,url+query,390,844);assert not any(u.endswith('/natural-materials.js') for u in requests);assert not errors;r['checks'].append({'classic':query,'optionalModuleRequests':0,'resources':state(page)['rendererResources'],'console':console_result(console)});save(out/'report.json',r);print('CLASSIC NO FINISH MODULE PASS',query,flush=True);c.close()
   b.close()
 finally:
  r['sourcesUnchanged']=hashes()==r['sourceHashes'];save(out/'report.json',r);server.shutdown();server.server_close()
 assert r['sourcesUnchanged'];print('MATERIALS ALL PASS',args.group,flush=True)
if __name__=='__main__':run()
