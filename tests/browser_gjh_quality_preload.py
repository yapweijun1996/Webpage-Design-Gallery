"""Auto quality ignores startup/model loading stalls and resumes afterward.

Set GALLERY_CHROME and optionally GALLERY_TEST_ROOT and GALLERY_WEBGL_BACKEND.
This injects main-thread stalls; it does not certify frame rate on devices.
"""
import functools
import http.server
import os
import threading
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(os.environ.get('GALLERY_TEST_ROOT', Path(__file__).resolve().parents[1])).resolve()
released = threading.Event()

class Server(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        if '/gallery-assets/' in urlparse(self.path).path:
            released.wait(45)
        try:
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass


def quality(page):
    return page.evaluate('''() => ({
        tier:__mall.state.graphics.quality.tier, preference:__mall.state.graphics.quality.preference,
        focus:document.hasFocus(), mode:__mall.mode, loaderHidden:document.getElementById('app-loader').hidden,
        settled:__mall.state.modelPreload.settled, total:__mall.state.modelPreload.total,
        monitor:__mall.performanceReport().samples
    })''')


def stall(page):
    page.evaluate('''async () => {
      const stop=performance.now()+9000;
      const timer=setInterval(() => {const end=performance.now()+34; while(performance.now()<end){}
        if(performance.now()>=stop)clearInterval(timer);},40);
      await new Promise(resolve=>setTimeout(resolve,9500));
    }''')


def main():
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Server, directory=str(ROOT))) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                backend=os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader')
                browser=playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                    args=['--use-angle='+backend,'--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
                try:
                    context=browser.new_context(viewport={'width':1280,'height':800}, reduced_motion='reduce', service_workers='block')
                    page=context.new_page()
                    page.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed'); localStorage.setItem('gjh-v11-graphics-quality-v1','auto')")
                    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/',wait_until='domcontentloaded')
                    page.locator('#loader-enter-now').wait_for(state='visible',timeout=90000)
                    page.bring_to_front()
                    before=quality(page)
                    assert before['focus'] and before['mode']=='explore' and before['tier']=='balanced', before
                    assert not before['loaderHidden'] and before['settled']<before['total'], before
                    stall(page)
                    overlay=quality(page)
                    assert overlay['tier']=='balanced' and not overlay['loaderHidden'] and overlay['settled']<overlay['total'], overlay
                    page.locator('#loader-enter-now').click(force=True)
                    page.wait_for_function("document.getElementById('app-loader').hidden")
                    page.locator('#scene').focus()
                    early=quality(page)
                    assert early['focus'] and early['mode']=='explore' and early['settled']<early['total'], early
                    stall(page)
                    during=quality(page)
                    assert during['tier']=='balanced' and during['settled']<during['total'], during
                    released.set()
                    page.wait_for_function('''() => {const p=__mall.state.modelPreload;
                      const f=Object.values(__mall.state.furnishings);
                      return p.settled===p.total && Object.values(p.models).every(v=>v==='loaded'||v==='fallback') &&
                        Object.values(p.sceneModels).every(v=>v==='loaded'||v==='fallback') &&
                        f.every(v=>v.status==='loaded'||v.status==='fallback') &&
                        (__mall.state.character.lod.available||__mall.state.character.lod.failed);
                    }''', timeout=90000)
                    page.wait_for_timeout(1500)
                    page.locator('#scene').focus()
                    assert quality(page)['focus'] and quality(page)['mode']=='explore', quality(page)
                    stall(page)
                    after=quality(page)
                    assert after['tier']=='low' and after['preference']=='auto' and after['monitor']>0, after
                    print({'before':before,'overlay':overlay,'early':early,'during':during,'after':after},flush=True)
                finally:
                    browser.close()
        finally:
            released.set()
            server.shutdown()

if __name__=='__main__':
    main()
