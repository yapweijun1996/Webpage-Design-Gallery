"""Portable source-root browser coverage for V11 mode lifecycle and owner boundaries.

Uses the existing Python Playwright installation; no Node packages are required.
--baseline serves the three original runtime files from the pinned baseline ref without changing the
worktree, to reproduce the pre-patch failures with the same browser and controls.
"""
import argparse
import functools
import http.server
import json
import os
import subprocess
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from gjh_shelf_helpers import shelf_details

from browser_gjh_all_seats import move
from browser_gjh_guide import Quiet, ROOT, state

RUNTIME = 'demos/corporate/gjh/v11/'


def approach_seat(page):
    page.evaluate('''() => {
      __mall.teleport('atrium');
      // Approach the bench's clear front around the current kiosk and outer aisle.
      __mall.setInput({forward:1}); __mall.step(400);
      __mall.setInput({right:-1}); __mall.step(3950);
      __mall.setInput({forward:1}); __mall.step(1500);
      __mall.setInput({right:1}); __mall.step(1750);
      __mall.setInput({forward:-1}); __mall.step(500);
      __mall.setInput({forward:0}); __mall.step(20);
    }''')
    assert state(page)['nearby'] == 'courtyard-seat'


def watch_bag_close(page):
    # Observe the actual native close event, after the component's focus handler.
    # This is test synchronization only; no app state or result is fabricated.
    page.locator('#bag-dialog').evaluate('''dialog => {
      window.__modeBagClosed = new Promise(resolve => dialog.addEventListener('close',
        () => requestAnimationFrame(() => resolve()), {once:true}));
    }''')


def finish_bag_close(page):
    page.evaluate('''async () => { await window.__modeBagClosed; delete window.__modeBagClosed; }''')


def close_bag(page, escape=False):
    watch_bag_close(page)
    if escape:
        page.keyboard.press('Escape')
    else:
        page.locator('#bag-close').click()
    finish_bag_close(page)


def activate_cart(page):
    watch_bag_close(page)
    page.locator('#cart-toggle').click()
    finish_bag_close(page)


