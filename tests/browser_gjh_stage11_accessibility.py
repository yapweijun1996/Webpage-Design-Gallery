"""Axe, contrast, keyboard and target checks for all expanded-mall themes."""
import argparse,functools,hashlib,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet,open_map
ROOT=Path(__file__).resolve().parents[1]
AXE_HASH='880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb'
THEMES=('everyday','lunar-new-year','christmas','deepavali')

def run():
 parser=argparse.ArgumentParser();parser.add_argument('--axe-script',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
 assert hashlib.sha256(args.axe_script.read_bytes()).hexdigest()==AXE_HASH,'Unexpected axe-core bundle'
 args.output.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
   print('Browser:',browser.version,flush=True)
   for width,height in [(320,700),(390,844),(768,1024),(844,390),(1440,900)]:
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,has_touch=width<1000,reduced_motion='reduce',service_workers='block')
    context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded#experience');page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000);assert page.evaluate('window.__sceneReady===true')
    assert page.locator('.mall-app-settings').is_hidden(), 'Offline help must not be focusable behind the 3D scene'
    page.add_script_tag(path=str(args.axe_script));page.add_script_tag(path=str(ROOT/'tests/gjh_contrast.js'));assert page.evaluate('axe.version')=='4.10.3'
    def scan(label):
     result=page.evaluate('''async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});const unresolved=[],contrast=[];for(const rule of r.incomplete)for(const node of rule.nodes){if(rule.id!=='color-contrast'){unresolved.push({rule:rule.id,target:node.target});continue;}const element=document.querySelector(node.target[0]);contrast.push({target:node.target,...gjhContrast(element)});}return {violations:r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),unresolved,contrast};}''')
     print(json.dumps({'viewport':[width,height],'state':label,**result}),flush=True)
     assert not result['violations'],(label,result['violations']);assert not result['unresolved'],(label,result['unresolved'])
     for item in result['contrast']:assert item.get('hidden') or (not item.get('unresolved') and item['minimumRatio']>=item['requiredRatio']),(label,item)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label
    for theme in THEMES:
     page.locator('#mall-theme-open').click();dialog=page.locator('#mall-theme-dialog');assert dialog.is_visible() and page.evaluate('document.activeElement.id')=='mall-theme-title'
     before=page.evaluate('({active:__mall.state.theme.active,frames:__mall.state.frames})')
     page.locator('#mall-theme-select').select_option(theme);page.locator('#mall-theme-apply').click();page.wait_for_function('id=>__mall.state.theme.active===id',arg=theme,timeout=30000)
     if before['active']!=theme:
      after=page.evaluate('__mall.state.frames');assert after>before['frames'],('theme preview did not render',theme,before,after)
      page.wait_for_timeout(150);assert page.evaluate('__mall.state.frames')==after,('theme modal restarted animation',theme)
     assert page.locator('#mall-theme-select').input_value()==theme
     for selector in ('#mall-theme-select','#mall-theme-apply','#mall-theme-close'):
      control=page.locator(selector);box=control.bounding_box();assert box and box['width']>=44 and box['height']>=44,(selector,box)
      assert control.evaluate('e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'),(selector,box)
     page.locator('#mall-theme-close').focus();page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.id')=='mall-theme-apply'
     page.keyboard.press('Tab');assert page.evaluate('document.activeElement.id')=='mall-theme-close'
     scan('theme-dialog-'+theme)
     if theme=='deepavali' and width in (320,390,768,844,1440):page.screenshot(path=str(args.output/f'theme-dialog-{width}.png'))
     page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#mall-theme-dialog").open && document.activeElement.id==="mall-theme-open"')
     scan('scene-'+theme)
     if width in (390,1440):page.screenshot(path=str(args.output/f'{theme}-scene-{width}.png'))
    open_map(page);assert page.locator('.expanded-map-number').count()==17;scan('expanded-map')
    if page.locator('#map-close').is_visible():
     page.keyboard.press('Escape');page.wait_for_function('!document.querySelector("#mall-map").open && document.activeElement.id==="header-map"')
    page.locator('#view-toggle').click();page.locator('#store-list').wait_for(state='visible');assert page.locator('[data-store]').count()==3 and page.locator('.product-card').count()==4
    scan('expanded-directory')
    help_control=page.locator('.mall-app-settings summary');assert help_control.is_visible();help_control.scroll_into_view_if_needed();help_control.focus();page.keyboard.press('Enter')
    assert page.locator('.mall-app-settings').evaluate('e=>e.open');page.keyboard.press('Enter');assert not page.locator('.mall-app-settings').evaluate('e=>e.open')
    page.locator('[data-inspect="new-moon-nz-425g-front"]').click();assert page.locator('#product-dialog').is_visible();scan('product-dialog')
    page.locator('#product-close').click();assert not errors,errors
    print(f'PASS {width}x{height}: four themes, dialog keyboard/targets, directory and product accessibility',flush=True);context.close()
   browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
