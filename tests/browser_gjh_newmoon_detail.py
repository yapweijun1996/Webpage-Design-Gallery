"""Focused rendered, input and failure checks for New Moon detail previews."""
from browser_gjh_budget import ROOT, Quiet, functools, http, threading, sync_playwright, os, json
from pathlib import Path
import argparse

SKUS=['nz-425g','au-425g','sa-425g','mx-454g']
def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--live',action='store_true');args=ap.parse_args()
 out=ROOT.parent/'evidence'/('newmoon-preview-live' if args.live else 'newmoon-detail-preview');out.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 url=args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/';results=[]
 def state(page):return page.evaluate('__newMoonPreview.state')
 def ready(page):
  page.goto(url);page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"');page.locator('#view-toggle').click()
 def open_sku(page,sku):
  page.locator(f'[data-inspect="new-moon-{sku}-front"]').click();page.locator('#product-dialog').wait_for(state='visible');assert page.locator('#product-image').is_visible();assert state(page)['sku']==sku
 def close(page):
  page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#product-dialog").open && __newMoonPreview.state.activeResources===0')
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for width,height in ([(390,844)] if args.live else [(390,844),(844,390),(1440,900)]):
    page=browser.new_page(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));ready(page)
    records=[]
    for sku in SKUS:
     open_sku(page,sku);assert state(page)['activeResources']==0
     page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded',timeout=15000)
     s=state(page);b=s['projectedBounds'];assert -1<b['minX']<b['maxX']<1 and -1<b['minY']<b['maxY']<1,s
     page.locator('#product-preview-canvas').focus();page.keyboard.press('ArrowRight');assert state(page)['yaw']>s['yaw']
     page.keyboard.press('+');assert state(page)['zoom']<s['zoom'];page.keyboard.press('r');assert state(page)['yaw']==0 and state(page)['zoom']==1.15
     page.locator('[data-preview-orbit="left"]').click();assert state(page)['yaw']<0
     page.locator('[data-preview-zoom="out"]').click();assert state(page)['zoom']>1.15
     page.locator('#product-preview-reset').click()
     canvas=page.locator('#product-preview-canvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
     if width<1000:
      cdp=page.context.new_cdp_session(page)
      cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
      cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+35,'y':y+10}]})
      cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
     else:page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+35,y+10,steps=4);page.mouse.up()
     assert state(page)['yaw']>.2,state(page)
     page.locator('#product-preview-reset').click();page.evaluate('document.querySelector("#product-dialog").scrollTop=0');page.screenshot(path=str(out/f'{sku}-{width}x{height}.png'))
     frames=state(page)['renderCount'];page.wait_for_timeout(250);assert state(page)['renderCount']==frames
     page.locator('#product-preview-image').click();assert page.locator('#product-image').is_visible();page.locator('#product-preview-3d').click();assert page.locator('#product-preview-canvas').is_visible()
     assert page.locator('#product-shop').get_attribute('href')=='https://www.gjheshop.com/'
     if sku=='mx-454g':assert '121-degree' in page.locator('#product-description').inner_text()
     assert page.evaluate('document.querySelector("#product-dialog").scrollWidth<=document.querySelector("#product-dialog").clientWidth+1')
     close(page);page.wait_for_function('document.activeElement.matches("[data-inspect]")');records.append(sku)
    # Reusing the product dialog for non-product brands must not leak the preview controls.
    for brand in ['mili','gogo']:
     page.locator(f'[data-inspect="{brand}"]').click();assert page.locator('#product-preview-load').is_hidden();assert page.locator('#product-image').is_visible();close(page)
    assert not errors,errors;results.append({'viewport':[width,height],'skuControls':records,'pointer':'CDP touch' if width<1000 else 'mouse','defaultBoundsFit':True,'cleanup':True,'errors':errors});page.close()
   if not args.live:
    page=browser.new_page(viewport={'width':390,'height':844});ready(page)
    pattern='**/new-moon-can-nz-425g-lod1.glb'
    for mode in ['404','hash']:
     page.route(pattern,lambda r:r.fulfill(status=404 if mode=='404' else 200,body=b'wrong'));open_sku(page,'nz-425g');page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.status==="error"');assert page.locator('#product-image').is_visible() and state(page)['activeResources']==0;results.append({'fault':mode,'reason':state(page)['reason']});close(page);page.unroute(pattern)
    # Close before late response; replacement SKU must own the new generation.
    pending=[];page.route(pattern,lambda r:pending.append(r));open_sku(page,'nz-425g');page.locator('#product-preview-load').click();page.wait_for_timeout(300);assert pending;close(page)
    page.unroute(pattern)
    open_sku(page,'au-425g');page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded',timeout=15000)
    try:pending[0].fulfill(status=200,body=(ROOT/'demos/corporate/gjh/v11/assets/new-moon-can-nz-425g-lod1.glb').read_bytes())
    except Exception:pass # Aborted fetch may already be cancelled by the browser.
    page.wait_for_timeout(300);assert state(page)['sku']=='au-425g' and state(page)['loaded'];results.append({'fault':'close/reopen late fetch','PASS':True})
    # Real context loss, followed by a new-canvas retry.
    page.evaluate('document.querySelector("#product-preview-canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
    page.wait_for_function('__newMoonPreview.state.reason==="context-lost"');assert state(page)['activeResources']==0 and page.locator('#product-image').is_visible()
    page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded',timeout=15000);close(page);results.append({'fault':'real context loss and retry','PASS':True})
    # Orientation change resizes the renderer and preserves fit.
    open_sku(page,'mx-454g');page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded');page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(300)
    b=state(page)['projectedBounds'];assert -1<b['minX']<b['maxX']<1 and -1<b['minY']<b['maxY']<1
    close(page);results.append({'orientationResize':True})
    # A parsed model that finishes after the deadline must be disposed, not installed.
    page.evaluate("""async()=>{const {GLTFLoader}=await import('./vendor/GLTFLoader.js');const original=GLTFLoader.prototype.parseAsync;window.lateDisposals=0;GLTFLoader.prototype.parseAsync=async function(...args){const g=await original.apply(this,args);g.scene.traverse(o=>o.geometry?.addEventListener('dispose',()=>window.lateDisposals++));await new Promise(r=>setTimeout(r,8500));return g;};}""")
    open_sku(page,'nz-425g');page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.reason==="load-deadline"',timeout=12000);page.wait_for_function('window.lateDisposals>0',timeout=4000);assert state(page)['activeResources']==0;results.append({'lateParseDisposed':page.evaluate('window.lateDisposals')});close(page);page.close()
    # No WebGL: directory and image remain usable without a renderer.
    page=browser.new_page(viewport={'width':390,'height':844});page.add_init_script("HTMLCanvasElement.prototype.getContext=()=>null");page.goto(url);page.locator('.product-inspect').first.wait_for(state='visible');open_sku(page,'nz-425g');page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.status==="error"',timeout=15000);assert page.locator('#product-image').is_visible() and state(page)['activeResources']==0;close(page);results.append({'noWebGLImageFallback':True});page.close()
   browser.close()
 finally:server.shutdown()
 (out/'report.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
