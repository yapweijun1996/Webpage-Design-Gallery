"""Focused appearance controls remain visible after a change in a short Help panel."""
import argparse,functools,http.server,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet
ROOT=Path(__file__).resolve().parents[1]
def run():
 parser=argparse.ArgumentParser();parser.add_argument('--screens',type=Path);args=parser.parse_args()
 if args.screens:args.screens.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as pw:
   b=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--ignore-gpu-blocklist'])
   for width,height in [(320,568),(390,844),(667,375),(844,390),(1440,900)]:
    c=b.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',service_workers='block');c.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    p=c.new_page();p.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/#experience');p.wait_for_function('window.__sceneReady',timeout=90000);p.locator('#keyboard-help summary').click()
    hair=p.get_by_role('combobox',name='Hair',exact=True);hair.focus();assert hair.evaluate('e=>e===document.activeElement')
    # The visitor can scroll away while a field remains focused; changing that
    # field must reveal it, without permanently preventing later manual scroll.
    p.locator('#controls-copy').evaluate('e=>e.scrollTop=e.scrollHeight');p.wait_for_timeout(150)
    clipped=not hair.evaluate('''e=>{const r=e.getBoundingClientRect(),v=document.querySelector('#controls-copy').getBoundingClientRect();return r.top>=v.top&&r.bottom<=v.bottom}''')
    if (width,height)==(667,375):assert clipped,'Landscape fixture must reproduce the clipped focused control'
    hair.select_option('short')
    p.wait_for_function('''()=>{const e=document.querySelector('select[name="hair"]'),p=document.querySelector('#controls-copy'),r=e.getBoundingClientRect(),v=p.getBoundingClientRect();return e===document.activeElement&&r.top>=v.top&&r.bottom<=v.bottom&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}''',timeout=3000)
    assert p.evaluate('__mall.state.character.customization.hair')=='short'
    if args.screens and width in (390,667,1440):p.screenshot(path=str(args.screens/f'help-focus-{width}.png'))
    p.locator('#controls-copy').evaluate('e=>e.scrollTop=e.scrollHeight');p.wait_for_timeout(150)
    assert p.locator('#controls-copy').evaluate('e=>e.scrollTop+e.clientHeight>=e.scrollHeight-1')
    print(f'PASS {width}x{height}: change reveals focused control; later manual scroll remains available',flush=True);c.close()
   b.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
