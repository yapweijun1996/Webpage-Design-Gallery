"""M056 in the actual mall, support placement and Visitor v2 pickup/return."""
from browser_gjh_guide import *
from browser_gjh_all_seats import move
import argparse
from gjh_startup_test_helpers import use_individual_assets
ap=argparse.ArgumentParser();ap.add_argument('--url');args=ap.parse_args();out=ROOT.parent/'evidence/m056';out.mkdir(exist_ok=True)
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);rows=[]
  for w,h in ([(390,844)] if args.url else [(390,844),(1440,900)]):
   page=b.new_page(viewport={'width':w,'height':h},has_touch=w<650);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#scene').focus();page.wait_for_function('document.activeElement.id==="scene"');a=state(page)['productAssets'];assert a['shelf']['model']=='GJH-M056' and a['shelf']['status']=='loaded' and a['shelf']['primitives']==29 and a['shelf']['instances']==4;assert a['totalInstances']==132
   page.evaluate('__mall.teleport("newmoon");__mall.setInput({forward:1});__mall.step(3200);__mall.setInput({forward:0});__mall.step(20)');page.screenshot(path=str(out/f'after-wide-{w}.png'));draw=state(page)['drawCalls'];assert draw<150
   for sku,record in a['cans'].items():
    x=record['placements'][record['reserveIndex']]['x'];assert -15<x-1.2 and x+1.2<-5;assert record['actualBoundsScale'][0]<1.001;assert len(record['placements'])==33
    assert sorted(set(round(v['y'],3) for v in record['placements']))==[.451,.991,1.531]
    # Move parallel in the clear aisle, then approach the matching shelf.
    move(page,x,-7.5);assert state(page)['nearby']==f'new-moon-{sku}-front';page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.setInput({forward:0});__mall.step(1000)');held=state(page)['character']['physicalProduct'];assert held['phase']=='held',held
    assert page.get_by_role('button',name='Return to shelf',exact=True).is_enabled()
    if sku=='au-425g':page.screenshot(path=str(out/f'held-{w}.png'))
    page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1000)');assert state(page)['character']['physicalProduct']['phase']=='empty';assert page.locator('#bag-open').inner_text()=='Bag (0)'
    # Repeat ensures reservation slot was restored, not permanently removed.
    page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.step(1000)');assert state(page)['character']['physicalProduct']['phase']=='held';page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1000)')
   page.screenshot(path=str(out/f'after-close-{w}.png'));page.evaluate('__mall.setInput({forward:1});__mall.step(1500);__mall.setInput({forward:0});__mall.step(20)');assert state(page)['z']>-8.7,state(page)['z'];assert not errors,errors;rows.append({'width':w,'shelf':'PASS','fourSKURepeatedPickupReturn':'PASS','nativePlacement':'PASS','collision':'PASS','drawCalls':draw,'pageErrors':errors});page.close()
  if not args.url:
   page=b.new_page();use_individual_assets(page);page.route('**/gjh-m056-shelf-lod1.glb',lambda route:route.abort());ready(page,f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');assert state(page)['productAssets']['shelf']['status']=='fallback';assert all(x['status']=='loaded' for x in state(page)['productAssets']['cans'].values());rows.append({'shelfFailureFallback':'PASS'});page.close()
  b.close();print(json.dumps(rows));(out/('live-results.json' if args.url else 'results.json')).write_text(json.dumps(rows,indent=2))
finally:s.shutdown()
