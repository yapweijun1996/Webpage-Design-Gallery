"""V11 DOM accessibility, conservative contrast and actual keyboard journeys."""
from gjh_menu_test_helpers import close_menu, open_menu_page
import argparse
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import platform
import threading

from playwright.sync_api import sync_playwright

from browser_gjh_budget import ROOT, Quiet
from browser_gjh_expanded_shell import move

AXE_SHA256 = '880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb'


def tab_dialog(page, selector):
    dialog = page.locator(selector)
    count = dialog.locator('button:visible:enabled,a:visible,input:visible,canvas:visible').count()
    visited = []
    for _ in range(count + 3):
        page.keyboard.press('Tab')
        focused = page.evaluate('''selector => {
          const element = document.activeElement, rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {tag: element.tagName, inside: !!element.closest(selector),
            id: element.id, outline: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth),
            hit: element.contains(document.elementFromPoint(rect.x+rect.width/2, rect.y+rect.height/2))};
        }''', selector)
        if focused['tag'] == 'BODY':
            # Native dialog traversal may visit browser chrome at the boundary.
            page.keyboard.press('Tab')
            assert page.evaluate('s => !!document.activeElement.closest(s)', selector)
            continue
        assert focused['inside'] and focused['hit'], focused
        assert focused['outline'] != 'none' and focused['outlineWidth'] >= 2, focused
        visited.append(focused['id'])
    return visited


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--axe-script', type=Path, default=os.environ.get('GALLERY_AXE'))
    parser.add_argument('--output', type=Path, default=ROOT.parent / 'evidence/v11-accessibility')
    args = parser.parse_args()
    assert args.axe_script and args.axe_script.is_file(), 'Provide reviewed axe-core 4.10.3'
    assert hashlib.sha256(args.axe_script.read_bytes()).hexdigest() == AXE_SHA256
    args.output.mkdir(parents=True, exist_ok=True)
    source_paths = ['demos/corporate/gjh/v11/index.html', 'demos/corporate/gjh/v11/style.css',
        'demos/corporate/gjh/v11/assets/ui.js', 'demos/corporate/gjh/v11/assets/ux-tutorial.js']
    source_hashes = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in source_paths}
    test_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    server = http.server.ThreadingHTTPServer(
        ('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    results = []
    backend = os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader')
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                args=[f'--use-angle={backend}', '--enable-unsafe-swiftshader'])
            fixture = browser.new_page()
            fixture.set_content('<label>Fixture<select><option value="swept">Swept</option>'
                                '<option value="short">Short</option></select></label>')
            fixture.locator('select').focus()
            for key in ['Space', 'ArrowDown', 'Enter']:
                fixture.keyboard.press(key)
            native_select = {'keys': ['Space', 'ArrowDown', 'Enter'],
                'fixtureValue': fixture.locator('select').input_value(), 'expectedValue': 'short'}
            native_select['supportedByHost'] = native_select['fixtureValue'] == 'short'
            fixture.close()
            for width, height in [(320, 568), (390, 844), (768, 1024), (1440, 900), (667, 375)]:
                page = browser.new_page(viewport={'width': width, 'height': height},
                    has_touch=width < 1000, reduced_motion='reduce', service_workers='block')
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/?visitor=v2#experience',
                          timeout=60000)
                page.wait_for_function('__mall?.ready && __sceneReady', timeout=60000)
                page.add_script_tag(path=str(args.axe_script))
                page.add_script_tag(path=str(ROOT / 'tests/gjh_contrast.js'))
                assert page.evaluate('axe.version') == '4.10.3'
                scans = []

                def scan(state):
                    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
                    report = page.evaluate('''async () => {
                      const audit = await axe.run(document, {runOnly: {type: 'tag',
                        values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
                      const contrast = [], unresolved = [];
                      for (const rule of audit.incomplete) for (const node of rule.nodes) {
                        if (rule.id !== 'color-contrast') {unresolved.push({rule: rule.id, target: node.target});continue;}
                        const element = document.querySelector(node.target[0]);
                        contrast.push({target: node.target, ...gjhContrast(element)});
                      }
                      const modal = document.querySelector('dialog[open]');
                      const controls = [...(modal || document).querySelectorAll('button,summary,input,select')]
                        .filter(element => {const r=element.getBoundingClientRect(),s=getComputedStyle(element);
                          return element.checkVisibility()&&r.width>0&&r.height>0&&s.visibility!=='hidden';})
                        .map(element => {
                          // Associated labels contribute to native input hit targets.
                          const target=element.matches('input[type=checkbox],input[type=radio]')&&element.labels?.[0]||element;
                          const r=target.getBoundingClientRect(),visual=element.getBoundingClientRect();return {
                          id:element.id,tag:element.tagName,width:r.width,height:r.height,
                          targetOwner:target===element?'control':'associated-label',
                          visualWidth:visual.width,visualHeight:visual.height};});
                      return {violations:audit.violations.map(r=>({id:r.id,targets:r.nodes.map(n=>n.target)})),
                        unresolved, contrast, controls};
                    }''')
                    assert not report['violations'], (state, report['violations'])
                    assert not report['unresolved'], (state, report['unresolved'])
                    for node in report['contrast']:
                        assert node.get('hidden') or (not node.get('unresolved') and
                            node['minimumRatio'] >= node['requiredRatio']), (state, node)
                    for control in report['controls']:
                        assert control['width'] >= 44 and control['height'] >= 44, (state, control)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    scans.append({'state': state, **report})
                    if width in (390, 1440, 667):
                        page.screenshot(path=str(args.output / f'{state}-{width}.png'))

                page.locator('#guide-card').wait_for(state='visible')
                scan('guide')
                page.locator('#guide-skip').focus()
                guide_focus = [page.evaluate('document.activeElement.id')]
                page.keyboard.press('Tab')
                guide_focus.append(page.evaluate('document.activeElement.id'))
                assert guide_focus == ['guide-skip', 'guide-next'], guide_focus
                assert page.locator('#guide-next').evaluate('e => parseFloat(getComputedStyle(e).outlineWidth) >= 2')
                page.keyboard.press('Tab')
                assert page.evaluate('!document.activeElement.closest("#guide-card")')
                page.locator('#guide-skip').click()
                page.locator('#guide-card').wait_for(state='hidden')
                page.locator('#scene').focus()
                scan('explore')
                compact = width < 651 or height < 561
                assert not page.locator('#mall-map').evaluate('e => e.open')
                page.locator('#header-map').click()
                page.wait_for_function('document.querySelector("#mall-map").open')
                scan('map')
                if compact:
                    page.keyboard.press('Escape')
                    assert page.locator('#header-map').evaluate('e => e === document.activeElement')
                else:
                    page.locator('#header-map').click()
                open_menu_page(page, "controls")
                scan('help')
                hair = page.get_by_role('combobox', name='Hair', exact=True)
                hair.focus()
                page.keyboard.press('Tab')
                page.keyboard.press('Shift+Tab')
                assert hair.evaluate('e => e === document.activeElement')
                page.keyboard.press('Space')
                page.keyboard.press('ArrowDown')
                page.keyboard.press('Enter')
                if native_select['supportedByHost']:
                    assert hair.input_value() == 'short'
                native_choice = 'PASS' if hair.input_value() == 'short' else 'NOT_VERIFIED: host native popup fixture also does not change'
                assert hair.evaluate('e => parseFloat(getComputedStyle(e).outlineWidth) >= 2')
                hair.select_option('short')
                assert page.evaluate('__mall.state.character.customization.hair') == 'short'
                hair.select_option('swept')
                assert hair.input_value() == 'swept'
                # Native select scrolling can settle after its change event.
                page.wait_for_function('''() => {const e=document.querySelector('select[name="hair"]'),p=document.querySelector('#mall-tools-content'),r=e.getBoundingClientRect(),v=p.getBoundingClientRect();return e===document.activeElement&&r.top>=v.top&&r.bottom<=v.bottom&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}''', timeout=3000)
                hair_hit = hair.evaluate('''e=>{const r=e.getBoundingClientRect(),o=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),p=document.querySelector('#mall-tools-content');return {viewport:[innerWidth,innerHeight],rect:r.toJSON(),hit:e.contains(o),occluder:o?.outerHTML.slice(0,600),scrollport:p.getBoundingClientRect().toJSON(),scrollTop:p.scrollTop,active:document.activeElement.name}}''')
                if not hair_hit['hit']:
                    (args.output / f'hair-hit-failure-{width}.json').write_text(json.dumps(hair_hit, indent=2) + '\n')
                    page.screenshot(path=str(args.output / f'hair-hit-failure-{width}.png'))
                assert hair_hit['hit'], hair_hit
                if width in (390, 768, 1440):
                    page.screenshot(path=str(args.output / f'help-controls-{width}.png'))
                for field in ['Hair colour', 'Top', 'Skin tone', 'Glasses', 'Backpack', 'Watch']:
                    page.keyboard.press('Tab')
                    control = page.get_by_role('combobox', name=field, exact=True)
                    assert control.evaluate('e => e === document.activeElement')
                    assert control.evaluate('e => {const r=e.getBoundingClientRect();'
                        'return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
                    assert control.evaluate('e => parseFloat(getComputedStyle(e).outlineWidth) >= 2')
                if compact:
                    page.keyboard.press('Escape')
                    assert page.locator('#header-menu').evaluate('e => e === document.activeElement')
                else:
                    close_menu(page)
                page.locator('#bag-open').click()
                scan('empty-bag')
                tab_dialog(page, '#bag-dialog')
                page.keyboard.press('Escape')
                page.wait_for_function('document.activeElement.id === "bag-open"')
                page.locator('#view-toggle').click()
                scan('list')
                assert page.get_by_role('group', name='New Moon products').count() == 1
                trigger = page.locator('[data-inspect="new-moon-nz-425g-front"]')
                trigger.click()
                scan('product')
                tab_dialog(page, '#product-dialog')
                page.wait_for_function('__newMoonPreview.state.loaded', timeout=60000)
                scan('preview')
                tab_dialog(page, '#product-dialog')
                page.locator('#product-add').focus()
                for _ in range(9):
                    page.keyboard.press('Enter')
                assert page.locator('#product-add').is_disabled()
                page.keyboard.press('Tab')
                assert page.locator('#product-shop').evaluate('e => e === document.activeElement')
                page.keyboard.press('Escape')
                page.wait_for_function('document.activeElement.dataset.inspect === "new-moon-nz-425g-front"')
                for sku in ['au-425g', 'sa-425g', 'mx-454g']:
                    page.locator(f'[data-inspect="new-moon-{sku}-front"]').click()
                    page.locator('#product-add').click()
                    page.keyboard.press('Escape')
                page.locator('#bag-open').click()
                scan('populated-bag')
                assert page.get_by_role('status', name='Quantity 9, maximum per item', exact=True).count() == 1
                assert page.locator('.bag-quantity output').first.inner_text() == '9 (max)'
                bag_focus = tab_dialog(page, '#bag-dialog')
                resized_bag = []
                if width == 390:
                    for resized_width, resized_height in [(320, 568), (667, 375), (390, 844)]:
                        page.set_viewport_size({'width': resized_width, 'height': resized_height})
                        page.wait_for_function('''() => {
                          const dialog=document.querySelector('#bag-dialog');
                          return Math.abs(parseFloat(dialog.style.getPropertyValue('--bag-header-height'))-
                            dialog.querySelector('.bag-top').getBoundingClientRect().height)<1;
                        }''')
                        page.locator('#cart-toggle').focus()
                        assert page.locator('#cart-toggle').evaluate('e => {const r=e.getBoundingClientRect();'
                            'return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
                        page.screenshot(path=str(args.output / f'bag-keyboard-{resized_width}.png'))
                        resized_bag.append([resized_width, resized_height])
                for position in [0, 0.5, 1]:
                    page.locator('#bag-dialog .bag-scroll').evaluate('(e,p) => e.scrollTop=p*e.scrollHeight', position)
                    assert page.locator('#bag-close').evaluate('e => {const r=e.getBoundingClientRect();'
                        'return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
                page.keyboard.press('Escape')
                page.wait_for_function('document.activeElement.id === "bag-open"')
                page.locator('#original-tin-open').click()
                page.wait_for_function('__originalTin.state.loaded', timeout=60000)
                scan('original-tin')
                tab_dialog(page, '#original-tin-dialog')
                page.keyboard.press('Escape')
                page.wait_for_function('document.activeElement.id === "original-tin-open"')
                page.locator('#view-toggle').click()
                page.locator('#bag-open').click()
                page.locator('#cart-toggle').focus()
                page.keyboard.press('Enter')
                page.wait_for_function('!document.querySelector("#bag-dialog").open && document.activeElement.id === "scene"')
                before = page.evaluate('__mall.state')
                page.keyboard.down('w')
                after = page.evaluate('__mall.step(500)')
                page.keyboard.up('w')
                distance = ((after['x'] - before['x']) ** 2 + (after['z'] - before['z']) ** 2) ** 0.5
                assert distance > 0.2, distance
                page.locator('#bag-open').click()
                page.locator('#cart-toggle').click()
                page.locator('#bag-close').click()
                page.wait_for_function('document.activeElement.id === "bag-open"')
                # Exercise Visitor v2 controls through actual shelf actions.
                assert page.evaluate('__mall.teleport("newmoon")')
                move(page, -10, -2.6, 2.65)
                move(page, -10, -7.4, 2.65)
                shelf = page.evaluate("__mall.state.shelves.find(s => s.id === 'new-moon-nz-425g-front')")
                move(page, (shelf['min']['x'] + shelf['max']['x']) / 2, -7.4, 2.65)
                assert page.evaluate('__mall.state.nearby') == 'new-moon-nz-425g-front'
                scan('shelf')
                pickup = page.get_by_role('button', name='Pick up product', exact=True)
                assert pickup.is_enabled(), 'The visitor must be within reach of the shelf'
                pickup.focus()
                assert pickup.evaluate('e => e === document.activeElement')
                page.keyboard.press('Enter')
                page.evaluate('__mall.step(1600)')
                assert page.evaluate('__mall.state.character.physicalProduct.phase') == 'held'
                scan('held-product')
                page.get_by_role('button', name='Return to shelf', exact=True).focus()
                page.keyboard.press('Enter')
                page.evaluate('__mall.step(1600)')
                assert page.evaluate('__mall.state.character.physicalProduct.phase') == 'empty'
                page.evaluate('''() => {__mall.teleport('atrium'); __mall.setInput({right:1});
                  __mall.step(750); __mall.setInput({forward:-1}); __mall.step(1500);
                  __mall.setInput({}); __mall.step(17);}''')
                assert page.evaluate('__mall.state.nearby') == 'visitor-elevator'
                scan('elevator')
                page.get_by_role('button', name='Use elevator to change levels', exact=True).focus()
                page.keyboard.press('Enter')
                page.evaluate('__mall.step(5000)')
                assert page.evaluate('__mall.state.y') > 7
                scan('upper-level')
                page.get_by_role('button', name='Use elevator to change levels', exact=True).focus()
                page.keyboard.press('Enter')
                page.evaluate('__mall.step(5000)')
                assert page.evaluate('__mall.state.y') < 0.1
                assert not errors, errors
                results.append({'viewport': [width, height], 'scans': scans,
                    'guideTabSequence': guide_focus, 'bagTabSequence': bag_focus,
                    'nativePopupKeyboardChoice': native_choice,
                    'appearanceKeyboardFocus': 'PASS: all seven named fields', 'hairImmediateHit': hair_hit,
                    'resizedOpenBag': resized_bag, 'cartKeyboardDistance': distance,
                    'normalBagCloseFocus': 'bag-open', 'pageErrors': errors})
                page.close()
            version = browser.version
            browser.close()
    finally:
        server.shutdown()
    assert all(hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == value for name, value in source_hashes.items())
    assert hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == test_hash
    report = {'sourceSHA256': source_hashes, 'testSHA256': test_hash, 'environment': f'{platform.system()} {platform.machine()} Chromium {version} / {backend}',
        'axeVersion': '4.10.3', 'axeSHA256': AXE_SHA256,
        'nativeSelectFixture': native_select,
        'application': json.loads((ROOT / 'data/app.json').read_text()),
        'runtimeSHA256': {name: hashlib.sha256((ROOT / 'demos/corporate/gjh/v11' / name).read_bytes()).hexdigest()
            for name in ['index.html', 'style.css', 'assets/demo-bag.js', 'assets/ui.js']},
        'limitations': ['Browser keyboard and touch emulation, not a physical-device or screen-reader session',
                       'Native popup keyboard choice is NOT_VERIFIED when the independent host fixture also fails',
                       'Contrast bounds cover DOM UI, not artwork, logos or illuminated 3D scene labels'],
        'results': results}
    (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    run()
