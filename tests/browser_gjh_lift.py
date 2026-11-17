"""Expanded visitor-only lift: real Rapier routes, physical landings and interruption."""
from gjh_startup_test_helpers import mall_entry_url
import argparse,functools,hashlib,http.server,json,math,os,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'demos/corporate/gjh/v11'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass
def hashes():return {str(p.relative_to(RUNTIME)):hashlib.sha256(p.read_bytes()).hexdigest() for p in RUNTIME.rglob('*') if p.is_file() and p.suffix in ('.js','.html','.css')}
def save(path,data):
 if path.is_symlink() or path.exists() and not path.is_file():raise ValueError('Invalid evidence destination')
 fd,name=tempfile.mkstemp(prefix='.'+path.name+'-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:json.dump(data,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)
def state(p):return p.evaluate('__mall.state')
def step(p,ms=17,**input):p.evaluate('([ms,input])=>{__mall.setInput(input);__mall.step(ms)}',[ms,input]);return state(p)
def walk(p,x,z):
 for _ in range(250):
  s=state(p);dx=x-s['x'];dz=z-s['z'];d=math.hypot(dx,dz)
  if d<.07:step(p);return
  before=(s['x'],s['z']);step(p,min(100,max(17,d/2.65*1000)),right=dx/d,forward=-dz/d,yaw=0)
  after=state(p);assert math.hypot(after['x']-before[0],after['z']-before[1])>.001,('Blocked route',x,z,after)
 raise AssertionError(('Unreached route',x,z,state(p)))
def lobby(p):
 assert p.evaluate('__mall.teleport("atrium")');step(p)
 assert abs(state(p)['x']-10)<.1 and abs(state(p)['z']-12)<.1
 for x,z in [(10,5.5),(-6.4,5.5),(-6.4,10)]:walk(p,x,z)
 assert state(p)['nearby']=='visitor-elevator'
def action(p):p.locator('#inspect').click();return step(p)
def dock(p):
 if state(p)['elevator']['docked']!=0:
  before=state(p);action(p);s=step(p,3000)
  assert not s['elevatorTravel'] and s['elevator']['docked']==0
  assert math.hypot(s['x']-before['x'],s['z']-before['z'])<.01
 assert p.locator('#inspect').inner_text()=='Ride to upper landing'
def run():
 ap=argparse.ArgumentParser();ap.add_argument('--evidence',type=Path,required=True);args=ap.parse_args();out=args.evidence;out.mkdir(parents=True,exist_ok=True)
 report={'sourceHashes':hashes(),'testSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'checks':[],'scope':'Chrome emulated viewport/controller tests; manual steps are posed renders, not frame performance or physical-device certification.'}
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=['--use-angle=metal','--ignore-gpu-blocklist'])
   for w,h,motion in [(390,844,'no-preference'),(639,826,'reduce'),(1440,900,'no-preference')]:
    c=b.new_context(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion=motion,service_workers='block');c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded#experience');page.wait_for_function('window.__sceneReady===true',timeout=90000)
    row={'viewport':[w,h],'motion':motion,'states':{},'errors':errors};report['checks'].append(row)
    lobby(page);dock(page);walk(page,-6.4,10.95);row['states']['ground']=state(page);page.screenshot(path=str(out/f'{w}-ground.png'))
    action(page)
    for i in range(12):
     s=step(page,300);assert s['drawCalls']<=200,(w,i,s['drawCalls']);
     if i in [0,2,5,6,7,8,10]:page.screenshot(path=str(out/f'{w}-ride-{i}.png'));row['states'][f'ride-{i}']=s
    s=step(page,500);assert not s['elevatorTravel'] and abs(s['y']-7.2)<.1 and s['capsuleEnabled'];assert abs(s['x']+6.4)<.1 and abs(s['z']-10)<.1
    assert s['cartCapability']['allowed'] is False and 'visitor-only' in s['cartCapability']['reason']
    page.locator('#bag-open').click();assert page.locator('#cart-toggle').is_disabled();assert 'visitor-only' in page.locator('#cart-status').inner_text();page.locator('#bag-close').click();step(page)
    row['states']['upper']=state(page);page.screenshot(path=str(out/f'{w}-upper.png'))
    # Actual controller can leave the landing and traverse around the shaft on every side.
    for x,z in [(-8,10),(-8,5),(2,5),(2,15),(-8,15),(-8,10),(-6.4,10)]:walk(page,x,z);assert abs(state(page)['y']-7.2)<.1
    for yaw in [0,math.pi/2,math.pi,math.pi*1.5]:
     s=step(page,300,yaw=yaw,pitch=.25);assert s['cameraObstruction']['avatarVisible'];page.screenshot(path=str(out/f'{w}-upper-yaw-{round(yaw,2)}.png'))
    # A Map return cannot auto-board a stale call. The upper cabin leaves ground gate closed.
    lobby(page);s=state(page);assert s['elevator']['docked']==7.2 and s['elevator']['gates'][0]['closed']
    blocked=step(page,1400,right=1,yaw=0);assert blocked['x']<-5.25,blocked['x'];walk(page,-6.4,10)
    before=state(page);action(page);s=step(page,650);row['emptyCall']=s;assert not s['elevatorTravel'];assert math.hypot(s['x']-before['x'],s['z']-before['z'])<.01
    if motion=='reduce':assert s['elevator']['docked']==0 and not s['elevator']['calling']
    else:assert s['elevator']['calling']
    assert page.evaluate('__mall.teleport("mili")');step(page,3000);assert not state(page)['elevatorTravel'] and not state(page)['elevator']['calling'] and abs(state(page)['x'])<.1
    lobby(page);dock(page);action(page);step(page,5000);assert state(page)['y']>7;action(page);s=step(page,5000);assert s['y']<.1 and not s['elevatorTravel'] and s['capsuleEnabled']
    row['states']['roundtrip']=s
    if w==1440:
     row['contextLosses']=[]
     # Native loss while calling an empty cabin must never move or queue the visitor.
     dock(page);action(page);step(page,5000);lobby(page);before=state(page);action(page);calling=step(page,650)
     assert calling['elevator']['calling'] and not calling['elevatorTravel']
     page.evaluate("()=>{window.__liftLoss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');__liftLoss.loseContext()}");page.wait_for_function('!__mall.ready')
     settled=state(page);assert not settled['elevator']['calling'] and settled['capsuleEnabled'];assert math.hypot(settled['x']-before['x'],settled['z']-before['z'])<.01
     row['contextLosses'].append({'phase':'empty-call','before':calling,'settled':settled})
     page.evaluate('__liftLoss.restoreContext()');page.wait_for_function('__mall.ready',timeout=60000);page.locator('#graphics-return').click();step(page);lobby(page)
     for elapsed in [150,1100,2400,3100]:
      dock(page);action(page);trip=step(page,elapsed);assert trip['elevatorTravel'],trip['elevatorPhase']
      page.evaluate("()=>{window.__liftLoss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');__liftLoss.loseContext()}");page.wait_for_function('!__mall.ready')
      s=state(page);assert not s['elevatorTravel'] and s['capsuleEnabled'];assert abs(s['x']+6.4)<.1 and abs(s['z']-10)<.1;assert min(abs(s['y']),abs(s['y']-7.2))<.1
      row['contextLosses'].append({'elapsed':elapsed,'before':trip,'settled':s})
      page.evaluate('__liftLoss.restoreContext()');page.wait_for_function('__mall.ready',timeout=60000);page.locator('#graphics-return').click();step(page);lobby(page)
    assert not errors and state(page)['illegalCount']==0;save(out/'report.json',report);print('LIFT PASS',w,flush=True);c.close()
   for query in ['?layout=classic&visitor=v1','?layout=expanded&visitor=v1','?layout=classic']:
    c=b.new_context(reduced_motion='reduce',service_workers='block');c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();page.goto(mall_entry_url(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'+query));page.wait_for_function('window.__sceneReady===true',timeout=90000)
    assert state(page)['elevator'] is None;assert page.locator('[data-store]').count()==3 and page.locator('[data-product]').count()==4;report['checks'].append({'query':query,'unchangedClassicOrGroundOnly':'PASS'});c.close()
   b.close()
 finally:
  report['sourcesUnchanged']=hashes()==report['sourceHashes'];save(out/'report.json',report);server.shutdown();server.server_close()
 assert report['sourcesUnchanged'];print('LIFT ALL PASS',flush=True)
if __name__=='__main__':run()
