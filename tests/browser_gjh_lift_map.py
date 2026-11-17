"""Final UI bridge: canonical service markers and accessible compact Map."""
from gjh_startup_test_helpers import mall_entry_url
import argparse,functools,hashlib,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_lift import ROOT,Quiet,hashes,save,state,step,lobby,dock,action
from browser_gjh_interior_pilot import open_map

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--evidence',type=Path,required=True);out=ap.parse_args().evidence;out.mkdir(parents=True,exist_ok=True)
 report={'sourceHashes':hashes(),'testSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'checks':[]}
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
   for w,h,visitor in [(320,700,''),(390,844,''),(639,826,''),(844,390,''),(1440,900,''),(390,844,'&visitor=v1')]:
    c=browser.new_context(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce',service_workers='block');c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')");page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(mall_entry_url(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'+visitor));page.wait_for_function('window.__sceneReady===true',timeout=90000);open_map(page)
    markers=page.evaluate('''async()=>{const {liftLayout:L}=await import('./assets/lift-layout.js');const {expandedMapPoint}=await import('./assets/expanded-layout.js');return [...document.querySelectorAll('[data-map-service]')].map(e=>{const point=({'directory':L.directory,'guest-guide':L.desk,'featured-collection':L.showcase,'visitor-lift':L})[e.dataset.mapService],expected=expandedMapPoint(point.x,point.z),r=e.querySelector('rect');return {id:e.dataset.mapService,label:e.querySelector('title').textContent,x:+r.getAttribute('x')+20,y:+r.getAttribute('y')+20,expected,actions:e.querySelectorAll('button,a,[tabindex]').length};});}''')
    expected={'directory','guest-guide','featured-collection'}|({'visitor-lift'} if not visitor else set());assert {m['id'] for m in markers}==expected
    for m in markers:assert m['x']==m['expected']['x'] and m['y']==m['expected']['y'] and m['actions']==0,m
    assert page.locator('.expanded-map-number').count()==17 and page.locator('[data-space-id]').count()==14 and page.locator('[data-teleport]').count()==3
    legend=page.locator('#map-services-legend');assert legend.is_visible();assert ('Visitor lift' in legend.inner_text())==(not visitor)
    legend.scroll_into_view_if_needed();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    legend_bounds=legend.evaluate('(e)=>{const r=e.getBoundingClientRect(),p=document.querySelector("#mall-map").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,panelLeft:p.left,panelRight:p.right,panelBottom:p.bottom}}')
    assert legend_bounds['left']>=legend_bounds['panelLeft'] and legend_bounds['right']<=legend_bounds['panelRight'] and legend_bounds['bottom']<=legend_bounds['panelBottom'],legend_bounds
    page.screenshot(path=str(out/(f'{w}-legend'+('-v1' if visitor else '')+'.png')))
    close=page.locator('#map-close')
    if w<1000:
     close.scroll_into_view_if_needed();rect=close.bounding_box()
     assert rect['width']>=44 and rect['height']>=44 and rect['x']>=0 and rect['y']>=0 and rect['x']+rect['width']<=w and rect['y']+rect['height']<=h
     assert close.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
     close.focus();page.screenshot(path=str(out/(f'{w}-map'+('-v1' if visitor else '')+'.png')));page.keyboard.press('Enter');assert not page.locator('#mall-map').evaluate('e=>e.open')
    else:page.screenshot(path=str(out/f'{w}-map.png'))
    row={'viewport':[w,h],'visitor':visitor or 'v2','markers':markers,'legend':legend.text_content(),'legendBounds':legend_bounds,'errors':errors}
    if w==390 and not visitor:
     lobby(page);dock(page);action(page);s=step(page,5000);assert s['y']>7 and not s['elevatorTravel'] and s['capsuleEnabled'];assert page.locator('#scene-cart').is_disabled();page.locator('#bag-open').click();assert page.locator('#cart-toggle').is_disabled() and 'visitor-only' in page.locator('#cart-status').inner_text();page.locator('#bag-close').click();action(page);s=step(page,5000);assert s['y']<.1 and s['capsuleEnabled'];row['finalUiRoundtrip']='PASS'
    assert not errors and state(page)['illegalCount']==0;report['checks'].append(row);save(out/'report.json',report);print('LIFT MAP PASS',w,visitor or 'v2',flush=True);c.close()
   browser.close()
 finally:
  report['sourcesUnchanged']=hashes()==report['sourceHashes'];save(out/'report.json',report);server.shutdown();server.server_close()
 assert report['sourcesUnchanged'];print('LIFT MAP ALL PASS',flush=True)
if __name__=='__main__':run()
