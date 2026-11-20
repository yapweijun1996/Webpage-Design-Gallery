import os,time,json
from playwright.sync_api import sync_playwright
U='http://localhost:8874/demos/corporate/gjh/v11/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],headless=False,args=['--use-angle=metal'])
    ctx=b.new_context(viewport={'width':393,'height':700},device_scale_factor=2,has_touch=True,is_mobile=True,service_workers='block'); ctx.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed');")
    pg=ctx.new_page(); reqs=[]
    pg.on('response',lambda r: reqs.append((r.url,int(r.headers.get('content-length') or 0))))
    pg.goto(U,wait_until='domcontentloaded'); pg.locator('#arrival-walk').tap()
    pg.wait_for_function("!document.querySelector('#loader-enter-now')?.hidden",timeout=120000)
    n=len(reqs); tot=sum(s for _,s in reqs); print('requests before enter-now',n,'bytes',tot)
    from collections import defaultdict
    d=defaultdict(int)
    for u,s in reqs:
        k=u.split('/v11/')[-1].split('?')[0]; k='glb' if k.endswith('.glb') else ('webp/png/jpg' if k.split('.')[-1] in('webp','png','jpg') else k.split('.')[-1])
        d[k]+=s
    print(sorted(d.items(),key=lambda x:-x[1])[:8])
    big=sorted(reqs,key=lambda x:-x[1])[:10]
    for u,s in big: print(s//1024,'KB',u.split('/v11/')[-1][:80])
    print('gate text',pg.evaluate("document.querySelector('#app-loader')?.innerText?.replace(/\\s+/g,' ').slice(0,200)"))
    b.close()
