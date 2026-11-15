"""D3 native shell runtime, physical traversal, all16 fallbacks and posed draw budget.

Evidence is written outside the repository by default. Test steering is labelled;
it exercises actual Rapier movement, not fabricated positional state.
"""
import argparse,functools,hashlib,http.server,itertools,json,statistics,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_interior_pilot import ROOT,Handler,gallery,boot,state,drive,walk_to
ASSETS=ROOT/'demos/corporate/gjh/v11/assets'
DEFS=json.loads((ASSETS/'interior-shell.json').read_text())['assets']
KINDS=[r['kind'] for r in DEFS]

def source_hashes():
 files=[ROOT/'data/app.json',Path(__file__)]+list((ROOT/'demos/corporate/gjh/v11').glob('*.*'))+list(ASSETS.glob('*.*'))
 return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}

def sample(page,name,count=120):
 values=page.evaluate('''n=>new Promise(resolve=>{let last;const rows=[];function tick(now){const s=__mall.state;if(last)rows.push({ms:now-last,calls:s.drawCalls,triangles:s.renderTriangles,resources:s.rendererResources,frame:s.frames});last=now;if(rows.length<n)requestAnimationFrame(tick);else resolve(rows)}requestAnimationFrame(tick)})''',count)
 times=sorted(v['ms'] for v in values);s=state(page)
 assert max(v['calls'] for v in values)<=200,(name,values)
 return {'name':name,'drawCalls':s['drawCalls'],'triangles':s['renderTriangles'],'resources':s['rendererResources'],'position':[s['x'],s['z']],'sampleCount':len(values),'sampleCountMeaning':'rAF reads, including repeated posed-frame states','distinctRenderedFrames':len({v['frame'] for v in values}),'sampledMaxCalls':max(v['calls'] for v in values),'sampledMaxTriangles':max(v['triangles'] for v in values),'renderedFrameRange':[values[0]['frame'],values[-1]['frame']],'frameMs':{'median':statistics.median(times),'p95':times[min(len(times)-1,int(len(times)*.95))]},'samples':values}

def fixed_route(page,count=120,capture_dir=None,prefix=""):
 def capture(name):
  row=sample(page,name,count)
  if capture_dir:page.screenshot(path=str(capture_dir/f"{prefix}-{name}.png"))
  return row
 rows=[capture('arrival')]
 for pt in ((-3.3,12),(-3.3,9.3),(-3.6,8.8),(-4.7,7.1)):walk_to(page,*pt)
 rows.append(capture('corridor'))
 for zone,x in (('newmoon',-10),('mili',0),('gogo',10)):
  assert page.evaluate('zone=>__mall.teleport(zone)',zone);drive(page);rows.append(capture(zone+'-approach'));walk_to(page,x,-2.3);rows.append(capture(zone+'-interior'))
 return rows

def route_through_stores(page):
 # Continuous route; the New Moon approach goes north of the existing showcase/planter.
 points=[(-3.3,12),(-3.3,9.3),(-3.6,8.8),(-4.7,7.1),(-5.8,6),(-9.3,6),(-9.3,3.7),(-10,3.7)]
 for pt in points:walk_to(page,*pt)
 for zone,x in (('newmoon',-10),('mili',0),('gogo',10)):
  if zone=='mili':
   for pt in ((-10,3.7),(-9.3,3.7),(-9.3,6),(-3.5,6),(-3.5,2.4)):walk_to(page,*pt)
  if zone=='gogo':
   for pt in ((3.5,2.4),(3.5,6),(10,6)):walk_to(page,*pt)
  walk_to(page,x,2.4);walk_to(page,x,-2.3);s=state(page);assert s['zone']==zone and s['doors'][zone]>.99,s
  walk_to(page,x,2.4);assert state(page)['z']>2.3
 for pt in [(10,6),(3.5,6),(3.5,2.4),(-3.5,2.4),(-3.5,6),(-4.7,7.1),(-3.6,8.8),(-3.3,9.3),(-3.3,12),(-2,12)]:walk_to(page,*pt)
 return {'end':[state(page)['x'],state(page)['z']],'threeDoorsBothDirections':'PASS','steering':'read-only __mall input/step; real Rapier movement; no intermediate teleports'}

