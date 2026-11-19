import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'])
    for n,(w,h) in {'d':(1440,900),'m':(393,852),'s':(360,640)}.items():
        pg=b.new_page(viewport={'width':w,'height':h}); pg.goto('http://localhost:8811/demos/corporate/gjh/v23/'); pg.wait_for_timeout(1500)
        print(n,pg.evaluate("document.documentElement.scrollWidth<=innerWidth"))
        pg.screenshot(path=f'../v23_{n}.png'); pg.close()
    b.close()
