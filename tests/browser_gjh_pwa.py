"""V11 standalone install, scoped offline fallback, and safe verified updates in Chrome."""
import functools
import http.server
import json
import os
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_pwa import Handler, alternate_release, gallery


def run():
    with tempfile.TemporaryDirectory(prefix='gjh-v11-pwa-') as temporary:
        root = Path(temporary)
        a = root / 'a/Webpage-Design-Gallery'
        b = root / 'b/Webpage-Design-Gallery'
        gallery.build(a)
        release_a = json.loads((a / 'version.json').read_text())
        release_b = {'version': '99.0.1', 'build': 'b' * 16}
        alternate_release(a, b, gallery.load_catalog(), release_b)
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(root / 'a')))
        server.release_directory = root / 'a'
        server.mixed_files = {}
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/'
        url = base + 'demos/corporate/gjh/v11/'
        try:
            with sync_playwright() as p:
                context = p.chromium.launch_persistent_context(user_data_dir=str(root / 'profile'), executable_path=os.environ['GALLERY_CHROME'], viewport={'width': 390, 'height': 844}, reduced_motion='reduce', headless=True, args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'), '--enable-unsafe-swiftshader'])
                context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1', 'dismissed')")
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                # Install the parent first; the more specific mall registration must coexist.
                page.goto(base, wait_until='domcontentloaded')
                page.wait_for_function("() => navigator.serviceWorker.ready.then(r => r.active?.state === 'activated')")
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("() => navigator.serviceWorker.getRegistration('./').then(r => r?.scope.endsWith('/demos/corporate/gjh/v11/') && r.active?.state === 'activated')", timeout=60000)
                page.wait_for_function("() => navigator.serviceWorker.controller?.scriptURL.endsWith('/demos/corporate/gjh/v11/pwa-sw.js')", timeout=30000)
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function("() => navigator.serviceWorker.controller?.scriptURL.endsWith('/demos/corporate/gjh/v11/pwa-sw.js')", timeout=30000)
                page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                assert page.locator('#mall-update-notice').is_hidden(), 'Fresh installation must not announce a nonexistent update'
                assert page.evaluate('window.__sceneReady === true')
                if page.locator('#experience').is_visible(): page.locator('#view-toggle').click()
                settings = page.locator('.mall-app-settings')
                settings.locator('summary').click()
                language = settings.locator('[data-mall-language]')
                language.select_option('zh-Hans')
                assert page.locator('#directory-enter-3d').inner_text().strip() == '进入 3D 商场'
                assert page.evaluate("localStorage.getItem('wdg.language')") == 'zh-Hans'
                page.wait_for_function("v => document.querySelector('#mall-check-update bdi').textContent === 'v' + v", arg=release_a['version'])
                language.select_option('ms')
                assert 'Masuk' in page.locator('#directory-enter-3d').inner_text()
                language.select_option('en')
                assert 'Enter 3D Mall' in page.locator('#directory-enter-3d').inner_text()
                settings.locator('summary').click()
                manifest = context.new_cdp_session(page).send('Page.getAppManifest')
                assert not manifest.get('errors'), manifest
                parsed = json.loads(manifest['data'])
                assert parsed['id'] == './' and parsed['scope'] == './' and parsed['start_url'] == './index.html'
                assert {i['sizes'] for i in parsed['icons']} == {'192x192', '512x512'}
                installability = context.new_cdp_session(page).send('Page.getInstallabilityErrors')
                assert not installability.get('installabilityErrors'), installability
                page.locator('.product-card [data-add]').first.click()
                saved = page.evaluate("sessionStorage.getItem('gjh-v11-demo-bag-v1')")
                assert saved and '1' in saved
                # True network failure, offline navigation, then recovery without losing the same-tab bag.
                context.set_offline(True)
                assert page.evaluate("fetch('pwa.js?offline-test=1').then(() => false).catch(() => true)")
                assert page.locator('#mall-connection-notice').is_visible()
                assert page.evaluate("fetch('manifest.webmanifest').then(r => r.ok)")
                for resource in ('style.bundle.css', 'assets/loader.js', 'assets/gjh-loader-mark.svg'):
                    assert page.evaluate("(name) => fetch(name).then(r => r.ok)", resource), resource
                page.reload(wait_until='domcontentloaded')
                assert page.get_by_role('heading', name='Let’s reconnect.').is_visible()
                assert page.evaluate("sessionStorage.getItem('gjh-v11-demo-bag-v1')") == saved
                context.set_offline(False)
                page.locator('a', has_text='Try again').click()
                page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                assert page.locator('#bag-open').inner_text() == 'Bag (1)'
                if page.locator('#experience').is_visible(): page.locator('#view-toggle').click()
                other = context.new_page()
                other.goto(url, wait_until='domcontentloaded')
                other.wait_for_function("() => navigator.serviceWorker.controller?.scriptURL.endsWith('/pwa-sw.js')")
                other.wait_for_function("() => !document.querySelector('#mall-check-update').hidden")
                other_navigations = []
                other.on('framenavigated', lambda frame: other_navigations.append(frame.url) if frame == other.main_frame else None)
                # Reject a mismatched version and a tampered offline file, retaining active A.
                server.release_directory = root / 'b'
                def rejected_update():
                    return page.evaluate("""async () => {
                        const registration = await navigator.serviceWorker.getRegistration('./');
                        let candidate;
                        registration.addEventListener('updatefound', () => { candidate = registration.installing; }, {once:true});
                        await registration.update();
                        candidate ||= registration.installing;
                        if (!candidate) throw new Error('Expected an update candidate');
                        if (candidate.state !== 'redundant') await new Promise((resolve, reject) => {
                            const timer = setTimeout(() => reject(new Error('Candidate did not fail')), 10000);
                            candidate.addEventListener('statechange', () => {
                                if (candidate.state === 'redundant') { clearTimeout(timer); resolve(); }
                            });
                        });
                        return candidate.state;
                    }""")
                server.mixed_files = {'version.json': json.dumps(release_a).encode()}
                assert rejected_update() == 'redundant'
                assert page.evaluate("() => navigator.serviceWorker.getRegistration('./').then(r => !r.waiting)")
                server.mixed_files = {'demos/corporate/gjh/v11/offline.html': b'<html>tampered</html>'}
                assert rejected_update() == 'redundant'
                assert page.evaluate("() => navigator.serviceWorker.getRegistration('./').then(r => !r.waiting)")
                keys = page.evaluate('caches.keys()')
                assert any(release_a['build'] in k and k.startswith('gjh-v11:') for k in keys), keys
                assert not any(release_b['build'] in k and k.startswith('gjh-v11:') for k in keys), keys
                # Valid B waits for consent; updating reloads once and retains this tab's bag.
                server.mixed_files = {}
                page.locator('.mall-app-settings summary').click()
                page.locator('#mall-check-update').click()
                page.wait_for_function("() => !document.querySelector('#mall-update-notice').hidden", timeout=30000)
                context.set_offline(True)
                page.wait_for_function("() => document.querySelector('#mall-apply-update').disabled")
                context.set_offline(False)
                page.wait_for_function("() => !document.querySelector('#mall-apply-update').disabled", timeout=30000)
                page.wait_for_function("v => document.querySelector('#mall-apply-update bdi')?.textContent === 'v' + v", arg=release_b['version'])
                before = page.evaluate("() => navigator.serviceWorker.controller.scriptURL")
                assert before.endswith('/pwa-sw.js')
                navigations = []
                page.on('framenavigated', lambda frame: navigations.append(frame.url) if frame == page.main_frame else None)
                with page.expect_navigation(wait_until='domcontentloaded', timeout=30000):
                    page.locator('#mall-apply-update').click()
                page.wait_for_function("() => navigator.serviceWorker.getRegistration('./').then(r => new Promise(resolve => { const c = new MessageChannel(); c.port1.onmessage = e => resolve(e.data.build === 'bbbbbbbbbbbbbbbb'); r.active.postMessage({type:'GET_VERSION'}, [c.port2]); }))", timeout=30000)
                page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                assert len(navigations) == 1, navigations
                assert page.evaluate("sessionStorage.getItem('gjh-v11-demo-bag-v1')") == saved
                assert page.locator('#bag-open').inner_text() == 'Bag (1)'
                other.wait_for_function("() => !document.querySelector('#mall-update-notice').hidden")
                assert 'another tab' in other.locator('#mall-update-message').inner_text()
                assert not other_navigations, other_navigations
                assert not errors, errors
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                context.close()
                print('PASS: scoped installation, parent coexistence, manifest, offline fallback, bag retention, identity/hash rejection, explicit update and one reload')
        finally:
            server.shutdown()


if __name__ == '__main__':
    run()
