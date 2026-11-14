"""Isolated render QA of the actual character module, not a gameplay camera change."""
from browser_gjh_guide import *
out=ROOT.parent/'evidence/v11-collect';s=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=s.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']);page=b.new_page(viewport={'width':480,'height':640});page.goto(f'http://127.0.0.1:{s.server_port}/demos/corporate/gjh/v11/assets/');page.evaluate('''async()=>{const T=await import('../vendor/three.module.min.js'),{createCharacter}=await import('./character.js');const {GLTFLoader}=await import('../vendor/GLTFLoader.js');const item=(await new GLTFLoader().loadAsync('new-moon-can-nz-425g-lod1.glb')).scene;const c=await createCharacter(T),scene=new T.Scene();scene.background=new T.Color(0xe9e4d9);scene.add(c.visual);scene.add(new T.HemisphereLight(0xffffff,0x777777,2.6));const l=new T.DirectionalLight(0xffffff,3);l.position.set(3,5,4);scene.add(l);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(480,640);renderer.setPixelRatio(1);renderer.domElement.style.cssText='position:fixed;inset:0;z-index:999999';document.body.append(renderer.domElement);window.carryFixture={c,scene,T};const camera=new T.PerspectiveCamera(35,.75,.01,20);c.setBagCount(1);window.sampleCarry=(state,phase,side)=>{c.cancelCollection();c.startCollection(item,"new-moon-nz-425g-front");for(let i=0;i<phase;i++)c.update(state,1/60);camera.position.set(side,1.05,side===0?-3:1);camera.lookAt(0,.8,0);renderer.render(scene,camera);const bag=c.visual.getObjectByName('DemoShoppingBag'),bounds=new T.Box3().setFromObject(bag);return {floor:bounds.min.y,visible:bag.visible,pose:c.state.carrying};};}''')
  rows=[]
  for state in ['idle']:
   for side in [-3,0,3]:
    result=page.evaluate('([state,side])=>sampleCarry(state,30,side)',[state,side]);assert result['floor']>.05;rows.append(result);page.screenshot(path=str(out/f'angle-{state}-{side}.png'))
  for phase in [1,12,42,66]:
   page.evaluate('(phase)=>sampleCarry("idle",phase,3)',phase);page.screenshot(path=str(out/f'phase-{phase}.png'))
  (out/'angles-report.json').write_text(json.dumps(rows,indent=2));print('PASS actual character module collection peak three-angle screenshots');b.close()
finally:s.shutdown()