def directory(page):
 page.locator('#view-toggle').click()
 assert page.locator('[data-store]').count()==3
 for sku in ('nz-425g','au-425g','sa-425g','mx-454g'):
  page.locator(f'.product-card [data-inspect="new-moon-{sku}-front"]').click();assert page.locator('#product-dialog').evaluate('(e)=>e.open');assert sku in page.locator('#product-image').get_attribute('src');page.keyboard.press('Escape')
 page.locator('#view-toggle').click();drive(page)

def run():
 args=argparse.ArgumentParser();args.add_argument('--evidence',type=Path,default=Path('/private/tmp/gallery-interior-d3/runtime'));args.add_argument('--group',choices=['normal','combinations','failures','all'],default='all');opts=args.parse_args();out=opts.evidence;out.mkdir(parents=True,exist_ok=True)
 hashes=source_hashes();report={'scope':'Headless Chrome ANGLE Metal. Deterministic manual stepping renders posed views; later rAF polling may repeatedly read one rendered state. sampleCount is rAF read count, frameMs is scheduling interval, not GPU/render duration. Budget is scoped to recorded posed draws and actual checked steering renders; no field FPS claim.','sourceHashes':hashes,'checks':[]}
 def save():
  report['sourcesUnchanged']=source_hashes()==hashes;(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
 try:
  with tempfile.TemporaryDirectory(prefix='gjh-shell-qa-') as tmp:
   gallery.build(Path(tmp)/'site');server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=tmp));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/site/demos/corporate/gjh/v11/'
   try:
    with sync_playwright() as p:
     browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
     if opts.group in ('normal','all'):
      for profile in ('default','pilot'):
       for width,height in ((390,844),(639,826),(1440,1000)):
        context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',service_workers='block');page,errors,requests=boot(context,url+('?interior=pilot' if profile=='pilot' else ''));s=state(page)
        assert set(s['shell'])==set(KINDS)
        for item in DEFS:
         a=s['shell'][item['kind']];assert a['status']=='loaded' and a['identity']==item['sha256'] and a['assetId']==item['asset_id'],a;assert requests[item['file']]==1
        row={'group':'normal','profile':profile,'viewport':[width,height],'shell':s['shell'],'hardware':page.evaluate('()=>({dpr:devicePixelRatio,cores:navigator.hardwareConcurrency,memory:navigator.deviceMemory})'),'graphics':s['graphics'],'views':fixed_route(page,capture_dir=out,prefix=f'{profile}-{width}')}
        page.evaluate('()=>__mall.teleport("atrium")');drive(page);row['walk']=route_through_stores(page)
        page.screenshot(path=str(out/f'{profile}-{width}-arrival-return.png'))
        # Real keyboard movement on clear arrival floor.
        page.evaluate('()=>__mall.setInput(null)');before=state(page);page.locator('#scene').focus();page.keyboard.down('w');page.wait_for_timeout(220);page.keyboard.up('w');assert state(page)['z']<before['z']-.1
        directory(page)
        # Add an actual verified SKU, then traverse the same full route with cart footprint.
        page.locator('#view-toggle').click();page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.keyboard.press('Escape');page.locator('#view-toggle').click();drive(page)
        page.evaluate('()=>__mall.teleport("atrium")');drive(page);page.locator('#bag-open').click();page.locator('#cart-toggle').click();assert state(page)['pushing'];row['cart']=route_through_stores(page)
        page.locator('#bag-open').click();page.locator('#cart-toggle').click();page.locator('#bag-close').click();drive(page)
        # All native stock and reserve indices remain intact.
        for item in state(page)['productAssets']['cans'].values():assert item['frontFacings']==(11 if profile=='pilot' else 17) and item['reserveIndex']==(16 if profile=='pilot' else 25)
        page.evaluate('()=>__mall.teleport("atrium")');drive(page);before=state(page)['rendererResources']
        for _ in range(4):page.locator('#view-toggle').click();page.locator('#view-toggle').click();drive(page)
        assert state(page)['rendererResources']==before
        row['resources']=page.evaluate('()=>performance.getEntriesByType("resource").map(r=>({path:new URL(r.name).pathname.replace("/site/",""),decodedBytes:r.decodedBodySize,transferBytes:r.transferSize}))');row['errors']=errors;assert not errors;assert state(page)['illegalCount']==0
        report['checks'].append(row);save();print('NORMAL PASS',profile,width,flush=True);context.close()
     if opts.group in ('combinations','all'):
      for combination in itertools.product((False,True),repeat=4):
       context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',service_workers='block');context.add_init_script("localStorage.setItem('gjh-v11-graphics-quality-v1','detailed')")
       for item,failed in zip(DEFS,combination):
        if failed:context.route('**/'+item['file'],lambda route:route.fulfill(status=404,body='D3 unavailable fixture'))
       page,errors,_=boot(context,url);s=state(page);assert s['graphics']['shadows'] and s['graphics']['quality']['tier']=='detailed'
       for item,failed in zip(DEFS,combination):assert s['shell'][item['kind']]['status']==('fallback' if failed else 'loaded')
       row={'group':'combinations','failed':[item['asset_id'] for item,failed in zip(DEFS,combination) if failed],'shell':s['shell'],'views':fixed_route(page,30)}
       directory(page);assert not errors and state(page)['illegalCount']==0;row['errors']=errors;report['checks'].append(row);save();print('COMBINATION PASS',combination,max(v['sampledMaxCalls'] for v in row['views']),flush=True);context.close()
     if opts.group in ('failures','all'):
      for item in DEFS:
       context=browser.new_context(viewport={'width':639,'height':826},reduced_motion='reduce',service_workers='block');context.route('**/'+item['file'],lambda route:route.fulfill(status=200,body='Invalid hash GLB fixture'))
       page,errors,_=boot(context,url);assert state(page)['shell'][item['kind']]['reason']=='invalid';directory(page);assert not errors;report['checks'].append({'group':'corrupt','asset_id':item['asset_id'],'hashRejectionAndDirectory':'PASS'});save();context.close()
      context=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce',service_workers='block');loader=(ROOT/'demos/corporate/gjh/v11/vendor/GLTFLoader.js').read_text();ids=[r['asset_id'] for r in DEFS]
      loader+='\nconst shellIDs='+json.dumps(ids)+';const shellParse=GLTFLoader.prototype.parseAsync;GLTFLoader.prototype.parseAsync=async function(...args){const g=await shellParse.apply(this,args);const id=shellIDs.find(id=>g.scene.getObjectByName(id));if(id){window.__shellLate ||= {};const geometries=new Set(),materials=new Set();g.scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))materials.add(m)}});const row=window.__shellLate[id]={expectedGeometry:geometries.size,expectedMaterial:materials.size,geometry:0,material:0};geometries.forEach(o=>o.addEventListener("dispose",()=>row.geometry++));materials.forEach(o=>o.addEventListener("dispose",()=>row.material++));await new Promise(r=>setTimeout(r,8500));}return g;};\n'
      context.route('**/vendor/GLTFLoader.js',lambda route:route.fulfill(status=200,body=loader,content_type='text/javascript'))
      page,errors,_=boot(context,url);assert all(a['status']=='fallback' and a['reason']=='timeout' for a in state(page)['shell'].values());late_scene_before=state(page)['graphics']['sceneChildren'];page.wait_for_function('ids=>ids.every(id=>{const r=window.__shellLate?.[id];return r&&r.geometry===r.expectedGeometry&&r.material===r.expectedMaterial})',arg=ids,timeout=3000);assert state(page)['graphics']['sceneChildren']==late_scene_before;directory(page);assert not errors;report['checks'].append({'group':'lateparse','allFourTimedOut':'PASS','perAssetDisposals':page.evaluate('window.__shellLate'),'noLateSceneAppend':state(page)['graphics']['sceneChildren']==late_scene_before and all(a['status']=='fallback' for a in state(page)['shell'].values())});save();context.close()
     browser.close()
   finally:server.shutdown();server.server_close()
 finally:save()
 assert report['sourcesUnchanged'],'Runtime/test source changed during checks'
 print('SHELL RUNTIME PASS',len(report['checks']),flush=True)
if __name__=='__main__':run()
