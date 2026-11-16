"""Portable real-Chrome Shelf acceptance. Outputs evidence outside the source tree by default.

--baseline-ref serves that revision's runtime sources without changing the worktree.
GPU counters are browser-observed GL object balances, not measured device memory/FPS.
"""
import argparse
import functools
import hashlib
import http.server
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import threading

from playwright.sync_api import sync_playwright
from browser_gjh_guide import ROOT, Quiet, state
from gjh_startup_test_helpers import use_individual_assets
from browser_gjh_mode_review import close_event_before_action, finish_close, lose_context
from browser_gjh_modes import close_bag, activate_cart

RUNTIME = 'demos/corporate/gjh/v11/'
BASE = '27414203881ba54d0a30231493699ad7bc4e11c7'
SIZES = [(320,568),(390,844),(667,375),(844,390),(768,1024),(1440,900),
         (650,844),(651,844),(599,844),(600,844),(844,560),(844,561)]
GPU_PROBE = """() => {
  window.__shelfGL={};
  for(const type of ['Buffer','Texture','Program','Shader','Framebuffer','Renderbuffer','VertexArray']) {
    const live=new Set();window.__shelfGL[type]={created:0,deleted:0,live:0};
    const proto=WebGL2RenderingContext.prototype;
    for(const operation of ['create','delete']) {
      const name=operation+type,original=proto[name]; if(!original)continue;
      proto[name]=function(...args){const result=original.apply(this,args),s=__shelfGL[type];
        if(operation==='create'&&result){live.add(result);s.created++;}
        if(operation==='delete'&&live.delete(args[0]))s.deleted++;
        s.live=live.size;return result;};
    }
  }
}"""


def native_close(page, selector, action):
    close_event_before_action(page, selector)
    action()
    finish_close(page)


def approach(page, sku=None):
    # Canonical product placements supply SKU and shelf X. No duplicated positions.
    assets = state(page)['productAssets']['cans']
    sku = sku or next(iter(assets))
    placements = assets[sku]['placements']
    x = sum(p['x'] for p in placements) / len(placements)
    page.evaluate("__mall.teleport('newmoon')")
    page.evaluate('''x => {
      __mall.setInput({forward:1}); __mall.step(3800);
      const dx=x-__mall.state.x;
      __mall.setInput({right:Math.sign(dx)}); __mall.step(Math.abs(dx)/2.65*1000+8);
      __mall.setInput({forward:0}); __mall.step(1000);
    }''', x)
    assert state(page)['nearby'] == f'new-moon-{sku}-front', state(page)
    return f'new-moon-{sku}-front'


def assert_mode(page, mode, base='explore'):
    page.wait_for_function('m=>__mall.mode===m', arg=mode)
    s=state(page)
    assert page.evaluate('document.body.dataset.mode') == s['mode'] == mode
    assert s['paused'] is (mode == 'shelf')
    assert s['modeLayers'] == ([base,'shelf'] if mode=='shelf' else [base])
    assert s['illegalCount'] == 0, s['modeHistory']
    if mode=='shelf':
        assert page.locator('#context-navigation').is_hidden()
        assert page.locator('.mall-overlay').evaluate('e=>e.inert')
    return s


def retained(before, after, camera=True):
    for key in ['x','y','z','seated','seatId','seatPhase','pushing','yaw','pitch','facing','cameraFocus','cameraDistance']:
        assert after[key] == before[key], (key,before[key],after[key])
    assert before['character']['physicalProduct'] == after['character']['physicalProduct']
    if camera: assert before['camera'] == after['camera'], (before['camera'],after['camera'])
    assert before['doors'] == after['doors']


def metrics(page):
    return page.evaluate('''() => ({resources:performance.getEntriesByType('resource').map(e=>({
      path:new URL(e.name).pathname.replace(/^.*\\/v11\\//,''),transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize})),
      gl:structuredClone(__shelfGL),drawCalls:__mall.state.drawCalls,gpu:__mall.state.gpu||null})''')


