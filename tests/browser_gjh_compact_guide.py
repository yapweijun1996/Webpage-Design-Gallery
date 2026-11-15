"""Targeted compact onboarding layout, dynamic reflow, dismissal and input isolation."""
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
    d=page.locator('#guide-dialog');box=d.bounding_box();assert box['x']>=15 and box['y']>=15 and box['x']+box['width']<=w-15 and box['y']+box['height']<=h-15
    # The shipped contextual navigation moved Guide content into its own
    # scroll owner and added a separate footer. Keep the original content budget
    # and independently require the entire dialog/footer to remain in view.
    scroll=d.locator('.guide-scroll');content=scroll.bounding_box();footer=d.locator('#context-navigation-guide').bounding_box()
    if h>=680:assert content['height']<h*.75,content
    assert content['y']>=box['y'] and content['y']+content['height']<=footer['y']
    assert footer['y']+footer['height']<=box['y']+box['height'] and footer['y']+footer['height']<=h-15
    assert page.evaluate('document.activeElement.id==="guide-title"');page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.id==="context-shops"');page.keyboard.press('Tab');assert page.evaluate('document.activeElement.id==="guide-close"')
    assert page.locator('#guide-close').evaluate('e=>getComputedStyle(e).outlineStyle!="none"')
    assert not d.locator('button').evaluate_all('els=>els.some(e=>e.getBoundingClientRect().height<44||e.getBoundingClientRect().width<44)')
    page.locator('#guide-title').focus();page.evaluate('document.querySelector(".guide-scroll").scrollTop=0');page.screenshot(path=str(out/f'{"live" if args.live else "after"}-{w}x{h}.png'))
    before=state(page);cdp=page.context.new_cdp_session(page)
    # Actual browser touch events on backdrop and dialog must not reach scene controls.
    for x,y in [(5,5),(w/2,box['y']+90)]:
     cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+40,'y':y+20}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    page.keyboard.press('w');page.evaluate('__mall.step(200)');after=state(page);assert all(before[k]==after[k] for k in ['x','z','yaw']),[before,after]
    page.locator('#guide-close').click();closed(page);page.wait_for_function('document.activeElement.id==="scene"')
    # Physics resumes after dismissal; sample once and allow only 10 micrometres
    # of ground-correction rounding, far below a 44mm normal walking tick.
    resumed=state(page);delta={k:resumed[k]-before[k] for k in ['x','z','yaw']}
    assert abs(delta['x'])<=1e-5 and abs(delta['z'])<=1e-5 and delta['yaw']==0, {'before':before,'resumed':resumed,'delta':delta}
    reopen(page);page.locator('#guide-close').click();closed(page);page.wait_for_function('document.activeElement.id==="guide-reopen"');assert page.locator('#guide-reopen').is_visible()
    reopen(page);page.keyboard.press('Escape');closed(page);page.wait_for_function('document.activeElement.id==="guide-reopen"')
    reopen(page);page.set_viewport_size({'width':w,'height':320});page.wait_for_timeout(100);d.locator('#guide-list').scroll_into_view_if_needed();assert scroll.evaluate('e=>e.scrollWidth<=e.clientWidth+1');assert d.locator('#context-navigation-guide').evaluate('e=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight}');assert page.locator('#guide-close').evaluate('e=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight}')
    page.locator('#guide-start').click();closed(page);page.wait_for_function('document.activeElement.id==="scene"')
    results.append({'viewport':[w,h],'dialogBounds':box,'contentBounds':content,'footerBounds':footer,'backgroundTouchIsolation':'PASS','closeEscapeReopenFocus':'PASS','height320Reflow':'PASS','keyboardFocusRing':'PASS'});page.close()
   b.close()
 finally:server.shutdown()
 (out/('live-report.json' if args.live else 'report.json')).write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':run()
