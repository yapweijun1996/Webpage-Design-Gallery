"""Actual wall/touch/wayfinding/seat checks and steering-step draw budget."""
import argparse,functools,hashlib,http.server,json,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
import browser_gjh_interior_pilot as base
from browser_gjh_interior_shell import source_hashes,route_through_stores,sample
ROOT=base.ROOT

def run():
 parser=argparse.ArgumentParser();parser.add_argument('--evidence',type=Path,default=Path('/private/tmp/gallery-interior-d3/journeys'));out=parser.parse_args().evidence;out.mkdir(parents=True,exist_ok=True);hashes=source_hashes();test_sha=hashlib.sha256(Path(__file__).read_bytes()).hexdigest();report={'sourceHashes':hashes,'testSha256':test_sha,'checks':[],'scope':'Real Rapier steering and native keyboard/touch, emulated Chrome only; no physical-phone/Safari certification.'}
 original_drive=base.drive;observations=[]
 def checked_drive(*args,**kwargs):
  s=original_drive(*args,**kwargs);observations.append({'calls':s['drawCalls'],'x':s['x'],'z':s['z'],'pushing':s['pushing'],'seated':s['seated']});assert s['drawCalls']<=200,observations[-1];return s
 base.drive=checked_drive
 # Route function imports drive directly; its walk_to uses the same base module owner.
 try:
  with tempfile.TemporaryDirectory(prefix='gjh-shell-journeys-') as tmp:
   base.gallery.build(Path(tmp)/'site');server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(base.Handler,directory=tmp));threading.Thread(target=server.serve_forever,daemon=True).start()
   try:
    with sync_playwright() as p:
     browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
     for profile,width,height in (('default',1440,1000),('default',390,844),('default',639,826),('pilot',1440,1000)):
      context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',service_workers='block');page,errors,_=base.boot(context,f'http://127.0.0.1:{server.server_port}/site/demos/corporate/gjh/v11/'+('?interior=pilot' if profile=='pilot' else ''));row={'profile':profile,'viewport':[width,height]};observations.clear()
      assert {s['zone'] for s in base.state(page)['roomSigns']}=={'newmoon','mili','gogo'}
      assert page.locator('[data-store]').evaluate_all('els=>els.map(e=>e.dataset.store)')==['newmoon','mili','gogo']
      for zone,x in (('newmoon',-10),('mili',0),('gogo',10)):
       if not page.locator('#mall-map').evaluate('e=>e.open'):
        page.locator('#header-map').click()
       page.locator(f'[data-teleport="{zone}"]').click();checked_drive(page);s=base.state(page);assert abs(s['x']-x)<.01 and abs(s['z']-2.4)<.01
      row['wayfindingAgreement']='PASS'
      page.evaluate('()=>__mall.teleport("newmoon")');checked_drive(page);base.walk_to(page,-13,2.4);blocked=checked_drive(page,600000,right=-1);assert -14.53<blocked['x']<-14.4 and abs(blocked['y']+.02)<.03;row['longInputWallBlock']={'x':blocked['x'],'requestedMs':600000,'controllerMaximumFixedSubsteps':600}
      # Native touch starts on open canvas; no joystick DOM overlay is activated.
      if width<1000:
       page.evaluate('()=>{__mall.teleport("atrium");__mall.setInput(null)}');rect=page.locator('#scene').bounding_box();x=rect['x']+rect['width']*.28;y=rect['y']+rect['height']*.55;cdp=context.new_cdp_session(page)
       cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-40,'id':1}]});page.wait_for_function('()=>__mall.state.z<11.8',timeout=3000);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});row['nativeTouchMove']='PASS';checked_drive(page)
      page.evaluate('()=>__mall.teleport("atrium")');checked_drive(page);route_through_stores(page)
      page.locator('#view-toggle').click();page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.keyboard.press('Escape');page.locator('#view-toggle').click();page.evaluate('()=>__mall.teleport("atrium")');checked_drive(page);page.locator('#bag-open').click();page.locator('#cart-toggle').click();assert base.state(page)['pushing'];route_through_stores(page);row['cartFrameSample']=sample(page,'cart-active',30)
      page.locator('#bag-open').click();page.locator('#cart-toggle').click();page.locator('#bag-close').click();checked_drive(page)
      row['steeringObservations']=observations.copy();row['sampledSteeringMaxCalls']=max(x['calls'] for x in observations);row['errors']=errors;assert not errors and base.state(page)['illegalCount']==0;report['checks'].append(row);(out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print('JOURNEYS PASS',width,row['sampledSteeringMaxCalls'],len(observations),flush=True);context.close()
     browser.close()
   finally:server.shutdown();server.server_close()
 finally:
  base.drive=original_drive;report['sourcesUnchanged']=source_hashes()==hashes and hashlib.sha256(Path(__file__).read_bytes()).hexdigest()==test_sha;(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 assert report['sourcesUnchanged'];print('SHELL JOURNEYS PASS',flush=True)
if __name__=='__main__':run()
