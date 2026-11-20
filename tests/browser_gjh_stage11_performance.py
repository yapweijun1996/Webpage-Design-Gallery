"""Matched four-theme courtyard observations, not physical-device performance."""
from gjh_menu_test_helpers import open_decor_theme
import argparse,functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet
ROOT=Path(__file__).resolve().parents[1]
THEMES=('everyday','lunar-new-year','christmas','deepavali')

def run():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();args.output.parent.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   for width,height in [(390,844),(1440,900)]:
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,has_touch=width<1000,reduced_motion='reduce',service_workers='block')
    context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded#experience');page.wait_for_function('window.__sceneReady',timeout=90000);page.wait_for_load_state('networkidle');page.evaluate('__mall.teleport("atrium")')
    def sample():
     page.evaluate('__mall.setInput({forward:0,yaw:0});__mall.step(100)')
     return page.evaluate('''()=>{const s=__mall.state;return {draw:s.drawCalls,triangles:s.renderTriangles,resources:s.rendererResources,x:s.x,z:s.z,quality:s.graphics.quality}}''')
    def network():return page.evaluate('''()=>{const a=performance.getEntriesByType('resource');return {requests:a.length,decodedBytes:a.reduce((n,r)=>n+r.decodedBodySize,0)}}''')
    result={'viewport':[width,height],'browser':browser.version,'backend':os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'startupAfterNetworkIdle':network(),'themes':{}}
    for theme in THEMES:
     open_decor_theme(page);page.locator('#mall-theme-select').select_option(theme);page.locator('#mall-theme-apply').click();page.wait_for_function('id=>__mall.state.theme.active===id',arg=theme);page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#mall-theme-dialog").open')
     idle=sample();page.locator('#scene-cart').click();assert page.evaluate('__mall.state.pushing');cart=sample();page.locator('#scene-cart').click();assert not page.evaluate('__mall.state.pushing')
     result['themes'][theme]={'idle':idle,'cart':cart}
    open_decor_theme(page);page.locator('#mall-theme-select').select_option('everyday');page.locator('#mall-theme-apply').click();page.wait_for_function('__mall.state.theme.active==="everyday"');page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#mall-theme-dialog").open');result['restoredEveryday']=sample();result['afterAllThemes']=network()
    assert result['restoredEveryday']['draw']==result['themes']['everyday']['idle']['draw'] and not errors,errors
    print(json.dumps(result),flush=True);results.append(result);context.close()
   browser.close()
 finally:server.shutdown();server.server_close()
 args.output.write_text(json.dumps(results,indent=2)+'\n')
if __name__=='__main__':run()
