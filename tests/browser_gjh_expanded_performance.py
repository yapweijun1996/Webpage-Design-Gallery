"""Matched local classic/expanded observations; not a device or GPU timing benchmark."""
from gjh_startup_test_helpers import mall_entry_url
import functools
import http.server
import json
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def run():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[
                '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),
                '--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
            print('Browser:',browser.version,flush=True)
            for w,h in [(390,844),(1440,900)]:
                for query in ['?layout=classic', '']:
                    context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=2,
                        has_touch=w<1000,reduced_motion='reduce',service_workers='block')
                    context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
                    page=context.new_page();page.goto(mall_entry_url(base+query));page.wait_for_function('window.__sceneReady',timeout=90000)
                    page.evaluate('__mall.teleport("atrium");__mall.setInput({forward:0,yaw:0});__mall.step(100)')
                    idle=page.evaluate('''()=>{let s=__mall.state;return {draw:s.drawCalls,triangles:s.renderTriangles,resources:s.rendererResources,quality:s.graphics.quality}}''')
                    page.evaluate('__mall.setInput(null)')
                    intervals=page.evaluate('''()=>new Promise(resolve=>{let a=[],last=null;function tick(now){if(last!==null)a.push(now-last);last=now;if(a.length===120)resolve(a);else requestAnimationFrame(tick)}requestAnimationFrame(tick)})''')
                    intervals.sort();page.locator('#scene-cart').click();page.evaluate('__mall.setInput({forward:0});__mall.step(20)')
                    cart=page.evaluate('''()=>{let s=__mall.state;return {active:s.pushing,draw:s.drawCalls,triangles:s.renderTriangles,resources:s.rendererResources}}''')
                    assert cart['active'],cart
                    print(json.dumps({'viewport':[w,h],'layout':'expanded' if not query else 'classic','idle':idle,
                        'cart':cart,'rafMedianMs':round(intervals[60],2),'rafP95Ms':round(intervals[113],2)}),flush=True)
                    context.close()
            browser.close()
    finally:
        server.shutdown();server.server_close()
if __name__=='__main__':run()
