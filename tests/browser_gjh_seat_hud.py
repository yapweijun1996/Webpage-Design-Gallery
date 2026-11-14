"""CSS-only compact seated HUD: targeted viewport, focus and exit checks."""
from browser_gjh_guide import *
import argparse,subprocess

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--width',type=int);args=ap.parse_args();out=ROOT.parent/'evidence/v11-seat-hud';out.mkdir(exist_ok=True);s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start();rows=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for w,h in ([(390,680)] if args.url else [(args.width,680)] if args.width else [(320,680),(390,680),(844,390)]):
    page=b.new_page(viewport={'width':w,'height':h},has_touch=True,reduced_motion='no-preference');ready(page,args.url or f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-start').click();closed(page);page.wait_for_function('document.activeElement.id==="scene"');page.evaluate('__mall.teleport("atrium");__mall.setInput({right:-1});__mall.step(1400);__mall.setInput({forward:1});__mall.step(1400);__mall.setInput({right:-1});__mall.step(750);__mall.setInput({forward:0});__mall.step(20)');assert state(page)['nearby']=='courtyard-seat';page.locator('#inspect').click();page.evaluate('__mall.setInput({forward:0});__mall.step(700)');assert state(page)['seated'],state(page);page.screenshot(path=str(out/f'cancel-{w}.png'))
    def bounds():
     r=page.locator('#inspect-prompt').bounding_box();a=page.locator('#inspect').bounding_box();d=page.locator('.scene-disclaimer').bounding_box();assert a['width']>=44 and a['height']>=44;assert r['x']>=12 and r['x']+r['width']<=w-12;assert r['y']+r['height']<d['y'];assert page.locator('#inspect-prompt').evaluate('e=>e.scrollWidth<=e.clientWidth');assert page.locator('#nearby-name').evaluate('e=>getComputedStyle(e).textOverflow')!='ellipsis';return r
    bounds();page.evaluate('__mall.step(800)');r=bounds();
    if w==390 and not args.url:
     baseline=subprocess.check_output(['git','show','99a9323:demos/corporate/gjh/v11/style.css'],cwd=ROOT,text=True);page.locator('link[href="style.css"]').evaluate('e=>e.disabled=true');old=page.add_style_tag(content=baseline);page.wait_for_function('getComputedStyle(document.querySelector("#inspect-prompt")).display!=="grid"');page.screenshot(path=str(out/'before-390.png'));old.evaluate('e=>e.remove()');page.locator('link[href="style.css"]').evaluate('e=>e.disabled=false');page.wait_for_function('getComputedStyle(document.querySelector("#inspect-prompt")).display==="grid"')
    page.screenshot(path=str(out/f'after-{w}.png'));assert r['height']<90 if w<650 else r['x']==18
    page.locator('#inspect').focus();page.keyboard.press('Tab');page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.id')=='inspect';page.screenshot(path=str(out/f'focus-{w}.png'));page.keyboard.press('Enter');page.evaluate('__mall.setInput({forward:0});__mall.step(300)');assert state(page)['seatPhase']=='stand';bounds();page.screenshot(path=str(out/f'standing-{w}.png'));page.evaluate('__mall.step(700)');assert not state(page)['seated'];assert page.locator('#inspect-prompt').evaluate('e=>getComputedStyle(e).display')!='grid';rows.append({'viewport':[w,h],'barHeight':r['height'],'targetAndDisclaimerBounds':'PASS','keyboardStand':'PASS','walkingLayoutRestored':'PASS'});page.close()
   b.close()
 finally:s.shutdown()
 (out/('live-report.json' if args.url else 'comparison-report.json' if args.width else 'report.json')).write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
if __name__=='__main__':run()