def geometry(page):
    result=page.evaluate('''() => {
      const rect=e=>e.getBoundingClientRect().toJSON(), stage=rect(document.querySelector('.shelf-stage'));
      const sheet=rect(document.querySelector('.shelf-sheet')),title=rect(document.querySelector('#shelf-title'));
      const header=rect(document.querySelector('.site-header')),disclosure=rect(document.querySelector('#shelf-disclosure'));
      const controls=[...document.querySelectorAll('#shelf-dialog button')].filter(e=>!e.hidden).map(e=>{
        const r=rect(e),s=getComputedStyle(e),ring=parseFloat(s.outlineWidth)+Math.max(0,parseFloat(s.outlineOffset));
        const hits=[[r.x+2,r.y+2],[r.right-2,r.y+2],[r.x+2,r.bottom-2],[r.right-2,r.bottom-2],[r.x+r.width/2,r.y+r.height/2]];
        const range=document.createRange();range.selectNodeContents(e);
        const labels=[...range.getClientRects()].map(r=>r.toJSON());
        return {id:e.id,rect:r,ring,labels,hit:hits.every(([x,y])=>e.contains(document.elementFromPoint(x,y))),hitElements:hits.map(([x,y])=>document.elementFromPoint(x,y)?.id||document.elementFromPoint(x,y)?.className)};
      });
      const text=[...document.querySelectorAll('#shelf-title,#shelf-disclosure,#shelf-status')].map(e=>{const range=document.createRange();range.selectNodeContents(e);return {id:e.id,rect:rect(e),labels:[...range.getClientRects()].map(r=>r.toJSON())};});
      return {stage,sheet,title,header,disclosure,controls,text,focus:document.activeElement.id,
        projected:__mall.state.shelf.projected,overflow:document.documentElement.scrollWidth>innerWidth,
        viewport:[innerWidth,innerHeight],dialog:rect(document.querySelector('#shelf-dialog'))};
    }''')
    w,h=result['viewport']
    assert not result['overflow']
    assert result['dialog']['top'] >= result['header']['bottom']-1
    for control in result['controls']:
        r=control['rect']; ring=max(8,control['ring'])
        assert r['width'] >= 44 and r['height'] >= 44, control
        assert r['left']-ring >= -0.1 and r['right']+ring <= w+0.1 and r['top']-ring >= result['header']['bottom']-0.1 and r['bottom']+ring <= h+0.1,control
        assert control['hit'], control
        for label in control['labels']:
            assert label['left']>=r['left'] and label['right']<=r['right'] and label['top']>=r['top'] and label['bottom']<=r['bottom'],control
    # Font ink can extend outside an unclipped line box. Assert its complete
    # bounds inside the owning sheet, rather than inventing a line-box tolerance.
    for text in result['text']:
        r=result['sheet']
        for label in text['labels']:
            assert label['left']>=r['left'] and label['right']<=r['right'] and label['top']>=r['top'] and label['bottom']<=r['bottom'],text
    p=result['projected'];a=result['stage']
    assert p['left'] >= a['left']+8 and p['right'] <= a['right']-8 and p['top'] >= a['top']+8 and p['bottom'] <= a['bottom']-8,result
    for key in ['sheet','title','disclosure']:
        r=result[key]
        assert r['left']>=0 and r['right']<=w and r['top']>=result['header']['bottom'] and r['bottom']<=h,result
    a=result['stage'];b=result['sheet']
    assert a['right'] <= b['left']+1 or a['bottom'] <= b['top']+1,result
    return result


def nearby_geometry(page):
    result=page.locator('#inspect-prompt').evaluate("""prompt=>{
      const rect=e=>e.getBoundingClientRect().toJSON(),identity=prompt.querySelector('.nearby-card');
      const buttons=[...prompt.querySelectorAll('button')].filter(e=>!e.hidden).map(e=>{
        const r=rect(e),range=document.createRange();range.selectNodeContents(e);
        return {text:e.textContent,rect:r,labels:[...range.getClientRects()].map(r=>r.toJSON()),
          hit:[[2,2],[r.width-2,2],[2,r.height-2],[r.width-2,r.height-2],[r.width/2,r.height/2]].every(([x,y])=>e.contains(document.elementFromPoint(r.x+x,r.y+y)))};
      });
      return {fullPrompt:rect(prompt),identityRow:rect(identity),accessibleName:identity.getAttribute('aria-label'),
        visibleName:document.querySelector('#nearby-name').textContent,buttons,
        notice:[...prompt.querySelectorAll('p')].filter(e=>!e.hidden).map(e=>({text:e.textContent,rect:rect(e)})),
        controls:['#keyboard-help>summary','#mall-map>summary','#joystick','#run-toggle','.scene-disclaimer'].map(s=>document.querySelector(s)).filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.parentElement.id||e.className,rect:rect(e)})),
        viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth};
    }""")
    w,h=result['viewport'];r=result['fullPrompt']
    assert not result['overflow'] and r['left']>=0 and r['right']<=w and r['top']>=0 and r['bottom']<=h,result
    # Baseline full HUD is 120.59px; the 26px identity adds one practical pixel.
    assert r['height']<=122,result
    assert result['identityRow']['height']==26,result
    assert result['accessibleName'] and result['accessibleName'] in page.locator('#inspect').get_attribute('aria-label'),result
    for button in result['buttons']:
        b=button['rect'];assert b['height']>=44 and b['width']>=44 and button['hit'],button
        for label in button['labels']:
            assert label['left']>=b['left'] and label['right']<=b['right'] and label['top']>=b['top'] and label['bottom']<=b['bottom'],button
    for other in result['controls']:
        b=other['rect']
        assert r['right']<=b['left'] or r['left']>=b['right'] or r['bottom']<=b['top'] or r['top']>=b['bottom'],(result,other)
    if len(result['buttons'])==2:
        assert result['buttons'][0]['rect']['top']==result['buttons'][1]['rect']['top'],result
    return result


