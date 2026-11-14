"""Fault injection around the real GLB parser verifies late/invalid resource cleanup."""
from browser_gjh_budget import *
import argparse

def run(baseline=None):
 OUT.mkdir(parents=True,exist_ok=True);server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);
   for mode in ['late','invalid','normal']:
    context=b.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if baseline:page.route('**/assets/furnishings.js',lambda route:route.fulfill(path=str(baseline),content_type='text/javascript'))
    suffix='''
const originalParseAsync = GLTFLoader.prototype.parseAsync;
GLTFLoader.prototype.parseAsync = async function(...args) {
 const gltf = await originalParseAsync.apply(this,args);
 if (!gltf.scene.getObjectByName('ASSET_GJHLoungeBench')) return gltf;
 const geometries=new Set(),materials=new Set();
 gltf.scene.traverse(m=>{if(m.isMesh){geometries.add(m.geometry);for(const mat of(Array.isArray(m.material)?m.material:[m.material]))materials.add(mat)}});
 const audit=window.__furnitureAudit={geometryCount:geometries.size,materialCount:materials.size,disposedGeometries:0,disposedMaterials:0};
 for(const geometry of geometries)geometry.addEventListener('dispose',()=>audit.disposedGeometries++);
 for(const material of materials)material.addEventListener('dispose',()=>audit.disposedMaterials++);
 if(MODE==='late')await new Promise(resolve=>setTimeout(resolve,9500));
 if(MODE==='invalid')geometries.values().next().value.deleteAttribute('position');
 return gltf;
};
'''.replace('MODE',json.dumps(mode))
    loader=(ROOT/'demos/corporate/gjh/v11/vendor/GLTFLoader.js').read_text();page.route('**/vendor/GLTFLoader.js',lambda route:route.fulfill(body=loader+suffix,content_type='text/javascript'))
    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/');page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.wait_for_function('window.__furnitureAudit');
    if mode=='late':page.wait_for_timeout(2200)
    audit=page.evaluate('__furnitureAudit');state=page.evaluate('__mall.state.furnishings.bench');assert audit['geometryCount']>0 and audit['materialCount']>0,audit
    expected='loaded' if mode=='normal' else 'fallback';assert state['status']==expected,state
    if mode!='normal':
     assert state['reason']==('timeout' if mode=='late' else 'invalid'),state
     assert audit['disposedGeometries']==audit['geometryCount'] and audit['disposedMaterials']==audit['materialCount'],audit
     assert state['primitives']==0,state
    else:assert audit['disposedGeometries']==0 and audit['disposedMaterials']==0,audit
    page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"');before=page.evaluate('__mall.state');page.evaluate('__mall.setInput({forward:1});__mall.step(500)');after=page.evaluate('__mall.state');assert abs(after['z']-before['z'])>.1
    assert not errors,errors;results.append({'mode':mode,'status':state,'disposal':audit,'walking':'PASS'});context.close()
   b.close()
 finally:server.shutdown()
 (OUT/'furniture-disposal.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--baseline-source',type=Path);run(parser.parse_args().baseline_source)
