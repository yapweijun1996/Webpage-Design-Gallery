"""Check compact street controls across locales and browser engines."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json, os, sys
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[1])
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
s=ThreadingHTTPServer(('127.0.0.1',0),Quiet);Thread(target=s.serve_forever,daemon=True).start();url='http://127.0.0.1:%d/demos/corporate/gjh/mini-street/'%s.server_port
with sync_playwright() as p:
 for en in ['chromium','webkit']:
  b=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' if sys.platform == 'darwin' else '/usr/bin/google-chrome'),headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']) if en=='chromium' else p.webkit.launch(headless=True)
  for w,h,lang in [(320,568,'en'),(375,667,'en'),(390,844,'en'),(568,320,'en'),(320,568,'zh-Hans'),(568,320,'zh-Hans'),(320,568,'ms'),(568,320,'ms')]:
   c=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,reduced_motion='reduce');c.add_init_script("localStorage.setItem('wdg.language', %s)"%json.dumps(lang));page=c.new_page();page.goto(url,wait_until='domcontentloaded');page.wait_for_selector('.stage[data-webgl]',timeout=30000);page.wait_for_timeout(1000)
   data=page.evaluate('''()=>{const selectors=['[data-stop]','[data-camera]','[data-light]'];return {widths:[document.documentElement.scrollWidth,innerWidth],controls:selectors.flatMap(s=>[...document.querySelectorAll(s)].map(e=>{let r=e.getBoundingClientRect();return {name:e.dataset.stop||e.dataset.camera||e.dataset.light,rect:[r.x,r.y,r.width,r.height]}})),entry:(()=>{let r=document.querySelector('.scene-shop-entry').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()}}''')
   assert data['widths'][0]<=w, (en,w,lang,data)
   for e in data['controls']:
    x,y,rw,rh=e['rect'];assert x>=-1 and y>=-1 and x+rw<=w+1 and y+rh<=h+1 and rw>=43 and rh>=43,(en,w,h,lang,e)
   for e in data['controls'][:3]:
    x,y,rw,rh=e['rect'];a,bx,cw,ch=data['entry'];assert not(x<a+cw and x+rw>a and y<bx+ch and y+rh>bx),(en,w,lang,'entry overlap',e,data['entry'])
   print('PASS',en,w,h,lang,flush=True);c.close()
  b.close()
s.shutdown()
