// Local, static lighting resources. No environment image or postprocessing asset is fetched.
export function createMallAtmosphere(T, renderer, scene, slots) {
  const accents = [0xb84739,0xd4a159,0x79a992,0x785a68,0x913f35,0x667887,0x9c4937,0x477aac,0x294f7c,0x478c86,0x843e43,0x6f9690,0x777f85,0x665079,0x82756a,0x4b9993,0x62696a];
  const warm = new T.Color(0xffe5c1), interiorWarm = new T.Color(0xffd5a0);
  const lights = slots.map((slot, index) => {
    const light = new T.PointLight(0xffe5c1, 28, 11, 2);
    light.name = `Shop ${String(index + 1).padStart(2, '0')} accent light`;
    light.position.set((slot.minX + slot.maxX) / 2, 4.2, (slot.minZ + slot.maxZ) / 2);
    light.visible = false; light.castShadow = false; scene.add(light);
    return {light, accent:new T.Color(accents[index])};
  });
  // World lights and shop accents are already attached, including hidden bays.
  scene.traverse(node => { if (node.isLight) node.layers.enable(2); });
  function applyTheme(theme) {
    warm.set(theme?.lighting?.key ?? 0xffe5c1).lerp(interiorWarm, .25);
    for (const {light, accent} of lights) light.color.copy(warm).lerp(accent, .08);
  }
  applyTheme(null);
  // Reuse the same small candidate array and keep no more than six lights active.
  const nearest = [];
  const accentLimit = Math.min(6,lights.length);
  const interiorWarmLights = {accents:lights.map(entry => entry.light), limit:accentLimit};
  function update(position) {
    nearest.length = 0;
    for (const entry of lights) {
      const dx=entry.light.position.x-position.x, dz=entry.light.position.z-position.z;
      entry.distance=dx*dx+dz*dz;
      entry.light.visible=false;
      if (entry.distance < 24*24 && Math.abs(position.y) < 6) nearest.push(entry);
    }
    nearest.sort((a,b)=>a.distance-b.distance);
    for (let i=0;i<Math.min(accentLimit,nearest.length);i++) nearest[i].light.visible=true;
  }

  // Three keys programs by light type/count. Enumerate the policy's full
  // range rather than assuming a camera route visits every count.
  function lightVariants(sceneLights) {
    const accents=new Set(interiorWarmLights.accents);
    const fixed=sceneLights.filter(light=>{
      if(accents.has(light))return false;
      for(let node=light;node;node=node.parent)if(!node.visible)return false;
      return true;
    });
    return Array.from({length:accentLimit+1},(_,n)=>[...fixed,...lights.slice(0,n).map(entry=>entry.light)]);
  }

  let environment = null;
  function releaseEnvironment() {
    scene.environment=null;
    environment?.dispose();
    environment=null;
  }
  function restoreEnvironment() {
    const generator = new T.PMREMGenerator(renderer), studio = new T.Scene();
    const geometry = new T.BoxGeometry(1,1,1);
    const materials = [new T.MeshBasicMaterial({color:0x6f6050,side:T.BackSide}),
      new T.MeshBasicMaterial({color:0xffe7c5}), new T.MeshBasicMaterial({color:0xfff4dc})];
    const room = new T.Mesh(geometry,materials[0]); room.scale.set(10,6,10); studio.add(room);
    for (const [x,z,w] of [[-2,-4,3],[2,4,2]]) {
      const panel = new T.Mesh(geometry,materials[1]); panel.position.set(x,2,z); panel.scale.set(w,.2,2); studio.add(panel);
    }
    const ceiling = new T.Mesh(geometry,materials[2]); ceiling.position.y=2.9; ceiling.scale.set(7,.1,7); studio.add(ceiling);
    try {
      // At the bundled 256px cubemap size, .04 radians uses 20 blur taps.
      const next=generator.fromScene(studio,.04);
      const previous=environment; environment=next; scene.environment=next.texture;
      if ('environmentIntensity' in scene) scene.environmentIntensity=.4;
      previous?.dispose();
    } catch (error) {
      releaseEnvironment();
      throw error;
    } finally {
      generator.dispose(); geometry.dispose(); materials.forEach(material=>material.dispose());
    }
  }

  // A quarter-resolution, selective glow pass: only explicitly tagged light
  // strips and signs are rendered. Mobile and Low quality use the direct path.
  let base=null, glow=null, composite=null, quad=null, postScene=null, postCamera=null;
  const bufferSize=new T.Vector2(), savedClearColor=new T.Color();
  function initPost() {
    if (base) return;
    base=new T.WebGLRenderTarget(1,1); glow=new T.WebGLRenderTarget(1,1);
    composite=new T.ShaderMaterial({uniforms:{base:{value:base.texture},glow:{value:glow.texture},texel:{value:new T.Vector2(1,1)}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform sampler2D base; uniform sampler2D glow; uniform vec2 texel; varying vec2 vUv;
        void main(){ vec3 c=texture2D(base,vUv).rgb; vec3 b=vec3(0.0);
          for(int x=-2;x<=2;x++) for(int y=-2;y<=2;y++) {
            vec3 s=texture2D(glow,vUv+vec2(float(x),float(y))*texel).rgb;
            b+=max(s-vec3(0.38),vec3(0.0));
          }
          gl_FragColor=vec4(c+b*(0.16/25.0),1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,depthTest:false,depthWrite:false});
    postScene=new T.Scene(); postCamera=new T.Camera();
    quad=new T.Mesh(new T.PlaneGeometry(2,2),composite); quad.frustumCulled=false; postScene.add(quad);
  }
  function sizePost(width,height) {
    initPost();
    base.setSize(width,height);
    glow.setSize(Math.max(1,Math.floor(width/4)),Math.max(1,Math.floor(height/4)));
    composite.uniforms.texel.value.set(1/glow.width,1/glow.height);
  }
  function* preparePost(width,height,screenPixel) {
    sizePost(width,height);
    for(const target of [base,glow]) {
      renderer.initRenderTarget(target);
      yield;
    }
    renderer.compile(postScene,postCamera);
    const program=renderer.properties.get(composite).currentProgram;
    if(renderer.extensions.has('KHR_parallel_shader_compile'))while(!program.isReady())yield false;
    const box=renderer.getScissor(new T.Vector4()), test=renderer.getScissorTest();
    try {
      const size=screenPixel();
      renderer.setScissor(0,0,size,size);renderer.setScissorTest(true);
      renderer.render(postScene,postCamera);
    } finally {
      renderer.setScissor(box);renderer.setScissorTest(test);
    }
  }
  const state={bloom:false,nonNpcCalls:0,npcCalls:0,admitted:0,totalCalls:0,submissions:0};
  function renderVisitors(camera,npcs,reservedCalls) {
    state.nonNpcCalls=renderer.info.render.calls+reservedCalls;
    state.admitted=npcs?.admit(state.nonNpcCalls)||0;
    if (!state.admitted) return;
    const mask=camera.layers.mask, background=scene.background;
    const autoClear=renderer.autoClear, shadowAutoUpdate=renderer.shadowMap.autoUpdate;
    const before=renderer.info.render.calls;
    try {
      // Keep the world's color, depth and shadow maps. Only visitors and the
      // same world lights participate; no mall geometry is resubmitted.
      camera.layers.set(2); scene.background=null;
      renderer.autoClear=false; renderer.shadowMap.autoUpdate=false;
      renderer.render(scene,camera); state.submissions++;
    } finally {
      camera.layers.mask=mask; scene.background=background;
      renderer.autoClear=autoClear; renderer.shadowMap.autoUpdate=shadowAutoUpdate;
    }
    state.npcCalls=renderer.info.render.calls-before;
  }
  function render(camera, enabled, npcs) {
    state.bloom=Boolean(enabled);
    state.npcCalls=0; state.submissions=0;
    const autoReset=renderer.info.autoReset, shadowAutoUpdate=renderer.shadowMap.autoUpdate;
    const target=renderer.getRenderTarget(), mask=camera.layers.mask, background=scene.background;
    const clearColor=renderer.getClearColor(savedClearColor), clearAlpha=renderer.getClearAlpha();
    try {
      renderer.info.autoReset=false; renderer.info.reset();
      npcs?.setVisible(false);
      if (!enabled) {
        renderer.render(scene,camera); state.submissions++;
        renderVisitors(camera,npcs,0);
      } else {
        const size=renderer.getDrawingBufferSize(bufferSize);
        sizePost(size.x,size.y);
        renderer.setRenderTarget(base); renderer.render(scene,camera); state.submissions++;
        renderer.shadowMap.autoUpdate=false;
        camera.layers.set(1); scene.background=null; renderer.setClearColor(0x000000,0);
        renderer.setRenderTarget(glow); renderer.clear(); renderer.render(scene,camera); state.submissions++;
        // Glow is now measured, not predicted from the previous view. Reserve
        // the single composite draw before admitting visitors into base.
        renderer.setRenderTarget(base);
        camera.layers.mask=mask; scene.background=background;
        renderVisitors(camera,npcs,1);
        renderer.setRenderTarget(target); renderer.render(postScene,postCamera); state.submissions++;
      }
      state.totalCalls=renderer.info.render.calls;
    } finally {
      camera.layers.mask=mask; scene.background=background; renderer.setClearColor(clearColor,clearAlpha);
      renderer.setRenderTarget(target); renderer.info.autoReset=autoReset; renderer.shadowMap.autoUpdate=shadowAutoUpdate;
    }
  }
  return {update,lightVariants,interiorWarmLights,preparePost,applyTheme,releaseEnvironment,restoreEnvironment,render,get state(){return state;}};
}
