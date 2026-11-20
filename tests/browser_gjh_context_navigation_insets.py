"""Software safe-area regression for V11's existing contextual navigation.

Uses the experimental Chrome DevTools Protocol command before navigation:
https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json
This does not certify physical notches, mobile Safari or screen readers.
"""
from gjh_menu_test_helpers import open_menu_page
import argparse
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import tempfile
import threading

from playwright.sync_api import Error, sync_playwright
from browser_gjh_guide import ROOT, Quiet
from browser_gjh_context_navigation import native_action, ready, focus_snapshot
from browser_gjh_mode_review import add_selection


PROFILES = [
    ('landscape', (667, 375), {'top': 20, 'bottom': 24, 'left': 30, 'right': 30}),
    ('portrait', (390, 844), {'top': 44, 'bottom': 34, 'left': 0, 'right': 0}),
]


def settle(page):
    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')


def geometry(page):
    return page.evaluate('''() => {
      const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
      const nav=document.querySelector('#context-navigation'), host=nav.parentElement;
      const r=rect('#context-navigation'), root=getComputedStyle(document.documentElement);
      return {header:rect('.site-header'), experience:rect('#experience'),
        panel:rect(document.querySelector('#mall-map').open?'.map-content':'#mall-tools-content'),
        nav:r, host:host.id,
        globalBottom:getComputedStyle(document.querySelector('#context-navigation-global')).bottom,
        headerBase:parseFloat(getComputedStyle(document.body).getPropertyValue('--gjh-header-size')),
        scrollPaddingBottom:parseFloat(root.scrollPaddingBottom)||0,
        bodyPaddingBottom:parseFloat(getComputedStyle(document.body).paddingBottom),
        count:document.querySelectorAll('nav[aria-label="Mall navigation"]').length,
        overflow:document.documentElement.scrollWidth>innerWidth,
        labels:[...nav.querySelectorAll('button')].map(e=>{
          const range=document.createRange();range.selectNodeContents(e);
          return {text:e.textContent,rect:range.getBoundingClientRect().toJSON(),button:e.getBoundingClientRect().toJSON()};}),
        controls:[...nav.querySelectorAll('button:enabled')].map(e=>{
          const b=e.getBoundingClientRect();return {id:e.id,rect:b.toJSON(),
            hit:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};})};
    }''')


def assert_nav(row, width, height, insets, global_host=False):
    assert row['count'] == 1 and not row['overflow'], row
    nav = row['nav']
    assert nav['top'] >= insets['top'] and nav['bottom'] <= height-insets['bottom']+1, row
    assert nav['left'] >= insets['left'] and nav['right'] <= width-insets['right']+1, row
    for control in row['controls']:
        assert control['rect']['width'] >= 44 and control['rect']['height'] >= 44 and control['hit'], row
    for label in row['labels']:
        assert label['rect']['left'] >= label['button']['left'] and label['rect']['right'] <= label['button']['right'], label
    if global_host:
        assert row['host'] == 'context-navigation-global', row
        assert abs(nav['bottom']-(height-insets['bottom'])) <= 1, row
        assert float(row['globalBottom'].removesuffix('px')) == insets['bottom'], row
        assert row['scrollPaddingBottom'] >= nav['height']+insets['bottom']+8, row


