"""Portable selected-interaction guidance acceptance in real Chrome.

Only the existing movement/test API steers the visitor. Hidden-state and near-plane
fixtures are explicitly labelled; resource comparison serves pinned sources without
changing the checkout. Screenshots and detailed evidence default to /tmp.
"""
import argparse
import functools
import hashlib
import http.server
import json
import io
import re
import math
import os
from pathlib import Path
import subprocess
import tempfile
import threading

from PIL import Image
from playwright.sync_api import sync_playwright
from browser_gjh_guide import ROOT, Quiet, state
from browser_gjh_all_seats import move
from browser_gjh_modes import approach_seat, activate_cart, close_bag
from browser_gjh_mode_review import close_event_before_action, finish_close, lose_context
from browser_gjh_shelf_focus import approach, ready, open_shelf, close_shelf, GPU_PROBE, metrics, nearby_geometry
from browser_gjh_context_navigation_insets import PROFILES, settle

RUNTIME = 'demos/corporate/gjh/v11/'
BASE = 'a88fd1ccb7430e124732373ec40476085c2364f5'
SIZES = [(320,568),(390,844),(667,375),(844,390),(768,1024),(1440,900),
         (650,844),(651,844),(599,844),(600,844),(844,560),(844,561),(1000,900),(1001,900)]


def hashes(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (root/RUNTIME).rglob('*') if p.is_file() and p.suffix in ['.js','.css','.html']}


def anchor(s):
    return {k:s['interaction'][k] for k in ['id','x','y','z','radius']}


def walk_target(page, category):
    if category == 'kiosk':
        page.evaluate("__mall.teleport('atrium')");move(page,-1.7,11.2)
        expected='mall-directory'
    elif category == 'bench':
        approach_seat(page);expected='courtyard-seat'
    elif category in ['mili','gogo']:
        center=0 if category=='mili' else 10
        page.evaluate('z=>__mall.teleport(z)',category)
        # Walk around the existing central table instead of modifying collisions.
        move(page,center+1.4,-3.5);move(page,center+1.4,-7.8);move(page,center,-7.8)
        expected=category
    elif category == 'elevator-ground':
        page.evaluate("__mall.teleport('atrium')");move(page,0,15)
        page.evaluate('__mall.setInput({yaw:Math.PI});__mall.step(500)')
        expected='visitor-elevator'
    else:
        page.locator('#inspect').click();page.evaluate('__mall.step(4000)')
        expected='visitor-elevator';assert state(page)['y']>7
        arrived=state(page);assert arrived['interaction']['y']==7.2 and arrived['interaction']['distance']<.001
        # Existing elevator action camera may clip the floor point at 320px.
        # Walking out restores the normal owner camera; no presentation changes it.
        move(page,0,15);page.evaluate('__mall.setInput({yaw:Math.PI});__mall.step(500)')
    s=state(page);assert s['nearby']==expected,(category,s['nearby'])
    return s


def shown(page):
    return page.evaluate('''() => Object.fromEntries(['nearby-distance','interaction-point','nearby-shelf-outline']
      .map(id=>[id,!document.getElementById(id).hidden]))''')


def hidden(page):
    assert not any(shown(page).values()), shown(page)


