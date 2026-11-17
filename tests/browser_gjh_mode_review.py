"""Focused real-browser review of retained V11 mode layers and interruptions."""
import argparse
import functools
import http.server
import json
import os
import platform
import threading
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright
from gjh_shelf_helpers import shelf_details

from browser_gjh_guide import Quiet, ROOT, state
from browser_gjh_modes import activate_cart, approach_seat, close_bag

RUNTIME = 'demos/corporate/gjh/v11/'


def wait_ready(page, url):
    page.goto(url, timeout=60000)
    page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=60000)


def observe(page, name, mode, paused, layers=None):
    page.wait_for_function('expected => __mall.mode === expected', arg=mode)
    result = page.evaluate('''() => ({mode:__mall.mode, snapshot:__mall.state.mode,
      body:document.body.dataset.mode, paused:__mall.state.paused,
      layers:__mall.state.modeLayers, illegalCount:__mall.state.illegalCount,
      history:__mall.state.modeHistory})''')
    assert result['mode'] == result['snapshot'] == result['body'] == mode, (name, result)
    assert result['paused'] is paused, (name, result)
    assert result['illegalCount'] == 0, (name, result)
    if layers is not None:
        assert result['layers'] == layers, (name, result)
    return result


def close_event_before_action(page, selector):
    # Install a promise without returning it through evaluate; the native close
    # event and its component listeners must finish before focus is inspected.
    page.locator(selector).evaluate('''dialog => {
      window.__reviewClosed = new Promise(resolve => dialog.addEventListener('close',
        () => requestAnimationFrame(() => resolve()), {once:true}));
    }''')


def finish_close(page):
    page.evaluate('''async () => { await window.__reviewClosed; delete window.__reviewClosed; }''')


def add_selection(page):
    page.locator('.product-card [data-inspect]').first.click()
    page.locator('#product-add').click()
    close_event_before_action(page, '#product-dialog')
    page.locator('#product-close').click()
    finish_close(page)
    assert page.locator('#bag-open').inner_text() == 'Bag (1)'


def approach_product(page):
    page.evaluate("__mall.teleport('newmoon'); __mall.setInput({forward:1})")
    for _ in range(80):
        page.evaluate('__mall.step(100)')
        if str(state(page).get('nearby') or '').startswith('new-moon-'):
            break
    page.evaluate('__mall.setInput(null)')
    assert str(state(page)['nearby']).startswith('new-moon-'), state(page)


def lose_context(page):
    assert page.evaluate('''() => {
      const gl = document.querySelector('#scene').getContext('webgl2');
      const extension = gl && gl.getExtension('WEBGL_lose_context');
      if (!extension) return false;
      extension.loseContext(); return true;
    }'''), 'WEBGL_lose_context unavailable in real Chrome context'
    page.wait_for_function('window.__sceneFailed === true && !__mall.ready', timeout=10000)
    page.locator('#store-list').wait_for(state='visible')


def cart_snapshot(page):
    return page.evaluate('''() => {
      const active = document.activeElement, rect = active.getBoundingClientRect();
      return {ready:__mall.ready, mode:__mall.mode, layers:__mall.state.modeLayers,
        paused:__mall.state.paused, illegalCount:__mall.state.illegalCount,
        pushing:__mall.state.pushing, bagOpen:document.querySelector('#bag-dialog').open,
        selection:document.querySelector('#bag-open').textContent,
        sessionSelection:sessionStorage.getItem('gjh-v11-demo-bag-v1'),
        focus:active.id || active.dataset.bagFocus,
        focusVisible:!active.closest('[hidden]') && rect.width > 0 && rect.height > 0,
        cartHidden:document.querySelector('#cart-controls').hidden,
        cartDisabled:document.querySelector('#cart-toggle').disabled,
        cartLabel:document.querySelector('#cart-toggle').textContent,
        status:document.querySelector('#cart-status').textContent};
    }''')


