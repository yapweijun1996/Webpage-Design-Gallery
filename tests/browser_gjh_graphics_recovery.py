"""Portable real-context recovery and quality acceptance; no device/FPS certification.

Native WEBGL_lose_context is used only here. Hardware/hidden/validation-fault
fixtures are explicitly labelled. Raw evidence defaults outside the checkout.
"""
from gjh_startup_test_helpers import mall_entry_url
import argparse
import functools
import hashlib
import http.server
import io
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import traceback

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
from browser_gjh_guide import ROOT, Quiet, state
from browser_gjh_modes import approach_seat, activate_cart, close_bag
from browser_gjh_mode_review import close_event_before_action, finish_close, add_selection
from browser_gjh_shelf_focus import approach, open_shelf, close_shelf
from browser_gjh_all_seats import move
from browser_gjh_context_navigation_insets import PROFILES, settle

RUNTIME = 'demos/corporate/gjh/v11/'
BASE = '36d56c49283a4e1a794ba0ec15650aea85bdc615'
SIZES = [(320,568),(390,844),(667,375),(844,390),(768,1024),(1440,900),
         (599,844),(600,844),(650,844),(651,844),(999,900),(1000,900),(1001,900),(844,560),(844,561)]

# Context loss invalidates handles without calling delete. Keep every old epoch,
# including invalidation counts; only compare current epochs after restoration.
PROBE = """() => {
  window.__graphicsProbe={contexts:0,rendererBuilds:0,epochs:[],listeners:{},timeline:[]};
  const attr=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(name,value){if(this.id==='scene'&&name==='data-engine')__graphicsProbe.rendererBuilds++;return attr.call(this,name,value);};
  const add=EventTarget.prototype.addEventListener, seen=new WeakSet();
  EventTarget.prototype.addEventListener=function(type,listener,...rest){
    if(this instanceof HTMLCanvasElement && this.id==='scene'){
      const counts=__graphicsProbe.listeners;counts[type]=(counts[type]||0)+1;
    }return add.call(this,type,listener,...rest);
  };
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){
    const gl=get.call(this,type,...args);
    if(this.id!=='scene'||type!=='webgl2'||!gl||seen.has(gl))return gl;
    seen.add(gl);__graphicsProbe.contexts++;
    const kinds=['Buffer','Texture','Program','Shader','Framebuffer','Renderbuffer','VertexArray'];
    let live,epoch;
    function start(){live=Object.fromEntries(kinds.map(k=>[k,new Set()]));
      epoch=Object.fromEntries(kinds.map(k=>[k,{created:0,deleted:0,invalidated:0,live:0}]));
      __graphicsProbe.epochs.push(epoch);}
    start();
    add.call(this,'webglcontextlost',()=>{for(const k of kinds){epoch[k].invalidated+=live[k].size;live[k].clear();epoch[k].live=0;}});
    add.call(this,'webglcontextrestored',()=>{start();__graphicsProbe.timeline.push('native-restore');});
    const read=gl.readPixels.bind(gl);gl.readPixels=(...args)=>{__graphicsProbe.timeline.push('readPixels');return read(...args);};
    for(const kind of kinds)for(const op of ['create','delete']){
      const name=op+kind,original=gl[name].bind(gl);
      gl[name]=(...args)=>{const result=original(...args),s=epoch[kind];
        if(op==='create'&&result){live[kind].add(result);s.created++;}
        if(op==='delete'&&live[kind].delete(args[0]))s.deleted++;
        s.live=live[kind].size;return result;};
    }return gl;
  };
}"""


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_hashes(root):
    return {str(p.relative_to(root)):digest(p.read_bytes()) for p in (root/RUNTIME).rglob('*')
            if p.is_file() and p.suffix in ['.js','.css','.html']}


def native_close(page, selector, action):
    close_event_before_action(page, selector)
    action()
    finish_close(page)


def loss(page):
    page.evaluate("""() => {
      const gl=document.querySelector('#scene').getContext('webgl2');
      window.__lossExtension=gl.getExtension('WEBGL_lose_context');
      if(!__lossExtension)throw Error('Real context-loss extension unavailable');
      __lossExtension.loseContext();
    }""")
    page.wait_for_function('__mall.state.graphics.status === "lost" || __mall.state.graphics.status === "failed"')
    assert not page.evaluate('__mall.ready')
    assert page.locator('#store-list').is_visible()
    assert page.locator('#graphics-return').is_hidden()
    assert page.locator('#graphics-reload').is_visible()