def geometry(page, shelf=False, cue=True):
    row=page.evaluate('''() => {
      const rect=e=>e.getBoundingClientRect().toJSON(),visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
      const prompt=document.querySelector('#inspect-prompt'),point=document.querySelector('#interaction-point'),outline=document.querySelector('#nearby-shelf-outline');
      const texts=[...prompt.querySelectorAll('#nearby-name,#nearby-distance,p')].filter(visible).map(e=>{
        const r=document.createRange();r.selectNodeContents(e);return {id:e.id,text:e.textContent,rect:rect(e),labels:[...r.getClientRects()].map(r=>r.toJSON()),font:parseFloat(getComputedStyle(e).fontSize)};});
      const controls=[...prompt.querySelectorAll('button')].filter(visible).map(e=>{
        const r=rect(e),s=getComputedStyle(e),range=document.createRange();range.selectNodeContents(e);
        return {text:e.textContent,disabled:e.disabled,rect:r,labels:[...range.getClientRects()].map(r=>r.toJSON()),font:parseFloat(s.fontSize),
          hit:[[2,2],[r.width-2,2],[2,r.height-2],[r.width-2,r.height-2],[r.width/2,r.height/2]].every(([x,y])=>e.contains(document.elementFromPoint(r.x+x,r.y+y))),
          ring:parseFloat(s.outlineWidth)+Math.max(0,parseFloat(s.outlineOffset)),outlineWidth:parseFloat(s.outlineWidth),focus:e===document.activeElement,focusVisible:e.matches(':focus-visible'),outline:s.outlineColor};});
      return {prompt:rect(prompt),texts,controls,scene:rect(document.querySelector('#scene')),header:rect(document.querySelector('.site-header')),
        point:{hidden:point.hidden,rect:rect(point),text:point.textContent,decorative:point.getAttribute('aria-hidden'),pointer:getComputedStyle(point).pointerEvents},
        shelf:{hidden:outline.hidden,rect:rect(outline)},
        others:[...document.querySelectorAll('#keyboard-help,#mall-map,#joystick,#run-toggle,.scene-disclaimer')].filter(visible).map(e=>({id:e.id||e.className,rect:rect(e)})),
        distance:document.querySelector('#nearby-distance').textContent,live:document.querySelector('#nearby-distance').closest('[aria-live],[role=status]'),
        overflow:document.documentElement.scrollWidth>innerWidth,viewport:[innerWidth,innerHeight]};
    }''')
    w,h=row['viewport'];r=row['prompt'];assert not row['overflow'],row
    assert r['left']>=4 and r['right']<=w-4 and r['top']>=row['header']['bottom']+4 and r['bottom']<=h-4,row
    for c in row['controls']:
        b=c['rect'];assert b['width']>=44 and b['height']>=44 and c['hit'] and c['font']>=12,c
        for l in c['labels']:
            assert l['left']>=b['left']-.1 and l['right']<=b['right']+.1 and l['top']>=b['top']-.1 and l['bottom']<=b['bottom']+.1,c
        if c['focus']:
            assert c['focusVisible'] and c['ring']>=2,c
            assert b['left']-c['ring']>=r['left'] and b['right']+c['ring']<=r['right'] and b['top']-c['ring']>=r['top'] and b['bottom']+c['ring']<=r['bottom'],c
    for t in row['texts']:
        b=t['rect'];assert t['font']>=12,t
        for l in t['labels']:
            assert l['left']>=b['left']-.1 and l['right']<=b['right']+.1 and l['top']>=r['top'] and l['bottom']<=r['bottom'],t
    for other in row['others']:
        b=other['rect'];assert r['right']<=b['left'] or r['left']>=b['right'] or r['bottom']<=b['top'] or r['top']>=b['bottom'],(row,other)
    assert not row['live'],row
    if shelf:nearby_geometry(page)
    marker=row['shelf' if shelf else 'point']
    if cue:assert not marker['hidden'],row
    if not marker['hidden']:
        b=dict(marker['rect']);a=row['scene']
        for edge in ['left','top']:b[edge]-=2
        b['right']+=2;b['bottom']+=2 if shelf else 7
        assert b['left']>=a['left']+2 and b['right']<=a['right']-2 and b['top']>=a['top']+2 and b['bottom']<=a['bottom']-2,marker
    if not shelf and not marker['hidden']:
        for other in [{'id':'prompt','rect':r},*row['others']]:
            c=other['rect']
            assert b['right']<=c['left']-1.9 or b['left']>=c['right']+1.9 or b['bottom']<=c['top']-1.9 or b['top']>=c['bottom']+1.9,(b,other)
    assert row['point']['decorative']=='true' and row['point']['pointer']=='none'
    s=state(page);i=s['interaction'];d=math.hypot(s['x']-i['x'],s['z']-i['z'])
    assert abs(d-i['distance'])<1e-10,(s['x'],s['z'],i)
    assert row['distance']==page.evaluate('d=>`≈${d.toFixed(1)} m`',d),row
    assert d<i['radius'] and abs(s['y']-i['y'])<.5
    return row