def keyboard_reach(page, selector, scroller, output=None):
    """Tab through content, requiring complete targets, labels and focus rings."""
    expected = page.locator(selector).count()
    assert expected > 0, selector
    seen, rows = set(), []
    # Map opening owns its initial focus; traverse back so even that first
    # destination is re-entered through an actual keyboard Tab and native scroll.
    page.keyboard.press('Shift+Tab')
    for _ in range(60):
        settle(page)
        active = page.locator(selector).evaluate_all('es=>es.indexOf(document.activeElement)')
        if active >= 0:
            row = page.locator(':focus').evaluate('''(e,s)=>{
              const r=e.getBoundingClientRect(),p=e.closest(s).getBoundingClientRect();
              const style=getComputedStyle(e),ring=parseFloat(style.outlineWidth)+Math.max(0,parseFloat(style.outlineOffset));
              const range=document.createRange();range.selectNodeContents(e);
              return {id:e.id || e.dataset.teleport || e.name,rect:r.toJSON(),scroller:p.toJSON(),ring,
                label:e.matches('[data-teleport]')?range.getBoundingClientRect().toJSON():null,
                scrollTop:e.closest(s).scrollTop,
                hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
            }''', scroller)
            assert row['hit'] and row['rect']['width'] >= 44 and row['rect']['height'] >= 44, row
            assert row['rect']['top']-row['ring'] >= row['scroller']['top']-1, row
            assert row['rect']['bottom']+row['ring'] <= row['scroller']['bottom']+1, row
            assert row['rect']['left']-row['ring'] >= row['scroller']['left']-1, row
            assert row['rect']['right']+row['ring'] <= row['scroller']['right']+1, row
            if row['label'] is not None:
                for edge in ['top', 'left']:
                    assert row['label'][edge] >= row['rect'][edge]-1, row
                for edge in ['bottom', 'right']:
                    assert row['label'][edge] <= row['rect'][edge]+1, row
            seen.add(active)
            rows.append(row)
            if output is not None:
                page.screenshot(path=str(output/f'map-keyboard-{row["id"]}.png'))
            if len(seen) == expected:
                return rows
        page.keyboard.press('Tab')
    raise AssertionError({'expected': expected, 'seen': sorted(seen)})


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--prefix', default='')
    parser.add_argument('--output', type=Path, default=Path(tempfile.gettempdir())/'gallery-context-nav-insets/run')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prefix = '/'+args.prefix.strip('/') if args.prefix.strip('/') else ''

    class Handler(Quiet):
        def do_GET(self):
            if prefix:
                if not self.path.startswith(prefix+'/'):
                    self.send_error(404)
                    return
                self.path = self.path[len(prefix):]
            super().do_GET()

    report = {'status': 'RUNNING', 'profiles': [], 'failures': [],
        'method': 'Emulation.setSafeAreaInsetsOverride',
        'protocolSource': 'https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json',
        'limits': 'Software CSS env override only; physical hardware, Safari and screen readers not verified.',
        'hashes': {str(p.relative_to(args.root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [args.root/'demos/corporate/gjh/v11/style.css', Path(__file__)] if p.is_relative_to(args.root)}}
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(args.root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                args=[f'--use-angle={os.environ.get("GALLERY_WEBGL_BACKEND", "metal")}'])
            report['browser'] = browser.version
            for name, (width, height), insets in PROFILES:
                context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True,
                    reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                row = {'name': name, 'viewport': [width, height], 'insets': insets, 'states': []}
                report['profiles'].append(row)
                try:
                    try:
                        context.new_cdp_session(page).send(report['method'], {'insets': insets})
                    except Error as error:
                        if 'wasn\'t found' in str(error) or 'Method not found' in str(error):
                            report['status'] = 'NOT_VERIFIED'
                            report['reason'] = str(error)
                            break
                        raise
                    ready(page, f'http://127.0.0.1:{server.server_port}{prefix}/demos/corporate/gjh/v11/')
                    settle(page)
                    assert page.locator('#guide-card').is_visible()
                    assert page.locator('#context-navigation').is_hidden()
                    page.screenshot(path=str(args.output/f'{name}-guide.png'))
                    page.locator('#guide-skip').click()
                    page.locator('#scene').focus()
                    page.locator('#header-map').click()
                    page.wait_for_function('__mall.mode === "menu"')
                    settle(page)
                    mapping = geometry(page)
                    row['states'].append({'name': 'map', **mapping})
                    page.screenshot(path=str(args.output/f'{name}-map.png'))
                    # Assert the override reached env(), rather than trusting CDP success.
                    assert mapping['header']['height'] == mapping['headerBase']+insets['top'], mapping
                    assert mapping['experience']['top'] == mapping['header']['bottom'], mapping
                    assert mapping['experience']['bottom'] == height-insets['bottom'], mapping
                    assert mapping['panel']['bottom'] <= mapping['nav']['top'], mapping
                    assert_nav(mapping, width, height, insets, True)
                    row['mapKeyboard'] = keyboard_reach(page, '[data-teleport]', '.map-content', args.output/name)
                    page.screenshot(path=str(args.output/f'{name}-map-keyboard.png'))
                    assert page.locator('.floorplan[role="img"]').get_attribute('aria-label') == (
                        'Mall floorplan. New Moon on the left, MILI in the centre and GOGO on the right. '
                        'The gold dot marks your position.')
                    assert page.locator('[data-teleport]').count() == 3
                    row['mapJourneys'] = []
                    for zone, label, expected_x in [('newmoon', 'New Moon', -10),
                            ('mili', 'MILI', 0), ('gogo', 'GOGO', 10)]:
                        target = page.locator(f'[data-teleport="{zone}"]')
                        assert target.get_attribute('aria-label') == f'Go to the {label} storefront'
                        # Use the actual Tab sequence and activation, not the teleport test API.
                        for _ in range(30):
                            if target.evaluate('e=>e===document.activeElement'):
                                break
                            page.keyboard.press('Tab')
                        assert target.evaluate('e=>e===document.activeElement')
                        page.keyboard.press('Enter')
                        page.wait_for_function('document.activeElement.id === "scene" && __mall.mode === "explore"')
                        actual = page.evaluate('__mall.step(17)')
                        assert abs(actual['x']-expected_x) < 1, actual
                        assert not page.locator('#mall-map').evaluate('e=>e.open')
                        assert page.locator('#context-navigation').is_hidden()
                        row['mapJourneys'].append({'zone': zone, 'x': actual['x'], 'focus': 'scene'})
                        page.screenshot(path=str(args.output/f'{name}-journey-{zone}.png'))
                        page.locator('#header-map').click()
                        page.wait_for_function('__mall.mode === "menu"')
                        settle(page)
                    page.locator('#bag-open').click()
                    settle(page)
                    bag = geometry(page)
                    row['states'].append({'name': 'map-bag', **bag})
                    page.screenshot(path=str(args.output/f'{name}-bag.png'))
                    assert_nav(bag, width, height, insets)
                    assert bag['host'] == 'context-navigation-bag', bag
                    native_action(page, '#bag-dialog', lambda: page.keyboard.press('Escape'))
                    assert page.evaluate('document.activeElement.id') == 'bag-open'
                    page.locator('#context-home').click()
                    open_menu_page(page, "controls")
                    page.wait_for_function('__mall.mode === "menu"')
                    settle(page)
                    help_row = geometry(page)
                    row['states'].append({'name': 'help', **help_row})
                    page.screenshot(path=str(args.output/f'{name}-help.png'))
                    assert page.locator('#context-navigation').is_hidden()
                    assert help_row['panel']['bottom'] <= height - insets['bottom'], help_row
                    row['helpKeyboard'] = keyboard_reach(page, '[data-menu-page=controls] [role=radio][tabindex="0"]', '#mall-tools-content')
                    page.screenshot(path=str(args.output/f'{name}-help-keyboard.png'))
                    close_menu(page)
                    page.locator('#view-toggle').click()
                    settle(page)
                    directory = geometry(page)
                    row['states'].append({'name': 'directory', **directory})
                    assert_nav(directory, width, height, insets, True)
                    assert directory['bodyPaddingBottom'] >= directory['nav']['height']+insets['bottom'], directory
                    add_selection(page)
                    page.locator('#bag-open').click()
                    settle(page)
                    assert_nav(geometry(page), width, height, insets)
                    native_action(page, '#bag-dialog', lambda: page.keyboard.press('Escape'))
                    lowest = page.locator('#store-list [data-inspect]').evaluate_all('es=>es.reduce((a,b)=>a.getBoundingClientRect().bottom>b.getBoundingClientRect().bottom?a:b).dataset.inspect')
                    row['inspectionReturns'] = []
                    for selector, dialog in [('#original-tin-open', '#original-tin-dialog'),
                            (f'#store-list [data-inspect="{lowest}"]', '#product-dialog')]:
                        page.evaluate('scrollTo({top:document.scrollingElement.scrollHeight,behavior:"instant"})')
                        page.locator(selector).focus()
                        settle(page)
                        before = focus_snapshot(page)
                        page.locator(selector).evaluate('e=>window.__insetOpener=e')
                        page.keyboard.press('Enter')
                        page.locator(dialog).wait_for(state='visible')
                        if dialog == '#original-tin-dialog':
                            page.wait_for_function('window.__originalTin?.state.loaded', timeout=60000)
                        assert page.locator('#context-navigation').is_hidden()
                        if name == 'landscape' and dialog == '#original-tin-dialog':
                            # Keep the override while the actual media query/RO layout changes.
                            page.set_viewport_size({'width': 320, 'height': 568})
                            page.wait_for_function('innerWidth===320 && matchMedia("(max-width:650px)").matches')
                        native_action(page, dialog, lambda: page.keyboard.press('Escape'))
                        settle(page)
                        after = focus_snapshot(page)
                        row['inspectionReturns'].append({'selector': selector, 'before': before, 'after': after})
                        viewport = page.viewport_size
                        assert_nav(geometry(page), viewport['width'], viewport['height'], insets, True)
                        assert page.evaluate('document.activeElement===__insetOpener')
                        assert after['hit'] and after['clear'] and not after['overflow'], after
                        page.screenshot(path=str(args.output/f'{name}-return-{dialog[1:]}.png'))
                        if name == 'landscape' and dialog == '#original-tin-dialog':
                            page.set_viewport_size({'width': width, 'height': height})
                            page.wait_for_function('innerWidth===667 && matchMedia("(orientation:landscape)").matches')
                            settle(page)
                    assert not errors, errors
                    row['pageErrors'] = errors
                except Exception as error:
                    report['failures'].append({'profile': name, 'error': str(error)})
                    page.screenshot(path=str(args.output/f'{name}-failure.png'))
                finally:
                    context.close()
            browser.close()
        if report['status'] != 'NOT_VERIFIED':
            report['status'] = 'FAIL' if report['failures'] else 'PASS'
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
        (args.output/'report.json').write_text(json.dumps(report, indent=2)+'\n')
        print(json.dumps(report, indent=2), flush=True)
    assert not report['failures'], report['failures']


if __name__ == '__main__':
    run()
