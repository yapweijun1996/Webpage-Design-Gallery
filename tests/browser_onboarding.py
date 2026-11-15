"""Reusable onboarding contracts in a lightweight browser sandbox (no WebGL)."""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'evidence/onboarding-components'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def run():
 OUT.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/design-system/onboarding/'
 results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'])
   for w,h,touch in [(320,480,True),(390,844,True),(829,826,False),(1440,900,False),(844,390,True)]:
    ctx=browser.new_context(viewport={'width':w,'height':h},has_touch=touch,reduced_motion='reduce')
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url);page.locator('#open').click();d=page.locator('#onboarding-dialog');d.wait_for(state='visible')
    assert page.evaluate('document.activeElement.id')=='onboarding-title'
    assert d.get_attribute('aria-labelledby')=='onboarding-title' and d.get_attribute('aria-describedby')=='onboarding-description'
    assert d.locator('.ob-controls li').count()==3
    assert d.locator('.ob-controls').get_attribute('data-input-mode')==('touch' if touch else 'keyboard')
    box=d.bounding_box();assert box['width']<=560 and box['height']<=h-32 and box['x']>=15 and box['y']>=15,box
    assert d.evaluate('e=>getComputedStyle(e).borderTopLeftRadius')=='16px'
    assert page.locator('#onboarding-start').bounding_box()['height']>=48
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.id')=='onboarding-show-next'
    page.keyboard.press('Tab');assert page.evaluate('document.activeElement.classList.contains("ob-settings-toggle")')
    page.keyboard.press('Escape');d.wait_for(state='hidden');assert page.evaluate('document.activeElement.id')=='open'
    page.locator('#open').click();d.locator('.ob-settings-toggle').click()
    d.locator('[data-ob-setting=theme]').select_option('dark');assert d.get_attribute('data-ob-theme')=='dark'
    d.locator('[data-ob-setting=language]').select_option('zh-CN');assert d.get_attribute('lang')=='zh-CN'
    assert page.locator('#onboarding-start').inner_text()=='开始探索'
    for mode in ['keyboard','touch','gamepad']:
     d.locator('[data-ob-setting=input]').select_option(mode)
     assert d.locator('.ob-controls').get_attribute('data-input-mode')==mode
    d.locator('[data-ob-setting=theme]').select_option('system');page.emulate_media(color_scheme='light')
    page.wait_for_function('document.querySelector("#onboarding-dialog").dataset.obTheme==="light"')
    page.emulate_media(color_scheme='dark');page.wait_for_function('document.querySelector("#onboarding-dialog").dataset.obTheme==="dark"')
    d.locator('[data-ob-setting=language]').select_option('en');d.locator('[data-ob-setting=input]').select_option('auto')
    d.locator('.ob-settings-toggle').click()
    d.evaluate('e=>e.scrollTop=e.scrollHeight/2');assert d.locator('.ob-close').bounding_box()['y']>=0
    d.evaluate('e=>e.scrollTop=e.scrollHeight');assert d.locator('.ob-close').bounding_box()['y']>=0
    d.evaluate('e=>e.scrollTop=0');page.screenshot(path=str(OUT/f'welcome-{w}x{h}.png'))
    page.locator('#onboarding-show-next').uncheck()
    assert page.evaluate('onboardingSandbox.component.shouldAutoShow') is False
    page.locator('#onboarding-start').click();d.wait_for(state='hidden')
    page.locator('.ob-tip').wait_for(state='visible')
    page.wait_for_function('document.activeElement.id==="sandbox"')
    assert not page.evaluate('document.querySelector("#sandbox").inert')
    for action in ['move','look','inspect']:
     page.locator(f'[data-report="{action}"]').click()
    assert page.locator('.ob-tip h3').inner_text()=='You’re ready!'
    assert page.locator('.ob-tip [aria-current=step]').inner_text().endswith('You’re ready')
    page.get_by_role('button',name='Keep exploring',exact=True).click();assert not page.locator('.ob-tip').is_visible()
    # No component-owned frame loop, even during a tutorial.
    page.evaluate('() => {window.obFrames=0;window.obOriginalRAF=window.requestAnimationFrame;window.requestAnimationFrame=callback=>{obFrames++;return obOriginalRAF.call(window,callback)};}')
    page.locator('#open').click();page.locator('#onboarding-start').click();page.wait_for_timeout(100)
    assert page.evaluate('obFrames')==0
    page.evaluate('() => {window.requestAnimationFrame=window.obOriginalRAF;}')
    page.locator('.ob-tip [data-ob-action=next]').focus()
    page.keyboard.press('Enter');assert page.evaluate('document.activeElement.dataset.obAction')=='next'
    page.keyboard.press('Enter');assert page.evaluate('document.activeElement.dataset.obAction')=='next'
    page.locator('[data-ob-action=back]').click();page.locator('[data-ob-action=back]').click()
    page.wait_for_function('document.activeElement.dataset.obAction==="next"')
    # Standard gamepad navigation uses host-supplied snapshots, with no polling loop.
    page.locator('#open').click()
    page.evaluate('''() => {
      const ui=onboardingSandbox.component;
      const pad={axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
      const select=document.querySelector('[data-ob-setting=input]');select.focus();
      pad.buttons[15].pressed=true;ui.handleGamepad(pad);
      if(document.activeElement!==document.querySelector('[data-ob-setting=input]'))throw Error('Select lost gamepad focus');
      if(document.querySelector('[data-ob-setting=input]').value!=='keyboard')throw Error('Right did not cycle input mode');
      pad.buttons[15].pressed=false;ui.handleGamepad(pad);
      pad.buttons[13].pressed=true;ui.handleGamepad(pad);
      pad.buttons[13].pressed=false;ui.handleGamepad(pad);
      pad.buttons[1].pressed=true;ui.handleGamepad(pad);
    }''')
    d.wait_for(state='hidden')
    page.locator('.ob-tip [data-ob-action=help]').click();d.wait_for(state='visible')
    page.keyboard.press('Escape');d.wait_for(state='hidden')
    page.wait_for_function('document.activeElement.dataset.obAction==="help"')
    assert page.locator('#onboarding-show-next').is_checked() is False
    # Each app can mount the same component without importing a mall renderer.
    for profile in ['gallery','hotel','parking','showroom','other']:
     page.locator('#profile').select_option(profile);page.locator('#open').click();assert d.is_visible()
     page.keyboard.press('Escape');assert not d.is_visible()
    page.reload();page.locator('#open').click();page.locator('#onboarding-dialog').wait_for(state='visible')
    assert page.locator('#onboarding-show-next').is_checked() is False
    assert page.evaluate('onboardingSandbox.component.shouldAutoShow') is False
    page.keyboard.press('Escape')
    page.locator('#destroy').click();assert page.locator('.ob-ui').count()==0
    assert not errors,errors
    results.append({'viewport':[w,h],'touch':touch,'layout':'PASS','focusEscapeTab':'PASS','themeLocaleInput':'PASS','nonblockingProgress':'PASS','gamepadPanels':'PASS','fiveOtherProfiles':'PASS','noUIFrameLoop':'PASS','errors':errors})
    ctx.close()
   browser.close()
 finally:server.shutdown()
 (OUT/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
if __name__=='__main__':run()