def raster_contrast(page, frame, row, shelf=False):
    """Paired real rasters; DOM-only suppression reveals the same frozen 3D background."""
    before=Image.open(frame).convert('RGB')
    selector='#nearby-shelf-outline' if shelf else '#interaction-point'
    styles=page.evaluate("""s=>{
      const cue=document.querySelector(s),button=document.querySelector('#inspect');
      const old={visibility:cue.style.visibility,outline:button.style.outlineStyle};
      cue.style.visibility='hidden';button.style.outlineStyle='none';return old;
    }""",selector)
    try:
        raw=page.screenshot(path=str(frame.with_name(frame.stem+'-underlay.png')))
    finally:
        page.evaluate("""({s,old})=>{document.querySelector(s).style.visibility=old.visibility;
          document.querySelector('#inspect').style.outlineStyle=old.outline;}""",{'s':selector,'old':styles})
    under=Image.open(io.BytesIO(raw)).convert('RGB')
    def luminance(rgb):
        channels=[v/255 for v in rgb]
        return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for w,v in zip([.2126,.7152,.0722],channels))
    def ratio(a,b):
        light,dark=sorted([luminance(a),luminance(b)],reverse=True)
        return (light+.05)/(dark+.05)
    def contour(box,occluders=()):
        # Straight edge samples exclude corners and glyphs. The full cue's paired
        # light/dark band is measured against the actual scene, not CSS paper.
        samples=[];occluded=0
        for side in ['top','bottom','left','right']:
            horizontal=side in ['top','bottom']
            start=box['left']+8 if horizontal else box['top']+8
            end=box['right']-8 if horizontal else box['bottom']-8
            for tangent in range(math.ceil(start),math.floor(end),4):
                x,y=(tangent,box[side]) if horizontal else (box[side],tangent)
                if any(r['left']<=x<=r['right'] and r['top']<=y<=r['bottom'] for r in occluders):
                    occluded+=1;continue
                values=[]
                for delta in range(-4,6):
                    normal=round(box[side])+delta
                    x,y=(tangent,normal) if horizontal else (normal,tangent)
                    if 0<=x<before.width and 0<=y<before.height:
                        actual,background=before.getpixel((x,y)),under.getpixel((x,y))
                        if max(abs(a-b) for a,b in zip(actual,background))>12:
                            values.append(ratio(actual,background))
                assert values,('No visible cue band',side,tangent,box)
                samples.append(max(values))
        assert samples and min(samples)>=3,{'minimum':min(samples),'below3':[v for v in samples if v<3], 'box':box}
        return {'edgeSamples':len(samples),'minimumWholeBandRatio':round(min(samples),3),'samplesBehindAuthoritativeHUD':occluded}
    box=dict(row['shelf' if shelf else 'point']['rect'])
    if not shelf:box['bottom']-=16  # Actual labelled box; the remaining stem/ring is decorative.
    cue=contour(box,[row['prompt']] if shelf else ())
    assert cue['edgeSamples']>=20,cue
    button=next(c for c in row['controls'] if c['focus'])
    focus=dict(button['rect'])
    # Sample the actual focus band's centre, including the compact prompt treatment.
    offset=button['ring']-button['outlineWidth']/2
    for edge in ['left','top']:focus[edge]-=offset
    for edge in ['right','bottom']:focus[edge]+=offset
    return {'method':'paired actual PNGs with DOM-only cue/outline suppression; same frozen 3D scene',
            'cue':cue,'actionFocus':contour(focus),'underlayFrame':frame.stem+'-underlay.png'}


def focus_action(page):
    # Enter from the real canvas tab stop; wrapping the last desktop control can
    # legitimately hand focus to browser chrome, whose reverse traversal varies.
    page.locator('#scene').focus()
    for _ in range(15):
        page.keyboard.press('Tab')
        if page.locator('#inspect').evaluate('e=>e===document.activeElement'):
            break
    result=page.locator('#inspect').evaluate("e=>({active:e===document.activeElement,visible:e.matches(':focus-visible'),owner:document.activeElement.id,mode:__mall.mode,focused:document.hasFocus()})")
    assert result['active'] and result['visible'],result


