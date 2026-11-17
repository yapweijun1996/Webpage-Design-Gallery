"""Fixed optional-theme deadlines and shared-gamepad cancellation regressions.

Deferred stages and factory counters are QA-only module instrumentation. They
exercise the actual coordinator/UI; they are not physical controller input.
"""
import argparse,functools,hashlib,http.server,json,os,tempfile,threading,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_lift import ROOT,Quiet,hashes,save
RUNTIME=ROOT/'demos/corporate/gjh/v11'

def atomic_text(path,text):
 if path.is_symlink() or path.exists() and not path.is_file():raise ValueError('Invalid evidence destination')
 fd,name=tempfile.mkstemp(prefix='.'+path.name+'-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:f.write(text);f.flush();os.fsync(f.fileno())
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)

def checked_console(messages):
 expected=[m for m in messages if 'Service Worker registration blocked by Playwright' in m['text']]
 unexpected=[m for m in messages if m not in expected]
 bounded=lambda rows:[{'type':m['type'],'text':m['text'][:1200],'url':m['url'][:500]} for m in rows[:10]]
 assert not unexpected,bounded(unexpected)
 return {'fixtureWarnings':len(expected),'unexpected':bounded(unexpected),'count':len(messages)}

def snapshot(page):
 return page.evaluate('()=>{const s=__mall.state;return {ready:__mall.ready,theme:s.theme,resources:s.rendererResources,children:s.graphics.sceneChildren,drawCalls:s.drawCalls,illegal:s.illegalCount}}')
def freeze(page):page.evaluate('()=>{__mall.setInput({});__mall.step(100);}')
def wait_request(page,pending):
 for _ in range(1200):
  if pending:return
  page.wait_for_timeout(25)
 raise AssertionError('Optional module did not reach held-request fixture')
