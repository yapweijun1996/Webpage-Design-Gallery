"""Exercise free walking, physical boundaries and accessible mall fallbacks in Chrome."""
from gjh_menu_test_helpers import open_menu_page
import argparse
import functools
import hashlib
import http.server
import importlib.util
import json
import os
import tempfile
import threading
from pathlib import Path
import time
import math

from PIL import Image
from playwright.sync_api import sync_playwright
from gjh_shelf_helpers import shelf_details

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demos/corporate/gjh/v11'
ARGS = ['--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'), '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

# createWorld awaits the WebP brand cover, including when the page preloads it.
# Hold that transfer so screenshots capture a genuinely incomplete load.
LOADER_TEXTURE = '/gallery/demos/corporate/gjh/v11/assets/mili-brand-cover.webp'
loader_request = threading.Event()
loader_release = threading.Event()
hold_loader_texture = False


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.split('?')[0] == LOADER_TEXTURE and hold_loader_texture:
            loader_request.set()
            loader_release.wait(90)
        super().do_GET()

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass


def targets(page):
    small = page.locator('a,button,summary,[tabindex="0"]').evaluate_all('''els => els.filter(el => {
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      return el.checkVisibility() && r.width && r.height && s.visibility!=='hidden' && (r.width<43.9 || r.height<43.9);
    }).map(el=>({text:el.textContent.trim(),width:el.clientWidth,height:el.clientHeight}))''')
    assert not small, small
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')


def mobile_hud(page):
    overlaps = page.locator('.site-header,#mall-tools,#mall-map>summary,.map-content,#joystick,#run-toggle,#inspect-prompt,#guide-card,.control-bar').evaluate_all('''els => {
      // Closed details retain descendant layout boxes in current Chrome; those
      // boxes are not painted map content. Mode-suppressed walking controls also
      // retain boxes. Check every painted open-map/control rectangle.
      const visible=els.filter(el=>getComputedStyle(el).visibility!=='hidden' &&
        (!el.matches('.map-content') || el.closest('details').open))
        .map(el=>({name:el.id || el.className,rect:el.getBoundingClientRect()}))
        .filter(({rect:r})=>r.width && r.height);
      return visible.flatMap((a,i)=>visible.slice(i+1).filter(b=>
        a.rect.left<b.rect.right && a.rect.right>b.rect.left &&
        a.rect.top<b.rect.bottom && a.rect.bottom>b.rect.top
      ).map(b=>[a.name,b.name]));
    }''')
    assert not overlaps, overlaps


def dismiss_tutorial(page):
    page.locator('#app-loader').wait_for(state='hidden', timeout=90000)
    page.locator('#guide-card').wait_for(state='visible')
    page.locator('#guide-skip').click()
    page.wait_for_function("document.querySelector('#guide-card').hidden && !__mall.state.paused")
    page.locator('#scene').focus()


def ux_hud_coverage(browser, url):
    results = []
    output = Path.home() / 'omp-tasks/out'
    output.mkdir(parents=True, exist_ok=True)
    for width, height in ((1440, 900), (390, 844)):
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      has_touch=width == 390, service_workers='block')
        page = context.new_page()
        page.goto(url)
        page.wait_for_function('window.__sceneReady && window.__mall?.ready')
        card = page.locator('#guide-card')
        card.wait_for(state='visible')
        assert not state(page)['paused']
        assert page.locator('#guide-count').inner_text() == '1/3'
        assert page.locator('.ux-tutorial-segment').count() == 3
        assert page.locator('#guide-back').is_disabled()
        bounds = card.bounding_box()
        assert bounds['width'] <= (300 if width > 650 else width - 24), bounds
        page.locator('#app-loader').wait_for(state='hidden')
        assert bounds['y'] >= height / 2, bounds
        assert not page.locator('#control-interact').is_visible()
        assert page.locator('#floor-indicator').inner_text() == 'Floor 01 - Atrium'
        assert page.locator('#mini-map').is_hidden()
        assert page.locator('#header-map').is_visible()
        assert not page.locator('#mall-map').evaluate('el=>el.open')
        assert page.locator('#mall-tools').is_visible()
        assert page.locator('#keyboard-help').is_hidden()
        assert page.locator('.control-bar').is_hidden()
        assert 'inventory' in page.locator('#bag-open').get_attribute('aria-label')
        if width == 390:
            mobile_hud(page)
        page.screenshot(path=str(output / f'ux1-{width}.png'), scale='css')
        before = state(page)
        page.locator('#scene').focus()
        page.keyboard.down('w')
        page.wait_for_function('z=>__mall.state.z<z-.15', arg=before['z'])
        page.keyboard.up('w')
        page.wait_for_function("document.querySelector('#guide-count').textContent==='2/3'")
        page.locator('#guide-back').click()
        assert page.locator('#guide-count').inner_text() == '1/3'
        page.locator('#guide-next').click()
        assert page.locator('#guide-count').inner_text() == '2/3'
        box = page.locator('#scene').bounding_box()
        x, y = box['x'] + box['width'] * .4, box['y'] + box['height'] * .45
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 90, y, steps=8)
        page.mouse.up()
        page.wait_for_function("document.querySelector('#guide-count').textContent==='3/3'")
        assert page.evaluate('__mall.teleport("mili")')
        assert drive(page, 1000)['doors']['mili'] > .99
        # Use the onboarding approach around the table to the MILI display.
        for x, z in ((1.4, -3.5), (1.4, -7.8), (0, -7.8)):
            walk_to(page, x, z)
        drive(page, 17)
        assert state(page)['nearby'] == 'mili'
        assert page.locator('#inspect').is_visible()
        assert 'Nearest:' in page.locator('#nearest-target').inner_text()
        page.locator('#scene').focus()
        page.keyboard.press('f')
        page.wait_for_function("document.querySelector('#guide-card').hidden")
        drive(page, 1000)
        peak = max(before['drawCalls'], state(page)['drawCalls'])
        assert peak <= 200, peak
        page.reload()
        page.wait_for_function('window.__sceneReady && window.__mall?.ready')
        page.locator('#app-loader').wait_for(state='hidden', timeout=90000)
        assert card.is_hidden()
        page.locator('#mall-tools').click()
        page.locator('#rail-guide').click()
        page.locator('#guide-reopen').click()
        card.wait_for(state='visible')
        page.locator('#guide-next').click()
        page.locator('#guide-skip').click()
        page.reload()
        page.wait_for_function('window.__sceneReady && window.__mall?.ready')
        page.locator('#app-loader').wait_for(state='hidden', timeout=90000)
        assert card.is_hidden()
        results.append({'viewport': [width, height], 'tutorialActionsAndPersistence': 'PASS',
                        'drawCalls': peak, 'screenshot': str(output / f'ux1-{width}.png')})
        context.close()
    return results


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