def stable_updates(page):
    page.evaluate('''() => {
      window.__guidanceMutations={distance:0,live:0};
      window.__guidanceObserver=new MutationObserver(ms=>{for(const m of ms){
        if(document.querySelector('#nearby-distance').contains(m.target))__guidanceMutations.distance++;
        if(document.querySelector('#mall-status').contains(m.target))__guidanceMutations.live++;
      }});__guidanceObserver.observe(document.querySelector('#inspect-prompt'),{subtree:true,childList:true,characterData:true});
      __guidanceObserver.observe(document.querySelector('#mall-status'),{subtree:true,childList:true,characterData:true});
    }''')
    page.evaluate('__mall.setInput({forward:0});__mall.step(1000)');settle(page)
    result=page.evaluate('''() => {__guidanceObserver.disconnect();return __guidanceMutations;}''')
    assert result=={'distance':0,'live':0},result
    before=state(page);old=page.locator('#nearby-distance').inner_text()
    page.evaluate('__mall.setInput({forward:-1});__mall.step(100)')
    after=state(page);assert anchor(before)==anchor(after)
    assert old!=page.locator('#nearby-distance').inner_text()
    return {'stable':result,'before':before['interaction'],'after':after['interaction']}


def current_projection(page):
    return page.evaluate("""async()=>{
      const T=await import('./vendor/three.module.min.js'),s=__mall.state,a=s.interaction;
      const c=new T.PerspectiveCamera(s.camera.fov,s.camera.aspect,.08,100);
      c.position.fromArray(s.camera.position);c.quaternion.fromArray(s.camera.quaternion);c.updateMatrixWorld();
      const p=new T.Vector3(a.x,a.y,a.z).project(c),r=document.querySelector('#scene').getBoundingClientRect();
      return {ndc:p.toArray(),pixel:[r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2]};
    }""")


def projection_edges(page):
    walk_target(page,'elevator-ground');before=state(page);assert shown(page)['interaction-point']
    samples=[]
    # Turn a full revolution through actual camera smoothing, retaining the same action.
    for yaw in [math.pi*1.5,0,math.pi*.5,math.pi]:
        page.evaluate('yaw=>{__mall.setInput({yaw});__mall.step(500)}',yaw)
        assert anchor(state(page))==anchor(before)
        samples.append({'yaw':yaw,'projection':current_projection(page),**shown(page)})
    assert any(not r['interaction-point'] for r in samples),samples
    assert samples[-1]['interaction-point'],samples
    # Action stays legal when only projection is ineligible.
    page.evaluate('__mall.setInput({yaw:0});__mall.step(500)')
    assert not shown(page)['interaction-point'] and page.locator('#inspect').is_enabled()
    page.locator('#scene').focus();page.keyboard.press('f');page.evaluate('__mall.step(4000)')
    assert state(page)['interaction']['y']==7.2
    # Independently exercise the shared projection's finite/near/far guards using real Three cameras.
    fixture=page.evaluate('''async()=>{
      const T=await import('./vendor/three.module.min.js'),{createDOMProjection}=await import('./assets/dom-projection.js');
      const p=createDOMProjection(T,document.querySelector('#scene')),c=new T.PerspectiveCamera(58,1,.08,100);
      return {behind:p.point({x:0,y:0,z:1},c),near:p.point({x:0,y:0,z:-.01},c),far:p.point({x:0,y:0,z:-101},c),
        invalid:p.point({x:NaN,y:0,z:-1},c),valid:p.point({x:0,y:0,z:-1},c),
        crossing:p.bounds({min:{x:-1,y:-1,z:-1},max:{x:1,y:1,z:.1}},c)};
    }''')
    assert all(fixture[k] is None for k in ['behind','near','far','invalid','crossing']) and fixture['valid'],fixture
    return {'actualTurn':samples,'cameraAwayFUsesSameAction':'PASS','nearPlaneFixture':fixture}