def restore(page):
    page.evaluate('__lossExtension.restoreContext()')
    page.wait_for_function('__mall.ready && __mall.state.graphics.validations>0', timeout=60000)
    assert page.locator('#store-list').is_visible()
    assert page.locator('#graphics-return').is_visible()
    s=state(page)
    assert s['graphics']['quality']['tier']=='low' and s['pixelRatio']<=1
    assert s['paused'] and not s['graphics']['shadows']
    assert not s['elevatorTravel'] and not s['pushing'] and not s['seated']
    assert s['illegalCount']==0, s['modeHistory']
    timeline=page.evaluate('__graphicsProbe.timeline')
    if 'after-Three-listener' in timeline:
        assert timeline.index('after-Three-listener')<timeline.index('readPixels'),timeline
    return s


def enter(page):
    page.locator('#graphics-return').click()
    page.wait_for_function('__mall.mode==="explore" && document.activeElement.id==="scene"')
    assert page.locator('#store-list').is_hidden()


def freeze(page):
    page.evaluate('__mall.setInput({});__mall.step(17)')
    settle(page)


def metrics(page):
    return page.evaluate("""() => ({resources:performance.getEntriesByType('resource').map(e=>({
      path:new URL(e.name).pathname.replace(/^.*\\/v11\\//,''),decoded:e.decodedBodySize})),
      gl:structuredClone(__graphicsProbe),gpu:__mall.state.gpu,drawCalls:__mall.state.drawCalls,
      graphics:__mall.state.graphics})""")


def paused_exact(page, before):
    page.wait_for_timeout(120)
    page.evaluate('__mall.step(120)')
    after=state(page)
    for key in ['x','y','z','yaw','pitch','camera','doors']:
        assert before[key]==after[key], (key,before[key],after[key])
    assert before['frames']==after['frames']


def keyboard_move(page):
    page.evaluate('__mall.setInput(null)');page.locator('#scene').focus()
    before=state(page);page.keyboard.down('w')
    page.wait_for_function('p=>Math.hypot(__mall.state.x-p.x,__mall.state.z-p.z)>.12',arg=before)
    page.keyboard.up('w');freeze(page)
    return {'before':[before['x'],before['z']], 'after':[state(page)['x'],state(page)['z']]}


