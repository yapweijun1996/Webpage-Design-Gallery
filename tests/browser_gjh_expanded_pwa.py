"""Expanded query preserves the scoped PWA fallback and tab bag on reconnect."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_expanded_shell import Quiet

ROOT=Path(__file__).resolve().parents[1]

def run():
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?layout=expanded'
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[
          '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),'--enable-unsafe-swiftshader'])
        context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
        context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
        page=context.new_page();page.goto(url);page.wait_for_function('window.__sceneReady',timeout=90000)
        page.wait_for_function("navigator.serviceWorker.controller?.scriptURL.endsWith('/v11/pwa-sw.js')",timeout=30000)
        page.locator('#view-toggle').click();page.locator('[data-add]').first.click()
        assert '1' in page.locator('#bag-open').inner_text()
        context.set_offline(True);page.reload(wait_until='domcontentloaded')
        assert 'connect' in page.locator('body').inner_text().lower()
        assert 'layout=expanded' in page.url
        context.set_offline(False);page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.__sceneReady',timeout=90000)
        assert page.evaluate('document.body.classList.contains("is-expanded")')
        assert '1' in page.locator('#bag-open').inner_text()
        print('PASS expanded query: scoped offline reconnect and preserved tab bag',flush=True)
        context.close();browser.close()
    finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