def mode_paths(page,context,browser):
    rows=[];print('MODE kiosk',flush=True);walk_target(page,'kiosk');page.locator('#scene').focus();page.keyboard.press('f')
    if page.evaluate('__mall.mode')=='menu':hidden(page)
    page.keyboard.press('Escape');page.evaluate('__mall.step(20)')
    for selector in ['#bag-dialog','#product-dialog','#original-tin-dialog']:
        print('MODE modal',selector,flush=True);walk_target(page,'kiosk');page.locator(selector).evaluate('e=>e.showModal()');settle(page);hidden(page)
        close_event_before_action(page,selector);page.locator(selector).evaluate('e=>e.close()');finish_close(page)
        page.evaluate('__mall.step(20)');assert shown(page)['nearby-distance'];rows.append({'nativeModal':selector,'cleared':'PASS'})
    print('MODE bench',flush=True);walk_target(page,'bench');page.locator('#inspect').click();page.evaluate('__mall.step(1000)');hidden(page)
    assert state(page)['seated'];page.locator('#inspect').click();page.evaluate('__mall.step(1000)');assert not state(page)['seated']
    # Native cart owner still explains/blocks sitting; distance cannot override it.
    approach_seat(page);seat=state(page)['seats'][0]
    move(page,seat['exitX'],seat['exitZ']-1.5)
    page.locator('#bag-open').click();activate_cart(page)
    # The wider Cart collider stops short of the bench but remains in the unchanged action radius.
    page.evaluate('__mall.setInput({forward:-1,yaw:0});__mall.step(1000)')
    page.evaluate('__mall.setInput({forward:0});__mall.step(20)')
    assert state(page)['pushing'] and page.locator('#inspect').is_disabled()
    explanation=page.locator('#nearby-name').inner_text();assert 'Stow your cart' in explanation
    page.evaluate('__mall.step(1000)');assert page.locator('#nearby-name').inner_text()==explanation
    page.locator('#scene').focus();page.keyboard.press('f');assert not state(page)['seated']
    page.locator('#bag-open').click();page.locator('#cart-toggle').click();close_bag(page)
    approach(page,'sa-425g');page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.step(1000)')
    held=state(page)['character']['physicalProduct'];assert held['held'];open_shelf(page);hidden(page);close_shelf(page,'close')
    page.evaluate('__mall.step(20)');assert state(page)['character']['physicalProduct']==held
    page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1000)')
    assert state(page)['character']['physicalProduct']['phase']=='empty'
    rows.append({'seatedStandCartBenchHeldShelfOwners':'PASS'})
    walk_target(page,'kiosk');page.locator('#view-toggle').click();hidden(page);page.locator('#view-toggle').click();page.evaluate('__mall.step(20)')
    assert shown(page)['nearby-distance'];rows.append({'listRoundTrip':'PASS'})
    cdp=context.new_cdp_session(page);cdp.send('Emulation.setFocusEmulationEnabled',{'enabled':False})
    page.bring_to_front();walk_target(page,'kiosk')
    page.evaluate("window.addEventListener('blur',()=>window.__guidanceActualBlur=true,{once:true})")
    other=context.new_page();other.goto('about:blank');other.bring_to_front();page.wait_for_timeout(150)
    assert page.evaluate('window.__guidanceActualBlur===true');hidden(page)
    frames=state(page)['frames'];page.evaluate('__mall.step(1000)');page.wait_for_timeout(100);hidden(page)
    rows.append({'actualWindowBlur':'PASS','subsequentFrames':state(page)['frames']-frames,'documentHiddenObserved':page.evaluate('document.hidden')})
    # Visibility and focus are independent reasons. This sequence is fixture-backed.
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))");hidden(page)
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))");page.evaluate('__mall.step(20)');hidden(page)
    rows.append({'blurSurvivesHiddenVisibleFixtureUntilFocus':'PASS'})
    other.close();page.bring_to_front();page.evaluate('__mall.step(20)');assert shown(page)['nearby-distance']
    cdp.send('Emulation.setFocusEmulationEnabled',{'enabled':True})
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))");hidden(page)
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))");page.evaluate('__mall.step(20)');assert shown(page)['nearby-distance']
    rows.append({'hiddenFixture':'PASS','actualOSHidden':'NOT_VERIFIED'})
    for _ in range(10):
        walk_target(page,'kiosk');k=state(page)['interaction'];walk_target(page,'elevator-ground');g=state(page)['interaction']
        page.locator('#inspect').click();page.evaluate('__mall.step(4000)');u=state(page)['interaction']
        assert k['id']=='mall-directory' and g['y']==0 and u['y']==7.2 and g['id']==u['id']
    rows.append({'rapidCompleteAnchorChanges':30,'wrongFloorExcluded':'PASS'})
    walk_target(page,'kiosk');owner=anchor(state(page));reflow=[]
    for w,h in [(650,844),(651,844),(844,560),(844,561),(390,844)]:
        page.set_viewport_size({'width':w,'height':h});settle(page);page.evaluate('__mall.step(20)')
        assert anchor(state(page))==owner
        reflow.append({'viewport':[w,h],'geometry':geometry(page,cue=False)})
    rows.append({'currentOwnerThroughReflow':reflow})
    walk_target(page,'kiosk');lose_context(page);hidden(page)
    assert page.locator('#store-list').is_visible() and state(page)['illegalCount']==0
    rows.append({'actualContextLoss':'PASS'})
    return rows


