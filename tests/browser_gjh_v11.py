"""Exercise free walking, physical boundaries and accessible mall fallbacks in Chrome."""
import argparse
import functools
import http.server
import importlib.util
import json
import os
import tempfile
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demos/corporate/gjh/v11'
ARGS = ['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass


def targets(page):
    small = page.locator('a,button,summary,[tabindex="0"]').evaluate_all('''els => els.filter(el => {
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      return r.width && r.height && s.visibility!=='hidden' && (r.width<43.9 || r.height<43.9);
    }).map(el=>({text:el.textContent.trim(),width:el.clientWidth,height:el.clientHeight}))''')
    assert not small, small
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')


def mobile_hud(page):
    overlaps = page.locator('.site-header,#keyboard-help,#mall-map>summary,.map-content,#joystick,#run-toggle,#inspect-prompt').evaluate_all('''els => {
      const visible=els.map(el=>({name:el.id || el.className,rect:el.getBoundingClientRect()}))
        .filter(({rect:r})=>r.width && r.height);
      return visible.flatMap((a,i)=>visible.slice(i+1).filter(b=>
        a.rect.left<b.rect.right && a.rect.right>b.rect.left &&
        a.rect.top<b.rect.bottom && a.rect.bottom>b.rect.top
      ).map(b=>[a.name,b.name]));
    }''')
    assert not overlaps, overlaps


def state(page):
    return page.evaluate('window.__mall.state')


def drive(page, ms, **inputs):
    # Manual physics steps can submit frames much faster than SwiftShader draws
    # them. Wait for the actual GPU work instead of accumulating it until the
    # next screenshot. Keep the same DPR, frames, assertions and 30s deadline.
    return page.evaluate('''async ([input,ms]) => {
      __mall.setInput(input);
      const state = __mall.step(ms);
      const gl = document.querySelector('#scene').getContext('webgl2');
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) throw Error('Could not create render-completion fence');
      gl.flush();
      const start = performance.now();
      try {
        while (true) {
          const status = gl.clientWaitSync(sync, 0, 0);
          if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) break;
          if (status === gl.WAIT_FAILED || performance.now() - start > 30000)
            throw Error('Render-completion fence failed or timed out');
          await new Promise(resolve => setTimeout(resolve, 8));
        }
      } finally { gl.deleteSync(sync); }
      return state;
    }''', [inputs, ms])


def keyboard_turning(page):
    """Actual held keys turn camera/avatar without manufacturing translation."""
    page.evaluate('__mall.teleport("atrium"); __mall.setInput(null)')
    page.locator('#scene').focus()
    before = state(page)
    page.keyboard.down('q')
    left = page.evaluate('__mall.step(300)')
    page.keyboard.up('q')
    assert left['yaw'] > before['yaw'] + .5 and left['facing'] > before['facing'] + .3, left
    assert abs(left['x']-before['x']) < .01 and abs(left['z']-before['z']) < .01, left
    released = page.evaluate('__mall.step(200)')
    assert abs(released['yaw']-left['yaw']) < 1e-8
    page.keyboard.down('e')
    right = page.evaluate('__mall.step(300)')
    page.keyboard.up('e')
    assert right['yaw'] < left['yaw']-.5 and right['facing'] < left['facing']-.2, right
    assert abs(right['x']-before['x']) < .01 and abs(right['z']-before['z']) < .01
    page.keyboard.down('q'); page.keyboard.down('e')
    cancelled = page.evaluate('__mall.step(200)')
    page.keyboard.up('q'); page.keyboard.up('e')
    assert abs(cancelled['yaw']-right['yaw']) < 1e-8
    page.keyboard.down('w'); page.keyboard.down('q'); page.keyboard.down('Shift')
    moving = page.evaluate('__mall.step(300)')
    page.keyboard.up('w'); page.keyboard.up('q'); page.keyboard.up('Shift')
    assert moving['yaw'] > cancelled['yaw']+.5 and moving['z'] < cancelled['z']-.5, moving
    assert moving['animation'] == 'run', moving
    # Native controls and modifier shortcuts must not become game input.
    page.locator('#view-toggle').focus()
    page.keyboard.down('e')
    focused = page.evaluate('__mall.step(100)')
    page.keyboard.up('e')
    assert focused['yaw'] == moving['yaw']
    page.locator('#scene').focus()
    page.keyboard.down('Control'); page.keyboard.down('q')
    modified = page.evaluate('__mall.step(100)')
    page.keyboard.up('q'); page.keyboard.up('Control')
    assert modified['yaw'] == focused['yaw']
    page.keyboard.down('q')
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    blurred = page.evaluate('__mall.step(100)')
    page.keyboard.up('q')
    assert blurred['yaw'] == modified['yaw']
    page.evaluate('__mall.teleport("atrium"); __mall.setInput({})')
    drive(page, 17)


def room_signs(page):
    """Visible room plaques must clear the mobile HUD, including expanded controls."""
    if page.viewport_size['width'] != 390:
        return
    rectangles = page.locator('.site-header,#keyboard-help,#mall-map').evaluate_all(
        'els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})')
    for sign in state(page)['roomSigns']:
        if not sign['visible']:
            continue
        for rect in rectangles:
            assert not (sign['left'] < rect['right'] + 8 and sign['right'] > rect['left'] - 8
                        and sign['top'] < rect['bottom'] + 8 and sign['bottom'] > rect['top'] - 8), (sign, rect)


def run(capture=False):
    spec = importlib.util.spec_from_file_location('gallery', ROOT / 'scripts/build_gallery.py')
    gallery = importlib.util.module_from_spec(spec); spec.loader.exec_module(gallery)
    review = Path(tempfile.mkdtemp(prefix='gjh-v11-review-'))
    evidence = []
    with tempfile.TemporaryDirectory(prefix='gjh-v11-artifact-') as temp:
        output = Path(temp) / 'gallery'; gallery.build(output)
        handler = functools.partial(QuietHandler, directory=temp)
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        url = base + '/gallery/demos/corporate/gjh/v11/'
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=ARGS)
                try:
                    for width, height in ((1440, 900), (768, 1024), (390, 844)):
                        context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=2, has_touch=width<1000)
                        page = context.new_page(); errors = []; external = []
                        page.on('pageerror', lambda e: errors.append(str(e)))
                        page.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
                        page.on('request', lambda r: external.append(r.url) if r.url.startswith('http') and not r.url.startswith(base) else None)
                        page.goto(url); page.wait_for_function('window.__mall?.ready && window.__sceneReady')
                        # Drain the initial frame before capturing a frozen scene.
                        drive(page, 0)
                        initial = state(page); assert initial['drawCalls'] <= 200, initial
                        draw_calls = {'atrium': initial['drawCalls']}
                        max_draw_calls = initial['drawCalls']
                        assert initial['pixelRatio'] <= (1.5 if width<600 else 2)
                        targets(page)
                        if width == 390:
                            mall_map = page.locator('#mall-map')
                            mobile_hud(page)
                            assert not mall_map.evaluate('el=>el.open')
                            page.locator('#keyboard-help summary').click()
                            page.locator('#mall-map summary').click()
                            page.wait_for_function('!document.querySelector("#keyboard-help").open')
                            assert mall_map.evaluate('el=>el.open')
                            targets(page)
                            mobile_hud(page)
                            # Full labels must fit within distinct, usable store targets.
                            assert page.locator('.map-store-button').evaluate_all('''els=>els.every(el=>{
                              const range=document.createRange();range.selectNodeContents(el);
                              const text=range.getBoundingClientRect(),box=el.getBoundingClientRect();
                              return text.left>=box.left && text.right<=box.right &&
                                text.top>=box.top && text.bottom<=box.bottom;
                            })''')
                            page.screenshot(path=str(review / 'map-390.png'), scale='css')
                            page.keyboard.press('Escape')
                            assert not mall_map.evaluate('el=>el.open')
                            assert page.locator('#mall-map summary').evaluate('el=>el===document.activeElement')
                        page.screenshot(path=str(review / f'atrium-{width}.png'), scale='css')
                        room_signs(page)
                        page.locator('#mall-map').evaluate('el=>el.open=true')
                        page.evaluate('__mall.step(17)')
                        room_signs(page)
                        page.screenshot(path=str(review / f'map-{width}.png'), scale='css')
                        if width == 390:
                            page.locator('#mall-map').evaluate('el=>el.open=false')
                        if capture:
                            (DEMO / 'screenshots').mkdir(exist_ok=True)
                            page.screenshot(path=str(DEMO / f'screenshots/{width}.png'), scale='css')
                        keyboard_turning(page)
                        # Real keyboard input exercises the same capsule controller as deterministic input.
                        page.evaluate('__mall.setInput(null)'); page.locator('#scene').focus()
                        before = state(page); page.keyboard.down('w')
                        page.wait_for_function('z=>__mall.state.z<z-.12', arg=before['z'])
                        page.keyboard.up('w'); page.evaluate('__mall.setInput({})')
                        assert state(page)['z'] < before['z']-.1
                        if width < 1000:
                            page.evaluate('__mall.teleport("atrium");__mall.setInput(null)')
                            joystick = page.locator('#joystick').bounding_box()
                            x = joystick['x'] + joystick['width']/2
                            y = joystick['y'] + joystick['height']/2
                            cdp = context.new_cdp_session(page)
                            cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
                            cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y-30,'id':1}]})
                            page.wait_for_function('window.__mall.state.z < 11.85')
                            cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y-30,'id':1},{'x':width-60,'y':height*.5,'id':2}]})
                            cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y-30,'id':1},{'x':width-110,'y':height*.5,'id':2}]})
                            page.wait_for_function('Math.abs(__mall.state.yaw)>.1')
                            cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                            page.locator('#run-toggle').click()
                            assert page.locator('#run-toggle').get_attribute('aria-pressed')=='true'
                            page.locator('#run-toggle').click()
                            page.evaluate('__mall.setInput({})')
                        page.evaluate('__mall.teleport("atrium")')
                        moved = drive(page, 800, right=1)
                        assert moved['x'] > before['x'] + 1.7 and moved['animation']=='walk', moved
                        page.screenshot(path=str(review / f'walking-{width}.png'), scale='css')
                        draw_calls['walking'] = moved['drawCalls']
                        ran = drive(page, 300, right=1, run=True)
                        assert ran['animation']=='run' and ran['x'] > moved['x']+1.2, ran
                        # Repeated high-speed steps cannot tunnel through the outer wall.
                        stopped = drive(page, 6000, right=1, run=True)
                        assert 14 < stopped['x'] < 14.6, stopped
                        stopped_again = drive(page, 1000, right=1, run=True)
                        assert abs(stopped_again['x']-stopped['x']) < .03
                        drive(page, 100)
                        assert state(page)['animation']=='idle'
                        for zone in ('newmoon', 'mili', 'gogo'):
                            if width == 390:
                                page.locator('#mall-map summary').click()
                            page.locator(f'[data-teleport="{zone}"]').click()
                            if width == 390:
                                assert not page.locator('#mall-map').evaluate('el=>el.open')
                            page.evaluate('__mall.setInput({})')
                            assert abs(state(page)['x']-{'newmoon':-10,'mili':0,'gogo':10}[zone])<.05
                            opened = drive(page, 400)
                            assert opened['doors'][zone] > .99, opened
                            draw_calls[f'{zone}-portal'] = opened['drawCalls']
                            room_signs(page)
                            page.screenshot(path=str(review / f'{zone}-portal-{width}.png'), scale='css')
                            # Enter through a real opening; then strafe around the gathering table.
                            for _ in range(15):
                                inside = drive(page, 100, forward=1)
                                max_draw_calls = max(max_draw_calls, inside['drawCalls'])
                                room_signs(page)
                            assert inside['zone']==zone and inside['z'] < -.5, inside
                            draw_calls[zone] = inside['drawCalls']
                            page.screenshot(path=str(review / f'{zone}-{width}.png'), scale='css')
                            label = next(label for label in inside['roomSigns'] if label['zone'] == zone)
                            if width >= 768:
                                header_bottom = page.locator('.site-header').bounding_box()['height']
                                assert label['visible'] and label['top'] >= header_bottom + 8, label
                                assert 0 <= label['left'] < label['right'] <= width, label
                            else:
                                # Close entry framing used to put all three plaques under HUD buttons.
                                assert not label['visible'], label
                                for control in ('#keyboard-help', '#mall-map'):
                                    page.locator(control).evaluate('el=>el.open=true')
                                    drive(page, 17)
                                    room_signs(page)
                                    page.locator(control).evaluate('el=>el.open=false')
                            if zone == 'newmoon':
                                drive(page, 300, right=-1)
                                near = drive(page, 2300, forward=1)
                            else:
                                drive(page, 450, right=-1)
                                drive(page, 2300, forward=1)
                                near = drive(page, 500, right=1)
                            assert near['nearby'], near
                            draw_calls[f'{zone}-interior'] = near['drawCalls']
                            page.screenshot(path=str(review / f'{zone}-interior-{width}.png'), scale='css')
                            room_signs(page)
                            page.locator('#scene').focus()
                            page.keyboard.down('e')
                            turning_near = page.evaluate('__mall.step(100)')
                            page.keyboard.up('e')
                            assert not page.locator('#product-dialog').is_visible()
                            assert turning_near['yaw'] < near['yaw']-.1
                            page.keyboard.press('f'); assert page.locator('#product-dialog').is_visible()
                            assert page.locator('#product-dialog a').count()==1
                            assert page.locator('#product-dialog a').get_attribute('href')=='https://www.gjheshop.com/'
                            paused = state(page)
                            page.keyboard.down('q')
                            page.evaluate('__mall.step(100)')
                            page.keyboard.up('q')
                            assert state(page)['yaw'] == paused['yaw']
                            drive(page, 500, forward=1, run=True)
                            assert state(page)['z']==paused['z']
                            page.keyboard.press('Tab')
                            assert page.locator('#product-dialog').evaluate('el=>el.contains(document.activeElement)')
                            targets(page)
                            if width == 390:
                                mobile_hud(page)
                            page.screenshot(path=str(review / f'{zone}-panel-{width}.png'), scale='css')
                            page.keyboard.press('Escape'); assert not page.locator('#product-dialog').is_visible()
                        # Drag camera changes orbit without moving the player.
                        before = state(page); box=page.locator('#scene').bounding_box()
                        page.mouse.move(box['x']+box['width']*.6, box['y']+box['height']*.5)
                        page.mouse.down(); page.mouse.move(box['x']+box['width']*.8, box['y']+box['height']*.55, steps=6); page.mouse.up()
                        assert abs(state(page)['yaw']-before['yaw'])>.1
                        page.locator('#view-toggle').click(); assert page.locator('#store-list').is_visible()
                        assert page.locator('.product-card').count()==4; targets(page)
                        page.locator('#view-toggle').click(); assert page.locator('#scene').is_visible()
                        assert not errors, errors
                        assert not external, external
                        draw_calls['max'] = max(max_draw_calls, *draw_calls.values())
                        assert max(draw_calls.values()) <= 200, draw_calls
                        evidence.append({'width':width, 'drawCalls':initial['drawCalls'], 'drawCallsByView':draw_calls, 'walkingCollisionDoorsInspection':'PASS', 'keyboardTurningAndFInspection':'PASS', 'errors':errors})
                        context.close()
                    context = browser.new_context(reduced_motion='reduce')
                    page = context.new_page(); page.goto(url); page.wait_for_function('window.__mall?.ready')
                    page.evaluate('__mall.setInput({});__mall.teleport("mili");__mall.step(17)')
                    assert state(page)['reducedMotion'] and state(page)['doors']['mili']==1
                    count = state(page)['frames']
                    page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"))')
                    page.wait_for_timeout(120); assert state(page)['frames']==count
                    page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))')
                    page.locator('#scene').evaluate('el=>el.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
                    page.wait_for_selector('#store-list', state='visible'); context.close()
                    for failure in ('webgl', 'wasm', 'nojs'):
                        context = browser.new_context(java_script_enabled=failure!='nojs', viewport={'width':390,'height':844})
                        if failure=='webgl':
                            context.add_init_script('const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:get.call(this,t,...a)}')
                        elif failure=='wasm':
                            context.add_init_script('WebAssembly.instantiate=async()=>{throw new Error("Physics denied")};WebAssembly.instantiateStreaming=WebAssembly.instantiate')
                        page=context.new_page(); page.goto(url)
                        if failure!='nojs': page.wait_for_function('window.__sceneFailed===true')
                        assert page.locator('#store-list').is_visible()
                        assert page.locator('.product-card').count()==4
                        assert page.locator('#mili-title').is_visible() and page.locator('#gogo-title').is_visible()
                        if failure=='wasm': assert 'WebAssembly' in page.locator('#fallback-message').inner_text()
                        targets(page); context.close()
                    evidence.append({'reducedMotion':'PASS','hiddenPause':'PASS','contextLoss':'PASS','WebGLAndWasmFailure':'PASS','noJS':'PASS','review':str(review)})
                finally:
                    browser.close()
        finally:
            server.shutdown(); server.server_close(); thread.join()
    if capture:
        with Image.open(DEMO / 'screenshots/1440.png') as image:
            image.resize((720,450)).save(DEMO / 'assets/thumbnail.webp', quality=88)
    print(json.dumps(evidence, indent=2))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', action='store_true')
    run(parser.parse_args().capture)
