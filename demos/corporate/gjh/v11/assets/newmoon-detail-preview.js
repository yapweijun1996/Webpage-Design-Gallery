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
  const closeButton=document.querySelector('#product-close');
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
      ? 'Unofficial 3D demo. Drag to rotate; scroll or pinch to zoom. Keyboard: arrows, +/−, R to reset.'
      : 'Official packshot shown.';
  }
  function release(s) {
    if(!s||s.disposed)return;
    s.disposed=true;clearTimeout(s.timer);s.controller.abort();s.observer?.disconnect();
    for(const id of s.pointers.keys())if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
    s.pointers.clear();
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
  function setZoom(value) {const s=current;if(!s?.loaded)return;s.zoom=clamp(value,.65,2.6);resize(s);}
  function zoom(delta) {if(current?.loaded)setZoom(current.zoom+delta);}
  function fail(s,reason) {
    if(!valid(s))return;
    const focusInside=canvas===document.activeElement;
    release(s);current=null;last={status:'error',reason,loaded:false,loading:false};
    setMode('image');status.textContent='3D preview unavailable. The official packshot is shown. Close and reopen to retry.';
    if(focusInside)closeButton.focus({preventScroll:true});
  }
  async function load() {
    if(!sku||current?.status==='loading'||current?.loaded)return;
    const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;
    const s={sku,generation:++generation,disposed:false,controller:new AbortController(),status:'loading',loaded:false,yaw:0,pitch:.12,zoom:1.15,pointers:new Map(),renderCount:0};
    current=s;last={status:'loading',reason:null};setMode('image');status.textContent='Loading unofficial 3D demo…';
    function beginGesture(){
      const points=[...s.pointers.values()];s.drag=null;s.pinch=null;
      if(points.length===1)s.drag={...points[0],yaw:s.yaw,pitch:s.pitch};
      else if(points.length===2)s.pinch={distance:Math.max(1,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)),zoom:s.zoom};
    }
    canvas.addEventListener('pointerdown',e=>{
      if(!s.loaded||(e.pointerType==='mouse'&&e.button!==0)||s.pointers.size>=2)return;
      e.preventDefault();canvas.focus({preventScroll:true});s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);beginGesture();
    },{signal:s.controller.signal});
    canvas.addEventListener('pointermove',e=>{
      if(!s.pointers.has(e.pointerId))return;
      s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const points=[...s.pointers.values()];
      if(points.length===2&&s.pinch){const distance=Math.max(1,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y));setZoom(s.pinch.zoom*s.pinch.distance/distance);}
      else if(points.length===1&&s.drag){s.yaw=s.drag.yaw+(points[0].x-s.drag.x)*.01;s.pitch=clamp(s.drag.pitch+(points[0].y-s.drag.y)*.01,-1.2,1.2);render(s);}
    },{signal:s.controller.signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(s.pointers.delete(e.pointerId))beginGesture();},{signal:s.controller.signal});
    canvas.addEventListener('wheel',e=>{if(!s.loaded)return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);setZoom(s.zoom*Math.exp(clamp(delta,-500,500)*.0015));},{passive:false,signal:s.controller.signal});
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
    }catch(error){fail(s,error.message||'unavailable');}finally{clearTimeout(s.timer);}
  }
  function open(id) {
    cleanup();sku=/^new-moon-(nz-425g|au-425g|sa-425g|mx-454g)-front$/.exec(id)?.[1]||null;
    status.hidden=!sku;last={status:'idle',reason:null};setMode('image');
    if(sku)load();
  }
  dialog.addEventListener('close',()=>{cleanup();last={status:'closed',reason:null};setMode('image');});
  document.addEventListener('visibilitychange',()=>{if(current){for(const id of current.pointers.keys())if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);current.pointers.clear();current.drag=null;current.pinch=null;if(!document.hidden)render();}});
  return {open};
}