def walk_to(page, x, z, precise=False):
    for _ in range(160):
        current = state(page)
        dx, dz = x - current['x'], z - current['z']
        distance = math.hypot(dx, dz)
        if distance < (.003 if precise else .07):
            drive(page, 17)
            return
        speed = min(1, distance / .15) if precise else 1
        duration = max(17, min(450, distance / (2.65 * speed) * 1000))
        drive(page, duration, forward=-dz / distance * speed, right=dx / distance * speed, yaw=0)
    raise AssertionError(('Unreached upper-deck waypoint', x, z, state(page)))


def hero_visibility_gallery(page, width, height):
    """Measure the rendered display fixture and visitor in each planned bay."""
    setback = .48
    assert page.evaluate('__mall.teleport("entry")')
    walk_to(page, 32, 42)
    walk_to(page, 32, 3)
    results = []

    def measure(number, x, z, yaw):
        walk_to(page, x, z)
        drive(page, 500, yaw=yaw, pitch=.1)
        page.wait_for_function(
            'n => { const v=__mall.heroVisibility(n); return v && v.loaded && v.hero && v.avatar; }',
            arg=number, timeout=30000)
        # A frame after loading activates the real model in the nearest bay.
        drive(page, 100, yaw=yaw, pitch=.1)
        sample = page.evaluate('n => __mall.heroVisibility(n)', number)
        hero, avatar = sample['hero'], sample['avatar']
        assert sample['loaded'] and hero and avatar, (number, sample)
        assert hero['inFront'] and avatar['inFront'], (number, sample)
        assert 0 <= hero['left'] < hero['right'] <= width, (number, sample)
        assert 0 <= hero['top'] < hero['bottom'] <= height, (number, sample)
        assert (hero['right'] <= avatar['left'] or avatar['right'] <= hero['left']
                or hero['bottom'] <= avatar['top'] or avatar['bottom'] <= hero['top']), (number, sample)
        coverage = (hero['right']-hero['left'])*(hero['bottom']-hero['top'])/(width*height)
        assert coverage >= .04, (number, coverage, sample)
        assert state(page)['drawCalls'] <= 200, (number, state(page)['drawCalls'])
        row = {'shop':f'S{number:02}', 'viewport':[width,height], 'coverage':round(coverage, 5),
               'hero':hero, 'avatar':avatar}
        results.append(row)
        print(json.dumps(row), flush=True)

    # Match the contact-sheet camera pose in each window.
    for number in (4, 5):
        center = -10 + (number-1)*10
        measure(number, center+3-2.4, setback, -.2)
    for number in range(12, 18):
        center_z = (number-12)*8+4
        measure(number, 35-setback, center_z+2.55-2.4, -math.pi/2-.2)
    walk_to(page, 32, 43)
    walk_to(page, -12, 43)
    for number in range(11, 5, -1):
        center_z = (number-6)*8+4
        measure(number, -15+setback, center_z-2.55+2.4, math.pi/2-.2)
    return results