def physical_paths(page,output):
    rows=[];w=page.viewport_size['width'];h=page.viewport_size['height']
    # South Africa has the longest concise country/type/weight label.
    for sku in ['nz-425g','sa-425g']:
        approach(page,sku)
        if page.get_by_role('button',name='Pick up product',exact=True).is_disabled():
            page.evaluate('__mall.setInput({forward:1});__mall.step(500);__mall.setInput({forward:0});__mall.step(20)')
        page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.step(1500)')
        held=state(page);assert held['character']['physicalProduct']['phase']=='held'
        g=nearby_geometry(page);page.screenshot(path=str(output/f'held-{sku}-{w}x{h}.png'))
        open_shelf(page,'keyboard');before=state(page)
        if not page.locator('#shelf-add').is_disabled():page.locator('#shelf-add').click()
        retained(before,state(page));immediate=close_shelf(page,'close');retained(held,immediate)
        page.emulate_media(reduced_motion='no-preference')
        page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(100)')
        assert state(page)['productApproaching'] and state(page)['character']['physicalProduct']['phase']=='held'
        assert page.locator('#inspect-prompt').is_hidden()
        page.evaluate('__mall.step(500)')
        assert state(page)['character']['physicalProduct']['phase']=='return'
        returning={'phase':'return','promptHiddenDuringExistingTransfer':True}
        page.screenshot(path=str(output/f'returning-{sku}-{w}x{h}.png'))
        page.evaluate('__mall.step(1000)');assert state(page)['character']['physicalProduct']['phase']=='empty'
        # A second pickup proves the same shelf reservation was released correctly.
        page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.step(1500)')
        assert state(page)['character']['physicalProduct']['phase']=='held'
        page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1500)')
        page.emulate_media(reduced_motion='reduce')
        rows.append({'sku':sku,'held':g,'returning':returning,'addPreservesHeldTokenAndReturn':'PASS','configuredCans':held['productAssets']['totalInstances'],'sourceContractVisibleWhileReserved':35})
    return rows


