"""Portable real-Chrome acceptance for the single V11 contextual navigation node.

--root and --prefix also exercise a generated build mounted under a project prefix.
Only existing player test APIs steer gameplay; surface/mode visibility is never fabricated.
"""
from gjh_menu_test_helpers import open_menu_page
from gjh_startup_test_helpers import mall_entry_url
import argparse
import functools
import gzip
import hashlib
import http.server
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import tempfile
import threading

from playwright.sync_api import sync_playwright
from browser_gjh_guide import ROOT, Quiet, state
from browser_gjh_modes import approach_seat, close_bag, activate_cart, retained
from browser_gjh_mode_review import close_event_before_action, finish_close, lose_context, add_selection
from browser_gjh_accessibility import tab_dialog

RUNTIME = 'demos/corporate/gjh/v11/'
SIZES = [(320, 568), (390, 844), (667, 375), (768, 1024), (1440, 900),
         (650, 844), (651, 844), (359, 740), (361, 740), (844, 560), (844, 561)]


def native_action(page, selector, action):
    close_event_before_action(page, selector)
    action()
    finish_close(page)


def preserved(before, after):
    retained(before, after)
    # Vertical ground settling continues on resume; horizontal position must not move.
    for key in ['x', 'z']:
        assert abs(after[key] - before[key]) < 0.0001, (key, before[key], after[key])


def ready(page, url):
    page.goto(mall_entry_url(url), timeout=60000)
    page.wait_for_function('__mall?.ready && window.__sceneReady', timeout=60000)


def focus_snapshot(page):
    return page.evaluate("""() => {
      const e=document.activeElement,r=e.getBoundingClientRect(), f=document.querySelector('#context-navigation').getBoundingClientRect();
      const s=getComputedStyle(e),ring=parseFloat(s.outlineWidth)+Math.max(0,parseFloat(s.outlineOffset));
      return {focus:e.id || e.dataset.inspect,scrollY,rect:r.toJSON(),footer:f.toJSON(),ring,
        hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),
        clear:r.top-ring>=0 && r.bottom+Math.max(8,ring)<=f.top,
        overflow:document.documentElement.scrollWidth>innerWidth};
    }""")


