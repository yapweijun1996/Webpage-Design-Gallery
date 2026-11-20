import os,time,json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],headless=False,args=['--use-angle=metal'])
    ctx=b.new_context(viewport={'width':393,'height':700},device_scale_factor=2,has_touch=True,is_mobile=True,service_workers='block'); ctx.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed');")
    pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg); cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':400,'downloadThroughput':1600*1024/8,'uploadThroughput':400*1024/8})
    t0=time.time(); rec={}
    def req(e): rec[e['requestId']]={'url':e['request']['url'].split('/v11/')[-1][:70],'t0':round(time.time()-t0,1)}
    def fin(e):
        r=rec.get(e['requestId']); 
        if r: r['kb']=round(e['encodedDataLength']/1024); r['t1']=round(time.time()-t0,1)
    cdp.on('Network.requestWillBeSent',req); cdp.on('Network.loadingFinished',fin)
    pg.goto('http://localhost:8903/demos/corporate/gjh/v11/',wait_until='domcontentloaded'); pg.locator('#arrival-walk').tap()
    pg.wait_for_function("!document.querySelector('#loader-enter-now')?.hidden || (window.__mall?.ready && document.querySelector('#app-loader').hidden)",timeout=900000)
    te=round(time.time()-t0,1); rows=[r for r in rec.values() if 'kb' in r]
    print('enter now at',te,'s; total KB',sum(r['kb'] for r in rows),'requests',len(rows))
    for r in sorted(rows,key=lambda r:-r['kb'])[:22]: print(r['kb'],'KB',r['t0'],'->',r['t1'],r['url'])
    b.close()