def held_touch_paths(page,context,output):
    rows=[];cdp=context.new_cdp_session(page)
    page.evaluate("""()=>{window.__shelfPointerEvents=[];for(const type of ['pointerdown','pointermove','gotpointercapture','lostpointercapture','pointercancel','pointerup'])document.addEventListener(type,e=>__shelfPointerEvents.push({type,id:e.pointerId,trusted:e.isTrusted,pointerType:e.pointerType,target:e.target.id}),true);}""")
    def touch(kind,x=None,y=None):
        cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if x is None else [{'x':x,'y':y,'id':11}]})
    for ending in ['stale-move-end','cancel-while-shelf']:
        approach(page,'au-425g');page.locator('#scene').focus()
        # Manual stepping consumes the real joystick, not injected input.
        page.evaluate('__mall.setInput(null);__mall.step(0)')
        start=state(page);touch('touchStart',110,380);touch('touchMove',110,344)
        pointer=page.evaluate("__shelfPointerEvents.findLast(e=>e.type==='pointerdown')")
        assert pointer['trusted'] and pointer['pointerType']=='touch',pointer
        assert page.locator('#scene').evaluate('(e,id)=>e.hasPointerCapture(id)',pointer['id'])
        moved=page.evaluate('__mall.step(120)')
        assert start['z']-moved['z']>.1,(start['z'],moved['z'])
        assert page.locator('#joystick').evaluate("e=>e.classList.contains('is-floating')")
        # F enters while the finger is still down and capture is actually held.
        page.keyboard.press('f');assert_mode(page,'shelf');opened=state(page)
        page.wait_for_function('!__mall.state.shelf.transitioning')
        assert not page.locator('#scene').evaluate('(e,id)=>e.hasPointerCapture(id)',pointer['id'])
        assert not page.locator('#joystick').evaluate("e=>e.classList.contains('is-floating')")
        assert page.locator('.joystick-thumb').evaluate('e=>e.style.transform')==''
        page.evaluate('__mall.step(500)');retained(opened,state(page))
        if ending=='cancel-while-shelf':touch('touchCancel')
        page.keyboard.press('Tab');page.keyboard.press('Shift+Tab')
        assert page.locator('#shelf-close').evaluate("e=>e===document.activeElement&&e.matches(':focus-visible')")
        geometry(page);page.screenshot(path=str(output/f'held-touch-{ending}.png'))
        immediate=close_shelf(page,'escape');retained(opened,immediate)
        assert page.locator('#scene').evaluate("e=>e===document.activeElement&&e.matches(':focus-visible')")
        stopped=state(page)
        # Resumed collision/grounding can round Float32 XZ without stale control input.
        post_resume_xz_bound=1e-5
        if ending=='stale-move-end':touch('touchMove',150,325)
        page.wait_for_timeout(120);after=state(page)
        for key in ['x','z','yaw','pitch']:
            if key in ['x','z']:
                assert math.isfinite(stopped[key]) and math.isfinite(after[key]) and abs(after[key]-stopped[key])<=post_resume_xz_bound,(ending,key,stopped[key],after[key],post_resume_xz_bound)
            else:assert after[key]==stopped[key],(ending,key,stopped[key],after[key])
        if ending=='stale-move-end':touch('touchEnd')
        final=page.evaluate('__mall.step(120)')
        for key in ['x','z','yaw','pitch']:
            if key in ['x','z']:
                assert math.isfinite(stopped[key]) and math.isfinite(final[key]) and abs(final[key]-stopped[key])<=post_resume_xz_bound,(ending,key,stopped[key],final[key],post_resume_xz_bound)
            else:assert final[key]==stopped[key],(ending,key)
        events=page.evaluate('__shelfPointerEvents.filter(e=>e.id==='+str(pointer['id'])+')')
        assert any(e['type']=='gotpointercapture' and e['trusted'] for e in events),events
        assert any(e['type']=='lostpointercapture' and e['trusted'] for e in events),events
        if ending=='cancel-while-shelf':assert any(e['type']=='pointercancel' and e['trusted'] for e in events),events
        rows.append({'trustedHeldTouch':ending,'status':'PASS','movementBeforeEntryMetres':start['z']-moved['z'],'events':events,'exactImmediateRestore':True,
            'postResume':{'result':'no-residual-control-movement within bound','absoluteXZBoundMetres':post_resume_xz_bound,'reference':'same original stopped snapshot','exactAngles':['yaw','pitch'],
                'stopped':{k:stopped[k] for k in ['x','y','z','yaw','pitch','frames']},
                'afterLive':{k:after[k] for k in ['x','y','z','yaw','pitch','frames']},
                'afterStep':{k:final[k] for k in ['x','y','z','yaw','pitch','frames']},
                'deltasFromStopped':{label:{k:sample[k]-stopped[k] for k in ['x','y','z','yaw','pitch','frames']} for label,sample in [('afterLive',after),('afterStep',final)]}},
            'visibleFocus':'Shelf close and restored scene'})
    cdp.detach();return rows


def ready(page,url):
    page.goto(url,timeout=60000)
    page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000)
    if page.locator('#guide-dialog').is_visible():
        native_close(page,'#guide-dialog',lambda:page.locator('#guide-start').click())
    page.wait_for_function("document.activeElement.id === 'scene'")


def open_shelf(page,method='pointer'):
    if method=='keyboard':
        page.locator('#scene').focus(); page.keyboard.press('f')
    elif method=='touch': page.locator('#inspect').tap()
    else: page.locator('#inspect').click()
    assert_mode(page,'shelf', 'cart' if state(page)['pushing'] else 'explore')
    page.wait_for_function('!__mall.state.shelf.transitioning')
    assert page.evaluate('document.activeElement.id')=='shelf-close'


def close_shelf(page,method):
    event='keydown' if method=='escape' else 'click'
    page.locator('#shelf-dialog').evaluate('''(dialog,type)=>{
      window.__shelfExit=null;dialog.addEventListener(type,()=>{
        if(!dialog.open)window.__shelfExit=__mall.state;},{once:true});
    }''',event)
    def action():
        if method=='escape':page.keyboard.press('Escape')
        elif method=='backdrop':
            r=page.locator('.shelf-stage').bounding_box();page.mouse.click(r['x']+2,r['y']+2)
        else:page.locator('#shelf-'+method).click()
    native_close(page,'#shelf-dialog',action)
    immediate=page.evaluate('__shelfExit')
    assert immediate is not None
    return immediate


