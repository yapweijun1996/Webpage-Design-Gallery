"""Keyboard recovery when the real mall WebGL context is lost."""
from browser_gjh_budget import ROOT, Quiet, functools, http, threading, sync_playwright, os, json
from pathlib import Path
import argparse

def run():
 parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--output',default=str(ROOT.parent/'evidence'/'v11-fallback-focus'));args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for width,height in [(390,844),(1440,900)]:
    for mode in ['scene','guide','product','map','list-product','header']:
     page=browser.new_page(viewport={'width':width,'height':height},has_touch=width<600,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto(args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000)
     if mode!='guide':page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"')
     if mode=='product':
      page.evaluate('__mall.teleport("newmoon");__mall.setInput({});__mall.step(400);__mall.setInput({forward:1});__mall.step(1500);__mall.setInput({right:-1});__mall.step(300);__mall.setInput({forward:1});__mall.step(2300);__mall.setInput({})')
      assert page.evaluate('__mall.state.nearby'),page.evaluate('__mall.state');page.locator('#scene').focus();page.keyboard.press('f');page.locator('#product-dialog').wait_for(state='visible')
     elif mode=='map':
      page.locator('#mall-map').evaluate('e=>e.open=true');page.locator('[data-teleport]').first.focus()
     elif mode=='list-product':
      page.locator('#view-toggle').click();page.locator('[data-product] [data-inspect]').first.click();page.locator('#product-close').focus()
     elif mode=='header':page.locator('header a').first.focus()
     active=page.evaluate('document.activeElement.id || document.activeElement.tagName')
     page.evaluate('scene.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');page.wait_for_function('window.__sceneFailed===true');page.wait_for_timeout(100)
     assert page.locator('#store-list').is_visible();assert page.locator('.product-card').count()==4
     after=page.evaluate('document.activeElement.id || document.activeElement.tagName');print(json.dumps({'viewport':[width,height],'mode':mode,'before':active,'after':after}),flush=True)
     if mode in ['scene','guide','product','map']:
      assert after=='list-title','Hidden 3D focus must recover to directory heading'
      assert not page.locator('#guide-dialog').evaluate('e=>e.open') and not page.locator('#product-dialog').evaluate('e=>e.open')
      page.keyboard.press('Tab');assert page.evaluate('document.activeElement.getClientRects().length>0 && !document.activeElement.closest("[hidden]")')
      page.locator('[data-product] [data-inspect]').first.focus();page.keyboard.press('Enter');page.locator('#product-dialog').wait_for(state='visible');page.keyboard.press('Escape')
     elif mode=='list-product':
      assert page.locator('#product-dialog').evaluate('e=>e.open') and after=='product-close','Do not interrupt a working list dialog'
      page.keyboard.press('Escape');page.wait_for_function('document.activeElement.matches("[data-inspect]")')
     else:assert page.locator('header a').first.evaluate('e=>e===document.activeElement'),'Do not steal unaffected header focus'
     assert not errors,errors;results.append({'viewport':[width,height],'mode':mode,'focus':after,'result':'PASS','errors':errors});page.close()
   browser.close()
 finally:server.shutdown()
 (out/'report.json').write_text(json.dumps({'environment':'Linux ARM64 Chromium/SwiftShader, actual WEBGL_lose_context; not physical devices or screen-reader testing','results':results},indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
