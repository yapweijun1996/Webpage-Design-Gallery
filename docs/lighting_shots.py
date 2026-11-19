import os,sys
from playwright.sync_api import sync_playwright
port=sys.argv[1]; tag=sys.argv[2]
POSES=[('atrium',0),('newmoon',0),('mili',0),('gogo',0),('planned-space-14',0)]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],headless=False,args=['--use-angle=metal'])
    for tier,(w,h) in {'balanced':(1440,900),'low':(393,700)}.items():
        ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if w<500 else 1,service_workers='block')
        ctx.add_init_script(f"localStorage.setItem('gjh-v11-tutorial-v1','dismissed');localStorage.setItem('gjh-v11-graphics-quality-v1','{tier}');")
        pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.goto(f'http://localhost:{port}/demos/corporate/gjh/v11/',wait_until='domcontentloaded'); pg.locator('#arrival-walk').click()
        pg.wait_for_function("window.__mall?.ready && window.__sceneReady && document.querySelector('#app-loader').hidden",timeout=240000)
        for z,_ in POSES:
            pg.evaluate("z=>__mall.teleport(z)",z); pg.wait_for_timeout(1800)
            pg.screenshot(path=f'light_{tag}_{tier}_{z}.png')
        print(tier,errs[:2],pg.evaluate("(()=>{const r=__mall.performanceReport();return {tier:r.tier,programs:r.programs??null}})()")); ctx.close()
    b.close()