def run():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path(tempfile.gettempdir())/'gallery-shelf-focus-worker'/'browser')
    parser.add_argument('--evidence',type=Path)
    parser.add_argument('--baseline-ref')
    parser.add_argument('--smoke',action='store_true')
    parser.add_argument('--axe',type=Path)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    sources={}
    if args.baseline_ref:
        for name in subprocess.check_output(['git','ls-tree','-r','--name-only',args.baseline_ref,RUNTIME],cwd=ROOT,text=True).splitlines():
            if name.endswith(('.js','.css','.html')):sources['/'+name]=subprocess.check_output(['git','show',args.baseline_ref+':'+name],cwd=ROOT)
    class Handler(Quiet):
        def do_GET(self):
            path=self.path.split('?')[0]
            if path.endswith('/'):path+='index.html'
            if path in sources:
                self.send_response(200);self.send_header('Content-Type',self.guess_type(path));self.end_headers();self.wfile.write(sources[path]);return
            super().do_GET()
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/{RUNTIME}'
    evidence={'baselineRef':args.baseline_ref,'rows':[],'failures':[],'limits':['Software Chrome viewports/insets; no physical device, Safari, screen reader or device FPS claim.']}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
                args=['--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','metal'),'--ignore-gpu-blocklist'])
            evidence['browser']=browser.version
            sizes=[(390,844),(1440,900)] if args.baseline_ref else SIZES[:2] if args.smoke else SIZES
            for w,h in sizes:
                context=browser.new_context(viewport={'width':w,'height':h},has_touch=w<1000,reduced_motion='reduce',service_workers='block')
                context.add_init_script('('+GPU_PROBE+')()')
                page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                ready(page,url)
                row={'viewport':[w,h],'initial':metrics(page),'shelves':[]}
                assert sum(r['decoded'] for r in row['initial']['resources'])<=10*1024*1024
                assert row['initial']['drawCalls']<=200
                for i,sku in enumerate(state(page)['productAssets']['cans']):
                    id=approach(page,sku)
                    if args.baseline_ref:
                        page.screenshot(path=str(args.output/f'nearby-{sku}-{w}.png'))
                        continue
                    nearby=nearby_geometry(page)
                    page.screenshot(path=str(args.output/f'nearby-{sku}-{w}x{h}.png'))
                    page.locator('#scene').focus()
                    # Stop inputs without advancing gameplay while the canonical overlay is active.
                    before=state(page)
                    open_shelf(page,['keyboard','touch' if w<1000 else 'pointer','pointer','keyboard'][i])
                    opened=state(page); retained(before,opened)
                    assert opened['shelf']['id']==id
                    assert opened['productAssets']['totalInstances']==204
                    page.evaluate('__mall.setInput({forward:1,yaw:2});__mall.step(1000)')
                    retained(opened,state(page))
                    frame=state(page)['frames'];page.wait_for_timeout(100)
                    assert state(page)['frames']>frame
                    retained(opened,state(page))
                    g=geometry(page)
                    assert state(page)['drawCalls']<=200
                    page.screenshot(path=str(args.output/f'shelf-{sku}-{w}x{h}.png'))
                    # Every native can's projected center must hit this one SKU target.
                    hits=page.evaluate('''async sku=>{
                      const T=await import('./vendor/three.module.min.js'),s=__mall.state,
                      matrix=new T.Matrix4().fromArray(s.shelf.viewProjection),r=document.querySelector('#scene').getBoundingClientRect();
                      return s.productAssets.cans[sku].placements.map(p=>{
                        const v=new T.Vector3(p.x,p.y+s.productAssets.cans[sku].dimensions[1]/2,p.z).applyMatrix4(matrix);
                        return document.elementFromPoint(r.left+(v.x+1)*r.width/2,r.top+(1-v.y)*r.height/2)?.id;});
                    }''',sku)
                    assert hits==['shelf-target']*9,hits
                    page.locator('#shelf-target').click()
                    count=page.locator('#bag-open').inner_text()
                    page.locator('#shelf-add').click()
                    assert page.locator('#bag-open').inner_text()!=count
                    after_add=state(page);retained(opened,after_add)
                    assert after_add['character']['carrying']['count']==opened['character']['carrying']['count']+1
                    # Tab all native controls and measure their actual focus rings.
                    keyboard=[]
                    for selector in ['#shelf-back','#shelf-close','#shelf-target','#shelf-details','#shelf-add']:
                        page.locator(selector).focus();page.keyboard.press('Tab');page.keyboard.press('Shift+Tab')
                        assert page.locator(selector).evaluate('e=>e===document.activeElement'), (selector,page.evaluate('document.activeElement.outerHTML'))
                        keyboard.append(geometry(page)['focus'])
                        if selector=='#shelf-target':
                            assert page.locator(selector).evaluate("e=>e.matches(':focus-visible')")
                            page.screenshot(path=str(args.output/f'shelf-target-focus-{sku}-{w}x{h}.png'))
                    method=['close','back','escape','backdrop'][i]
                    immediate=close_shelf(page,method)
                    assert_mode(page,'explore');retained(before,immediate)
                    assert page.evaluate('document.activeElement.id')==('scene' if i in [0,3] else 'inspect')
                    row['shelves'].append({'id':id,'nearby':nearby,'geometry':g,'canHits':hits,'close':method,'keyboard':keyboard,'gpu':metrics(page)})
                if not args.baseline_ref and (w,h) in [(320,568),(667,375),(844,390)]:
                    row['physicalHud']=physical_paths(page,args.output)
                row['afterApproach']=metrics(page);row['errors']=errors
                assert not errors,errors
                if not args.baseline_ref and (w,h)==(390,844):
                    row['physicalHud']=physical_paths(page,args.output)
                    row['paths']=extra_paths(page,url,args.output,context,browser,args.axe)
                evidence['rows'].append(row)
                print(f'PASS {w}x{h}',flush=True);context.close()
            if not args.baseline_ref and not args.smoke:
                evidence['assetFailures']=failure_paths(browser,url,args.output)
            browser.close()
        evidence['status']='PASS'
    except Exception as error:
        evidence['status']='FAIL';evidence['failures'].append(str(error))
        try:page.screenshot(path=str(args.output/'failure.png'))
        except Exception:pass
        raise
    finally:
        server.shutdown()
        evidence['sourceHashes']=({path.lstrip('/'):hashlib.sha256(data).hexdigest() for path,data in sources.items()} if args.baseline_ref else {str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in (ROOT/RUNTIME).rglob('*') if f.is_file() and f.suffix in ['.js','.css','.html']})
        destination=args.evidence or args.output/'results.json'
        destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_text(json.dumps(evidence,indent=2)+'\n')


