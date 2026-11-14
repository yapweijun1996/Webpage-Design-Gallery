const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function dispose(root) {
  const geometries=new Set(), materials=new Set(), textures=new Set();
  root?.traverse(object => {
    if(object.geometry) geometries.add(object.geometry);
    for(const material of (Array.isArray(object.material)?object.material:[object.material])) {
      if(!material) continue; materials.add(material);
      for(const value of Object.values(material)) if(value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});
  materials.forEach(m=>m.dispose()); geometries.forEach(g=>g.dispose());
}
export function setupNewMoonPreview() {
  const dialog=document.querySelector('#product-dialog'), host=document.querySelector('#product-preview');
  const image=document.querySelector('#product-image'), status=document.querySelector('#product-preview-status');
  const loadButton=document.querySelector('#product-preview-load'), imageButton=document.querySelector('#product-preview-image');
  const threeButton=document.querySelector('#product-preview-3d'), resetButton=document.querySelector('#product-preview-reset');
  const actions=host.parentElement.querySelector('.product-preview-actions'), controls=host.parentElement.querySelector('.product-preview-controls');
  let canvas=document.querySelector('#product-preview-canvas'), current=null, sku=null, generation=0, mode='image';
  let last={status:'idle',loaded:false,loading:false,reason:null};
  const valid=s=>!!s&&current===s&&!s.disposed&&dialog.open;
  function snapshot() {
    const s=current;
    let projectedBounds=null;
    if(s?.loaded) {
      s.pivot.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);
      const b=new s.T.Box3().setFromObject(s.model),points=[];
      for(const x of [b.min.x,b.max.x]) for(const y of [b.min.y,b.max.y]) for(const z of [b.min.z,b.max.z]) points.push(new s.T.Vector3(x,y,z).project(s.camera));
      projectedBounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
    }
    return Object.freeze({...last,sku,generation,mode,loaded:!!s?.loaded,loading:s?.status==='loading',activeResources:s?.renderer?1:0,liveContexts:s?.renderer?1:0,yaw:s?.yaw,pitch:s?.pitch,zoom:s?.zoom,renderCount:s?.renderCount||0,projectedBounds});
  }
  Object.defineProperty(window,'__newMoonPreview',{value:Object.freeze({get state(){return snapshot();}}),configurable:true});
  function setMode(next) {
    mode=next;host.dataset.previewState=next;image.hidden=next!=='image';canvas.hidden=next!=='3d';
    if(current?.loaded) status.textContent=next==='3d'
      ? 'Unofficial 3D demo. Drag or use the controls to rotate; arrows rotate, +/− zoom, R resets.'
      : 'Official packshot shown. Choose Show 3D preview to return to the unofficial interactive demo.';
    imageButton.hidden=next!=='3d';threeButton.hidden=next!=='image'||!current?.loaded;
    resetButton.hidden=controls.hidden=next!=='3d'||!current?.loaded;
    loadButton.hidden=!sku||!!current?.loaded;loadButton.disabled=current?.status==='loading';
  }
  function release(s) {
    if(!s||s.disposed)return;
    s.disposed=true;clearTimeout(s.timer);s.controller.abort();s.observer?.disconnect();
    if(s.pointerId!==null&&canvas.hasPointerCapture?.(s.pointerId))canvas.releasePointerCapture(s.pointerId);
    dispose(s.model);s.renderer?.dispose();s.renderer?.forceContextLoss();
    s.model=null;s.renderer=null;s.scene=null;s.pivot=null;
  }
  function cleanup() {release(current);current=null;generation++;}
  function render(s=current) {
    if(!valid(s)||!s.loaded||mode!=='3d'||document.hidden)return;
    s.pivot.rotation.set(s.pitch,s.yaw,0);s.camera.position.set(0,0,s.distance);s.camera.lookAt(0,0,0);
    s.camera.updateMatrixWorld();s.pivot.updateMatrixWorld(true);s.renderer.render(s.scene,s.camera);s.renderCount++;
  }
  function resize(s=current) {
    if(!s?.renderer||!valid(s)||mode!=='3d')return;
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
    s.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));s.renderer.setSize(width,height,false);s.camera.aspect=width/height;
    const halfFov=Math.min(s.camera.fov*Math.PI/360,Math.atan(Math.tan(s.camera.fov*Math.PI/360)*s.camera.aspect));
    s.fit=s.radius/Math.sin(halfFov)*1.12;s.distance=s.fit*s.zoom;s.camera.near=.001;s.camera.far=s.fit*5+s.radius*2;s.camera.updateProjectionMatrix();render(s);
  }
  function reset() {const s=current;if(!s?.loaded)return;s.yaw=0;s.pitch=.12;s.zoom=1.15;resize(s);}
  function orbit(dx,dy=0) {const s=current;if(!s?.loaded)return;s.yaw+=dx;s.pitch=clamp(s.pitch+dy,-1.2,1.2);render(s);}
  function zoom(delta) {const s=current;if(!s?.loaded)return;s.zoom=clamp(s.zoom+delta,1,2.6);resize(s);}
  function fail(s,reason) {
    if(!valid(s))return;
    const focusInside=canvas===document.activeElement||controls.contains(document.activeElement)||[resetButton,imageButton,threeButton].includes(document.activeElement);
    release(s);current=null;last={status:'error',reason,loaded:false,loading:false};
    setMode('image');status.textContent='3D preview unavailable. The official packshot and product information remain available. Retry to reload.';
    if(focusInside)loadButton.focus({preventScroll:true});
  }
  async function load() {
    if(!sku||current?.status==='loading'||current?.loaded)return;
    const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;
    const s={sku,generation:++generation,disposed:false,controller:new AbortController(),status:'loading',loaded:false,yaw:0,pitch:.12,zoom:1.15,pointerId:null,renderCount:0};
    current=s;last={status:'loading',reason:null};setMode('image');status.textContent='Loading unofficial 3D demo…';
    canvas.addEventListener('pointerdown',e=>{if(!s.loaded||e.button!==0)return;e.preventDefault();canvas.focus();s.pointerId=e.pointerId;s.drag={x:e.clientX,y:e.clientY,yaw:s.yaw,pitch:s.pitch};canvas.setPointerCapture(e.pointerId);},{signal:s.controller.signal});
    canvas.addEventListener('pointermove',e=>{if(s.pointerId!==e.pointerId||!s.drag)return;s.yaw=s.drag.yaw+(e.clientX-s.drag.x)*.01;s.pitch=clamp(s.drag.pitch+(e.clientY-s.drag.y)*.01,-1.2,1.2);render(s);},{signal:s.controller.signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{s.pointerId=null;s.drag=null;},{signal:s.controller.signal});
    canvas.addEventListener('keydown',e=>{
      const keys={ArrowLeft:[-.18,0],ArrowRight:[.18,0],ArrowUp:[0,-.18],ArrowDown:[0,.18]};
      if(keys[e.key])orbit(...keys[e.key]);else if(['+','='].includes(e.key))zoom(-.15);else if(['-','_'].includes(e.key))zoom(.15);else if(e.key.toLowerCase()==='r')reset();else return;e.preventDefault();
    },{signal:s.controller.signal});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(s,'context-lost');},{signal:s.controller.signal});
    const work=(async()=>{
      const [T,{GLTFLoader},{NEW_MOON_CANS}]=await Promise.all([import('../vendor/three.module.min.js'),import('../vendor/GLTFLoader.js'),import('./products.js')]);
      if(!valid(s))throw Error('cancelled');
      const record=NEW_MOON_CANS.find(r=>r.sku===s.sku);if(!record)throw Error('unknown-sku');
      const response=await fetch(new URL(record.file,import.meta.url),{signal:s.controller.signal});if(!response.ok)throw Error('unavailable');
      const bytes=await response.arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
      if(hash!==record.sha256)throw Error('hash-mismatch');if(!valid(s))throw Error('cancelled');
      const gltf=await new GLTFLoader().parseAsync(bytes,'');if(!valid(s)){dispose(gltf.scene);throw Error('cancelled');}
      return {T,gltf};
    })();
    try {
      const {T,gltf}=await Promise.race([work,new Promise((_,reject)=>{s.timer=setTimeout(()=>reject(Error('load-deadline')),8000);})]);
      clearTimeout(s.timer);if(!valid(s)){dispose(gltf.scene);return;}
      s.T=T;s.model=gltf.scene;
      const box=new T.Box3().setFromObject(s.model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
      if([size.x-.0775,size.y-.12399169,size.z-.0775].some(d=>!Number.isFinite(d)||Math.abs(d)>.0005))throw Error('invalid-dimensions');
      let textured=false;s.model.traverse(o=>{if(o.material?.map?.image)textured=true;});if(!textured)throw Error('missing-texture');
      s.radius=size.length()/2;s.model.position.sub(center);s.scene=new T.Scene();s.pivot=new T.Group();s.pivot.add(s.model);s.scene.add(s.pivot);
      s.camera=new T.PerspectiveCamera(35,1,.001,10);s.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});s.renderer.setClearColor(0x000000,0);
      s.scene.add(new T.HemisphereLight(0xffffff,0x777777,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(-1,2,4);s.scene.add(light);
      s.loaded=true;s.status='loaded';last={status:'loaded',reason:null};setMode('3d');s.observer=new ResizeObserver(()=>resize(s));s.observer.observe(canvas);resize(s);
      if(document.activeElement===loadButton||document.activeElement===document.body)canvas.focus({preventScroll:true});
    }catch(error){fail(s,error.message||'unavailable');}finally{clearTimeout(s.timer);}
  }
  function open(id) {
    cleanup();sku=/^new-moon-(nz-425g|au-425g|sa-425g|mx-454g)-front$/.exec(id)?.[1]||null;
    actions.hidden=!sku;status.hidden=!sku;last={status:'idle',reason:null};setMode('image');status.textContent='Official packshot shown by default. The 3D preview is an unofficial demo.';
  }
  loadButton.addEventListener('click',load);
  imageButton.addEventListener('click',()=>{setMode('image');threeButton.focus({preventScroll:true});});
  threeButton.addEventListener('click',()=>{setMode('3d');resize();canvas.focus({preventScroll:true});});
  resetButton.addEventListener('click',reset);
  controls.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.previewOrbit)orbit(b.dataset.previewOrbit==='left'?-.25:.25);if(b.dataset.previewZoom)zoom(b.dataset.previewZoom==='in'?-.15:.15);});
  dialog.addEventListener('close',()=>{cleanup();last={status:'closed',reason:null};setMode('image');});
  document.addEventListener('visibilitychange',()=>{if(current){current.pointerId=null;current.drag=null;if(!document.hidden)render();}});
  return {open};
}