def inset_target(page):
    """Require a visible cue, with an explicit proof when the first view is HUD-covered."""
    first=geometry(page,cue=False)
    if not first['point']['hidden']:
        return {'geometry':geometry(page)}
    reason=page.locator('#interaction-point').evaluate("""e=>{
      const old=e.style.visibility;e.style.visibility='hidden';e.hidden=false;
      const r=e.getBoundingClientRect(),box={left:r.left-2,right:r.right+2,top:r.top-2,bottom:r.bottom+7};
      e.hidden=true;e.style.visibility=old;
      const overlaps=[...document.querySelectorAll('.site-header,.inspect-prompt,.keyboard-help,.mall-map,.joystick,.run-toggle,.scene-disclaimer')]
        .filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')
        .filter(e=>{const r=e.getBoundingClientRect();return box.left<r.right+2&&box.right>r.left-2&&box.top<r.bottom+2&&box.bottom>r.top-2;})
        .map(e=>e.id||e.className);
      return {box,overlaps};
    }""")
    assert reason['overlaps'],reason
    owner=anchor(state(page))
    # A small real approach changes only the camera projection/distance, keeping
    # the same canonical interaction. Never force a caption over native controls.
    for _ in range(5):
        s=state(page);a=s['interaction'];dx,dz=a['x']-s['x'],a['z']-s['z'];d=math.hypot(dx,dz)
        if d<.2:break
        move(page,s['x']+dx/d*.15,s['z']+dz/d*.15)
        if not shown(page)['interaction-point']:
            continue
        assert anchor(state(page))==owner
        return {'initialHUDCovered':reason,'sameOwnerAfterActualApproach':True,'geometry':geometry(page)}
    raise AssertionError({'cueDidNotBecomeVisible':reason,'owner':owner,'current':state(page)['interaction']})


