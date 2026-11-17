"""Stage 7 pause, native item feedback and relocated amenity contracts.

QA-only script exposure permits a temporary body-position fault to isolate the
seat/cart/held safety guards. No production global or repository source changes.
"""
import argparse,functools,hashlib,http.server,json,os,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_lift import ROOT,Quiet,hashes,save,state,step,walk,lobby,dock,action
from browser_gjh_interior_pilot import open_map
from gjh_startup_test_helpers import use_individual_assets

def write_source(path,text):
 if path.is_symlink() or path.exists() and not path.is_file():raise ValueError('Invalid QA source destination')
 fd,name=tempfile.mkstemp(prefix='.'+path.name+'-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:f.write(text);f.flush();os.fsync(f.fileno())
  os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)

def still(page,before):
 step(page,500);after=state(page)
 assert abs(after['y']-before['y'])<1e-6 and after['elevatorPhase']==before['elevatorPhase'] and abs(after['elevator']['height']-before['elevator']['height'])<1e-6
 return after

def pause_checks(page,phase):
 result=[]
 page.evaluate("window.dispatchEvent(new Event('blur'));__mall.setInput(null)");before=state(page);page.wait_for_timeout(220);after=still(page,before);result.append({'signal':'synthetic-window-blur','phase':phase,'before':before,'after':after});page.evaluate("window.dispatchEvent(new Event('focus'))")
 page.locator('#keyboard-help > summary').click();page.wait_for_function('__mall.state.paused');before=state(page);result.append({'signal':'Help','phase':phase,'after':still(page,before)});page.locator('#keyboard-help > summary').click();page.wait_for_function('!__mall.state.paused')
 page.locator('#header-map').click();page.wait_for_function('__mall.state.paused');before=state(page);result.append({'signal':'Map','phase':phase,'after':still(page,before)});page.locator('#map-close').click();page.wait_for_function('!__mall.state.paused')
 page.locator('#keyboard-help > summary').click();page.wait_for_function('__mall.state.paused');before=state(page);result.append({'signal':'Help','phase':phase,'after':still(page,before)});page.locator('#keyboard-help > summary').click();page.wait_for_function('!__mall.state.paused')
 page.locator('#view-toggle').click();page.wait_for_function('__mall.state.paused');before=state(page);result.append({'signal':'List','phase':phase,'after':still(page,before)});page.locator('#view-toggle').click();page.wait_for_function('!__mall.state.paused')
 before=page.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));__mall.setInput(null);return __mall.state}");page.wait_for_timeout(220);after=state(page);assert after['frames']==before['frames'] and abs(after['y']-before['y'])<1e-6 and after['elevatorPhase']==before['elevatorPhase'];result.append({'signal':'synthetic-hidden-native-clock','phase':phase,'before':before,'after':after});page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
 old=page.viewport_size;page.set_viewport_size({'width':old['width']+1,'height':old['height']});page.set_viewport_size(old);s=state(page);assert s['elevatorTravel'] or s['elevator']['calling'];result.append({'signal':'native-resize-valid-phase','phase':phase,'after':s});step(page)
 return result

def isolated_guard(page,label):
 # Preserve the native seat/cart/item state, but place its real body at the
 # otherwise valid dock in one synchronous task; restore before any render.
 return page.evaluate('''label=>{const {player,elevator}=__stage7QA;const original={...player.body.translation()};
 player.body.setTranslation({x:elevator.exit.x,y:.89,z:elevator.exit.z},true);player.body.setNextKinematicTranslation({x:elevator.exit.x,y:.89,z:elevator.exit.z});
 const before=player.state,ok=player.useElevator(elevator),after=player.state;
 player.body.setTranslation(original,true);player.body.setNextKinematicTranslation(original);
 if(ok||after.elevatorTravel||after.capsuleEnabled!==before.capsuleEnabled)throw Error('Unsafe '+label+' lift activation');return {label,method:'QA-only synchronous body-position fault isolates proximity/floor from native interaction state',before,after,accepted:ok};}''',label)

