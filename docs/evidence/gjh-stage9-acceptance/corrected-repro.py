import sys,argparse,functools,http.server,threading,time,hashlib,os,tempfile
from pathlib import Path
sys.path.insert(0,'/private/tmp/gallery-task-lod/tests')
from playwright.sync_api import sync_playwright
from browser_gjh_lift import ROOT,Quiet,hashes,save

def atomic_text(path,text):
 if path.is_symlink() or path.exists() and not path.is_file():raise ValueError('Invalid source destination')
 fd,name=tempfile.mkstemp(prefix='.'+path.name+'-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:f.write(text);f.flush();os.fsync(f.fileno())
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--evidence',type=Path,required=True);ap.add_argument('--expect-fixed',action='store_true');ap.add_argument('--group',choices=['all','stall','seasonal','race'],default='all');args=ap.parse_args();out=args.evidence;out.mkdir(parents=True,exist_ok=True)
 r={'baseline':'646e0c272cd25a7792befc5635791a4466b72319','sourceHashes':hashes(),'expected':'fixed' if args.expect_fixed else 'known-bugs','checks':[],'scope':'QA-only functional reproductions; synthetic normalized gamepad/private UI bridge and deferred coordinator, not physical input or performance.'}
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
   if args.group in ['all','stall']:
    c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block');c.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')");pending=[];page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/mall-themes.js',lambda route:pending.append(route));page.goto(url,wait_until='domcontentloaded')
    for _ in range(1200):
     if pending:break
     page.wait_for_timeout(25)
    assert pending,'Theme module request did not reach fixture'
    started=time.monotonic();page.wait_for_timeout(2600);s=page.evaluate('({ready:__mall.ready,sceneReady:window.__sceneReady===true,failed:window.__sceneFailed===true,theme:__mall.state.theme||null})');row={'case':'held-optional-theme-module','observedAfterHoldSeconds':time.monotonic()-started,'state':s,'listUsable':page.locator('#store-list').is_visible(),'errors':errors};r['checks'].append(row)
    assert s['ready']==args.expect_fixed,('Unexpected readiness',s);assert not s['failed'];assert row['listUsable'] or args.expect_fixed
    if row['listUsable']:
     page.locator('.product-card [data-inspect]').first.click();page.locator('#product-dialog').wait_for(state='visible');page.locator('#product-add').click();page.locator('#product-close').click();row['directoryProductAndBagUsable']=True
    page.screenshot(path=str(out/'held-module.png'));save(out/'report.json',r)
    pending.pop().continue_();page.wait_for_function('window.__sceneReady===true',timeout=90000);row['readyAfterRelease']=page.evaluate('__mall.ready');assert not errors;save(out/'report.json',r);print('EXPECTED '+('FIX VERIFIED' if args.expect_fixed else 'BUG REPRODUCED')+' optional-module-stall',flush=True);c.close()
   if args.group in ['all','seasonal']:
    c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block');c.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1');localStorage.setItem('gjh-v11-mall-theme-v1','christmas')");pending=[];page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/christmas.js',lambda route:pending.append(route));page.goto(url,wait_until='domcontentloaded')
    for _ in range(1200):
     if pending:break
     page.wait_for_timeout(25)
    assert pending,'Saved Christmas module request did not reach fixture'
    started=time.monotonic();page.wait_for_timeout(2600);s=page.evaluate('({ready:__mall.ready,sceneReady:window.__sceneReady===true,failed:window.__sceneFailed===true,theme:__mall.state.theme||null})');row={'case':'held-saved-seasonal-module','observedAfterHoldSeconds':time.monotonic()-started,'state':s,'listUsable':page.locator('#store-list').is_visible(),'errors':errors};r['checks'].append(row)
    assert s['ready']==args.expect_fixed,('Unexpected readiness',s);assert not s['failed'];assert row['listUsable'] or args.expect_fixed
    if row['listUsable']:
     page.locator('.product-card [data-inspect]').first.click();page.locator('#product-dialog').wait_for(state='visible');page.locator('#product-add').click();page.locator('#product-close').click();row['directoryProductAndBagUsable']=True
    page.screenshot(path=str(out/'held-seasonal.png'));save(out/'report.json',r)
    pending.pop().continue_();page.wait_for_function('window.__sceneReady===true',timeout=90000);row['readyAfterRelease']=page.evaluate('__mall.ready');assert not errors;save(out/'report.json',r);print('EXPECTED '+('FIX VERIFIED' if args.expect_fixed else 'BUG REPRODUCED')+' saved-seasonal-module-stall',flush=True);c.close()
   if args.group in ['all','race']:
    c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block');c.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')");page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def expose(route):
     response=route.fetch();source=response.text();needle="const ui = createUI(expanded), canvas = document.querySelector('#scene');";assert source.count(needle)==1
     served=source.replace(needle,needle+"Object.defineProperty(window,'__themeQA',{value:{ui}});")
     r['qaBridge']={'sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'servedSha256':hashlib.sha256(served.encode()).hexdigest(),'scope':'Expose actual private UI reference only; no production source changes.'};atomic_text(out/'qa-script.js',served);route.fulfill(response=response,body=served)
    page.route('**/v11/script.js',expose);page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.__sceneReady===true',timeout=90000)
    await_setup=page.evaluate('''async()=>{const {createMallThemeCoordinator,EVERYDAY}=await import('./assets/mall-themes.js');window.__qaCommits=[];window.__qaDisposed=0;window.__qaAlternative={...EVERYDAY,id:'qa-deferred',label:'QA deferred'};
     window.__qaCoordinator=createMallThemeCoordinator({registry:[EVERYDAY,__qaAlternative],storage:null,prepare:()=>new Promise(resolve=>{window.__qaResolve=resolve}),commit:next=>__qaCommits.push({id:next.id,dialogOpen:document.querySelector('#mall-theme-dialog').open}),notify:s=>__themeQA.ui.updateMallTheme(s)});
     __themeQA.ui.configureMallTheme(__qaCoordinator);return __qaCoordinator.options();}''')
    page.locator('#mall-theme-open').click();page.wait_for_function('document.querySelector("#mall-theme-dialog").open');page.evaluate('()=>{window.__qaSelection=__qaCoordinator.select("qa-deferred");}');assert page.evaluate('__qaCoordinator.state().pending')=='qa-deferred';page.screenshot(path=str(out/'pending-before-back.png'))
    result=page.evaluate('''async()=>{const pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0})),mapping:'standard',connected:true};__themeQA.ui.handleGamepad(pad);pad.buttons[1]={pressed:true,touched:true,value:1};
     const wasOpen=document.querySelector('#mall-theme-dialog').open;__themeQA.ui.handleGamepad(pad);const closedSynchronously=!document.querySelector('#mall-theme-dialog').open;
     __qaResolve({value:__qaAlternative,dispose(){__qaDisposed++}});const selected=await __qaSelection;
     return {wasOpen,closedSynchronously,selected,active:__qaCoordinator.state().active,commits:__qaCommits.slice(),disposed:__qaDisposed,pending:__qaCoordinator.state().pending};}''')
    row={'case':'gamepad-close-then-same-turn-prepare-resolution','normalization':'Synthetic standard-layout pad Back rising edge passed through actual UI.handleGamepad and shared onboarding handler; controlled private deferred coordinator commit spy.','result':result,'errors':errors};r['checks'].append(row)
    assert result['wasOpen'] and result['closedSynchronously'];observed=bool(result['commits'] and result['commits'][0]['dialogOpen'] is False);row['lateCommitObserved']=observed;assert observed is (not args.expect_fixed),result
    if args.expect_fixed:assert result['active']=='everyday' and result['disposed']==1 and result['selected'] is False
    page.wait_for_timeout(50);row['afterCloseTask']=page.evaluate('({active:__qaCoordinator.state().active,pending:__qaCoordinator.state().pending,dialogOpen:document.querySelector("#mall-theme-dialog").open})');page.screenshot(path=str(out/'after-back.png'));assert not errors;save(out/'report.json',r);print('EXPECTED '+('FIX VERIFIED' if args.expect_fixed else 'BUG REPRODUCED')+' gamepad-late-commit',flush=True);c.close()
   browser.close()
 finally:
  r['sourcesUnchanged']=hashes()==r['sourceHashes'];r['result']='Fixed acceptance' if args.expect_fixed else 'Confirmed negative reproductions; NOT acceptance passes';save(out/'report.json',r);server.shutdown();server.server_close()
 assert r['sourcesUnchanged']
if __name__=='__main__':run()
