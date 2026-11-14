"""Targeted typography/reflow evidence for the independent-demo disclosure."""
from browser_gjh_budget import ROOT,Quiet,functools,http,threading,sync_playwright,os,json
import argparse
def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--live',action='store_true');args=ap.parse_args();out=ROOT.parent/'evidence/v11-disclosure-type';out.mkdir(exist_ok=True)
 s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();results=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,844)] if args.live else [(320,740),(390,844),(844,390),(1440,900)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=True);page.goto(args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-list').click();page.locator('[data-inspect="new-moon-mx-454g-front"]').click();page.locator('#product-preview-load').click();page.wait_for_function('__newMoonPreview.state.loaded')
    note=page.locator('#product-disclaimer');note.scroll_into_view_if_needed();r=note.evaluate('e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),link=document.querySelector("#product-shop").getBoundingClientRect();return {fontSize:s.fontSize,color:s.color,lineHeight:s.lineHeight,text:e.textContent,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,gap:r.top-link.bottom,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}}')
    assert r['text']=='Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.'
    assert r['fontSize']=='14px' and r['color']=='rgb(93, 105, 94)' and r['hit']
    assert r['left']>=0 and r['right']<=w and r['bottom']<=h and r['gap']>=18,r
    assert page.evaluate('document.querySelector("#product-dialog").scrollWidth<=document.querySelector("#product-dialog").clientWidth+1')
    assert page.locator('#product-close').evaluate('e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
    page.screenshot(path=str(out/f'after-{"live-" if args.live else ""}{w}.png'));page.locator('#product-close').tap();page.wait_for_function('!document.querySelector("#product-dialog").open && __newMoonPreview.state.activeResources===0');page.wait_for_function('document.activeElement.matches("[data-inspect]")')
    results.append({'viewport':[w,h],'disclosure':r,'tapCloseAndFocus':'PASS'});page.close()
   b.close()
 finally:s.shutdown()
 (out/('live-report.json' if args.live else 'report.json')).write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
