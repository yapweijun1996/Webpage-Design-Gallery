import sys,os,json
sys.path.insert(0,'tests')
from browser_gjh_guide import *
s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':320,'height':480},has_touch=True);ready(page,f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/');guide(page)
 page.add_script_tag(path='../qa-tools/package/axe.min.js');r=page.evaluate('async()=>{const r=await axe.run(document.querySelector("#guide-dialog"));return {violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}))}}');print(json.dumps(r));assert not r['violations']
 # Deliberate 200% text-growth fixture, not a physical device or native browser-zoom claim.
 page.evaluate('''()=>{const els=[...document.querySelectorAll('#guide-dialog *')];const sizes=els.map(e=>parseFloat(getComputedStyle(e).fontSize));els.forEach((e,i)=>e.style.fontSize=(sizes[i]*2)+'px');}''')
 d=page.locator('#guide-dialog');assert d.evaluate('e=>e.scrollWidth<=e.clientWidth+1');page.locator('#guide-list').scroll_into_view_if_needed();assert page.locator('#guide-close').evaluate('e=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight}');page.screenshot(path='../evidence/v11-compact-guide/text-growth-320.png');r['textGrowth200Percent']='PASS';(ROOT.parent/'evidence/v11-compact-guide/axe-reflow.json').write_text(json.dumps(r,indent=2));b.close()
s.shutdown()
