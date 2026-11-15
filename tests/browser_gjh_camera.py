"""Real Rapier camera clearance and continuous walking between mall facilities."""
import argparse,functools,http.server,json,math,os,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_v11 import QuietHandler,state,drive
from browser_gjh_amenities import ready,approach,close
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/screenshots/mall-camera'

def distance(s):
 return math.dist(s['camera']['position'],[s['x'],s['y']+1.24,s['z']])
def assert_clear(s,variant):
 p=s['camera']['position'];r=s['cameraObstruction']['radius']-.025
 boxes=[(-12.5,.94,5.8,2.88,1.88,.961),(-7,.9,2.2,.75,1.8,.532)]
 scale=1 if variant=='v1' else .8
 for seat in s['seats']:
  boxes.append((seat['x'],1.3175*scale/2,seat['z']+.23*seat['facing'],2.58,1.3175*scale,.922))
 for box in boxes:
  separation=math.sqrt(sum(max(abs(p[i]-box[i])-box[i+3]/2,0)**2 for i in range(3)))
  assert separation>=r,(p,box,separation,r)
 assert distance(s)>=1.05,s['cameraObstruction']
 assert s['cameraObstruction']['avatarVisible']

def run(baseline=False):
 OUT.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 results=[]
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[f'--use-angle={os.environ.get("GALLERY_WEBGL_BACKEND","metal")}'])
   for width,height,variant,reduced in ([(1440,900,'v1',True)] if baseline else [(1440,900,'v1',False),(1440,900,'v2',False),(390,844,'v2',True)]):
    ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce' if reduced else 'no-preference');page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if baseline:
     current=(ROOT/'demos/corporate/gjh/v11/assets/player.js').read_text();old=subprocess.check_output(['git','show','ba6d8d0:demos/corporate/gjh/v11/assets/player.js'],text=True)
     a=current.index('  function sweepCamera(');b=current.index('  function setCart(',a);start=old.index('  function constrain(');end=old.index('  function setCart(',start)
     source=current[:a]+old[start:end]+current[b:];source=source.replace('  function constrain(point) {',"  const ray=new R.Ray({x:0,y:0,z:0},{x:0,y:0,z:-1});\n  function constrain(point) {")
     page.route('**/assets/player.js',lambda route:route.fulfill(status=200,body=source,content_type='text/javascript'))
    ready(page,f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?visitor={variant}')
    page.evaluate('__mall.teleport("newmoon");__mall.setInput({})');drive(page,800,right=-1);drive(page,1000,forward=-1);s=drive(page,800)
    page.screenshot(path=str(OUT/f'{"before" if baseline else "after"}-desk-rear-{width}-{variant}.png'))
    if baseline:
     assert distance(s)<.9,distance(s);results.append({'baselineDeskHeadClippingReproduced':True,'distance':distance(s)});ctx.close();continue
    assert_clear(s,variant);assert s['cameraObstruction']['lift']>0
    page.evaluate('__mall.teleport("atrium");__mall.setInput({})');drive(page,2200,right=-1)
    for yaw in [0,.6,1.2,math.pi]:
     s=drive(page,400,yaw=yaw,pitch=-.08);assert_clear(s,variant)
    page.screenshot(path=str(OUT/f'after-benches-{width}-{variant}.png'))
    approach(page,'desk');close(page);samples=[]
    # One continuous loop: service desk -> showcase -> ceiling sign -> service desk.
    for label,ms,inputs,expected in [('desk-to-showcase-side',1950,{'right':1},None),('showcase',1350,{'forward':1},'featured-showcase'),('clear-showcase',850,{'forward':-1},None),('sign',1100,{'right':1},'wayfinding-west'),('clear-kiosk',1100,{'right':-1},None),('front-aisle',600,{'forward':-1},None),('desk',1950,{'right':-1},'service-desk')]:
     for step in range(math.ceil(ms/50)):
      s=drive(page,min(50,ms-step*50),**inputs);assert_clear(s,variant);samples.append(distance(s))
     if expected:
      assert s['nearby']==expected,(label,s['x'],s['z'],s['nearby'])
      page.locator('#scene').focus();page.keyboard.press('f');page.locator('#amenity-dialog').wait_for(state='visible');close(page)
      page.screenshot(path=str(OUT/f'walk-{label}-{width}-{variant}.png'))
    assert not errors,errors
    results.append({'viewport':[width,height],'visitor':variant,'reducedMotion':reduced,'deskRearClearance':True,'benchOrbitClearance':True,'continuousFacilityLoop':True,'samples':len(samples),'minimumCameraDistance':min(samples),'errors':errors});ctx.close()
   browser.close()
 finally:server.shutdown()
 (ROOT/'docs/evidence/mall-camera.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--baseline',action='store_true');run(parser.parse_args().baseline)