def install_npc_budget_probe(page, cap):
    """Observe real renderer submissions, not just the application's last counter."""
    page.evaluate('''async cap => {
      const T = await import('./vendor/three.module.min.js');
      const probe = window.__npcBudgetProbe = {
        cap, enabled:false, label:'setup', frames:[], errors:[], pending:[], queued:false
      };
      const originalScene = T.Scene.prototype.onBeforeRender;
      const wrappedMeshes = new WeakSet(), instrumented = new WeakSet();
      const check = (ok, message, frame) => {
        if (!ok) probe.errors.push({message, frame});
      };
      function finishFrame() {
        probe.queued=false;
        const submissions=probe.pending.splice(0);
        if (!probe.enabled || !submissions.length) return;
        // Run after the entire synchronous step/HUD/rAF callback, once the
        // application has committed this frame's admission and budget state.
        const s=__mall.state, b=s.renderBudget, n=s.npcs;
        const world=submissions.filter(p=>p.scene===s.graphics.sceneId);
        const npc=world.filter(p=>p.mask===4);
        const total=submissions.reduce((sum,p)=>sum+p.calls,0);
        const npcCalls=npc.reduce((sum,p)=>sum+p.calls,0);
        const frame={label:probe.label, tier:s.graphics.quality.tier,
          active:n?.active, admitted:n?.admitted, visible:n?.visible,
          perNPC:n?.callsPerNpc, nonNPC:total-npcCalls, npcCalls, total,
          bloom:b?.bloom, y:s.y, elevatorTravel:s.elevatorTravel,
          renderedNPCs:npc.flatMap(p=>p.visitors).length,
          submissions:submissions.map(({visitors,...p})=>p)};
        probe.frames.push(frame);
        check(Boolean(b), 'Missing renderBudget telemetry', frame);
        check(Number.isInteger(total) && total<=200, 'Actual frame exceeds 200 calls', frame);
        check(s.drawCalls===total, 'drawCalls omits renderer submissions', frame);
        check(n?.limit===cap && n.active<=cap && n.active>=0,
          'Simulation exceeds requested tier cap', frame);
        check(Number.isInteger(n?.admitted) && n.admitted>=0 &&
          n.admitted<=n.active && n.visible===n.admitted,
          'Invalid admission/visibility count', frame);
        if (!b) return;
        const expectedBloom=s.graphics.quality.tier==='detailed' &&
          innerWidth>=1000 && Math.abs(s.y)<5;
        check(b.bloom===expectedBloom, 'Incorrect tier/floor Bloom path', frame);
        check(b.totalCalls===total && b.nonNpcCalls===total-npcCalls &&
          b.npcCalls===npcCalls && b.admitted===n.admitted,
          'Budget telemetry differs from observed rendering', frame);
        const submissionCount=Array.isArray(b.submissions)?b.submissions.length:b.submissions;
        check(submissionCount===submissions.length, 'Submission telemetry mismatch', frame);
        const expected=[1,...(b.bloom?[2]:[]),...(n.admitted>0?[4]:[])];
        check(JSON.stringify(world.map(p=>p.mask))===JSON.stringify(expected),
          'Repeated full-world submission or incorrect layer masks', frame);
        const post=submissions.filter(p=>p.scene!==s.graphics.sceneId);
        check(post.length===(b.bloom?2:0) && (!b.bloom ||
          (post[0].name==='Mall glow filter' && post[1].name==='Mall glow composite' &&
            submissions.at(-1)===post[1])),
          'Bloom requires one filter and one final composite', frame);
        check(npc.every(p=>!p.autoClear && !p.shadowAutoUpdate && !p.background),
          'NPC overlay clears the base/depth or updates shadows', frame);
        check(npcCalls<=n.admitted*n.callsPerNpc,
          'NPC template underestimates real draw calls', frame);
      }
      T.Scene.prototype.onBeforeRender=function(renderer,...args) {
        if (!instrumented.has(renderer)) {
          instrumented.add(renderer);
          probe.rendererObserved=true;
          const originalRender=renderer.render;
          renderer.render=function(scene,camera) {
            const before=this.info.render.calls, autoReset=this.info.autoReset;
            const submission={scene:scene.uuid,name:scene.name,mask:camera.layers.mask,
              autoClear:this.autoClear,shadowAutoUpdate:this.shadowMap.autoUpdate,
              background:scene.background!==null,visitors:[]};
            probe.current=submission;
            const result=originalRender.call(this,scene,camera);
            submission.calls=this.info.render.calls-(autoReset?0:before);
            probe.current=null;
            if (probe.enabled) {
              probe.pending.push(submission);
              if (!probe.queued) {probe.queued=true;queueMicrotask(finishFrame);}
            }
            return result;
          };
        }
        // A mesh callback proves the visitor was actually submitted through the
        // camera/frustum tests; admitted-but-offscreen visitors do not qualify.
        this.traverse(node=>{
          if (!node.isMesh || !(node.layers.mask&4) || wrappedMeshes.has(node)) return;
          wrappedMeshes.add(node);
          const original=node.onBeforeRender;
          node.onBeforeRender=function(renderer,scene,camera,...rest) {
            const current=probe.current;
            if (current?.mask===4) {
              let root=this;
              while(root.parent && root.parent!==scene) root=root.parent;
              const center=root.getWorldPosition(new T.Vector3());
              const feet=center.clone().project(camera);
              const head=center.clone().add(new T.Vector3(0,1.7,0)).project(camera);
              const height=Math.abs(head.y-feet.y)*innerHeight/2;
              if (feet.z>-1 && feet.z<1 && Math.abs(feet.x)<.9 &&
                feet.y>-.9 && head.y<.9 && height>=32 &&
                !current.visitors.includes(root.uuid)) current.visitors.push(root.uuid);
            }
            return original.call(this,renderer,scene,camera,...rest);
          };
        });
        return originalScene.call(this,renderer,...args);
      };
      // The discovery callback runs inside the first render; only start
      // recording after its renderer wrapper is installed for complete frames.
      __mall.setInput({});__mall.step(0);
      await Promise.resolve();
      if (!probe.rendererObserved) throw Error('No renderer observed during probe setup');
      probe.enabled=true;
    }''', cap)


def npc_budget_frames(page):
    result = page.evaluate('''() => ({
      frames:__npcBudgetProbe.frames, errors:__npcBudgetProbe.errors
    })''')
    assert not result['errors'], result['errors'][:3]
    assert result['frames'], 'No complete rendered frames observed'
    return result['frames']


