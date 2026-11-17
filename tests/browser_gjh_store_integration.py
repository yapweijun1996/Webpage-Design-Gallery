"""Three-store 3D/directory, detail and bag parity in the expanded shell."""
import argparse
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet, move, open_map

ROOT=Path(__file__).resolve().parents[1]
STORES=[('newmoon','New Moon',-10),('mili','MILI',0),('gogo','GOGO',10)]
SKUS=['nz-425g','au-425g','sa-425g','mx-454g']

def state(page):
    return page.evaluate('''()=>{let s=__mall.state;return {x:s.x,z:s.z,zone:s.zone,nearby:s.nearby,doors:s.doors,drawCalls:s.drawCalls,renderTriangles:s.renderTriangles,camera:s.cameraObstruction}}''')

def run():
    parser=argparse.ArgumentParser();parser.add_argument('--screens',type=Path);args=parser.parse_args()
    if args.screens:args.screens.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[
          '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),
          '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        print('Browser:',browser.version,flush=True)
        for width,height,visitor in [(320,700,''),(390,844,''),(768,1024,''),(844,390,''),(1440,900,''),(390,844,'&visitor=v1')]:
          context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,
            has_touch=width<1000,reduced_motion='reduce',service_workers='block')
          context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
          page=context.new_page();errors=[]
          page.on('pageerror',lambda e:errors.append(str(e)))
          page.goto(base+'?layout=expanded'+visitor);page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
          assert page.evaluate('window.__sceneReady===true')
          page.locator('#view-toggle').click()
          for ident,label,x in STORES:
            button=page.locator(f'[data-visit-store="{ident}"]');assert button.is_visible()
            button.scroll_into_view_if_needed();r=button.bounding_box();assert r['height']>=44 and r['width']>=44,r
            if args.screens and ident=='mili' and not visitor and width in (390,1440):
              page.screenshot(path=str(args.screens/f'directory-{width}.png'))
            button.click();page.wait_for_function('x=>Math.abs(__mall.state.x-x)<.1&&Math.abs(__mall.state.z-2.4)<.1',arg=x)
            if args.screens and not visitor and width in (390,768,1440):page.screenshot(path=str(args.screens/f'{ident}-approach-{width}.png'))
            if width==1440 and not visitor:
              move(page,x+3.55,2.4,2.65)
              page.evaluate('__mall.setInput({forward:1,yaw:0});__mall.step(2500);__mall.setInput({forward:0});__mall.step(20)')
              assert state(page)['z']>.25,('glass window should block passage',ident,state(page))
              assert page.evaluate('id=>__mall.teleport(id)',ident)
            page.evaluate('__mall.setInput({forward:1});__mall.step(1600);__mall.setInput({forward:0});__mall.step(20)')
            s=state(page);assert s['zone']==ident and s['z']<0 and s['doors'][ident]>.9,s
            if width in (390,1440) and not visitor:
              print(f'METRIC {width} {ident} inside: {s["drawCalls"]} draws, {s["renderTriangles"]} triangles',flush=True)
            page.locator('#view-toggle').click()
          assert page.locator('[data-store]:visible').count()==3 and page.locator('.product-card').count()==4
          assert all(page.locator(f'[data-store="{ident}"] h2').first.text_content()==label for ident,label,_ in STORES)
          # Start from the directory and reach each actual shelf via the real controller.
          if width in (390,1440) and not visitor:
            page.locator('[data-visit-store="newmoon"]').click()
            for sku in SKUS:
              assert page.evaluate('__mall.teleport("newmoon")')
              move(page,-10,-2.6,2.65);move(page,-10,-7.4,2.65)
              shelf=page.evaluate('id=>__mall.state.shelves.find(s=>s.id===id)',f'new-moon-{sku}-front')
              shelf_x=(shelf['min']['x']+shelf['max']['x'])/2
              move(page,shelf_x,-7.4,2.65)
              expected=f'new-moon-{sku}-front';assert state(page)['nearby']==expected,(sku,state(page))
              label=page.locator(f'[data-product="{expected}"]').get_attribute('data-product-name')
              page.locator('#inspect').click();assert page.locator('#product-dialog').is_visible()
              assert page.locator('#product-title').inner_text()==label
              assert page.locator('#product-shop').get_attribute('href')=='https://www.gjheshop.com/'
              assert 'unofficial' in page.locator('#product-description').inner_text().lower()
              page.wait_for_function('__newMoonPreview.state.loaded',timeout=30000)
              assert page.evaluate('__newMoonPreview.state.sku')==sku
              if args.screens and sku=='sa-425g':page.screenshot(path=str(args.screens/f'product-{width}.png'))
              page.locator('#product-add').click();page.locator('#product-close').click()
              page.wait_for_function('!document.querySelector("#product-dialog").open')
            assert '4' in page.locator('#bag-open').inner_text()
            pickup=page.get_by_role('button',name='Pick up product',exact=True)
            if pickup.is_disabled():
              page.evaluate('__mall.setInput({forward:1,yaw:0});__mall.step(500);__mall.setInput({forward:0});__mall.step(20)')
            pickup.click();page.evaluate('__mall.step(1600)')
            assert page.evaluate('__mall.state.character.physicalProduct.phase')=='held'
            assert '4' in page.locator('#bag-open').inner_text()
            page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1600)')
            assert page.evaluate('__mall.state.character.physicalProduct.phase')=='empty'
            print(f'PASS {width} V2 physical pickup and return preserves the four-item bag',flush=True)
            # Each brand-only store opens its own artwork rather than fabricated products.
            for ident,label,x in STORES[1:]:
              assert page.evaluate('id=>__mall.teleport(id)',ident)
              move(page,x,-2.6,2.65);move(page,x+1.25,-2.6,2.65);move(page,x+1.25,-8,2.65)
              assert state(page)['nearby']==ident,(ident,state(page))
              page.locator('#inspect').click();assert page.locator('#product-dialog').is_visible()
              assert page.locator('#product-title').inner_text()==label
              assert page.locator('#product-image').get_attribute('src')==f'assets/{ident}-brand-cover.jpg'
              assert 'No verified' in page.locator('#product-description').inner_text()
              assert page.locator('#product-bag-actions').is_hidden();page.locator('#product-close').click()
            page.locator('#view-toggle').click();assert '4' in page.locator('#bag-open').inner_text()
            page.locator('#bag-open').click();assert page.locator('#bag-items li').count()==4;page.locator('#bag-close').click()
          assert not errors,errors
          print(f'PASS {width}x{height} {visitor or "visitor=v2"}: directory destinations, physical doors'+(', four SKU and brand details, retained bag' if width in (390,1440) and not visitor else ''),flush=True)
          context.close()
        for query in ['', '?visitor=v1']:
          context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
          context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
          page=context.new_page();page.goto(base+query);page.wait_for_function('window.__sceneReady',timeout=90000)
          for ident,label,x in STORES:
            page.locator('#view-toggle').click();page.locator(f'[data-visit-store="{ident}"]').click()
            page.wait_for_function('x=>Math.abs(__mall.state.x-x)<.1&&Math.abs(__mall.state.z-2.4)<.1',arg=x)
          print(f'PASS original scene {query or "visitor=v2"}: all three directory destinations',flush=True);context.close()
        for mode in ['no-js','physics-failure']:
          context=browser.new_context(java_script_enabled=mode!='no-js',service_workers='block');page=context.new_page()
          if mode=='physics-failure':page.route('**/rapier.mjs',lambda route:route.abort())
          page.goto(base+'?layout=expanded')
          if mode=='physics-failure':page.wait_for_function('window.__sceneFailed',timeout=90000)
          assert page.locator('#store-list').is_visible() and page.locator('[data-store]').count()==3 and page.locator('.product-card').count()==4
          assert all(page.locator(f'[data-visit-store="{ident}"]').is_hidden() for ident,_,_ in STORES)
          print(f'PASS {mode}: readable directory and no misleading 3D action',flush=True);context.close()
        browser.close()
    finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