def extra_paths(page,url,output,context,browser,axe):
    rows=[]
    id=approach(page)
    # Explicit detail handoff must retain the surviving scene/Inspect focus owner.
    for method in ['keyboard','pointer']:
        open_shelf(page,method);before=state(page)
        native_close(page,'#shelf-dialog',lambda:page.locator('#shelf-details').click())
        page.locator('#product-dialog').wait_for(state='visible')
        assert not page.locator('#shelf-dialog').evaluate('e=>e.open')
        assert state(page)['mode']=='inspect' and state(page)['illegalCount']==0
        retained(before,state(page))
        native_close(page,'#product-dialog',lambda:page.locator('#product-close').click())
        assert page.evaluate('document.activeElement.id')==('scene' if method=='keyboard' else 'inspect')
        rows.append({'details':method,'status':'PASS','exactRestoreBeforeDetail':True})
    # A reachable Cart shelf retains its canonical base and exact frozen pose.
    approach(page,'au-425g');page.locator('#bag-open').click();activate_cart(page)
    assert_mode(page,'cart','cart');page.evaluate('__mall.step(1000)');before=state(page)
    open_shelf(page,'keyboard');assert_mode(page,'shelf','cart');retained(before,state(page))
    page.locator('#shelf-add').click();immediate=close_shelf(page,'escape');retained(before,immediate)
    assert_mode(page,'cart','cart')
    page.locator('#bag-open').click();page.locator('#cart-toggle').click()
    assert not state(page)['pushing'];close_bag(page);assert_mode(page,'explore')
    rows.append({'retainedCartShelf':'PASS','exactSynchronousRestore':True})
    approach(page)
    # Max nine changes the shared selection only. No reservation is acquired.
    open_shelf(page)
    while not page.locator('#shelf-add').is_disabled():page.locator('#shelf-add').click()
    assert 'Demo bag: 9' in page.locator('#shelf-status').inner_text()
    assert page.evaluate('document.activeElement.id')=='shelf-details'
    rows.append({'nineActualAddLimit':'PASS','focusAtLimit':'shelf-details'})
    before=state(page)
    page.locator('#bag-open').click();page.locator('#bag-dialog').wait_for(state='visible')
    assert page.locator('#shelf-dialog').is_hidden() and state(page)['mode']=='shop'
    assert state(page)['illegalCount']==0
    retained(before,state(page));close_bag(page)
    open_shelf(page);page.locator('#view-toggle').click()
    assert page.locator('#shelf-dialog').is_hidden() and page.locator('#store-list').is_visible()
    assert page.evaluate('document.activeElement.id')=='list-title'
    page.locator('#view-toggle').click();page.wait_for_function("__mall.mode==='explore'")
    rows.append({'bagListMaxNine':'PASS'})
    # Native external modal entry and Map must also cancel Shelf without stale focus.
    for selector in ['#product-dialog','#bag-dialog','#original-tin-dialog','#guide-dialog']:
        approach(page);open_shelf(page)
        page.locator(selector).evaluate('e=>e.showModal()')
        page.wait_for_function("!document.querySelector('#shelf-dialog').open")
        assert state(page)['illegalCount']==0,state(page)['modeHistory']
        native_close(page,selector,lambda:page.locator(selector).evaluate('e=>e.close()'))
        rows.append({'genericModal':selector,'status':'PASS'})
    approach(page);open_shelf(page);page.locator('#header-map').click()
    assert page.locator('#shelf-dialog').is_hidden()
    page.keyboard.press('Escape');page.wait_for_function("__mall.mode==='explore'")
    # GL object balance and request count remain stable across repeated entry/exit.
    approach(page);before=metrics(page)
    for _ in range(12):open_shelf(page);close_shelf(page,'close')
    after=metrics(page)
    assert before['gl']==after['gl'],(before['gl'],after['gl'])
    assert before['gpu']==after['gpu']
    assert len(before['resources'])==len(after['resources'])
    rows.append({'repeatEntries':12,'before':before,'after':after})
    # Establish a stopped, grounded reference before testing held-input cleanup.
    # Repeated modal frames alone need not finish Rapier's initial floor settling.
    page.evaluate('__mall.setInput({forward:0,right:0});__mall.step(2000);__mall.setInput(null)')
    # Held keyboard: synchronous exact restore is separate from resumed floor settling.
    page.locator('#scene').focus();page.keyboard.down('w');page.keyboard.down('f');page.keyboard.up('f')
    assert_mode(page,'shelf');opened=state(page)
    page.locator('#shelf-dialog').evaluate('''e=>e.addEventListener('keydown',event=>{
      if(event.key==='Escape')window.__shelfImmediateExit=__mall.state;},{once:true})''')
    close_shelf(page,'escape');retained(opened,page.evaluate('__shelfImmediateExit'))
    page.keyboard.up('w');page.wait_for_timeout(120)
    after=state(page)
    assert abs(after['y']-opened['y'])<=1e-5, ('resumed ground settling (metres)',opened['y'],after['y'])
    for key in ['x','z','yaw','pitch','seated','pushing']:assert after[key]==opened[key],(key,opened[key],after[key])
    rows.append({'heldKeyboard':'PASS','synchronousExactCameraRestore':True,'resumedGroundDeltaY':after['y']-opened['y'],'groundToleranceMetres':1e-5})
    rows.extend(held_touch_paths(page,context,output))
    # Normal motion animates only the presentation camera while physics stays frozen.
    page.emulate_media(reduced_motion='no-preference');approach(page);before=state(page)
    page.locator('#inspect').click();assert_mode(page,'shelf')
    assert state(page)['shelf']['transitioning']
    page.wait_for_function('!__mall.state.shelf.transitioning');retained(before,state(page))
    immediate=close_shelf(page,'close');retained(before,immediate)
    page.emulate_media(reduced_motion='reduce');rows.append({'animatedPresentationOnly':'PASS'})
    for small,large in [((390,844),(768,1024)),((650,844),(651,844)),((844,560),(844,561))]:
        page.set_viewport_size({'width':small[0],'height':small[1]});page.wait_for_timeout(100)
        approach(page);open_shelf(page,'keyboard')
        for _ in range(15):
            if page.evaluate('document.activeElement.id')=='header-map':break
            page.keyboard.press('Tab')
        assert page.locator('#header-map').evaluate("e=>e===document.activeElement&&e.matches(':focus-visible')")
        page.set_viewport_size({'width':large[0],'height':large[1]})
        page.wait_for_function("document.querySelector('#header-map').hidden && document.activeElement.id==='shelf-close'")
        assert_mode(page,'shelf');g=geometry(page)
        assert page.locator('#shelf-close').evaluate("e=>e.matches(':focus-visible')")
        page.screenshot(path=str(output/f'resize-map-focus-{small[0]}x{small[1]}-{large[0]}x{large[1]}.png'))
        close_shelf(page,'close');rows.append({'mapDisappearingFocus':{'from':small,'to':large,'owner':'shelf-close','geometry':g}})
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);approach(page)
    # Resize reframes and then returns a valid responsive normal camera.
    open_shelf(page);before=state(page)
    page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(100)
    page.screenshot(path=str(output/'resize-before-geometry.png'))
    g=geometry(page);retained(before,state(page),camera=False)
    close_shelf(page,'close')
    assert page.locator('#scene').evaluate('(e)=>e.clientWidth/e.clientHeight')==state(page)['camera']['aspect']
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
    rows.append({'resize':g})
    # Software safe-area stress, explicitly separate from a physical device.
    cdp=context.new_cdp_session(page)
    for w,h,insets in [(390,844,{'top':44,'bottom':34,'left':0,'right':0}),(667,375,{'top':20,'bottom':24,'left':30,'right':30})]:
        page.set_viewport_size({'width':w,'height':h})
        cdp.send('Emulation.setSafeAreaInsetsOverride',{'insets':insets})
        page.wait_for_timeout(100);approach(page);open_shelf(page)
        g=geometry(page);page.screenshot(path=str(output/f'shelf-insets-{w}.png'))
        close_shelf(page,'close');rows.append({'softwareInsets':insets,'geometry':g})
    cdp.send('Emulation.setSafeAreaInsetsOverride',{'insets':{'top':0,'bottom':0,'left':0,'right':0}})
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
    # Disable Playwright's focus emulation before exercising real browser blur.
    cdp.send('Emulation.setFocusEmulationEnabled',{'enabled':False})
    page.bring_to_front();approach(page);open_shelf(page);before=state(page)
    page.evaluate("window.addEventListener('blur',()=>window.__shelfBlurExit=__mall.state,{once:true})")
    other=context.new_page();other.goto('about:blank');other.bring_to_front();page.wait_for_timeout(100)
    assert not page.locator('#shelf-dialog').evaluate('e=>e.open')
    retained(before,page.evaluate('__shelfBlurExit'))
    other.close();page.bring_to_front()
    rows.append({'realWindowBlur':'PASS','documentHiddenObserved':page.evaluate('document.hidden')})
    cdp.send('Emulation.setFocusEmulationEnabled',{'enabled':True})
    # This Chrome harness keeps document.hidden false during the observed window blur. Exercise this independent owner branch
    # using the same explicit document-visibility fixture as the existing V11 suite.
    approach(page);open_shelf(page)
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    assert page.locator('#shelf-dialog').is_hidden()
    assert state(page)['hidden']
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    rows.append({'injectedDocumentHiddenFixture':'PASS','realDocumentHidden':'NOT_VERIFIED: actual window blur observed, document.hidden stayed false'})
    if axe:
        approach(page)
        page.add_script_tag(path=str(axe))
        nearby_axe=page.evaluate("async()=>{const r=await axe.run(document.querySelector('#inspect-prompt'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),passes:r.passes.length};}")
        assert not nearby_axe['violations'],nearby_axe
        rows.append({'axeNearby':nearby_axe});open_shelf(page)
        result=page.evaluate("async()=>{const r=await axe.run(document.querySelector('#shelf-dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),passes:r.passes.length};}")
        assert not result['violations'],result
        rows.append({'axeShelf':result});close_shelf(page,'close')
    # Actual driver context loss is the terminal failure case for this page.
    approach(page);open_shelf(page);lose_context(page)
    assert page.locator('#shelf-dialog').is_hidden() and state(page)['mode']=='menu'
    assert page.evaluate('document.activeElement.id')=='list-title'
    assert state(page)['illegalCount']==0
    rows.append({'actualContextLoss':'PASS'})
    return rows