def amenities(page):
 row={};page.evaluate('__mall.teleport("entry")');step(page)
 for x,z in [(10,46.2),(-5,46.2)]:walk(page,x,z)
 assert state(page)['nearby']=='mall-directory';page.locator('#inspect').click();assert page.locator('#mall-map').evaluate('e=>e.open');page.locator('#map-close').click();step(page);row['directory']='native Map opens at canonical entrance-west kiosk'
 walk(page,25,46.2);assert state(page)['nearby']=='service-desk';page.locator('#inspect').click();page.locator('#amenity-dialog').wait_for(state='visible');assert 'not a staffed' in page.locator('#amenity-dialog-description').inner_text();page.keyboard.press('Escape');page.wait_for_function('!__mall.state.paused');row['guestGuide']='native self-service guide at entrance-east desk'
 for x,z in [(32,46.2),(32,18.9),(-7,18.9)]:walk(page,x,z)
 assert state(page)['nearby']=='featured-showcase';ids=page.locator('[data-product]').evaluate_all('els=>els.map(e=>e.dataset.product)');assert len(ids)==4
 for ident in ids:
  page.locator('#inspect').click();page.locator('#amenity-dialog').wait_for(state='visible');assert page.locator('#amenity-dialog [data-object-action]').count()==4;page.locator(f'#amenity-dialog [data-object-action="{ident}"]').click();page.locator('#product-dialog').wait_for(state='visible');page.locator('#product-add').click();page.locator('#product-close').click();page.wait_for_function('!__mall.state.paused')
 row['showcaseFourSkus']=ids;return row

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--evidence',type=Path,required=True);out=ap.parse_args().evidence;out.mkdir(parents=True,exist_ok=True)
 report={'sourceHashes':hashes(),'testSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'checks':[],'scope':'Native DOM/controller and synthetic interruption events; QA-only module exposure/body fault is explicitly limited to safety-guard isolation. No performance/physical-device claim.'}
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
   for fallback in [False,True]:
    c=browser.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='no-preference',service_workers='block');c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    if fallback:
     use_individual_assets(c)
     for name in ['mall-service-desk.glb','mall-glass-showcase.glb']:c.route('**/'+name,lambda route:route.abort())
    def expose(route):
     response=route.fetch();source=response.text();needle='player.setPaused(() => modes.paused());';assert source.count(needle)==1
     served=source.replace(needle,needle+"Object.defineProperty(window,'__stage7QA',{value:{player,elevator,physics,world}});")
     report['qaExposure']={'sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'servedSha256':hashlib.sha256(served.encode()).hexdigest(),'insertion':'Object.defineProperty(window, __stage7QA, actual private references); only after setPaused'}
     write_source(out/'qa-script.js',served);route.fulfill(response=response,body=served)
    c.route('**/v11/script.bundle.js',expose);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded');page.wait_for_function('window.__sceneReady===true',timeout=90000)
    row={'fallback':fallback,'errors':errors};report['checks'].append(row)
    s=state(page)
    for kind,point in [('desk',(25,45)),('showcase',(-7,18))]:
     record=s['amenities'][kind];assert record['status']==('fallback' if fallback else 'loaded');assert record['placements'][0][0]==point[0] and record['placements'][0][2]==point[1]
    if not fallback:
     lobby(page);dock(page);action(page);step(page,1100);assert state(page)['elevatorTravel'];row['ridePauses']=pause_checks(page,'ride');step(page,5000);assert state(page)['y']>7
     lobby(page);action(page);step(page,650);assert state(page)['elevator']['calling'];row['callPauses']=pause_checks(page,'empty-call');step(page,4000);assert not state(page)['elevatorTravel'];assert state(page)['elevator']['docked']==0
     # Native real item pickup and SKU-specific established cart feedback.
     page.evaluate('__mall.teleport("newmoon")');step(page);pickup=page.evaluate("__stage7QA.world.shelves.find(s=>s.id.includes('au-425g')).pickup")
     walk(page,pickup['x'],1);walk(page,pickup['x'],pickup['z']);page.get_by_role('button',name='Pick up product',exact=True).click();step(page,2500);assert state(page)['character']['physicalProduct']['phase']=='held'
     assert page.locator('#scene-cart').is_enabled();page.locator('#scene-cart').click();assert 'Return' in page.locator('#cart-status').inner_text() and 'Australia' in page.locator('#cart-status').inner_text();page.locator('#bag-close').click();step(page)
     row['heldGuard']=isolated_guard(page,'held product');page.get_by_role('button',name='Return to shelf',exact=True).click();step(page,2500);assert state(page)['character']['physicalProduct']['phase']=='empty'
     page.evaluate('__mall.teleport("entry")');step(page);seat=next(s for s in state(page)['seats'] if s['name'].startswith('West lounge'))
     for x,z in [(10,39),(-12,39),(-12,seat['exitZ']),(seat['exitX'],seat['exitZ'])]:walk(page,x,z)
     assert state(page)['nearby']==seat['id'];page.locator('#inspect').click();step(page,1600);assert state(page)['seated'];row['seatGuard']=isolated_guard(page,'seated visitor');page.locator('#bag-open').click();assert page.locator('#cart-toggle').is_disabled();page.locator('#bag-close').click();page.locator('#inspect').click();step(page,1600);assert not state(page)['seated']
     page.evaluate('__mall.teleport("atrium")');step(page);page.locator('#scene-cart').click();assert state(page)['pushing'];row['cartGuard']=isolated_guard(page,'active cart');page.locator('#scene-cart').click();assert not state(page)['pushing']
    row['amenities']=amenities(page);page.screenshot(path=str(out/('fallback.png' if fallback else 'loaded.png')));assert not errors and state(page)['illegalCount']==0;save(out/'report.json',report);print('LIFT INTERRUPTIONS/AMENITIES PASS',fallback,flush=True);c.close()
   browser.close()
 finally:
  report['sourcesUnchanged']=hashes()==report['sourceHashes'];save(out/'report.json',report);server.shutdown();server.server_close()
 assert report['sourcesUnchanged'];print('LIFT ADDON ALL PASS',flush=True)
if __name__=='__main__':run()