def npc_budget_sweep(page, label):
    page.evaluate('label=>__npcBudgetProbe.label=label', label)
    start = len(npc_budget_frames(page)) if page.evaluate('__npcBudgetProbe.frames.length') else 0
    # In addition to a full orbit, jump directly across the expensive view:
    # the admission decision must use this frame, not yesterday's camera cost.
    before = drive(page, 17, yaw=0)
    sudden = drive(page, 17, yaw=math.pi)
    assert abs(sudden['yaw'] - math.pi) < 1e-6, sudden['yaw']
    assert abs(sum(a*b for a,b in zip(before['camera']['quaternion'], sudden['camera']['quaternion']))) < .1, (before['camera'], sudden['camera'])
    for index in range(25):
        drive(page, 17, yaw=-math.pi + index * math.tau / 24)
    drive(page, 17, yaw=0)
    frames = npc_budget_frames(page)[start:]
    assert frames, label
    current = state(page)
    row = {'npcBudgetState':label, 'width':page.viewport_size['width'],
           'tier':current['graphics']['quality']['tier'],
           'cap':current['npcs']['limit'], 'active':current['npcs']['active'],
           'admitted':current['npcs']['admitted'],
           'nonNPC':current['renderBudget']['nonNpcCalls'],
           'perNPC':current['npcs']['callsPerNpc'],
           'total':current['renderBudget']['totalCalls'],
           'sweepMax':max(frame['total'] for frame in frames),
           'nonNPCRange':[min(frame['nonNPC'] for frame in frames), max(frame['nonNPC'] for frame in frames)],
           'admittedRange':[min(frame['admitted'] for frame in frames), max(frame['admitted'] for frame in frames)],
           'npcCallsMax':max(frame['npcCalls'] for frame in frames),
           'renderedFrames':len(frames)}
    print(json.dumps(row), flush=True)
    return row


def npc_budget_screenshot(page, width):
    """Find real admitted visitors from real walking positions; never spawn fixtures."""
    tutorial = page.locator('[data-ob-action="skip"]')
    if tutorial.is_visible():
        tutorial.click()
    assert page.evaluate('__mall.teleport("atrium")')
    best = 0
    # These are the same clear atrium/lift-approach corridors as the deck route.
    for point in ((10, 12), (10, 5.5), (0, 5.5), (-6.4, 5.5)):
        walk_to(page, *point)
        for _ in range(56):
            drive(page, 17, yaw=0)
        for index in range(32):
            drive(page, 17, yaw=-math.pi + index * math.tau / 32, pitch=.1)
            frame = npc_budget_frames(page)[-1]
            best = max(best, frame['renderedNPCs'])
            if frame['renderedNPCs'] >= 2:
                destination = Path.home() / 'omp-tasks/out' / f'npc2-{width}.png'
                destination.parent.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(destination), scale='css')
                return {'path':str(destination), 'renderedNPCs':frame['renderedNPCs'],
                        'admitted':frame['admitted'], 'total':frame['total']}
    raise AssertionError(('No atrium frame with several visible real NPCs', width, best))


