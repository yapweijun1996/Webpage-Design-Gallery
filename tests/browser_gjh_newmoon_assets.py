"""Runtime contracts: native-size fallback and bounded independent loads."""
import functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--no-sandbox'])
  for mode in ['loaded','404','body-timeout','hash-mismatch','invalid-dimensions','late-parse','missing-texture']:
   page=browser.new_page();page.route('**/__asset-test',lambda route:route.fulfill(content_type='text/html',body='<!doctype html><title>Asset test</title>'));page.goto(f'http://127.0.0.1:{server.server_port}/__asset-test')
   result=page.evaluate('''async mode => {
    const T=await import('/demos/corporate/gjh/v11/vendor/three.module.min.js');
    const {addProducts}=await import('/demos/corporate/gjh/v11/assets/products.js');
    const {GLTFLoader}=await import('/demos/corporate/gjh/v11/vendor/GLTFLoader.js');
    const parse=GLTFLoader.prototype.parseAsync;const disposal={geometry:0,material:0,texture:0};
    GLTFLoader.prototype.parseAsync=async function(...args){
      const asset=await parse.apply(this,args);
      if(asset.scene.getObjectByName('ASSET_GJHCanNewZealandAbalone') && ['invalid-dimensions','late-parse'].includes(mode)) {
        const gs=new Set(),ms=new Set(),ts=new Set();asset.scene.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of [n.material].flat()){if(!m)continue;ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});
        gs.forEach(v=>v.addEventListener('dispose',()=>disposal.geometry++));ms.forEach(v=>v.addEventListener('dispose',()=>disposal.material++));ts.forEach(v=>v.addEventListener('dispose',()=>disposal.texture++));
        if(mode==='invalid-dimensions')asset.scene.scale.setScalar(2);
        else await new Promise(resolve=>setTimeout(resolve,9000));
      }
      if(mode==='missing-texture' && asset.scene.getObjectByName('ASSET_GJHCanNewZealandAbalone')) asset.scene.traverse(n=>{if(n.material?.map){n.material.map.dispose();n.material.map=null;}});
      return asset;
    };
    const original=window.fetch;
    window.fetch=async (...args)=>{
      if(String(args[0]).includes('new-moon-can-nz-425g-lod1.glb')) {
        if(mode==='hash-mismatch') return new Response('bad bytes',{status:200});
        if(mode==='404') return new Response('',{status:404});
        if(mode==='body-timeout') {const response=await original(...args); return {ok:true,arrayBuffer:()=>new Promise(resolve=>setTimeout(async()=>resolve(await response.arrayBuffer()),10000))};}
      }
      return original(...args);
    };
    const scene=new T.Scene(), canvas=document.createElement('canvas');canvas.width=canvas.height=1000;
    const texture=new T.CanvasTexture(canvas), textures=new Map(['nz-425g','au-425g','sa-425g','mx-454g'].map(sku=>[`new-moon-${sku}-front.jpg`,texture]));
    const started=performance.now();const result=await addProducts(T,scene,textures,new T.MeshStandardMaterial());
    const elapsed=performance.now()-started;
    if(mode==='late-parse')await new Promise(resolve=>setTimeout(resolve,1600));
    const bounds=[];scene.traverse(mesh=>{if(mesh.geometry?.type==='LatheGeometry') {
      mesh.geometry.computeBoundingBox();const matrix=new T.Matrix4();mesh.getMatrixAt(0,matrix);const box=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);bounds.push({min:box.min.toArray(),max:box.max.toArray()});
    }});
    return {mode,elapsed,assets:result.assets,bounds,disposal};
   }''',mode)
   a=result['assets'];assert a['shelf']['status']=='loaded',result
   assert all(a['cans'][sku]['status']=='loaded' for sku in ['au-425g','sa-425g','mx-454g']),result
   nz=a['cans']['nz-425g'];assert nz['status']==('loaded' if mode=='loaded' else 'fallback'),result
   if mode!='loaded':
    b=result['bounds'][0];assert abs(b['min'][1]-.6825)<1e-5,b
    assert abs(b['max'][1]-b['min'][1]-.12399169057607651)<1e-5,b
    assert abs(b['max'][0]-b['min'][0]-.0775)<1e-5,b
   if mode=='body-timeout': assert nz['reason']=='timeout' and 7900<result['elapsed']<9500,result
   if mode in ['invalid-dimensions','late-parse']: assert result['disposal']=={'geometry':3,'material':3,'texture':1},result
   if mode in ['hash-mismatch','invalid-dimensions']: assert nz['reason']==mode,result
   if mode=='missing-texture': assert nz['reason']=='invalid-label-texture',result
   results.append(result);page.close()
  browser.close()
finally: server.shutdown()
print(json.dumps(results,indent=2))