def run():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=ROOT);ap.add_argument('--prefix',default='')
    ap.add_argument('--output',type=Path,default=Path(tempfile.gettempdir())/'gallery-graphics-worker'/'focused')
    ap.add_argument('--smoke',action='store_true')
    ap.add_argument('--axe',type=Path)
    args=ap.parse_args();root=args.root.resolve();args.output.mkdir(parents=True,exist_ok=True)
    initial_hashes=source_hashes(root);baseline={}
    for name in subprocess.check_output(['git','ls-tree','-r','--name-only',BASE,RUNTIME],cwd=ROOT,text=True).splitlines():
        if name.endswith(('.js','.css','.html')):
            baseline[name]=subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT)
    prefix='/' + args.prefix.strip('/') if args.prefix.strip('/') else ''
    class Handler(Quiet):
        def do_GET(self):
            path=self.path.split('?')[0]
            if prefix and not path.startswith(prefix+'/'):
                self.send_error(404);return
            path=path[len(prefix):]
            if path.startswith('/baseline/'):
                relative=path.removeprefix('/baseline/')
                source=baseline.get(relative)
                if source is not None:
                    self.send_response(200);self.send_header('Content-Type',self.guess_type(relative));self.end_headers();self.wfile.write(source);return
                self.path='/' + relative
            else:self.path=path
            return super().do_GET()
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}{prefix}';url=base+'/'+RUNTIME
    report={'baselineRef':BASE,'root':str(root),'prefix':prefix,'sourceHashes':initial_hashes,
            'testSHA256':digest(Path(__file__).read_bytes()),'rows':[],'frames':[],
            'limits':['Native Chrome/ANGLE Metal desktop laboratory; no physical-device, Safari, screen-reader, OS-hidden or FPS certification',
                      'Hardware overrides, hidden-state simulation and readPixels fault injection are labelled fixtures',
                      'GL epochs record invalidated handles separately; counts are not device memory measurements']}
    errors=[]
    def save():
        (args.output/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    def row(kind,**values):
        report['rows'].append({'case':kind,**values});save();print(kind,flush=True)
    def shot(page,name,scene=False):
        data=page.locator('#scene').screenshot() if scene else page.screenshot()
        path=args.output/(name+'.png');path.write_bytes(data)
        im=Image.open(io.BytesIO(data)).convert('RGB');colors=im.getcolors(im.width*im.height)
        if scene:
            assert len(colors)>150, (name,len(colors))
            assert max(ImageStat.Stat(im).stddev)>10,(name,ImageStat.Stat(im).stddev)
        record={'name':name,'path':str(path),'sha256':digest(data),'size':list(im.size),'colors':len(colors)}
        report['frames'].append(record);return data
    def context(browser,width=390,height=844,fixture=None,motion='reduce',dpr=2):
        c=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,has_touch=width<1000,
                              reduced_motion=motion,service_workers='block')
        c.add_init_script('('+PROBE+')()')
        if fixture:c.add_init_script(fixture)
        page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        return c,page
    def ready(page,target=url,start=True):
        page.goto(mall_entry_url(target));page.wait_for_function('window.__mall?.ready && window.__sceneReady',timeout=60000)
        if page.locator('#guide-card').is_visible():page.locator('#guide-skip').click()
        if start:page.locator('#scene').focus()
        else:page.locator('#view-toggle').click()
        page.locator('#scene').evaluate("e=>e.addEventListener('webglcontextrestored',()=>__graphicsProbe.timeline.push('after-Three-listener'))")
        freeze(page)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=[
                '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','metal'),'--ignore-gpu-blocklist'])
            report['browser']=browser.version
            c,page=context(browser);ready(page)
            report['nativeHardware']=page.evaluate("""() => {
              const gl=document.querySelector('#scene').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');
              return {cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory??null,dpr:devicePixelRatio,
                vendor:gl.getParameter(e.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(e.UNMASKED_RENDERER_WEBGL)};
            }""")
            assert 'Metal' in report['nativeHardware']['renderer'],report['nativeHardware'];c.close()
            # Paired cold resource and draw baselines from the exact pinned sources.
            for width,height in [(390,844),(1440,900)]:
                for label,target in [('baseline',base+'/baseline/'+RUNTIME),('candidate',url)]:
                    c,page=context(browser,width,height);ready(page,target)
                    calls={}
                    for zone in ['atrium','newmoon','mili','gogo']:
                        page.evaluate('z=>{__mall.teleport(z);__mall.step(17)}',zone);calls[zone]=state(page)['drawCalls']
                    m=metrics(page);resources=m['resources'];total=sum(r['decoded'] for r in resources)
                    assert total<=10*1024*1024 and max(calls.values())<=200,(total,calls)
                    row('resources',revision=label,viewport=[width,height],count=len(resources),decodedBytes=total,
                        calls=calls,metrics=m)
                    shot(page,f'{label}-{width}-gogo',True);c.close()
            # Actual loss and restore across all modes; each restore retains directory/modal focus.
            for width,height in [(390,844),(1440,900)]:
                for mode in (['explore'] if args.smoke else ['explore','shelf','inspect','shop','cart','seated']):
                    c,page=context(browser,width,height);ready(page)
                    if mode in ['shelf','inspect']:
                        approach(page);page.locator('#inspect').click();page.wait_for_function('__mall.mode==="shelf"')
                        if mode=='inspect':native_close(page,'#shelf-dialog',lambda:page.locator('#shelf-details').click())
                    elif mode in ['shop','cart']:
                        page.locator('#view-toggle').click();add_selection(page);page.locator('#view-toggle').click();page.locator('#bag-open').click()
                        if mode=='cart':activate_cart(page);freeze(page)
                    elif mode=='seated':
                        approach_seat(page);page.locator('#inspect').click();page.wait_for_function('__mall.state.seated');freeze(page)
                    before=state(page);assert before['mode']==mode,(mode,before['mode'])
                    if mode=='inspect':close_event_before_action(page,'#product-dialog')
                    loss(page)
                    if mode=='inspect':finish_close(page)
                    after_loss=state(page);focus=page.evaluate('document.activeElement.id')
                    selection=page.locator('#bag-open').inner_text();paused_exact(page,after_loss)
                    after_restore=restore(page);paused_exact(page,after_restore)
                    assert page.evaluate('document.activeElement.id')==focus
                    assert page.locator('#bag-open').inner_text()==selection
                    assert after_loss['character']['physicalProduct']==after_restore['character']['physicalProduct']
                    shot(page,f'{width}-{mode}-restored-directory')
                    if mode=='inspect':assert page.locator('#product-dialog').is_hidden()
                    if mode=='shop':close_bag(page)
                    enter(page);freeze(page);shot(page,f'{width}-{mode}-reentered',True)
                    page.evaluate('__mall.teleport("atrium")');movement=keyboard_move(page)
                    row('native-mode-recovery',viewport=[width,height],mode=mode,before=before,afterLoss=after_loss,
                        afterRestore=after_restore,focus=focus,bag=selection,movement=movement,metrics=metrics(page))
                    c.close()
            # Repeated epochs and real texture/shelf frames at Low, with no scene/asset/listener growth.
            for width,height in [(390,844),(1440,900)]:
                c,page=context(browser,width,height,fixture="localStorage.setItem('gjh-v11-graphics-quality-v1','low')");ready(page)
                page.locator('#keyboard-help>summary').click();page.select_option('#graphics-quality','low')
                page.locator('#keyboard-help>summary').click();freeze(page)
                images={}
                for sku in ['nz-425g','au-425g','sa-425g','mx-454g']:
                    approach(page,sku);page.locator('#inspect').click();page.wait_for_function('__mall.mode==="shelf"')
                    images[sku]=shot(page,f'{width}-{sku}-before',True);close_shelf(page,'close')
                def warm_views():
                    for zone in ['atrium','newmoon','mili','gogo']:
                        page.evaluate('z=>{__mall.teleport(z);__mall.step(17)}',zone)
                    for sku in images:
                        approach(page,sku);open_shelf(page);close_shelf(page,'close')
                    freeze(page)
                warm_views();before=metrics(page);cycles=[]
                for cycle in range(3):
                    loss(page);restore(page);enter(page);warm_views()
                    m=metrics(page);cycles.append(m)
                    report['repeatProgress']={'before':before,'cycles':cycles};save()
                    assert m['gl']['contexts']==m['gl']['rendererBuilds']==1 and m['gl']['listeners']==before['gl']['listeners']
                    for key in ['sceneId','cameraId','sceneChildren']:
                        assert m['graphics'][key]==before['graphics'][key],(key,before['graphics'][key],m['graphics'][key])
                    assert len(m['resources'])==len(before['resources']), (len(m['resources']),len(before['resources']))
                    assert m['gpu']['geometries']==before['gpu']['geometries']
                    assert m['gpu']['textures']==before['gpu']['textures']
                    if cycle:assert {k:v['live'] for k,v in m['gl']['epochs'][-1].items()}=={k:v['live'] for k,v in cycles[0]['gl']['epochs'][-1].items()}
                comparisons=[]
                for sku in images:
                    approach(page,sku);page.locator('#inspect').click();page.wait_for_function('__mall.mode==="shelf"')
                    data=shot(page,f'{width}-{sku}-after',True)
                    a=Image.open(io.BytesIO(images[sku])).convert('RGB');b=Image.open(io.BytesIO(data)).convert('RGB')
                    difference=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
                    assert difference<2,(sku,difference)
                    comparisons.append({'sku':sku,'meanRGBDifference':difference});close_shelf(page,'close')
                row('repeated-native-recovery',viewport=[width,height],before=before,cycles=cycles,texturedFrameComparisons=comparisons)
                c.close()
            if not args.smoke:
                for modal in ['bag','product-close','product-preview']:
                    c,page=context(browser);ready(page)
                    page.locator('#view-toggle').click();add_selection(page)
                    if modal=='bag':
                        page.locator('#bag-open').click();page.locator('#bag-items button').first.focus()
                    else:
                        page.locator('.product-card [data-inspect]').nth(3).click()
                        if modal=='product-preview':
                            page.wait_for_function('__newMoonPreview.state.loaded',timeout=60000)
                            page.locator('#product-preview-canvas').focus()
                    focus=page.evaluate('document.activeElement.id || document.activeElement.dataset.bagFocus')
                    sku=page.locator('#product-image').get_attribute('src')
                    loss(page)
                    if modal=='bag':
                        after=restore(page)
                        assert page.locator('#bag-dialog').is_visible()
                        assert not page.locator('#cart-controls').is_hidden()
                        assert not page.locator('#cart-toggle').is_disabled()
                        assert page.evaluate('document.activeElement.id || document.activeElement.dataset.bagFocus')==focus
                        assert page.locator('#bag-open').inner_text()=='Bag (1)'
                        # Existing ready-directory Cart entry remains directly usable.
                        activate_cart(page);assert state(page)['pushing']
                        keyboard_move(page)
                    elif modal=='product-preview':
                        restore(page)
                        assert page.locator('#product-dialog').is_visible()
                        assert page.evaluate('document.activeElement.id')==focus
                        assert page.locator('#product-image').get_attribute('src')==sku
                        assert page.evaluate('__newMoonPreview.state.loaded && __newMoonPreview.state.activeResources===1')
                        assert not page.locator('#product-preview-canvas').evaluate("e=>e.getContext('webgl2').isContextLost()")
                        native_close(page,'#product-dialog',lambda:page.locator('#product-close').click())
                        assert page.evaluate('__newMoonPreview.state.activeResources===0')
                    else:
                        close_event_before_action(page,'#product-dialog')
                        page.evaluate('__lossExtension.restoreContext()');page.locator('#product-close').click();finish_close(page)
                        page.wait_for_function('__mall.ready')
                        assert page.locator('#store-list').is_visible()
                        assert page.locator('#product-image').get_attribute('src')==sku
                        assert page.locator('.product-card [data-inspect]').nth(3).evaluate('e=>e===document.activeElement'),page.evaluate('document.activeElement.outerHTML')
                        focus=page.evaluate('document.activeElement.dataset.inspect')
                    row('native-modal-restore-race',modal=modal,focus=focus,sku=sku,metrics=metrics(page));c.close()
                # A second actual loss invalidates the first restore's queued task.
                c,page=context(browser);ready(page);loss(page)
                page.locator('#scene').evaluate("e=>e.addEventListener('webglcontextrestored',()=>__lossExtension.loseContext(),{once:true})")
                page.evaluate('__lossExtension.restoreContext()')
                page.wait_for_function('__mall.state.graphics.losses===2 && !__mall.ready')
                assert state(page)['graphics']['validations']==0
                restore(page);enter(page);keyboard_move(page)
                row('second-native-loss-invalidates-pending-restore',metrics=metrics(page));c.close()
                # Completion while the actual context remains lost cannot publish ready.
                c,page=context(browser);pending=[]
                page.route('**/assets/world.bundle.js',lambda r:pending.append(r));page.goto(mall_entry_url(url),wait_until='domcontentloaded')
                for _ in range(150):
                    if pending:break
                    page.wait_for_timeout(20)
                assert pending;loss(page);pending.pop().continue_();page.unroute('**/assets/world.bundle.js')
                page.wait_for_function('__mall.state.graphics.initialized',timeout=60000)
                assert not page.evaluate('__mall.ready') and page.locator('#graphics-return').is_hidden()
                restore(page);enter(page);freeze(page)
                row('initialization-completes-while-native-context-lost',metrics=metrics(page));c.close()
                # Physical shelf products retain their own reservation; no bag quantity is invented.
                c,page=context(browser);ready(page);approach(page)
                page.locator('#inspect-prompt button').filter(has_text='Pick up product').click();page.evaluate('__mall.step(1500)')
                held=state(page)['character']['physicalProduct'];assert held['phase']=='held',held
                loss(page);restore(page);assert state(page)['character']['physicalProduct']==held
                enter(page);freeze(page)
                page.locator('#inspect-prompt button').filter(has_text='Return to shelf').click();page.evaluate('__mall.step(1500)')
                assert state(page)['character']['physicalProduct']['phase']=='empty'
                assert page.locator('#bag-open').inner_text()=='Bag (0)'
                row('physical-reservation-survives-native-recovery',held=held,metrics=metrics(page));c.close()
                # Trusted CDP touch remains down across loss; stale move/end cannot restart it.
                c,page=context(browser);ready(page)
                page.locator('#scene').evaluate("e=>e.addEventListener('pointerdown',v=>{window.__touchId=v.pointerId;window.__trustedTouch=v.isTrusted})")
                cdp=c.new_cdp_session(page)
                def touch(kind,x=None,y=None):
                    cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if x is None else [{'x':x,'y':y,'id':11}]})
                page.evaluate('__mall.setInput(null);__mall.step(0)');start=state(page)
                touch('touchStart',110,380);touch('touchMove',110,344);page.evaluate('__mall.step(120)')
                assert page.evaluate('__trustedTouch') and start['z']-state(page)['z']>.1
                assert page.locator('#scene').evaluate('e=>e.hasPointerCapture(__touchId)')
                loss(page);stopped=state(page);paused_exact(page,stopped)
                assert not page.locator('#scene').evaluate('e=>e.hasPointerCapture(__touchId)')
                assert page.locator('.joystick-thumb').evaluate('e=>e.style.transform')==''
                restore(page);enter(page)
                touch('touchMove',145,290);touch('touchEnd')
                page.wait_for_timeout(120);after_live=state(page);page.evaluate('__mall.step(120)');after_step=state(page)
                for after in [after_live,after_step]:
                    for key in ['x','z']:
                        assert math.isfinite(after[key]) and abs(after[key]-stopped[key])<=1e-5,(key,stopped[key],after[key])
                    for key in ['yaw','pitch']:assert stopped[key]==after[key]
                row('trusted-held-touch-through-native-recovery',stopped=stopped,afterLive=after_live,afterStep=after_step,
                    perAxisXZBoundMetres=1e-5,angles='exact');c.close()
                # Delayed source responses exercise real initialization awaits, not synthetic ready state.
                for asset,width,height in [('vendor/three.module.min.js',390,844),('assets/world.bundle.js',390,844),('assets/gjh-tripo-visitor{,-2k}.glb',390,844),('assets/world.bundle.js',1440,900)]:
                    c,page=context(browser,width,height);pending=[]
                    page.route('**/'+asset,lambda route:pending.append(route));page.goto(mall_entry_url(url),wait_until='domcontentloaded')
                    page.wait_for_function('window.__mall !== undefined')
                    for _ in range(150):
                        if pending:break
                        page.wait_for_timeout(20)
                    assert pending,asset
                    loss(page);page.evaluate('__lossExtension.restoreContext()')
                    page.wait_for_function('!document.querySelector("#scene").getContext("webgl2").isContextLost()')
                    assert not page.evaluate('__mall.ready')
                    pending.pop().continue_();page.unroute('**/'+asset)
                    page.wait_for_function('__mall.ready',timeout=60000)
                    assert page.locator('#store-list').is_visible() and page.locator('#guide-card').is_hidden()
                    enter(page);freeze(page)
                    assert not page.locator('#mall-map').evaluate('e=>e.open')
                    shot(page,'startup-'+str(width)+'-'+asset.split('/')[-1],True)
                    row('startup-native-loss',viewport=[width,height],awaitedAsset=asset,initialMapOpen=False,metrics=metrics(page));c.close()
                # Real elevator movement interrupted in both halves: nearest-floor settlement and walking.
                for elapsed in [650,1800]:
                    c,page=context(browser,motion='no-preference');ready(page)
                    page.evaluate('__mall.teleport("atrium")');move(page,0,15)
                    page.locator('#inspect').click();page.evaluate('ms=>__mall.step(ms)',elapsed)
                    trip=state(page);assert trip['elevatorTravel'] and .2<trip['y']<7.0,trip
                    loss(page);settled_state=state(page)
                    floor=0 if trip['y']<3.6 else 7.2
                    assert abs(settled_state['y']-(floor+.015))<1e-5 and not settled_state['elevatorTravel'],settled_state
                    restore(page);enter(page);movement=keyboard_move(page)
                    assert abs(state(page)['y']-floor)<.1
                    row('normal-motion-mid-elevator-loss',elapsedMs=elapsed,trip=trip,settled=settled_state,movement=movement)
                    c.close()
                # Hidden-state and blur fixtures are explicitly synthetic; native loss/restore are real.
                c,page=context(browser);ready(page)
                page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
                loss(page);page.evaluate('__lossExtension.restoreContext()')
                page.wait_for_function('!document.querySelector("#scene").getContext("webgl2").isContextLost()')
                page.set_viewport_size({'width':844,'height':390});page.evaluate("window.dispatchEvent(new Event('blur'))")
                assert not page.evaluate('__mall.ready')
                page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))")
                page.wait_for_function('__mall.ready');assert page.locator('#store-list').is_visible();enter(page)
                assert page.locator('#interaction-point').is_hidden();row('hidden-blur-resize-fixture',metrics=metrics(page));c.close()
                # Initial failures never acquire recoverable availability, even after native restore.
                for failure in ['no-webgl','no-wasm','asset','wasm-during-loss','validation-fault','unrestored']:
                    fixture="""(() => {const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return this.id==='scene'&&t==='webgl2'?null:get.call(this,t,...a);};})()""" if failure=='no-webgl' else None
                    c,page=context(browser,fixture=fixture);expected_errors=[]
                    # Expected network fault logs are captured separately; ordinary paths remain strict.
                    start_error=len(errors)
                    if failure=='no-wasm':page.route('**/rapier.mjs',lambda r:r.abort())
                    if failure=='asset':
                        page.route('**/gjh-tripo-visitor{,-2k}.glb',lambda r:r.abort())
                        page.route('**/gjh-mall-visitor-v2.glb',lambda r:r.abort())
                    if failure=='wasm-during-loss':
                        pending=[];page.route('**/rapier.mjs',lambda r:pending.append(r));page.goto(mall_entry_url(url))
                        for _ in range(150):
                            if pending:break
                            page.wait_for_timeout(20)
                        assert pending;loss(page);page.evaluate('__lossExtension.restoreContext()');pending.pop().abort()
                    elif failure in ['validation-fault','unrestored']:
                        ready(page);loss(page)
                        if failure=='validation-fault':
                            page.evaluate("document.querySelector('#scene').getContext('webgl2').readPixels=()=>{throw Error('TEST readback fault')};__lossExtension.restoreContext()")
                        else:page.wait_for_timeout(150)
                    else:page.goto(mall_entry_url(url))
                    if failure!='unrestored':page.wait_for_function('__mall.state.graphics.status==="failed"',timeout=60000)
                    assert not page.evaluate('__mall.ready') and page.locator('#graphics-return').is_hidden()
                    assert page.locator('#graphics-reload').is_visible()
                    for i in range(4):
                        page.locator('.product-card [data-inspect]').nth(i).click();assert page.locator('#product-image').evaluate('i=>i.complete&&i.naturalWidth>0')
                        native_close(page,'#product-dialog',lambda:page.locator('#product-close').click())
                    expected_errors=errors[start_error:];del errors[start_error:]
                    if failure in ['no-webgl','validation-fault','unrestored']:assert not expected_errors,expected_errors
                    row('failure-fallback',fixture=failure,graphics=state(page)['graphics'],expectedNetworkErrors=expected_errors)
                    c.close()
            # Profile fixtures, storage validation, native selection, breakpoint and software-inset layout.
            fixtures=[('capable',8,8,None),('constrained-cores',2,8,None),('constrained-memory',8,2,None),
                      ('missing',None,None,None),('invalid-storage',8,8,'invalid'),('stored-low',8,8,'low'),('blocked-storage',8,8,'blocked')]
            for label,cores,memory,storage in (fixtures[:1] if args.smoke else fixtures):
                for width,height in ([(390,844),(1440,900)] if label=='capable' else [(1440,900)]):
                    init=f"Object.defineProperty(navigator,'hardwareConcurrency',{{get:()=>{json.dumps(cores)}}});Object.defineProperty(navigator,'deviceMemory',{{get:()=>{json.dumps(memory)}}});"
                    if storage=='blocked':init+="Object.defineProperty(window,'localStorage',{get(){throw Error('TEST blocked storage')}});"
                    elif storage:init+=f"localStorage.setItem('gjh-v11-graphics-quality-v1',{json.dumps(storage)});"
                    c,page=context(browser,width,height,fixture=init);ready(page)
                    expected='low' if label.startswith('constrained') or label=='stored-low' else 'balanced' if width<1000 or label=='missing' else 'detailed'
                    g=state(page)['graphics'];assert g['quality']['tier']==expected,(label,g)
                    page.locator('#keyboard-help>summary').click()
                    profile_frames={}; profile_metrics={}
                    for choice in ['low','detailed','low','balanced','auto']:
                        page.select_option('#graphics-quality',choice);settle(page)
                        q=state(page)['graphics']['quality'];tier=expected if choice=='auto' and label!='stored-low' else ('detailed' if width>=1000 else 'balanced') if choice=='auto' else choice
                        assert q['tier']==tier,(label,choice,q,tier)
                        assert q['shadows']==(tier=='detailed' and width>=1000)
                        assert q['pixelRatio']==(1 if tier=='low' else 1.25 if tier=='balanced' and width<600 else 2)
                        if label=='capable' and width==1440:
                            key=choice+'-after-detailed' if choice in profile_frames else choice
                            profile_frames[key]=shot(page,f'profile-{key}-{width}',True);profile_metrics[key]=metrics(page)
                    if profile_frames:
                        low=Image.open(io.BytesIO(profile_frames['low'])).convert('RGB')
                        detailed=Image.open(io.BytesIO(profile_frames['detailed'])).convert('RGB').resize(low.size)
                        delta=sum(ImageStat.Stat(ImageChops.difference(low,detailed)).mean)/3
                        assert delta>.1,delta
                        balanced=Image.open(io.BytesIO(profile_frames['balanced'])).convert('RGB')
                        detailed_full=Image.open(io.BytesIO(profile_frames['detailed'])).convert('RGB')
                        box=(int(balanced.width*.35),int(balanced.height*.35),int(balanced.width*.65),int(balanced.height*.8))
                        shadow_delta=sum(ImageStat.Stat(ImageChops.difference(balanced.crop(box),detailed_full.crop(box))).mean)/3
                        assert shadow_delta>.1,shadow_delta
                        row('actual-profile-frames',meanRGBDifference=delta,sameDPRCentralSceneShadowDifference=shadow_delta,metrics=profile_metrics)
                    page.locator('#keyboard-help>summary').click();freeze(page)
                    loss(page);restore(page);enter(page);page.locator('#keyboard-help>summary').click()
                    assert page.locator('#graphics-quality').input_value()=='low'
                    # Native macOS select typeahead works in this Chrome; Home/End and popup
                    # arrows did not commit even in a standalone select diagnostic.
                    page.locator('#graphics-quality').focus();page.keyboard.press('d');page.keyboard.press('Tab');settle(page)
                    assert page.locator('#graphics-quality').input_value()=='detailed'
                    assert state(page)['graphics']['quality']['tier']=='detailed'
                    row('hardware-storage-fixture',fixture=label,viewport=[width,height],initial=g,final=state(page)['graphics'])
                    c.close()
            if not args.smoke:
                c,page=context(browser);ready(page)
                page.locator('#keyboard-help>summary').click();page.select_option('#graphics-quality','low')
                assert page.evaluate("localStorage.getItem('gjh-v11-graphics-quality-v1')")=='low'
                page.reload();page.wait_for_function('__mall.ready && __sceneReady',timeout=60000)
                assert state(page)['graphics']['quality']['tier']=='low'
                assert page.locator('#graphics-quality').input_value()=='low'
                row('manual-preference-survives-reload',graphics=state(page)['graphics']);c.close()
                for width,height in [(390,844),(1440,900)]:
                    for dpr in [1,1.5,3]:
                        c,page=context(browser,width,height,dpr=dpr);ready(page)
                        page.locator('#keyboard-help>summary').click()
                        values=[]
                        for choice in ['low','balanced','detailed']:
                            page.select_option('#graphics-quality',choice);settle(page)
                            g=state(page)['graphics'];cap=1 if choice=='low' else 1.25 if choice=='balanced' and width<600 else 2
                            assert g['quality']['pixelRatio']==min(dpr,cap)
                            actual=page.locator('#scene').evaluate('e=>[e.width,e.height,e.clientWidth,e.clientHeight]')
                            assert actual[:2]==[math.floor(actual[2]*min(dpr,cap)),math.floor(actual[3]*min(dpr,cap))],actual
                            values.append({'choice':choice,'graphics':g,'canvas':actual})
                        row('native-browser-DPR-fixture',viewport=[width,height],emulatedDPR=dpr,profiles=values);c.close()
            for width,height in (SIZES[:2] if args.smoke else SIZES):
                c,page=context(browser,width,height);ready(page);shot(page,f'layout-{width}x{height}-collapsed')
                page.locator('#keyboard-help>summary').click();page.locator('#graphics-quality').focus()
                page.keyboard.press('ArrowDown');page.keyboard.press('Tab');page.keyboard.press('Shift+Tab');settle(page)
                geo=page.locator('#graphics-quality').evaluate("""e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {rect:r.toJSON(),focus:e===document.activeElement,focusVisible:e.matches(':focus-visible'),outline:s.outlineWidth,overflow:document.documentElement.scrollWidth>innerWidth,label:e.labels[0].textContent};}""")
                r=geo['rect'];assert r['width']>=44 and r['height']>=44 and not geo['overflow'] and geo['focus'] and geo['focusVisible']
                assert r['left']>=0 and r['right']<=width and r['top']>=0 and r['bottom']<=height,geo
                shot(page,f'layout-{width}x{height}-quality-focus')
                for fraction in [0,.5,1]:page.locator('#controls-copy').evaluate('(e,f)=>e.scrollTop=(e.scrollHeight-e.clientHeight)*f',fraction)
                page.locator('#keyboard-help>summary').click();loss(page);restore(page)
                page.locator('#graphics-return').focus();page.keyboard.press('Tab');page.keyboard.press('Shift+Tab')
                for selector in ['#graphics-return','#graphics-reload']:
                    page.locator(selector).scroll_into_view_if_needed();r=page.locator(selector).bounding_box();assert r['width']>=44 and r['height']>=44
                shot(page,f'layout-{width}x{height}-recovery');row('layout',viewport=[width,height],qualityControl=geo)
                c.close()
            for label,(width,height),insets in ([] if args.smoke else PROFILES):
                c,page=context(browser,width,height);cdp=c.new_cdp_session(page)
                cdp.send('Emulation.setSafeAreaInsetsOverride',{'insets':insets});ready(page)
                page.locator('#keyboard-help>summary').click();page.locator('#graphics-quality').focus();settle(page)
                r=page.locator('#graphics-quality').bounding_box()
                assert r['x']>=insets['left'] and r['y']>=insets['top'] and r['x']+r['width']<=width-insets['right'] and r['y']+r['height']<=height-insets['bottom']
                shot(page,'inset-'+label);row('software-insets',profile=label,insets=insets,qualityControl=r);c.close()
            if args.axe:
                c,page=context(browser);ready(page);page.locator('#keyboard-help>summary').click();page.add_script_tag(path=str(args.axe))
                for surface in ['help','recovery']:
                    if surface=='recovery':loss(page);restore(page)
                    violations=page.evaluate('async()=> (await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})).violations')
                    assert not violations,violations
                    row('axe-changed-surface',surface=surface,violations=violations)
                c.close()
            assert not errors,errors
            assert initial_hashes==source_hashes(root),'Runtime changed during evidence collection'
            report['testSHA256After']=digest(Path(__file__).read_bytes())
            assert report['testSHA256']==report['testSHA256After'],'Test changed during evidence collection'
            report['result']='PASS';report['pageErrors']=errors;browser.close()
    except Exception as error:
        report['result']='FAIL';report['failure']={'message':str(error),'traceback':traceback.format_exc(),'pageErrors':errors}
        save();raise
    finally:
        report['sourceHashesAfter']=source_hashes(root);report['testSHA256After']=digest(Path(__file__).read_bytes())
        server.shutdown();save()
    print(json.dumps({'result':report['result'],'rows':len(report['rows']),'frames':len(report['frames']),'report':str(args.output/'report.json')}))


if __name__=='__main__':run()