def retained(before, after):
    for key in ['seated', 'seatId', 'pushing', 'yaw', 'pitch', 'cameraFocus', 'cameraDistance']:
        assert after[key] == before[key], (key, before[key], after[key])
    assert after['character']['carrying']['count'] == before['character']['carrying']['count']
    assert after['character'].get('physicalProduct') == before['character'].get('physicalProduct')


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', action='store_true')
    parser.add_argument('--baseline-ref', default='55fb275', help='Pinned pre-lifecycle source revision')
    parser.add_argument('--output', type=Path, default=Path(tempfile.gettempdir()) / 'gallery-v11-modes')
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    baseline = {}
    if args.baseline:
        for name in ['script.js', 'assets/modes.js', 'assets/ui.js']:
            baseline['/' + RUNTIME + name] = subprocess.check_output(['git', 'show', args.baseline_ref + ':' + RUNTIME + name], cwd=ROOT)

    class Handler(Quiet):
        def do_GET(self):
            source = baseline.get(self.path.split('?')[0])
            if source is None:
                return super().do_GET()
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript')
            self.end_headers()
            self.wfile.write(source)

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}/{RUNTIME}'
    rows = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                args=['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'),
                      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            sizes = [(390, 844), (1440, 900)] if args.baseline else [(390, 844), (768, 1024), (1440, 900)]
            for width, height in sizes:
                context = browser.new_context(viewport={'width': width, 'height': height},
                    has_touch=width < 1000, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                row = {'viewport': [width, height], 'snapshots': [], 'frames': {}}
                if args.baseline:
                    row['baselineRef'] = subprocess.check_output(['git', 'rev-parse', args.baseline_ref], cwd=ROOT, text=True).strip()

                def capture(label, expected, paused):
                    page.wait_for_function('mode => __mall.mode === mode', arg=expected)
                    result = page.evaluate('''() => ({mode:__mall.mode, snapshot:__mall.state.mode,
                      body:document.body.dataset.mode, illegal:__mall.state.illegalCount,
                      paused:__mall.state.paused, layers:__mall.state.modeLayers})''')
                    assert result['mode'] == result['snapshot'] == result['body'] == expected, result
                    assert result['illegal'] == 0, (label, result, state(page)['modeHistory'])
                    assert result['paused'] == paused, (label, result)
                    row['snapshots'].append({'label': label, **result})
                    return state(page)

                def frames(label, paused):
                    before = state(page)['frames']
                    if paused:
                        page.wait_for_timeout(220)
                        assert state(page)['frames'] == before, (label, before, state(page)['frames'])
                    else:
                        page.wait_for_function('before => __mall.state.frames > before', arg=before)
                    row['frames'][label] = state(page)['frames'] - before

                def shot(label):
                    page.screenshot(path=str(args.output / f'{label}-{width}.png'))

                page.goto(url, timeout=60000)
                page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=60000)
                page.locator('#guide-dialog').wait_for(state='visible')
                if not args.baseline:
                    capture('first guide', 'menu', True)
                    frames('guide', True)
                page.locator('#guide-start').click()
                page.wait_for_function("!document.querySelector('#guide-dialog').open && document.activeElement.id === 'scene'")
                if not args.baseline:
                    capture('guide start', 'explore', False)
                    frames('explore', False)
                    shot('explore')
                    page.locator('#keyboard-help summary').click()
                    page.locator('#guide-reopen').click()
                    capture('guide reopened', 'menu', True)
                    handoff_history = state(page)['modeHistory']
                    page.locator('#guide-map').click()
                    page.wait_for_function("!document.querySelector('#guide-dialog').open && document.querySelector('#mall-map').open")
                    capture('guide Map handoff', 'menu' if width == 390 else 'explore', width == 390)
                    if width == 390:
                        assert state(page)['modeHistory'] == handoff_history, 'Blocking Menu handoff must not bounce through Explore'
                        page.keyboard.press('Escape')
                    page.locator('#keyboard-help summary').click()
                    page.locator('#guide-reopen').click()
                    capture('guide before List handoff', 'menu', True)
                    page.locator('#guide-list').click()
                    page.locator('#store-list').wait_for(state='visible')
                else:
                    page.locator('#view-toggle').click()
                if not args.baseline:
                    capture('directory', 'menu', True)
                buttons = page.locator('.product-card [data-inspect]')
                assert buttons.count() == 4
                for index in range(1 if args.baseline else 4):
                    buttons.nth(index).click()
                    if not args.baseline:
                        capture(f'product {index+1}', 'inspect', True)
                        frames(f'product {index+1}', True)
                        page.locator('#product-add').click()
                    page.locator('#product-close').click()
                    if not args.baseline:
                        capture(f'product {index+1} close', 'menu', True)
                        assert buttons.nth(index).evaluate('el => el === document.activeElement')
                if args.baseline:
                    row['directoryProductClose'] = {'mode': page.evaluate('__mall.mode'), 'illegal': state(page)['illegalCount']}
                else:
                    page.locator('#original-tin-open').click()
                    capture('original viewer', 'inspect', True)
                    page.wait_for_function('window.__originalTin?.state.loaded', timeout=15000)
                    frames('original viewer', True)
                    shot('original-viewer')
                    page.keyboard.press('Escape')
                    capture('original close', 'menu', True)
                    assert page.locator('#original-tin-open').evaluate('el => el === document.activeElement')
                    assert page.evaluate('__originalTin.state.activeResources') == 0
                    for close in ['button', 'escape']:
                        page.locator('#bag-open').click()
                        capture('directory Bag ' + close, 'shop', True)
                        assert page.locator('#bag-items li').count() == 4
                        close_bag(page, escape=close == 'escape')
                        capture('directory Bag return ' + close, 'menu', True)
                        page.wait_for_function("document.activeElement.id === 'bag-open'")

                page.locator('#view-toggle').click()
                if not args.baseline:
                    capture('directory exit', 'explore', False)
                    # Held keyboard plus injected input must both be cleared by a
                    # mode transition, including manual stepping left by tooling.
                    page.locator('#scene').focus()
                    page.keyboard.down('w')
                    page.evaluate('__mall.setInput({forward:1})')
                    page.locator('#bag-open').click()
                    capture('input interruption', 'shop', True)
                    paused_state = state(page)
                    page.evaluate('__mall.step(400)')
                    assert state(page)['z'] == paused_state['z']
                    close_bag(page)
                    capture('input resumed', 'explore', False)
                    page.wait_for_function("document.activeElement.id === 'bag-open'")
                    page.locator('#scene').focus()
                    stopped = state(page)
                    frames('input release resumes live frames', False)
                    page.wait_for_timeout(150)
                    assert abs(state(page)['z'] - stopped['z']) < .01
                    page.keyboard.up('w')
                    assert page.evaluate('document.activeElement.id') == 'scene'
                    page.keyboard.down('w')
                    page.wait_for_function('z => __mall.state.z < z - .1', arg=stopped['z'])
                    page.keyboard.up('w')

                if not args.baseline and width == 390:
                    page.evaluate('__mall.teleport("atrium"); __mall.setInput(null)')
                    page.locator('#scene').evaluate('''canvas => {
                      window.__modeTouchIds = [];
                      canvas.addEventListener('pointerdown', event => window.__modeTouchIds.push(event.pointerId), {once:true});
                    }''')
                    touch = context.new_cdp_session(page)
                    touch.send('Input.dispatchTouchEvent', {'type': 'touchStart',
                        'touchPoints': [{'x': 110, 'y': 470, 'id': 11}]})
                    touch.send('Input.dispatchTouchEvent', {'type': 'touchMove',
                        'touchPoints': [{'x': 140, 'y': 440, 'id': 11}]})
                    assert page.locator('#joystick').evaluate('el => el.classList.contains("is-floating")')
                    assert page.locator('#scene').evaluate('canvas => window.__modeTouchIds.some(id => canvas.hasPointerCapture(id))')
                    page.locator('#bag-open').click()
                    capture('held touch Bag interruption', 'shop', True)
                    assert not page.locator('#joystick').evaluate('el => el.classList.contains("is-floating")')
                    assert page.locator('.joystick-thumb').evaluate('el => el.style.transform') == ''
                    assert not page.locator('#scene').evaluate('canvas => window.__modeTouchIds.some(id => canvas.hasPointerCapture(id))')
                    close_bag(page)
                    capture('held touch Bag return', 'explore', False)
                    before = state(page)
                    touch.send('Input.dispatchTouchEvent', {'type': 'touchMove',
                        'touchPoints': [{'x': 150, 'y': 430, 'id': 11}]})
                    page.wait_for_timeout(120)
                    after = state(page)
                    assert abs(after['x'] - before['x']) < .01 and abs(after['z'] - before['z']) < .01
                    assert after['yaw'] == before['yaw']
                    touch.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                    touch.detach()
                    page.evaluate('delete window.__modeTouchIds')

                approach_seat(page)
                page.locator('#inspect').click()
                page.evaluate('__mall.step(40)')
                before = state(page)
                assert before['seated']
                page.locator('#bag-open').click()
                if not args.baseline:
                    capture('seated Bag', 'shop', True)
                    assert page.locator('#cart-toggle').is_disabled()
                    frames('seated Bag', True)
                close_bag(page, escape=True)
                page.wait_for_function("document.activeElement.id === 'bag-open'")
                if args.baseline:
                    row['seatedBagClose'] = {'mode': page.evaluate('__mall.mode'), 'seated': state(page)['seated'], 'illegal': state(page)['illegalCount']}
                else:
                    capture('seated Bag return', 'seated', False)
                    retained(before, state(page))
                    shot('seated-restored')
                    page.locator('#keyboard-help summary').click()
                    capture('seated help', 'menu' if width == 390 else 'seated', width == 390)
                    page.locator('#keyboard-help summary').click()
                    capture('seated help close', 'seated', False)
                    retained(before, state(page))
                    if width == 390:
                        page.locator('#header-map').click()
                        capture('seated map', 'menu', True)
                        page.keyboard.press('Escape')
                        capture('seated map close', 'seated', False)
                        retained(before, state(page))
                page.locator('#inspect').click()
                page.evaluate('__mall.step(100)')
                assert not state(page)['seated']
                page.evaluate('__mall.teleport("atrium"); __mall.setInput({right:-1}); __mall.step(500); __mall.setInput(null)')
                # The actual nearby kiosk action opens a persistent desktop map.
                assert state(page)['nearby'] == 'mall-directory'
                page.locator('#inspect').click()
                page.wait_for_function("document.querySelector('#mall-map').open")
                if args.baseline:
                    before_frames = state(page)['frames']
                    page.wait_for_timeout(250)
                    row['map'] = {'mode': page.evaluate('__mall.mode'), 'framesAdvanced': state(page)['frames'] - before_frames}
                    rows.append(row)
                    print(json.dumps(row), flush=True)
                    context.close()
                    continue
                compact = width == 390
                capture('kiosk map', 'menu' if compact else 'explore', compact)
                frames('map', compact)
                shot('map')
                if compact:
                    page.keyboard.press('Escape')
                    capture('map Escape', 'explore', False)
                    assert page.locator('#header-map').evaluate('el => el === document.activeElement')
                page.locator('#keyboard-help summary').click()
                capture('help', 'menu' if compact else 'explore', compact)
                frames('help', compact)
                # Native control focus still blocks keyboard gameplay even when
                # wide-screen help is intentionally nonmodal.
                page.get_by_role('combobox', name='Hair', exact=True).focus()
                before = state(page)
                page.keyboard.down('w')
                page.wait_for_timeout(120)
                page.keyboard.up('w')
                assert abs(state(page)['z'] - before['z']) < .01
                page.locator('#keyboard-help summary').click()
                capture('help close', 'explore', False)

                page.evaluate('__mall.teleport("atrium")')
                page.locator('#bag-open').click()
                activate_cart(page)
                capture('cart activate', 'cart', False)
                page.wait_for_function("document.activeElement.id === 'scene'")
                before = state(page)
                page.keyboard.down('s')
                page.wait_for_function('z => __mall.state.z > z + .1', arg=before['z'])
                page.keyboard.up('s')
                for close in ['button', 'escape']:
                    page.locator('#bag-open').click()
                    capture('cart Bag ' + close, 'shop', True)
                    before = state(page)
                    close_bag(page, escape=close == 'escape')
                    capture('cart Bag return ' + close, 'cart', False)
                    retained(before, state(page))
                    page.wait_for_function("document.activeElement.id === 'bag-open'")
                shot('cart-restored')
                if compact:
                    page.locator('#header-map').click()
                    capture('cart map', 'menu', True)
                    page.keyboard.press('Escape')
                    capture('cart map close', 'cart', False)
                page.locator('#bag-open').click()
                page.locator('#cart-toggle').click()
                capture('stow under Bag', 'shop', True)
                close_bag(page)
                capture('stowed return', 'explore', False)
                assert page.locator('#bag-open').inner_text() == 'Bag (4)'

                if compact:
                    # Compact -> wide leaves details.open unchanged. Its mode
                    # must still update. Returning compact follows resetMap's
                    # established collapsed-map policy and recovers hidden focus.
                    page.locator('#header-map').click()
                    capture('breakpoint compact map', 'menu', True)
                    page.set_viewport_size({'width': 1440, 'height': 900})
                    capture('breakpoint wide map still open', 'explore', False)
                    assert page.locator('#mall-map').evaluate('el => el.open')
                    frames('breakpoint wide running', False)
                    page.set_viewport_size({'width': 390, 'height': 844})
                    page.wait_for_function("!document.querySelector('#header-map').hidden && !document.querySelector('#mall-map').open")
                    capture('breakpoint compact collapsed', 'explore', False)
                    assert not page.locator('#mall-map').evaluate('el => el.open')
                    page.wait_for_function("document.activeElement.id === 'header-map'")
                    page.locator('#header-map').click()
                    capture('breakpoint reopen map', 'menu', True)
                    page.keyboard.press('Escape')
                    page.locator('#keyboard-help summary').click()
                    capture('breakpoint compact help', 'menu', True)
                    page.set_viewport_size({'width': 1440, 'height': 900})
                    capture('breakpoint wide help still open', 'explore', False)
                    frames('breakpoint wide help running', False)
                    page.set_viewport_size({'width': 390, 'height': 844})
                    capture('breakpoint compact help retained', 'menu', True)
                    page.keyboard.press('Escape')
                    capture('breakpoint help Escape', 'explore', False)
                    shot('breakpoint-restored')

                # Physical shelf ownership survives ordinary product/Bag overlays.
                page.evaluate("__mall.teleport('newmoon'); __mall.setInput({forward:1}); __mall.step(3900); __mall.setInput({forward:0})")
                page.get_by_role('button', name='Pick up product', exact=True).click()
                page.evaluate('__mall.step(1000)')
                held = state(page)['character']['physicalProduct']
                assert held['phase'] == 'held'
                page.locator('#inspect').click()
                capture('held product Shelf', 'shelf', True)
                shelf_details(page)
                capture('held product Inspect', 'inspect', True)
                page.locator('#product-close').click()
                capture('held product Inspect close', 'explore', False)
                page.locator('#bag-open').click()
                capture('held product Bag', 'shop', True)
                page.locator('#cart-toggle').click()
                assert not state(page)['pushing']
                close_bag(page)
                capture('held product Bag close', 'explore', False)
                assert state(page)['character']['physicalProduct'] == held
                page.get_by_role('button', name='Return to shelf', exact=True).click()
                page.evaluate('__mall.step(1000)')
                assert state(page)['character']['physicalProduct']['phase'] == 'empty'

                if compact:
                    # Exercise all published seat controls with overlays; player
                    # retains the eight authored routes and safety checks.
                    seats = state(page)['seats']
                    assert len(seats) == 8
                    row['seats'] = []
                    for index, seat in enumerate(seats):
                        if index < 4:
                            page.evaluate('__mall.teleport("atrium")')
                            if seat['facing'] == 1:
                                if seat['x'] < 0:
                                    approach_seat(page)
                                else:
                                    move(page, 10.5, 12)
                                    move(page, 10.5, seat['exitZ'])
                            else:
                                move(page, -2, seat['exitZ'])
                        else:
                            center = 0 if index < 6 else 10
                            page.evaluate('zone => __mall.teleport(zone)', 'mili' if index < 6 else 'gogo')
                            x = center + (-1.4 if seat['x'] < center else 1.4)
                            move(page, x, 2.4)
                            move(page, x, seat['exitZ'])
                        move(page, seat['exitX'], seat['exitZ'])
                        assert state(page)['nearby'] == seat['id']
                        page.locator('#inspect').click()
                        page.evaluate('__mall.step(40)')
                        before = capture(seat['id'], 'seated', False)
                        page.locator('#bag-open').click()
                        capture(seat['id'] + ' Bag', 'shop', True)
                        close_bag(page)
                        capture(seat['id'] + ' restored', 'seated', False)
                        retained(before, state(page))
                        page.locator('#inspect').click()
                        page.evaluate('__mall.step(100)')
                        assert not state(page)['seated']
                        row['seats'].append(seat['id'])
                assert not errors, errors
                row['errors'] = errors
                row['illegalCount'] = state(page)['illegalCount']
                row['history'] = state(page)['modeHistory']
                assert len(row['history']) <= 20
                rows.append(row)
                print(f'PASS lifecycle {width}x{height}: {len(row["snapshots"])} snapshots', flush=True)
                context.close()

            if not args.baseline:
                # Fresh legacy query context; use its genuine guide, directory,
                # product, Bag and scene handoff, without changing the default.
                context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
                page = context.new_page()
                page.goto(url + '?visitor=v1')
                page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=60000)
                page.locator('#guide-list').click()
                page.locator('.product-card [data-inspect]').first.click()
                page.locator('#product-add').click()
                page.locator('#product-close').click()
                page.locator('#view-toggle').click()
                page.locator('#bag-open').click()
                activate_cart(page)
                page.wait_for_function("__mall.mode === 'cart' && document.activeElement.id === 'scene'")
                assert state(page)['character']['model'] == 'gjh-mall-visitor'
                assert state(page)['illegalCount'] == 0
                rows.append({'legacyVisitorV1': 'PASS', 'illegalCount': 0})
                context.close()
            browser.close()
    except Exception:
        if 'page' in locals() and not page.is_closed():
            try:
                debug = page.evaluate('''() => ({focus:document.activeElement.id,
                  mode:window.__mall?.mode, state:window.__mall?.state})''')
                (args.output / 'failure.json').write_text(json.dumps(debug, indent=2))
                page.screenshot(path=str(args.output / 'failure.png'))
            except Exception:
                pass  # Preserve the original test failure if the browser already exited.
        raise
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    evidence = args.evidence or ROOT / 'docs/evidence' / ('v11-modes-baseline.json' if args.baseline else 'v11-modes-lifecycle.json')
    evidence.write_text(json.dumps(rows, indent=2) + '\n')
    print(f'Evidence: {evidence}', flush=True)


if __name__ == '__main__':
    run()