def run():
 ap=argparse.ArgumentParser();ap.add_argument('--evidence',type=Path,required=True);ap.add_argument('--group',choices=['all','module','stored','gamepad'],default='all');args=ap.parse_args();out=args.evidence;out.mkdir(parents=True,exist_ok=True)
 report={'sourceHashes':hashes(),'testSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'checks':[],'scope':'Default fixed expectations. Factory counters/deferred synthetic registry/private UI bridge and normalized gamepad are QA-only; no physical-device/performance claim.'}
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
 def context(browser,stored=False):
  c=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block');c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed');"+("localStorage.setItem('gjh-v11-mall-theme-v1','christmas');" if stored else ''));page=c.new_page();errors=[];console=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append({'type':m.type,'text':m.text,'url':m.location.get('url','')}) if m.type in ['warning','error'] else None);return c,page,errors,console
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
   if args.group in ['all','module']:
    c,page,errors,console=context(browser);pending=[];page.route('**/mall-themes.js',lambda route:pending.append(route));page.goto(url,wait_until='domcontentloaded');wait_request(page,pending);started=time.monotonic();page.wait_for_timeout(2600)
    assert page.evaluate('__mall.ready && window.__sceneReady===true');freeze(page);before=snapshot(page);assert before['theme'] is None
    source=(RUNTIME/'assets/mall-themes.js').read_text();needle='  const records=new Map();';assert source.count(needle)==1
    served="window.__qaCoordinatorModuleEvaluated=1;\n"+source.replace(needle,"  window.__qaCoordinatorFactory=(window.__qaCoordinatorFactory||0)+1;\n"+needle,1);atomic_text(out/'qa-late-coordinator.js',served);pending.pop().fulfill(status=200,content_type='text/javascript',body=served);page.wait_for_function('window.__qaCoordinatorModuleEvaluated===1');freeze(page);after=snapshot(page)
    assert page.evaluate('window.__qaCoordinatorFactory||0')==0 and after['theme'] is None and after['resources']==before['resources'] and after['children']==before['children'];page.locator('#mall-theme-open').click();assert page.locator('#mall-theme-apply').is_disabled() and 'unavailable' in page.locator('#mall-theme-status').inner_text();page.keyboard.press('Escape');assert not errors
    report['checks'].append({'case':'coordinator-deadline-late-evaluation','holdSeconds':time.monotonic()-started,'before':before,'after':after,'lateFactoryCalls':0,'qaModuleSha256':hashlib.sha256(served.encode()).hexdigest(),'errors':errors,'console':checked_console(console)});page.screenshot(path=str(out/'coordinator-fallback.png'));save(out/'report.json',report);print('THEME ACCEPTANCE PASS coordinator deadline/late',flush=True);c.close()
   if args.group in ['all','stored']:
    c,page,errors,console=context(browser,True);pending=[];requests=[];page.on('request',lambda r:requests.append(r.url));source=(RUNTIME/'assets/christmas.js').read_text();needle='export function prepareChristmasDecor(T,scene,theme,{signal}={}) {';assert source.count(needle)==1
    served="window.__qaPackEvaluations=(window.__qaPackEvaluations||0)+1;\n"+source.replace(needle,needle+"window.__qaPackFactory=(window.__qaPackFactory||0)+1;",1);atomic_text(out/'qa-late-pack.js',served)
    def pack(route):
     if '?' not in route.request.url:pending.append(route)
     else:route.fulfill(status=200,content_type='text/javascript',body=served)
    page.route('**/christmas.js*',pack);page.goto(url,wait_until='domcontentloaded');wait_request(page,pending);page.wait_for_timeout(2600);assert page.evaluate('__mall.ready && window.__sceneReady===true');freeze(page);before=snapshot(page);assert before['theme']['active']=='everyday' and before['theme']['pending'] is None
    pending.pop().fulfill(status=200,content_type='text/javascript',body=served);page.wait_for_function('window.__qaPackEvaluations===1');freeze(page);after=snapshot(page);assert page.evaluate('window.__qaPackFactory||0')==0 and after['theme']['active']=='everyday' and after['resources']==before['resources'] and after['children']==before['children']
    page.locator('#mall-theme-open').click();page.locator('#mall-theme-select').select_option('christmas');page.locator('#mall-theme-apply').click();page.wait_for_function('__mall.state.theme.active==="christmas" && __mall.state.theme.pending===null',timeout=30000);assert page.evaluate('window.__qaPackFactory')==1 and page.evaluate('window.__qaPackEvaluations')==2;retry=snapshot(page);assert retry['drawCalls']<=200;assert len([u for u in requests if '/christmas.js' in u])==2;assert any('/christmas.js?retry=' in u for u in requests)
    page.keyboard.press('Escape');page.wait_for_function('document.activeElement.id==="mall-theme-open"');assert not errors
    report['checks'].append({'case':'stored-pack-deadline-late-and-same-page-retry','before':before,'afterLate':after,'afterRetry':retry,'lateFactoryCalls':0,'retryFactoryCalls':1,'moduleRequests':[u for u in requests if '/christmas.js' in u],'qaModuleSha256':hashlib.sha256(served.encode()).hexdigest(),'errors':errors,'console':checked_console(console)});page.screenshot(path=str(out/'stored-pack-retry.png'));save(out/'report.json',report);print('THEME ACCEPTANCE PASS stored-pack deadline/late/retry',flush=True);c.close()
   if args.group in ['all','gamepad']:
    c,page,errors,console=context(browser)
    def expose(route):
     response=route.fetch();source=response.text();needle='var ui = createUI(expanded);';assert source.count(needle)==1;served=source.replace(needle,needle+"Object.defineProperty(window,'__themeQA',{value:{ui}});");atomic_text(out/'qa-script.js',served);report['qaBridge']={'sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'servedSha256':hashlib.sha256(served.encode()).hexdigest()};route.fulfill(response=response,body=served)
    page.route('**/v11/script.bundle.js',expose);page.goto(url,wait_until='domcontentloaded');page.wait_for_function('window.__sceneReady===true',timeout=90000)
    page.evaluate('''async()=>{const {createMallThemeCoordinator,EVERYDAY}=await import('./assets/mall-themes.js');window.__qaCommits=[];window.__qaDisposed=0;window.__qaAlternative={...EVERYDAY,id:'qa-deferred',label:'QA deferred'};__themeQA.ui.configureMallTheme(window.__qaCoordinator=createMallThemeCoordinator({registry:[EVERYDAY,__qaAlternative],storage:null,prepare:()=>new Promise(resolve=>window.__qaResolve=resolve),commit:next=>__qaCommits.push(next.id),notify:s=>__themeQA.ui.updateMallTheme(s)}));}''')
    page.locator('#mall-theme-open').click()
    # An assignment expression would make Playwright await the unresolved promise.
    page.evaluate('()=>{window.__qaSelection=__qaCoordinator.select("qa-deferred");}');assert page.evaluate('__qaCoordinator.state().pending')=='qa-deferred'
    result=page.evaluate('''async()=>{const pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0})),mapping:'standard',connected:true};__themeQA.ui.handleGamepad(pad);pad.buttons[1]={pressed:true,touched:true,value:1};const handled=__themeQA.ui.handleGamepad(pad),closedSynchronously=!document.querySelector('#mall-theme-dialog').open;__qaResolve({value:__qaAlternative,dispose(){__qaDisposed++}});const selected=await __qaSelection;return {handled,closedSynchronously,selected,active:__qaCoordinator.state().active,pending:__qaCoordinator.state().pending,commits:__qaCommits,disposed:__qaDisposed};}''')
    assert result['handled'] and result['closedSynchronously'] and result['selected'] is False and result['active']=='everyday' and result['pending'] is None and result['commits']==[] and result['disposed']==1;page.wait_for_function('document.activeElement.id==="mall-theme-open"');assert not errors
    report['checks'].append({'case':'shared-normalized-gamepad-close-before-deferred-resolution','result':result,'focusReturnedTo':'mall-theme-open','errors':errors,'console':checked_console(console)});page.screenshot(path=str(out/'gamepad-cancel.png'));save(out/'report.json',report);print('THEME ACCEPTANCE PASS shared gamepad/cancel/dispose/focus',flush=True);c.close()
   browser.close()
 finally:
  report['sourcesUnchanged']=hashes()==report['sourceHashes'];save(out/'report.json',report);server.shutdown();server.server_close()
 assert report['sourcesUnchanged'];print('THEME ACCEPTANCE ALL PASS',args.group,flush=True)
if __name__=='__main__':run()
