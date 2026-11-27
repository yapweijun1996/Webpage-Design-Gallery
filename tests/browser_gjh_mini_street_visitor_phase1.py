"""Exercise candidate framing and controls on short and portrait touch screens."""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *args): pass

def instrument(route):
    response = route.fetch(); source = response.text()
    marker = '          world.add(model);'
    probe = '''
          window.__visitorRect = () => {
            model.updateWorldMatrix(true, true); camera.updateMatrixWorld();
            const rect = canvas.getBoundingClientRect(); let l=Infinity, r=-Infinity, t=Infinity, b=-Infinity;
            const v = new THREE.Vector3();
            model.traverse(o => { if (!o.isMesh) return; const p=o.geometry.getAttribute("position");
              for (let i=0; i<p.count; i++) { v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(camera);
                const x=rect.left+(v.x+1)*rect.width/2, y=rect.top+(1-v.y)*rect.height/2;
                l=Math.min(l,x); r=Math.max(r,x); t=Math.min(t,y); b=Math.max(b,y);
              }
            }); return {left:l,right:r,top:t,bottom:b};
          };'''
    camera = 'getCameraState: () => ({ ...view }),'
    assert source.count(marker) == source.count(camera) == 1
    source = source.replace(marker, marker + probe).replace(camera, 'getCameraState: window.__cameraState = () => ({ ...view }),')
    route.fulfill(response=response, body=source)

def run():
    with ThreadingHTTPServer(('127.0.0.1', 0), Handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/mini-street/?visitorCandidate=1'
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' if sys.platform=='darwin' else '/usr/bin/google-chrome'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            for width,height in [(568,320),(844,390),(320,568),(375,667),(390,844)]:
                context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,reduced_motion='reduce',service_workers='block')
                page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.route('**/mini-street/scene.js',instrument)
                page.goto(url,wait_until='domcontentloaded');page.locator('#view[data-visitor-candidate="ready"]').wait_for(timeout=90000)
                before=page.evaluate('scrollY');page.get_by_role('button',name='View visitor close-up').tap();page.wait_for_timeout(350)
                data=page.evaluate('''() => {const b=e=>{let r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {scroll:scrollY,view:b(document.querySelector('#view')),model:window.__visitorRect(),overflow:document.documentElement.scrollWidth-innerWidth,controls:[...document.querySelectorAll('#toolbar [data-camera], #toolbar [data-light]')].map(e=>({name:e.getAttribute('aria-label'),rect:b(e)})),stops:[...document.querySelectorAll('.stage .stop')].filter(e=>getComputedStyle(e).display!=='none' && getComputedStyle(e.closest('.stops')).clipPath==='none').map(b)}}''')
                assert abs(data['scroll']-before)<1,(width,height,'unexpected scroll',data)
                assert data['overflow']==0,(width,height,'overflow',data)
                model=data['model'];view=data['view']
                assert model['left']>=view['left']-1 and model['right']<=view['right']+1 and model['top']>=view['top']-1 and model['bottom']<=view['bottom']+1,(width,height,'model clipped',data)
                assert view['top']>=0 and view['bottom']<=height,(width,height,'stage outside viewport',data)
                for control in data['controls']:
                    r=control['rect'];assert r['width']>=44 and r['height']>=44 and r['left']>=-1 and r['right']<=width+1 and r['top']>=0 and r['bottom']<=height,(width,height,'control',control)
                for r in data['stops']:
                    assert not (model['left']<r['right'] and model['right']>r['left'] and model['top']<r['bottom'] and model['bottom']>r['top']),(width,height,'stop covers visitor',model,r)
                if (width,height) in [(568,320),(844,390)]:
                    link=page.locator('.stops [data-stop="vending"]');link.focus()
                    assert page.evaluate('document.activeElement === document.querySelector(".stops [data-stop=vending]")')
                    assert page.locator('.stops').evaluate("e => getComputedStyle(e).clipPath")=='none', 'focused destination not revealed'
                    page.locator('#view').focus();assert page.locator('.stops').evaluate("e => getComputedStyle(e).clipPath")!='none', 'unfocused destination not visually hidden'
                page.get_by_role('button',name='Day',exact=True).tap();assert page.get_by_role('button',name='Day',exact=True).get_attribute('aria-pressed')=='true'
                page.get_by_role('button',name='Night',exact=True).tap();assert page.get_by_role('button',name='Night',exact=True).get_attribute('aria-pressed')=='true'
                zin=page.get_by_role('button',name='Zoom in',exact=True);zout=page.get_by_role('button',name='Zoom out',exact=True)
                zin.tap();assert page.evaluate('window.__cameraState().zoom > 1')
                if (width,height)==(844,390):
                    for _ in range(30):
                        if zin.get_attribute('aria-disabled')=='true': break
                        zin.tap()
                    assert zin.get_attribute('aria-disabled')=='true', 'maximum zoom not reached'
                    maximum=page.evaluate('window.__cameraState().zoom');r=zin.bounding_box();page.touchscreen.tap(r['x']+r['width']/2,r['y']+r['height']/2);assert page.evaluate('window.__cameraState().zoom')==maximum
                    for _ in range(30):
                        if zout.get_attribute('aria-disabled')=='true': break
                        zout.tap()
                    assert zout.get_attribute('aria-disabled')=='true', 'minimum zoom not reached'
                    minimum=page.evaluate('window.__cameraState().zoom');r=zout.bounding_box();page.touchscreen.tap(r['x']+r['width']/2,r['y']+r['height']/2);assert page.evaluate('window.__cameraState().zoom')==minimum
                    assert abs(page.evaluate('scrollY')-before)<1, 'zoom scrolled page'
                page.get_by_role('button',name='Reset view').tap();assert page.evaluate('window.__cameraState().stop === null && window.__cameraState().zoom === 1')
                assert not errors,(width,height,errors)
                print('PASS',width,height,'model',model,'stage',view,flush=True);context.close()
            browser.close()
if __name__=='__main__': run()