def asset_failures(browser,url,output):
    rows=[]
    for label,pattern,category in [('kiosk','**/mall-directory-kiosk.glb','kiosk'),('brand','**/mili-brand-cover.jpg','mili')]:
        context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce',service_workers='block')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route(pattern,lambda route:route.abort());page.goto(url)
        page.wait_for_function('window.__mall?.ready || window.__sceneFailed',timeout=60000)
        if label=='brand':
            # World textures are required by the existing initializer. Their
            # failure uses the authoritative directory fallback, not a new recovery tier.
            assert page.evaluate('window.__sceneFailed===true && !__mall.ready')
            assert page.locator('#store-list').is_visible();hidden(page)
            page.locator('.product-card [data-inspect]').first.click()
            assert page.locator('#product-dialog').is_visible()
            page.screenshot(path=str(output/f'asset-failure-{label}.png'))
            rows.append({'asset':label,'aborted':pattern,'existingRequiredTextureFallback':'PASS',
                         'guidanceCleared':'PASS','directoryNativeInspect':'PASS','pageErrors':errors})
        else:
            if page.locator('#guide-card').is_visible():
                page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state='hidden'); page.locator('#scene').focus()
            walk_target(page,category);focus_action(page);g=geometry(page)
            page.screenshot(path=str(output/f'asset-failure-{label}.png'));page.locator('#inspect').click()
            assert page.locator('#mall-map').evaluate('e=>e.open');hidden(page)
            rows.append({'asset':label,'aborted':pattern,'guidanceAndNativeAction':'PASS','geometry':g,'pageErrors':errors})
        assert not errors,errors
        context.close()
    return rows


