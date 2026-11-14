"""Published-demo integration checks and rendered review outputs for four conceptual cans."""
from browser_gjh_budget import ROOT, Quiet, functools, http, threading, sync_playwright, os, json
from browser_gjh_v11 import drive
from pathlib import Path
import argparse

def run():
 ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--output',default=str(ROOT.parent/'evidence'/'v11-newmoon'));args=ap.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();results=[]
 url=args.url or f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   for width,height,failed in [(1440,900,False),(768,1024,False),(390,844,False),(390,844,True)]:
    page=browser.new_page(viewport={'width':width,'height':height},has_touch=width<1000,reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if failed:page.route('**/assets/mall-display-shelf.glb',lambda r:r.fulfill(status=404,body=''))
    page.goto(url);page.wait_for_function('__mall.ready && __sceneReady',timeout=60000);page.locator('#guide-start').click();page.wait_for_function('document.activeElement.id==="scene"')
    assets=page.evaluate('__mall.state.productAssets');assert assets['shelf']['status']==('fallback' if failed else 'loaded');assert all(c['status']=='loaded' for c in assets['cans'].values());assert assets['totalInstances']==36
    page.screenshot(path=str(out/f'entrance-{width}-{failed}.png'))
    page.evaluate('__mall.teleport("newmoon")');drive(page,400);drive(page,1500,forward=1);drive(page,300,right=-1);drive(page,2300,forward=1)
    page.screenshot(path=str(out/f'interior-{width}-{failed}.png'))
    records=[]
    # Walk sideways along the unobstructed shelf frontage, inspecting all four original IDs.
    for x,sku in zip([-12.85,-10.95,-9.05,-7.15],['nz-425g','au-425g','sa-425g','mx-454g']):
     for _ in range(80):
      state=page.evaluate('__mall.state');delta=x-state['x']
      if abs(delta)<.08:break
      drive(page,min(50,abs(delta)/2.65*1000+17),right=1 if delta>0 else -1)
     state=page.evaluate('__mall.state');assert abs(state['x']-x)<.12,state
     drive(page,17);assert page.evaluate('__mall.state.nearby')==f'new-moon-{sku}-front'
     page.locator('#scene').focus();page.keyboard.press('f');page.locator('#product-dialog').wait_for(state='visible')
     title=page.locator('#product-title').inner_text();expected=page.locator(f'[data-product="new-moon-{sku}-front"]').get_attribute('data-product-name');assert title==expected
     assert 'unofficial photo-derived demo' in page.locator('#product-description').inner_text()
     if sku=='mx-454g':assert '121-degree' in page.locator('#product-description').inner_text()
     assert page.locator('#product-shop').get_attribute('href')=='https://www.gjheshop.com/'
     page.screenshot(path=str(out/f'detail-{sku}-{width}-{failed}.png'));page.keyboard.press('Escape');page.wait_for_function('document.activeElement.id==="scene"');records.append(sku)
    # Push directly into the final shelf; its physical front must stop the capsule.
    drive(page,2000,forward=1);state=page.evaluate('__mall.state');assert -8.7<state['z']<-8.3,state
    page.locator('#view-toggle').click();assert '121-degree' in page.locator('.packaging-note').inner_text();assert page.locator('.product-card').count()==4
    assert not errors,errors;results.append({'width':width,'shelfFailure':failed,'fourCorrectDetails':records,'shelfCollisionZ':state['z'],'assetStatus':assets,'errors':errors});page.close()
   # Render exact vendored LOD1 bytes in a standalone QA scene, not a public viewer feature.
   page=browser.new_page(viewport={'width':1000,'height':500});page.goto(url);page.wait_for_function('__mall.ready && __sceneReady',timeout=60000)
   await_script='''async()=>{
    const T=await import('./vendor/three.module.min.js');const {GLTFLoader}=await import('./vendor/GLTFLoader.js');
    document.body.replaceChildren();document.body.style.margin='0';const canvas=document.createElement('canvas');document.body.append(canvas);
    const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setSize(1000,500);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    const scene=new T.Scene();scene.background=new T.Color(0xe5e5e5);scene.add(new T.HemisphereLight(0xffffff,0x777777,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(-1,2,4);scene.add(light);
    const camera=new T.PerspectiveCamera(35,2,.01,10);camera.position.set(0,.075,.48);camera.lookAt(0,.06,0);const groups=[];
    for(const [i,sku] of ['nz-425g','au-425g','sa-425g','mx-454g'].entries()){const asset=await new GLTFLoader().loadAsync('./assets/new-moon-can-'+sku+'-lod1.glb');asset.scene.position.x=(i-1.5)*.115;scene.add(asset.scene);groups.push(asset.scene);}
    window.reviewRender=angle=>{groups.forEach(g=>g.rotation.y=angle);renderer.render(scene,camera);};reviewRender(0);
   }'''
   page.evaluate(await_script)
   for name,angle in [('front',0),('back',3.141592653589793),('side',1.5707963267948966)]:page.evaluate('a=>reviewRender(a)',angle);page.screenshot(path=str(out/f'can-studio-{name}.png'))
   page.close();browser.close()
 finally:server.shutdown()
 (out/'report.json').write_text(json.dumps(results,indent=2));print(json.dumps([{'width':r['width'],'shelfFailure':r['shelfFailure'],'details':r['fourCorrectDetails'],'collisionZ':r['shelfCollisionZ']} for r in results],indent=2))
if __name__=='__main__':run()
