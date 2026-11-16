"""Real-browser single Help/Map ownership, shortcuts, focus and retained controls."""
import argparse
import functools
import hashlib
import http.server
import json
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_gjh_guide import Quiet

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(320, 740), (390, 844), (639, 826), (650, 844), (651, 844), (667, 375), (1440, 900)]


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path, default=Path('/tmp/gallery-v11-hud-ownership'))
    parser.add_argument('--url')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(args.root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    rows = []
    runtime = ['assets/onboarding/onboarding.js', 'assets/onboarding/onboarding.css', 'demos/corporate/gjh/v11/index.html', 'demos/corporate/gjh/v11/style.css', 'demos/corporate/gjh/v11/assets/ui.js']
    diagnostic_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    hashes = {name: hashlib.sha256((args.root / name).read_bytes()).hexdigest() for name in runtime}
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=[
                '--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            cases = [(w, h, '', 'reduce') for w, h in SIZES] + [(390, 844, '?interior=pilot', 'reduce'), (390, 844, '?visitor=v1', 'reduce'), (390, 844, '', 'no-preference')]
            for index, (width, height, query, motion) in enumerate(cases):
                context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=width < 1000, reduced_motion=motion, service_workers='block')
                context.add_init_script("""window.hudPad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>hudPad?[hudPad]:[]});""")
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                page.goto(url + query, wait_until='domcontentloaded')
                page.wait_for_function('window.__mall?.ready&&window.__sceneReady', timeout=90000)
                page.locator('#guide-dialog').wait_for(state='visible')
                page.locator('#guide-start').click()
                page.locator('.ob-tip').wait_for(state='visible')
                compact = width <= 650 or (height <= 560 and width > height)
                expected = 'menu' if compact else 'explore'
                stem = f'{index}-{width}x{height}'
                frames = []

                def shot(label):
                    name = f'{stem}-{label}.png'
                    page.screenshot(path=str(args.output / name))
                    frames.append(name)

                def help_open():
                    page.wait_for_function('document.querySelector("#keyboard-help").open')
                    page.wait_for_function('m=>__mall.mode===m', arg=expected)
                    assert page.locator('#guide-dialog').is_hidden()
                    assert page.locator('#keyboard-help>summary').inner_text() == 'Help'
                    assert page.locator('.ob-tip').is_hidden()
                    assert page.evaluate('__mall.state.paused') == compact

                # The contextual tutorial's Help action uses the same Help owner.
                page.locator('.ob-tip [data-ob-action=help]').click()
                help_open()
                assert page.locator('#keyboard-help>summary').evaluate('e=>e===document.activeElement')
                assert page.locator('#graphics-quality').count() == 1
                assert page.locator('.visitor-v2-controls select').count() == (0 if query == '?visitor=v1' else 7)
                assert 'second finger' in page.locator('#controls-copy').inner_text()
                bounds = []
                for fraction in [0, .5, 1]:
                    page.locator('#controls-copy').evaluate('(e,f)=>e.scrollTop=(e.scrollHeight-e.clientHeight)*f', fraction)
                    summary = page.locator('#keyboard-help>summary').bounding_box()
                    assert summary['y'] >= 0 and summary['y'] + summary['height'] <= height
                    assert summary['height'] >= 44 and summary['width'] >= 44
                    bounds.append(summary)
                    shot('help-' + str(fraction))
                assert bounds[0] == bounds[1] == bounds[2]
                page.locator('#graphics-quality').select_option('low')
                assert page.locator('#graphics-quality').input_value() == 'low'
                # Nested quick guide retains its settings and control-mode switcher.
                page.locator('#guide-reopen').click()
                page.locator('#guide-dialog').wait_for(state='visible')
                assert not page.locator('#keyboard-help').evaluate('e=>e.open')
                for mode in ['keyboard', 'touch', 'gamepad']:
                    page.locator('#guide-dialog [data-ob-setting=input]').select_option(mode)
                    assert page.locator('#guide-dialog .ob-controls').get_attribute('data-input-mode') == mode
                page.locator('#guide-dialog [data-ob-setting=language]').select_option('zh-CN')
                assert page.locator('#guide-dialog').get_attribute('lang') == 'zh-CN'
                page.locator('#guide-dialog [data-ob-setting=language]').select_option('en')
                page.locator('#guide-dialog .ob-settings-toggle').click()
                page.locator('#guide-dialog [data-ob-setting=theme]').select_option('dark')
                assert page.locator('#guide-dialog').get_attribute('data-ob-theme') == 'dark'
                page.locator('#guide-dialog [data-ob-setting=theme]').select_option('system')
                page.keyboard.press('Escape')
                help_open()
                page.wait_for_function('document.activeElement.id==="guide-reopen"')
                page.locator('#keyboard-help>summary').click()
                page.locator('.ob-tip').wait_for(state='visible')
                page.locator('.ob-tip [data-ob-action=skip]').click()
                assert page.locator('.ob-help').count() == 0
                assert page.locator('.ob-hud').is_hidden()
                assert page.locator('#mall-map>summary').is_hidden()
                assert page.locator('#header-map').is_visible() == compact
                header_controls = page.locator('.site-header a,.site-header button').evaluate_all('''els=>els.filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,text:e.textContent.trim(),rect:r.toJSON(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})''')
                for control in header_controls:
                    rect = control['rect']
                    assert rect['left'] >= 0 and rect['right'] <= width and rect['top'] >= 0 and rect['bottom'] <= height, control
                    assert rect['width'] >= 44 and rect['height'] >= 44 and control['hit'], control
                assert page.locator('#view-toggle').inner_text() == ('Stores' if compact else 'Store directory')
                assert page.locator('#view-toggle').get_attribute('aria-label') == 'Switch to the accessible store directory'
                shot('idle')
                # Keyboard and synthetic standard-controller Menu share that owner.
                page.locator('#scene').focus()
                page.keyboard.press('h')
                help_open()
                page.locator('#keyboard-help>summary').click()
                page.locator('#scene').focus()
                page.evaluate('hudPad={connected:true,mapping:"standard",axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};hudPad.buttons[9].pressed=true')
                help_open()
                page.evaluate('hudPad.buttons[9].pressed=false')
                page.wait_for_timeout(50)
                page.evaluate('hudPad.buttons[1].pressed=true')
                page.wait_for_function('!document.querySelector("#keyboard-help").open')
                page.wait_for_function('document.activeElement.matches("#keyboard-help>summary")')
                page.evaluate('hudPad.buttons[1].pressed=false;hudPad=null')
                if compact:
                    page.locator('#header-map').click()
                    page.wait_for_function('__mall.mode==="menu"&&document.querySelector("#mall-map").open')
                    assert page.locator('#header-map').get_attribute('aria-expanded') == 'true'
                    assert page.locator('#map-close').is_visible()
                    box = page.locator('#map-close').bounding_box()
                    assert box['width'] >= 44 and box['height'] >= 44
                    shot('map')
                    page.keyboard.press('Escape')
                    page.wait_for_function('document.activeElement.id==="header-map"&&!document.querySelector("#mall-map").open')
                    page.locator('#header-map').click()
                    page.locator('#map-close').click()
                    page.wait_for_function('document.activeElement.id==="header-map"&&!document.querySelector("#mall-map").open')
                    for zone, x in [('newmoon', -10), ('mili', 0), ('gogo', 10)]:
                        page.locator('#header-map').click()
                        page.locator('[data-teleport=' + zone + ']').click()
                        page.wait_for_function('x=>Math.abs(__mall.state.x-x)<.01', arg=x)
                        page.wait_for_function('__mall.mode==="explore"')
                    page.locator('#keyboard-help>summary').click()
                    page.locator('#header-map').click()
                    assert not page.locator('#keyboard-help').evaluate('e=>e.open')
                    page.locator('#map-close').click()
                else:
                    # A quick-guide visit intentionally closes the wide map.
                    # Reopen it through the real guide Map action, then verify
                    # its retained nonblocking desktop policy and destinations.
                    page.locator('#keyboard-help>summary').click()
                    page.locator('#guide-reopen').click()
                    page.locator('#guide-map').click()
                    page.wait_for_function('!document.querySelector("#guide-dialog").open&&document.querySelector("#mall-map").open')
                    page.wait_for_function('__mall.mode==="explore"&&!__mall.state.paused')
                    assert page.locator('#map-close').is_hidden()
                    for zone, x in [('newmoon', -10), ('mili', 0), ('gogo', 10)]:
                        page.locator('[data-teleport=' + zone + ']').click()
                        page.wait_for_function('x=>Math.abs(__mall.state.x-x)<.01', arg=x)
                        assert page.locator('#mall-map').evaluate('e=>e.open')
                    shot('wide-map')
                # A stale hidden/background trigger cannot open a second owner.
                page.locator('#bag-open').click()
                page.locator('#bag-dialog').wait_for(state='visible')
                old_map = page.locator('#mall-map').evaluate('e=>e.open')
                page.evaluate('document.querySelector("#header-map").click();document.querySelector("#guide-reopen").click();document.querySelector("#keyboard-help>summary").click()')
                assert page.locator('#mall-map').evaluate('e=>e.open') == old_map
                assert page.locator('#guide-dialog').is_hidden()
                assert not page.locator('#keyboard-help').evaluate('e=>e.open')
                assert page.locator('#bag-dialog').is_visible()
                page.locator('#bag-close').click()
                page.wait_for_function('__mall.mode==="explore"')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert page.evaluate('__mall.state.illegalCount') == 0
                assert not errors, errors
                rows.append({'viewport': [width, height], 'query': query, 'motion': motion, 'compact': compact, 'helpSummaryBounds': bounds, 'headerControls': header_controls, 'frames': frames, 'tutorialHelpKeyboardGamepadOneOwner': 'PASS', 'quickGuideSettingsAndReturnFocus': 'PASS', 'mapCloseEscapeDestinations': 'PASS' if compact else 'wide persistent map unchanged', 'staleModalTriggers': 'PASS', 'illegalTransitions': 0, 'errors': errors})
                context.close()
            # Resize with focused map content through both compact boundaries.
            context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
            page = context.new_page()
            page.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')")
            page.goto(url); page.wait_for_function('window.__mall?.ready&&window.__sceneReady', timeout=90000)
            page.locator('#header-map').click()
            page.set_viewport_size({'width': 651, 'height': 844})
            page.wait_for_function('__mall.mode==="explore"')
            page.locator('[data-teleport=newmoon]').focus()
            page.set_viewport_size({'width': 650, 'height': 844})
            page.wait_for_function('document.activeElement.id==="header-map"&&!document.querySelector("#mall-map").open')
            page.set_viewport_size({'width': 844, 'height': 560})
            page.locator('#header-map').click()
            page.set_viewport_size({'width': 844, 'height': 561})
            page.wait_for_function('__mall.mode==="explore"')
            page.locator('[data-teleport=mili]').focus()
            page.set_viewport_size({'width': 844, 'height': 560})
            page.wait_for_function('document.activeElement.id==="header-map"&&!document.querySelector("#mall-map").open')
            rows.append({'breakpoints': '650/651 and560/561', 'focusRecovery': 'PASS', 'illegalTransitions': page.evaluate('__mall.state.illegalCount')})
            context.close()
            for javascript in [True, False]:
                context = browser.new_context(java_script_enabled=javascript, viewport={'width': 390, 'height': 844})
                page = context.new_page()
                if javascript: page.route('**/rapier.mjs', lambda route: route.abort())
                page.goto(url)
                if javascript: page.wait_for_function('window.__sceneFailed')
                assert page.locator('#store-list').is_visible() and page.locator('.product-card').count() == 4
                assert page.locator('#experience').is_hidden()
                rows.append({'fallback': 'WASM' if javascript else 'noJS', 'directoryAndFourProducts': 'PASS'})
                context.close()
            browser.close()
    finally:
        server.shutdown()
    assert all(hashlib.sha256((args.root / name).read_bytes()).hexdigest() == value for name, value in hashes.items())
    assert hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == diagnostic_hash
    receipt = {'status': 'PASS', 'diagnosticSHA256': diagnostic_hash, 'runtimeSHA256': hashes, 'cases': rows, 'frames': sum(len(row.get('frames', [])) for row in rows), 'limits': 'Browser touch/reduced-motion and synthetic standard-controller snapshots; no physical phone, OS screen reader or hardware-controller certification.'}
    (args.output / 'report.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    run()
