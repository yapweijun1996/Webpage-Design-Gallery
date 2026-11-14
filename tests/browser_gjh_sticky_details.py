"""Sticky product close-bar regression: scroll, touch and keyboard visibility."""
from browser_gjh_budget import ROOT,Quiet,functools,http,threading,sync_playwright,os,json
import argparse
def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--live',action='store_true');args=ap.parse_args()
 out=ROOT.parent/'evidence'/'v11-sticky-details';out.mkdir(exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
 url=args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,844)] if args.live else [(320,740),(390,844),(430,932),(768,1024),(844,390),(1440,900)]):
    page=browser.new_page(viewport={'width':w,'height':h},has_touch=True,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-list').click();page.locator('#store-list').wait_for(state='visible')
    for preview in [False,True]:
     opener=page.locator('[data-inspect="new-moon-mx-454g-front"]');opener.click()
     if preview:page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded')
     page.locator('#product-shop').scroll_into_view_if_needed()
     close=page.locator('#product-close');geometry=close.evaluate('e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}')
     assert geometry['top']>=0 and geometry['bottom']<=h and geometry['width']>=44 and geometry['height']>=44 and geometry['hit'],geometry
     page.screenshot(path=str(out/f'after-{"live-" if args.live else ""}{w}-{preview}.png'))
     # Real keyboard navigation forces browser focus scrolling, not test scrollIntoView.
     close.focus();page.keyboard.press('Tab');seen=[]
     for n in range(16):
      element=page.locator(':focus');key=element.get_attribute('id') or element.get_attribute('aria-label');seen.append(key)
      g=element.evaluate('e=>{const r=e.getBoundingClientRect(),header=document.querySelector(".dialog-top").getBoundingClientRect();return {id:e.id,top:r.top,bottom:r.bottom,headerBottom:header.bottom,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}')
      assert g['hit'],g
      if g['id']!='product-close':assert g['top']>=g['headerBottom']-1,g
      if g['id']=='product-shop':break
      page.keyboard.press('Tab')
     assert seen[-1]=='product-shop',seen;page.keyboard.press('Tab');assert page.evaluate('document.activeElement.id')=='product-close'
     page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.id')=='product-shop'
     # Touch close while scrolled: no reverse scrolling required.
     close.tap();page.wait_for_function('!document.querySelector("#product-dialog").open && __newMoonPreview.state.activeResources===0');page.wait_for_function('document.activeElement.matches("[data-inspect]")')
     results.append({'viewport':[w,h],'preview':preview,'close':geometry,'keyboardPath':seen,'tapCloseAndReturnFocus':True})
    opener.click();page.locator('#product-shop').scroll_into_view_if_needed();page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#product-dialog").open');assert not errors,errors;page.close()
   browser.close()
 finally:server.shutdown()
 (out/('live-report.json' if args.live else 'report.json')).write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
