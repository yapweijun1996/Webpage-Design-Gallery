import functools,http.server,json,os,sys,threading
from playwright.sync_api import sync_playwright
root=sys.argv[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def copyfile(self,src,dst):
  try:super().copyfile(src,dst)
  except (BrokenPipeError,ConnectionResetError):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=root));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
  c=b.new_context(viewport={'width':320,'height':740},has_touch=True,reduced_motion='reduce',service_workers='block');page=c.new_page();page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000)
  data=page.evaluate('''()=>{const a=performance.getEntriesByType('resource');return {requests:a.length,decoded:a.reduce((n,r)=>n+r.decodedBodySize,0)}}''')
  page.locator('#guide-start').click();page.wait_for_function('!document.querySelector("#guide-dialog").open')
  calls={}
  for zone in ['atrium','newmoon','mili','gogo']:
   page.evaluate('(z)=>{__mall.teleport(z);__mall.step(17)}',zone);calls[zone]=page.evaluate('__mall.state.drawCalls')
  print(json.dumps({'browser':b.version,'backend':'swiftshader','viewport':[320,740],'layout':'default','readyResources':data,'drawCalls':calls}),flush=True);c.close();b.close()
finally:server.shutdown();server.server_close()