def npc_budget_coverage(browser, url):
    results = []
    for width, height in ((1440, 900), (390, 844)):
        for tier in ('low', 'balanced', 'detailed'):
            cap = ({'low':1, 'balanced':2, 'detailed':3} if width < 1000
                   else {'low':2, 'balanced':4, 'detailed':6})[tier]
            context = browser.new_context(viewport={'width':width, 'height':height},
                                          device_scale_factor=2, has_touch=width<1000, reduced_motion='reduce')
            context.add_init_script(
                f"localStorage.setItem('gjh-v11-graphics-quality-v1', {json.dumps(tier)});")
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            try:
                page.goto(url)
                page.wait_for_function('window.__mall?.ready && window.__sceneReady', timeout=90000)
                assert page.evaluate('document.body.classList.contains("is-expanded")')
                assert state(page)['graphics']['quality']['tier'] == tier
                dismiss_tutorial(page)
                install_npc_budget_probe(page, cap)
                assert page.evaluate('__mall.teleport("atrium")')
                for _ in range(56):
                    drive(page, 17)
                assert state(page)['npcs']['active'] > 0, state(page)['npcs']
                rows = [npc_budget_sweep(page, 'atrium')]
                for zone in ('newmoon', 'mili', 'gogo'):
                    assert page.evaluate('zone=>__mall.teleport(zone)', zone)
                    for _ in range(16):
                        opened = drive(page, 75, yaw=0)
                    assert opened['doors'][zone] > .99, opened['doors']
                    rows.append(npc_budget_sweep(page, f'{zone}-open'))
                    assert page.evaluate('__mall.teleport("atrium")')
                    for _ in range(16):
                        closed = drive(page, 75, yaw=0)
                    assert closed['doors'][zone] == 0, closed['doors']
                    rows.append(npc_budget_sweep(page, f'{zone}-closed'))
                screenshot = npc_budget_screenshot(page, width) if tier == 'detailed' else None
                # Reduced motion makes yaw/door changes truly instantaneous;
                # restore motion for a real, observable ride between floors.
                page.emulate_media(reduced_motion='no-preference')
                assert page.evaluate('__mall.teleport("atrium")')
                for point in ((10, 5.5), (-6.4, 5.5), (-6.4, 10)):
                    walk_to(page, *point)
                assert state(page)['nearby'] == 'visitor-elevator', state(page)
                assert any(word in page.locator('#inspect').inner_text().lower()
                           for word in ('ride', 'call'))
                page.evaluate('__npcBudgetProbe.label="elevator-travel"')
                page.locator('#inspect').click()
                travel = []
                for _ in range(65):
                    current = drive(page, 100, yaw=0)
                    if current['elevatorTravel']:
                        travel.append(current)
                    if current['y'] > 7.1 and not current['elevatorTravel']:
                        break
                assert travel and any(.2 < item['y'] < 7 for item in travel), travel
                assert abs(current['y'] - 7.2) < .1 and not current['elevatorTravel'], current
                frames = npc_budget_frames(page)
                lift_frames = [frame for frame in frames if frame['label']=='elevator-travel']
                moving = [frame for frame in lift_frames
                          if frame['elevatorTravel'] and .2 < frame['y'] < 7]
                assert moving, lift_frames
                in_motion = moving[len(moving) // 2]
                lift_row = {'npcBudgetState':'elevator-travel', 'width':width,
                            'tier':tier, 'cap':cap,
                            'active':in_motion['active'], 'admitted':in_motion['admitted'],
                            'nonNPC':in_motion['nonNPC'], 'perNPC':in_motion['perNPC'],
                            'total':in_motion['total'],
                            'sweepMax':max(frame['total'] for frame in lift_frames),
                            'admittedRange':[min(frame['admitted'] for frame in lift_frames if frame['elevatorTravel']),
                                             max(frame['admitted'] for frame in lift_frames if frame['elevatorTravel'])],
                            'nonNPCRange':[min(frame['nonNPC'] for frame in lift_frames if frame['elevatorTravel']),
                                           max(frame['nonNPC'] for frame in lift_frames if frame['elevatorTravel'])],
                            'movingFrames':sum(frame['elevatorTravel'] for frame in lift_frames)}
                assert lift_row['movingFrames'] > 0, lift_row
                print(json.dumps(lift_row), flush=True)
                rows.append(lift_row)
                page.wait_for_function('__mall.state.brandPlaqueCount===17', timeout=10000)
                page.emulate_media(reduced_motion='reduce')
                rows.append(npc_budget_sweep(page, 'upper-deck'))
                frames = npc_budget_frames(page)
                if tier == 'detailed' and width == 1440:
                    ground = [frame for frame in frames if abs(frame['y']) < .2]
                    assert ground and all(frame['bloom'] for frame in ground), ground[:3]
                assert not errors, errors
                result = {'npcBudget':{'width':width, 'tier':tier, 'cap':cap, 'states':rows,
                          'maxCalls':max(frame['total'] for frame in frames),
                          'renderedFrames':len(frames), 'screenshot':screenshot}}
                print(json.dumps(result), flush=True)
                results.append(result)
            finally:
                context.close()
    return results


def upper_deck_gallery(page):
    # Resume the real frame loop after the entrance sample so deferred NPCs can install.
    page.evaluate('__mall.setInput(null)')
    assert page.evaluate('__mall.teleport("atrium")')
    page.wait_for_function('window.__mall.state.npcs?.active > 0', timeout=120000)
    crowded = drive(page, 100)
    assert crowded['npcs']['active'] > 0, crowded['npcs']
    assert crowded['drawCalls'] <= 200, crowded['drawCalls']
    print(json.dumps({'view': 'atrium-with-npcs', 'npcs': crowded['npcs']['active'],
                      'drawCalls': crowded['drawCalls']}), flush=True)
    for point in ((10, 5.5), (-6.4, 5.5), (-6.4, 10)):
        walk_to(page, *point)
    assert state(page)['nearby'] == 'visitor-elevator', state(page)
    assert any(word in page.locator('#inspect').inner_text().lower() for word in ('ride', 'call')), page.locator('#inspect').inner_text()
    page.locator('#inspect').click()
    drive(page, 4500)
    upper = state(page)
    assert abs(upper['y'] - 7.2) < .1 and not upper['elevatorTravel'], upper
    # The lazy atlas needs live frames to drain its upload queue after manual lift steps.
    page.evaluate('__mall.setInput(null)')
    page.wait_for_function('window.__mall.state.brandPlaqueCount === 17', timeout=60000)
    upper = state(page)
    assert upper['brandPlaqueCount'] == 17, upper
    assert upper['drawCalls'] <= 190, upper['drawCalls']
    for x, z in ((-8.18, 10), (-8.18, 14.67), (1.72, 14.76)):
        walk_to(page, x, z, precise=True)
    assert state(page)['nearby'] == 'brand-plaque-S01', state(page)
    story = page.locator('.brand-story-nearby')
    assert story.is_visible() and 'New Zealand' in story.inner_text(), story.inner_text()
    page.locator('#inspect').click()
    assert page.locator('#product-dialog').is_visible()
    assert page.locator('#product-description').inner_text() == story.inner_text()
    page.keyboard.press('Escape')
    assert not page.locator('#product-dialog').is_visible()
    # Approach a deck bench from its open side, then exercise the real HUD
    # action and return to the published exit on the upper floor.
    deck_seats = [seat for seat in state(page)['seats']
                  if seat['id'] == 'bench-seat-9']
    assert len(deck_seats) == 1, deck_seats
    seat = deck_seats[0]
    # The oak bench opens onto the inner east aisle.
    walk_to(page, seat['exitX'], 14.67, precise=True)
    walk_to(page, seat['exitX'], seat['exitZ'])
    assert state(page)['nearby'] == seat['id'], state(page)
    page.locator('#inspect').click()
    seated = drive(page, 1600)
    assert seated['seated'] and seated['seatId'] == seat['id'] and seated['seatPhase'] == 'seated', seated
    assert abs(seated['y'] - 7.2) < .1, seated
    assert page.locator('#inspect').get_attribute('aria-label') == 'Stand up from bench'
    page.locator('#inspect').click()
    stood = drive(page, 1200)
    assert not stood['seated'] and stood['seatPhase'] == 'idle', stood
    assert abs(stood['x'] - seat['exitX']) < .05 and abs(stood['z'] - seat['exitZ']) < .05, stood
    assert abs(stood['y'] - 7.2) < .1, stood
    # The relocated third bench is registered and reachable without crossing
    # the shaft guard. Exercise its real interaction and published exit too.
    deck_seats = [item for item in state(page)['seats']
                  if item['id'] == 'bench-seat-11']
    assert len(deck_seats) == 1, deck_seats
    seat = deck_seats[0]
    walk_to(page, stood['x'], 7.4, precise=True)
    walk_to(page, seat['exitX'], 7.4, precise=True)
    walk_to(page, seat['exitX'], seat['exitZ'], precise=True)
    assert state(page)['nearby'] == seat['id'], state(page)
    page.locator('#inspect').click()
    seated = drive(page, 1600)
    assert seated['seated'] and seated['seatId'] == seat['id'] and seated['seatPhase'] == 'seated', seated
    assert abs(seated['y'] - 7.2) < .1, seated
    page.locator('#inspect').click()
    stood = drive(page, 1200)
    assert not stood['seated'] and stood['seatPhase'] == 'idle', stood
    assert abs(stood['x'] - seat['exitX']) < .05 and abs(stood['z'] - seat['exitZ']) < .05, stood
    assert abs(stood['y'] - 7.2) < .1, stood
    return upper


def expanded_upper_deck_coverage(browser, base):
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    try:
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        url = base + '/gallery/demos/corporate/gjh/v11/'
        with page.expect_response(url + 'script.bundle.js', timeout=90000) as bundle:
            page.goto(url + '#experience')
        page.wait_for_function('window.__mall?.ready && window.__sceneReady')
        dismiss_tutorial(page)
        drive(page, 0)
        entrance = state(page)['drawCalls']
        assert entrance <= 190, entrance
        try:
            upper = upper_deck_gallery(page)
        except Exception as error:
            current = state(page)
            raise AssertionError({key: current[key] for key in ('zone', 'y', 'nearby', 'drawCalls',
                'brandPlaqueCount', 'elevator')} | {'brandWallErrors': errors}) from error
        final = state(page)
        assert final['brandPlaqueCount'] == 17
        assert final['drawCalls'] <= 190
        digest = hashlib.sha256(bundle.value.body()).hexdigest()
        return {'expandedDefaultDrawCalls': entrance, 'upperDeckBrandWall': upper,
                'upperDeckFinalDrawCalls': final['drawCalls'], 'servedAppSha256': digest}
    finally:
        context.close()


def keyboard_turning(page):
    """Actual held keys turn camera/avatar without manufacturing translation."""
    page.evaluate('__mall.teleport("atrium"); __mall.setInput(null); __mall.step(0)')
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
    """Exploration plaques clear the HUD; compact menus pause the covered scene."""
    if page.viewport_size['width'] != 390:
        return
    if page.locator('body').evaluate('el=>el.classList.contains("is-panel-open")'):
        assert page.evaluate('__mall.mode') == 'menu'
        frames = state(page)['frames']
        page.wait_for_timeout(150)
        assert state(page)['frames'] == frames
        return
    rectangles = page.locator('.site-header,#mall-tools,#mall-map').evaluate_all(
        'els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})')
    for sign in state(page)['roomSigns']:
        if not sign['visible']:
            continue
        for rect in rectangles:
            assert not (sign['left'] < rect['right'] + 8 and sign['right'] > rect['left'] - 8
                        and sign['top'] < rect['bottom'] + 8 and sign['bottom'] > rect['top'] - 8), (sign, rect)


def loader_coverage(browser, url):
    """Capture a real stalled startup and recover from a required texture failure."""
    global hold_loader_texture
    output = Path.home() / 'omp-tasks/out'
    output.mkdir(parents=True, exist_ok=True)
    captures = []
    for width, height in ((1440, 900), (390, 844)):
        loader_request.clear()
        loader_release.clear()
        hold_loader_texture = True
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      device_scale_factor=2, has_touch=width < 1000,
                                      service_workers='block')
        try:
            page = context.new_page()
            page.goto(url, wait_until='domcontentloaded', timeout=90000)
            page.locator('#app-loader').wait_for(state='visible', timeout=90000)
            assert loader_request.wait(90), 'Required startup texture was not requested'
            assert not page.evaluate('Boolean(window.__sceneReady || window.__sceneFailed)')
            assert page.locator('#loader-status').is_visible()
            assert page.locator('#loader-progress').evaluate("el => el.tagName === 'PROGRESS'")
            assert page.locator('#loader-progress').is_visible()
            page.evaluate('''() => {
              const loader = document.querySelector('#app-loader');
              window.__loaderHiddenBeforeReady = false;
              new MutationObserver(() => {
                if ((loader.hidden || getComputedStyle(loader).display === 'none' ||
                     getComputedStyle(loader).visibility === 'hidden') && !window.__sceneReady)
                  window.__loaderHiddenBeforeReady = true;
              }).observe(loader, {attributes:true, attributeFilter:['hidden','style','class']});
            }''')
            capture = output / f'gjh-v11-loader-mid-load-{width}.png'
            page.screenshot(path=str(capture))
            captures.append(str(capture))
            hold_loader_texture = False
            loader_release.set()
            page.wait_for_function('window.__sceneReady === true || window.__sceneFailed === true', timeout=90000)
            assert page.evaluate('window.__sceneReady === true && window.__mall?.ready === true')
            page.locator('#app-loader').wait_for(state='hidden', timeout=90000)
            assert not page.evaluate('window.__loaderHiddenBeforeReady')
        finally:
            hold_loader_texture = False
            loader_release.set()
            context.close()

    context = browser.new_context(viewport={'width': 1440, 'height': 900},
                                  service_workers='block')
    try:
        page = context.new_page()
        failures = []
        def fail_texture(route):
            failures.append(route.request.url)
            route.fulfill(status=503, body='Startup texture unavailable')
        pattern = f'**{LOADER_TEXTURE}*'
        page.route(pattern, fail_texture)
        page.goto(url, wait_until='domcontentloaded', timeout=90000)
        page.wait_for_function('window.__sceneFailed === true', timeout=90000)
        assert failures, 'Required startup texture was not intercepted'
        assert not page.evaluate('Boolean(window.__sceneReady || window.__mall?.ready)')
        assert page.locator('#app-loader').is_visible()
        assert page.locator('#loader-status').is_visible()
        assert page.locator('#loader-directory').is_visible()
        assert page.locator('#loader-directory').evaluate("el => el.tagName === 'A' && !!el.getAttribute('href')")
        retry = page.locator('#loader-retry')
        assert retry.is_visible() and retry.is_enabled()
        page.unroute(pattern, fail_texture)
        retry.click()
        page.wait_for_function('window.__sceneReady === true && window.__mall?.ready === true', timeout=90000)
        page.locator('#app-loader').wait_for(state='hidden', timeout=90000)
        calls = state(page)['drawCalls']
        assert 0 < calls <= 200, calls
        return {'midLoadScreenshots': captures, 'failedRequests': len(failures),
                'retryDrawCalls': calls}
    finally:
        context.close()


