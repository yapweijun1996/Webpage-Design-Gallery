"""Keep released M056/Shelf focus journeys and all-eight pilot selection compatible."""
import functools
import http.server
import json
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_interior_pilot import ROOT, Handler, state
from browser_gjh_shelf_focus import ready, approach, open_shelf, close_shelf, geometry, assert_mode


def run():
    rows=[];captures=ROOT/'docs/screenshots/interior-pilot-release';captures.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=['--use-angle=metal','--ignore-gpu-blocklist'])
            for pilot in (False,True):
                for width,height in ((390,844),(1440,900)):
                    c=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',service_workers='block')
                    page=c.new_page();errors=[];requests=[]
                    page.on('pageerror',lambda e:errors.append(str(e)))
                    page.on('request',lambda r:requests.append(r.url.split('/')[-1]))
                    url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'+('?interior=pilot' if pilot else '')
                    ready(page,url);assets=state(page)['productAssets']
                    expected='GJH-DSP-001' if pilot else 'GJH-M056';assert assets['shelf']['model']==expected and assets['shelf']['status']=='loaded',assets
                    assert assets['totalInstances']==36
                    assert requests.count('GJH_DSP_001.glb')==(1 if pilot else 0),requests
                    assert requests.count('gjh-m056-shelf-lod1.glb')==(0 if pilot else 1),requests
                    results=[]
                    for sku,record in assets['cans'].items():
                        assert record['status']=='loaded' and record['instances']==9,record
                        assert abs(record['supportTopY']-(.6825 if pilot else .451))<1e-8
                        approach(page,sku);before=state(page);open_shelf(page)
                        layout=geometry(page);page.screenshot(path=str(captures/f'{expected}-{sku}-focus-{width}.png'))
                        restored=close_shelf(page,'close');assert_mode(page,'explore')
                        # Preserve the exact close-event invariant; resumed grounding
                        # has the same Float32 bound as the shared Shelf review.
                        assert abs(restored['x']-before['x'])<1e-8 and abs(restored['z']-before['z'])<1e-8,(expected,sku,width,before,restored)
                        resumed=state(page)
                        assert abs(resumed['x']-restored['x'])<=1e-5 and abs(resumed['z']-restored['z'])<=1e-5,(expected,sku,width,restored,resumed)
                        # Inspect deliberately works farther away than physical pickup.
                        # Retain the exact focus/restore fixture above, then approach the
                        # reachable stock range for this separate deterministic check.
                        if page.get_by_role('button',name='Pick up product',exact=True).is_disabled():
                            page.evaluate('__mall.setInput({forward:1});__mall.step(500);__mall.setInput({forward:0});__mall.step(20)')
                        assert state(page)['nearby']==f'new-moon-{sku}-front'
                        assert page.get_by_role('button',name='Pick up product',exact=True).is_enabled()
                        for _ in range(2):
                            page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.step(1000)')
                            assert state(page)['character']['physicalProduct']['phase']=='held'
                            page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1000)')
                            assert state(page)['character']['physicalProduct']['phase']=='empty',state(page)['character']['physicalProduct']
                        print('SKU PASS',expected,sku,width,flush=True)
                        results.append({'sku':sku,'focusFramingAndClose':'PASS','repeatedPickupReturn':'PASS','layout':layout})
                    assert not errors,errors
                    assert state(page)['illegalCount']==0
                    rows.append({'model':expected,'width':width,'cases':results,'oneSelectedShelfFetch':'PASS','pageErrors':errors})
                    c.close();print('SHELF COMPATIBILITY PASS',expected,width,flush=True)
            browser.close()
    finally:server.shutdown();server.server_close()
    (ROOT/'docs/evidence/interior-pilot-release-compatibility.json').write_text(json.dumps({'result':'PASS','rows':rows},indent=2)+'\n')

if __name__=='__main__':run()
