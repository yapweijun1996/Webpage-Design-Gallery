"""Stage6 neutral planned-space parity and native fallback/interaction checks."""
import argparse,functools,hashlib,http.server,json,os,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_gjh_interior_pilot import ROOT,Handler,gallery
BASE=ROOT/'demos/corporate/gjh/v11'
FILES=[BASE/'assets/expanded-layout.js',BASE/'assets/ui.js',BASE/'index.html',BASE/'style.css',ROOT/'tests/gjh_expanded_layout.test.mjs',Path(__file__)]
def hashes():return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in FILES}
def cards(page):
 return page.locator('[data-planned-space]').evaluate_all('''els=>els.map(e=>({id:e.id,number:e.dataset.plannedNumber,label:e.querySelector('h3').textContent,side:e.dataset.plannedSide,status:e.dataset.plannedStatus,available:e.dataset.plannedAvailable,admission:{brand:e.dataset.plannedBrand,content:e.dataset.plannedContent,rights:e.dataset.plannedRights},location:e.querySelector('[data-planned-field=location]').textContent,actions:e.querySelectorAll('a,button,input,select,textarea,[data-store],[data-product],[data-teleport],[data-inspect],[data-add]').length}))''')
def check_cards(page,expected):
 rows=cards(page);assert len(rows)==14
 for row,space in zip(rows,expected):
  assert all(row[key]==space[key] for key in ['id','number','label','side','status','admission']),(row,space)
  assert row['available']=='false' and space['available'] is False and row['actions']==0
  assert row['location']==space['side'].capitalize()+' side · Planned · not open'
 assert page.locator('[data-store]').count()==3 and page.locator('.product-card').count()==4
 assert page.locator('#planned-spaces-directory [data-store],#planned-spaces-directory [data-product]').count()==0
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 return rows

def run():
 parser=argparse.ArgumentParser();parser.add_argument('--evidence',type=Path,default=Path('/private/tmp/gallery-expanded-stage6/browser'));out=parser.parse_args().evidence;out.mkdir(parents=True,exist_ok=True);before=hashes();report={'scope':'Real Chrome DOM/native summary/Map/candidate rejection; emulated sizes and dark preference, not physical-device or dark-directory-theme certification.','sources':before,'checks':[]}
 def save():
  report['sourcesUnchanged']=hashes()==before
  target=out/'report.json'
  def validate_target():
   if target.is_symlink() or (target.exists() and not target.is_file()):raise ValueError('Evidence target must be a regular file, never a symlink')
  validate_target();temporary=None
  try:
   fd,name=tempfile.mkstemp(prefix='.report-',suffix='.json',dir=out);temporary=Path(name)
   with os.fdopen(fd,'w') as stream:
    json.dump(report,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
   validate_target();os.replace(temporary,target);temporary=None
  finally:
   if temporary is not None:temporary.unlink(missing_ok=True)
 try:
  with tempfile.TemporaryDirectory(prefix='gjh-candidates-') as temp:
   gallery.build(Path(temp)/'site');server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=temp));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/site/demos/corporate/gjh/v11/'
   try:
    with sync_playwright() as p:
     browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal','--ignore-gpu-blocklist'])
     expected=None
     for width,height,expanded,dark in [(390,844,False,False),(639,826,False,False),(1440,1000,False,False),(320,740,True,False),(390,844,True,False),(639,826,True,False),(1440,1000,True,False),(320,740,True,True)]:
      context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce',color_scheme='dark' if dark else 'light',service_workers='block');context.add_init_script("sessionStorage.setItem('gjh-v11-guide-seen-v1','1')");page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url+('?layout=expanded' if expanded else ''),wait_until='domcontentloaded');page.wait_for_function('()=>window.__mall?.ready&&window.__sceneReady',timeout=90000)
      expected=page.evaluate('async()=> (await import("./assets/expanded-layout.js")).plannedSpaces')
      section=page.locator('#planned-spaces-directory');assert section.evaluate('e=>e.open')==expanded
      if expanded:
       assert page.locator('.map-planned[data-space-id]').count()==14
       for space in expected:
        rect=page.locator(f'.map-planned[data-space-id="{space["id"]}"]');assert rect.get_attribute('data-space-status')==space['status'];assert rect.locator('title').text_content()==f'{space["label"]}: {space["side"].capitalize()} side; planned, not open.';assert rect.get_attribute('tabindex') is None
      else:assert page.locator('.map-planned').count()==0
      position=page.evaluate('()=>({x:__mall.state.x,z:__mall.state.z})')
      for space in expected:assert page.evaluate('id=>__mall.teleport(id)',space['id']) is False
      assert page.evaluate('()=>({x:__mall.state.x,z:__mall.state.z})')==position
      page.locator('#view-toggle').click();assert page.locator('#store-list').is_visible();summary=section.locator('summary');summary.scroll_into_view_if_needed();summary.focus();page.keyboard.press('Enter');assert section.evaluate('e=>e.open')==(not expanded)
      page.keyboard.press('Enter');assert section.evaluate('e=>e.open')==expanded
      if not expanded:summary.click()
      row={'width':width,'height':height,'expanded':expanded,'darkPreference':dark,'cards':check_cards(page,expected),'candidateTeleportsRejected':14}
      box=summary.bounding_box();assert box['height']>=44 and box['width']>=44
      assert summary.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}')
      name=f'{width}-{"expanded" if expanded else "classic"}-{"dark-preference" if dark else "light"}';page.screenshot(path=str(out/f'{name}.png'));section.screenshot(path=str(out/f'{name}-section.png'))
      summary.click();assert not section.evaluate('e=>e.open');page.locator('#view-toggle').click();page.locator('#view-toggle').click();assert not section.evaluate('e=>e.open');row['nativeCloseRetainedAcrossViews']='PASS'
      page.locator('.product-card [data-inspect]').first.click();page.locator('#product-add').click();page.keyboard.press('Escape');assert '1' in page.locator('#bag-open').inner_text();assert page.evaluate('__mall.state.illegalCount')==0;assert not errors,errors;row['errors']=errors;report['checks'].append(row);save();print('CANDIDATES PASS',width,expanded,dark,flush=True);context.close()
     for mode in ['no-js','physics-failure','webgl-failure']:
      for expanded in [False,True]:
       context=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=mode!='no-js',service_workers='block');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
       if mode=='physics-failure':page.route('**/rapier.mjs',lambda route:route.abort())
       if mode=='webgl-failure':context.add_init_script("const originalContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:originalContext.call(this,type,...args)}")
       page.goto(url+('?layout=expanded' if expanded else ''),wait_until='domcontentloaded')
       if mode in ['physics-failure','webgl-failure']:page.wait_for_function('()=>window.__sceneFailed===true',timeout=90000)
       assert page.locator('#store-list').is_visible();section=page.locator('#planned-spaces-directory')
       if section.get_attribute('open') is None:section.locator('summary').click()
       check_cards(page,expected);assert not errors,errors;report['checks'].append({'mode':mode,'expanded':expanded,'staticReadable14':'PASS','errors':errors});save();print('CANDIDATE FALLBACK PASS',mode,expanded,flush=True);context.close()
     browser.close()
   finally:server.shutdown();server.server_close()
 finally:save()
 assert report['sourcesUnchanged'];print('CANDIDATES ALL PASS',len(report['checks']),flush=True)
if __name__=='__main__':run()