def review_cart_fallback(browser, url, rows, shot, page_errors):
    # These controls must refresh even when setView(false) has no view change to
    # publish. All selections come from the actual product Add control.
    cases = [('live-inactive', False, False, '#cart-toggle'),
             ('live-active', False, True, '#cart-toggle'),
             ('directory-cart-focus', True, False, '#cart-toggle'),
             ('directory-quantity-focus', True, False, '#bag-items button'),
             ('directory-close-focus', True, False, '#bag-close')]
    for label, directory, active, focus_selector in cases:
        context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
            reduced_motion='reduce', service_workers='block')
        page = context.new_page()
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            wait_ready(page, url)
            page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
            page.locator('#store-list').wait_for(state='visible')
            add_selection(page)
            if not directory:
                page.locator('#view-toggle').click()
            page.locator('#bag-open').click()
            if active:
                activate_cart(page)
                assert state(page)['pushing']
                assert page.evaluate('document.activeElement.id') == 'scene'
                page.locator('#bag-open').click()
            page.locator(focus_selector).first.focus()
            before = cart_snapshot(page)
            assert not before['cartHidden'] and not before['cartDisabled'], before
            lose_context(page)
            after = cart_snapshot(page)
            print(json.dumps({'case': label, 'before': before, 'afterLoss': after}), flush=True)
            shot(page, label + '-loss')
            observe(page, label, 'shop', True, ['explore', 'menu', 'shop'])
            assert not after['ready'] and not after['pushing'] and after['bagOpen'], after
            assert after['cartHidden'] and after['cartDisabled'], after
            expected_focus = 'bag-close' if focus_selector == '#cart-toggle' else before['focus']
            assert after['focus'] == expected_focus and after['focusVisible'], after
            assert after['selection'] == 'Bag (1)', after
            assert after['sessionSelection'] == before['sessionSelection'], after
            assert 'Cart active' not in after['status'], after

            # Explicit synthetic queued-click probe: dispatch bypasses native
            # hidden/disabled hit testing, but never changes runtime/mode flags.
            page.locator('#cart-toggle').dispatch_event('click')
            queued = cart_snapshot(page)
            assert queued == after, (after, queued)
            assert not errors, errors
            close_bag(page, escape=active)
            observe(page, label + ' close', 'menu', True, ['explore', 'menu'])
            assert page.locator('#bag-open').evaluate('el => el === document.activeElement')
            assert page.locator('#bag-open').is_visible()
            rows.append({'scenario': label + ': actual main context loss under Bag', 'result': 'PASS',
                'afterLoss': after, 'queuedClick': 'synthetic dispatch; no change',
                'closeFocus': 'visible shared-header bag-open', 'pageErrors': errors})
        finally:
            context.close()

    # Positive handoff from directory still deploys Cart and waits for the native
    # Bag close handler before checking scene focus and real keyboard movement.
    context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
        reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    try:
        wait_ready(page, url)
        page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
        page.locator('#store-list').wait_for(state='visible')
        add_selection(page)
        page.locator('#bag-open').click()
        activate_cart(page)
        observe(page, 'ready directory Cart handoff', 'cart', False, ['cart'])
        assert page.locator('#scene').evaluate('el => el === document.activeElement')
        before = state(page)
        page.keyboard.down('w')
        page.wait_for_function('z => __mall.state.z < z - .2', arg=before['z'])
        page.keyboard.up('w')
        assert page.locator('#bag-open').inner_text() == 'Bag (1)'
        for escape in (False, True):
            page.locator('#bag-open').click()
            close_bag(page, escape=escape)
            assert page.locator('#bag-open').evaluate('el => el === document.activeElement')
            observe(page, 'ready Cart ordinary Bag close', 'cart', False, ['cart'])
        rows.append({'scenario': 'ready directory Use cart and ordinary Close/Escape', 'result': 'PASS',
            'activationFocus': 'scene', 'keyboardMovement': 'greater than 0.2m', 'selection': 'Bag (1)'})
    finally:
        context.close()

    context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
        reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    try:
        blocked = []
        def fail_cart(route):
            blocked.append(route.request.url)
            route.abort()
        page.route('**/shopping-cart.glb', fail_cart)
        wait_ready(page, url)
        page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
        page.locator('#store-list').wait_for(state='visible')
        add_selection(page)
        page.locator('#bag-open').click()
        before = cart_snapshot(page)
        assert blocked and not state(page)['character']['cart']['available']
        assert before['cartHidden'] and before['cartDisabled'], before
        page.locator('#cart-toggle').dispatch_event('click')
        assert cart_snapshot(page) == before
        page.locator('#bag-items button').nth(1).click()
        assert page.locator('#bag-open').inner_text() == 'Bag (2)'
        close_bag(page)
        assert page.locator('#bag-open').evaluate('el => el === document.activeElement')
        rows.append({'scenario': 'optional shopping-cart.glb failure', 'result': 'PASS',
            'blockedRequests': len(blocked), 'cartUnavailable': True,
            'syntheticClick': 'no change', 'bagQuantityEdit': 'Bag (1) → Bag (2)'})
    finally:
        context.close()


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path,
                        default=Path(tempfile.gettempdir()) / 'gallery-v11-mode-review')
    parser.add_argument('--evidence', type=Path,
                        default=ROOT / 'docs/evidence/v11-mode-review.json')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    failures = []
    page_errors = []

    def shot(page, name):
        page.screenshot(path=str(args.output / f'{name}.png'))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0),
        functools.partial(Quiet, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/{RUNTIME}'
    rows = []
    page = None
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                args=['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'),
                      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            review_cart_fallback(browser, url, rows, shot, page_errors)

            # Compact Map and Help are blocking Menu panels beneath Shop.
            context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                reduced_motion='reduce', service_workers='block')
            page = context.new_page()
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            wait_ready(page, url)
            page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#scene').focus()
            page.wait_for_function("document.querySelector('#guide-card').hidden")
            page.locator('#header-map').click()
            observe(page, 'compact map open', 'menu', True, ['explore', 'menu'])
            page.locator('#bag-open').click()
            observe(page, 'map covered by Bag', 'shop', True, ['explore', 'menu', 'shop'])
            close_bag(page)
            observe(page, 'map restored under Menu', 'menu', True, ['explore', 'menu'])
            assert page.locator('#mall-map').evaluate('el => el.open')
            assert page.locator('#bag-open').evaluate('el => el === document.activeElement')
            shot(page, 'compact-map-retained-after-bag')
            page.keyboard.press('Escape')
            observe(page, 'map closed to gameplay', 'explore', False, ['explore'])
            assert page.locator('#header-map').evaluate('el => el === document.activeElement')
            page.locator('#keyboard-help summary').click()
            observe(page, 'compact Help open', 'menu', True, ['explore', 'menu'])
            page.locator('#bag-open').click()
            observe(page, 'Help covered by Bag', 'shop', True, ['explore', 'menu', 'shop'])
            close_bag(page, escape=True)
            observe(page, 'Help restored under Menu', 'menu', True, ['explore', 'menu'])
            assert page.locator('#keyboard-help').evaluate('el => el.open')
            shot(page, 'compact-help-retained-after-bag')
            page.locator('#keyboard-help summary').click()
            observe(page, 'Help closed to gameplay', 'explore', False, ['explore'])
            for panel in ('map', 'help'):
                page.locator('#header-map' if panel == 'map' else '#keyboard-help summary').click()
                page.locator('#bag-open').click()
                page.set_viewport_size({'width': 1440, 'height': 900})
                page.wait_for_function("document.querySelector('#header-map').hidden")
                observe(page, 'wide ' + panel + ' under Bag', 'shop', True, ['explore', 'shop'])
                page.set_viewport_size({'width': 390, 'height': 844})
                page.wait_for_function("!document.querySelector('#header-map').hidden && !document.querySelector('#mall-map').open")
                close_bag(page)
                observe(page, 'resized ' + panel + ' after Bag',
                    'menu' if panel == 'help' else 'explore', panel == 'help',
                    ['explore', 'menu'] if panel == 'help' else ['explore'])
                if panel == 'help':
                    page.locator('#keyboard-help summary').click()
                    observe(page, 'resized Help closed', 'explore', False, ['explore'])
            assert not errors, errors
            rows.append({'scenario': 'compact map/help under Bag', 'result': 'PASS',
                'evidence': 'real controls, retained layers, native close/escape, post-close focus; compact/wide/compact resize under Bag'})

            page.locator('#header-map').click()
            observe(page, 'compact Map opens', 'menu', True, ['explore', 'menu'])
            page.keyboard.press('Escape')
            page.locator('#view-toggle').click()
            page.locator('#store-list').wait_for(state='visible')
            assert page.evaluate('document.activeElement.id') == 'list-title'
            page.locator('#view-toggle').click()
            context.close()

            # Explicit List control owns exit cleanup from real Seated and Cart.
            context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                reduced_motion='no-preference', service_workers='block')
            page = context.new_page()
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            wait_ready(page, url)
            page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
            page.locator('#view-toggle').click()
            approach_seat(page)
            page.locator('#inspect').click()
            page.evaluate('__mall.step(1200)')
            assert state(page)['seatPhase'] == 'seated', state(page)
            observe(page, 'seated before List', 'seated', False, ['seated'])
            page.locator('#view-toggle').click()
            page.locator('#store-list').wait_for(state='visible')
            assert not state(page)['seated'] and state(page)['seatPhase'] == 'idle'
            observe(page, 'List exits Seated', 'menu', True, ['explore', 'menu'])
            shot(page, 'list-after-seated')
            page.locator('#view-toggle').click()
            page.evaluate("__mall.teleport('atrium'); __mall.setInput(null)")
            page.locator('#bag-open').click()
            activate_cart(page)
            observe(page, 'Cart active before List', 'cart', False, ['cart'])
            page.locator('#view-toggle').click()
            page.locator('#store-list').wait_for(state='visible')
            assert not state(page)['pushing']
            observe(page, 'List exits Cart', 'menu', True, ['explore', 'menu'])
            shot(page, 'list-after-cart')
            assert page.evaluate('__mall.state.illegalCount') == 0
            assert not errors, errors
            rows.append({'scenario': 'explicit List from Seated and Cart', 'result': 'PASS',
                'resultingState': 'directory Menu, paused true, Explore base; standing, cart stowed'})
            context.close()

            # An actual nearby shelf SKU is inspectable while pushing; verify
            # cart ownership, selection and camera survive the product modal.
            context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                reduced_motion='reduce', service_workers='block')
            page = context.new_page()
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            wait_ready(page, url)
            page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
            page.locator('.product-card [data-inspect]').first.click()
            page.locator('#product-add').click()
            close_event_before_action(page, '#product-dialog')
            page.locator('#product-close').click()
            finish_close(page)
            page.locator('#view-toggle').click()
            page.evaluate("__mall.teleport('newmoon')")
            page.locator('#bag-open').click()
            activate_cart(page)
            observe(page, 'Cart at compact viewport', 'cart', False, ['cart'])
            page.locator('#keyboard-help summary').click()
            observe(page, 'compact Cart Help', 'menu', True, ['cart', 'menu'])
            page.locator('#keyboard-help summary').click()
            observe(page, 'compact Cart Help closed', 'cart', False, ['cart'])
            page.locator('#header-map').click()
            observe(page, 'compact Cart Map', 'menu', True, ['cart', 'menu'])
            page.keyboard.press('Escape')
            observe(page, 'compact Cart Map closed', 'cart', False, ['cart'])
            page.set_viewport_size({'width': 1440, 'height': 900})
            page.wait_for_function("document.querySelector('#header-map').hidden")
            page.locator('#keyboard-help summary').click()
            observe(page, 'wide Cart Help', 'cart', False, ['cart'])
            before_frames = state(page)['frames']
            page.wait_for_function('before => __mall.state.frames > before', arg=before_frames)
            page.locator('#keyboard-help summary').click()
            observe(page, 'wide Cart Help closed', 'cart', False, ['cart'])
            page.set_viewport_size({'width': 390, 'height': 844})
            page.wait_for_function("!document.querySelector('#header-map').hidden")
            page.evaluate('__mall.setInput({forward:1})')
            found = False
            for _ in range(80):
                page.evaluate('__mall.step(100)')
                current = state(page)
                if str(current.get('nearby') or '').startswith('new-moon-'):
                    found = True
                    break
            page.evaluate('__mall.setInput(null)')
            assert found, ('no reachable product display while cart active', state(page))
            before = state(page)
            assert before['pushing'] and before['character']['physicalProduct']['phase'] == 'empty'
            assert page.locator('#bag-open').inner_text() == 'Bag (1)'
            page.locator('#inspect').click()
            observe(page, 'Cart product Shelf', 'shelf', True, ['cart', 'shelf'])
            shelf_details(page)
            page.locator('#product-dialog').wait_for(state='visible')
            observe(page, 'Cart product Inspect', 'inspect', True, ['cart', 'inspect'])
            assert state(page)['pushing']
            close_event_before_action(page, '#product-dialog')
            page.locator('#product-close').click()
            finish_close(page)
            after = observe(page, 'Cart product Inspect close', 'cart', False, ['cart'])
            assert state(page)['pushing'] and page.locator('#bag-open').inner_text() == 'Bag (1)'
            for key in ['seated', 'seatId', 'pushing', 'yaw', 'pitch', 'cameraFocus', 'cameraDistance']:
                assert state(page)[key] == before[key], (key, before[key], state(page))
            assert after['illegalCount'] == 0
            shot(page, 'cart-product-inspect-restored')
            rows.append({'scenario': 'Cart nearby product Inspect plus compact/wide Help and Map',
                'result': 'PASS', 'nearbyProduct': before['nearby'], 'cartRetained': True,
                'bagSelectionRetained': 'Bag (1)', 'cameraAndPostureRetained': True,
                'compactHelpAndMap': 'blocking Menu; close restores Cart',
                'wideHelp': 'nonmodal; real frames continue'})
            context.close()

            # Pause an actual procedural sit animation under Shop; on return it
            # advances and completes without resetting its endpoint/camera.
            context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                reduced_motion='no-preference', service_workers='block')
            page = context.new_page()
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            wait_ready(page, url)
            page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
            page.locator('#view-toggle').click()
            approach_seat(page)
            page.locator('#inspect').click()
            moving = state(page)
            for _ in range(20):
                if moving['seatPhase'] == 'sit':
                    break
                page.evaluate('__mall.step(100)')
                moving = state(page)
            assert moving['seatPhase'] == 'sit' and 0 < moving['character']['seatWeight'] < 1, moving
            page.locator('#bag-open').click()
            observe(page, 'Shop pauses sit animation', 'shop', True, ['seated', 'shop'])
            shot(page, 'sit-animation-paused-by-bag')
            paused = state(page)
            page.evaluate('__mall.step(500)')
            still_paused = state(page)
            assert still_paused['character']['seatWeight'] == paused['character']['seatWeight']
            close_bag(page)
            observe(page, 'sit animation resumes', 'seated', False, ['seated'])
            page.wait_for_function("__mall.state.seatPhase === 'seated'", timeout=8000)
            completed = state(page)
            assert completed['seated'] and completed['character']['seatWeight'] == 1
            assert completed['cameraFocus'] == 'seat'
            rows.append({'scenario': 'physical sit animation paused by Bag', 'result': 'PASS',
                'phaseBefore': moving['seatPhase'], 'weightBefore': moving['character']['seatWeight'],
                'weightStayedDuringPause': True, 'phaseAfterResume': completed['seatPhase'],
                'cameraFocusAfter': completed['cameraFocus']})
            context.close()

            # Actual loss against fresh canvases distinguishes the existing
            # directory Inspect contract from scene Inspect auto-close.
            for overlay in ('directory-product', 'scene-product', 'bag'):
                context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                    reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                page.on('pageerror', lambda error: page_errors.append(str(error)))
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                wait_ready(page, url)
                page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#view-toggle').click()
                page.locator('#store-list').wait_for(state='visible')
                add_selection(page)
                if overlay == 'directory-product':
                    page.locator('.product-card [data-inspect]').first.click()
                    page.locator('#product-dialog').wait_for(state='visible')
                    observe(page, 'product dialog before loss', 'inspect', True,
                            ['explore', 'menu', 'inspect'])
                elif overlay == 'scene-product':
                    page.locator('#view-toggle').click()
                    approach_product(page)
                    page.locator('#inspect').click()
                    observe(page, 'actual 3D Shelf before details', 'shelf', True, ['explore', 'shelf'])
                    shelf_details(page)
                    page.locator('#product-dialog').wait_for(state='visible')
                    observe(page, 'actual 3D product before loss', 'inspect', True, ['explore', 'inspect'])
                    close_event_before_action(page, '#product-dialog')
                else:
                    page.locator('#view-toggle').click()
                    page.locator('#bag-open').click()
                    observe(page, 'Bag before loss', 'shop', True, ['explore', 'shop'])
                selected_before = page.locator('#bag-open').inner_text()
                lose_context(page)
                if overlay == 'scene-product':
                    finish_close(page)
                shot(page, f'webgl-loss-{overlay}-fallback')
                assert page.locator('.product-card').count() == 4
                assert page.locator('#view-toggle').is_hidden()
                fallback_state = observe(page, f'{overlay} fallback',
                    'inspect' if overlay == 'directory-product' else 'menu' if overlay == 'scene-product' else 'shop', True,
                    ['explore', 'menu', 'inspect'] if overlay == 'directory-product' else
                    ['explore', 'menu'] if overlay == 'scene-product' else ['explore', 'menu', 'shop'])
                assert page.locator('#bag-open').inner_text() == selected_before
                if overlay == 'directory-product':
                    assert page.locator('#product-dialog').evaluate('el => el.open')
                    assert page.locator('#product-close').evaluate('el => el === document.activeElement')
                    close_event_before_action(page, '#product-dialog')
                    page.locator('#product-close').click()
                    finish_close(page)
                elif overlay == 'scene-product':
                    assert not page.locator('#product-dialog').evaluate('el => el.open')
                    assert page.locator('#list-title').evaluate('el => el === document.activeElement')
                else:
                    close_event_before_action(page, '#bag-dialog')
                    page.locator('#bag-close').click()
                    finish_close(page)
                page.wait_for_function("document.activeElement.id !== 'scene'")
                focus = page.evaluate('''() => ({tag:document.activeElement.tagName,
                  id:document.activeElement.id || '',
                  inspectId:document.activeElement.dataset?.inspect || '',
                  hiddenAncestor:!!document.activeElement.closest('[hidden]'),
                  experienceHidden:document.querySelector('#experience[hidden]')})''')
                assert focus['id'] != 'scene'
                if focus['hiddenAncestor']:
                    failures.append({'scenario': f'WebGL context loss under {overlay}',
                        'failure': 'Closing overlay restored focus to a hidden control',
                        'focus': focus})
                    shot(page, f'webgl-loss-{overlay}-hidden-focus')
                assert page.locator('#store-list').is_visible()
                assert page.evaluate('__mall.state.illegalCount') == 0
                assert not errors, errors
                rows.append({'scenario': f'WebGL context loss under {overlay}', 'result': 'PASS',
                    'modeAfterLoss': fallback_state['mode'], 'pausedAfterLoss': fallback_state['paused'],
                    'layersAfterLoss': fallback_state['layers'],
                    'directoryProducts': 4, 'bagSelectionRetained': selected_before,
                    'focusAfterClose': focus,
                    'focusAcceptance': 'FAIL' if focus['hiddenAncestor'] else 'PASS',
                    'contextLoss': 'real WEBGL_lose_context extension'})
                context.close()
            assert not page_errors, page_errors
            browser.close()
    except Exception:
        if page is not None and not page.is_closed():
            try:
                debug = page.evaluate('''() => ({focus:document.activeElement.id,
                  mode:window.__mall?.mode, state:window.__mall?.state,
                  guideOpen:!document.querySelector('#guide-card')?.hidden,
                  mapOpen:document.querySelector('#mall-map')?.open,
                  helpOpen:document.querySelector('#keyboard-help')?.open})''')
                (args.output / 'failure.json').write_text(json.dumps(debug, indent=2) + '\n')
                page.screenshot(path=str(args.output / 'failure.png'))
            except Exception:
                pass
        raise
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    payload = {'environment': {'browser': 'Google Chrome', 'browserVersion': browser.version,
        'platform': platform.platform(), 'webglBackend': os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'),
        'serving': 'repository source root over local HTTP', 'contextLoss': 'real WEBGL_lose_context extension'},
        'scenarios': rows, 'failures': failures, 'browserPageErrors': page_errors}
    args.evidence.write_text(json.dumps(payload, indent=2) + '\n')
    print(json.dumps(payload, indent=2))
    print(f'Evidence: {args.evidence}')
    if failures:
        raise AssertionError(f'{len(failures)} focused mode review failure(s): {failures}')


if __name__ == '__main__':
    run()