def failure_paths(browser,url,output):
    rows=[]
    for label,pattern in [('shelf-unavailable','**/gjh-m056-shelf-lod1.glb'),
                          *[(f'can-{sku}-unavailable',f'**/new-moon-can-{sku}-lod1.glb') for sku in ['nz-425g','au-425g','sa-425g','mx-454g']]]:
        context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,
            reduced_motion='reduce',service_workers='block')
        page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        use_individual_assets(page)
        page.route(pattern,lambda route:route.abort())
        ready(page,url);sku='nz-425g' if label.startswith('shelf') else label.removeprefix('can-').removesuffix('-unavailable')
        id=approach(page,sku);assets=state(page)['productAssets']
        assert (assets['shelf'] if label.startswith('shelf') else assets['cans'][sku])['status']=='fallback'
        before=state(page);open_shelf(page);g=geometry(page)
        page.locator('#shelf-add').click();assert page.locator('#bag-open').inner_text()=='Bag (1)'
        immediate=close_shelf(page,'close');retained(before,immediate)
        page.get_by_role('button',name='Pick up product',exact=True).click();page.evaluate('__mall.step(1500)')
        assert state(page)['character']['physicalProduct']['phase']==('held' if label.startswith('shelf') else 'empty')
        if label.startswith('shelf'):
            page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1500)')
        open_shelf(page);page.screenshot(path=str(output/(label+'.png')));close_shelf(page,'close')
        assert not errors,errors
        rows.append({'failure':label,'expectedFailedResource':pattern,'geometry':g,'sharedQuantityOnly':'PASS',
                     'physicalPickupAvailability':'PASS','pageErrors':errors})
        context.close()
    return rows


if __name__=='__main__':run()
