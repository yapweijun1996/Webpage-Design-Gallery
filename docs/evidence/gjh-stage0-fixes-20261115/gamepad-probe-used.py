import sys,os,functools,http.server,threading,json
sys.path.insert(0,'/tmp/gjh-stage0-fixes-2SN9ZAyE/repo/tests')
from browser_gjh_guide import *
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=metal','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce');page.add_init_script("window.padState={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.padState]});");ready(page,f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');page.locator('#guide-start').click();closed(page);page.locator('[data-ob-action=skip]').click();page.locator('#scene').focus()
 for clear in [False,True]:
  page.evaluate('padState.axes[2]=.8');page.wait_for_timeout(300)
  result=page.evaluate('''async clear=>{padState.axes[2]=0;if(clear){await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)}__mall.teleport('mili');let rows=[];for(const [input,ms] of [[{},400],[{forward:1},1500],[{right:-1},450],[{forward:1},2300],[{right:1},500]]){__mall.setInput(input);__mall.step(ms);const s=__mall.state;rows.push({x:s.x,z:s.z,yaw:s.yaw,nearby:s.nearby});}__mall.setInput(null);return rows}''',clear)
  print(json.dumps({'hostFramesBeforeFixture':clear,'steps':result}),flush=True)
 b.close()
s.shutdown()
