"""Compact nonmodal tutorial bounds, keyboard access and dynamic reflow."""
from browser_gjh_guide import *
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--live',action='store_true');args=ap.parse_args();out=ROOT.parent/'evidence/v11-compact-guide';out.mkdir(exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/';results=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[f'--use-angle={os.environ.get("GALLERY_WEBGL_BACKEND","swiftshader")}', '--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.live else [(320,480),(390,680),(390,844),(430,932),(768,1024),(844,390),(1440,900)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce');ready(page,url);guide(page)
    card=page.locator('#guide-card');box=card.bounding_box()
    assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=w and box['y']+box['height']<=h,box
    assert not card.locator('button').evaluate_all('els=>els.some(e=>e.getBoundingClientRect().height<44||e.getBoundingClientRect().width<44)')
    page.locator('#guide-skip').focus()
    page.keyboard.press('Tab');assert page.evaluate('document.activeElement.id==="guide-next"')
    assert page.locator('#guide-next').evaluate('e=>getComputedStyle(e).outlineStyle!="none"')
    page.keyboard.press('Tab')
    assert page.evaluate('!document.activeElement.closest("#guide-card")')
    assert not state(page)['paused']
    page.screenshot(path=str(out/f'{"live" if args.live else "after"}-{w}x{h}.png'))
    page.set_viewport_size({'width':w,'height':320})
    page.wait_for_function('innerHeight===320')
    for selector in ['#guide-skip','#guide-next']:
     control=page.locator(selector);control.focus()
     assert control.evaluate('e=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
    assert card.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    page.locator('#guide-skip').click();closed(page)
    results.append({'viewport':[w,h],'cardBounds':box,'nonmodalTabExit':'PASS','height320Reflow':'PASS','keyboardFocusRing':'PASS'});page.close()
   b.close()
 finally:server.shutdown()
 (out/('live-report.json' if args.live else 'report.json')).write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
