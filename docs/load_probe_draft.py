import os,sys,time,json
from playwright.sync_api import sync_playwright
U='http://localhost:8874/demos/corporate/gjh/v11/'
def go(name,net=None,viewport=(393,700)):
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],headless=False,args=['--use-angle=metal'])
        ctx=b.new_context(viewport={'width':viewport[0],'height':viewport[1]},device_scale_factor=2,has_touch=True,is_mobile=True,service_workers='block'); ctx.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed');")
        pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg)
        if net: cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':net[0],'downloadThroughput':net[1]*1024/8,'uploadThroughput':net[1]*1024/8/4})
        t0=time.time(); pg.goto(U,wait_until='domcontentloaded'); pg.locator('#arrival-walk').tap()
        pg.wait_for_function("window.__mallFailure || !document.querySelector('#loader-enter-now')?.hidden || (window.__mall?.ready && document.querySelector('#app-loader').hidden)",timeout=900000)
        failure = pg.evaluate("window.__mallFailure")
        if failure:
            print(json.dumps({'case': name, 'failure': failure}), flush=True)
            b.close()
            return
        tenter=round(time.time()-t0,1)
        res={'case':name,'enterNowAvailableS':tenter}
        try:
            pg.locator('#loader-enter-now').tap(timeout=3000); pg.wait_for_function("window.__mallFailure || document.querySelector('#app-loader').hidden",timeout=300000)
            failure = pg.evaluate("window.__mallFailure")
            if failure:
                res['failure'] = failure
            else:
                res['playableAfterEnterNowS']=round(time.time()-t0,1)
        except Exception as e: res['enterNow']='n/a'
        b.close(); print(json.dumps(res),flush=True)
go('unthrottled'); go('slow_3g_400ms_1.6Mbps',net=(400,1600))