def run(capture=False, upper_deck=False):
    spec = importlib.util.spec_from_file_location('gallery', ROOT / 'scripts/build_gallery.py')
    gallery = importlib.util.module_from_spec(spec); spec.loader.exec_module(gallery)
    evidence = []
    layout_evidence = []
    with tempfile.TemporaryDirectory(prefix='gjh-v11-artifact-') as temp:
        output = Path(temp) / 'gallery'; gallery.build(output)
        handler = functools.partial(QuietHandler, directory=temp)
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        url = base + '/gallery/demos/corporate/gjh/v11/?layout=classic&visitor=v1#experience'
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=ARGS)
                try:
                    if upper_deck:
                        deck = expanded_upper_deck_coverage(browser, base)
                        digest = hashlib.sha256((DEMO / 'script.bundle.js').read_bytes()).hexdigest()
                        assert deck['servedAppSha256'] == digest, deck['servedAppSha256']
                        print(json.dumps({'chrome': browser.version,
                            'webglBackend': os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'),
                            'viewport': [1440, 900], 'expandedDefaultDrawCalls': deck['expandedDefaultDrawCalls'],
                            'upperDeckDrawCalls': deck['upperDeckBrandWall']['drawCalls'],
                            'upperDeckFinalDrawCalls': deck['upperDeckFinalDrawCalls'],
                            'brandPlaqueCount': deck['upperDeckBrandWall']['brandPlaqueCount'],
                            'servedAppSha256': digest}, indent=2))
                        return
                    review = Path(tempfile.mkdtemp(prefix='gjh-v11-review-'))
                    evidence.append({'loader': loader_coverage(browser, url)})
                    evidence.append({'uxHud': ux_hud_coverage(browser, base + '/gallery/demos/corporate/gjh/v11/#experience')})
                    evidence.extend(npc_budget_coverage(browser, base + '/gallery/demos/corporate/gjh/v11/#experience'))
                    for query, expected in (('', True), ('?layout=classic', False)):
                        context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2, reduced_motion='reduce')
                        page = context.new_page()
                        started = time.monotonic()
                        page.goto(base + '/gallery/demos/corporate/gjh/v11/' + query + '#experience')
                        page.wait_for_function('window.__sceneReady || window.__sceneFailed', timeout=90000)
                        ready_ms = round((time.monotonic() - started) * 1000)
                        assert page.evaluate('window.__sceneReady === true'), page.locator('#fallback-message').inner_text()
                        assert page.evaluate('document.body.classList.contains("is-expanded")') is expected, query
                        initial = state(page)
                        assert initial['drawCalls'] <= (190 if expected else 200), initial
                        if expected:
                            assert abs(initial['x'] - 10) < .1 and abs(initial['z'] - 45) < .1
                            dismiss_tutorial(page)
                            for zone in ('newmoon', 'mili', 'gogo'):
                                assert page.evaluate('zone => __mall.teleport(zone)', zone)
                                opened = drive(page, 1000)
                                print(json.dumps({'door': zone, 'viewport': [1440, 900],
                                                  'drawCalls': opened['drawCalls']}), flush=True)
                                assert opened['doors'][zone] > .99, opened
                                assert opened['drawCalls'] <= 200, (zone, opened['drawCalls'])
                                if zone == 'mili':
                                    assert opened['npcs']['active'] > 0, opened['npcs']
                                    print(json.dumps({'view': 'mili-open-with-npcs',
                                                      'npcs': opened['npcs']['active'],
                                                      'drawCalls': opened['drawCalls']}), flush=True)
                                if zone == 'newmoon':
                                    walk_to(page, -11.21, 1.35)
                                    walk_to(page, -11.21, -7.55)
                                    page.get_by_role('button', name='Pick up product', exact=True).click()
                                    drive(page, 1000)
                                    assert state(page)['character']['physicalProduct']['phase'] == 'held', state(page)
                                    page.get_by_role('button', name='Return to shelf', exact=True).click()
                                    drive(page, 1000)
                                    assert state(page)['character']['physicalProduct']['phase'] == 'empty', state(page)
                                    assert page.evaluate('__mall.teleport("newmoon")')
                                    drive(page, 1000)
                                inside = drive(page, 1400, forward=1)
                                assert inside['z'] < -.5, inside
                                assert inside['drawCalls'] <= 200, (zone, inside['drawCalls'])
                                assert page.evaluate('__mall.teleport("atrium")')
                                closed = drive(page, 1000)
                                assert closed['doors'][zone] == 0, closed
                        else:
                            assert page.locator('[data-space-id]').count() == 0
                        layout_evidence.append({'query':query or '(no query)','expanded':expected,'readyMsObserved':ready_ms,'drawCalls':initial['drawCalls']})
                        context.close()
                    for width, height in ((1440, 900), (768, 1024), (390, 844)):
                        context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=2, has_touch=width<1000)
                        page = context.new_page(); errors = []; external = []
                        page.on('pageerror', lambda e: errors.append(str(e)))
                        page.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
                        page.on('request', lambda r: external.append(r.url) if r.url.startswith('http') and not r.url.startswith(base) else None)
                        page.goto(url); page.wait_for_function('window.__mall?.ready && window.__sceneReady')
                        # Complete the genuine first-use flow before existing walking/asset assertions.
                        dismiss_tutorial(page)
                        # Drain the initial frame before capturing a frozen scene.
                        drive(page, 0)
                        initial = state(page); assert initial['drawCalls'] <= 200, initial['drawCalls']
                        draw_calls = {'atrium': initial['drawCalls']}
                        max_draw_calls = initial['drawCalls']
                        assert initial['pixelRatio'] <= (1.5 if width<600 else 2)
                        targets(page)
                        if width == 390:
                            mall_map = page.locator('#mall-map')
                            mobile_hud(page)
                            assert not mall_map.evaluate('el=>el.open')
                            page.locator('#mall-tools').click()
                            open_menu_page(page, "help")
                            page.locator('#header-map').click()
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
                            assert page.locator('#header-map').is_visible()
                            assert page.locator('#header-map').evaluate('el=>el===document.activeElement')
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
                            assert page.locator('#run-toggle').get_attribute('aria-pressed')=='false'
                            page.locator('#run-toggle').click()
                            page.evaluate('__mall.setInput({})')
                        page.evaluate('__mall.teleport("atrium")')
                        moved = drive(page, 800, right=1)
                        assert moved['x'] > before['x'] + 1.7 and moved['animation']=='walk', moved
                        page.screenshot(path=str(review / f'walking-{width}.png'), scale='css')
                        draw_calls['walking'] = moved['drawCalls']
                        ran = drive(page, 300, right=1, run=True)
                        assert ran['animation']=='run' and 1.8 < ran['x']-moved['x'] < 2.3, ran
                        # Repeated high-speed steps cannot tunnel through the outer wall.
                        stopped = drive(page, 6000, right=1, run=True)
                        assert 14 < stopped['x'] < 14.6, stopped
                        stopped_again = drive(page, 1000, right=1, run=True)
                        assert abs(stopped_again['x']-stopped['x']) < .03
                        drive(page, 100)
                        assert state(page)['animation']=='idle'
                        for zone in ('newmoon', 'mili', 'gogo'):
                            if not page.locator('#mall-map').evaluate('el=>el.open'):
                                page.locator('#header-map').click()
                            page.locator(f'[data-teleport="{zone}"]').click()
                            assert not page.locator('#mall-map').evaluate('el=>el.open')
                            page.evaluate('__mall.setInput({})')
                            assert abs(state(page)['x']-{'newmoon':-10,'mili':0,'gogo':10}[zone])<.05
                            opened = drive(page, 400)
                            assert opened['doors'][zone] > .99, opened
                            assert opened['drawCalls'] <= 200, (width, zone, opened['drawCalls'])
                            max_draw_calls = max(max_draw_calls, opened['drawCalls'])
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
                            page.keyboard.press('f')
                            if zone == 'newmoon': shelf_details(page)
                            assert page.locator('#product-dialog').is_visible()
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
                        evidence.append({'width':width, 'drawCalls':initial['drawCalls'], 'drawCallsByView':draw_calls, 'walkingCollisionDoorsInspection':'PASS', 'keyboardTurningAndFInspection':'PASS','errors':errors})
                    evidence.append(expanded_upper_deck_coverage(browser, base))
                    for width,height in ((390,844),(1440,900)):
                        context=browser.new_context(viewport={'width':width,'height':height},
                            device_scale_factor=2,has_touch=width<600,reduced_motion='reduce')
                        page=context.new_page()
                        page.goto(base+'/gallery/demos/corporate/gjh/v11/#experience')
                        page.wait_for_function('window.__mall?.ready && window.__sceneReady')
                        dismiss_tutorial(page)
                        evidence.append({'heroVisibility':hero_visibility_gallery(page,width,height)})
                        context.close()
                    context = browser.new_context(reduced_motion='reduce')
                    page = context.new_page(); page.goto(url); page.wait_for_function('window.__mall?.ready')
                    # Complete the genuine first-use flow before existing walking/asset assertions.
                    dismiss_tutorial(page)
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
                        page=context.new_page(); page.goto(url.removesuffix('#experience') if failure=='nojs' else url)
                        if failure!='nojs':
                            page.wait_for_function('window.__sceneFailed===true')
                            assert page.locator('#app-loader').is_visible()
                            assert page.locator('#loader-status').is_visible()
                            assert page.locator('#loader-retry').is_visible() and page.locator('#loader-retry').is_enabled()
                            assert page.locator('#loader-directory').is_visible()
                            page.locator('#loader-directory').click()
                            assert page.locator('#app-loader').is_hidden()
                            assert page.locator('#store-list').evaluate('el => el === document.activeElement')
                        assert page.locator('#store-list').is_visible()
                        assert page.locator('.product-card').count()==4
                        assert page.locator('#mili-title').is_visible() and page.locator('#gogo-title').is_visible()
                        if failure=='wasm': assert 'WebAssembly' in page.locator('#fallback-message').inner_text()
                        targets(page); context.close()
                    evidence.append({'layoutRoutes':layout_evidence,'reducedMotion':'PASS','hiddenPause':'PASS','contextLoss':'PASS','WebGLAndWasmFailure':'PASS','noJS':'PASS','review':str(review)})
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
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--capture', action='store_true')
    mode.add_argument('--upper-deck', action='store_true', help='Run the focused expanded upper-deck acceptance.')
    args = parser.parse_args()
    run(args.capture, args.upper_deck)