def run():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--prefix',default='')
    parser.add_argument('--output',type=Path,default=Path(tempfile.gettempdir())/'gallery-target-guidance-worker'/'focused')
    parser.add_argument('--smoke',action='store_true');parser.add_argument('--compare-ref',default=BASE)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    prefix='/'+args.prefix.strip('/') if args.prefix.strip('/') else ''
    baseline={}
    if args.compare_ref:
        assert subprocess.check_output(['git','rev-parse',args.compare_ref],cwd=ROOT,text=True).strip()==BASE
        for name in subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,RUNTIME],cwd=ROOT,text=True).splitlines():
            if name.endswith(('.js','.css','.html')):baseline['/'+name]=subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT)
    class Handler(Quiet):
        def do_GET(self):
            if prefix:
                if not self.path.startswith(prefix+'/'):self.send_error(404);return
                self.path=self.path[len(prefix):]
            if self.path.startswith('/__baseline/'):
                self.path=self.path[len('/__baseline'):];path=self.path.split('?')[0]
                if path.endswith('/'):path+='index.html'
                if path in baseline:
                    self.send_response(200);self.send_header('Content-Type',self.guess_type(path));self.end_headers();self.wfile.write(baseline[path]);return
            super().do_GET()
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(args.root)));threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}{prefix}';url=base+'/'+RUNTIME
    report={'status':'RUNNING','sourceHashes':hashes(args.root),'rows':[],'comparison':[],'failures':[]}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','metal'),'--ignore-gpu-blocklist'])
            report['browser']=browser.version
            for w,h in (SIZES[:2] if args.smoke else SIZES):
                context=browser.new_context(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce',service_workers='block')
                context.add_init_script('('+GPU_PROBE+')()');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                ready(page,url);assert len(state(page)['seats'])==8;initial=metrics(page);row={'viewport':[w,h],'targets':[],'initial':initial};report['rows'].append(row)
                assert len(initial['resources'])>=53 and sum(r['decoded'] for r in initial['resources'])<=10*1024*1024
                for category in ['kiosk','bench','mili','gogo','elevator-ground','elevator-upper']:
                    s=walk_target(page,category);focus_action(page)
                    path=args.output/f'{category}-{w}x{h}.png';page.screenshot(path=str(path));g=geometry(page)
                    contrast=raster_contrast(page,path,g) if (w,h) in [(320,568),(390,844),(667,375),(1440,900)] else None
                    row['targets'].append({'category':category,'interaction':s['interaction'],'geometry':g,'frame':path.name,'drawCalls':s['drawCalls'],'rasterContrast':contrast})
                for sku in state(page)['productAssets']['cans']:
                    approach(page,sku);focus_action(page);g=geometry(page,True)
                    path=args.output/f'shelf-{sku}-{w}x{h}.png';page.screenshot(path=str(path))
                    contrast=raster_contrast(page,path,g,True) if sku=='sa-425g' and (w,h) in [(320,568),(390,844),(667,375),(1440,900)] else None
                    row['targets'].append({'sku':sku,'interaction':state(page)['interaction'],'geometry':g,'frame':path.name,'drawCalls':state(page)['drawCalls'],'rasterContrast':contrast})
                print('CHECK stable',w,flush=True);row['updates']=stable_updates(page)
                # Leave the unchanged action radius by actual reverse movement.
                page.evaluate('__mall.setInput({forward:-1});__mall.step(2000)');assert state(page)['interaction'] is None;hidden(page)
                for zone in ['atrium','newmoon','mili','gogo']:page.evaluate('z=>{__mall.teleport(z);__mall.step(20)}',zone)
                row['settled']=metrics(page)
                assert max(t['drawCalls'] for t in row['targets'])<=200
                assert not errors,errors;row['errors']=errors
                if (w,h)==(390,844):
                    print('CHECK projection',flush=True);row['projection']=projection_edges(page)
                    # Baseline and current run exactly the same resource/GPU lifecycle.
                    approach(page);before=metrics(page)
                    for _ in range(12):open_shelf(page);close_shelf(page,'close')
                    after=metrics(page);assert before['gl']==after['gl'] and before['gpu']==after['gpu'] and len(before['resources'])==len(after['resources'])
                    row['repeat']={'entries':12,'before':before,'after':after}
                    print('CHECK modes',flush=True);row['modes']=mode_paths(page,context,browser)
                print(f'PASS guidance {w}x{h}',flush=True);context.close()
            if not args.smoke:
                report['assetFailures']=asset_failures(browser,url,args.output)
                report['insets']=[]
                for name,(w,h),insets in PROFILES:
                    context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,reduced_motion='reduce',service_workers='block');page=context.new_page()
                    context.new_cdp_session(page).send('Emulation.setSafeAreaInsetsOverride',{'insets':insets});ready(page,url)
                    row={'name':name,'insets':insets,'targets':[]};report['insets'].append(row)
                    for category in ['kiosk','bench','mili','gogo','elevator-ground','elevator-upper']:
                        walk_target(page,category);focus_action(page);row['targets'].append({'category':category,**inset_target(page)})
                    for sku in state(page)['productAssets']['cans']:approach(page,sku);focus_action(page);row['targets'].append({'sku':sku,'geometry':geometry(page,True)})
                    page.screenshot(path=str(args.output/f'insets-{name}.png'));context.close()
            if args.compare_ref:
                for w,h in [(390,844),(1440,900)]:
                    pair={}
                    for label,target in [('current',url),('baseline',base+'/__baseline/'+RUNTIME)]:
                        context=browser.new_context(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce',service_workers='block');context.add_init_script('('+GPU_PROBE+')()');page=context.new_page();ready(page,target)
                        initial=metrics(page);draw={}
                        for zone in ['atrium','newmoon','mili','gogo']:
                            page.evaluate('z=>{__mall.teleport(z);__mall.step(20)}',zone);draw[zone]=state(page)['drawCalls']
                        approach(page);before=metrics(page)
                        for _ in range(12):open_shelf(page);close_shelf(page,'close')
                        after=metrics(page);assert before['gl']==after['gl'] and before['gpu']==after['gpu'] and len(before['resources'])==len(after['resources'])
                        pair[label]={'initial':initial,'draw':draw,'repeatBefore':before,'repeatAfter':after};context.close()
                    current,pinned=pair['current'],pair['baseline']
                    assert pinned['initial']['gpu']==current['initial']['gpu'] and pinned['initial']['gl']==current['initial']['gl']
                    assert max(current['draw'].values())<=200 and max(pinned['draw'].values())<=200
                    assert sum(r['decoded'] for r in current['initial']['resources'])<=10*1024*1024
                    report['comparison'].append({'viewport':[w,h],**pair})
            report['baselineHashes']={path.lstrip('/'):hashlib.sha256(data).hexdigest() for path,data in baseline.items()}
            browser.close()
        assert report['sourceHashes']==hashes(args.root),'Runtime sources changed during acceptance'
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failures'].append(str(error))
        try:page.screenshot(path=str(args.output/'failure.png'))
        except Exception:pass
        raise
    finally:
        server.shutdown();(args.output/'results.json').write_text(json.dumps(report,indent=2)+'\n')


if __name__=='__main__':run()