def inspection_returns(browser, url, output):
    rows=[]
    for width,height in [(320,568),(390,844),(667,375)]:
        context=browser.new_context(viewport={'width':width,'height':height},has_touch=True,
            reduced_motion='reduce',service_workers='block')
        page=context.new_page()
        ready(page,url)
        if page.locator('#guide-card').is_visible():page.locator('#guide-skip').click()
        page.locator('#scene').focus()
        page.locator('#view-toggle').click()
        # Include the lowest reachable product/brand trigger, not just Original tin.
        lowest=page.locator('#store-list [data-inspect]').evaluate_all("es=>es.reduce((a,b)=>a.getBoundingClientRect().bottom>b.getBoundingClientRect().bottom?a:b).dataset.inspect")
        for selector,dialog,close in [('#original-tin-open','#original-tin-dialog','#original-tin-close'),
                (f'#store-list [data-inspect="{lowest}"]','#product-dialog','#product-close')]:
            for method in ['button','escape']:
                page.evaluate("scrollTo({top:document.scrollingElement.scrollHeight,behavior:'instant'})")
                opener=page.locator(selector)
                opener.focus()
                page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                before=focus_snapshot(page)
                opener.evaluate('e=>window.__expectedInspectOpener=e')
                page.keyboard.press('Enter')
                page.locator(dialog).wait_for(state='visible')
                if dialog=='#original-tin-dialog':
                    page.wait_for_function('window.__originalTin?.state.loaded',timeout=60000)
                assert page.locator('#context-navigation').is_hidden()
                opened=focus_snapshot(page)
                native_action(page,dialog,lambda:page.locator(close).click() if method=='button' else page.keyboard.press('Escape'))
                page.wait_for_function("!document.querySelector('#context-navigation').hidden")
                page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                after=focus_snapshot(page)
                print(json.dumps({'inspectionReturn':{'viewport':[width,height],'selector':selector,'method':method,'before':before,'open':opened,'after':after}}),flush=True)
                assert page.evaluate('document.activeElement===__expectedInspectOpener')
                assert after['hit'] and after['clear'] and not after['overflow'],after
                rows.append({'viewport':[width,height],'selector':selector,'method':method,'before':before,'open':opened,'after':after})
                page.screenshot(path=str(output/f'inspect-return-{width}-{lowest if dialog=="#product-dialog" else "tin"}-{method}.png'))
        # A current target already clear of the footer must not be scrolled.
        page.locator('#original-tin-open').evaluate("e=>e.scrollIntoView({block:'center',behavior:'instant'})")
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        no_scroll=page.evaluate("""()=>{const e=document.querySelector('#original-tin-open');const y=scrollY;e.focus({preventScroll:true});return y;}""")
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        assert page.evaluate('scrollY')==no_scroll
        # Change focus before the queued check: the old opener must not be pulled back.
        page.locator('#context-shops').focus()
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        page.evaluate("""()=>{document.querySelector('#original-tin-open').focus({preventScroll:true});
          scrollTo({top:0,behavior:'instant'});document.querySelector('#list-title').focus({preventScroll:true});}""")
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        assert page.evaluate('document.activeElement.id')=='list-title' and page.evaluate('scrollY')==0
        rows.append({'viewport':[width,height],'alreadyClearNoScroll':True,'queuedCurrentFocusIdentity':'list-title','queuedScrollY':0})
        if width==667:
            page.evaluate("scrollTo({top:document.scrollingElement.scrollHeight,behavior:'instant'})")
            page.locator('#original-tin-open').focus()
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            before=focus_snapshot(page)
            page.keyboard.press('Enter')
            page.wait_for_function('window.__originalTin?.state.loaded',timeout=60000)
            page.set_viewport_size({'width':320,'height':568})
            page.wait_for_function('innerWidth===320 && innerHeight===568')
            opened=focus_snapshot(page)
            native_action(page,'#original-tin-dialog',lambda:page.keyboard.press('Escape'))
            page.wait_for_function("!document.querySelector('#context-navigation').hidden")
            page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            after=focus_snapshot(page)
            assert after['focus']=='original-tin-open' and after['hit'] and after['clear'] and not after['overflow'],after
            rows.append({'resize':[667,375,320,568],'before':before,'open':opened,'after':after})
            page.screenshot(path=str(output/'inspect-return-667-to-320.png'))
        context.close()
    return rows


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--prefix', default='')
    parser.add_argument('--smoke', action='store_true')
    parser.add_argument('--output', type=Path, default=Path(tempfile.gettempdir()) / 'gallery-context-nav-worker/navigation')
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    prefix = '/' + args.prefix.strip('/') if args.prefix.strip('/') else ''

    class Handler(Quiet):
        def do_GET(self):
            if prefix:
                if not self.path.startswith(prefix + '/'):
                    self.send_error(404)
                    return
                self.path = self.path[len(prefix):]
            super().do_GET()

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(args.root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f'http://127.0.0.1:{server.server_port}{prefix}/{RUNTIME}'
    rows, failures = [], []
    backend = os.environ.get('GALLERY_WEBGL_BACKEND', 'metal')
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                args=[f'--use-angle={backend}', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            version = browser.version
            for width, height in ([(390, 844), (1440, 900)] if args.smoke else SIZES):
                context = browser.new_context(viewport={'width': width, 'height': height},
                    has_touch=width < 1000, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                errors, requests = [], []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('request', lambda request: requests.append(request.url))
                ready(page, url)
                page.add_script_tag(path=str(ROOT / 'tests/gjh_contrast.js'))
                row = {'viewport': [width, height], 'states': [], 'focusPaths': {}}

                def outline():
                    result = page.locator('#context-shops').evaluate('''e => {
                      const s=getComputedStyle(e), n=getComputedStyle(e.closest('nav'));
                      return {color:s.outlineColor, background:n.backgroundColor,
                        style:s.outlineStyle, width:parseFloat(s.outlineWidth)};
                    }''')
                    def luminance(color):
                        channels = [float(v) / 255 for v in re.findall(r'[\d.]+', color)[:3]]
                        return sum(w * (c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4)
                            for w, c in zip([.2126, .7152, .0722], channels))
                    light, dark = sorted([luminance(result['color']), luminance(result['background'])], reverse=True)
                    result['ratio'] = (light + .05) / (dark + .05)
                    assert result['width'] >= 2 and result['style'] != 'none' and result['ratio'] >= 3, result
                    return result


                def check(label, visible, host=None, screenshot=True):
                    page.wait_for_function('expected => !document.querySelector("#context-navigation").hidden === expected', arg=visible)
                    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
                    result = page.evaluate('''() => {
                      const nav=document.querySelector('#context-navigation'), r=nav.getBoundingClientRect();
                      const buttons=[...nav.querySelectorAll('button')];
                      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
                      return {count:document.querySelectorAll('#context-navigation').length,
                        landmarks:document.querySelectorAll('nav[aria-label="Mall navigation"]').length,
                        mode:__mall.mode, paused:__mall.state.paused, illegal:__mall.state.illegalCount,
                        host:nav.parentElement.id, hidden:nav.hidden, rect:rect(nav),
                        reserve:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--context-navigation-height')),
                        destination:document.querySelector('#experience').hidden?'context-shops':'context-home',
                        current:buttons.filter(e=>e.hasAttribute('aria-current')).map(e=>({id:e.id,value:e.getAttribute('aria-current')})),
                        labels:buttons.map(e=>e.textContent), disabled:buttons.map(e=>e.disabled),
                        controls:buttons.map(e=>({id:e.id,visible:!!e.getClientRects().length,rect:rect(e),background:getComputedStyle(e).backgroundColor,contrast:gjhContrast(e),
                          hit:e.contains(document.elementFromPoint(e.getBoundingClientRect().x+e.clientWidth/2,e.getBoundingClientRect().y+e.clientHeight/2))})),
                        notes:[...nav.querySelectorAll('p:not([hidden])')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent,contrast:gjhContrast(e)})),
                        overflow:document.documentElement.scrollWidth>innerWidth,
                        modal:document.querySelector('dialog[open]')?.id,
                        focus:document.activeElement.id};
                    }''')
                    assert result['count'] == result['landmarks'] == 1, result
                    assert result['illegal'] == 0 and not result['overflow'], result
                    assert result['current'] == [{'id':result['destination'],'value':'page'}],result
                    assert result['labels'] == ['Home', 'Shops', 'Events', 'Rewards', 'Profile']
                    assert result['disabled'][1:] == [False, True, True, True]
                    if visible:
                        assert result['mode'] in ['menu', 'shop'] and result['host'] == host, result
                        assert result['controls'][0]['background'] != result['controls'][1]['background'],result
                        assert result['rect']['y'] >= 0 and result['rect']['bottom'] <= height + 1, result
                        assert result['rect']['right'] <= width + 1, result
                        visible_controls = [control for control in result['controls'] if control['visible']]
                        assert len(visible_controls) >= 2
                        for control in visible_controls:
                            assert control['rect']['width'] >= 44 and control['rect']['height'] >= 44 and control['hit'], (label, control)
                            assert control['contrast']['minimumRatio'] >= 4.5, (label, control)
                        assert max(c['rect']['width'] for c in visible_controls) - min(c['rect']['width'] for c in visible_controls) < 1
                        for note in result['notes']:
                            assert note['contrast']['minimumRatio'] >= 4.5, (label, note)
                        if host == 'context-navigation-global':
                            if page.locator('#experience').is_visible():
                                assert result['reserve'] >= result['rect']['height']
                            else:
                                assert page.locator('#context-navigation-global').evaluate('e => getComputedStyle(e).position') == 'relative'
                        else:
                            assert result['reserve'] == 0, result
                            assert page.locator(f'#{result["modal"]} #context-navigation').count() == 1
                    else:
                        assert result['rect']['height'] == 0 and result['reserve'] == 0, result
                        assert not result['focus'].startswith('context-'), result
                    row['states'].append({'label': label, **result})
                    if screenshot:
                        page.screenshot(path=str(args.output / f'{label}-{width}x{height}.png'))
                    return result

                assert page.locator('#guide-card').is_visible()
                check('guide', False)
                page.locator('#guide-skip').click()
                page.locator('#scene').focus()
                check('explore', False)
                compact = width <= 650 or height <= 560
                if compact:
                    page.locator('#header-map').click()
                    result = check('map', True, 'context-navigation-global')
                    panel = page.locator('.map-content').bounding_box()
                    assert panel['y'] + panel['height'] <= result['rect']['y'], (panel, result)
                    for button in page.locator('[data-teleport]').all():
                        button.focus()
                        page.evaluate('() => new Promise(requestAnimationFrame)')
                        assert button.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}'), button.evaluate('e=>({rect:e.getBoundingClientRect().toJSON(),scroll:e.closest(".map-content").scrollTop,hit:document.elementFromPoint(e.getBoundingClientRect().x+e.clientWidth/2,e.getBoundingClientRect().y+e.clientHeight/2)?.outerHTML})')
                    page.locator('#bag-open').click()
                    check('map-bag', True, 'context-navigation-bag')
                    close_bag(page)
                    assert page.evaluate('document.activeElement.id') == 'bag-open'
                    check('map-after-bag', True, 'context-navigation-global')
                    before = state(page)
                    page.locator('#context-home').focus()
                    page.keyboard.press('Enter')
                    page.wait_for_function('__mall.mode === "explore"')
                    preserved(before, state(page))
                    check('map-home', False)
                    # Home also owns its destination focus when touch activation
                    # starts from Scene and setView(true) has no transition to run.
                    page.locator('#header-map').click()
                    page.locator('#scene').focus()
                    before=state(page)
                    box=page.locator('#context-home').bounding_box()
                    page.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
                    page.wait_for_function('document.activeElement.id === "scene" && __mall.mode === "explore"')
                    preserved(before,state(page))
                    check('map-home-touch',False)
                else:
                    assert not page.locator('#mall-map').evaluate('e=>e.open')
                    page.locator('#header-map').click()
                    check('wide-map-live', False)
                    page.locator('#header-map').click()
                open_menu_page(page, "controls")
                check('menu covers navigation', False)
                fields = page.locator('#controls-copy select')
                for field in fields.all():
                    field.focus()
                    assert field.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
                open_menu_page(page, 'guide')
                page.locator('#guide-reopen').focus()
                assert page.locator('#guide-reopen').evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
                page.locator('#guide-reopen').click()
                page.locator('#guide-card').wait_for(state='visible')
                check('reopened-guide', False)
                page.locator('#view-toggle').click()
                page.wait_for_function('document.activeElement.id === "list-title"')
                check('directory', True, 'context-navigation-global')
                page.locator('#context-shops').focus()
                row['focusOutline'] = outline()
                page.locator('#original-tin-open').focus()
                assert page.locator('#original-tin-open').evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
                page.locator('.site-footer a').focus()
                footer_link = page.locator('.site-footer a').bounding_box()
                assert page.locator('.site-footer a').first.evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}'), footer_link
                page.screenshot(path=str(args.output / f'directory-bottom-{width}x{height}.png'))
                page.locator('#context-shops').click()
                heading = page.locator('#list-title').bounding_box()
                assert 0 <= heading['y'] and heading['y'] + heading['height'] < height
                assert page.evaluate('document.activeElement.id') == 'list-title'
                page.locator('.product-card [data-inspect]').first.click()
                check('directory-inspect', False)
                page.locator('#product-add').click()
                native_action(page, '#product-dialog', lambda: page.locator('#product-close').click())
                page.locator('#original-tin-open').click()
                check('original-tin', False)
                native_action(page, '#original-tin-dialog', lambda: page.locator('#original-tin-close').click())
                for sku in ['au-425g', 'sa-425g', 'mx-454g']:
                    page.locator(f'[data-inspect="new-moon-{sku}-front"]').click()
                    page.locator('#product-add').click()
                    native_action(page, '#product-dialog', lambda: page.locator('#product-close').click())
                page.locator('#bag-open').click()
                check('populated-bag', True, 'context-navigation-bag')
                row['focusPaths']['bag'] = tab_dialog(page, '#bag-dialog')
                row['bagHeaderMeasurements'] = []
                for position in [0, .5, 1]:
                    page.locator('.bag-scroll').evaluate('(e,p)=>e.scrollTop=p*e.scrollHeight', position)
                    shell = page.locator('.bag-scroll').bounding_box()
                    header = page.locator('.bag-top').bounding_box()
                    close = page.locator('#bag-close').bounding_box()
                    footer = page.locator('#context-navigation').bounding_box()
                    title = page.locator('.bag-top h2').bounding_box()
                    row['bagHeaderMeasurements'].append({'position':position,'shell':shell,'header':header,'title':title,'close':close,'footer':footer})
                    assert title['y'] >= shell['y'] and title['y']+title['height'] <= shell['y']+shell['height'], (position,title,shell)
                    assert title['y'] >= header['y'] and title['y']+title['height'] <= header['y']+header['height'], (position,title,header)
                    assert header['y'] >= shell['y'] - 1, (position, shell, header)
                    if position > 0:
                        assert abs(header['y'] - shell['y']) < 1, (position, shell, header)
                    assert close['y'] >= shell['y'] and close['y'] + close['height'] <= shell['y'] + shell['height'], (position, close, shell)
                    assert shell['y'] + shell['height'] <= footer['y'] + 1, (shell, footer)
                    for selector in ['#bag-close', '#context-home', '#context-shops']:
                        assert page.locator(selector).evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}'), (position, selector)
                    page.screenshot(path=str(args.output / f'bag-scroll-{position}-{width}x{height}.png'))
                page.locator('#bag-clear').focus()
                assert page.locator('#bag-clear').evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}')
                native_action(page, '#bag-dialog', lambda: page.locator('#context-shops').click())
                page.wait_for_function('document.activeElement.id === "list-title"')
                assert page.locator('#bag-open').inner_text() == 'Bag (4)'
                page.locator('#context-home').click()
                check('directory-home', False)
                # Stable per-frame projections cause no DOM mutation or focus churn.
                page.evaluate('''() => {window.__navMutations=0;window.__navObserver=new MutationObserver(r=>__navMutations+=r.length);
                  __navObserver.observe(document.querySelector('#context-navigation'),{subtree:true,attributes:true,childList:true});}''')
                page.wait_for_timeout(150)
                assert page.evaluate('__navMutations') == 0
                page.evaluate('__navObserver.disconnect();delete window.__navObserver;delete window.__navMutations')
                nav_requests = [r for r in requests if r.endswith('/context-navigation.js')]
                bundle_requests = [r for r in requests if r.endswith('/script.bundle.js')]
                assert not nav_requests and len(bundle_requests) == 1, (nav_requests, bundle_requests)
                assert not errors, errors
                row.update({'pageErrors': errors, 'componentRequests': len(nav_requests), 'startupBundleRequests': len(bundle_requests)})
                rows.append(row)
                context.close()

            if not args.smoke:
                rows.append({'inspectionReturnRegression':inspection_returns(browser,url,args.output)})
                # Actual retained base/camera state, using existing real gameplay APIs.
                for base in ['explore', 'seated', 'cart']:
                    context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                        reduced_motion='reduce', service_workers='block')
                    page = context.new_page()
                    ready(page, url)
                    if page.locator('#guide-card').is_visible():page.locator('#guide-skip').click()
                    page.locator('#scene').focus()
                    page.locator('#view-toggle').click()
                    add_selection(page)
                    page.locator('#context-home').click()
                    assert page.locator('#bag-open').inner_text() == 'Bag (1)'
                    if base == 'seated':
                        approach_seat(page)
                        page.locator('#inspect').click()
                        page.wait_for_function('__mall.state.seated')
                    elif base == 'cart':
                        page.locator('#bag-open').click()
                        activate_cart(page)
                        page.wait_for_function('__mall.state.pushing')
                    for surface in ['map', 'help', 'bag']:
                        before = state(page)
                        if surface == 'map':
                            page.locator('#header-map').click()
                        elif surface == 'help':
                            open_menu_page(page, "controls")
                        else:
                            page.locator('#bag-open').click()
                        if surface == 'help':
                            assert page.locator('#context-navigation').is_hidden()
                            close_menu(page)
                            page.wait_for_function('expected=>__mall.mode===expected', arg=base)
                            preserved(before, state(page))
                            continue
                        page.wait_for_function('!document.querySelector("#context-navigation").hidden')
                        assert page.locator('#context-home').get_attribute('aria-current') == 'page'
                        assert page.locator('#context-navigation [aria-current]').count() == 1
                        page.evaluate('__mall.setInput({forward:1})')
                        if surface == 'bag':
                            native_action(page, '#bag-dialog', lambda: page.locator('#context-home').click())
                        else:
                            page.locator('#context-home').click()
                        page.wait_for_function('expected=>__mall.mode===expected', arg=base)
                        preserved(before, state(page))
                        assert page.locator('#bag-open').inner_text() == 'Bag (1)'
                        page.wait_for_timeout(100)
                        preserved(before, state(page))
                    page.locator('#bag-open').click()
                    native_action(page, '#bag-dialog', lambda: page.locator('#context-shops').click())
                    page.wait_for_function('document.activeElement.id === "list-title"')
                    assert not state(page)['seated'] and not state(page)['pushing']
                    rows.append({'base': base, 'homePreservedMapHelpBag': True, 'shopsStandStow': True})
                    context.close()

                context = browser.new_context(viewport={'width': 650, 'height': 844}, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                ready(page, url)
                if page.locator('#guide-card').is_visible():page.locator('#guide-skip').click()
                page.locator('#scene').focus()
                page.locator('#header-map').click()
                page.locator('#context-home').focus()
                page.set_viewport_size({'width': 651, 'height': 844})
                page.wait_for_function('!matchMedia("(max-width:650px)").matches && __mall.mode === "explore"')
                page.wait_for_function('document.activeElement.id === "scene"')
                assert not page.locator('#context-navigation').is_visible()
                page.set_viewport_size({'width': 650, 'height': 844})
                page.wait_for_function('matchMedia("(max-width:650px)").matches')
                page.locator('#header-map').click()
                page.locator('#bag-open').click()
                page.locator('#context-shops').focus()
                for size in [(651, 844), (320, 568), (667, 375), (390, 844)]:
                    page.set_viewport_size({'width': size[0], 'height': size[1]})
                    page.wait_for_function('size=>innerWidth===size[0]&&innerHeight===size[1]', arg=size)
                    page.wait_for_function('document.querySelector("#context-navigation").parentElement.id === "context-navigation-bag"')
                    assert page.locator('#context-navigation').count() == 1
                    assert page.evaluate('document.activeElement.id') == 'context-shops'
                close_bag(page)
                rows.append({'resize650To651OwnFocus': 'scene', 'openBagResize': 'PASS'})
                context.close()

                # Context loss while already in directory + Bag: the setView early-return case.
                context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                ready(page, url)
                if page.locator('#guide-card').is_visible():page.locator('#guide-skip').click()
                page.locator('#scene').focus()
                page.locator('#view-toggle').click()
                add_selection(page)
                page.locator('#bag-open').click()
                page.locator('#context-home').focus()
                selection = page.evaluate('sessionStorage.getItem("gjh-v11-demo-bag-v1")')
                lose_context(page)
                page.wait_for_function('document.querySelector("#context-home").disabled && document.activeElement.id === "context-shops"')
                assert page.locator('#context-home-note').is_visible()
                assert page.locator('#context-shops').get_attribute('aria-current') == 'page'
                assert page.locator('#context-navigation [aria-current]').count() == 1
                assert page.locator('#bag-dialog').evaluate('e=>e.open')
                # Synthetic stale activation explicitly tests the handler guard, not a real pointer click.
                page.locator('#context-home').evaluate('e=>e.dispatchEvent(new MouseEvent("click",{bubbles:true}))')
                assert page.locator('#bag-dialog').evaluate('e=>e.open')
                assert page.evaluate('sessionStorage.getItem("gjh-v11-demo-bag-v1")') == selection
                assert page.locator('#cart-controls').is_hidden() and page.locator('#cart-toggle').is_disabled()
                page.screenshot(path=str(args.output / 'directory-bag-context-loss-390.png'))
                rows.append({'actualWEBGLLoss': 'PASS', 'syntheticStaleHomeClick': 'guarded', 'ownFocusRecovery': 'context-shops', 'bagSelectionPreserved': True})
                context.close()

                context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                blocked = []
                def fail_cart(route):
                    blocked.append(route.request.url)
                    route.abort()
                page.route('**/shopping-cart.glb', fail_cart)
                ready(page, url)
                assert page.locator('#context-home').is_enabled()
                assert blocked and not state(page)['character']['cart']['available']
                rows.append({'optionalCartFailureReadyHome': True, 'blockedCartRequests': len(blocked)})
                context.close()
            browser.close()
    except Exception as error:
        failures.append(str(error))
        raise
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
        sources = ['assets/context-navigation.js', 'assets/ui.js', 'script.js', 'script.bundle.js', 'style.css', 'index.html', 'assets/demo-bag.js']
        overhead = {}
        for name in sources:
            data = (ROOT / RUNTIME / name).read_bytes()
            old = b'' if name in ('assets/context-navigation.js', 'script.bundle.js') else subprocess.check_output(['git', 'show', '6a1f31c:' + RUNTIME + name], cwd=ROOT)
            overhead[name] = {'baselineBytes': len(old), 'bytes': len(data), 'deltaBytes': len(data)-len(old),
                'baselineGzipBytes': len(gzip.compress(old)) if old else 0, 'gzipBytes': len(gzip.compress(data))}
        served_hashes = {name: hashlib.sha256((args.root / RUNTIME / name).read_bytes()).hexdigest() for name in sources}
        source_hashes = {name: hashlib.sha256((ROOT / RUNTIME / name).read_bytes()).hexdigest() for name in sources}
        assert served_hashes == source_hashes, 'Served artifact does not match the reviewed source'
        report = {'environment': f'{platform.system()} {platform.machine()} Chrome {locals().get("version", "unknown")} / {backend}',
            'root': str(args.root), 'prefix': prefix, 'sourceSHA256': source_hashes, 'servedSHA256': served_hashes,
            'payload': overhead, 'newComponentRequests': 0, 'componentDelivery': 'startup JavaScript bundle', 'newGLBTextureFontGPUObjects': 0,
            'results': rows, 'failures': failures,
            'limits': ['Browser emulation; no physical device, real safe-area inset or screen-reader session',
                'Parent owns independent visual taste acceptance and release/generator checks']}
        (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        if args.evidence:
            args.evidence.parent.mkdir(parents=True, exist_ok=True)
            args.evidence.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'viewports': len([r for r in rows if 'viewport' in r]), 'groups': len(rows), 'failures': failures}))


if __name__ == '__main__':
    run()
